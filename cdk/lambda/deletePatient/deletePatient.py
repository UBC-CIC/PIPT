import os
import json
import boto3
from aws_lambda_powertools import Logger

logger = Logger()

s3 = boto3.client('s3')
BUCKET = os.environ["BUCKET"]

@logger.inject_lambda_context
def lambda_handler(event, context):
    query_params = event.get("queryStringParameters", {})
    simulation_group_id = query_params.get("simulation_group_id", "")
    persona_id = query_params.get("persona_id", "")

    if not simulation_group_id or not persona_id:
        logger.error("Missing required parameters", extra={
            "simulation_group_id": simulation_group_id,
            "persona_id": persona_id
        })
        return {
            'statusCode': 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps("Missing required parameters: simulation_group_id or persona_id")
        }

    try:
        # Define the prefix for the persona's files
        persona_prefix = f"{simulation_group_id}/{persona_id}/"

        objects_to_delete = []
        continuation_token = None

        # Fetch all objects in the persona's directory, handling pagination
        while True:
            if continuation_token:
                response = s3.list_objects_v2(
                    Bucket=BUCKET,
                    Prefix=persona_prefix,
                    ContinuationToken=continuation_token
                )
            else:
                response = s3.list_objects_v2(Bucket=BUCKET, Prefix=persona_prefix)

            if 'Contents' in response:
                objects_to_delete.extend([{'Key': obj['Key']} for obj in response['Contents']])

            # Check if there's more data to fetch
            if response.get('IsTruncated'):
                continuation_token = response.get('NextContinuationToken')
            else:
                break

        if objects_to_delete:
            # Delete all objects in the persona's directory
            delete_response = s3.delete_objects(
                Bucket=BUCKET,
                Delete={'Objects': objects_to_delete}
            )
            logger.info(f"Deleted objects: {delete_response}")
            return {
                'statusCode': 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                'body': json.dumps(f"Deleted persona directory: {persona_prefix}")
            }
        else:
            logger.info(f"No objects found in persona directory: {persona_prefix}")
            return {
                'statusCode': 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                'body': json.dumps(f"No objects found in persona directory: {persona_prefix}")
            }

    except Exception as e:
        logger.exception(f"Error deleting persona directory: {e}")
        return {
            'statusCode': 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps(f"Internal server error: {str(e)}")
        }