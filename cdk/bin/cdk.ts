#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AmplifyStack } from "../lib/amplify-stack";
import { ApiServiceStack } from "../lib/api-service-stack";
import { DatabaseStack } from "../lib/database-stack";
import { DBFlowStack } from "../lib/dbFlow-stack";
import { VpcStack } from "../lib/vpc-stack";
import { EcsSocketStack } from "../lib/ecs-socket-stack";
import { TurnServerStack } from "../lib/turn-server-stack";
import { VoiceAgentStack } from "../lib/voice-agent-stack";
import { CICDStack } from "../lib/cicd-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const StackPrefix = app.node.tryGetContext("StackPrefix");
const githubRepo = app.node.tryGetContext("githubRepo");

// CI/CD pipeline — creates ECR repos, CodeBuild projects, and CodePipeline
const cicdStack = new CICDStack(app, `${StackPrefix}-CICD`, {
  env,
  githubRepo,
  githubBranch: app.node.tryGetContext("githubBranch") || "main",
  lambdaFunctions: [
    {
      name: "textGeneration",
      functionName: `${StackPrefix}-Api-TextGenLambdaDockerFunction`,
      sourceDir: "cdk/text_generation",
    },
    {
      name: "dataIngestion",
      functionName: `${StackPrefix}-Api-DataIngestLambdaDockerFunction`,
      sourceDir: "cdk/data_ingestion",
    },
    {
      name: "socketServer",
      functionName: `${StackPrefix}-EcsSocket-SocketServer`,
      sourceDir: "cdk/socket-server",
    },
    {
      name: "voiceAgent",
      functionName: `${StackPrefix}-VoiceAgent-VoiceAgentService`,
      sourceDir: "agentcore-voice-agent/agent",
    },
  ],
});

const vpcStack = new VpcStack(app, `${StackPrefix}-VpcStack`, { env });
const dbStack = new DatabaseStack(app, `${StackPrefix}-Database`, vpcStack, {
  env,
});
const apiStack = new ApiServiceStack(
  app,
  `${StackPrefix}-Api`,
  dbStack,
  vpcStack,
  null, // ecsSocketStack will be passed later
  cicdStack.ecrRepositories["textGeneration"],
  cicdStack.ecrRepositories["dataIngestion"],
  cicdStack.buildProjects["textGeneration"]?.projectName,
  cicdStack.buildProjects["dataIngestion"]?.projectName,
  { env }
);
const turnServerStack = new TurnServerStack(
  app,
  `${StackPrefix}-TurnServer`,
  vpcStack,
  { env }
);
const voiceAgentStack = new VoiceAgentStack(
  app,
  `${StackPrefix}-VoiceAgent`,
  vpcStack,
  cicdStack.ecrRepositories["voiceAgent"],
  { env }
);

const ecsSocketStack = new EcsSocketStack(
  app,
  `${StackPrefix}-EcsSocket`,
  vpcStack,
  dbStack,
  apiStack,
  cicdStack.ecrRepositories["socketServer"],
  turnServerStack,
  voiceAgentStack.agentEndpoint,
  { env }
);
const dbFlowStack = new DBFlowStack(
  app,
  `${StackPrefix}-DBFlow`,
  vpcStack,
  dbStack,
  apiStack,
  { env }
);

const amplifyStack = new AmplifyStack(
  app,
  `${StackPrefix}-Amplify`,
  apiStack,
  ecsSocketStack,
  {
    env,
  }
);
cdk.Tags.of(app).add("app", "GenRx");
