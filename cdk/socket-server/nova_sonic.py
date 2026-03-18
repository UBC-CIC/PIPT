import os
import sys
import asyncio
import base64
import json
import uuid
import random
import boto3
from aws_sdk_bedrock_runtime.client import BedrockRuntimeClient, InvokeModelWithBidirectionalStreamOperationInput

# DEBUG: Print ALL package versions for troubleshooting
print(f"🔍 BOTO3 VERSION: {boto3.__version__}", flush=True)
try:
    print(f"🔍 BOTOCORE VERSION: {botocore.__version__}", flush=True)
except:
    print(f"🔍 BOTOCORE VERSION: Unable to determine", flush=True)
try:
    import smithy_aws_core
    print(f"🔍 SMITHY_AWS_CORE VERSION: {smithy_aws_core.__version__}", flush=True)
except:
    print(f"🔍 SMITHY_AWS_CORE VERSION: Unable to determine", flush=True)
try:
    import aws_sdk_bedrock_runtime
    print(f"🔍 AWS_SDK_BEDROCK_RUNTIME VERSION: {aws_sdk_bedrock_runtime.__version__}", flush=True)
except:
    print(f"🔍 AWS_SDK_BEDROCK_RUNTIME VERSION: Unable to determine", flush=True)
try:
    import langchain_community
    print(f"🔍 LANGCHAIN_COMMUNITY VERSION: {langchain_community.__version__}", flush=True)
except:
    print(f"🔍 LANGCHAIN_COMMUNITY VERSION: Unable to determine", flush=True)
try:
    import langchain_core
    print(f"🔍 LANGCHAIN_CORE VERSION: {langchain_core.__version__}", flush=True)
except:
    print(f"🔍 LANGCHAIN_CORE VERSION: Unable to determine", flush=True)
try:
    import langchain_aws
    print(f"🔍 LANGCHAIN_AWS VERSION: {langchain_aws.__version__}", flush=True)
except:
    print(f"🔍 LANGCHAIN_AWS VERSION: Unable to determine", flush=True)
try:
    import pgvector
    print(f"🔍 PGVECTOR VERSION: {pgvector.__version__}", flush=True)
except:
    print(f"🔍 PGVECTOR VERSION: Unable to determine", flush=True)
try:
    import requests
    print(f"🔍 REQUESTS VERSION: {requests.__version__}", flush=True)
except:
    print(f"🔍 REQUESTS VERSION: Unable to determine", flush=True)
try:
    import smithy_core
    print(f"🔍 SMITHY_CORE VERSION: {smithy_core.__version__}", flush=True)
except:
    print(f"🔍 SMITHY_CORE VERSION: Unable to determine", flush=True)
try:
    import aws_sdk_signers
    print(f"🔍 AWS_SDK_SIGNERS VERSION: {aws_sdk_signers.__version__}", flush=True)
except:
    print(f"🔍 AWS_SDK_SIGNERS VERSION: Unable to determine", flush=True)
from aws_sdk_bedrock_runtime.models import InvokeModelWithBidirectionalStreamInputChunk, BidirectionalInputPayloadPart
from aws_sdk_bedrock_runtime.config import Config, HTTPAuthSchemeResolver, SigV4AuthScheme
from smithy_aws_core.credentials_resolvers.environment import EnvironmentCredentialsResolver
import langchain_chat_history
import psycopg2
from psycopg2 import pool
import uuid
from datetime import datetime
import logging
import requests
from langchain_aws import BedrockEmbeddings
from langchain_community.vectorstores import PGVector
# Set up basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Connection pool for better performance
pg_conn_pool = None
from threading import Lock
pool_lock = Lock()

# Audio config
INPUT_SAMPLE_RATE = 16000
OUTPUT_SAMPLE_RATE = 24000
CHANNELS = 1
CHUNK_SIZE = 1024

# STS credentials from Cognito will be passed via environment variables



