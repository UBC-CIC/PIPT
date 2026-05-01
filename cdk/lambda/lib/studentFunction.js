const { initializeConnection } = require("./lib.js");
const logger = require("./logger");
let { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT } = process.env;

// SQL conneciton from global variable at lib.js
let sqlConnection = global.sqlConnection;

exports.handler = async (event, context) => {
  logger.init(event, context);
  logger.info("Student handler invoked", { queryStringParameters: event.queryStringParameters });

  const cognito_id = event.requestContext.authorizer.userId;
  const userEmailAttribute = event.requestContext.authorizer.email || null;
  // Check for query string parameters

  const queryStringParams = event.queryStringParameters || {};
  const queryEmail = queryStringParams.email;
  const studentEmail = queryStringParams.student_email;
  const userEmail = queryStringParams.user_email;

  const isUnauthorized =
    (queryEmail && queryEmail !== userEmailAttribute) ||
    (studentEmail && studentEmail !== userEmailAttribute) ||
    (userEmail && userEmail !== userEmailAttribute);

  if (isUnauthorized) {
    logger.warn("Unauthorized access attempt", { queryEmail, studentEmail, userEmail, userEmailAttribute });
    return {
      statusCode: 401,
      headers: {
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
      },
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
    },
    body: "",
  };

  // Initialize the database connection if not already initialized
  if (!sqlConnection) {
    logger.info("Initializing database connection");
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
    sqlConnection = global.sqlConnection;
    logger.info("Database connection initialized");
  }

  // Function to format student full names (lowercase and spaces replaced with "_")
  const formatNames = (name) => {
    return name.toLowerCase().replace(/\s+/g, "_");
  };

  let data;
  try {
    const pathData = event.httpMethod + " " + event.resource;
    switch (pathData) {
      case "POST /student/create_user":
        if (event.queryStringParameters) {
          const {
            user_email,
            username,
            first_name,
            last_name,
            preferred_name,
          } = event.queryStringParameters;

          try {
            // Check if the user already exists
            const existingUser = await sqlConnection`
                SELECT * FROM "users"
                WHERE user_email = ${user_email};
            `;

            if (existingUser.length > 0) {
              // Update the existing user's information
              const updatedUser = await sqlConnection`
                    UPDATE "users"
                    SET
                        username = ${username},
                        first_name = ${first_name},
                        last_name = ${last_name},
                        last_sign_in = CURRENT_TIMESTAMP,
                        time_account_created = CURRENT_TIMESTAMP
                    WHERE user_email = ${user_email}
                    RETURNING *;
                `;
              response.body = JSON.stringify(updatedUser[0]);
            } else {
              // Insert a new user with 'student' role
              const newUser = await sqlConnection`
                    INSERT INTO "users" (user_email, username, first_name, last_name, time_account_created, roles, last_sign_in)
                    VALUES (${user_email}, ${username}, ${first_name}, ${last_name}, CURRENT_TIMESTAMP, ARRAY['student'], CURRENT_TIMESTAMP)
                    RETURNING *;
                `;
              response.body = JSON.stringify(newUser[0]);
            }
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "User data is required" });
        }
        break;
      case "GET /student/get_user_roles":
        if (
          event.queryStringParameters &&
          event.queryStringParameters.user_email
        ) {
          const user_email = event.queryStringParameters.user_email;
          try {
            // Retrieve roles for the user with the provided email
            const userData = await sqlConnection`
                SELECT roles
                FROM "users"
                WHERE user_email = ${user_email};
              `;
            if (userData.length > 0) {
              response.body = JSON.stringify({ roles: userData[0].roles });
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "User not found" });
            }
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "User email is required" });
        }
        break;
      case "GET /student/get_name":
        if (
          event.queryStringParameters &&
          event.queryStringParameters.user_email
        ) {
          const user_email = event.queryStringParameters.user_email;
          try {
            // Retrieve roles for the user with the provided email
            const userData = await sqlConnection`
                  SELECT first_name
                  FROM "users"
                  WHERE user_email = ${user_email};
                `;
            if (userData.length > 0) {
              response.body = JSON.stringify({ name: userData[0].first_name });
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "User not found" });
            }
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "User email is required" });
        }
        break;
      case "GET /student/simulation_group":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.email
        ) {
          const user_email = event.queryStringParameters.email;

          try {
            // Retrieve the user ID using the user_email
            const userResult = await sqlConnection`
                SELECT user_id FROM "users" WHERE user_email = ${user_email};
              `;

            if (userResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "User not found" });
              break;
            }

            const user_id = userResult[0].user_id;

            // Query to get simulation groups for the user
            const data = await sqlConnection`
                SELECT "simulation_groups".*
                FROM "enrollments"
                JOIN "simulation_groups" ON "simulation_groups".simulation_group_id = "enrollments".simulation_group_id
                WHERE "enrollments".user_id = ${user_id}
                AND "simulation_groups".group_student_access = TRUE
                ORDER BY "simulation_groups".group_name, "simulation_groups".simulation_group_id;
              `;
            response.body = JSON.stringify(data);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = "Invalid value";
        }
        break;
      case "GET /student/simulation_group_page":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.email &&
          event.queryStringParameters.simulation_group_id
        ) {
          const studentEmail = event.queryStringParameters.email;
          const simulationGroupId =
            event.queryStringParameters.simulation_group_id;

          try {
            // Retrieve the user ID using the user_email
            const userResult = await sqlConnection`
                SELECT user_id FROM "users" WHERE user_email = ${studentEmail};
              `;

            if (userResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "User not found" });
              break;
            }

            const userId = userResult[0].user_id;

            // Fetch patient data associated with the simulation group
            const data = await sqlConnection`
                WITH StudentEnrollment AS (
                  SELECT 
                    enrollment_id
                  FROM 
                    "enrollments"
                  WHERE 
                    user_id = ${userId}
                    AND simulation_group_id = ${simulationGroupId}
                  LIMIT 1
                )
                SELECT
                  p.persona_id,
                  p.persona_name,
                  p.persona_age,
                  p.persona_gender,
                  p.persona_number,
                  p.llm_completion,
                  p.voice_enabled,
                  sp.student_interaction_id,
                  sp.persona_score,
                  sp.last_accessed,
                  sp.persona_context_embedding,
                  sp.is_completed
                FROM
                  "personas" p
                LEFT JOIN
                  "student_interactions" sp ON sp.persona_id = p.persona_id
                JOIN
                  StudentEnrollment se ON sp.enrollment_id = se.enrollment_id
                WHERE
                  p.simulation_group_id = ${simulationGroupId}
                ORDER BY
                  p.persona_number;
              `;

            const enrollmentId = data[0]?.enrollment_id;

            if (enrollmentId) {
              await sqlConnection`
                  INSERT INTO "user_engagement_log" (
                    log_id, user_id, simulation_group_id, persona_id, enrollment_id, timestamp, engagement_type
                  ) VALUES (
                    uuid_generate_v4(), ${userId}, ${simulationGroupId}, null, ${enrollmentId}, CURRENT_TIMESTAMP, 'group access'
                  );
                `;
            }

            response.body = JSON.stringify(data);
          } catch (err) {
            response.statusCode = 500;
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = "Invalid value";
        }
        break;
      case "GET /student/patient":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.email &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.patient_id
        ) {
          const patientId = event.queryStringParameters.patient_id;
          const studentEmail = event.queryStringParameters.email;
          const simulationGroupId =
            event.queryStringParameters.simulation_group_id;

          try {
            // Step 1: Get the user ID using the student_email
            const userResult = await sqlConnection`
                    SELECT user_id
                    FROM "users"
                    WHERE user_email = ${studentEmail}
                    LIMIT 1;
                `;

            if (userResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Student not found.",
              });
              break;
            }

            const userId = userResult[0].user_id;

            // Step 2: Get the student_interaction_id for the specific student and patient
            const studentPatientData = await sqlConnection`
                    SELECT student_interaction_id
                    FROM "student_interactions"
                    WHERE persona_id = ${patientId}
                    AND enrollment_id = (
                        SELECT enrollment_id
                        FROM "enrollments"
                        WHERE user_id = ${userId} AND simulation_group_id = ${simulationGroupId}
                    )
                `;

            const studentPatientId =
              studentPatientData[0]?.student_interaction_id;

            if (!studentPatientId) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Student patient not found",
              });
              break;
            }

            // Step 3: Update the last accessed timestamp for the student_interactions entry
            await sqlConnection`
                    UPDATE "student_interactions"
                    SET last_accessed = CURRENT_TIMESTAMP
                    WHERE student_interaction_id = ${studentPatientId};
                `;

            // Step 4: Retrieve session data specific to the student's patient
            // LEFT JOIN debriefs to include overall_score for concluded chats
            const data = await sqlConnection`
                    SELECT "chats".*, d.overall_score
                    FROM "chats"
                    LEFT JOIN "debriefs" d ON d.chat_id = "chats".chat_id
                    WHERE student_interaction_id = ${studentPatientId}
                    ORDER BY "chats".last_accessed, "chats".chat_id;
                `;

            // Step 5: Get enrollment ID for the log entry
            const enrollmentData = await sqlConnection`
                    SELECT enrollment_id
                    FROM "enrollments"
                    WHERE user_id = ${userId} AND simulation_group_id = ${simulationGroupId};
                `;

            const enrollmentId = enrollmentData[0]?.enrollment_id;

            // Step 6: Insert into User_Engagement_Log using user_id
            await sqlConnection`
                    INSERT INTO "user_engagement_log" (
                        log_id, user_id, simulation_group_id, persona_id, enrollment_id, timestamp, engagement_type
                    )
                    VALUES (
                        uuid_generate_v4(),
                        ${userId},
                        ${simulationGroupId},
                        ${patientId},
                        ${enrollmentId},
                        CURRENT_TIMESTAMP,
                        'patient access'
                    );
                `;

            response.body = JSON.stringify(data);
          } catch (err) {
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.statusCode = 500;
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Invalid value" });
        }
        break;
      case "POST /student/create_session":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.patient_id &&
          event.queryStringParameters.email &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.session_name
        ) {
          const patientId = event.queryStringParameters.patient_id;
          const studentEmail = event.queryStringParameters.email;
          const simulationGroupId =
            event.queryStringParameters.simulation_group_id;
          const sessionName = event.queryStringParameters.session_name;

          try {
            // Step 1: Get the user ID using the student_email
            const userResult = await sqlConnection`
                    SELECT user_id
                    FROM "users"
                    WHERE user_email = ${studentEmail}
                    LIMIT 1;
                `;

            if (userResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Student not found." });
              break;
            }

            const userId = userResult[0].user_id;

            // Step 2: Get the student_interaction_id for the specific student and patient
            const studentPatientData = await sqlConnection`
                    SELECT student_interaction_id
                    FROM "student_interactions"
                    WHERE persona_id = ${patientId}
                      AND enrollment_id = (
                        SELECT enrollment_id
                        FROM "enrollments"
                        WHERE user_id = ${userId} AND simulation_group_id = ${simulationGroupId}
                    );
                `;

            const studentPatientId =
              studentPatientData[0]?.student_interaction_id;

            if (!studentPatientId) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Student patient not found.",
              });
              break;
            }

            // Step 3: Update the last_accessed timestamp for the student_interaction entry
            await sqlConnection`
                    UPDATE "student_interactions"
                    SET last_accessed = CURRENT_TIMESTAMP
                    WHERE student_interaction_id = ${studentPatientId};
                `;

            // Step 4: Insert a new session with the session_name
            const sessionData = await sqlConnection`
                    INSERT INTO "chats" (chat_id, student_interaction_id, chat_name, chat_context_embeddings, started_at, last_accessed, status, notes)
                    VALUES (
                        uuid_generate_v4(),
                        ${studentPatientId},
                        ${sessionName},
                        ARRAY[]::float[],
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP,
                        'active',
                        NULL
                    )
                    RETURNING *;
                `;

            // Step 5: Log the session creation in the User Engagement Log
            const enrollmentData = await sqlConnection`
                    SELECT enrollment_id
                    FROM "enrollments"
                    WHERE user_id = ${userId} AND simulation_group_id = ${simulationGroupId};
                `;

            const enrollmentId = enrollmentData[0]?.enrollment_id;

            if (enrollmentId) {
              await sqlConnection`
                        INSERT INTO "user_engagement_log" (
                            log_id, user_id, simulation_group_id, persona_id, enrollment_id, timestamp, engagement_type
                        ) VALUES (
                            uuid_generate_v4(),
                            ${userId},
                            ${simulationGroupId},
                            ${patientId},
                            ${enrollmentId},
                            CURRENT_TIMESTAMP,
                            'session creation'
                        );
                    `;
            }

            response.body = JSON.stringify(sessionData);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Invalid value" });
        }
        break;
      case "DELETE /student/delete_session":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.session_id &&
          event.queryStringParameters.email &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.patient_id
        ) {
          const sessionId = event.queryStringParameters.session_id;
          const studentEmail = event.queryStringParameters.email;
          const simulationGroupId =
            event.queryStringParameters.simulation_group_id;
          const patientId = event.queryStringParameters.patient_id;

          try {
            // Step 1: Get the user ID using the student_email
            const userResult = await sqlConnection`
                    SELECT user_id
                    FROM "users"
                    WHERE user_email = ${studentEmail}
                    LIMIT 1;
                `;

            if (userResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Student not found." });
              break;
            }

            const userId = userResult[0].user_id;

            // Step 2: Update last_accessed for the corresponding student_interaction entry
            await sqlConnection`
                    UPDATE "student_interactions"
                    SET last_accessed = CURRENT_TIMESTAMP
                    WHERE student_interaction_id = (
                        SELECT student_interaction_id
                        FROM "chats"
                        WHERE chat_id = ${sessionId}
                    );
                `;

            // Step 3: Delete the session and get the result
            const deleteResult = await sqlConnection`
                    DELETE FROM "chats"
                    WHERE chat_id = ${sessionId}
                    RETURNING *;
                `;

            if (!deleteResult.length) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Session not found." });
              break;
            }

            // Step 4: Get the enrollment ID using user_id and simulation_group_id
            const enrollmentData = await sqlConnection`
                    SELECT enrollment_id
                    FROM "enrollments"
                    WHERE user_id = ${userId} AND simulation_group_id = ${simulationGroupId};
                `;

            if (!enrollmentData.length) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Enrollment not found." });
              break;
            }

            const enrollmentId = enrollmentData[0].enrollment_id;

            // Step 5: Insert an entry into the User_Engagement_Log
            await sqlConnection`
                    INSERT INTO "user_engagement_log" (
                        log_id, user_id, simulation_group_id, persona_id, enrollment_id, timestamp, engagement_type
                    ) VALUES (
                        uuid_generate_v4(),
                        ${userId},
                        ${simulationGroupId},
                        ${patientId},
                        ${enrollmentId},
                        CURRENT_TIMESTAMP,
                        'session deletion'
                    );
                `;

            response.body = JSON.stringify({ success: "Session deleted" });
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error:
              "session_id, email, simulation_group_id, and patient_id are required",
          });
        }
        break;
      case "GET /student/get_messages":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.session_id
        ) {
          try {
            const sessionId = event.queryStringParameters.session_id;

            // Query to get all messages in the given session, sorted by time_sent in ascending order (oldest to newest)
            const data = await sqlConnection`
                      SELECT *
                      FROM "messages"
                      WHERE chat_id = ${sessionId}
                      ORDER BY sent_at ASC;
                  `;

            response.body = JSON.stringify(data);
            response.statusCode = 200;
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "session_id is required" });
        }
        break;
      case "POST /student/create_message":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.session_id &&
          event.queryStringParameters.email &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.patient_id &&
          event.body
        ) {
          const sessionId = event.queryStringParameters.session_id;
          const { message_content } = JSON.parse(event.body);
          const studentEmail = event.queryStringParameters.email;
          const simulationGroupId =
            event.queryStringParameters.simulation_group_id;
          const patientId = event.queryStringParameters.patient_id;

          try {
            // Check message limit for this simulation group
            const groupSettings = await sqlConnection`
              SELECT max_messages_per_chat FROM "simulation_groups"
              WHERE simulation_group_id = ${simulationGroupId};
            `;
            const maxMessages = groupSettings[0]?.max_messages_per_chat;

            if (maxMessages != null) {
              const messageCount = await sqlConnection`
                SELECT COUNT(*)::int AS count FROM "messages"
                WHERE chat_id = ${sessionId} AND sender_type = 'student';
              `;
              if (messageCount[0].count >= maxMessages) {
                response.statusCode = 403;
                response.body = JSON.stringify({
                  error: "Message limit reached",
                  message: `You have reached the maximum of ${maxMessages} messages for this conversation.`,
                  max_messages: maxMessages,
                });
                break;
              }
            }

            // Insert the new message into the Messages table with a generated UUID for message_id
            const messageData = await sqlConnection`
                      INSERT INTO "messages" (message_id, chat_id, user_id, sender_type, message_content, sent_at)
                      VALUES (uuid_generate_v4(), ${sessionId}, (SELECT user_id FROM "users" WHERE user_email = ${studentEmail}), 'student', ${message_content}, CURRENT_TIMESTAMP)
                      RETURNING *;
                  `;

            // Update the last_accessed field in the Sessions table
            await sqlConnection`
                      UPDATE "chats"
                      SET last_accessed = CURRENT_TIMESTAMP
                      WHERE chat_id = ${sessionId};
                  `;

            // Retrieve user_id based on studentEmail
            const userData = await sqlConnection`
                      SELECT user_id
                      FROM "users"
                      WHERE user_email = ${studentEmail};
                  `;

            const userId = userData[0]?.user_id;

            if (userId) {
              // Retrieve the enrollment ID using user_id
              const enrollmentData = await sqlConnection`
                          SELECT enrollment_id
                          FROM "enrollments"
                          WHERE user_id = ${userId} AND simulation_group_id = ${simulationGroupId};
                      `;

              const enrollmentId = enrollmentData[0]?.enrollment_id;

              if (enrollmentId) {
                await sqlConnection`
                              INSERT INTO "user_engagement_log" (
                                  log_id, user_id, simulation_group_id, persona_id, enrollment_id, timestamp, engagement_type
                              )
                              VALUES (
                                  uuid_generate_v4(), 
                                  ${userId}, 
                                  ${simulationGroupId}, 
                                  ${patientId}, 
                                  ${enrollmentId}, 
                                  CURRENT_TIMESTAMP, 
                                  'message creation'
                              );
                          `;
              }
            }

            response.body = JSON.stringify(messageData);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "session_id and message_content are required",
          });
        }
        break;
      case "POST /student/create_ai_message":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.session_id &&
          event.queryStringParameters.email &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.patient_id &&
          event.body
        ) {
          const sessionId = event.queryStringParameters.session_id;
          const { message_content } = JSON.parse(event.body);
          const studentEmail = event.queryStringParameters.email;
          const simulationGroupId =
            event.queryStringParameters.simulation_group_id;
          const patientId = event.queryStringParameters.patient_id;

          try {
            // Insert the new AI message into the Messages table with a generated UUID for message_id
            const messageData = await sqlConnection`
                      INSERT INTO "messages" (message_id, chat_id, user_id, sender_type, message_content, sent_at)
                      VALUES (uuid_generate_v4(), ${sessionId}, ${patientId}, 'ai', ${message_content}, CURRENT_TIMESTAMP)
                      RETURNING *;
                  `;

            // Update the last_accessed field in the Sessions table
            await sqlConnection`
                      UPDATE "chats"
                      SET last_accessed = CURRENT_TIMESTAMP
                      WHERE chat_id = ${sessionId};
                  `;

            // Retrieve user_id based on studentEmail
            const userData = await sqlConnection`
                      SELECT user_id
                      FROM "users"
                      WHERE user_email = ${studentEmail};
                  `;

            const userId = userData[0]?.user_id;

            if (userId) {
              // Retrieve the enrollment ID using user_id
              const enrollmentData = await sqlConnection`
                          SELECT enrollment_id
                          FROM "enrollments"
                          WHERE user_id = ${userId} AND simulation_group_id = ${simulationGroupId};
                      `;

              const enrollmentId = enrollmentData[0]?.enrollment_id;

              if (enrollmentId) {
                await sqlConnection`
                              INSERT INTO "user_engagement_log" (
                                  log_id, user_id, simulation_group_id, persona_id, enrollment_id, timestamp, engagement_type
                              )
                              VALUES (
                                  uuid_generate_v4(), 
                                  ${userId}, 
                                  ${simulationGroupId}, 
                                  ${patientId}, 
                                  ${enrollmentId}, 
                                  CURRENT_TIMESTAMP, 
                                  'AI message creation'
                              );
                          `;
              }
            }

            response.body = JSON.stringify(messageData);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "session_id and message_content are required",
          });
        }
        break;
      case "POST /student/enroll_student":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.student_email &&
          event.queryStringParameters.group_access_code
        ) {
          const { student_email, group_access_code } =
            event.queryStringParameters;

          try {
            // Step 1: Retrieve the user ID using the student_email
            const userResult = await sqlConnection`
                  SELECT user_id
                  FROM "users"
                  WHERE user_email = ${student_email}
                  LIMIT 1;
              `;

            if (userResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Student not found.",
              });
              break;
            }

            const user_id = userResult[0].user_id;

            // Step 2: Retrieve the simulation_group_id using the access code
            const groupResult = await sqlConnection`
                  SELECT simulation_group_id
                  FROM "simulation_groups"
                  WHERE group_access_code = ${group_access_code}
                  AND group_student_access = TRUE
                  LIMIT 1;
              `;

            if (groupResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Invalid group access code or group not available.",
              });
              break;
            }

            const simulation_group_id = groupResult[0].simulation_group_id;

            // Step 3: Insert enrollment into enrollments table
            const enrollmentResult = await sqlConnection`
                  INSERT INTO "enrollments" (enrollment_id, user_id, simulation_group_id, enrollment_type, time_enrolled)
                  VALUES (uuid_generate_v4(), ${user_id}, ${simulation_group_id}, 'student', CURRENT_TIMESTAMP)
                  ON CONFLICT (simulation_group_id, user_id) DO NOTHING
                  RETURNING enrollment_id;
              `;

            const enrollment_id = enrollmentResult[0]?.enrollment_id;

            if (enrollment_id) {
              // Step 4: Retrieve all patient IDs for the simulation group
              const patientsResult = await sqlConnection`
                    SELECT persona_id
                    FROM "personas"
                    WHERE simulation_group_id = ${simulation_group_id};
                `;

              // Step 5: Insert a record into student_interactions for each patient
              const studentPatientInsertions = patientsResult.map((patient) => {
                return sqlConnection`
                      INSERT INTO "student_interactions" (student_interaction_id, persona_id, enrollment_id, persona_score, last_accessed, persona_context_embedding, is_completed)
                      VALUES (uuid_generate_v4(), ${patient.persona_id}, ${enrollment_id}, 0, CURRENT_TIMESTAMP, NULL, FALSE);
                  `;
              });

              // Execute all insertions
              await Promise.all(studentPatientInsertions);
            }

            response.statusCode = 201; // Set status to 201 on successful enrollment
            response.body = JSON.stringify({
              message:
                "Student enrolled and patient records created successfully.",
            });
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error:
              "student_email and group_access_code query parameters are required",
          });
        }
        break;
      case "GET /session/messages":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.session_id
        ) {
          try {
            const sessionId = event.queryStringParameters.session_id;

            // Fetch all messages in the specified session
            const messages = await sqlConnection`
                      SELECT *
                      FROM "messages"
                      WHERE "chat_id" = ${sessionId}
                      ORDER BY "sent_at" ASC;
                  `;

            response.body = JSON.stringify(messages);
          } catch (err) {
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.statusCode = 500;
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "session_id query parameter is required",
          });
        }
        break;
      case "PUT /student/update_session_name":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.session_id &&
          event.body
        ) {
          try {
            const { session_id } = event.queryStringParameters;
            const { session_name } = JSON.parse(event.body);

            // Update the session name
            const updateResult = await sqlConnection`
                UPDATE "chats"
                SET chat_name = ${session_name}
                WHERE chat_id = ${session_id}
                RETURNING *;
              `;

            if (updateResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Session not found" });
              break;
            }

            response.statusCode = 200;
            response.body = JSON.stringify(updateResult[0]);
          } catch (err) {
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.statusCode = 500;
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Invalid value" });
        }
        break;
      case "POST /student/update_persona_score":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.patient_id &&
          event.queryStringParameters.student_email &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.llm_verdict
        ) {
          try {
            const patientId = event.queryStringParameters.patient_id;
            const studentEmail = event.queryStringParameters.student_email;
            const simulationGroupId =
              event.queryStringParameters.simulation_group_id;
            const llmVerdict =
              event.queryStringParameters.llm_verdict === "true"; // Convert to boolean

            // Retrieve user_id from the Users table
            const userData = await sqlConnection`
                    SELECT user_id
                    FROM "users"
                    WHERE user_email = ${studentEmail};
                `;

            const userId = userData[0]?.user_id;

            if (!userId) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "User not found",
              });
              break;
            }

            // Get the student_interaction_id and current score for the student and patient
            const studentPatientData = await sqlConnection`
                    SELECT student_interaction_id, persona_score
                    FROM "student_interactions"
                    WHERE persona_id = ${patientId}
                      AND enrollment_id = (
                        SELECT enrollment_id
                        FROM "enrollments"
                        WHERE user_id = ${userId} AND simulation_group_id = ${simulationGroupId}
                    );
                `;

            const studentPatientId =
              studentPatientData[0]?.student_interaction_id;
            const currentScore = studentPatientData[0]?.persona_score;

            if (!studentPatientId) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Student patient entry not found.",
              });
              break;
            }

            // If llm_verdict is false and the current score is 100, no update is needed
            if (!llmVerdict && currentScore === 100) {
              response.statusCode = 200;
              response.body = JSON.stringify({
                message: "No changes made. Patient score is already 100.",
              });
              break;
            }

            // Determine the new score based on llm_verdict
            const newScore = llmVerdict ? 100 : 0;

            // Update the patient score for the student
            await sqlConnection`
                    UPDATE "student_interactions"
                    SET persona_score = ${newScore}
                    WHERE student_interaction_id = ${studentPatientId};
                `;

            response.statusCode = 200;
            response.body = JSON.stringify({
              message: "Patient score updated successfully.",
            });
          } catch (err) {
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.statusCode = 500;
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "Invalid query parameters.",
          });
        }
        break;
      case "GET /student/get_notes":
        if (
          event.queryStringParameters &&
          event.queryStringParameters.session_id
        ) {
          const sessionId = event.queryStringParameters.session_id;

          try {
            // Query to get the notes for the session
            const notesData = await sqlConnection`
                    SELECT notes 
                    FROM "chats" 
                    WHERE chat_id = ${sessionId};
                `;

            if (notesData.length > 0) {
              response.statusCode = 200;
              response.body = JSON.stringify({ notes: notesData[0].notes });
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Notes not found." });
            }
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "session_id is required." });
        }
        break;
      case "GET /student/patient_voice_id":
        if (
          event.queryStringParameters &&
          event.queryStringParameters.patient_id
        ) {
          const patientId = event.queryStringParameters.patient_id;

          try {
            // Query to get the patient voice ID
            const voiceData = await sqlConnection`
                    SELECT voice_id 
                    FROM "personas" 
                    WHERE persona_id = ${patientId};
                `;

            if (voiceData.length > 0) {
              response.statusCode = 200;
              response.body = JSON.stringify({
                voice_id: voiceData[0].voice_id,
              });
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Voice ID not found." });
            }
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "patient_id is required." });
        }
        break;
      case "PUT /student/update_notes":
        if (
          event.queryStringParameters &&
          event.queryStringParameters.session_id &&
          event.body
        ) {
          const sessionId = event.queryStringParameters.session_id;
          const { notes } = JSON.parse(event.body);

          try {
            // Update the notes for the session
            const updateResult = await sqlConnection`
                    UPDATE "chats" 
                    SET notes = ${notes}, last_accessed = CURRENT_TIMESTAMP 
                    WHERE chat_id = ${sessionId}
                    RETURNING *;
                `;

            if (updateResult.length > 0) {
              response.statusCode = 200;
              response.body = JSON.stringify({
                message: "Notes updated successfully.",
                session: updateResult[0],
              });
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Session not found." });
            }
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Invalid input." });
        }
        break;
      case "GET /student/get_completion_status":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.student_email &&
          event.queryStringParameters.simulation_group_id
        ) {
          const { student_email, simulation_group_id } =
            event.queryStringParameters;

          try {
            // Step 1: Get the user_id from the student's email
            const userResult = await sqlConnection`
              SELECT user_id FROM "users" WHERE user_email = ${student_email} LIMIT 1;
            `;

            const userId = userResult[0]?.user_id;

            if (!userId) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Student not found" });
              break;
            }

            // Step 2: Fetch all interactions with completion status for the specified simulation group
            const completionStatus = await sqlConnection`
              SELECT si.student_interaction_id, si.is_completed, p.persona_name
              FROM "student_interactions" si
              JOIN "personas" p ON si.persona_id = p.persona_id
              JOIN "enrollments" e ON si.enrollment_id = e.enrollment_id
              WHERE e.user_id = ${userId} AND e.simulation_group_id = ${simulation_group_id}
              ORDER BY p.persona_name;
            `;

            response.statusCode = 200;
            response.body = JSON.stringify(completionStatus);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "student_email and simulation_group_id are required",
          });
        }
        break;
      case "GET /student/patient_context":
        if (
          event.queryStringParameters &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.patient_id
        ) {
          const { simulation_group_id, patient_id } =
            event.queryStringParameters;

          try {
            // Get system prompt
            const systemPromptResult = await sqlConnection`
              SELECT system_prompt 
              FROM "simulation_groups" 
              WHERE simulation_group_id = ${simulation_group_id}
            `;

            // Get patient details
            const patientResult = await sqlConnection`
              SELECT persona_name, persona_age, persona_prompt, llm_completion
              FROM "personas" 
              WHERE persona_id = ${patient_id}
            `;

            if (systemPromptResult.length === 0 || patientResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Patient or simulation group not found",
              });
              break;
            }

            const context = {
              system_prompt: systemPromptResult[0].system_prompt,
              persona_name: patientResult[0].persona_name,
              persona_age: patientResult[0].persona_age,
              persona_prompt: patientResult[0].persona_prompt,
              llm_completion: patientResult[0].llm_completion,
            };

            response.statusCode = 200;
            response.body = JSON.stringify(context);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "simulation_group_id and patient_id are required",
          });
        }
        break;
      case "GET /student/voice_enabled":
        if (
          event.queryStringParameters &&
          event.queryStringParameters.simulation_group_id
        ) {
          const { simulation_group_id } = event.queryStringParameters;

          try {
            // Get voice settings for the simulation group
            const voiceResult = await sqlConnection`
              SELECT admin_voice_enabled, instructor_voice_enabled 
              FROM "simulation_groups" 
              WHERE simulation_group_id = ${simulation_group_id}
            `;

            if (voiceResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Simulation group not found",
              });
              break;
            }

            const { admin_voice_enabled, instructor_voice_enabled } =
              voiceResult[0];

            // Voice is enabled only if both admin and instructor toggles are enabled
            const voiceEnabled =
              admin_voice_enabled !== false &&
              instructor_voice_enabled !== false;

            response.statusCode = 200;
            response.body = JSON.stringify({
              voice_enabled: voiceEnabled,
              admin_voice_enabled: admin_voice_enabled !== false,
              instructor_voice_enabled: instructor_voice_enabled !== false,
            });
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "simulation_group_id is required",
          });
        }
        break;
      case "GET /student/get_debrief":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.session_id &&
          event.queryStringParameters.email
        ) {
          const sessionId = event.queryStringParameters.session_id;
          const studentEmail = event.queryStringParameters.email;

          try {
            // 1) Validate student exists
            const userResult = await sqlConnection`
              SELECT user_id
              FROM "users"
              WHERE user_email = ${studentEmail}
              LIMIT 1;
            `;

            if (userResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Student not found." });
              break;
            }

            const userId = userResult[0].user_id;

            // 2) Validate the chat belongs to this student (ownership check)
            const ownerCheck = await sqlConnection`
              SELECT c.chat_id
              FROM "chats" c
              JOIN "student_interactions" si
                ON c.student_interaction_id = si.student_interaction_id
              JOIN "enrollments" e
                ON si.enrollment_id = e.enrollment_id
              WHERE c.chat_id = ${sessionId}
                AND e.user_id = ${userId}
              LIMIT 1;
            `;

            if (ownerCheck.length === 0) {
              response.statusCode = 403;
              response.body = JSON.stringify({
                error: "Forbidden: you do not have access to this chat.",
              });
              break;
            }

            // 3) Retry for race condition (debrief inserted async after conclude)
            const maxRetries = 6;
            const baseDelayMs = 300; // 0.3s, 0.6s, 1.2s, 2.4s, 4.8s, 9.6s (approx)
            let debriefRow = null;

            for (let attempt = 0; attempt < maxRetries; attempt++) {
              const debriefData = await sqlConnection`
                SELECT generated_text
                FROM "debriefs"
                WHERE chat_id = ${sessionId}
                ORDER BY created_at DESC
                LIMIT 1;
              `;

              if (debriefData.length > 0) {
                debriefRow = debriefData[0];
                break;
              }

              // exponential-ish backoff
              const delay = baseDelayMs * Math.pow(2, attempt);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }

            if (debriefRow) {
              let parsedDebrief = debriefRow.generated_text;
              // If it's a string, parse it
              if (typeof parsedDebrief === 'string') {
                try {
                  parsedDebrief = JSON.parse(parsedDebrief);
                } catch (parseErr) {
                  logger.error("Failed to parse debrief JSON from DB", { 
                    error: parseErr.message,
                    raw: parsedDebrief.substring(0, 200)
                  });
                  // Return unparsed if parse fails — let frontend handle it
                }
              }
              response.statusCode = 200;
              response.body = JSON.stringify({
                generated_text:parsedDebrief, // no double encoding
                status: "complete",
              });
            } else {
              // Not an error; it's still generating
              response.statusCode = 202;
              response.body = JSON.stringify({
                status: "generating",
                error:
                  "Debrief is still being generated. Please try again shortly.",
              });
            }
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "session_id and email are required",
          });
        }
        break;
      case "POST /student/conclude_interaction":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.session_id &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.patient_id &&
          event.body
        ) {
          const sessionId = event.queryStringParameters.session_id;
          const simulationGroupId = event.queryStringParameters.simulation_group_id;
          const patientId = event.queryStringParameters.patient_id;
          const { recommendation } = JSON.parse(event.body);

          if (!recommendation || !recommendation.trim()) {
            response.statusCode = 400;
            response.body = JSON.stringify({ error: "recommendation is required in the request body" });
            break;
          }

          try {
            // Step 1: Save recommendation and mark the chat as ended
            const updatedChat = await sqlConnection`
              UPDATE "chats"
              SET recommendation = ${recommendation},
                  ended_at = CURRENT_TIMESTAMP,
                  status = 'concluded',
                  last_accessed = CURRENT_TIMESTAMP
              WHERE chat_id = ${sessionId}
              RETURNING *;
            `;

            if (updatedChat.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Session not found." });
              break;
            }

            // Step 2: Get the student_interaction_id from the chat
            const studentInteractionId = updatedChat[0].student_interaction_id;

            // Step 3: Mark the student_interaction as completed
            await sqlConnection`
              UPDATE "student_interactions"
              SET is_completed = TRUE,
                  last_accessed = CURRENT_TIMESTAMP
              WHERE student_interaction_id = ${studentInteractionId};
            `;

            // Step 4: Get user_id from the authorizer for engagement logging
            const userId = cognito_id;
            const userResult = await sqlConnection`
              SELECT user_id FROM "users"
              WHERE user_id = (
                SELECT user_id FROM "enrollments"
                WHERE enrollment_id = (
                  SELECT enrollment_id FROM "student_interactions"
                  WHERE student_interaction_id = ${studentInteractionId}
                )
              );
            `;

            const dbUserId = userResult[0]?.user_id;

            if (dbUserId) {
              const enrollmentData = await sqlConnection`
                SELECT enrollment_id FROM "enrollments"
                WHERE user_id = ${dbUserId} AND simulation_group_id = ${simulationGroupId};
              `;

              const enrollmentId = enrollmentData[0]?.enrollment_id;

              if (enrollmentId) {
                await sqlConnection`
                  INSERT INTO "user_engagement_log" (
                    log_id, user_id, simulation_group_id, persona_id, enrollment_id, timestamp, engagement_type
                  ) VALUES (
                    uuid_generate_v4(),
                    ${dbUserId},
                    ${simulationGroupId},
                    ${patientId},
                    ${enrollmentId},
                    CURRENT_TIMESTAMP,
                    'chat_concluded'
                  );
                `;
              }
            }

            // Step 5: Invoke the text generation Lambda asynchronously for debrief generation
            // The text gen Lambda will read the chat messages + recommendation from the DB
            const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
            const lambdaClient = new LambdaClient();

            const textGenFunctionName = process.env.TEXT_GEN_FUNCTION_NAME;

            if (textGenFunctionName) {
              const debriefPayload = {
                queryStringParameters: {
                  simulation_group_id: simulationGroupId,
                  session_id: sessionId,
                  patient_id: patientId,
                  mode: "debrief",
                },
                headers: event.headers,
                requestContext: event.requestContext,
                body: JSON.stringify({ recommendation }),
              };

              const invokeCommand = new InvokeCommand({
                FunctionName: textGenFunctionName,
                InvocationType: "Event", // Async invocation — fire and forget
                Payload: JSON.stringify(debriefPayload),
              });

              try {
                await lambdaClient.send(invokeCommand);
                logger.info("Debrief generation Lambda invoked asynchronously", {
                  sessionId,
                  textGenFunctionName,
                });
              } catch (invokeErr) {
                // Log but don't fail the conclude request — debrief can be retried
                logger.error("Failed to invoke debrief generation Lambda", {
                  error: invokeErr.message,
                  stack: invokeErr.stack,
                });
              }
            } else {
              logger.warn("TEXT_GEN_FUNCTION_NAME not set — skipping debrief generation");
            }

            response.statusCode = 200;
            response.body = JSON.stringify({
              message: "Interaction concluded successfully.",
              chat: updatedChat[0],
              debrief_triggered: !!textGenFunctionName,
            });
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "session_id, simulation_group_id, patient_id, and recommendation body are required",
          });
        }
        break;
      case "GET /student/persona_media":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.persona_id
        ) {
          try {
            const { persona_id } = event.queryStringParameters;
            const data = await sqlConnection`
              SELECT media_id, persona_id, media_type, url, title, description, created_at
              FROM "persona_media"
              WHERE persona_id = ${persona_id}
              ORDER BY created_at ASC;
            `;
            response.statusCode = 200;
            response.body = JSON.stringify(data);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "persona_id is required" });
        }
        break;
      case "POST /student/debrief_feedback":
        if (!event.body) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Request body is required" });
          break;
        }

        try {
          const feedbackBody = JSON.parse(event.body);
          const { simulation_group_id, persona_id, chat_id, is_helpful, comment } = feedbackBody;

          if (!simulation_group_id || !persona_id || !chat_id || is_helpful === undefined || is_helpful === null) {
            response.statusCode = 400;
            response.body = JSON.stringify({
              error: "simulation_group_id, persona_id, chat_id, and is_helpful are required",
            });
            break;
          }

          if (typeof is_helpful !== "boolean") {
            response.statusCode = 400;
            response.body = JSON.stringify({ error: "is_helpful must be a boolean" });
            break;
          }

          // Look up user_id from authenticated email
          const feedbackUserResult = await sqlConnection`
            SELECT user_id FROM "users" WHERE user_email = ${userEmailAttribute};
          `;

          if (feedbackUserResult.length === 0) {
            response.statusCode = 404;
            response.body = JSON.stringify({ error: "User not found" });
            break;
          }

          const feedbackUserId = feedbackUserResult[0].user_id;

          // Insert into debrief_feedback table
          const feedbackResult = await sqlConnection`
            INSERT INTO "debrief_feedback" (
              feedback_id, simulation_group_id, persona_id, chat_id, user_id, is_helpful, comment, submitted_at
            ) VALUES (
              uuid_generate_v4(),
              ${simulation_group_id},
              ${persona_id},
              ${chat_id},
              ${feedbackUserId},
              ${is_helpful},
              ${comment || null},
              CURRENT_TIMESTAMP
            )
            RETURNING feedback_id;
          `;

          response.statusCode = 200;
          response.body = JSON.stringify({ feedback_id: feedbackResult[0].feedback_id });
        } catch (err) {
          response.statusCode = 500;
          logger.error("Operation failed", { error: err.message, stack: err.stack });
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;
      case "POST /student/issue_report":
        if (!event.body) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Request body is required" });
          break;
        }

        try {
          const reportBody = JSON.parse(event.body);
          const { simulation_group_id, persona_id, chat_id, issue_categories, details } = reportBody;

          if (!simulation_group_id || !persona_id || !chat_id || !issue_categories) {
            response.statusCode = 400;
            response.body = JSON.stringify({
              error: "simulation_group_id, persona_id, chat_id, and issue_categories are required",
            });
            break;
          }

          if (!Array.isArray(issue_categories) || issue_categories.length === 0) {
            response.statusCode = 400;
            response.body = JSON.stringify({ error: "issue_categories must be a non-empty array" });
            break;
          }

          // Look up user_id from authenticated email
          const reportUserResult = await sqlConnection`
            SELECT user_id FROM "users" WHERE user_email = ${userEmailAttribute};
          `;

          if (reportUserResult.length === 0) {
            response.statusCode = 404;
            response.body = JSON.stringify({ error: "User not found" });
            break;
          }

          const reportUserId = reportUserResult[0].user_id;

          // Insert into issue_reports table
          const reportResult = await sqlConnection`
            INSERT INTO "issue_reports" (
              report_id, simulation_group_id, persona_id, chat_id, user_id, issue_categories, details, submitted_at
            ) VALUES (
              uuid_generate_v4(),
              ${simulation_group_id},
              ${persona_id},
              ${chat_id},
              ${reportUserId},
              ${issue_categories},
              ${details || null},
              CURRENT_TIMESTAMP
            )
            RETURNING report_id;
          `;

          response.statusCode = 200;
          response.body = JSON.stringify({ report_id: reportResult[0].report_id });
        } catch (err) {
          response.statusCode = 500;
          logger.error("Operation failed", { error: err.message, stack: err.stack });
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;
      case "GET /student/me":
        try {
          const meEmail = event.requestContext.authorizer.email;
          if (!meEmail) {
            response.statusCode = 400;
            response.body = JSON.stringify({ error: "Email not available in authorizer context" });
            break;
          }

          const meUserData = await sqlConnection`
            SELECT user_email, first_name, last_name, roles, organization_id
            FROM "users"
            WHERE user_email = ${meEmail};
          `;

          if (meUserData.length > 0) {
            response.statusCode = 200;
            response.body = JSON.stringify(meUserData[0]);
          } else {
            response.statusCode = 404;
            response.body = JSON.stringify({ error: "User not found" });
          }
        } catch (err) {
          response.statusCode = 500;
          logger.error("Operation failed", { error: err.message, stack: err.stack });
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;
      default:
        throw new Error(`Unsupported route: "${pathData}"`);
    }
  } catch (error) {
    response.statusCode = 400;
    logger.error("Unhandled route error", { error: error.message, stack: error.stack });
    response.body = JSON.stringify(error.message);
  }
  logger.logResponse(response);

  return response;
};
