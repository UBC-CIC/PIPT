import boto3
import os
import time

dynamodb = boto3.client("dynamodb")

TABLE_NAME = os.environ["TABLE_NAME"]

# This Lambda is invoked as a CloudFormation custom resource during cdk deploy.
#
# Why is the table not owned by CDK?
#   The table was created manually in the AWS console before this CDK app existed.
#   At that point it already held live chat history data.
#   Handing ownership to CDK would require either destroying and recreating the table
#   (losing all data) or using `cdk import`, which we attempted but could not get to
#   work reliably. So CDK references the table by name rather than managing it.
#
# Why not `new dynamodb.Table(...)`?
#   CloudFormation would try to CREATE a new table, fail with "Table already exists",
#   and roll back the entire stack.
#
# Why not just `Table.fromTableName(...)`?
#   That works for an existing environment but silently fails on a fresh deploy,
#   the stack deploys successfully but every Lambda that touches DynamoDB crashes
#   at runtime with ResourceNotFoundException, with no obvious error at deploy time.
#
# This approach: attempt CreateTable and swallow ResourceInUseException.
#   Existing deploy: table already exists, Lambda returns success immediately.
#   Fresh deploy: table is created with the correct schema before any Lambda needs it.
#   CDK never owns the table lifecycle, so cdk destroy won't wipe chat history.


def handler(event, context):
    request_type = event.get("RequestType")

    if request_type in ("Update", "Delete"):
        return {"PhysicalResourceId": TABLE_NAME}

    # Create — idempotent
    try:
        dynamodb.create_table(
            TableName=TABLE_NAME,
            KeySchema=[{"AttributeName": "SessionId", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "SessionId", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )

        # Wait for ACTIVE before enabling TTL
        for _ in range(30):
            resp = dynamodb.describe_table(TableName=TABLE_NAME)
            if resp["Table"]["TableStatus"] == "ACTIVE":
                break
            time.sleep(5)

        dynamodb.update_time_to_live(
            TableName=TABLE_NAME,
            TimeToLiveSpecification={"Enabled": True, "AttributeName": "expireAt"},
        )

    except dynamodb.exceptions.ResourceInUseException:
        pass  # Table already exists — nothing to do

    return {"PhysicalResourceId": TABLE_NAME}