def get_pg_connection():
    global pg_conn_pool
    with pool_lock:
        if pg_conn_pool is None:
            secrets_client = boto3.client('secretsmanager')
            db_secret_name = os.environ.get('SM_DB_CREDENTIALS')
            rds_endpoint = os.environ.get('RDS_PROXY_ENDPOINT')

            if not db_secret_name or not rds_endpoint:
                logger.warning("Database credentials not available")
                raise Exception("Database credentials not configured")

            secret_response = secrets_client.get_secret_value(SecretId=db_secret_name)
            secret = json.loads(secret_response['SecretString'])

            # Create connection pool
            pg_conn_pool = pool.SimpleConnectionPool(
                1, 5,  # min/max connections
                host=rds_endpoint,
                port=secret['port'],
                database=secret['dbname'],
                user=secret['username'],
                password=secret['password']
            )
        
        return pg_conn_pool.getconn()


class NovaSonic:

    def refresh_env_credentials(self):
        # Credentials already set by server.js via STS
        pass

    def __init__(self, model_id='amazon.nova-sonic-v1:0', region=None, socket_client=None, voice_id=None, session_id=None):
        self.user_id = os.getenv("USER_ID")
        self.model_id = model_id
        self.region = 'us-east-1'
        self.deployment_region = region or os.getenv('AWS_REGION', 'us-east-1')
        self.client = None
        self.stream = None
        self.response = None
        self.is_active = False
        self.prompt_name = str(uuid.uuid4())
        self.content_name = str(uuid.uuid4())
        self.audio_content_name = str(uuid.uuid4())
        self.audio_queue = asyncio.Queue()
        self.role = None
        self.display_assistant_text = False
        self.voice_id = voice_id
        self.session_id = session_id or os.getenv("SESSION_ID", "default")
        self.patient_name = os.getenv("PATIENT_NAME", "")
        self.patient_prompt = os.getenv("PATIENT_PROMPT", "")
        self.llm_completion = os.getenv("LLM_COMPLETION", "false").lower() == "true"
        self.extra_system_prompt = os.getenv("EXTRA_SYSTEM_PROMPT", "")
        self.patient_id = os.getenv("PATIENT_ID", "")
        # Cache system prompt and bedrock client
        self._cached_system_prompt = None
        self._bedrock_client = None
        self._chat_context = None
        self._current_user_input = ""

    def _init_client(self):
        """Initialize the Bedrock Client for Nova"""
        config = Config(
            endpoint_uri=f"https://bedrock-runtime.{self.region}.amazonaws.com",
            region=self.region,
            aws_credentials_identity_resolver=EnvironmentCredentialsResolver(),
            http_auth_scheme_resolver=HTTPAuthSchemeResolver(),
            http_auth_schemes={"aws.auth#sigv4": SigV4AuthScheme()},
        )
        self.client = BedrockRuntimeClient(config=config)
        print(f"Initialized Bedrock client for model {self.model_id} in region {self.region}")

    async def send_event(self, event: dict):
        """
        Given a Python dict, serialize it _without_ leading/trailing
        whitespace and send exactly one JSON object per chunk.
        """
        payload = json.dumps(event, separators=(",", ":"))
        chunk = InvokeModelWithBidirectionalStreamInputChunk(
            value=BidirectionalInputPayloadPart(bytes_=payload.encode("utf-8"))
        )
        await self.stream.input_stream.send(chunk)

    def get_default_system_prompt(patient_name) -> str:
        """
        Generate the system prompt for the patient role.

        Returns:
        str: The formatted system prompt string.
        """
        system_prompt = f"""
        You are {patient_name or 'a patient'} and you are talking to a pharmacy student who is trying to help you.
        
        CRITICAL ROLE INSTRUCTIONS:
        - You are ONLY the patient - never switch roles or repeat what the student says
        - When the student speaks to you, respond as the patient would respond
        - Do NOT echo or repeat the student's words back to them
        - Do NOT act as the pharmacy student or provide medical advice
        - Stay in character as the patient at all times
        
        RESPONSE GUIDELINES:
        - Keep responses brief (1-2 sentences maximum)
        - Be realistic about your symptoms and concerns
        - Don't volunteer too much information at once
        - Ask questions a real patient would ask
        - Focus on how you're feeling physically
        - If the student shows empathy, respond naturally as a patient would
        
        WHAT TO AVOID:
        - Never repeat what the student just said
        - Don't switch to being the pharmacy student
        - Don't provide medical explanations
        - Don't break character
        
        Start by saying only "Hello." Then describe your symptoms when asked.
        """
        return system_prompt

    def get_system_prompt(self, patient_name=None, patient_prompt=None, llm_completion=None):
        """Cached system prompt retrieval"""
        if self._cached_system_prompt:
            return self._cached_system_prompt
            
        try:
            conn = get_pg_connection()
            cursor = conn.cursor()
            cursor.execute(
                'SELECT prompt_content FROM system_prompt_history ORDER BY created_at DESC LIMIT 1'
            )
            result = cursor.fetchone()
            cursor.close()
            pg_conn_pool.putconn(conn)
            
            if result and result[0]:
                self._cached_system_prompt = result[0]
                return self._cached_system_prompt
        except Exception as e:
            logger.error(f"Error retrieving system prompt: {e}")
            
        # Fallback to default
        self._cached_system_prompt = self.get_default_system_prompt(patient_name or self.patient_name)
        return self._cached_system_prompt



    async def start_session(self):
        """Start a new Nova Sonic session"""
        if not self.client:
            self._init_client()

        # Init stream
        self.stream = await self.client.invoke_model_with_bidirectional_stream(
            InvokeModelWithBidirectionalStreamOperationInput(model_id=self.model_id)
        )
        print("✅ Bidirectional stream initialized with Nova Sonic", flush=True)
        print(f"🗂️ Using session_id: {self.session_id}", flush=True)
        
        self.is_active = True

        # Send session start event

        # 1) sessionStart
        await self.send_event({
        "event": {
            "sessionStart": {
            "inferenceConfiguration": {
                "maxTokens": 2048,
                "topP": 1.0,
                "temperature": 0.8,
                "stopSequences": []
            }
            }
        }
        })

        
        # Send prompt start event
        voice_ids = {"feminine": ["amy", "tiffany", "lupe"], "masculine": ["matthew", "carlos"]}
        
        # Use the voice ID from frontend if provided, otherwise select a random feminine voice
        selected_voice = self.voice_id if self.voice_id else random.choice(voice_ids['feminine'])
        
        # 2) promptStart
        await self.send_event({
        "event": {
            "promptStart": {
            "promptName": self.prompt_name,
            "textOutputConfiguration": {
                "mediaType": "text/plain"
            },
            "audioOutputConfiguration": {
                "mediaType": "audio/lpcm",
                "sampleRateHertz": 24000,
                "sampleSizeBits": 16,
                "channelCount": 1,
                "voiceId": selected_voice,
                "encoding": "base64",
                "audioType": "SPEECH"
            }
            }
        }
        })


        # 3) SYSTEM contentStart
        await self.send_event({
        "event": {
            "contentStart": {
            "promptName": self.prompt_name,
            "contentName": self.content_name,
            "type": "TEXT",
            "interactive": True,
            "role": "SYSTEM",
            "interrupt": True,
            "textInputConfiguration": {
                "mediaType": "text/plain"
            }
            }
        }
        })


        # Cache chat context to avoid repeated DB calls
        if not self._chat_context:
            self._chat_context = langchain_chat_history.format_chat_history(self.session_id)

        system_prompt = f"""
                        {self.get_system_prompt()}
                        {self._chat_context}
                        """
        
        # 4) textInput (your system prompt)
        await self.send_event({
        "event": {
            "textInput": {
            "promptName": self.prompt_name,
            "contentName": self.content_name,
            "content": system_prompt
            }
        }
        })


        # 5) contentEnd
        await self.send_event({
        "event": {
            "contentEnd": {
            "promptName": self.prompt_name,
            "contentName": self.content_name
            }
        }
        })


        # Start processing responses
        self.response = asyncio.create_task(self._process_responses())

        print(f"✅ Nova Sonic session started (Prompt ID: {self.prompt_name})", flush=True)
        # at the end of start_session() in nova_sonic.py
        print(json.dumps({ "type": "text", "text": "Nova Sonic ready" }), flush=True)



    async def start_audio_input(self):
        self.audio_content_name = str(uuid.uuid4())
        self._current_user_input = ""  # Track user input for empathy evaluation
        await self.send_event({
        "event": {
            "contentStart": {
            "promptName": self.prompt_name,
            "contentName": self.audio_content_name,
            "type": "AUDIO",
            "interactive": True,
            "role": "USER",
            "audioInputConfiguration": {
                "mediaType": "audio/lpcm",
                "sampleRateHertz": INPUT_SAMPLE_RATE,
                "sampleSizeBits": 16,
                "channelCount": CHANNELS,
                "audioType": "SPEECH",
                "encoding": "base64"
            }
            }
        }
        })
    
    async def send_audio_chunk(self, audio_bytes):
        blob = base64.b64encode(audio_bytes).decode("utf-8")
        await self.send_event({
        "event": {
            "audioInput": {
            "promptName": self.prompt_name,
            "contentName": self.audio_content_name,
            "content": blob
            }
        }
        })
    
    async def end_audio_input(self):
        await self.send_event({
        "event": {
            "contentEnd": {
            "promptName": self.prompt_name,
            "contentName": self.audio_content_name
            }
        }
        })
        
        # Trigger empathy evaluation for the completed user audio input if enabled
        if hasattr(self, '_current_user_input') and self._current_user_input and self._current_user_input.strip():
            print(f"🔍 DEBUG: Audio ended, user input: {self._current_user_input[:50]}...", flush=True)
            logger.info(f"🎤 AUDIO END - User input: {self._current_user_input[:30]}...")
            
            # Save user message to DB
            asyncio.create_task(self._save_user_message_async(self._current_user_input))
            
            # Empathy evaluation disabled — may be re-enabled later
            # asyncio.create_task(self._check_and_evaluate_empathy(self._current_user_input))
            
            self._current_user_input = ""  # Reset for next input

    
    async def end_session(self):
        # promptEnd
        await self.send_event({
        "event": {
            "promptEnd": { "promptName": self.prompt_name }
        }
        })
        # sessionEnd
        await self.send_event({
        "event": { "sessionEnd": {} }
        })
        await self.stream.input_stream.close()


    async def _process_responses(self):
        """Process responses from the stream, buffering partial JSON."""
        decoder = json.JSONDecoder()
        buffer = ""  # accumulate incoming text here

        try:
            while self.is_active:
                output = await self.stream.await_output()
                result = await output[1].receive()

                if not (result.value and result.value.bytes_):
                    continue

                # 1) Decode the raw bytes
                chunk = result.value.bytes_.decode("utf-8")
                buffer += chunk

                # 2) Try to peel off as many complete JSON objects as possible
                idx = 0
                while True:
                    try:
                        obj, offset = decoder.raw_decode(buffer[idx:])
                    except json.JSONDecodeError:
                        break
                    idx += offset
                    # 3) Hand off each parsed object
                    await self._handle_event(obj)

                # 4) Keep only the unparsed tail
                buffer = buffer[idx:]

        except Exception as e:
            print(f"🔥 Error in _process_responses(): {e}", flush=True)

    async def _handle_event(self, json_data):
        """Dispatch one parsed JSON event to your existing logic."""
        evt = json_data.get("event", {})
        
        # DEBUG: Log all events to see what Nova Sonic is sending
        print(f"🔍 DEBUG EVENT: {json.dumps(evt, indent=2)}", flush=True)
        
        # contentStart
        if "contentStart" in evt:
            content_start = evt["contentStart"]
            self.role = content_start.get("role")
            print(f"🔍 DEBUG ROLE SET: {self.role}", flush=True)
            # optional SPECULATIVE check
            if "additionalModelFields" in content_start:
                fields = json.loads(content_start["additionalModelFields"])
                self.display_assistant_text = (fields.get("generationStage") == "SPECULATIVE")

        # textOutput
        elif "textOutput" in evt:
            text = evt["textOutput"]["content"]
            
            print(f"🔍 DEBUG TEXT OUTPUT - Role: {self.role}, Text: {text[:50]}...", flush=True)
            
            # Filter only the specific interrupted JSON message
            if text.strip() == '{"interrupted": true}':
                print(f"Filtered interrupted message", flush=True)
                return
            
            # Check for diagnosis completion
            diagnosis_achieved = "SESSION COMPLETED" in text
            if diagnosis_achieved and self.llm_completion:
                # Remove the marker from the text
                text = text.replace("SESSION COMPLETED", "").strip()
                # Add completion message
                text += " I really appreciate your feedback. You may continue practicing with other patients. Goodbye."
            
            if self.role == "ASSISTANT":
                print(f"🔍 DEBUG: Processing ASSISTANT message", flush=True)
                print(f"Assistant: {text}", flush=True)
                print(json.dumps({"type": "text", "text": text}), flush=True)
                
                # If diagnosis achieved, signal completion
                if diagnosis_achieved and self.llm_completion:
                    print(json.dumps({"type": "diagnosis_complete", "text": "Session completed successfully"}), flush=True)

            elif self.role == "USER":
                print(f"🔍 DEBUG: Processing USER message - Text: {text}", flush=True)
                print(f"User: {text}", flush=True)
                print(json.dumps({"type": "text", "text": text}), flush=True)
                
                # Accumulate user input for empathy evaluation
                if not hasattr(self, '_current_user_input'):
                    self._current_user_input = ""
                self._current_user_input += text
                
                # Empathy evaluation disabled — may be re-enabled later
                if text.strip():
                    pass
                    # print(f"🔍 DEBUG: Starting empathy check for USER text", flush=True)
                    # logger.info(f"🧠 USER MESSAGE - Checking empathy: {text[:30]}...")
                    # asyncio.create_task(self._check_and_evaluate_empathy(text))
                else:
                    pass
                    # print(f"🔍 DEBUG: Empty USER text, skipping empathy", flush=True)
                    # logger.info(f"🧠 Empty user text, skipping empathy evaluation")
                    # Inline diagnosis evaluation
                    if self.llm_completion:
                        try:
                            bedrock_client = boto3.client("bedrock-runtime", region_name=self.deployment_region)
                            # Get answer key documents from vectorstore
                            try:
                                # Get DB credentials from environment
                                db_secret_name = os.getenv("SM_DB_CREDENTIALS")
                                rds_endpoint = os.getenv("RDS_PROXY_ENDPOINT")
                                
                                if db_secret_name and rds_endpoint:
                                    secrets_client = boto3.client('secretsmanager')
                                    secret_response = secrets_client.get_secret_value(SecretId=db_secret_name)
                                    secret = json.loads(secret_response['SecretString'])
                                    
                                    # Create embeddings
                                    embeddings = BedrockEmbeddings(model_id="amazon.titan-embed-text-v1", client=bedrock_client)
                                    
                                    # Connect to vectorstore
                                    connection_string = f"postgresql://{secret['username']}:{secret['password']}@{rds_endpoint}:{secret['port']}/{secret['dbname']}"
                                    vectorstore = PGVector(embedding_function=embeddings, collection_name=self.patient_id or 'default', connection_string=connection_string)
                                    
                                    # Search for relevant documents
                                    docs = vectorstore.similarity_search(text, k=3)
                                    doc_content = "\n".join([doc.page_content for doc in docs])
                                    
                                    prompt = f"""You are to answer the following question, and you MUST answer only one word which is either 'True' or 'False' with that exact wording, no extra words, only one of those. INFORMATION FOR THE QUESTION TO ANSWER: Based on the medical documents provided, is the student's diagnosis correct? Student said: {text}. Medical documents: {doc_content}"""
                                else:
                                    prompt = f"""You are to answer the following question, and you MUST answer only one word which is either 'True' or 'False' with that exact wording, no extra words, only one of those. INFORMATION FOR THE QUESTION TO ANSWER: Is the student's diagnosis correct? Student said: {text}."""
                            except Exception as vec_error:
                                logger.error(f"Vectorstore query failed: {vec_error}")
                                prompt = f"""You are to answer the following question, and you MUST answer only one word which is either 'True' or 'False' with that exact wording, no extra words, only one of those. INFORMATION FOR THE QUESTION TO ANSWER: Is the student's diagnosis correct? Student said: {text}."""
                            body = {"messages": [{"role": "user", "content": [{"text": prompt}]}], "inferenceConfig": {"temperature": 0.1}}
                            response = bedrock_client.invoke_model(modelId="amazon.nova-lite-v1:0", contentType="application/json", accept="application/json", body=json.dumps(body))
                            result = json.loads(response["body"].read())
                            verdict_text = result["output"]["message"]["content"][0]["text"].strip()
                            print(f"🩺 Diagnosis verdict: {verdict_text}", flush=True)
                            if verdict_text.lower() == "true":
                                print(json.dumps({"type": "diagnosis_verdict", "verdict": True}), flush=True)
                                # Send completion message to Nova Sonic
                                completion_msg = "SESSION COMPLETED. I really appreciate your feedback. You may continue practicing with other patients. Goodbye."
                                print(json.dumps({"type": "text", "text": completion_msg}), flush=True)
                        except Exception as e:
                            logger.error(f"Diagnosis evaluation failed: {e}")
                            # Fallback to us-east-1 for Nova models if deployment region fails
                            if self.deployment_region != 'us-east-1':
                                try:
                                    logger.info(f"Retrying diagnosis evaluation with us-east-1 fallback")
                                    bedrock_client = boto3.client("bedrock-runtime", region_name="us-east-1")
                                    body = {"messages": [{"role": "user", "content": [{"text": prompt}]}], "inferenceConfig": {"temperature": 0.1}}
                                    response = bedrock_client.invoke_model(modelId="amazon.nova-lite-v1:0", contentType="application/json", accept="application/json", body=json.dumps(body))
                                    result = json.loads(response["body"].read())
                                    verdict_text = result["output"]["message"]["content"][0]["text"].strip()
                                    if verdict_text.lower() == "true":
                                        print(json.dumps({"type": "diagnosis_verdict", "verdict": True}), flush=True)
                                        completion_msg = "SESSION COMPLETED. I really appreciate your feedback. You may continue practicing with other patients. Goodbye."
                                        print(json.dumps({"type": "text", "text": completion_msg}), flush=True)
                                except Exception as fallback_error:
                                    logger.error(f"Fallback diagnosis evaluation also failed: {fallback_error}")
                    # Skip diagnosis evaluation for now
                    # if self.llm_completion:
                    #     asyncio.create_task(self._evaluate_diagnosis_async(text))

            print(f"🔍 DEBUG: Final role processing - Role: {self.role}, Text length: {len(text)}", flush=True)
            logger.info(f"💬 [add_message] {self.role.upper()} | {self.session_id} | {text[:30]}")

            # Mirror to PostgreSQL
            try:
                normalized_role = "ai" if self.role and self.role.upper() == "ASSISTANT" else "user"
                langchain_chat_history.add_message(self.session_id, normalized_role, text)
                # Save AI messages to messages table too
                if self.role and self.role.upper() == "ASSISTANT":
                    self._save_message_to_db(self.session_id, False, text, None)
                logger.info(f"💬 [PG INSERT] {normalized_role.upper()} | {self.session_id} | {text[:30]}")
            except Exception as e:
                print(f"❌ Failed to insert message into PostgreSQL: {e}", flush=True)

        # audioOutput
        elif "audioOutput" in evt:
            b64 = evt["audioOutput"]["content"]
            audio_bytes = base64.b64decode(b64)
            await self.audio_queue.put(audio_bytes)
            print(json.dumps({
                "type": "audio",
                "data": b64,
                "size": len(audio_bytes)
            }), flush=True)

        # else: ignore other event types
    
    def _get_bedrock_client(self):
        """Cached bedrock client"""
        if not self._bedrock_client:
            self._bedrock_client = boto3.client("bedrock-runtime", region_name="us-east-1")
        return self._bedrock_client
    
    # ── Empathy prompt methods disabled — may be re-enabled later ───────────
    # def _get_empathy_prompt(self):
    #     """Retrieve the latest empathy prompt from the empathy_prompt_history table."""
    #     ...
    #
    # def _get_default_empathy_prompt(self):
    #     """Default empathy evaluation prompt."""
    #     ...
    # ── End empathy prompt methods ──────────────────────────────────────────
    
    # ── Empathy evaluation disabled — may be re-enabled later ──────────────
    # async def _evaluate_empathy_async(self, user_text):
    #     """Async empathy evaluation to reduce blocking"""
    #     try:
    #         patient_context = f"Patient: {self.patient_name}, Condition: {self.patient_prompt}"
    #         bedrock_client = self._get_bedrock_client()
    #         
    #         # Get empathy prompt from database
    #         empathy_prompt_template = self._get_empathy_prompt()
    #         
    #         # Format the prompt with actual values
    #         evaluation_prompt = empathy_prompt_template.format(
    #             patient_context=patient_context,
    #             user_text=user_text
    #         )
    #         
    #         body = {"messages": [{"role": "user", "content": [{"text": evaluation_prompt}]}], "inferenceConfig": {"temperature": 0.1, "maxTokens": 600}}
    #         
    #         # Run in thread pool to avoid blocking
    #         loop = asyncio.get_event_loop()
    #         response = await loop.run_in_executor(None, lambda: bedrock_client.invoke_model(
    #             modelId="amazon.nova-lite-v1:0",  # Use faster model
    #             contentType="application/json", 
    #             accept="application/json", 
    #             body=json.dumps(body)
    #         ))
    #         
    #         result = json.loads(response["body"].read())
    #         response_text = result["output"]["message"]["content"][0]["text"]
    #         
    #         json_start = response_text.find('{')
    #         json_end = response_text.rfind('}') + 1
    #         
    #         if json_start != -1 and json_end > json_start:
    #             json_text = response_text[json_start:json_end]
    #             empathy_result = json.loads(json_text)
    #             # Async DB save
    #             await loop.run_in_executor(None, self._save_message_to_db, self.session_id, True, user_text, empathy_result)
    #             empathy_feedback = self._build_empathy_feedback(empathy_result)
    #             if empathy_feedback:
    #                 print(json.dumps({"type": "empathy", "content": empathy_feedback}), flush=True)
    #                 # Also send raw empathy data for frontend processing
    #                 print(json.dumps({"type": "empathy_data", "content": json.dumps(empathy_result)}), flush=True)
    #                     
    #     except Exception as e:
    #         print(f"Empathy evaluation failed: {e}", flush=True)
    #         try:
    #             loop = asyncio.get_event_loop()
    #             await loop.run_in_executor(None, self._save_message_to_db, self.session_id, True, user_text, None)
    #         except:
    #             pass
    
    # async def _is_empathy_enabled(self):
    #     """Check if empathy evaluation is enabled for this simulation group via API"""
    #     try:
    #         # Get simulation_group_id from session
    #         conn = get_pg_connection()
    #         cursor = conn.cursor()
    #         cursor.execute('SELECT simulation_group_id FROM sessions WHERE session_id = %s', (self.session_id,))
    #         result = cursor.fetchone()
    #         cursor.close()
    #         pg_conn_pool.putconn(conn)
    #         
    #         if not result:
    #             logger.warning(f"🧠 No session found for {self.session_id}, defaulting to disabled")
    #             return False
    #             
    #         simulation_group_id = result[0]
    #         
    #         # Call API endpoint
    #         api_endpoint = os.environ.get('API_ENDPOINT')
    #         if not api_endpoint:
    #             logger.warning("API_ENDPOINT not set, defaulting to disabled")
    #             return False
    #         url = f"{api_endpoint}student/empathy_enabled?simulation_group_id={simulation_group_id}"
    #         
    #         loop = asyncio.get_event_loop()
    #         response = await loop.run_in_executor(None, lambda: requests.get(url, timeout=5))
    #         if response.status_code == 200:
    #             data = response.json()
    #             empathy_enabled = data.get('empathy_enabled', False)
    #             logger.info(f"🧠 Empathy enabled status for group {simulation_group_id}: {empathy_enabled}")
    #             return empathy_enabled
    #         else:
    #             logger.warning(f"🧠 API call failed with status {response.status_code}, defaulting to disabled")
    #             return False
    #             
    #     except Exception as e:
    #         logger.error(f"Error checking empathy enabled status: {e}")
    #         return False
    
    # async def _check_and_evaluate_empathy(self, user_text):
    #     """Check if empathy is enabled and evaluate if so"""
    #     try:
    #         if await self._is_empathy_enabled():
    #             logger.info(f"🧠 Empathy enabled, evaluating empathy for voice input")
    #             await self._evaluate_empathy_async(user_text)
    #         else:
    #             logger.info(f"🧠 Empathy disabled, skipping evaluation for voice input")
    #     except Exception as e:
    #         logger.error(f"Error in empathy check and evaluation: {e}")
    # ── End empathy evaluation ──────────────────────────────────────────────
    
    async def _save_user_message_async(self, user_text):
        """Save user message to database asynchronously"""
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._save_message_to_db, self.session_id, True, user_text, None)
            # Also add to chat history
            await loop.run_in_executor(None, langchain_chat_history.add_message, self.session_id, "user", user_text)
            logger.info(f"💾 User audio message saved: {user_text[:30]}...")
        except Exception as e:
            logger.error(f"Failed to save user audio message: {e}")
    
    # ── Empathy evaluation methods disabled — may be re-enabled later ──────
    # async def _evaluate_empathy(self, student_response, patient_context):
    #     """LLM-as-a-Judge empathy evaluation using Nova Pro"""
    #     ...
    #
    # def _build_empathy_feedback(self, evaluation):
    #     """Build markdown feedback from evaluation like text_generation does"""
    #     ...
    # ── End empathy evaluation methods ──────────────────────────────────────
    
    def _save_message_to_db(self, session_id, student_sent, message_content, empathy_evaluation=None):
        """Optimized DB save with connection pooling"""
        try:
            conn = get_pg_connection()
            cursor = conn.cursor()
            
            empathy_json = json.dumps(empathy_evaluation) if empathy_evaluation else None
            
            cursor.execute(
                'INSERT INTO "messages" (chat_id, student_sent, message_content, time_sent) VALUES (%s, %s, %s, NOW())',
                (session_id, student_sent, message_content)
            )
            
            conn.commit()
            cursor.close()
            pg_conn_pool.putconn(conn)  # Return to pool
            
            logger.info(f"💾 Message saved to DB")
                
        except Exception as e:
            logger.error(f"Error saving message: {e}")
            try:
                pg_conn_pool.putconn(conn, close=True)  # Close bad connection
            except:
                pass



