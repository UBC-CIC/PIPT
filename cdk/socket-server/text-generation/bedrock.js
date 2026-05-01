/**
 * Bedrock client wrapper for text generation.
 *
 * Provides three core functions:
 *   - converseStream() — calls Bedrock ConverseStreamCommand, returns async iterable of text chunks
 *   - invokeModelJson() — calls Bedrock ConverseCommand, parses JSON from response with retry
 *   - embedText() — computes embeddings via Bedrock InvokeModelCommand (Cohere Embed v4)
 *
 * Ported from cdk/text_generation/src/helpers/chat.py (_invoke_llm_json, _extract_json)
 * and cdk/data_ingestion/src/helpers/cohere_embeddings.py (CohereBedrockEmbeddings).
 */

const {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  ConverseCommand,
  InvokeModelCommand,
} = require('@aws-sdk/client-bedrock-runtime');

const logger = {
  info: (...args) => console.log(JSON.stringify({ level: 'INFO', message: args.join(' ') })),
  warn: (...args) => console.warn(JSON.stringify({ level: 'WARN', message: args.join(' ') })),
  error: (...args) => console.error(JSON.stringify({ level: 'ERROR', message: args.join(' ') })),
};

/** @type {Map<string, BedrockRuntimeClient>} */
const clientCache = new Map();

/**
 * Get or create a BedrockRuntimeClient for the given region.
 * @param {string} [region='us-east-1']
 * @returns {BedrockRuntimeClient}
 */
function getClient(region = 'us-east-1') {
  if (clientCache.has(region)) return clientCache.get(region);
  const client = new BedrockRuntimeClient({ region });
  clientCache.set(region, client);
  return client;
}

// ─── JSON Extraction ────────────────────────────────────────────────────────

/**
 * Strip markdown fences and extract the JSON object from raw LLM output.
 * Ported from chat.py _extract_json().
 * @param {string} raw
 * @returns {object}
 * @throws {SyntaxError} if JSON parsing fails
 */
