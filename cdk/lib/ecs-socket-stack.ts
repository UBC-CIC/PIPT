import * as cdk from "aws-cdk-lib";
import { Stack, StackProps, CfnOutput, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { VpcStack } from "./vpc-stack";
import { DatabaseStack } from "./database-stack";
import { TurnServerStack } from "./turn-server-stack";

export class EcsSocketStack extends Stack {
  public readonly socketUrl: string;

  constructor(
    scope: Construct,
    id: string,
    vpcStack: VpcStack,
    db: DatabaseStack,
    apiServiceStack: any,
    socketServerRepo: ecr.IRepository,
    turnServerStack: TurnServerStack,
    voiceAgentEndpoint: string | undefined,
    stackPrefix: string,
    props?: StackProps
  ) {
    super(scope, id, props);

    // Resolve voice agent ARN: use explicit value if provided, otherwise read from SSM
    const resolvedVoiceAgentEndpoint = voiceAgentEndpoint ||
      ssm.StringParameter.valueForStringParameter(this, `/${stackPrefix}/voiceAgentArn`);

    const vpc = vpcStack.vpc;

    // 1) ECS cluster
    const cluster = new ecs.Cluster(this, "SocketCluster", { vpc });

    // 2) Task role
    const taskRole = new iam.Role(this, "SocketTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
      inlinePolicies: {
        BedrockPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithBidirectionalStream",
                "bedrock:Converse",
                "bedrock:ConverseStream",
                "bedrock:InvokeModelWithResponseStream",
                "bedrock:ApplyGuardrail",
              ],
              resources: ["*"],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "bedrock-agentcore:InvokeAgentRuntime",
                "bedrock-agentcore:InvokeAgentRuntimeWithWebSocketStream",
              ],
              resources: ["*"],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["sts:AssumeRole", "sts:GetCallerIdentity"],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    // DynamoDB permissions for ECS task role
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
        ],
        resources: [
          `arn:aws:dynamodb:${this.region}:${this.account}:table/DynamoDB-Conversation-Table`,
        ],
      })
    );

    // Add permissions for Cognito Identity operations
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "cognito-identity:GetId",
          "cognito-identity:GetCredentialsForIdentity",
        ],
        resources: ["*"],
      })
    );
    
    // Add VPC endpoint permissions for private subnet access
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
        ],
        resources: ["*"],
      })
    );

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          db.secretPathUser.secretArn,
          apiServiceStack.secret.secretArn
        ],
      })
    );

    // Grant ECS task role permission to read the TURN shared secret
    turnServerStack.turnSecret.grantRead(taskRole);

    // REVIEW: The task role is also used as the execution role. These should be separate:
    // - Task role: permissions the application code needs at runtime (Bedrock, DynamoDB, etc.)
    // - Execution role: permissions ECS needs to pull images and write logs
    // Sharing them means the ECS agent has access to Bedrock, DynamoDB, etc., which violates least privilege.
    const taskDef = new ecs.FargateTaskDefinition(this, "SocketTaskDef", {
      cpu: 1024,
      memoryLimitMiB: 2048,
      taskRole,
      executionRole: taskRole, // ← should be a separate, minimal execution role
    });

    // 4) Container listening on port 80
    taskDef.addContainer("SocketContainer", {
      image: ecs.ContainerImage.fromEcrRepository(socketServerRepo, "latest"),
      portMappings: [{ containerPort: 80 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "Socket",
        logRetention: logs.RetentionDays.INFINITE,
      }),
      environment: {
        NODE_ENV: "production",
        SM_DB_CREDENTIALS: db.secretPathUser.secretName,
        SM_COGNITO_CREDENTIALS: apiServiceStack.secret.secretName,
        RDS_PROXY_ENDPOINT: db.rdsProxyEndpoint,
        AWS_REGION: this.region,
        AWS_DEFAULT_REGION: this.region,
        COGNITO_USER_POOL_ID: apiServiceStack.getUserPoolId(),
        COGNITO_CLIENT_ID: apiServiceStack.getUserPoolClientId(),
        IDENTITY_POOL_ID: apiServiceStack.getIdentityPoolId(),
        TEXT_GENERATION_ENDPOINT: apiServiceStack.getEndpointUrl(),
        APPSYNC_GRAPHQL_URL: apiServiceStack.appSyncApi.graphqlUrl,
        SOCKET_EXECUTION_ROLE_ARN: taskRole.roleArn,
        TURN_SERVER_URL: turnServerStack.turnServerUrl,
        STUN_SERVER_URL: turnServerStack.stunServerUrl,
        BEDROCK_GUARDRAIL_ID: apiServiceStack.getGuardrailId(),
        ...(resolvedVoiceAgentEndpoint ? { VOICE_AGENT_ENDPOINT: resolvedVoiceAgentEndpoint } : {}),
      },
      secrets: {
        TURN_SHARED_SECRET: ecs.Secret.fromSecretsManager(turnServerStack.turnSecret),
      },
    });

    // REVIEW: ECS tasks are placed in PUBLIC subnets with assignPublicIp: true.
    // This gives each task a public IP, which is necessary because the NLB is internet-facing
    // and needs to route to public-subnet targets. However, this exposes the containers directly
    // to the internet. The security group below mitigates this, but consider using an ALB with
    // private subnets if the WebSocket protocol allows it, or use AWS PrivateLink.
    const service = new ecs.FargateService(this, "SocketService", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 2, // Fixed count — no auto-scaling policy. Add Application Auto Scaling for production traffic.
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // 5.1) Allow the NLB (and CloudFront via NLB) to reach your service on port 80
    service.connections.allowFromAnyIpv4(
      ec2.Port.tcp(80),
      "AllowHTTPFromLoadBalancer"
    );

    // 5.2) Allow inbound UDP for WebRTC media (RTP audio)
    service.connections.allowFromAnyIpv4(
      ec2.Port.udpRange(49152, 65535),
      "AllowWebRTCMediaUDP"
    );
    
    // Allow NLB to reach ECS service from VPC
    service.connections.allowFrom(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(80),
      "Allow NLB to reach ECS service"
    );

    // 6) Network Load Balancer on TCP 80
    const nlb = new elbv2.NetworkLoadBalancer(this, "SocketNLB", {
      vpc,
      internetFacing: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });
    // REVIEW: The NLB listener is on port 80 (unencrypted). WebSocket traffic from CloudFront
    // arrives over HTTP. While CloudFront enforces HTTPS on the viewer side (REDIRECT_TO_HTTPS),
    // the origin connection is HTTP_ONLY. Consider adding a TLS listener (port 443) with an
    // ACM certificate for end-to-end encryption.
    const listener = nlb.addListener("TcpListener", {
      port: 80,
      protocol: elbv2.Protocol.TCP,
    });
    listener.addTargets("EcsTargetGroupV2", {
      protocol: elbv2.Protocol.TCP,
      port: 80,
      targets: [service],
      healthCheck: {
        protocol: elbv2.Protocol.TCP,
        port: "80",
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        interval: Duration.seconds(30),
        timeout: Duration.seconds(10),
      },
    });

    // 7) CloudFront distribution in front of the NLB
    const distro = new cloudfront.Distribution(this, "SocketDistro", {
      defaultBehavior: {
        origin: new origins.HttpOrigin(nlb.loadBalancerDnsName, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });

    // 8) Output both CloudFront and direct NLB URLs
    this.socketUrl = `wss://${distro.domainName}`;
    new CfnOutput(this, "SocketUrl", {
      value: this.socketUrl,
      description: "WebSocket server URL via CloudFront + NLB",
      exportName: `${id}-SocketUrl`,
    });
    
    new CfnOutput(this, "DirectSocketUrl", {
      value: `ws://${nlb.loadBalancerDnsName}`,
      description: "Direct WebSocket server URL (bypasses CloudFront)",
      exportName: `${id}-DirectSocketUrl`,
    });
  }
}
