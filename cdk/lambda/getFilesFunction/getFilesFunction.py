import os
import json
import boto3
from botocore.config import Config
from botocore.signers import CloudFrontSigner
import rsa
from datetime import datetime, timedelta
import psycopg2
from aws_lambda_powertools import Logger

logger = Logger()

# Environment variables
REGION = os.environ["REGION"]
BUCKET = os.environ["BUCKET"]
DB_SECRET_NAME = os.environ["SM_DB_CREDENTIALS"]
RDS_PROXY_ENDPOINT = os.environ["RDS_PROXY_ENDPOINT"]
CLOUDFRONT_DOMAIN = os.environ["CLOUDFRONT_DOMAIN"]
CLOUDFRONT_KEY_PAIR_ID = os.environ["CLOUDFRONT_KEY_PAIR_ID"]
SM_CLOUDFRONT_PRIVATE_KEY = os.environ["SM_CLOUDFRONT_PRIVATE_KEY"]

# AWS Clients
secrets_manager_client = boto3.client('secretsmanager')

s3 = boto3.client(
    "s3",
    endpoint_url=f"https://s3.{REGION}.amazonaws.com",
    config=Config(
        s3={"addressing_style": "virtual"}, region_name=REGION, signature_version="s3v4"
    ),
)

# Global variables for caching
connection = None
db_secret = None
cf_private_key = None

def get_secret(secret_name):
    global db_secret
    if db_secret is None:
        try:
            response = secrets_manager_client.get_secret_value(SecretId=secret_name)["SecretString"]
            db_secret = json.loads(response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode JSON for secret {secret_name}: {e}")
            raise ValueError(f"Secret {secret_name} is not properly formatted as JSON.")
        except Exception as e:
            logger.error(f"Error fetching secret {secret_name}: {e}")
            raise
    return db_secret

def connect_to_db():
    global connection
    if connection is None or connection.closed:
        try:
            secret = get_secret(DB_SECRET_NAME)
            connection_params = {
                'dbname': secret["dbname"],
                'user': secret["username"],
                'password': secret["password"],
                'host': RDS_PROXY_ENDPOINT,
                'port': secret["port"]
            }
            connection_string = " ".join([f"{key}={value}" for key, value in connection_params.items()])
            connection = psycopg2.connect(connection_string)
            logger.info("Connected to the database!")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            if connection:
                connection.rollback()
                connection.close()
            raise
    return connection

def list_files_in_s3_prefix(bucket, prefix):
    files = []
    continuation_token = None

    # Fetch all objects in the persona directory, handling pagination
    while True:
        if continuation_token:
            result = s3.list_objects_v2(
                Bucket=bucket, 
                Prefix=prefix, 
                ContinuationToken=continuation_token
            )
        else:
            result = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)

        if 'Contents' in result:
            for obj in result['Contents']:
                files.append(obj['Key'].replace(prefix, ''))

        # Check if there's more data to fetch
        if result.get('IsTruncated'):
            continuation_token = result.get('NextContinuationToken')
        else:
            break

    return files

def get_cf_private_key():
    """Fetch and cache the CloudFront signing private key from Secrets Manager."""
    global cf_private_key
    if cf_private_key is None:
        response = secrets_manager_client.get_secret_value(SecretId=SM_CLOUDFRONT_PRIVATE_KEY)["SecretString"]
        cf_private_key = rsa.PrivateKey.load_pkcs1(response.encode('utf-8'))
    return cf_private_key

def rsa_signer(message):
    """Sign a message with the CloudFront private key (used by CloudFrontSigner)."""
    private_key = get_cf_private_key()
    return rsa.sign(message, private_key, 'SHA-1')

def generate_presigned_url(bucket, key):
    """Generate a CloudFront signed URL for the given S3 key."""
    try:
        cf_signer = CloudFrontSigner(CLOUDFRONT_KEY_PAIR_ID, rsa_signer)
        url = f"https://{CLOUDFRONT_DOMAIN}/{key}"
        expire_date = datetime.utcnow() + timedelta(seconds=900)  # 15 minutes
        signed_url = cf_signer.generate_presigned_url(url, date_less_than=expire_date)
        return signed_url
    except Exception as e:
        logger.exception(f"Error generating CloudFront signed URL for {key}: {e}")
        return None