function extractJson(raw) {
  let cleaned = raw.trim();
  // Remove markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
  cleaned = cleaned.replace(/\n?\s*```\s*$/, '');
  cleaned = cleaned.trim();

  // Find the first '{' if the response has preamble text
  if (!cleaned.startsWith('{')) {
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace !== -1) {
      cleaned = cleaned.substring(firstBrace);
    }
  }

  // Find the last '}' if the response has trailing text
  if (!cleaned.endsWith('}')) {
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace !== -1) {
      cleaned = cleaned.substring(0, lastBrace + 1);
    }
  }

  return JSON.parse(cleaned);
}

// ─── ConverseStream ─────────────────────────────────────────────────────────

/**
 * Call Bedrock ConverseStreamCommand and return an async iterable of text chunks.
 *
 * @param {string} modelId - Bedrock model ID (e.g. 'anthropic.claude-sonnet-4-20250514-v1:0')
 * @param {Array<{role: string, content: Array<{text: string}>}>} messages - Converse API messages
 * @param {string} systemPrompt - System prompt text
 * @param {string} [region='us-east-1']
 * @returns {AsyncGenerator<string>} Yields text chunks as they arrive
 */
async function* converseStream(modelId, messages, systemPrompt, region = 'us-east-1') {
  const client = getClient(region);

  const command = new ConverseStreamCommand({
    modelId,
    messages,
    system: [{ text: systemPrompt }],
  });

  const response = await client.send(command);

  for await (const event of response.stream) {
    if (event.contentBlockDelta?.delta?.text) {
      yield event.contentBlockDelta.delta.text;
    }
  }
}

// ─── InvokeModelJson ────────────────────────────────────────────────────────

/**
 * Call Bedrock ConverseCommand, parse JSON from response with retry on invalid JSON.
 * Ported from chat.py _invoke_llm_json().
 *
 * @param {string} modelId - Bedrock model ID
 * @param {string} systemPrompt - System prompt (debrief prompt from DB)
 * @param {string} userPrompt - User prompt text
 * @param {number} [maxRetries=2] - Number of retries on JSON parse failure
 * @param {string} [region='us-east-1']
 * @returns {Promise<object>} Parsed JSON object, or empty object on total failure
 */
async function invokeModelJson(modelId, systemPrompt, userPrompt, maxRetries = 2, region = 'us-east-1') {
  const client = getClient(region);
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const promptText =
        attempt === 1
          ? userPrompt
          : `${userPrompt}\n\nRETRY: Previous response was not valid JSON. Error: ${lastError}. Return ONLY valid JSON.`;

      const command = new ConverseCommand({
        modelId,
        messages: [
          {
            role: 'user',
            content: [{ text: promptText }],
          },
        ],
        system: [{ text: systemPrompt }],
      });

      const response = await client.send(command);

      // Extract text from the Converse API response
      const outputMessage = response.output?.message;
      let raw = '';
      if (outputMessage?.content) {
        for (const block of outputMessage.content) {
          if (block.text) {
            raw += block.text;
          }
        }
      }

      const parsed = extractJson(raw);
      logger.info(`invokeModelJson: Successfully parsed JSON on attempt ${attempt}`);
      return parsed;
    } catch (err) {
      if (err instanceof SyntaxError) {
        // JSON parse error — retry
        lastError = err.message;
        logger.warn(`invokeModelJson: JSON parse failed on attempt ${attempt}: ${err.message}`);
      } else {
        // SDK or network error — don't retry
        logger.error(`invokeModelJson: LLM call failed on attempt ${attempt}: ${err.message}`);
        break;
      }
    }
  }

  logger.error('invokeModelJson: All attempts failed, returning empty object');
  return {};
}

// ─── EmbedText ──────────────────────────────────────────────────────────────

/**
 * Compute embeddings via Bedrock InvokeModelCommand using Cohere Embed v4.
 *
 * Ported from cdk/data_ingestion/src/helpers/cohere_embeddings.py.
 *
 * @param {string} modelId - Cohere embedding model ID (e.g. 'cohere.embed-v4:0')
 * @param {string} text - Text to embed
 * @param {string} [region='us-east-1'] - AWS region for the embedding model
 * @param {string} [inputType='search_query'] - 'search_query' for matching, 'search_document' for indexing
 * @returns {Promise<number[]>} Embedding vector
 */
async function embedText(modelId, text, region = 'us-east-1', inputType = 'search_query') {
  const client = getClient(region);

  const body = JSON.stringify({
    texts: [text],
    input_type: inputType,
    embedding_types: ['float'],
  });

  const command = new InvokeModelCommand({
    modelId,
    body,
    accept: '*/*',
    contentType: 'application/json',
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  const embeddings = responseBody.embeddings?.float;
  if (!embeddings || embeddings.length === 0) {
    throw new Error(`Cohere Embed v4 returned no embeddings. Response keys: ${Object.keys(responseBody).join(', ')}`);
  }

  return embeddings[0];
}

/**
 * Compute embeddings for multiple texts in a single Bedrock InvokeModel call.
 * Cohere Embed v4 supports up to 96 texts per request.
 * This avoids hitting Bedrock rate limits that occur with sequential single-text calls.
 *
 * @param {string} modelId - Cohere embedding model ID (e.g. 'cohere.embed-v4:0')
 * @param {string[]} texts - Array of texts to embed
 * @param {string} [region='us-east-1'] - AWS region for the embedding model
 * @param {string} [inputType='search_document'] - 'search_query' for matching, 'search_document' for indexing
 * @returns {Promise<number[][]>} Array of embedding vectors (one per input text)
 */
async function embedTextBatch(modelId, texts, region = 'us-east-1', inputType = 'search_document') {
  if (!texts || texts.length === 0) return [];

  const client = getClient(region);

  const body = JSON.stringify({
    texts,
    input_type: inputType,
    embedding_types: ['float'],
  });

  const command = new InvokeModelCommand({
    modelId,
    body,
    accept: '*/*',
    contentType: 'application/json',
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  const embeddings = responseBody.embeddings?.float;
  if (!embeddings || embeddings.length !== texts.length) {
    throw new Error(
      `Cohere Embed v4 batch: expected ${texts.length} embeddings, got ${embeddings ? embeddings.length : 0}`
    );
  }

  return embeddings;
}

module.exports = {
  getClient,
  extractJson,
  converseStream,
  invokeModelJson,
  embedText,
  embedTextBatch,
};