async def handle_stdin(nova_client):
    reader = asyncio.StreamReader()
    loop = asyncio.get_event_loop()
    protocol = asyncio.StreamReaderProtocol(reader)
    await loop.connect_read_pipe(lambda: protocol, sys.stdin)

    while True:
        line = await reader.readline()
        if not line:
            break

        try:
            msg = json.loads(line.decode("utf-8"))
            if msg["type"] == "audio":
                print("🎤 Received audio input from stdin", flush=True)
                audio_bytes = base64.b64decode(msg["data"])
                await nova_client.send_audio_chunk(audio_bytes)
            elif msg["type"] == "start_audio":
                print("🎬 Received start_audio signal", flush=True)
                await nova_client.start_audio_input()
                print("🎤 Started audio input", flush=True)
            elif msg["type"] == "end_audio":
                print("🎬 Received end_audio signal", flush=True)
                await nova_client.end_audio_input()
            elif msg["type"] == "interrupt":
                print("🛑 Received interrupt signal", flush=True)
                nova_client.is_active = False
                if nova_client.stream:
                    try:
                        await nova_client.stream.input_stream.close()
                    except:
                        pass
            elif msg["type"] == "set_voice":
                voice_id = msg.get("voice_id")
                print(f"🎭 Received voice change request: {voice_id}", flush=True)
                nova_client.voice_id = voice_id
                print(f"🎭 Voice set to: {nova_client.voice_id}", flush=True)
                # Force a restart of the session with the new voice
                if nova_client.is_active:
                    print("Restarting session with new voice", flush=True)
                    await nova_client.end_session()
                    await nova_client.start_session()

        except Exception as e:
            print(f"❌ Failed to process stdin input: {e}", flush=True)

