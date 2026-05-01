/**
 * Semantic question matching for student messages.
 *
 * Ported from cdk/text_generation/src/helpers/chat.py:
 *   - match_message_to_questions()
 *   - compute_cosine_similarity()
 *   - cache_key_questions()
 *   - get_cached_key_questions()
 *   - run_matching_async()
 *
 * Classification tiers:
 *   >= 0.70  → "high"
 *   0.60-0.69 → "moderate"
 *   0.45-0.59 → "low"
 *   < 0.45   → discarded
 *
 * Matching runs asynchronously (non-blocking) after each student message.
 * Writes matched_question_ids JSONB to the messages table.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { getPool } = require('./db');
const { embedText, embedTextBatch } = require('./bedrock');

const logger = {
  info: (...args) => console.log(JSON.stringify({ level: 'INFO', message: args.join(' ') })),
  warn: (...args) => console.warn(JSON.stringify({ level: 'WARN', message: args.join(' ') })),
  error: (...args) => console.error(JSON.stringify({ level: 'ERROR', message: args.join(' ') })),
};

let docClient = null;

/**
 * Get or create the DynamoDB Document Client.
 * @returns {DynamoDBDocumentClient}
 */
function getDocClient() {
  if (docClient) return docClient;
  const client = new DynamoDBClient({});
  docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return docClient;
}

// ─── Cosine Similarity ──────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two embedding vectors.
 * Ported from chat.py compute_cosine_similarity().
 *
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Similarity in [-1.0, 1.0]. Returns 0.0 for zero vectors.
 */
function computeCosineSimilarity(vecA, vecB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0.0;
  return dot / (normA * normB);
}

// ─── DynamoDB Question Cache ────────────────────────────────────────────────

/**
 * Fetch key questions from PostgreSQL, compute embeddings, store in DynamoDB.
 * Called once per session on the first message.
 *
 * Ported from chat.py cache_key_questions().
 *
 * @param {string} sessionId
 * @param {string} simulationGroupId
 * @param {string} personaId
 * @param {string} embeddingModelId - Bedrock embedding model ID
 * @param {string} embeddingRegion - AWS region for embedding model
 * @param {string} tableName - DynamoDB table name
 * @param {Function} fetchKeyQuestionsFn - Function to fetch key questions from PostgreSQL
 * @returns {Promise<Array<object>>} Cached questions with embeddings
 */
async function cacheKeyQuestions(
  sessionId,
  simulationGroupId,
  personaId,
  embeddingModelId,
  embeddingRegion,
  tableName,
  fetchKeyQuestionsFn
) {
  // 1. Fetch key questions from PostgreSQL
  const questions = await fetchKeyQuestionsFn(simulationGroupId, personaId);

  // 2. Handle empty question lists
  if (!questions || questions.length === 0) {
    logger.info(`No key questions for group=${simulationGroupId}, persona=${personaId}. Caching empty list.`);
    try {
      const ddb = getDocClient();
      await ddb.send(new PutCommand({
        TableName: tableName,
        Item: {
          SessionId: `QCACHE#${sessionId}`,
          questions: [],
          cached_at: new Date().toISOString(),
        },
      }));
    } catch (err) {
      logger.error(`Failed to cache empty question list in DynamoDB: ${err.message}`);
    }
    return [];
  }

  // 3. Compute embeddings in a single batch call (Cohere Embed v4 supports up to 96 texts)
  //    This avoids hitting Bedrock rate limits that occur with 14+ sequential calls.
  const cachedQuestions = [];
  try {
    const questionTexts = questions.map((q) => q.question_text);
    const embeddings = await embedTextBatch(embeddingModelId, questionTexts, embeddingRegion, 'search_document');
    for (let i = 0; i < questions.length; i++) {
      cachedQuestions.push({
        question_id: questions[i].question_id,
        question_text: questions[i].question_text,
        evaluation_criteria: questions[i].evaluation_criteria,
        is_mandatory: questions[i].is_mandatory,
        weight: questions[i].weight,
        embedding: embeddings[i],
      });
    }
  } catch (batchErr) {
    logger.error(`Batch embedding failed, falling back to one-at-a-time: ${batchErr.message}`);
    // Fall back to one-at-a-time if batch fails
    for (const q of questions) {
      try {
        const embedding = await embedText(embeddingModelId, q.question_text, embeddingRegion);
        cachedQuestions.push({
          question_id: q.question_id,
          question_text: q.question_text,
          evaluation_criteria: q.evaluation_criteria,
          is_mandatory: q.is_mandatory,
          weight: q.weight,
          embedding,
        });
      } catch (err) {
        logger.error(`Failed to compute embedding for question ${q.question_id}: ${err.message}`);
      }
    }
  }

  // 4. Store in DynamoDB
  try {
    const ddb = getDocClient();
    await ddb.send(new PutCommand({
      TableName: tableName,
      Item: {
        SessionId: `QCACHE#${sessionId}`,
        questions: cachedQuestions,
        cached_at: new Date().toISOString(),
      },
    }));
    logger.info(`Cached ${cachedQuestions.length} key questions for session=${sessionId}`);
  } catch (err) {
    logger.error(`Failed to cache key questions in DynamoDB: ${err.message}`);
  }

  return cachedQuestions;
}

