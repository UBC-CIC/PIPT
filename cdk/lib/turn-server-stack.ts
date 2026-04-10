import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { VpcStack } from "./vpc-stack";

/**
 * Provides STUN/TURN configuration for WebRTC ICE negotiation.
 *
 * The self-hosted coturn EC2 instance has been removed because the AWS
 * Control Tower guardrail CT.EC2.PR.8 blocks public-IP EC2 instances.
 *
 * WebRTC voice now uses two paths:
 *  - Voice agent path: KVS TURN (managed by AWS, configured in kvs.py)
 *  - Legacy MediaBridge path: STUN-only (Google public STUN server)
 *
 * The TURN secret is still created (empty/unused) so the socket-server
 * stack doesn't need conditional logic — it just won't have a TURN URL.
 */
export class TurnServerStack extends Stack {
  public readonly turnServerUrl: string;
  public readonly turnSecret: secretsmanager.Secret;
  public readonly stunServerUrl: string;

  constructor(
    scope: Construct,
    id: string,
    _vpcStack: VpcStack,
    props?: StackProps
  ) {
    super(scope, id, props);

    // Shared secret — kept so EcsSocketStack references don't break.
    // Not actively used since there's no coturn instance.
    this.turnSecret = new secretsmanager.Secret(this, "TurnSharedSecret", {
      secretName: `${id}-TurnSharedSecret`,
      description: "Placeholder TURN secret (coturn removed due to Control Tower CT.EC2.PR.8)",
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // No TURN server — empty string means socket-server skips TURN in getIceServers()
    this.turnServerUrl = "";

    // Public Google STUN server (sufficient for most NAT traversal)
    this.stunServerUrl = "stun:stun.l.google.com:19302";

    new CfnOutput(this, "StunServerUrl", {
      value: this.stunServerUrl,
      description: "STUN server URL for WebRTC ICE configuration",
      exportName: `${id}-StunServerUrl`,
    });
  }
}