async def main():
    voice = os.getenv("VOICE_ID")
    session_id = os.getenv("SESSION_ID", "default")
    deployment_region = os.getenv("AWS_REGION")
    nova_client = NovaSonic(voice_id=voice, session_id=session_id, region=deployment_region)
    
    # First listen for any initial configuration from stdin
    # This allows the frontend to set the voice before starting the session
    reader = asyncio.StreamReader()
    loop = asyncio.get_event_loop()
    protocol = asyncio.StreamReaderProtocol(reader)
    await loop.connect_read_pipe(lambda: protocol, sys.stdin)
    
    # Wait for initial configuration for a short time
    try:
        # Set a timeout for initial configuration
        line = await asyncio.wait_for(reader.readline(), 2.0)
        if line:
            try:
                msg = json.loads(line.decode("utf-8"))
                if msg["type"] == "set_voice":
                    print(f"🎭 Setting initial voice: {msg.get('voice_id')}", flush=True)
                    nova_client.voice_id = msg.get("voice_id")
            except Exception as e:
                print(f"❌ Failed to process initial config: {e}", flush=True)
    except asyncio.TimeoutError:
        print("No initial configuration received, using default voice", flush=True)
    
    # Start the session with the configured voice
    await nova_client.start_session()
    print("Nova session started. Listening for stdin input...")
    
    stdin_task = asyncio.create_task(handle_stdin(nova_client))
    await stdin_task

    await nova_client.end_session()
    print("Session ended")

    
if __name__ == "__main__":
    asyncio.run(main())