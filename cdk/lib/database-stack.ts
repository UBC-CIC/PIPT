import { Stack, StackProps, RemovalPolicy, SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';

import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

import { VpcStack } from './vpc-stack';

export class DatabaseStack extends Stack {
    public readonly dbInstance: rds.DatabaseInstance;
    public readonly secretPathAdminName: string;
    public readonly secretPathUser: secretsmanager.Secret;
    public readonly secretPathTableCreator: secretsmanager.Secret;
    public readonly rdsProxyEndpoint: string;
    public readonly dbSecurityGroup: ec2.ISecurityGroup;

    constructor(scope: Construct, id: string, vpcStack: VpcStack, props?: StackProps) {
        super(scope, id, props);

        /**
         * Create the RDS service-linked role if it doesn't exist
         */
        // new iam.CfnServiceLinkedRole(this, `${id}-RDSServiceLinkedRole`, {
        //     awsServiceName: 'rds.amazonaws.com',
        // });

        /**
         * Retrieve a secret from Secret Manager
         */
        const secret = secretsmanager.Secret.fromSecretNameV2(this, "ImportedSecrets", "GENRXSecrets");

        /**
         * Create Secrets for various users
         */
        this.secretPathAdminName = `${id}-GenRx/credentials/rdsDbCredential`;
        const secretPathUserName = `${id}-GenRx/userCredentials/rdsDbCredential`;
        this.secretPathUser = new secretsmanager.Secret(this, secretPathUserName, {
            secretName: secretPathUserName,
            description: "Secrets for clients to connect to RDS",
            removalPolicy: RemovalPolicy.DESTROY,
            secretObjectValue: {
                username: SecretValue.unsafePlainText("applicationUsername"),   // will be changed at runtime
                password: SecretValue.unsafePlainText("applicationPassword")    // will be changed at runtime
            }
        });

        const secretPathTableCreator = `${id}-GenRx/userCredentials/TableCreator`;
        this.secretPathTableCreator = new secretsmanager.Secret(this, secretPathTableCreator, {
            secretName: secretPathTableCreator,
            description: "Secrets for TableCreator to connect to RDS",
            removalPolicy: RemovalPolicy.DESTROY,
            secretObjectValue: {
                username: SecretValue.unsafePlainText("applicationUsername"),   // will be changed at runtime
                password: SecretValue.unsafePlainText("applicationPassword")    // will be changed at runtime
            }
        });

        const parameterGroup = new rds.ParameterGroup(this, `${id}-rdsParameterGroup`, {
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.VER_16_10,
            }),
            description: "Empty parameter group",
            parameters: {
                'rds.force_ssl': '1'
            }
        });

        /**
         * Create the RDS Postgres database
         */
        this.dbInstance = new rds.DatabaseInstance(this, `${id}-database`, {
            vpc: vpcStack.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.VER_16_10,
            }),
            instanceType: ec2.InstanceType.of(
                ec2.InstanceClass.BURSTABLE4_GRAVITON,
                ec2.InstanceSize.MEDIUM
            ),
            credentials: rds.Credentials.fromUsername(secret.secretValueFromJson("DB_Username").unsafeUnwrap(), {
                secretName: this.secretPathAdminName,
            }),
            multiAz: false,
            allocatedStorage: 100,
            maxAllocatedStorage: 115,
            allowMajorVersionUpgrade: false,
            autoMinorVersionUpgrade: true,
            backupRetention: Duration.days(7),
            deleteAutomatedBackups: true,
            deletionProtection: true,
            databaseName: "genrx",
            publiclyAccessible: false,
            cloudwatchLogsRetention: logs.RetentionDays.INFINITE,
            storageEncrypted: true, // storage encryption at rest
            monitoringInterval: Duration.seconds(60), // enhanced monitoring interval
            parameterGroup: parameterGroup
        });
        
        // Add CIDR ranges of private subnets to inbound rules of RDS
        this.dbSecurityGroup = this.dbInstance.connections.securityGroups[0];
        const dbSecurityGroup = this.dbSecurityGroup;
        if (vpcStack.privateSubnetsCidrStrings && vpcStack.privateSubnetsCidrStrings.length > 0) {
            vpcStack.privateSubnetsCidrStrings.forEach((cidr) => {
                dbSecurityGroup.addIngressRule(
                    ec2.Peer.ipv4(cidr),
                    ec2.Port.tcp(5432),
                    `Allow PostgreSQL traffic from private subnet CIDR range ${cidr}`
                );
            });
        } else {
            console.log("Deploying with new VPC. No need to add private subnet CIDR ranges to inbound rules of RDS.");
        }

        /**
         * Create IAM role for RDS Proxy
         */
        const rdsProxyRole = new iam.Role(this, `${id}-DBProxyRole`, {
            assumedBy: new iam.ServicePrincipal('rds.amazonaws.com')
        });

        // Scope rds-db:connect to the specific RDS instance
        rdsProxyRole.addToPolicy(new iam.PolicyStatement({
            resources: [
                `arn:aws:rds-db:${this.region}:${this.account}:dbuser:${this.dbInstance.instanceIdentifier}/*`
            ],
            actions: [
                'rds-db:connect',
            ],
        }));

        /**
         * Create RDS Proxies for database connections.
         * 
         * NOTE: All three proxies exist to preserve CloudFormation exports during migration.
         * The Api stack has been updated to only use rdsProxyEndpoint — once all environments
         * have deployed this code, a follow-up PR will consolidate to a single proxy.
         */
        const secretPathAdmin = secretsmanager.Secret.fromSecretNameV2(this, 'AdminSecret', this.secretPathAdminName);

        const rdsProxy = this.dbInstance.addProxy(id + '-proxy', {
            secrets: [this.secretPathUser!, this.secretPathTableCreator!, secretPathAdmin],
            vpc: vpcStack.vpc,
            role: rdsProxyRole,
            securityGroups: this.dbInstance.connections.securityGroups,
            requireTLS: true,
        });



        /**
         * Workaround for TargetGroupName not being set automatically by CDK.
         * RDS Proxy requires exactly one target group named 'default'.
         */
        let targetGroup = rdsProxy.node.children.find((child: any) => {
            return child instanceof rds.CfnDBProxyTargetGroup;
        }) as rds.CfnDBProxyTargetGroup;
        targetGroup.addPropertyOverride('TargetGroupName', 'default');

        /**
         * Grant the role permission to connect to the database
         */
        this.dbInstance.grantConnect(rdsProxyRole);

        this.rdsProxyEndpoint = rdsProxy.endpoint;
    }

}