def get_file_metadata_from_db(persona_id, file_name, file_type):
    connection = connect_to_db()
    if connection is None:
        logger.error("No database connection available.")
        return None, None

    try:
        cur = connection.cursor()
        query = """
            SELECT metadata, display_name 
            FROM "persona_data" 
            WHERE persona_id = %s AND filename = %s AND filetype = %s;
        """
        cur.execute(query, (persona_id, file_name, file_type))
        result = cur.fetchone()
        cur.close()

        if result:
            return result[0], result[1]
        else:
            logger.warning(f"No metadata found for {file_name}.{file_type} for persona {persona_id}")
            return None, None

    except Exception as e:
        logger.error(f"Error retrieving metadata for {file_name}.{file_type}: {e}")
        if cur:
            cur.close()
        connection.rollback()
        return None, None

@logger.inject_lambda_context
def lambda_handler(event, context):
    query_params = event.get("queryStringParameters", {})

    simulation_group_id = query_params.get("simulation_group_id", "")
    persona_id = query_params.get("persona_id", "")

    if not simulation_group_id or not persona_id:
        logger.error("Missing required parameters", extra={
            "simulation_group_id": simulation_group_id,
            "persona_id": persona_id,
        })
        return {
            'statusCode': 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Missing required parameters: simulation_group_id or persona_id')
        }

    try:
        document_prefix = f"{simulation_group_id}/{persona_id}/documents/"
        info_prefix = f"{simulation_group_id}/{persona_id}/info/"
        answer_key_prefix = f"{simulation_group_id}/{persona_id}/answer_key/"
        profile_picture_prefix = f"{simulation_group_id}/{persona_id}/profile_picture/"

        document_files = list_files_in_s3_prefix(BUCKET, document_prefix)
        info_files = list_files_in_s3_prefix(BUCKET, info_prefix)
        answer_key_files = list_files_in_s3_prefix(BUCKET, answer_key_prefix)
        profile_picture_files = list_files_in_s3_prefix(BUCKET, profile_picture_prefix)

        # Retrieve metadata and generate presigned URLs for files
        document_files_urls = {}
        info_files_urls = {}
        answer_key_files_urls = {}

        for file_name in document_files:
            file_type = file_name.split('.')[-1]  # Get the file extension
            presigned_url = generate_presigned_url(BUCKET, f"{document_prefix}{file_name}")
            metadata, display_name = get_file_metadata_from_db(persona_id, file_name.split('.')[0], file_type)
            document_files_urls[file_name] = {
                "url": presigned_url,
                "metadata": metadata,
                "display_name": display_name
            }

        for file_name in info_files:
            file_type = file_name.split('.')[-1]
            presigned_url = generate_presigned_url(BUCKET, f"{info_prefix}{file_name}")
            metadata, display_name = get_file_metadata_from_db(persona_id, file_name.split('.')[0], file_type)
            info_files_urls[file_name] = {
                "url": presigned_url,
                "metadata": metadata,
                "display_name": display_name
            }

        for file_name in answer_key_files:
            file_type = file_name.split('.')[-1]
            presigned_url = generate_presigned_url(BUCKET, f"{answer_key_prefix}{file_name}")
            metadata, display_name = get_file_metadata_from_db(persona_id, file_name.split('.')[0], file_type)
            answer_key_files_urls[file_name] = {
                "url": presigned_url,
                "metadata": metadata,
                "display_name": display_name
            }

        # Get the profile picture URL if it exists
        profile_picture_url = None
        if profile_picture_files:
            profile_picture_key = f"{profile_picture_prefix}{profile_picture_files[0]}"
            profile_picture_url = generate_presigned_url(BUCKET, profile_picture_key)

        logger.info("Presigned URLs and metadata generated successfully", extra={
            "document_files": document_files_urls,
            "info_files": info_files_urls,
            "answer_key_files": answer_key_files_urls,
            "profile_picture": profile_picture_url,
        })

        return {
            'statusCode': 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps({
                'document_files': document_files_urls,
                'info_files': info_files_urls,
                'answer_key_files': answer_key_files_urls,
                'profile_picture_url': profile_picture_url,
            })
        }
    except Exception as e:
        logger.exception(f"Error generating presigned URLs or retrieving metadata: {e}")
        return {
            'statusCode': 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Internal server error')
        }