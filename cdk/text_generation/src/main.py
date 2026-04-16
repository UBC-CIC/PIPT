# Force CodePipeline rebuild - multi-prompt debrief refactor
import os
import json
import boto3
import logging
import psycopg2
from langchain_aws import BedrockEmbeddings

from helpers.vectorstore import get_vectorstore_retriever
from helpers.chat import get_bedrock_llm, get_initial_student_query, get_student_query, create_dynamodb_history_table, get_response, update_session_name, generate_debrief, generate_test_debrief, cache_key_questions

# Set up basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
DB_SECRET_NAME = os.environ["SM_DB_CREDENTIALS"]
REGION = os.environ["REGION"]
RDS_PROXY_ENDPOINT = os.environ["RDS_PROXY_ENDPOINT"]
BEDROCK_LLM_PARAM = os.environ["BEDROCK_LLM_PARAM"]
EMBEDDING_MODEL_PARAM = os.environ["EMBEDDING_MODEL_PARAM"]
TABLE_NAME_PARAM = os.environ["TABLE_NAME_PARAM"]
APPSYNC_GRAPHQL_URL = os.environ.get("APPSYNC_GRAPHQL_URL", "")

# AWS Clients
secrets_manager_client = boto3.client("secretsmanager")
ssm_client = boto3.client("ssm", region_name=REGION)
bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)

# Cached resources
connection = None
db_secret = None
BEDROCK_LLM_ID = None
EMBEDDING_MODEL_ID = None
TABLE_NAME = None

# Cached embeddings instance
embeddings = None

def get_secret(secret_name, expect_json=True):
    global db_secret
    if db_secret is None:
        try:
            response = secrets_manager_client.get_secret_value(SecretId=secret_name)["SecretString"]
            db_secret = json.loads(response) if expect_json else response
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode JSON for secret {secret_name}: {e}")
            raise ValueError(f"Secret {secret_name} is not properly formatted as JSON.")
        except Exception as e:
            logger.error(f"Error fetching secret {secret_name}: {e}")
            raise
    return db_secret


def get_parameter(param_name, cached_var):
    """
    Fetch a parameter value from Systems Manager Parameter Store.
    """
    if cached_var is None:
        try:
            response = ssm_client.get_parameter(Name=param_name, WithDecryption=True)
            cached_var = response["Parameter"]["Value"]
        except Exception as e:
            logger.error(f"Error fetching parameter {param_name}: {e}")
            raise
    return cached_var

def initialize_constants():
    global BEDROCK_LLM_ID, EMBEDDING_MODEL_ID, TABLE_NAME, embeddings
    BEDROCK_LLM_ID = get_parameter(BEDROCK_LLM_PARAM, BEDROCK_LLM_ID)
    EMBEDDING_MODEL_ID = get_parameter(EMBEDDING_MODEL_PARAM, EMBEDDING_MODEL_ID)
    TABLE_NAME = get_parameter(TABLE_NAME_PARAM, TABLE_NAME)

    if embeddings is None:
        embeddings = BedrockEmbeddings(
            model_id=EMBEDDING_MODEL_ID,
            client=bedrock_runtime,
            region_name=REGION,
        )
    
    create_dynamodb_history_table(TABLE_NAME)

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

def get_system_prompt(simulation_group_id):
    connection = connect_to_db()
    if connection is None:
        logger.error("No database connection available.")
        return {
            "statusCode": 500,
            "body": json.dumps("Database connection failed.")
        }
    
    try:
        cur = connection.cursor()
        
        cur.execute("""
            SELECT system_prompt
            FROM "simulation_groups"
            WHERE simulation_group_id = %s;
        """, (simulation_group_id,))

        result = cur.fetchone()
        logger.info(f"Query result: {result}")
        system_prompt = result[0] if result else None

        cur.close()

        if system_prompt:
            logger.info(f"System prompt for simulation_group_id {simulation_group_id} found: {system_prompt}")
        else:
            logger.warning(f"No system prompt found for simulation_group_id {simulation_group_id}")

        return system_prompt

    except Exception as e:
        logger.error(f"Error fetching system prompt: {e}")
        if cur:
            cur.close()
        connection.rollback()
        return None


