import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as codeconnections from "aws-cdk-lib/aws-codeconnections";

interface LambdaConfig {
  name: string;           // Module name (e.g., "textGeneration")
  functionName: string;   // Lambda function name (or ECS service identifier)
  sourceDir: string;      // Source directory for Docker build (relative to repo root)
}

interface CICDStackProps extends cdk.StackProps {
  githubRepo: string;
  githubBranch?: string;
  environmentName?: string;
  lambdaFunctions: LambdaConfig[];
  pathFilters?: string[];
}

export class CICDStack extends cdk.Stack {
  public readonly ecrRepositories: { [key: string]: ecr.Repository } = {};
  public readonly buildProjects: { [key: string]: codebuild.IProject } = {};
  public readonly connectionArn: string;

  constructor(scope: Construct, id: string, props: CICDStackProps) {
    super(scope, id, props);

    const envName = props.environmentName ?? "dev";

    // Create a common role for all CodeBuild projects
    const codeBuildRole = new iam.Role(this, "DockerBuildRole", {
      assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
    });

    // REVIEW: The CodeBuild role has AmazonEC2ContainerRegistryPowerUser which grants
    // push/pull to ALL ECR repositories in the account. Since we grant per-repo push via
    // ecrRepo.grantPullPush(buildProject), the managed policy is redundant and overly broad.
    // Remove it and rely on the per-repo grants instead.
    codeBuildRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "AmazonEC2ContainerRegistryPowerUser"
      )
    );

    codeBuildRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "lambda:GetFunction",
          "lambda:UpdateFunctionCode",
          "lambda:UpdateFunctionConfiguration",
        ],
        resources: [
          `arn:aws:lambda:${this.region}:${this.account}:function:*-TextGenLambdaDockerFunction`,
          `arn:aws:lambda:${this.region}:${this.account}:function:*-DataIngestLambdaDockerFunction`,
        ],
      })
    );

    // Create artifacts for pipeline
    const sourceOutput = new codepipeline.Artifact();

    // Create the pipeline
    const pipeline = new codepipeline.Pipeline(this, "DockerImagePipeline", {
      pipelineName: `${id}-DockerImagePipeline`,
    });

    const username = cdk.aws_ssm.StringParameter.valueForStringParameter(
      this,
      "genrx-owner-name"
    );

    // TEMPORARY: Using GitHub PAT instead of CodeStar Connections.
    // Once CodeStar Connection is authorized in the AWS Console, switch back to CodeStarConnectionsSourceAction.
    // To create the PAT secret, run:
    //   aws secretsmanager create-secret \
    //     --name github-personal-access-token \
    //     --secret-string '{"my-github-token": "<YOUR-GITHUB-TOKEN>"}' \
    //     --profile <YOUR-PROFILE-NAME>

    // --- CodeStar Connections (commented out - switch back once connection is authorized) ---
    // const githubConnection = new codeconnections.CfnConnection(
    //   this,
    //   "GitHubConnection",
    //   {
    //     connectionName: `${id}-github-connection`,
    //     providerType: "GitHub",
    //   }
    // );
    // this.connectionArn = githubConnection.attrConnectionArn;
    // new cdk.CfnOutput(this, "GitHubConnectionArn", {
    //   value: githubConnection.attrConnectionArn,
    //   description: "ARN of the GitHub connection. After deployment, authorize this connection in the AWS Console.",
    // });
    // pipeline.addStage({
    //   stageName: "Source",
    //   actions: [
    //     new codepipeline_actions.CodeStarConnectionsSourceAction({
    //       actionName: "GitHub",
    //       owner: username,
    //       repo: props.githubRepo,
    //       branch: props.githubBranch ?? "main",
    //       connectionArn: githubConnection.attrConnectionArn,
    //       output: sourceOutput,
    //       triggerOnPush: true,
    //     }),
    //   ],
    // });
    // --- End CodeStar Connections ---

    // TEMPORARY: GitHub PAT-based source action
    const githubToken = cdk.SecretValue.secretsManager(
      "github-personal-access-token",
      { jsonField: "my-github-token" }
    );

    this.connectionArn = ""; // Placeholder — will be set when switching back to CodeStar Connections

    pipeline.addStage({
      stageName: "Source",
      actions: [
        new codepipeline_actions.GitHubSourceAction({
          actionName: "GitHub",
          owner: username,
          repo: props.githubRepo,
          branch: props.githubBranch ?? "main",
          oauthToken: githubToken,
          output: sourceOutput,
          trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
        }),
      ],
    });

    // Create build actions for each Lambda function
    const buildActions: codepipeline_actions.CodeBuildAction[] = [];

    props.lambdaFunctions.forEach((lambdaConfig) => {
      // Create ECR repository
      const repoName = `${id.toLowerCase()}-${lambdaConfig.name.toLowerCase()}`;
      const ecrRepo = new ecr.Repository(this, `${lambdaConfig.name}Repo`, {
        repositoryName: repoName,
        imageTagMutability: ecr.TagMutability.MUTABLE,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        imageScanOnPush: true,
      });

      ecrRepo.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: "LambdaPullAccess",
          effect: iam.Effect.ALLOW,
          principals: [new iam.ServicePrincipal("lambda.amazonaws.com")],
          actions: [
            "ecr:GetDownloadUrlForLayer",
            "ecr:BatchGetImage",
            "ecr:BatchCheckLayerAvailability",
          ],
          conditions: {
            StringEquals: {
              "aws:SourceAccount": this.account,
            },
          },
        })
      );

      this.ecrRepositories[lambdaConfig.name] = ecrRepo;
      cdk.Tags.of(ecrRepo).add("module", lambdaConfig.name);
      cdk.Tags.of(ecrRepo).add("env", envName);

      // Create CodeBuild project
      const buildProject = new codebuild.PipelineProject(
        this,
        `${lambdaConfig.name}BuildProject`,
        {
          projectName: `${id}-${lambdaConfig.name}Builder`,
          role: codeBuildRole,
          environment: {
            buildImage: lambdaConfig.name === "voiceAgent" 
                ? codebuild.LinuxArmBuildImage.AMAZON_LINUX_2023_STANDARD_3_0
                : codebuild.LinuxBuildImage.STANDARD_7_0,
            privileged: true,
          },
          environmentVariables: {
            AWS_ACCOUNT_ID: { value: this.account },
            AWS_REGION: { value: this.region },
            ENVIRONMENT: { value: envName },
            MODULE_NAME: { value: lambdaConfig.name },
            LAMBDA_FUNCTION_NAME: { value: lambdaConfig.functionName },
            REPO_NAME: { value: repoName },
            REPOSITORY_URI: { value: ecrRepo.repositoryUri },
            GITHUB_USERNAME: { value: username },
            GITHUB_REPO: { value: props.githubRepo },
            PATH_FILTER: { value: lambdaConfig.sourceDir },
          },
          buildSpec: codebuild.BuildSpec.fromObject({
            version: "0.2",
            phases: {
              pre_build: {
                commands: [
                  "echo Logging in to Amazon ECR...",
                  "aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com",
                  'echo "#!/bin/bash" > check_and_build.sh',
                  'echo "set -e" >> check_and_build.sh',
                  'echo "# Source is provided by CodePipeline via CodeStar Connection" >> check_and_build.sh',
                  'echo "cd $CODEBUILD_SRC_DIR" >> check_and_build.sh',
                  'echo "# Check if image exists in ECR" >> check_and_build.sh',
                  'echo "if ! aws ecr describe-images --repository-name $REPO_NAME --image-ids imageTag=latest &>/dev/null; then" >> check_and_build.sh',
                  'echo "  echo \\\"First deployment or image doesn\'t exist - building without path check\\\"" >> check_and_build.sh',
                  'echo "  exit 0" >> check_and_build.sh',
                  'echo "fi" >> check_and_build.sh',
                  'echo "# Initialize git if needed (CodePipeline source may not have .git)" >> check_and_build.sh',
                  'echo "if [ ! -d .git ]; then" >> check_and_build.sh',
                  'echo "  echo \\\"No git history available - building to be safe\\\"" >> check_and_build.sh',
                  'echo "  exit 0" >> check_and_build.sh',
                  'echo "fi" >> check_and_build.sh',
                  'echo "PREV_COMMIT=\\$(git rev-parse HEAD~1 || echo \\\"\\\")" >> check_and_build.sh',
                  'echo "if [ -z \\\"\\$PREV_COMMIT\\\" ]; then" >> check_and_build.sh',
                  'echo "  echo \\\"First commit - building\\\"" >> check_and_build.sh',
                  'echo "  exit 0" >> check_and_build.sh',
                  'echo "fi" >> check_and_build.sh',
                  'echo "CHANGED_FILES=\\$(git diff --name-only \\$PREV_COMMIT HEAD)" >> check_and_build.sh',
                  'echo "echo \\\"Changed files:\\\"" >> check_and_build.sh',
                  'echo "echo \\\"\\$CHANGED_FILES\\\"" >> check_and_build.sh',
                  'echo "if ! echo \\\"\\$CHANGED_FILES\\\" | grep -q \\\"^$PATH_FILTER/\\\"; then" >> check_and_build.sh',
                  'echo "  echo \\\"No changes in $PATH_FILTER — skipping build.\\\"" >> check_and_build.sh',
                  'echo "  exit 1" >> check_and_build.sh',
                  'echo "fi" >> check_and_build.sh',
                  'echo "exit 0" >> check_and_build.sh',
                  "chmod +x check_and_build.sh",
                  "COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)",
                  "IMAGE_TAG=${MODULE_NAME}-${ENVIRONMENT}-${COMMIT_HASH}",
                  "export DOCKER_HOST=unix:///var/run/docker.sock",
                  './check_and_build.sh || { echo "Skipping build due to no changes"; exit 1; }',
                ],
              },
              build: {
                commands: [
                  'echo "Building Docker image..."',
                  `docker build -t $REPOSITORY_URI:$IMAGE_TAG $CODEBUILD_SRC_DIR/${lambdaConfig.sourceDir} -f $CODEBUILD_SRC_DIR/${lambdaConfig.sourceDir}/Dockerfile`,
                ],
              },
              post_build: {
                commands: [
                  "docker tag $REPOSITORY_URI:$IMAGE_TAG $REPOSITORY_URI:latest",
                  "docker push $REPOSITORY_URI:$IMAGE_TAG",
                  "docker push $REPOSITORY_URI:latest",
                  'echo "Waiting for vulnerability scan to complete..."',
                  "sleep 30",
                  'echo "Checking vulnerability scan results..."',
                  `bash -c '
                    SCAN_RESULTS=$(aws ecr describe-image-scan-findings \
                      --repository-name $REPO_NAME \
                      --image-id imageTag=latest \
                      --query "imageScanFindingsSummary.findingCounts.CRITICAL" \
                      --output text 2>/dev/null || echo "0")
                    
                    if [[ "$SCAN_RESULTS" != "0" && "$SCAN_RESULTS" != "None" ]]; then
                      echo "CRITICAL vulnerabilities found: $SCAN_RESULTS. Blocking deployment."
                      exit 1
                    else
                      echo "No critical vulnerabilities found. Proceeding with deployment."
                    fi
                  '`,
                  'echo "Checking if Lambda function exists before updating..."',
                  `bash -c '
                    if aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME &>/dev/null; then
                      echo "Updating Lambda function to use the new image..."
                      aws lambda update-function-code \
                        --function-name $LAMBDA_FUNCTION_NAME \
                        --image-uri $REPOSITORY_URI:latest
                    else
                      echo "Lambda function $LAMBDA_FUNCTION_NAME does not exist yet. Skipping update."
                    fi
                  '`,
                ],
              },
            },
          }),
        }
      );

      this.buildProjects[lambdaConfig.name] = buildProject;

      // Grant permissions to push to ECR
      ecrRepo.grantPullPush(buildProject);

      // Add build action to the list
      buildActions.push(
        new codepipeline_actions.CodeBuildAction({
          actionName: `Build_${lambdaConfig.name}`,
          project: buildProject,
          input: sourceOutput,
        })
      );
    });

    // Add build stage with all build actions
    pipeline.addStage({
      stageName: "Build",
      actions: buildActions,
    });
  }
}
