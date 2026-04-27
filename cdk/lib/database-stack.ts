import { Stack, StackProps, RemovalPolicy, SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';

import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secretmanager from 'aws-cdk-lib/aws-secretsmanager';  // NOTE: duplicate import — 'secretmanager' and 'secretsmanager' both reference the same module
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'; // NOTE: this is the same module as 'secretmanager' above — consolidate to one alias

import { VpcStack } from './vpc-stack';

export class DatabaseStack extends Stack {
    public readonly dbInstance: rds.DatabaseInstance;
    public readonly secretPathAdminName: string;
    public readonly secretPathUser: secretsmanager.Secret;
    public readonly secretPathTableCreator: secretsmanager.Secret;
    public readonly rdsProxyEndpoint: string;
    public readonly rdsProxyEndpointTableCreator: string;
    public readonly rdsProxyEndpointAdmin: string;

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
        const secret = secretmanager.Secret.fromSecretNameV2(this, "ImportedSecrets", "GENRXSecrets");

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

        // REVIEW: rds.force_ssl is set to '0', meaning database connections are NOT required to use TLS.
        // All traffic between Lambda/ECS and RDS travels in plaintext within the VPC.
        // Change to '1' and update all client connection configs (lib.js ssl:false, psycopg2 calls)
        // to use SSL before deploying to production.
        const parameterGroup = new rds.ParameterGroup(this, `${id}-rdsParameterGroup`, {
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.VER_16_10,
            }),
            description: "Empty parameter group",
            parameters: {
                'rds.force_ssl': '0'
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
            multiAz: true,
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
        const dbSecurityGroup = this.dbInstance.connections.securityGroups[0];
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

        // REVIEW: This rule opens port 5432 to the ENTIRE VPC CIDR, including public subnets.
        // This is redundant with the per-private-subnet rules above and overly broad.
        // Consider removing this block and relying solely on the private-subnet CIDR rules,
        // or restricting to specific Lambda/ECS security group IDs for tighter access control.
        this.dbInstance.connections.securityGroups.forEach(function (securityGroup) {
            securityGroup.addIngressRule(
                ec2.Peer.ipv4(vpcStack.vpcCidrString),
                ec2.Port.tcp(5432),
                "Allow PostgreSQL traffic from VPC"
            );
        });

        /**
         * Create IAM role for RDS Proxy
         */
        const rdsProxyRole = new iam.Role(this, `${id}-DBProxyRole`, {
            assumedBy: new iam.ServicePrincipal('rds.amazonaws.com')
        });

        // REVIEW: rds-db:connect on '*' is overly broad. Scope this to the specific
        // RDS instance ARN and database user, e.g.:
        //   `arn:aws:rds-db:${this.region}:${this.account}:dbuser:${dbInstance.instanceResourceId}/app_rw`
        rdsProxyRole.addToPolicy(new iam.PolicyStatement({
            resources: ['*'],
            actions: [
                'rds-db:connect',
            ],
        }));

        /**
         * Create RDS Proxy for database connections
         */
        // REVIEW: requireTLS is false on all three RDS Proxy instances. When rds.force_ssl is
        // changed to '1', also set requireTLS: true here so the proxy enforces TLS on its side.
        // Also note: the TableCreator proxy uses '+proxy' in its ID — this is unusual and may cause
        // issues with CloudFormation resource naming. Consider using '-proxy-tablecreator' instead.
        const rdsProxy = this.dbInstance.addProxy(id + '-proxy', {
            secrets: [this.secretPathUser!],
            vpc: vpcStack.vpc,
            role: rdsProxyRole,
            securityGroups: this.dbInstance.connections.securityGroups,
            requireTLS: false,
        });

        const rdsProxyTableCreator = this.dbInstance.addProxy(id + '+proxy', { // NOTE: '+' in construct ID is unconventional
            secrets: [this.secretPathTableCreator!],
            vpc: vpcStack.vpc,
            role: rdsProxyRole,
            securityGroups: this.dbInstance.connections.securityGroups,
            requireTLS: false,
        });

        const secretPathAdmin = secretmanager.Secret.fromSecretNameV2(this, 'AdminSecret', this.secretPathAdminName);
        
        const rdsProxyAdmin = this.dbInstance.addProxy(id + '-proxy-admin', {
            secrets: [secretPathAdmin],
            vpc: vpcStack.vpc,
            role: rdsProxyRole,
            securityGroups: this.dbInstance.connections.securityGroups,
            requireTLS: false,
        });

        /**
         * Workaround for TargetGroupName not being set automatically by CDK.
         * RDS Proxy requires exactly one target group named 'default'.
         */
        let targetGroup = rdsProxy.node.children.find((child: any) => {
            return child instanceof rds.CfnDBProxyTargetGroup;
        }) as rds.CfnDBProxyTargetGroup;

        targetGroup.addPropertyOverride('TargetGroupName', 'default');

        let targetGroupTableCreator = rdsProxyTableCreator.node.children.find((child: any) => {
            return child instanceof rds.CfnDBProxyTargetGroup;
        }) as rds.CfnDBProxyTargetGroup;

        // BUG: targetGroup.addPropertyOverride is called twice — the first call here is a duplicate
        // that overrides the user proxy's target group again instead of the table creator's.
        // The second call (targetGroupTableCreator) is correct. Remove the duplicate line.
        targetGroup.addPropertyOverride('TargetGroupName', 'default');       // ← duplicate, should be removed
        targetGroupTableCreator.addPropertyOverride('TargetGroupName', 'default');

        /**
         * Grant the role permission to connect to the database
         */
        this.dbInstance.grantConnect(rdsProxyRole);

        this.rdsProxyEndpoint = rdsProxy.endpoint;
        this.rdsProxyEndpointTableCreator = rdsProxyTableCreator.endpoint;
        this.rdsProxyEndpointAdmin = rdsProxyAdmin.endpoint;
    }
}