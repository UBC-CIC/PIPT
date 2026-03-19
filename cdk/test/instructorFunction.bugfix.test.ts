/**
 * Bug Condition Exploration Test for Instructor Function Database Refactor
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
 * 
 * This test encodes the EXPECTED behavior after the fix is implemented.
 * It MUST FAIL on unfixed code to confirm the bugs exist.
 * 
 * Expected failures on unfixed code:
 * - Code references patient_id instead of persona_id
 * - Code references sessions table instead of chats table
 * - Code references session_id instead of chat_id
 * - Code references session_name instead of chat_name
 */

import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

describe('Bug Condition Exploration: Database Operations Use Correct Schema Names', () => {
  let instructorFunctionCode: string;

  beforeAll(() => {
    // Read the instructor function source code
    const filePath = path.join(__dirname, '../lambda/lib/instructorFunction.js');
    instructorFunctionCode = fs.readFileSync(filePath, 'utf-8');
  });

  /**
   * Property 1: Bug Condition - Database Operations Use Correct Schema Names
   * 
   * This property tests that the code uses correct schema names by analyzing the source code.
   * On UNFIXED code, this test will FAIL because the code contains references to:
   * - patient_id (should be persona_id)
   * - sessions table (should be chats table)
   * - session_id (should be chat_id)
   * - session_name (should be chat_name)
   */
  describe('Property 1: Code uses correct database schema names', () => {
    
    test('POST /instructor/create_patient endpoint - uses persona_id in user_engagement_log insertion', () => {
      // Find the create_patient endpoint
      const createPatientMatch = instructorFunctionCode.match(
        /case "POST \/instructor\/create_patient":([\s\S]*?)break;/
      );
      
      expect(createPatientMatch).toBeTruthy();
      const createPatientCode = createPatientMatch![1];
      
      // Bug 1: Uses patient_id in field access on query results
      // EXPECTED: Should use persona_id to access the returned field
      // On unfixed code: newPatient[0].patient_id
      // After fix: newPatient[0].persona_id
      const fieldAccessPattern = /newPatient\[0\]\.(\w+)/g;
      const fieldAccesses = Array.from(createPatientCode.matchAll(fieldAccessPattern));
      
      for (const match of fieldAccesses) {
        const fieldName = match[1];
        // EXPECTED: Should use persona_id, not patient_id
        expect(fieldName).not.toBe('patient_id');
        if (fieldName !== 'persona_name' && fieldName !== 'persona_number') {
          expect(fieldName).toBe('persona_id');
        }
      }
      
      // Bug 2: Uses patient_id column name in INSERT statement
      // EXPECTED: Should use persona_id column in user_engagement_log INSERT
      const engagementLogInsert = createPatientCode.match(
        /INSERT INTO "user_engagement_log"[\s\S]*?VALUES/
      );
      
      if (engagementLogInsert) {
        const insertStatement = engagementLogInsert[0];
        // EXPECTED: Should reference persona_id column, not patient_id
        expect(insertStatement).toContain('persona_id');
        expect(insertStatement).not.toContain('patient_id');
      }
    });

    test('GET /instructor/analytics endpoint - queries chats table and uses persona_id for data matching', () => {
      // Find the analytics endpoint
      const analyticsMatch = instructorFunctionCode.match(
        /case "GET \/instructor\/analytics":([\s\S]*?)break;/
      );
      
      expect(analyticsMatch).toBeTruthy();
      const analyticsCode = analyticsMatch![1];
      
      // Bug 3: Queries sessions table instead of chats
      // EXPECTED: Should query chats table, not sessions
      expect(analyticsCode).not.toContain('FROM "sessions"');
      expect(analyticsCode).not.toContain('JOIN "sessions"');
      
      // Bug 4: Uses patient_id for data matching
      // EXPECTED: Should use persona_id for find operations
      const findPattern = /(\w+)\.patient_id\s*===\s*(\w+)\.patient_id/g;
      const findMatches = Array.from(analyticsCode.matchAll(findPattern));
      
      // EXPECTED: Should not have any patient_id comparisons
      expect(findMatches.length).toBe(0);
      
      // Bug 5: Response object construction uses patient_id
      // EXPECTED: Response should use persona_id
      const responsePattern = /patient_id:\s*(\w+)\.patient_id/;
      const responseMatch = analyticsCode.match(responsePattern);
      
      // EXPECTED: Should not construct response with patient_id
      expect(responseMatch).toBeNull();
    });

    test('GET /instructor/view_student_messages endpoint - joins chats table', () => {
      // Find the view_student_messages endpoint (use greedy match up to next case to capture full endpoint)
      const messagesMatch = instructorFunctionCode.match(
        /case "GET \/instructor\/view_student_messages":([\s\S]*?)(?=case ")/
      );
      
      expect(messagesMatch).toBeTruthy();
      const messagesCode = messagesMatch![1];
      
      // Bug 6: Joins sessions table instead of chats
      // EXPECTED: Should join chats table, not sessions
      expect(messagesCode).not.toContain('JOIN "sessions"');
      expect(messagesCode).toContain('JOIN "chats"');
    });

    test('PUT /instructor/update_metadata endpoint - uses persona_id variable', () => {
      // Find the update_metadata endpoint
      const metadataMatch = instructorFunctionCode.match(
        /case "PUT \/instructor\/update_metadata":([\s\S]*?)break;/
      );
      
      expect(metadataMatch).toBeTruthy();
      const metadataCode = metadataMatch![1];
      
      // Bug 7: Uses patient_id variable name
      // EXPECTED: Should use persona_id variable consistently
      const varDeclaration = /const\s+patient_id\s*=/;
      
      // EXPECTED: Should not declare patient_id variable
      expect(varDeclaration.test(metadataCode)).toBe(false);
    });

    test('GET /instructor/ingestion_status endpoint - uses persona_id consistently', () => {
      // Find the ingestion_status endpoint
      const ingestionMatch = instructorFunctionCode.match(
        /case "GET \/instructor\/ingestion_status":([\s\S]*?)break;/
      );
      
      expect(ingestionMatch).toBeTruthy();
      const ingestionCode = ingestionMatch![1];
      
      // Bug 8: Destructures persona_id but uses patient_id in query
      // EXPECTED: Should use persona_id consistently throughout
      
      // Check if patient_id is used in the query
      const patientIdUsage = /\$\{patient_id\}/g;
      const usages = Array.from(ingestionCode.matchAll(patientIdUsage));
      
      // EXPECTED: Should not use patient_id variable in queries
      expect(usages.length).toBe(0);
    });

    test('GET /instructor/student_patients_messages endpoint - queries chats table', () => {
      // Find the student_patients_messages endpoint (use greedy match up to next case to capture full endpoint)
      const studentPatientsMatch = instructorFunctionCode.match(
        /case "GET \/instructor\/student_patients_messages":([\s\S]*?)(?=case ")/
      );
      
      expect(studentPatientsMatch).toBeTruthy();
      const studentPatientsCode = studentPatientsMatch![1];
      
      // Bug 9: Queries sessions table instead of chats
      // EXPECTED: Should query chats table, not sessions
      expect(studentPatientsCode).not.toContain('FROM "sessions"');
      expect(studentPatientsCode).toContain('FROM "chats"');
      
      // Bug 10: Uses session_id and session_name instead of chat_id and chat_name
      // EXPECTED: Should use chat_id and chat_name
      expect(studentPatientsCode).not.toContain('session_id');
      expect(studentPatientsCode).not.toContain('session_name');
      expect(studentPatientsCode).not.toContain('sessionName');
    });

    test('PUT /instructor/reorder_patient endpoint - uses persona_id consistently', () => {
      // Find the reorder_patient endpoint
      const reorderMatch = instructorFunctionCode.match(
        /case "PUT \/instructor\/reorder_patient":([\s\S]*?)break;/
      );
      
      expect(reorderMatch).toBeTruthy();
      const reorderCode = reorderMatch![1];
      
      // Bug 11: Uses patient_id in query instead of persona_id
      // EXPECTED: Should use persona_id consistently
      const patientIdInQuery = /WHERE persona_id = \$\{patient_id\}/;
      
      // EXPECTED: Should not use patient_id variable in WHERE clause
      expect(patientIdInQuery.test(reorderCode)).toBe(false);
      
      // EXPECTED: Should use persona_id column in user_engagement_log
      const engagementLogPattern = /INSERT INTO "user_engagement_log"[\s\S]*?VALUES/;
      const engagementMatch = reorderCode.match(engagementLogPattern);
      
      if (engagementMatch) {
        const insertStatement = engagementMatch[0];
        expect(insertStatement).toContain('persona_id');
        expect(insertStatement).not.toContain('patient_id');
      }
    });

    test('PUT /instructor/edit_patient endpoint - uses persona_id in user_engagement_log', () => {
      // Find the edit_patient endpoint
      const editMatch = instructorFunctionCode.match(
        /case "PUT \/instructor\/edit_patient":([\s\S]*?)break;/
      );
      
      expect(editMatch).toBeTruthy();
      const editCode = editMatch![1];
      
      // Bug 12: Uses patient_id in user_engagement_log INSERT
      // EXPECTED: Should use persona_id column
      const engagementLogPattern = /INSERT INTO "user_engagement_log"[\s\S]*?VALUES/;
      const engagementMatch = editCode.match(engagementLogPattern);
      
      if (engagementMatch) {
        const insertStatement = engagementMatch[0];
        expect(insertStatement).toContain('persona_id');
        expect(insertStatement).not.toContain('patient_id');
      }
    });

    test('PUT /instructor/toggle_llm_completion endpoint - uses persona_id parameter', () => {
      // Find the toggle_llm_completion endpoint
      const toggleMatch = instructorFunctionCode.match(
        /case "PUT \/instructor\/toggle_llm_completion":([\s\S]*?)break;/
      );
      
      expect(toggleMatch).toBeTruthy();
      const toggleCode = toggleMatch![1];
      
      // Bug 13: Destructures patient_id from query parameters
      // EXPECTED: Should destructure persona_id (or use patient_id but reference persona_id in queries)
      const destructurePattern = /const\s*\{\s*patient_id\s*\}\s*=\s*event\.queryStringParameters/;
      
      // Check if patient_id is destructured
      const hasPatientIdDestructure = destructurePattern.test(toggleCode);
      
      if (hasPatientIdDestructure) {
        // If patient_id is destructured, it should be used correctly in queries
        // The query should reference persona_id column in the database
        const selectQuery = /SELECT.*FROM "personas" WHERE persona_id = \$\{patient_id\}/;
        const updateQuery = /UPDATE "personas".*WHERE persona_id = \$\{patient_id\}/;
        
        // EXPECTED: Queries should use persona_id column (even if variable is named patient_id)
        expect(selectQuery.test(toggleCode) || updateQuery.test(toggleCode)).toBe(true);
      }
    });
  });

  /**
   * Property-Based Test: Verify no patient_id or sessions references exist in buggy endpoints
   * 
   * This uses fast-check to generate test cases and verify the property holds
   */
  describe('Property-Based: No legacy naming in database operations', () => {
    test('All buggy endpoints should use correct schema names', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'POST /instructor/create_patient',
            'GET /instructor/analytics',
            'GET /instructor/view_student_messages',
            'PUT /instructor/update_metadata',
            'GET /instructor/ingestion_status',
            'GET /instructor/student_patients_messages',
            'PUT /instructor/reorder_patient',
            'PUT /instructor/edit_patient',
            'PUT /instructor/toggle_llm_completion'
          ),
          (endpoint) => {
            // Extract endpoint code
            const endpointPattern = new RegExp(
              `case "${endpoint.replace(/\//g, '\\/')}":[\\s\\S]*?break;`
            );
            const match = instructorFunctionCode.match(endpointPattern);
            
            if (!match) {
              return true; // Skip if endpoint not found
            }
            
            const endpointCode = match[0];
            
            // Property: Code should not reference sessions table
            const hasSessionsTable = /FROM "sessions"|JOIN "sessions"/.test(endpointCode);
            
            // Property: Code should not use session_id or session_name in response objects
            const hasSessionFields = /sessionName:|session_name:|session_id:/.test(endpointCode);
            
            // Property: user_engagement_log INSERTs should use persona_id column
            const engagementLogPattern = /INSERT INTO "user_engagement_log"[\s\S]*?VALUES/;
            const engagementMatch = endpointCode.match(engagementLogPattern);
            let hasCorrectEngagementLog = true;
            
            if (engagementMatch) {
              const insertStatement = engagementMatch[0];
              // Should have persona_id, not patient_id
              hasCorrectEngagementLog = insertStatement.includes('persona_id') && 
                                       !insertStatement.includes('patient_id');
            }
            
            // All properties must hold
            return !hasSessionsTable && !hasSessionFields && hasCorrectEngagementLog;
          }
        ),
        { numRuns: 9 } // Run once for each endpoint
      );
    });
  });
});
