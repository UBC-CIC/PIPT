const { initializeConnection } = require("./libadmin.js");
const logger = require("./logger");

let { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT } = process.env;

// SQL conneciton from global variable at libadmin.js
let sqlConnectionTableCreator = global.sqlConnectionTableCreator;

exports.handler = async (event, context) => {
  logger.init(event, context);
  logger.info("Admin handler invoked", { queryStringParameters: event.queryStringParameters });

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
  if (!sqlConnectionTableCreator) {
    logger.info("Initializing database connection");
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
    sqlConnectionTableCreator = global.sqlConnectionTableCreator;
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
      case "GET /admin/instructors":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.instructor_email
        ) {
          const { instructor_email } = event.queryStringParameters;

          // SQL query to fetch all users who are instructors
          const instructors = await sqlConnectionTableCreator`
                SELECT user_email, first_name, last_name
                FROM "users"
                WHERE roles @> ARRAY['instructor']::varchar[]
                ORDER BY last_name ASC;
              `;

          response.body = JSON.stringify(instructors);
        } else {
          response.statusCode = 400;
          response.body = "instructor_email is required";
          logger.warn("Missing instructor_email parameter");
        }
        break;
      case "GET /admin/simulation_groups":
        try {
          const orgId = event.queryStringParameters?.organization_id || null;
          // Query simulation groups with student, instructor, and persona counts
          // Optionally filtered by organization_id
          const simulationGroups = await sqlConnectionTableCreator`
                    SELECT sg.*,
                      COALESCE(pc.persona_count, 0)::int AS persona_count,
                      COALESCE(sc.student_count, 0)::int AS student_count,
                      COALESCE(ic.instructor_count, 0)::int AS instructor_count
                    FROM "simulation_groups" sg
                    LEFT JOIN (
                      SELECT simulation_group_id, COUNT(*) AS persona_count
                      FROM "personas"
                      GROUP BY simulation_group_id
                    ) pc ON pc.simulation_group_id = sg.simulation_group_id
                    LEFT JOIN (
                      SELECT simulation_group_id, COUNT(*) AS student_count
                      FROM "enrollments"
                      WHERE enrollment_type = 'student'
                      GROUP BY simulation_group_id
                    ) sc ON sc.simulation_group_id = sg.simulation_group_id
                    LEFT JOIN (
                      SELECT simulation_group_id, COUNT(*) AS instructor_count
                      FROM "enrollments"
                      WHERE enrollment_type = 'instructor'
                      GROUP BY simulation_group_id
                    ) ic ON ic.simulation_group_id = sg.simulation_group_id
                    WHERE (${orgId}::uuid IS NULL OR sg.organization_id = ${orgId}::uuid);
                `;

          logger.info("Fetched simulation groups", { count: simulationGroups.length });
          response.body = JSON.stringify(simulationGroups);
        } catch (err) {
          response.statusCode = 500;
          logger.error("Failed to fetch simulation groups", { error: err.message, stack: err.stack });
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;
      case "POST /admin/enroll_instructor":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.instructor_email
        ) {
          try {
            const { simulation_group_id, instructor_email } =
              event.queryStringParameters;

            // Retrieve user_id from users table based on the instructor email
            const userResult = await sqlConnectionTableCreator`
                  SELECT user_id
                  FROM "users"
                  WHERE user_email = ${instructor_email};
                `;

            const user_id = userResult[0]?.user_id;

            if (!user_id) {
              response.statusCode = 400;
              response.body = JSON.stringify({
                error: "Instructor email not found",
              });
              break;
            }

            // Insert enrollment into enrollments table with current timestamp for the 'instructor' role
            const enrollment = await sqlConnectionTableCreator`
                  INSERT INTO "enrollments" (enrollment_id, simulation_group_id, user_id, enrollment_type, time_enrolled)
                  VALUES (uuid_generate_v4(), ${simulation_group_id}, ${user_id}, 'instructor', CURRENT_TIMESTAMP)
                  ON CONFLICT (simulation_group_id, user_id) 
                  DO UPDATE SET 
                      enrollment_id = EXCLUDED.enrollment_id,
                      enrollment_type = EXCLUDED.enrollment_type,
                      time_enrolled = EXCLUDED.time_enrolled
                  RETURNING enrollment_id;
                `;

            const enrollment_id = enrollment[0]?.enrollment_id;

            if (enrollment_id) {
              // Retrieve all persona IDs associated with the simulation group
              const personasResult = await sqlConnectionTableCreator`
                    SELECT persona_id
                    FROM "personas"
                    WHERE simulation_group_id = ${simulation_group_id};
                  `;

              // Insert a record into student_interactions for each persona in the simulation group
              const studentInteractionInsertions = personasResult.map(
                (persona) => {
                  return sqlConnectionTableCreator`
                      INSERT INTO "student_interactions" (student_interaction_id, persona_id, enrollment_id, persona_score, last_accessed, persona_context_embedding, is_completed)
                      VALUES (uuid_generate_v4(), ${persona.persona_id}, ${enrollment_id}, 0, CURRENT_TIMESTAMP, NULL, FALSE);
                    `;
                }
              );

              // Execute all insertions
              await Promise.all(studentInteractionInsertions);
            }

            response.body = JSON.stringify({
              message: "Instructor enrolled and patients linked successfully.",
            });

            // Optionally insert into User Engagement Log (uncomment if needed)
            // await sqlConnectionTableCreator`
            //   INSERT INTO "user_engagement_log" (log_id, user_id, simulation_group_id, patient_id, enrolment_id, timestamp, engagement_type)
            //   VALUES (uuid_generate_v4(), ${user_id}, ${simulation_group_id}, null, ${enrolment_id}, CURRENT_TIMESTAMP, 'enrollment_created');
            // `;
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body =
            "simulation_group_id and instructor_email are required";
        }
        break;
      case "POST /admin/create_simulation_group":
        if (event.body) {
          try {
            const body = JSON.parse(event.body);
            const {
              group_name,
              group_description,
              group_student_access,
              system_prompt,
              organization_id,
              // admin_voice_enabled,      // uncomment after migration 005 runs
              // instructor_voice_enabled,  // uncomment after migration 005 runs
            } = body;

            if (!group_name || !group_description || group_student_access === undefined) {
              response.statusCode = 400;
              response.body = JSON.stringify({ error: "group_name, group_description, and group_student_access are required" });
              break;
            }

            logger.info("Simulation group creation start", { group_name, group_description });

            // Auto-generate access code server-side (XXXX-XXXX format)
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let group_access_code = "";
            for (let i = 0; i < 4; i++) group_access_code += chars.charAt(Math.floor(Math.random() * chars.length));
            group_access_code += "-";
            for (let i = 0; i < 4; i++) group_access_code += chars.charAt(Math.floor(Math.random() * chars.length));

            // Insert new simulation group into simulation_groups table
            // TODO: add admin_voice_enabled and instructor_voice_enabled after migration 005 runs
            const newSimulationGroup = await sqlConnectionTableCreator`
                  INSERT INTO "simulation_groups" (
                      simulation_group_id,
                      organization_id,
                      group_name,
                      group_description,
                      group_access_code,
                      group_student_access,
                      system_prompt
                  )
                  VALUES (
                      uuid_generate_v4(),
                      ${organization_id || null},
                      ${group_name},
                      ${group_description},
                      ${group_access_code},
                      ${typeof group_student_access === "string" ? group_student_access.toLowerCase() === "true" : !!group_student_access},
                      ${system_prompt || null}
                  )
                  RETURNING *;
              `;

            response.body = JSON.stringify(newSimulationGroup[0]);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = "Missing required parameters";
        }
        break;
      case "GET /admin/groupInstructors":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id
        ) {
          const { simulation_group_id } = event.queryStringParameters;

          // SQL query to fetch all instructors for a given group
          const instructors = await sqlConnectionTableCreator`
              SELECT u.user_email, u.first_name, u.last_name
              FROM "enrollments" e
              JOIN "users" u ON e.user_id = u.user_id
              WHERE e.simulation_group_id = ${simulation_group_id} AND e.enrollment_type = 'instructor';
            `;

          response.body = JSON.stringify(instructors);
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "simulation_group_id is required",
          });
        }
        break;
      case "GET /admin/instructorGroups":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.instructor_email
        ) {
          const { instructor_email } = event.queryStringParameters;

          // SQL query to fetch all groups for a given instructor
          const groups = await sqlConnectionTableCreator`
              SELECT g.simulation_group_id, g.group_name, g.group_description
              FROM "enrollments" e
              JOIN "simulation_groups" g ON e.simulation_group_id = g.simulation_group_id
              JOIN "users" u ON e.user_id = u.user_id
              WHERE u.user_email = ${instructor_email} AND e.enrollment_type = 'instructor';
            `;

          response.body = JSON.stringify(groups);
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "instructor_email is required",
          });
        }
        break;
      case "POST /admin/updateGroupAccess":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id &&
          event.queryStringParameters.access
        ) {
          const { simulation_group_id, access } = event.queryStringParameters;
          // const { admin_voice_enabled, instructor_voice_enabled } = event.queryStringParameters; // uncomment after migration 005 runs
          const accessBool = access.toLowerCase() === "true";

          // SQL query to update group access
          // TODO: add admin_voice_enabled and instructor_voice_enabled after migration 005 runs
          await sqlConnectionTableCreator`
                    UPDATE "simulation_groups"
                    SET group_student_access = ${accessBool}
                    WHERE simulation_group_id = ${simulation_group_id};
                  `;

          response.body = JSON.stringify({
            message: "Group settings updated successfully.",
          });
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error:
              "simulation_group_id and access query parameters are required",
          });
        }
        break;
      case "POST /admin/regenerate_access_code":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id
        ) {
          try {
            const { simulation_group_id } = event.queryStringParameters;

            // Generate a new random access code (8 chars, uppercase alphanumeric)
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let newCode = "";
            for (let i = 0; i < 4; i++) newCode += chars.charAt(Math.floor(Math.random() * chars.length));
            newCode += "-";
            for (let i = 0; i < 4; i++) newCode += chars.charAt(Math.floor(Math.random() * chars.length));

            const updated = await sqlConnectionTableCreator`
              UPDATE "simulation_groups"
              SET group_access_code = ${newCode}
              WHERE simulation_group_id = ${simulation_group_id}
              RETURNING group_access_code;
            `;

            if (updated.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Simulation group not found" });
            } else {
              response.body = JSON.stringify({ access_code: updated[0].group_access_code });
            }
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "simulation_group_id is required" });
        }
        break;
      case "DELETE /admin/delete_instructor_enrolments":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.instructor_email
        ) {
          try {
            const { instructor_email } = event.queryStringParameters;

            // Retrieve the user's ID
            const userResult = await sqlConnectionTableCreator`
                        SELECT user_id 
                        FROM "users"
                        WHERE user_email = ${instructor_email};
                    `;

            const userId = userResult[0]?.user_id;

            if (!userId) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Instructor not found" });
              return;
            }

            // Delete all enrollments for the instructor
            await sqlConnectionTableCreator`
                        DELETE FROM "enrollments"
                        WHERE user_id = ${userId} AND enrollment_type = 'instructor';
                    `;

            response.body = JSON.stringify({
              message: "Instructor enrolments deleted successfully.",
            });
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = "instructor_email query parameter is required";
        }
        break;
      case "DELETE /admin/delete_group_instructor_enrolments":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id
        ) {
          try {
            const { simulation_group_id } = event.queryStringParameters;

            // Delete all enrollments for the group where enrollment_type is 'instructor'
            await sqlConnectionTableCreator`
                      DELETE FROM "enrollments"
                      WHERE simulation_group_id = ${simulation_group_id} AND enrollment_type = 'instructor';
                  `;

            response.body = JSON.stringify({
              message: "Group instructor enrolments deleted successfully.",
            });
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = "simulation_group_id query parameter is required";
        }
        break;
      case "DELETE /admin/delete_group":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id
        ) {
          try {
            const { simulation_group_id } = event.queryStringParameters;

            // // Drop the table whose name is the simulation_group_id
            // await sqlConnectionTableCreator`
            //   DROP TABLE IF EXISTS ${sqlConnectionTableCreator(simulation_group_id)};
            // `;

            // Delete the group, related records will be automatically deleted due to cascading
            await sqlConnectionTableCreator`
                      DELETE FROM "simulation_groups"
                      WHERE simulation_group_id = ${simulation_group_id};
                  `;

            response.body = JSON.stringify({
              message: "Group and related records deleted successfully.",
            });
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = "simulation_group_id query parameter is required";
        }
        break;
      case "POST /admin/elevate_instructor":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.email
        ) {
          const instructorEmail = event.queryStringParameters.email;

          try {
            // Check if the user exists
            const existingUser = await sqlConnectionTableCreator`
                          SELECT * FROM "users"
                          WHERE user_email = ${instructorEmail};
                      `;

            if (existingUser.length > 0) {
              const userRoles = existingUser[0].roles;

              // Check if the role is already 'instructor' or 'admin'
              if (
                userRoles.includes("instructor") ||
                userRoles.includes("admin")
              ) {
                response.statusCode = 200;
                response.body = JSON.stringify({
                  message:
                    "No changes made. User is already an instructor or admin.",
                });
                break;
              }

              // If the role is 'student', elevate to 'instructor'
              if (userRoles.includes("student")) {
                const newRoles = userRoles.map((role) =>
                  role === "student" ? "instructor" : role
                );

                await sqlConnectionTableCreator`
                                UPDATE "users"
                                SET roles = ${newRoles}
                                WHERE user_email = ${instructorEmail};
                            `;

                response.statusCode = 200;
                response.body = JSON.stringify({
                  message: "User role updated to instructor.",
                });
                break;
              }
            } else {
              // Create a new user with the role 'instructor'
              await sqlConnectionTableCreator`
                              INSERT INTO "users" (user_email, roles)
                              VALUES (${instructorEmail}, ARRAY['instructor']);
                          `;

              response.statusCode = 201;
              response.body = JSON.stringify({
                message: "New user created and elevated to instructor.",
              });
            }
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Email is required" });
        }
        break;
      case "POST /admin/lower_instructor":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.email
        ) {
          try {
            const userEmail = event.queryStringParameters.email;

            // Fetch the roles for the user
            const userRoleData = await sqlConnectionTableCreator`
                    SELECT roles, user_id
                    FROM "users"
                    WHERE user_email = ${userEmail};
                  `;

            const userRoles = userRoleData[0]?.roles;
            const userId = userRoleData[0]?.user_id;

            if (!userRoles || !userRoles.includes("instructor")) {
              response.statusCode = 400;
              response.body = JSON.stringify({
                error: "User is not an instructor or doesn't exist",
              });
              break;
            }

            // Replace 'instructor' with 'student'
            const updatedRoles = userRoles
              .filter((role) => role !== "instructor")
              .concat("student");

            // Update the roles in the database
            await sqlConnectionTableCreator`
                    UPDATE "users"
                    SET roles = ${updatedRoles}
                    WHERE user_email = ${userEmail};
                  `;

            // Delete all enrollments where the enrollment type is instructor
            await sqlConnectionTableCreator`
                    DELETE FROM "enrollments"
                    WHERE user_id = ${userId} AND enrollment_type = 'instructor';
                  `;

            response.statusCode = 200;
            response.body = JSON.stringify({
              message: `User role updated to student for ${userEmail} and all instructor enrolments deleted.`,
            });
          } catch (err) {
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.statusCode = 500;
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "email query parameter is missing",
          });
        }
        break;
      case "GET /admin/system_prompts":
        try {
          // Get the latest system prompt from history table
          const latestPrompt = await sqlConnectionTableCreator`
            SELECT prompt_content, created_at
            FROM "system_prompt_history"
            ORDER BY created_at DESC
            LIMIT 1;
          `;

          // Get prompt history excluding the latest one
          const promptHistory = await sqlConnectionTableCreator`
            SELECT history_id, prompt_content, created_at
            FROM "system_prompt_history"
            ORDER BY created_at DESC
            OFFSET 1;
          `;

          response.body = JSON.stringify({
            current_prompt: latestPrompt[0]?.prompt_content || "",
            history: promptHistory,
          });
        } catch (err) {
          response.statusCode = 500;
          logger.error("Operation failed", { error: err.message, stack: err.stack });
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;
      case "POST /admin/update_system_prompt":
        if (event.body) {
          try {
            const { prompt_content } = JSON.parse(event.body);
            if (!prompt_content || !prompt_content.trim()) {
              response.statusCode = 400;
              response.body = "prompt_content is required";
              break;
            }

            // Insert new prompt into history (created_by removed)
            await sqlConnectionTableCreator`
              INSERT INTO "system_prompt_history" (prompt_content)
              VALUES (${prompt_content});
            `;

            response.body = JSON.stringify({
              message: "System prompt updated successfully",
            });
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = "prompt_content is required";
        }
        break;
      case "POST /admin/restore_system_prompt":
        try {
          // Prefer query param history_id; fallback to body with prompt_content for backward compatibility
          const historyId =
            event.queryStringParameters &&
            event.queryStringParameters.history_id
              ? event.queryStringParameters.history_id
              : null;

          if (historyId) {
            // Fetch the prompt_content for the given history_id and insert as new active prompt
            const rows = await sqlConnectionTableCreator`
              SELECT prompt_content
              FROM "system_prompt_history"
              WHERE history_id = ${historyId}
              LIMIT 1;
            `;

            const fromHistory = rows[0]?.prompt_content;
            if (!fromHistory) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "History entry not found",
              });
              break;
            }

            await sqlConnectionTableCreator`
              INSERT INTO "system_prompt_history" (prompt_content)
              VALUES (${fromHistory});
            `;

            response.body = JSON.stringify({
              message: "System prompt restored successfully",
            });
            break;
          }

          // Fallback: body-based restore (no created_by)
          if (event.body) {
            const { prompt_content } = JSON.parse(event.body);
            if (!prompt_content || !prompt_content.trim()) {
              response.statusCode = 400;
              response.body = "prompt_content is required";
              break;
            }

            await sqlConnectionTableCreator`
              INSERT INTO "system_prompt_history" (prompt_content)
              VALUES (${prompt_content});
            `;

            response.body = JSON.stringify({
              message: "System prompt restored successfully",
            });
          } else {
            response.statusCode = 400;
            response.body = "history_id or prompt_content is required";
          }
        } catch (err) {
          response.statusCode = 500;
          logger.error("Operation failed", { error: err.message, stack: err.stack });
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;
      case "POST /admin/update_user_token_limit":
        if (event.body) {
          try {
            const { user_email, token_limit } = JSON.parse(event.body);
            if (!user_email || !token_limit || token_limit < 1000) {
              response.statusCode = 400;
              response.body =
                "user_email and token_limit (min 1000) are required";
              break;
            }

            await sqlConnectionTableCreator`
              UPDATE "users"
              SET token_limit = ${token_limit}
              WHERE user_email = ${user_email};
            `;

            response.body = JSON.stringify({
              message: "User token limit updated successfully",
            });
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = "user_email and token_limit are required";
        }
        break;
      case "POST /admin/update_all_token_limits":
        if (event.body) {
          try {
            const { token_limit } = JSON.parse(event.body);
            if (!token_limit || token_limit < 1000) {
              response.statusCode = 400;
              response.body = "token_limit (min 1000) is required";
              break;
            }

            await sqlConnectionTableCreator`
              UPDATE "users"
              SET token_limit = ${token_limit};
            `;

            response.body = JSON.stringify({
              message: "All user token limits updated successfully",
            });
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = "token_limit is required";
        }
        break;
      case "GET /admin/empathy_prompts":
        try {
          // Get the latest empathy prompt from history table
          const latestPrompt = await sqlConnectionTableCreator`
            SELECT prompt_content, created_at
            FROM "empathy_prompt_history"
            ORDER BY created_at DESC
            LIMIT 1;
          `;

          // Get prompt history excluding the latest one
          const promptHistory = await sqlConnectionTableCreator`
            SELECT history_id, prompt_content, created_at
            FROM "empathy_prompt_history"
            ORDER BY created_at DESC
            OFFSET 1;
          `;

          response.body = JSON.stringify({
            current_prompt: latestPrompt[0]?.prompt_content || "",
            history: promptHistory,
          });
        } catch (err) {
          response.statusCode = 500;
          logger.error("Operation failed", { error: err.message, stack: err.stack });
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;
      case "POST /admin/update_empathy_prompt":
        if (event.body) {
          try {
            const { prompt_content } = JSON.parse(event.body);
            if (!prompt_content || !prompt_content.trim()) {
              response.statusCode = 400;
              response.body = "prompt_content is required";
              break;
            }

            // Insert new prompt into history
            await sqlConnectionTableCreator`
              INSERT INTO "empathy_prompt_history" (prompt_content)
              VALUES (${prompt_content});
            `;

            response.body = JSON.stringify({
              message: "Empathy prompt updated successfully",
            });
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = "prompt_content is required";
        }
        break;
      case "POST /admin/restore_empathy_prompt":
        try {
          const historyId =
            event.queryStringParameters &&
            event.queryStringParameters.history_id
              ? event.queryStringParameters.history_id
              : null;

          if (historyId) {
            // Fetch the prompt_content for the given history_id and insert as new active prompt
            const rows = await sqlConnectionTableCreator`
              SELECT prompt_content
              FROM "empathy_prompt_history"
              WHERE history_id = ${historyId}
              LIMIT 1;
            `;

            const fromHistory = rows[0]?.prompt_content;
            if (!fromHistory) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "History entry not found",
              });
              break;
            }

            await sqlConnectionTableCreator`
              INSERT INTO "empathy_prompt_history" (prompt_content)
              VALUES (${fromHistory});
            `;

            response.body = JSON.stringify({
              message: "Empathy prompt restored successfully",
            });
            break;
          }

          // Fallback: body-based restore
          if (event.body) {
            const { prompt_content } = JSON.parse(event.body);
            if (!prompt_content || !prompt_content.trim()) {
              response.statusCode = 400;
              response.body = "prompt_content is required";
              break;
            }

            await sqlConnectionTableCreator`
              INSERT INTO "empathy_prompt_history" (prompt_content)
              VALUES (${prompt_content});
            `;

            response.body = JSON.stringify({
              message: "Empathy prompt restored successfully",
            });
          } else {
            response.statusCode = 400;
            response.body = "history_id or prompt_content is required";
          }
        } catch (err) {
          response.statusCode = 500;
          logger.error("Operation failed", { error: err.message, stack: err.stack });
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;
      // ── Organization CRUD ──────────────────────────────────────────────
      case "GET /admin/organizations":
        try {
          const orgs = await sqlConnectionTableCreator`
            SELECT * FROM "organizations" ORDER BY created_at DESC;
          `;
          response.body = JSON.stringify(orgs);
        } catch (err) {
          response.statusCode = 500;
          logger.error("Operation failed", { error: err.message, stack: err.stack });
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;
      case "GET /admin/organization":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.organization_id
        ) {
          try {
            const { organization_id } = event.queryStringParameters;
            const org = await sqlConnectionTableCreator`
              SELECT * FROM "organizations"
              WHERE organization_id = ${organization_id};
            `;
            if (org.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Organization not found" });
            } else {
              response.body = JSON.stringify(org[0]);
            }
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "organization_id is required" });
        }
        break;
      case "POST /admin/create_organization":
        if (event.body) {
          try {
            const { name, description, type, ai_persona, user_role, icon_color, system_prompt } = JSON.parse(event.body);
            if (!name || !name.trim()) {
              response.statusCode = 400;
              response.body = JSON.stringify({ error: "name is required" });
              break;
            }
            const newOrg = await sqlConnectionTableCreator`
              INSERT INTO "organizations" (name, description, type, ai_persona, user_role, icon_color, system_prompt)
              VALUES (
                ${name},
                ${description || null},
                ${type || null},
                ${ai_persona || 'Patient'},
                ${user_role || 'Student'},
                ${icon_color || '#03045E'},
                ${system_prompt || null}
              )
              RETURNING *;
            `;
            response.statusCode = 201;
            response.body = JSON.stringify(newOrg[0]);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Request body is required" });
        }
        break;
      case "PUT /admin/update_organization":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.organization_id &&
          event.body
        ) {
          try {
            const { organization_id } = event.queryStringParameters;
            const { name, description, type, ai_persona, user_role, icon_color, system_prompt } = JSON.parse(event.body);

            const updated = await sqlConnectionTableCreator`
              UPDATE "organizations"
              SET
                name = COALESCE(${name || null}, name),
                description = COALESCE(${description || null}, description),
                type = COALESCE(${type || null}, type),
                ai_persona = COALESCE(${ai_persona || null}, ai_persona),
                user_role = COALESCE(${user_role || null}, user_role),
                icon_color = COALESCE(${icon_color || null}, icon_color),
                system_prompt = COALESCE(${system_prompt || null}, system_prompt)
              WHERE organization_id = ${organization_id}
              RETURNING *;
            `;

            if (updated.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Organization not found" });
            } else {
              response.body = JSON.stringify(updated[0]);
            }
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "organization_id and request body are required" });
        }
        break;
      case "DELETE /admin/delete_organization":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.organization_id
        ) {
          try {
            const { organization_id } = event.queryStringParameters;
            await sqlConnectionTableCreator`
              DELETE FROM "organizations"
              WHERE organization_id = ${organization_id};
            `;
            response.body = JSON.stringify({ message: "Organization deleted successfully." });
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "organization_id is required" });
        }
        break;
      // ── Question Bank CRUD ─────────────────────────────────────────────
      case "GET /admin/question_bank":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.organization_id
        ) {
          try {
            const { organization_id } = event.queryStringParameters;
            const questions = await sqlConnectionTableCreator`
              SELECT * FROM "question_bank"
              WHERE organization_id = ${organization_id}
              ORDER BY created_at DESC;
            `;
            response.body = JSON.stringify(questions);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Failed to fetch question bank", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "organization_id is required" });
        }
        break;
      case "POST /admin/question_bank":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.organization_id &&
          event.body
        ) {
          try {
            const { organization_id } = event.queryStringParameters;
            // Resolve created_by: look up user_id from users table using the authenticated email
            const authEmail = event.requestContext?.authorizer?.userEmail;
            if (!authEmail) {
              response.statusCode = 401;
              response.body = JSON.stringify({ error: "Unable to determine user identity" });
              break;
            }
            const userLookup = await sqlConnectionTableCreator`
              SELECT user_id FROM "users" WHERE user_email = ${authEmail} LIMIT 1;
            `;
            if (userLookup.length === 0) {
              response.statusCode = 400;
              response.body = JSON.stringify({ error: "Authenticated user not found in users table" });
              break;
            }
            const created_by = userLookup[0].user_id;
            const { title, question_text, evaluation_criteria, category, difficulty_level, is_mandatory, weight, max_score, tags } = JSON.parse(event.body);

            if (!title || !question_text || !evaluation_criteria) {
              response.statusCode = 400;
              response.body = JSON.stringify({ error: "title, question_text, and evaluation_criteria are required" });
              break;
            }

            const safeTags = Array.isArray(tags) ? tags : [];

            const newQuestion = await sqlConnectionTableCreator`
              INSERT INTO "question_bank" (
                organization_id, created_by, title, question_text, evaluation_criteria,
                category, difficulty_level, is_mandatory, weight, max_score, tags
              )
              VALUES (
                ${organization_id}, ${created_by}, ${title}, ${question_text}, ${evaluation_criteria},
                ${category || null}, ${difficulty_level || null},
                ${is_mandatory !== undefined ? is_mandatory : false},
                ${weight !== undefined ? weight : 1.0},
                ${max_score !== undefined ? max_score : 100},
                ${safeTags}
              )
              RETURNING *;
            `;

            response.statusCode = 201;
            response.body = JSON.stringify(newQuestion[0]);
          } catch (err) {
            response.statusCode = 500;
            logger.error("Failed to create question", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "organization_id and request body are required" });
        }
        break;
      case "PUT /admin/question_bank":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.question_id &&
          event.body
        ) {
          try {
            const { question_id } = event.queryStringParameters;
            const { title, question_text, evaluation_criteria, category, difficulty_level, is_mandatory, weight, max_score, tags } = JSON.parse(event.body);

            const updated = await sqlConnectionTableCreator`
              UPDATE "question_bank"
              SET
                title = COALESCE(${title || null}, title),
                question_text = COALESCE(${question_text || null}, question_text),
                evaluation_criteria = COALESCE(${evaluation_criteria || null}, evaluation_criteria),
                category = COALESCE(${category !== undefined ? category : null}, category),
                difficulty_level = COALESCE(${difficulty_level !== undefined ? difficulty_level : null}, difficulty_level),
                is_mandatory = COALESCE(${is_mandatory !== undefined ? is_mandatory : null}, is_mandatory),
                weight = COALESCE(${weight !== undefined ? weight : null}, weight),
                max_score = COALESCE(${max_score !== undefined ? max_score : null}, max_score),
                tags = COALESCE(${tags !== undefined ? tags : null}, tags)
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
      case "DELETE /admin/question_bank":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.question_id
        ) {
          try {
            const { question_id } = event.queryStringParameters;

            const updated = await sqlConnectionTableCreator`
              DELETE FROM "question_bank"
              WHERE question_id = ${question_id}
              RETURNING question_id;
            `;

            if (updated.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Question not found" });
            } else {
              response.body = JSON.stringify({ message: "Question deleted successfully." });
            }
          } catch (err) {
            response.statusCode = 500;
            logger.error("Failed to delete question", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "question_id is required" });
        }
        break;
      // ── Message Limit ────────────────────────────────────────────────
      case "POST /admin/update_group_message_limit":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.simulation_group_id &&
          event.body
        ) {
          try {
            const { simulation_group_id } = event.queryStringParameters;
            const { max_messages_per_chat } = JSON.parse(event.body);

            // null means unlimited; otherwise must be a positive integer
            if (max_messages_per_chat !== null && (!Number.isInteger(max_messages_per_chat) || max_messages_per_chat < 1)) {
              response.statusCode = 400;
              response.body = JSON.stringify({ error: "max_messages_per_chat must be a positive integer or null" });
              break;
            }

            const updated = await sqlConnectionTableCreator`
              UPDATE "simulation_groups"
              SET max_messages_per_chat = ${max_messages_per_chat}
              WHERE simulation_group_id = ${simulation_group_id}
              RETURNING simulation_group_id, max_messages_per_chat;
            `;

            if (updated.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Simulation group not found" });
            } else {
              response.body = JSON.stringify({
                message: "Message limit updated successfully",
                max_messages_per_chat: updated[0].max_messages_per_chat,
              });
            }
          } catch (err) {
            response.statusCode = 500;
            logger.error("Operation failed", { error: err.message, stack: err.stack });
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "simulation_group_id and request body are required" });
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