import * as cdk from "aws-cdk-lib";
import { Stack, StackProps, CfnOutput, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as servicediscovery from "aws-cdk-lib/aws-servicediscovery";
import { VpcStack } from "./vpc-stack";
import { DatabaseStack } from "./database-stack";

/**
 * Deploys the agentcore-voice-agent container into the GenRx VPC with
 * Cloud Map service discovery so the socket-server can reach it by hostname.
 *
 * The agent is NOT exposed publicly — only the socket-server calls it
 * via the internal VOICE_AGENT_ENDPOINT.
 */
export class VoiceAgentStack extends Stack {
  /** Internal URL for the socket-server to call the agent */
  public readonly agentEndpoint: string;

  constructor(
    scope: Construct,
    id: string,
    vpcStack: VpcStack,
    db: DatabaseStack,
    voiceAgentRepo: ecr.IRepository,
    props?: StackProps
  ) {
    super(scope, id, props);

    const vpc = vpcStack.vpc;

    // 1) Cloud Map namespace for internal service discovery
    const namespace = new servicediscovery.PrivateDnsNamespace(
      this,
      "VoiceAgentNamespace",
      {
        name: "genrx.local",
        vpc,
      }
    );

    // 2) ECS cluster (shared VPC, separate cluster for isolation)
    const cluster = new ecs.Cluster(this, "VoiceAgentCluster", { vpc });

    // 3) Task role — Bedrock + KVS permissions
    const taskRole = new iam.Role(this, "VoiceAgentTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
      inlinePolicies: {
        VoiceAgentPolicy: new iam.PolicyDocument({
          statements: [
            // Bedrock bidirectional streaming for Nova Sonic
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithBidirectionalStream",
              ],
              resources: ["*"],
            }),
            // KVS signaling channel + TURN credentials
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "kinesisvideo:DescribeSignalingChannel",
                "kinesisvideo:CreateSignalingChannel",
                "kinesisvideo:GetSignalingChannelEndpoint",
                "kinesisvideo:GetIceServerConfig",
              ],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    // dynamodb permissions
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

    // secrets manager permissions
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue"],
        resources: [db.secretPathUser.secretArn],
      })
    );


    // 4) Fargate task definition
    const taskDef = new ecs.FargateTaskDefinition(this, "VoiceAgentTaskDef", {
      cpu: 512,
      memoryLimitMiB: 1024,
      taskRole,
      executionRole: taskRole,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    // 5) Container — listens on port 8080 (matches Dockerfile CMD)
    taskDef.addContainer("VoiceAgentContainer", {
      image: ecs.ContainerImage.fromEcrRepository(voiceAgentRepo, "latest"),
      portMappings: [{ containerPort: 8080 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "VoiceAgent",
        logRetention: logs.RetentionDays.INFINITE,
      }),
      environment: {
        AWS_REGION: this.region,
        AWS_DEFAULT_REGION: this.region,
        BEDROCK_REGION: "us-east-1",
        KVS_CHANNEL_NAME: "genrx-voice-agent",
        SM_DB_CREDENTIALS: db.secretPathUser.secretName,
        RDS_PROXY_ENDPOINT: db.rdsProxyEndpoint,
      },
    });

    // 6) Fargate service with Cloud Map registration
    const service = new ecs.FargateService(this, "VoiceAgentService", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      cloudMapOptions: {
        name: "voice-agent",
        cloudMapNamespace: namespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
        dnsTtl: Duration.seconds(10),
      },
    });

    // Allow inbound on 8080 from within the VPC (socket-server → agent)
    service.connections.allowFrom(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(8080),
      "Allow socket-server to reach voice agent"
    );

    // Allow outbound UDP for WebRTC media (TURN relay)
    service.connections.allowTo(
      ec2.Peer.anyIpv4(),
      ec2.Port.udpRange(49152, 65535),
      "Allow WebRTC media UDP outbound"
    );

    // 7) Output the internal endpoint for the socket-server
    this.agentEndpoint = `http://voice-agent.genrx.local:8080`;

    new CfnOutput(this, "VoiceAgentEndpoint", {
      value: this.agentEndpoint,
      description:
        "Internal endpoint for the voice agent (pass as VOICE_AGENT_ENDPOINT to socket-server)",
      exportName: `${id}-VoiceAgentEndpoint`,
    });
  }
}
