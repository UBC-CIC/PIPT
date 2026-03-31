const { initializeConnection } = require("./lib.js");
const logger = require("./logger");
let { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT, USER_POOL } = process.env;
const {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

let sqlConnection = global.sqlConnection;

exports.handler = async (event, context) => {
  logger.init(event, context);
  logger.info("Instructor handler invoked", { queryStringParameters: event.queryStringParameters });

  const cognito_id = event.requestContext.authorizer.userId;
  const client = new CognitoIdentityProviderClient();
  const userAttributesCommand = new AdminGetUserCommand({
    UserPoolId: USER_POOL,
    Username: cognito_id,
  });
  const userAttributesResponse = await client.send(userAttributesCommand);

  const emailAttr = userAttributesResponse.UserAttributes.find(
    (attr) => attr.Name === "email",
  );
  const userEmailAttribute = emailAttr ? emailAttr.Value : null;

  // Check for query string parameters

  const queryStringParams = event.queryStringParameters || {};
  const queryEmail = queryStringParams.email;
  const instructorEmail = queryStringParams.instructor_email;

  const isUnauthorized =
    (queryEmail && queryEmail !== userEmailAttribute) ||
    (instructorEmail && instructorEmail !== userEmailAttribute);

  if (isUnauthorized) {
    logger.warn("Unauthorized access attempt", { queryEmail, instructorEmail, userEmailAttribute });
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

  function generateAccessCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 16; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code.match(/.{1,4}/g).join("-");
  }

  let data;
  try {
    const pathData = event.httpMethod + " " + event.resource;
    switch (pathData) {
      case "GET /instructor/student_group":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.email
        ) {
          const email = event.queryStringParameters.email;

          try {
            // First, get the user_id for the given email
            const userResult = await sqlConnection`
              SELECT user_id FROM "users" WHERE user_email = ${email};
            `;

            if (userResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "User not found" });
              break;
            }

            const userId = userResult[0].user_id;

            // Now, fetch the simulation groups for that user_id
            const data = await sqlConnection`
              SELECT sg.*
              FROM "enrollments" e
              JOIN "simulation_groups" sg 
              ON e.simulation_group_id = sg.simulation_group_id
              WHERE e.user_id = ${userId}
              ORDER BY sg.group_name, sg.simulation_group_id;
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
          response.body = JSON.stringify({ error: "Invalid value" });
        }
        break;
      case "GET /instructor/groups":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.email
        ) {
          const instructorEmail = event.queryStringParameters.email;

          try {
            // First, get the user ID using the email
            const userIdResult = await sqlConnection`
                SELECT user_id
                FROM "users"
                WHERE user_email = ${instructorEmail}
                LIMIT 1;
              `;

            const userId = userIdResult[0]?.user_id;

            if (!userId) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Instructor not found" });
              break;
            }

            // Query to get all simulation groups where the instructor is enrolled, with counts
            const data = await sqlConnection`
                SELECT g.*,
                  COALESCE(pc.persona_count, 0)::int AS persona_count,
                  COALESCE(sc.student_count, 0)::int AS student_count,
                  COALESCE(ic.instructor_count, 0)::int AS instructor_count
                FROM "enrollments" e
                JOIN "simulation_groups" g ON e.simulation_group_id = g.simulation_group_id
                LEFT JOIN (
                  SELECT simulation_group_id, COUNT(*) AS persona_count
                  FROM "personas"
                  GROUP BY simulation_group_id
                ) pc ON pc.simulation_group_id = g.simulation_group_id
                LEFT JOIN (
                  SELECT simulation_group_id, COUNT(*) AS student_count
                  FROM "enrollments"
                  WHERE enrollment_type = 'student'
                  GROUP BY simulation_group_id
                ) sc ON sc.simulation_group_id = g.simulation_group_id
                LEFT JOIN (
                  SELECT simulation_group_id, COUNT(*) AS instructor_count
                  FROM "enrollments"
                  WHERE enrollment_type = 'instructor'
                  GROUP BY simulation_group_id
                ) ic ON ic.simulation_group_id = g.simulation_group_id
                WHERE e.user_id = ${userId}
                AND e.enrollment_type = 'instructor'
                ORDER BY g.group_name, g.simulation_group_id;
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
          response.body = JSON.stringify({ error: "email is required" });
        }
        break;
      case "GET /instructor/analytics":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id
        ) {
          const simulationGroupId =
            event.queryStringParameters.simulation_group_id;
          const startDateStr = event.queryStringParameters.start_date || null;
          const endDateStr = event.queryStringParameters.end_date || null;

          let dateFilterLogsStr = sqlConnection``;
          if (startDateStr && !endDateStr) dateFilterLogsStr = sqlConnection`AND uel.timestamp >= ${startDateStr}::timestamp`;
          if (!startDateStr && endDateStr) dateFilterLogsStr = sqlConnection`AND uel.timestamp <= ${endDateStr}::timestamp`;
          if (startDateStr && endDateStr) dateFilterLogsStr = sqlConnection`AND uel.timestamp >= ${startDateStr}::timestamp AND uel.timestamp <= ${endDateStr}::timestamp`;

          let dateFilterMessagesStr = sqlConnection``;
          if (startDateStr && !endDateStr) dateFilterMessagesStr = sqlConnection`AND m.time_sent >= ${startDateStr}::timestamp`;
          if (!startDateStr && endDateStr) dateFilterMessagesStr = sqlConnection`AND m.time_sent <= ${endDateStr}::timestamp`;
          if (startDateStr && endDateStr) dateFilterMessagesStr = sqlConnection`AND m.time_sent >= ${startDateStr}::timestamp AND m.time_sent <= ${endDateStr}::timestamp`;

          let dateFilterInteractionsStr = sqlConnection``;
          if (startDateStr && !endDateStr) dateFilterInteractionsStr = sqlConnection`AND sp.last_accessed >= ${startDateStr}::timestamp`;
          if (!startDateStr && endDateStr) dateFilterInteractionsStr = sqlConnection`AND sp.last_accessed <= ${endDateStr}::timestamp`;
          if (startDateStr && endDateStr) dateFilterInteractionsStr = sqlConnection`AND sp.last_accessed >= ${startDateStr}::timestamp AND sp.last_accessed <= ${endDateStr}::timestamp`;

          try {
            // Query to get all patients and their message counts, separated by student and AI messages
            const messageCreations = await sqlConnection`
                    SELECT p.persona_id, p.persona_name, p.persona_number, 
                        COALESCE(sub.student_message_count, 0) AS student_message_count,
                        COALESCE(sub.ai_message_count, 0) AS ai_message_count
                    FROM "personas" p
                    LEFT JOIN (
                        SELECT sp.persona_id,
                            COUNT(CASE WHEN m.sender_type = 'student' THEN 1 ELSE NULL END) AS student_message_count,
                            COUNT(CASE WHEN m.sender_type = 'ai' THEN 1 ELSE NULL END) AS ai_message_count
                        FROM "student_interactions" sp
                        JOIN "chats" c ON sp.student_interaction_id = c.student_interaction_id
                        JOIN "messages" m ON c.chat_id = m.chat_id
                        JOIN "enrollments" e ON sp.enrollment_id = e.enrollment_id
                        JOIN "users" u ON e.user_id = u.user_id
                        WHERE 'student' = ANY(u.roles)
                        ${dateFilterMessagesStr}
                        GROUP BY sp.persona_id
                    ) sub ON sub.persona_id = p.persona_id
                    WHERE p.simulation_group_id = ${simulationGroupId}
                    ORDER BY p.persona_number ASC, p.persona_name ASC;
                `;

            // Query to get the number of patient accesses using User_Engagement_Log, filtering by student role
            const patientAccesses = await sqlConnection`
                    SELECT p.persona_id, COALESCE(sub.access_count, 0) AS access_count
                    FROM "personas" p
                    LEFT JOIN (
                        SELECT uel.persona_id, COUNT(uel.log_id) AS access_count
                        FROM "user_engagement_log" uel
                        JOIN "enrollments" e ON uel.enrollment_id = e.enrollment_id
                        JOIN "users" u ON e.user_id = u.user_id
                        WHERE uel.engagement_type = 'patient access'
                        AND 'student' = ANY(u.roles)
                        ${dateFilterLogsStr}
                        GROUP BY uel.persona_id
                    ) sub ON sub.persona_id = p.persona_id
                    WHERE p.simulation_group_id = ${simulationGroupId};
                `;

            // Query to get the percentage of scores evaluated by the LLM for each patient, filtering by student role
            const aiScores = await sqlConnection`
                    SELECT p.persona_id, p.llm_completion,
                        COALESCE(sub.ai_score_percentage, 0) AS ai_score_percentage
                    FROM "personas" p
                    LEFT JOIN (
                        SELECT sp.persona_id,
                            CASE 
                                WHEN COUNT(sp.student_interaction_id) = 0 THEN 0 
                                ELSE COUNT(CASE WHEN sp.persona_score = 100 THEN 1 END) * 100.0 / COUNT(sp.student_interaction_id)
                            END AS ai_score_percentage
                        FROM "student_interactions" sp
                        JOIN "enrollments" e ON sp.enrollment_id = e.enrollment_id
                        JOIN "users" u ON e.user_id = u.user_id
                        WHERE 'student' = ANY(u.roles)
                        ${dateFilterInteractionsStr}
                        GROUP BY sp.persona_id
                    ) sub ON sub.persona_id = p.persona_id
                    WHERE p.simulation_group_id = ${simulationGroupId};
                `;

            // Query to calculate the percentage of completed interactions for each patient, filtering by student role
            const instructorCompletionPercentages = await sqlConnection`
                    SELECT p.persona_id, 
                        COALESCE(sub.instructor_completion_percentage, 0) AS instructor_completion_percentage
                    FROM "personas" p
                    LEFT JOIN (
                        SELECT sp.persona_id,
                            CASE 
                                WHEN COUNT(sp.student_interaction_id) = 0 THEN 0 
                                ELSE COUNT(CASE WHEN sp.is_completed THEN 1 END) * 100.0 / COUNT(sp.student_interaction_id)
                            END AS instructor_completion_percentage
                        FROM "student_interactions" sp
                        JOIN "enrollments" e ON sp.enrollment_id = e.enrollment_id
                        JOIN "users" u ON e.user_id = u.user_id
                        WHERE 'student' = ANY(u.roles)
                        ${dateFilterInteractionsStr}
                        GROUP BY sp.persona_id
                    ) sub ON sub.persona_id = p.persona_id
                    WHERE p.simulation_group_id = ${simulationGroupId};
                `;

            // Combine all data into a single response, ensuring all patients are included
            const analyticsData = messageCreations.map((patient) => {
              const accesses =
                patientAccesses.find(
                  (pa) => pa.persona_id === patient.persona_id,
                ) || {};
              const aiScore =
                aiScores.find((ps) => ps.persona_id === patient.persona_id) ||
                {};
              const instructorCompletionData =
                instructorCompletionPercentages.find(
                  (cp) => cp.persona_id === patient.persona_id,
                ) || {};

              return {
                persona_id: patient.persona_id,
                persona_name: patient.persona_name,
                persona_number: patient.persona_number,
                student_message_count: patient.student_message_count || 0,
                ai_message_count: patient.ai_message_count || 0,
                access_count: accesses.access_count || 0,
                ai_score_percentage:
                  parseFloat(aiScore.ai_score_percentage) || 0,
                llm_completion: aiScore.llm_completion || false,
                instructor_completion_percentage:
                  parseFloat(
                    instructorCompletionData.instructor_completion_percentage,
                  ) || 0,
              };
            });

            response.statusCode = 200;
            response.body = JSON.stringify(analyticsData);
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
      case "PUT /instructor/update_metadata":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.persona_id &&
          event.queryStringParameters.filename &&
          event.queryStringParameters.filetype
        ) {
          const persona_id = event.queryStringParameters.persona_id;
          const filename = event.queryStringParameters.filename;
          const filetype = event.queryStringParameters.filetype;
          const { metadata } = JSON.parse(event.body);

          try {
            // Query to find the file with the given persona_id and filename
            const existingFile = await sqlConnection`
                      SELECT * FROM "persona_data"
                      WHERE persona_id = ${persona_id}
                      AND filename = ${filename}
                      AND filetype = ${filetype};
                  `;

            if (existingFile.length === 0) {
              const result = await sqlConnection`
                INSERT INTO "persona_data" (persona_id, filename, filetype, metadata)
                VALUES (${persona_id}, ${filename}, ${filetype}, ${metadata})
                RETURNING *;
              `;
              response.body = JSON.stringify({
                message: "File metadata added successfully",
              });
            }

            // Update the metadata field
            const result = await sqlConnection`
                      UPDATE "persona_data"
                      SET metadata = ${metadata}
                      WHERE persona_id = ${persona_id}
                      AND filename = ${filename}
                      AND filetype = ${filetype}
                      RETURNING *;
                  `;

            if (result.length > 0) {
              response.statusCode = 200;
              response.body = JSON.stringify(result[0]);
            } else {
              response.statusCode = 500;
              response.body = JSON.stringify({
                error: "Failed to update metadata.",
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
            error: "persona_id and filename are required",
          });
        }
        break;
      case "POST /instructor/create_patient":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.persona_name &&
          event.queryStringParameters.persona_number &&
          event.queryStringParameters.persona_age &&
          event.queryStringParameters.persona_gender &&
          event.queryStringParameters.instructor_email &&
          event.body
        ) {
          const {
            simulation_group_id,
            persona_name,
            persona_number,
            persona_age,
            persona_gender,
            instructor_email,
            voice_id: provided_voice_id,
          } = event.queryStringParameters;

          const { persona_prompt } = JSON.parse(event.body);

          try {
            // Check if a patient with the same name already exists in the simulation group
            const existingPatient = await sqlConnection`
                    SELECT * FROM "personas"
                    WHERE simulation_group_id = ${simulation_group_id}
                    AND persona_name = ${persona_name};
                `;

            if (existingPatient.length > 0) {
              response.statusCode = 400;
              response.body = JSON.stringify({
                error:
                  "A patient with this name already exists in the given simulation group.",
              });
              break;
            }

            feminine_voices = [
              "tiffany",
              "amy",
              "ambre",
              "beatrice",
              "greta",
              "lupe",
            ];
            masculine_voices = [
              "matthew",
              "florian",
              "lorenzo",
              "lennart",
              "carlos",
            ];

            function getRandomVoice(voices) {
              return voices[Math.floor(Math.random() * voices.length)];
            }

            // If a voice_id is provided and valid against gender set, use it; else random
            let voice_id;
            if (provided_voice_id) {
              const allVoices = [...feminine_voices, ...masculine_voices];
              if (allVoices.includes(provided_voice_id)) {
                voice_id = provided_voice_id;
              }
            }
            if (!voice_id) {
              voice_id =
                persona_gender.toLowerCase() === "female"
                  ? getRandomVoice(feminine_voices)
                  : getRandomVoice(masculine_voices);
            }

            // Insert new patient into the "personas" table with age and gender
            const newPatient = await sqlConnection`
                    INSERT INTO "personas" (
                        persona_id, 
                        simulation_group_id, 
                        persona_name, 
                        persona_number, 
                        persona_age, 
                        persona_gender,
                        persona_prompt,
                        voice_id
                    )
                    VALUES (
                        uuid_generate_v4(), 
                        ${simulation_group_id}, 
                        ${persona_name}, 
                        ${persona_number}, 
                        ${persona_age}, 
                        ${persona_gender}, 
                        ${persona_prompt},
                        ${voice_id}
                    )
                    RETURNING *;
                `;

            // Log the patient creation in the User Engagement Log
            await sqlConnection`
                    INSERT INTO "user_engagement_log" (
                        log_id, 
                        user_id, 
                        simulation_group_id, 
                        persona_id, 
                        enrollment_id, 
                        timestamp, 
                        engagement_type
                    )
                    VALUES (
                        uuid_generate_v4(),
                        (SELECT user_id FROM "users" WHERE user_email = ${instructor_email}),
                        ${simulation_group_id},
                        ${newPatient[0].persona_id},
                        null,
                        CURRENT_TIMESTAMP,
                        'instructor_created_patient'
                    );
                `;

            // Find all student enrolments for the given simulation group
            const enrolments = await sqlConnection`
                    SELECT enrollment_id FROM "enrollments"
                    WHERE simulation_group_id = ${simulation_group_id};
                `;

            // Create entries for each enrolment in the "student_interactions" table
            await Promise.all(
              enrolments.map(async (enrolment) => {
                await sqlConnection`
                            INSERT INTO "student_interactions" (
                                student_interaction_id, 
                                persona_id, 
                                enrollment_id, 
                                persona_score
                            )
                            VALUES (
                                uuid_generate_v4(), 
                                ${newPatient[0].persona_id}, 
                                ${enrolment.enrollment_id}, 
                                0
                            );
                        `;
              }),
            );

            response.statusCode = 201;
            response.body = JSON.stringify(newPatient[0]);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error:
              "simulation_group_id, persona_name, persona_number, persona_age, persona_gender, or instructor_email is missing",
          });
        }
        break;
      case "PUT /instructor/reorder_patient":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.persona_id &&
          event.queryStringParameters.persona_number &&
          event.queryStringParameters.instructor_email
        ) {
          const { persona_id, persona_number, instructor_email } =
            event.queryStringParameters;
          const { persona_name } = JSON.parse(event.body || "{}");

          if (persona_name) {
            try {
              // Update the patient in the patients table
              await sqlConnection`
                    UPDATE "personas"
                    SET persona_name = ${persona_name}, persona_number = ${persona_number}
                    WHERE persona_id = ${persona_id};
                  `;

              // Insert into User Engagement Log
              await sqlConnection`
                    INSERT INTO "user_engagement_log" (log_id, user_id, simulation_group_id, persona_id, enrollment_id, timestamp, engagement_type)
                    VALUES (uuid_generate_v4(), (SELECT user_id FROM "users" WHERE user_email = ${instructor_email}), NULL, ${persona_id}, NULL, CURRENT_TIMESTAMP, 'instructor_edited_patient');
                  `;

              response.statusCode = 200;
              response.body = JSON.stringify({
                message: "Patient updated successfully",
              });
            } catch (err) {
              response.statusCode = 500;
              logger.error("Operation failed", { error: err.message, stack: err.stack });
              response.body = JSON.stringify({
                error: "Internal server error",
              });
            }
          } else {
            response.statusCode = 400;
            response.body = JSON.stringify({
              error: "persona_name is required in the body",
            });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error:
              "persona_id, persona_number, or instructor_email is missing in query string parameters",
          });
        }
        break;
      case "PUT /instructor/edit_patient":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.persona_id &&
          event.queryStringParameters.instructor_email &&
          event.queryStringParameters.simulation_group_id
        ) {
          const { persona_id, instructor_email, simulation_group_id } =
            event.queryStringParameters;
          const { persona_name, persona_age, persona_gender, persona_prompt } =
            JSON.parse(event.body || "{}");

          if (
            persona_name != null &&
            persona_age != null &&
            persona_gender != null &&
            persona_prompt != null
          ) {
            try {
              // Check if another patient with the same name exists under the same simulation group
              const existingPatient = await sqlConnection`
                        SELECT * FROM "personas"
                        WHERE simulation_group_id = ${simulation_group_id}
                        AND persona_name = ${persona_name}
                        AND persona_id != ${persona_id};
                    `;

              if (existingPatient.length > 0) {
                response.statusCode = 400;
                response.body = JSON.stringify({
                  error: "A patient with this name already exists.",
                });
                break;
              }

              // Update the patient details in the patients table
              await sqlConnection`
                        UPDATE "personas"
                        SET 
                            persona_name = ${persona_name}, 
                            persona_age = ${persona_age}, 
                            persona_gender = ${persona_gender}, 
                            persona_prompt = ${persona_prompt}
                        WHERE persona_id = ${persona_id};
                    `;

              // Insert into User Engagement Log
              await sqlConnection`
                        INSERT INTO "user_engagement_log" (
                            log_id, 
                            user_id, 
                            simulation_group_id, 
                            persona_id, 
                            enrollment_id, 
                            timestamp, 
                            engagement_type
                        ) VALUES (
                            uuid_generate_v4(), 
                            (SELECT user_id FROM "users" WHERE user_email = ${instructor_email}),
                            ${simulation_group_id}, 
                            ${persona_id}, 
                            NULL, 
                            CURRENT_TIMESTAMP, 
                            'instructor_edited_patient'
                        );
                    `;

              response.statusCode = 200;
              response.body = JSON.stringify({
                message: "Patient updated successfully",
              });
            } catch (err) {
              response.statusCode = 500;
              logger.error("Operation failed", { error: err.message, stack: err.stack });
              response.body = JSON.stringify({
                error: "Internal server error",
              });
            }
          } else {
            response.statusCode = 400;
            response.body = JSON.stringify({
              error:
                "persona_name, persona_age, persona_gender, and persona_prompt are required in the body",
            });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error:
              "persona_id or instructor_email is missing in query string parameters",
          });
        }
        break;
      case "PUT /instructor/prompt":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.instructor_email &&
          event.body
        ) {
          try {
            const { simulation_group_id, instructor_email } =
              event.queryStringParameters;
            const { prompt } = JSON.parse(event.body);

            // Retrieve the current system prompt
            const currentPromptResult = await sqlConnection`
              SELECT system_prompt
              FROM "simulation_groups"
              WHERE simulation_group_id = ${simulation_group_id};
            `;

            if (currentPromptResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Simulation Group not found",
              });
              break;
            }

            const oldPrompt = currentPromptResult[0].system_prompt;

            // Update the system prompt for the simulation group
            const updatedGroup = await sqlConnection`
              UPDATE "simulation_groups"
              SET system_prompt = ${prompt}
              WHERE simulation_group_id = ${simulation_group_id}
              RETURNING *;
            `;

            // Log the change in the User Engagement Log with the old prompt
            await sqlConnection`
              INSERT INTO "user_engagement_log" (
                log_id,
                user_id,
                simulation_group_id,
                persona_id,
                enrollment_id,
                timestamp,
                engagement_type,
                engagement_details
              )
              VALUES (
                uuid_generate_v4(),
                (SELECT user_id FROM "users" WHERE user_email = ${instructor_email}),
                ${simulation_group_id},
                null,
                null,
                CURRENT_TIMESTAMP,
                'instructor_updated_prompt',
                ${oldPrompt}
              );
            `;

            response.statusCode = 200;
            response.body = JSON.stringify(updatedGroup[0]);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error:
              "simulation_group_id, instructor_email, or request body is missing",
          });
        }
        break;
      case "GET /instructor/view_students":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id
        ) {
          const { simulation_group_id } = event.queryStringParameters;

          try {
            // Query to get all students enrolled in the given simulation group
            const enrolledStudents = await sqlConnection`
              SELECT u.user_email, u.username, u.first_name, u.last_name
              FROM "enrollments" e
              JOIN "users" u ON e.user_id = u.user_id
              WHERE e.simulation_group_id = ${simulation_group_id}
                AND e.enrollment_type = 'student';
            `;

            response.statusCode = 200;
            response.body = JSON.stringify(enrolledStudents);
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
      case "DELETE /instructor/delete_student":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.instructor_email &&
          event.queryStringParameters.user_email
        ) {
          const { simulation_group_id, instructor_email, user_email } =
            event.queryStringParameters;

          try {
            // Step 1: Get the user ID from the user email
            const userResult = await sqlConnection`
              SELECT user_id
              FROM "users"
              WHERE user_email = ${user_email}
              LIMIT 1;
            `;

            const userId = userResult[0]?.user_id;

            if (!userId) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "User not found",
              });
              break;
            }

            // Step 2: Delete the student from the simulation group enrolments
            const deleteResult = await sqlConnection`
              DELETE FROM "enrollments"
              WHERE simulation_group_id = ${simulation_group_id}
                AND user_id = ${userId}
                AND enrollment_type = 'student'
              RETURNING *;
            `;

            if (deleteResult.length > 0) {
              response.statusCode = 200;
              response.body = JSON.stringify(deleteResult[0]);

              // Step 3: Insert into User Engagement Log
              await sqlConnection`
                INSERT INTO "user_engagement_log" (
                  log_id, user_id, simulation_group_id, persona_id, enrollment_id, timestamp, engagement_type
                )
                VALUES (
                  uuid_generate_v4(), ${userId}, ${simulation_group_id}, null, null, 
                  CURRENT_TIMESTAMP, 'instructor_deleted_student'
                );
              `;
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Student not found in the simulation group",
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
            error:
              "simulation_group_id, user_email, and instructor_email are required",
          });
        }
        break;
      case "GET /instructor/view_patients":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id
        ) {
          const { simulation_group_id } = event.queryStringParameters;

          try {
            // Query to get all patients for the given simulation group
            const simulationPatients = await sqlConnection`
                    SELECT p.persona_id, p.persona_name, p.persona_age, p.persona_gender, p.persona_prompt, p.llm_completion
                    FROM "personas" p
                    WHERE p.simulation_group_id = ${simulation_group_id}
                    ORDER BY p.persona_name ASC;
                `;

            response.statusCode = 200;
            response.body = JSON.stringify(simulationPatients);
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
      case "DELETE /instructor/delete_patient":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.persona_id
        ) {
          const personaId = event.queryStringParameters.persona_id;

          try {
            // Delete the patient from the patients table
            await sqlConnection`
                    DELETE FROM "personas"
                    WHERE persona_id = ${personaId};
                `;

            response.statusCode = 200;
            response.body = JSON.stringify({
              message: "Patient deleted successfully",
            });
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
      case "GET /instructor/get_prompt":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id
        ) {
          try {
            const { simulation_group_id } = event.queryStringParameters;

            // Retrieve the system prompt from the simulation_groups table
            const groupPrompt = await sqlConnection`
              SELECT system_prompt
              FROM "simulation_groups"
              WHERE simulation_group_id = ${simulation_group_id};
            `;

            if (groupPrompt.length > 0) {
              response.statusCode = 200;
              response.body = JSON.stringify(groupPrompt[0]);
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Simulation group not found",
              });
            }
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = "simulation_group_id is missing";
        }
        break;
      case "GET /instructor/view_student_messages":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.student_email &&
          event.queryStringParameters.simulation_group_id
        ) {
          const studentEmail = event.queryStringParameters.student_email;
          const simulationGroupId =
            event.queryStringParameters.simulation_group_id;

          try {
            // Step 1: Get the user ID from the user email
            const userResult = await sqlConnection`
              SELECT user_id
              FROM "users"
              WHERE user_email = ${studentEmail}
              LIMIT 1;
            `;

            const userId = userResult[0]?.user_id;

            if (!userId) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "User not found" });
              break;
            }

            // Step 2: Query to get the student's messages for a specific simulation group
            const messages = await sqlConnection`
              SELECT m.message_content, m.sent_at, m.sender_type
              FROM "messages" m
              JOIN "chats" c ON m.chat_id = c.chat_id
              JOIN "student_interactions" sp ON c.student_interaction_id = sp.student_interaction_id
              JOIN "enrollments" e ON sp.enrollment_id = e.enrollment_id
              WHERE e.user_id = ${userId}
              AND e.simulation_group_id = ${simulationGroupId}
              ORDER BY m.sent_at;
            `;

            response.statusCode = 200;
            response.body = JSON.stringify(messages);
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
      case "PUT /instructor/generate_access_code":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id
        ) {
          const simulationGroupId =
            event.queryStringParameters.simulation_group_id;

          try {
            const newAccessCode = generateAccessCode();

            // Update the access code in the simulation_groups table
            const updatedGroup = await sqlConnection`
              UPDATE "simulation_groups"
              SET group_access_code = ${newAccessCode}
              WHERE simulation_group_id = ${simulationGroupId}
              RETURNING *;
            `;

            response.statusCode = 200;
            response.body = JSON.stringify({
              message: "Access code generated successfully",
              access_code: newAccessCode,
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
      case "GET /instructor/get_access_code":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id
        ) {
          const simulationGroupId =
            event.queryStringParameters.simulation_group_id;

          try {
            // Query to get the access code
            const accessCode = await sqlConnection`
              SELECT group_access_code
              FROM "simulation_groups"
              WHERE simulation_group_id = ${simulationGroupId};
            `;

            response.statusCode = 200;
            response.body = JSON.stringify(accessCode[0]);
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
      case "GET /instructor/previous_prompts":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.instructor_email
        ) {
          try {
            const { simulation_group_id, instructor_email } =
              event.queryStringParameters;

            // Query to get all previous prompts for the given simulation group and instructor
            const previousPrompts = await sqlConnection`
              SELECT timestamp, engagement_details AS previous_prompt
              FROM "user_engagement_log"
              WHERE simulation_group_id = ${simulation_group_id}
                AND engagement_type = 'instructor_updated_prompt'
              ORDER BY timestamp DESC;
            `;

            response.body = JSON.stringify(previousPrompts);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error:
              "simulation_group_id or instructor_email query parameter is required",
          });
        }
        break;
      case "GET /instructor/student_patients_messages":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.student_email &&
          event.queryStringParameters.simulation_group_id
        ) {
          const studentEmail = event.queryStringParameters.student_email;
          const simulationGroupId =
            event.queryStringParameters.simulation_group_id;

          try {
            // Step 1: Get the user ID from the student email
            const userResult = await sqlConnection`
                    SELECT user_id
                    FROM "users"
                    WHERE user_email = ${studentEmail}
                    LIMIT 1;
                `;

            const userId = userResult[0]?.user_id;

            if (!userId) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Student not found",
              });
              break;
            }

            // Step 2: Get all patients linked to the student under the given simulation group
            const studentPatients = await sqlConnection`
                    SELECT p.persona_id, p.persona_name, p.persona_number
                    FROM "student_interactions" si
                    JOIN "personas" p ON si.persona_id = p.persona_id
                    JOIN "enrollments" e ON si.enrollment_id = e.enrollment_id
                    WHERE e.user_id = ${userId} AND e.simulation_group_id = ${simulationGroupId}
                    ORDER BY p.persona_number;
                `;

            const result = {};

            // Step 3: Iterate through the patients and get chats for each patient
            for (const patient of studentPatients) {
              const chats = await sqlConnection`
                        SELECT c.chat_id, c.chat_name, c.notes, c.status
                        FROM "chats" c
                        WHERE c.student_interaction_id IN (
                            SELECT student_interaction_id 
                            FROM "student_interactions"
                            WHERE persona_id = ${patient.persona_id} AND enrollment_id IN (
                                SELECT enrollment_id 
                                FROM "enrollments" 
                                WHERE user_id = ${userId} AND simulation_group_id = ${simulationGroupId}
                            )
                        );
                    `;

              result[patient.persona_name] = [];

              // Step 4: For each chat, retrieve the messages and notes
              for (const chat of chats) {
                const messages = await sqlConnection`
                            SELECT sender_type, message_content, sent_at
                            FROM "messages"
                            WHERE chat_id = ${chat.chat_id}
                            ORDER BY sent_at ASC;
                        `;

                result[patient.persona_name].push({
                  chatId: chat.chat_id,
                  chatName: chat.chat_name,
                  notes: chat.notes || "No notes available.",
                  status: chat.status || "active",
                  messages: messages.map((msg) => ({
                    sender_type: msg.sender_type,
                    message_content: msg.message_content,
                    sent_at: msg.sent_at,
                  })),
                });
              }
            }

            // Step 5: Return the response
            response.body = JSON.stringify(result);
          } catch (err) {
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.statusCode = 500;
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "student_email and simulation_group_id are required",
          });
        }
        break;
      case "GET /instructor/get_completion_status":
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
      case "PUT /instructor/toggle_completion":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.student_interaction_id
        ) {
          const { student_interaction_id } = event.queryStringParameters;

          try {
            // Get the current completion status
            const result = await sqlConnection`
              SELECT is_completed FROM "student_interactions" WHERE student_interaction_id = ${student_interaction_id};
            `;

            if (result.length > 0) {
              const newStatus = !result[0].is_completed;

              // Update the status to the opposite value
              await sqlConnection`
                UPDATE "student_interactions"
                SET is_completed = ${newStatus}
                WHERE student_interaction_id = ${student_interaction_id};
              `;

              response.statusCode = 200;
              response.body = JSON.stringify({
                message: "Completion status updated",
                is_completed: newStatus,
              });
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Interaction not found",
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
            error: "student_interaction_id is required",
          });
        }
        break;
      case "PUT /instructor/toggle_llm_completion":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.persona_id
        ) {
          const { persona_id } = event.queryStringParameters;

          try {
            // Retrieve the current llm_completion status for the patient
            const result = await sqlConnection`
                    SELECT llm_completion FROM "personas" WHERE persona_id = ${persona_id};
                `;

            if (result.length > 0) {
              // Toggle the llm_completion value
              const newStatus = !result[0].llm_completion;

              // Update the status to the opposite value in the database
              await sqlConnection`
                        UPDATE "personas"
                        SET llm_completion = ${newStatus}
                        WHERE persona_id = ${persona_id};
                    `;

              response.statusCode = 200;
              response.body = JSON.stringify({
                message: "LLM completion status updated",
                llm_completion: newStatus,
              });
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Patient not found" });
            }
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
      case "GET /instructor/ingestion_status":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.persona_id &&
          event.queryStringParameters.simulation_group_id
        ) {
          const { persona_id, simulation_group_id } =
            event.queryStringParameters;

          try {
            // Query patient_data table to fetch filenames and ingestion_status for documents
            const ingestionStatusData = await sqlConnection`
                    SELECT filename, filetype, ingestion_status
                    FROM "persona_data"
                    WHERE persona_id = ${persona_id}
                    AND filepath LIKE ${
                      simulation_group_id + "/" + persona_id + "/documents/%"
                    };
                `;

            // Convert the results to a hashmap
            const ingestionStatusMap = {};
            ingestionStatusData.forEach((row) => {
              ingestionStatusMap[row.filename + "." + row.filetype] =
                row.ingestion_status;
            });

            response.statusCode = 200;
            response.body = JSON.stringify(ingestionStatusMap);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "persona_id and simulation_group_id are required",
          });
        }
        break;
      case "POST /instructor/update_voice_settings":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.instructor_voice_enabled
        ) {
          const { simulation_group_id, instructor_voice_enabled } =
            event.queryStringParameters;

          try {
            // Update the instructor voice setting
            const result = await sqlConnection`
              UPDATE "simulation_groups"
              SET instructor_voice_enabled = ${instructor_voice_enabled === "true"}
              WHERE simulation_group_id = ${simulation_group_id}
              RETURNING *;
            `;

            if (result.length > 0) {
              response.statusCode = 200;
              response.body = JSON.stringify({
                message: "Voice settings updated successfully",
                instructor_voice_enabled: result[0].instructor_voice_enabled,
              });
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Simulation group not found",
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
            error:
              "simulation_group_id and instructor_voice_enabled are required",
          });
        }
        break;
      case "POST /instructor/create_simulation_group":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.instructor_email &&
          event.body
        ) {
          const { instructor_email } = event.queryStringParameters;
          const { group_name, group_description, group_student_access, instructor_voice_enabled } = JSON.parse(event.body);

          if (!group_name) {
            response.statusCode = 400;
            response.body = JSON.stringify({ error: "group_name is required" });
            break;
          }

          try {
            // Get the instructor's user_id
            const userResult = await sqlConnection`
              SELECT user_id FROM "users" WHERE user_email = ${instructor_email} LIMIT 1;
            `;

            if (userResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Instructor not found" });
              break;
            }

            const userId = userResult[0].user_id;
            const accessCode = generateAccessCode();

            // Insert new simulation group
            const newGroup = await sqlConnection`
              INSERT INTO "simulation_groups" (
                simulation_group_id,
                group_name,
                group_description,
                group_access_code,
                group_student_access,
                created_by,
                instructor_voice_enabled
              )
              VALUES (
                uuid_generate_v4(),
                ${group_name},
                ${group_description || null},
                ${accessCode},
                ${group_student_access !== undefined ? group_student_access : true},
                ${userId},
                ${instructor_voice_enabled !== undefined ? instructor_voice_enabled : true}
              )
              RETURNING *;
            `;

            // Enroll the instructor in the new group
            await sqlConnection`
              INSERT INTO "enrollments" (
                enrollment_id,
                user_id,
                simulation_group_id,
                enrollment_type
              )
              VALUES (
                uuid_generate_v4(),
                ${userId},
                ${newGroup[0].simulation_group_id},
                'instructor'
              );
            `;

            response.statusCode = 201;
            response.body = JSON.stringify(newGroup[0]);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "instructor_email query parameter and request body are required" });
        }
        break;
      case "GET /instructor/question_bank":
        try {
          const data = await sqlConnection`
            SELECT * FROM "question_bank" ORDER BY created_at DESC;
          `;
          response.statusCode = 200;
          response.body = JSON.stringify(data);
        } catch (err) {
          response.statusCode = 500;
          console.error(err);
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;
      case "PUT /instructor/question_bank":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.question_id &&
          event.body
        ) {
          try {
            const { question_id } = event.queryStringParameters;
            const { title, question_text, evaluation_criteria, is_mandatory } = JSON.parse(event.body);

            const updated = await sqlConnection`
              UPDATE "question_bank"
              SET
                title = COALESCE(${title || null}, title),
                question_text = COALESCE(${question_text || null}, question_text),
                evaluation_criteria = COALESCE(${evaluation_criteria || null}, evaluation_criteria),
                is_mandatory = COALESCE(${is_mandatory !== undefined ? is_mandatory : null}, is_mandatory)
              WHERE question_id = ${question_id}
              RETURNING *;
            `;

            if (updated.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Question not found" });
            } else {
              response.body = JSON.stringify(updated[0]);
            }
          } catch (err) {
            response.statusCode = 500;
            logger.error("Failed to update question", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "question_id and request body are required" });
        }
        break;
      case "GET /instructor/simulation_group_questions":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id
        ) {
          const { simulation_group_id } = event.queryStringParameters;
          const persona_id = event.queryStringParameters.persona_id || null;

          try {
            let data;
            if (persona_id) {
              data = await sqlConnection`
                SELECT sgq.*, qb.title, qb.question_text, qb.evaluation_criteria, qb.category, qb.is_mandatory
                FROM "simulation_group_questions" sgq
                JOIN "question_bank" qb ON sgq.question_id = qb.question_id
                WHERE sgq.simulation_group_id = ${simulation_group_id}
                  AND sgq.persona_id = ${persona_id}
                ORDER BY sgq."order" ASC;
              `;
            } else {
              data = await sqlConnection`
                SELECT sgq.*, qb.title, qb.question_text, qb.evaluation_criteria, qb.category, qb.is_mandatory
                FROM "simulation_group_questions" sgq
                JOIN "question_bank" qb ON sgq.question_id = qb.question_id
                WHERE sgq.simulation_group_id = ${simulation_group_id}
                ORDER BY sgq."order" ASC;
              `;
            }
            response.statusCode = 200;
            response.body = JSON.stringify(data);
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "simulation_group_id is required",
          });
        }
        break;
      case "POST /instructor/simulation_group_questions":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id &&
          event.body
        ) {
          const { simulation_group_id } = event.queryStringParameters;
          const body = JSON.parse(event.body);

          // Support both: question_id as a single string OR as an array of strings
          const rawId = body.question_id;
          const questionIds = Array.isArray(rawId) ? rawId : (rawId ? [rawId] : []);
          const persona_id = body.persona_id || null;

          if (questionIds.length === 0) {
            response.statusCode = 400;
            response.body = JSON.stringify({ error: "question_id or question_ids is required in request body" });
            break;
          }

          try {
            // Resolve the instructor's user_id for added_by
            const userResult = await sqlConnection`
              SELECT user_id FROM "users" WHERE user_email = ${userEmailAttribute} LIMIT 1;
            `;
            const addedBy = userResult.length > 0 ? userResult[0].user_id : null;

            const results = [];
            for (const qId of questionIds) {
              const data = await sqlConnection`
                INSERT INTO "simulation_group_questions" (
                  group_question_id,
                  simulation_group_id,
                  question_id,
                  persona_id,
                  weight_override,
                  max_score_override,
                  "order",
                  added_by,
                  added_at
                )
                VALUES (
                  uuid_generate_v4(),
                  ${simulation_group_id},
                  ${qId},
                  ${persona_id},
                  ${body.weight_override ?? null},
                  ${body.max_score_override ?? null},
                  ${body.order ?? 0},
                  ${addedBy},
                  CURRENT_TIMESTAMP
                )
                RETURNING *;
              `;
              results.push(data[0]);
            }

            response.statusCode = 201;
            // Return single object for single insert, array for batch
            response.body = JSON.stringify(results.length === 1 ? results[0] : results);
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error:
              "simulation_group_id query parameter and request body with question_id(s) are required",
          });
        }
        break;
      case "DELETE /instructor/simulation_group_questions":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.group_question_id
        ) {
          const { group_question_id } =
            event.queryStringParameters;

          try {
            const existing = await sqlConnection`
              SELECT group_question_id FROM "simulation_group_questions"
              WHERE group_question_id = ${group_question_id};
            `;

            if (existing.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Assignment not found",
              });
              break;
            }

            await sqlConnection`
              DELETE FROM "simulation_group_questions"
              WHERE group_question_id = ${group_question_id};
            `;

            response.statusCode = 200;
            response.body = JSON.stringify({
              message: "Question unassigned successfully",
            });
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "group_question_id is required",
          });
        }
        break;
      case "PUT /instructor/simulation_group_questions":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.group_question_id
        ) {
          const { group_question_id } =
            event.queryStringParameters;
          const body = event.body ? JSON.parse(event.body) : {};

          try {
            const existing = await sqlConnection`
              SELECT group_question_id FROM "simulation_group_questions"
              WHERE group_question_id = ${group_question_id};
            `;

            if (existing.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Assignment not found",
              });
              break;
            }

            const data = await sqlConnection`
              UPDATE "simulation_group_questions"
              SET
                weight_override = COALESCE(${body.weight_override ?? null}, weight_override),
                max_score_override = COALESCE(${body.max_score_override ?? null}, max_score_override),
                "order" = COALESCE(${body.order ?? null}, "order")
              WHERE group_question_id = ${group_question_id}
              RETURNING *;
            `;

            response.statusCode = 200;
            response.body = JSON.stringify(data[0]);
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "group_question_id is required",
          });
        }
        break;
      case "GET /instructor/question_interactions":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id
        ) {
          const { simulation_group_id } = event.queryStringParameters;
          const persona_id = event.queryStringParameters.persona_id || null;
          const student_email = event.queryStringParameters.student_email || null;

          try {
            let data;
            if (persona_id && student_email) {
              data = await sqlConnection`
                SELECT qi.*
                FROM "question_interactions" qi
                JOIN "users" u ON qi.student_id = u.user_id
                WHERE qi.simulation_group_id = ${simulation_group_id}
                  AND qi.persona_id = ${persona_id}
                  AND u.user_email = ${student_email}
                ORDER BY qi.created_at DESC;
              `;
            } else if (persona_id) {
              data = await sqlConnection`
                SELECT qi.*
                FROM "question_interactions" qi
                WHERE qi.simulation_group_id = ${simulation_group_id}
                  AND qi.persona_id = ${persona_id}
                ORDER BY qi.created_at DESC;
              `;
            } else {
              data = await sqlConnection`
                SELECT qi.*
                FROM "question_interactions" qi
                WHERE qi.simulation_group_id = ${simulation_group_id}
                ORDER BY qi.created_at DESC;
              `;
            }
            response.statusCode = 200;
            response.body = JSON.stringify(data);
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "simulation_group_id is required",
          });
        }
        break;
      case "GET /instructor/key_question_coverage":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id
        ) {
          const simulation_group_id = event.queryStringParameters.simulation_group_id;
          try {
            const data = await sqlConnection`
              SELECT
                p.persona_id,
                p.persona_name,
                AVG(
                  CASE WHEN d.total_questions_assigned > 0
                    THEN d.total_questions_asked * 100.0 / d.total_questions_assigned
                    ELSE 0
                  END
                ) AS avg_coverage,
                COUNT(DISTINCT d.student_id) AS students_debriefed
              FROM "personas" p
              LEFT JOIN "debriefs" d
                ON p.persona_id = d.persona_id
                AND d.simulation_group_id = ${simulation_group_id}
              WHERE p.simulation_group_id = ${simulation_group_id}
              GROUP BY p.persona_id, p.persona_name, p.persona_number
              ORDER BY p.persona_number ASC, p.persona_name ASC;
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
          response.body = JSON.stringify({
            error: "simulation_group_id is required",
          });
        }
        break;
      case "GET /instructor/patient_key_question_analytics":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.persona_id
        ) {
          const simulation_group_id = event.queryStringParameters.simulation_group_id;
          const persona_id = event.queryStringParameters.persona_id;
          try {
            const data = await sqlConnection`
              SELECT
                qb.question_id,
                COALESCE(qb.title, qb.question_text) AS question_title,
                COUNT(DISTINCT d.student_id) AS students_answered
              FROM "simulation_group_questions" sgq
              JOIN "question_bank" qb ON sgq.question_id = qb.question_id
              LEFT JOIN "debriefs" d
                ON d.simulation_group_id = ${simulation_group_id}
                AND d.persona_id = ${persona_id}
                AND d.generated_text IS NOT NULL
                AND jsonb_typeof(d.generated_text::jsonb -> 'questions_addressed') = 'array'
                AND EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(
                    d.generated_text::jsonb -> 'questions_addressed'
                  ) AS score_element
                  WHERE (score_element->>'question_id')::uuid = qb.question_id
                )
              WHERE sgq.simulation_group_id = ${simulation_group_id}
                AND COALESCE(sgq.persona_id, ${persona_id}) = ${persona_id}
              GROUP BY qb.question_id, qb.title, qb.question_text
              ORDER BY students_answered DESC;
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
          response.body = JSON.stringify({
            error: "simulation_group_id and persona_id are required",
          });
        }
        break;
      case "GET /instructor/student_progress":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.persona_id
        ) {
          const { simulation_group_id, persona_id } = event.queryStringParameters;
          try {
            const progressData = await sqlConnection`
              SELECT 
                u.user_id, 
                u.first_name || ' ' || u.last_name AS student_name,
                si.is_completed,
                si.student_interaction_id,
                COUNT(c.chat_id) AS chat_count
              FROM "enrollments" e
              JOIN "users" u ON e.user_id = u.user_id
              LEFT JOIN "student_interactions" si 
                ON e.enrollment_id = si.enrollment_id 
                AND si.persona_id = ${persona_id}
              LEFT JOIN "chats" c
                ON c.student_interaction_id = si.student_interaction_id
              WHERE e.simulation_group_id = ${simulation_group_id}
              AND e.enrollment_type = 'student'
              GROUP BY u.user_id, u.first_name, u.last_name, si.is_completed, si.student_interaction_id
              ORDER BY u.first_name, u.last_name;
            `;

            const result = [
              { status: 'Not Started', count: 0, students: [], fill: '#94a3b8' },
              { status: 'In Progress', count: 0, students: [], fill: '#f59e0b' },
              { status: 'Debrief Reached', count: 0, students: [], fill: '#22c55e' }
            ];

            for (const row of progressData) {
              const studentObj = { id: row.user_id, name: row.student_name };

              if (Number(row.chat_count) === 0) {
                // student_interaction exists (created at enrollment) but no chats ever opened
                result[0].students.push(studentObj);
                result[0].count++;
              } else if (row.is_completed === true) {
                // conclude_interaction was called — student reached debrief
                result[2].students.push(studentObj);
                result[2].count++;
              } else {
                // has chats but conclude_interaction never called
                result[1].students.push(studentObj);
                result[1].count++;
              }
            }

            response.statusCode = 200;
            response.body = JSON.stringify(result);
          } catch (err) {
            logger.error("Failed to fetch student progress", { error: err.message, stack: err.stack });
            response.statusCode = 500;
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "simulation_group_id and persona_id are required" });
        }
        break;
      case "GET /instructor/get_debrief":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.session_id &&
          event.queryStringParameters.simulation_group_id
        ) {
          const sessionId = event.queryStringParameters.session_id;
          const simulationGroupId = event.queryStringParameters.simulation_group_id;

          try {
            // 1) Authorize via source-of-truth join:
            // chats -> student_interactions -> personas (personas carries simulation_group_id)
            const accessCheck = await sqlConnection`
              SELECT c.chat_id
              FROM "chats" c
              JOIN "student_interactions" si
                ON c.student_interaction_id = si.student_interaction_id
              JOIN "personas" p
                ON si.persona_id = p.persona_id
              WHERE c.chat_id = ${sessionId}
                AND p.simulation_group_id = ${simulationGroupId}
              LIMIT 1;
            `;

            if (accessCheck.length === 0) {
              // Using 404 to align with "not found" semantics and avoid leaking info
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Chat not found in this simulation group.",
              });
              break;
            }

            // 2) Fetch debrief with retry/backoff (mirrors student endpoint robustness)
            const maxRetries = 6;
            const baseDelayMs = 300;
            let debriefData = [];

            for (let attempt = 0; attempt < maxRetries; attempt++) {
              debriefData = await sqlConnection`
                SELECT generated_text
                FROM "debriefs"
                WHERE chat_id = ${sessionId}
                ORDER BY created_at DESC
                LIMIT 1;
              `;

              if (debriefData.length > 0) break;

              const delay = baseDelayMs * Math.pow(2, attempt);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }

            if (debriefData.length > 0) {
              let parsedDebrief = debriefData[0].generated_text;

              // Keep existing parsing behavior
              if (typeof parsedDebrief === "string") {
                try {
                  parsedDebrief = JSON.parse(parsedDebrief);
                } catch (parseErr) {
                  logger.error("Failed to parse debrief JSON from DB", {
                    error: parseErr.message,
                    raw: parsedDebrief.substring(0, 200),
                  });
                }
              }

              response.statusCode = 200;
              response.body = JSON.stringify({
                generated_text: parsedDebrief,
                status: "complete",
              });
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Debrief not available for this chat.",
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
            error: "session_id and simulation_group_id are required",
          });
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
