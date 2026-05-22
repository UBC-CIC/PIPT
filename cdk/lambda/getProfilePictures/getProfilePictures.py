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

def fetch_persona_ids(simulation_group_id):
    connection = connect_to_db()
    if not connection:
        logger.error("No database connection available.")
        return []

    try:
        cur = connection.cursor()
        query = """
            SELECT persona_id
            FROM personas
            WHERE simulation_group_id = %s;
        """
        cur.execute(query, (simulation_group_id,))
        persona_ids = [row[0] for row in cur.fetchall()]
        cur.close()
        
        return persona_ids
    except Exception as e:
        logger.error(f"Error fetching persona IDs: {e}")
        if cur:
            cur.close()
        connection.rollback()
        return []

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
        # URL-encode path segments (preserve /) for keys with spaces or special chars
        encoded_key = "/".join(
            __import__("urllib.parse", fromlist=["quote"]).quote(segment, safe="")
            for segment in key.split("/")
        )
        url = f"https://{CLOUDFRONT_DOMAIN}/{encoded_key}"
        expire_date = datetime.utcnow() + timedelta(seconds=300)  # 5 minutes
        signed_url = cf_signer.generate_presigned_url(url, date_less_than=expire_date)
        return signed_url
    except Exception as e:
        logger.exception(f"Error generating CloudFront signed URL for {key}: {e}")
        return None

@logger.inject_lambda_context
def lambda_handler(event, context):
    query_params = event.get("queryStringParameters", {})
    simulation_group_id = query_params.get("simulation_group_id")

    if not simulation_group_id:
        return {
            'statusCode': 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps("Missing required parameter: simulation_group_id"),
        }

    # Get persona_ids from database
    persona_ids = fetch_persona_ids(simulation_group_id)

    if not persona_ids:
        return {
            'statusCode': 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps("No persona IDs found"),
        }

    profile_pics = {}
    for persona_id in persona_ids:
        key = f"{simulation_group_id}/{persona_id}/profile_picture/{persona_id}_profile_pic.png"
        url = generate_presigned_url(BUCKET, key)
        if url:
            profile_pics[persona_id] = url

    return {
        'statusCode': 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
        },
        'body': json.dumps(profile_pics)
    }