/**
 * Read cached key questions + embeddings from DynamoDB.
 * Ported from chat.py get_cached_key_questions().
 *
 * @param {string} sessionId
 * @param {string} tableName - DynamoDB table name
 * @returns {Promise<Array<object>|null>} Questions with embeddings, or null on cache miss
 */
async function getCachedKeyQuestions(sessionId, tableName) {
  try {
    const ddb = getDocClient();
    const response = await ddb.send(new GetCommand({
      TableName: tableName,
      Key: { SessionId: `QCACHE#${sessionId}` },
    }));

    const item = response.Item;
    if (!item) {
      logger.info(`Cache miss for session=${sessionId}`);
      return null;
    }

    const questions = item.questions || [];

    // Convert any DynamoDB number types back to native JS numbers
    const result = questions.map((q) => ({
      question_id: q.question_id,
      question_text: q.question_text,
      evaluation_criteria: q.evaluation_criteria || null,
      is_mandatory: q.is_mandatory || false,
      weight: q.weight != null ? Number(q.weight) : null,
      embedding: Array.isArray(q.embedding) ? q.embedding.map(Number) : [],
    }));

    logger.info(`Retrieved ${result.length} cached key questions for session=${sessionId}`);
    return result;
  } catch (err) {
    logger.warn(`Failed to read cached key questions from DynamoDB: ${err.message}`);
    return null;
  }
}

// ─── Message Matching ───────────────────────────────────────────────────────

/**
 * Compute embedding for a student message, compare against cached question
 * embeddings, and persist matches that exceed the 0.45 threshold.
 *
 * Ported from chat.py match_message_to_questions().
 *
 * @param {string} messageContent - The student's message text
 * @param {string} sessionId
 * @param {string} messageId - The message_id from the messages table
 * @param {string} embeddingModelId - Bedrock embedding model ID
 * @param {string} embeddingRegion - AWS region for embedding model
 * @param {string} tableName - DynamoDB table name for question cache
 * @returns {Promise<Array<{question_id: string, similarity_score: number, confidence: string}>>}
 */