def get_persona_details(persona_id):
    connection = connect_to_db()
    if connection is None:
        logger.error("No database connection available.")
        return {
            "statusCode": 500,
            "body": json.dumps("Database connection failed.")
        }
    
    try:
        cur = connection.cursor()
        logger.info("Connected to RDS instance!")
        cur.execute("""
            SELECT persona_name, persona_age, persona_prompt
            FROM "personas"
            WHERE persona_id = %s;
        """, (persona_id,))

        result = cur.fetchone()
        logger.info(f"Query result: {result}")

        cur.close()

        if result:
            persona_name, persona_age, persona_prompt = result
            llm_completion = True
            logger.info(f"persona details found for persona_id {persona_id}: "
                        f"Name: {persona_name}, Age: {persona_age}, Prompt: {persona_prompt}, LLM Completion: {llm_completion}")
            return persona_name, persona_age, persona_prompt, llm_completion
        else:
            logger.warning(f"No details found for persona_id {persona_id}")
            return None, None, None, None

    except Exception as e:
        logger.error(f"Error fetching persona details: {e}")
        if cur:
            cur.close()
        connection.rollback()
        return None, None, None, None




def handler(event, context):
    # Version: 2024-01-15-empathy-fix-v2 - Force new deployment
    logger.info("🚀 STREAMING FUNCTION STARTED - Text Generation Lambda function is called!")
    logger.info(f"� Event headers: {event.get('headers', {})}")
    logger.info(f"🔍 FULL EVENT: {json.dumps(event, default=str)}")
    initialize_constants()
    
    # TODO(refactor): Extract auth token extraction and JWT parsing into a helper function
    # Extract the user's Cognito token from the API Gateway event
    auth_token = None
    if 'headers' in event:
        headers = event['headers']
        auth_token = headers.get('Authorization') or headers.get('authorization')
        logger.info(f"🔍 Found headers: {list(headers.keys())}")
    
    if auth_token:
        logger.info(f"🎫 Raw auth token: {auth_token[:30]}...")
        # Extract JWT token from Bearer format if present
        if auth_token.startswith('Bearer '):
            jwt_token = auth_token[7:]  # Remove 'Bearer ' prefix
        else:
            jwt_token = auth_token
        
        # Store the JWT token for AppSync authentication
        from helpers.chat import get_cognito_token
        get_cognito_token.current_token = f"Bearer {jwt_token}"
        logger.info(f"✅ Cognito JWT token extracted and stored: Bearer {jwt_token[:20]}...")
    else:
        logger.warning(f"❌ No Authorization header found. Available headers: {list(headers.keys()) if 'headers' in locals() else 'No headers'}")

    # TODO(refactor): Extract parameter extraction and validation into a helper function
    query_params = event.get("queryStringParameters", {})
    simulation_group_id = query_params.get("simulation_group_id", "")
    session_id = query_params.get("session_id", "")
    persona_id = query_params.get("patient_id", "")
    session_name = query_params.get("session_name", "New Chat")
    student_user_id = event.get('requestContext', {}).get('authorizer', {}).get('userId', '')

    if not simulation_group_id or not session_id or not persona_id:
        return {
            'statusCode': 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps("Missing required parameters: simulation_group_id, session_id, or persona_id")
        }

    # =========================================================================
    # MODE BRANCHING: "debrief" vs default "chat"
    # =========================================================================
    # TODO(refactor): Extract mode branching into a helper function that dispatches to mode-specific handlers
    mode = query_params.get("mode", "chat")

    # TODO(refactor): Extract CORS header construction into a helper function to eliminate repetition
    if mode == "debrief":
        # TODO(refactor): Extract debrief mode handling into a helper function
        logger.info(f"📋 DEBRIEF MODE — generating debrief for session={session_id}")
        try:
            llm = get_bedrock_llm(bedrock_llm_id=BEDROCK_LLM_ID, streaming=False)
            debrief_result = generate_debrief(
                session_id=session_id,
                simulation_group_id=simulation_group_id,
                persona_id=persona_id,
                llm=llm,
                embeddings_model=embeddings,
                ddb_table_name=TABLE_NAME,
            )
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                "body": json.dumps(debrief_result, default=str),
            }
        except Exception as e:
            logger.error(f"Debrief generation failed: {e}")
            logger.exception("Full debrief error:")
            return {
                "statusCode": 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                "body": json.dumps({"error": f"Debrief generation failed: {str(e)}"}),
            }

    if mode == "match":
        # TODO(refactor): Extract match mode handling into a helper function
        logger.info(f"🔄 MATCH MODE — running semantic matching for session={session_id}")
        try:
            body = {} if event.get("body") is None else json.loads(event.get("body"))
            message_id = body.get("message_id", "")
            message_content = body.get("message_content", "")

            if not message_id or not message_content:
                return {
                    "statusCode": 400,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Headers": "*",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "*",
                    },
                    "body": json.dumps("Missing required fields: message_id, message_content"),
                }

            from helpers.chat import match_message_to_questions, get_cached_key_questions
            
            # Check cache first to save time and Bedrock API costs.
            # Use explicit None check — an empty list [] means the cache was
            # populated but there are no key questions for this patient, which
            # is a valid state and should not trigger a re-cache.
            try:
                cached = get_cached_key_questions(session_id, TABLE_NAME)
                if cached is None:
                    cache_key_questions(
                        session_id=session_id,
                        simulation_group_id=simulation_group_id,
                        persona_id=persona_id,
                        embeddings_model=embeddings,
                        table_name=TABLE_NAME,
                    )
            except Exception as e:
                logger.warning(f"Failed to handle key questions cache: {e}")

            # Run SYNCHRONOUSLY so Lambda actually writes to the DB before freezing
            match_message_to_questions(
                message_content=message_content,
                session_id=session_id,
                message_id=message_id,
                embeddings_model=embeddings,
                table_name=TABLE_NAME,
            )

            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                "body": json.dumps({"status": "matching_started"}),
            }
        except Exception as e:
            logger.error(f"Match mode failed: {e}")
            return {
                "statusCode": 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                "body": json.dumps({"error": f"Matching failed: {str(e)}"}),
            }

    if mode == "test_debrief":
        # TODO(refactor): Extract test_debrief mode handling into a helper function
        logger.info(f"🧪 TEST DEBRIEF MODE — generating test debrief for session={session_id}")
        try:
            body = json.loads(event.get("body") or "{}")
            debrief_prompt = body.get("debrief_prompt", "").strip()
            if not debrief_prompt:
                return {
                    "statusCode": 400,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Headers": "*",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "*",
                    },
                    "body": json.dumps({"error": "debrief_prompt is required"}),
                }

            llm = get_bedrock_llm(bedrock_llm_id=BEDROCK_LLM_ID, streaming=False)
            result = generate_test_debrief(
                session_id=session_id,
                simulation_group_id=simulation_group_id,
                persona_id=persona_id,
                llm=llm,
                debrief_prompt=debrief_prompt,
                embeddings_model=embeddings,
                ddb_table_name=TABLE_NAME,
            )
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                "body": json.dumps(result, default=str),
            }
        except Exception as e:
            logger.error(f"Test debrief generation failed: {e}")
            logger.exception("Full test debrief error:")
            return {
                "statusCode": 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                "body": json.dumps({"error": f"Test debrief generation failed: {str(e)}"}),
            }

    if mode == "test_system_prompt":
        logger.info(f"🧪 TEST SYSTEM PROMPT MODE — chat with custom system prompt for persona={persona_id}")
        try:
            body = json.loads(event.get("body") or "{}")
            custom_system_prompt = body.get("system_prompt", "").strip()
            message_content = body.get("message_content", "").strip()

            if not custom_system_prompt:
                return {
                    "statusCode": 400,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Headers": "*",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "*",
                    },
                    "body": json.dumps({"error": "system_prompt is required"}),
                }

            patient_name, patient_age, patient_prompt, llm_completion = get_persona_details(persona_id)
            if patient_name is None:
                return {
                    "statusCode": 400,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Headers": "*",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "*",
                    },
                    "body": json.dumps({"error": "Persona not found"}),
                }

            # Allow overriding the patient prompt from the request body
            custom_patient_prompt = body.get("patient_prompt", "").strip()
            if custom_patient_prompt:
                patient_prompt = custom_patient_prompt

            if not message_content:
                student_query = get_initial_student_query(patient_name)
            else:
                student_query = get_student_query(message_content)

            llm = get_bedrock_llm(bedrock_llm_id=BEDROCK_LLM_ID, streaming=False)

            db_secret = get_secret(DB_SECRET_NAME)
            vectorstore_config_dict = {
                'collection_name': persona_id,
                'dbname': db_secret["dbname"],
                'user': db_secret["username"],
                'password': db_secret["password"],
                'host': RDS_PROXY_ENDPOINT,
                'port': db_secret["port"]
            }

            history_aware_retriever = get_vectorstore_retriever(
                llm=llm,
                vectorstore_config_dict=vectorstore_config_dict,
                embeddings=embeddings
            )

            response = get_response(
                query=student_query,
                patient_name=patient_name,
                llm=llm,
                history_aware_retriever=history_aware_retriever,
                table_name=TABLE_NAME,
                session_id=session_id,
                system_prompt=custom_system_prompt,
                patient_age=patient_age,
                patient_prompt=patient_prompt,
                llm_completion=llm_completion,
                stream=False,
                student_user_id=student_user_id,
                persona_id=persona_id,
                embeddings_model=embeddings,
                ddb_table_name=TABLE_NAME,
                raw_prompt_mode=True
            )

            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                "body": json.dumps({
                    "llm_output": response.get("llm_output", "LLM failed to create response"),
                }),
            }
        except Exception as e:
            logger.error(f"Test system prompt chat failed: {e}")
            logger.exception("Full test system prompt error:")
            return {
                "statusCode": 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                "body": json.dumps({"error": f"Test system prompt chat failed: {str(e)}"}),
            }

    # =========================================================================
    # DEFAULT CHAT MODE — existing flow below
    # =========================================================================

    # TODO(refactor): Extract system prompt and persona detail fetching into a helper function
    system_prompt = get_system_prompt(simulation_group_id)
    if system_prompt is None:
        logger.error(f"Error fetching system prompt for simulation_group_id: {simulation_group_id}")
        return {
            'statusCode': 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Error fetching system prompt')
        }

    patient_name, patient_age, patient_prompt, llm_completion = get_persona_details(persona_id)
    if patient_name is None or patient_age is None or patient_prompt is None or llm_completion is None:
        logger.error(f"Error fetching persona details for persona_id: {persona_id}")
        return {
            'statusCode': 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Error fetching persona details')
        }

    body = {} if event.get("body") is None else json.loads(event.get("body"))
    question = body.get("message_content", "")
    
    logger.info(f"🔍 RAW BODY: {event.get('body')}")
    logger.info(f"🔍 PARSED BODY: {body}")
    logger.info(f"🔍 QUESTION: '{question}'")

    if not question:
        logger.info(f"Start of conversation. Creating conversation history table in DynamoDB.")
        student_query = get_initial_student_query(patient_name)
        # Cache key questions on first message for real-time matching
        try:
            cache_key_questions(
                session_id=session_id,
                simulation_group_id=simulation_group_id,
                persona_id=persona_id,
                embeddings_model=embeddings,
                table_name=TABLE_NAME,
            )
        except Exception as e:
            logger.error(f"Failed to cache key questions: {e}")
    else:
        logger.info(f"Processing student question: {question}")
        student_query = get_student_query(question)
        
    logger.info(f"🔍 FINAL STUDENT QUERY: '{student_query}'")
    


    # Check if streaming is requested
    query_params = event.get("queryStringParameters", {})
    stream = query_params.get("stream", "false").lower() == "true"
    
    try:
        logger.info("Creating Bedrock LLM instance.")
        llm = get_bedrock_llm(bedrock_llm_id=BEDROCK_LLM_ID, streaming=stream)
    except Exception as e:
        logger.error(f"Error getting LLM from Bedrock: {e}")
        return {
            'statusCode': 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Error getting LLM from Bedrock')
        }

    # TODO(refactor): Extract vectorstore config assembly into a helper function
    try:
        logger.info("Retrieving vectorstore config.")
        db_secret = get_secret(DB_SECRET_NAME)
        vectorstore_config_dict = {
            'collection_name': persona_id,
            'dbname': db_secret["dbname"],
            'user': db_secret["username"],
            'password': db_secret["password"],
            'host': RDS_PROXY_ENDPOINT,
            'port': db_secret["port"]
        }
    except Exception as e:
        logger.error(f"Error retrieving vectorstore config: {e}")
        return {
            'statusCode': 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Error retrieving vectorstore config')
        }

    try:
        logger.info("Creating history-aware retriever.")

        history_aware_retriever = get_vectorstore_retriever(
            llm=llm,
            vectorstore_config_dict=vectorstore_config_dict,
            embeddings=embeddings
        )
    except Exception as e:
        logger.error(f"Error creating history-aware retriever: {e}")
        return {
            'statusCode': 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Error creating history-aware retriever')
        }

    try:
        logger.info("Generating response from the LLM.")
        
        logger.info(f"🚀 CALLING get_response with query: '{student_query}'")
        response = get_response(
            query=student_query,
            patient_name=patient_name,
            llm=llm,
            history_aware_retriever=history_aware_retriever,
            table_name=TABLE_NAME,
            session_id=session_id,
            system_prompt=system_prompt,
            patient_age=patient_age,
            patient_prompt=patient_prompt,
            llm_completion=llm_completion,
            stream=stream,
            student_user_id=student_user_id,
            persona_id=persona_id,
            embeddings_model=embeddings,
            ddb_table_name=TABLE_NAME
        )
    except Exception as e:
        logger.error(f"Error getting response: {e}")
        logger.exception("Full error details:")
        return {
            'statusCode': 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps(f'Error getting response: {str(e)}')
        }

    try:
        logger.info("Updating session name if this is the first exchange between the LLM and student")
        potential_session_name = update_session_name(
            TABLE_NAME, session_id, BEDROCK_LLM_ID)
        if potential_session_name:
            logger.info("This is the first exchange between the LLM and student. Updating session name.")
            session_name = potential_session_name
        else:
            logger.info("Not the first exchange between the LLM and student. Session name remains the same.")
    except Exception as e:
        logger.error(f"Error updating session name: {e}")
        session_name = "New Chat"
    


    # TODO(refactor): Extract response formatting into a helper function
    if stream:
        logger.info("Returning streaming response.")
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            "body": json.dumps(response),
            "isBase64Encoded": False
        }
    else:
        logger.info("Returning the generated response.")
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            "body": json.dumps({
                "session_name": session_name,
                "llm_output": response.get("llm_output", "LLM failed to create response"),
                "llm_verdict": response.get("llm_verdict", "LLM failed to create verdict"),
            })
        }