async function matchMessageToQuestions(
  messageContent,
  sessionId,
  messageId,
  embeddingModelId,
  embeddingRegion,
  tableName
) {
  const matches = [];

  // 1. Embed the student message
  let messageEmbedding;
  try {
    messageEmbedding = await embedText(embeddingModelId, messageContent, embeddingRegion);
  } catch (err) {
    logger.error(`Failed to embed student message for matching: ${err.message}`);
    return matches;
  }

  // 2. Retrieve cached questions
  const cachedQuestions = await getCachedKeyQuestions(sessionId, tableName);
  if (!cachedQuestions || cachedQuestions.length === 0) {
    logger.info(`No cached questions for session=${sessionId}, skipping matching`);
    return matches;
  }

  // 3. Compute similarity and classify
  for (const q of cachedQuestions) {
    const embedding = q.embedding;
    if (!embedding || embedding.length === 0) continue;

    const score = computeCosineSimilarity(messageEmbedding, embedding);
    logger.info(
      `Similarity: message='${messageContent.substring(0, 60)}' vs question='${(q.question_text || '').substring(0, 60)}' → score=${score.toFixed(4)}`
    );

    let confidence;
    if (score >= 0.70) {
      confidence = 'high';
    } else if (score >= 0.60) {
      confidence = 'moderate';
    } else if (score >= 0.45) {
      confidence = 'low';
    } else {
      continue; // discard below threshold
    }

    matches.push({
      question_id: q.question_id,
      similarity_score: Math.round(score * 10000) / 10000,
      confidence,
    });
  }

  // 4. Write matched_question_ids to the messages table
  if (matches.length > 0) {
    try {
      const db = await getPool();
      await db.query(
        'UPDATE "messages" SET matched_question_ids = $1 WHERE message_id = $2',
        [JSON.stringify(matches), messageId]
      );
      logger.info(`Wrote ${matches.length} matches for message_id=${messageId}`);
    } catch (err) {
      logger.error(`Failed to write matched_question_ids for message_id=${messageId}: ${err.message}`);
    }
  }

  return matches;
}

// ─── Async Matching ─────────────────────────────────────────────────────────

/** @type {Map<string, Promise[]>} Track in-flight matching promises per session */
const matchingPromises = new Map();

/**
 * Run matchMessageToQuestions asynchronously (non-blocking).
 * All exceptions are caught and logged so matching failures never
 * propagate to or delay the LLM response.
 *
 * Ported from chat.py run_matching_async().
 *
 * @param {string} messageContent
 * @param {string} sessionId
 * @param {string} messageId
 * @param {string} embeddingModelId
 * @param {string} embeddingRegion
 * @param {string} tableName
 */
function runMatchingAsync(messageContent, sessionId, messageId, embeddingModelId, embeddingRegion, tableName) {
  const promise = matchMessageToQuestions(
    messageContent,
    sessionId,
    messageId,
    embeddingModelId,
    embeddingRegion,
    tableName
  ).catch((err) => {
    logger.error(`Background matching failed for message_id=${messageId}: ${err.message}`);
  });

  // Track the promise for this session
  if (!matchingPromises.has(sessionId)) {
    matchingPromises.set(sessionId, []);
  }
  matchingPromises.get(sessionId).push(promise);

  logger.info(`Started background matching for message_id=${messageId}`);
}

/**
 * Wait for all outstanding matching promises for a session to finish.
 * Called at the start of debrief generation so that every student
 * message has its matched_question_ids written before we query for tagged messages.
 *
 * Ported from chat.py flush_matching_threads().
 *
 * @param {string} sessionId
 * @param {number} [timeoutMs=30000] - Maximum milliseconds to wait
 */
async function flushMatchingPromises(sessionId, timeoutMs = 30000) {
  const promises = matchingPromises.get(sessionId);
  if (!promises || promises.length === 0) {
    logger.info(`flushMatchingPromises: no pending promises for session=${sessionId}`);
    return;
  }

  logger.info(`flushMatchingPromises: waiting for ${promises.length} promise(s) for session=${sessionId}`);

  // Race all promises against a timeout
  const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([
    Promise.allSettled(promises),
    timeout,
  ]);

  // Clean up
  matchingPromises.delete(sessionId);
}

module.exports = {
  computeCosineSimilarity,
  cacheKeyQuestions,
  getCachedKeyQuestions,
  matchMessageToQuestions,
  runMatchingAsync,
  flushMatchingPromises,
};
