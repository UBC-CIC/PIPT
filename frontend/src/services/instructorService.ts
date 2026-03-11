/**
 * Instructor Service (Populated with Mock Data for now)
 * 
 * Provides hardcoded data for instructor views including simulation groups,
 * patient analytics, and access codes.
 * Designed for easy replacement with API Gateway URLs
 * 
 * DATABASE SCHEMA ALIGNMENT:
 * - Physical Assessment Materials: persona_media table (media_id, persona_id, media_type, url, title, description, created_at)
 * - Chat Attempts: chats table (chat_id, student_interaction_id, chat_name, chat_context_embeddings, last_accessed, notes)
 * - Chat Messages: messages table (message_id, chat_id, student_sent, message_content, time_sent, quality_score, quality_feedback, suggested_rewrite)
 * - Notes: chats.notes field (text field in chats table)
 * - Key Questions: key_questions table (question_id, rubric_id, question_text, category, order, weight, max_score)
 * - Student Interactions: Links students to personas via student_interaction table
 */

import { getSimulationGroupColor } from '@/lib/colors';
import { mockAdminDataService } from './adminService';

/**
 * Represents a simulation group from instructor perspective
 */
export interface InstructorSimulationGroup {
  id: string;              // Unique identifier
  name: string;            // Group name (e.g., "Pregnancy")
  subtitle: string;        // Always "Medical Simulation Group"
  iconUrl?: string;        // Optional icon image URL
  iconColor?: string;      // Fallback color for avatar (hex format)
  accessCode: string;      // Access code for students to join
  studentCount: number;    // Number of students in the group
  instructorCount?: number; // Number of instructors in the group
  patientCount: number;    // Number of patients in the group
  organizationId: string;  // Reference to parent organization
}

/**
 * Represents current user data
 */
export interface UserData {
  name: string;            // User's full name
  avatarUrl?: string;      // Optional profile picture URL
}

/**
 * Represents organization-specific labels for UI display
 */
export interface OrganizationLabels {
  aiPersona: string;              // Singular form (e.g., "Patient", "Law Client")
  aiPersonaPlural: string;        // Plural form (e.g., "Patients", "Law Clients")
  aiPersonaLower: string;         // Lowercase singular (e.g., "patient")
  aiPersonaPluralLower: string;   // Lowercase plural (e.g., "patients")
  userRole: string;               // Singular form (e.g., "Doctor", "Legal Advisor")
  userRolePlural: string;         // Plural form (e.g., "Doctors", "Legal Advisors")
  userRoleLower: string;          // Lowercase singular (e.g., "doctor")
  userRolePluralLower: string;    // Lowercase plural (e.g., "doctors")
}

/**
 * Represents a patient in a simulation group with analytics
 */
export interface PatientAnalytics {
  id: string;                           // Unique identifier
  name: string;                         // Patient name
  instructorCompletionPercentage: number; // 0-100
  llmCompletionPercentage: number;      // 0-100
  studentMessageCount: number;          // Number of messages from students
  aiMessageCount: number;               // Number of AI responses
  studentAccessCount: number;           // Number of times students accessed
}

/**
 * Represents message count data for charts
 */
export interface MessageCountData {
  name: string;                         // Label (e.g., "Messages")
  'Student Messages': number;           // Student message count
  'AI Messages': number;                // AI message count
}

/**
 * Represents key question analytics data for charts
 */
export interface KeyQuestionAnalytics {
  questionTitle: string;                // Title of the key question
  studentsAnswered: number;             // Number of students who answered
}

/**
 * Represents average quality score per key question
 */
export interface QuestionPerformanceScore {
  questionTitle: string;                // Title of the key question
  averageScore: number;                 // Average quality score (0-100)
  totalResponses: number;               // Total number of student responses
}

/**
 * Represents a bucket in a score distribution histogram
 */
export interface ScoreDistributionBucket {
  range: string;                        // Score range label (e.g., "0-20")
  count: number;                        // Number of students in this range
}

/**
 * Represents a patient for management (maps to personas table in DB)
 */
export interface ManageablePatient {
  id: string;                           // Unique identifier (persona_id in DB)
  simulation_group_id: string;          // Reference to simulation group (simulation_group_id in DB)
  name: string;                         // Patient name (persona_name in DB)
  age: number;                          // Patient age (persona_age in DB)
  gender: string;                       // Patient gender (persona_gender in DB)
  persona_number?: number;              // Patient number (persona_number in DB)
  prompt: string;                       // Patient prompt for LLM (persona_prompt in DB)
  average_wpm?: number;                 // Average words per minute (average_wpm in DB)
  voice_id?: string;                    // Voice ID for TTS (voice_id in DB)
  interaction_mode?: string;            // Interaction mode (interaction_mode in DB)
  llmEvaluationEnabled: boolean;        // Whether LLM evaluation is enabled (derived from settings)
  photoUrl?: string;                    // Optional patient photo URL (stored separately or in media)
}

/**
 * Represents a global rubric question (maps to key_questions table in DB)
 */
export interface GlobalRubricQuestion {
  id: string;                           // Unique identifier (question_id in DB)
  rubric_id?: string;                   // Reference to rubric (rubric_id in DB, null for global)
  title: string;                        // Question title (derived from question_text)
  keyQuestion: string;                  // The key question text (question_text in DB)
  clinicalIntent: string;               // Clinical intent description (stored in category or separate field)
  evaluationCriteria: string;           // Evaluation criteria (stored in separate field)
  required: boolean;                    // Whether required for case completion
  order?: number;                       // Display order (order field in DB)
  weight?: number;                      // Question weight (weight field in DB)
  max_score?: number;                   // Maximum score (max_score field in DB)
}

/**
 * Represents a case material (maps to persona_media table in DB)
 */
export interface CaseMaterial {
  id: string;                           // Unique identifier (media_id in DB)
  title: string;                        // Material title
  description: string;                  // Material description
  materialType: string;                 // Type: image, video, document, audio, other (media_type in DB)
  contentUrl?: string;                  // URL to uploaded content (url in DB)
  embedLink?: string;                   // H5P embed link (can be stored in url field)
}

/**
 * Represents a student in a simulation group
 */
export interface Student {
  id: string;                           // Unique identifier
  name: string;                         // Student name
  email: string;                        // Student email
}

/**
 * Represents student details with performance metrics
 */
export interface StudentDetails {
  id: string;                           // Unique identifier
  name: string;                         // Student name
  email: string;                        // Student email
  groupName: string;                    // Simulation group name
  casesAttempted: number;               // Number of cases attempted
  caseCompletionRate: number;           // Completion rate percentage (0-100)
}

/**
 * Represents a chat attempt for a patient (maps to chats table in DB)
 */
export interface ChatAttempt {
  id: string;                           // Unique identifier (chat_id in DB)
  student_interaction_id: string;       // Reference to student interaction (student_interaction_id in DB)
  attemptNumber: number;                // Attempt number (derived from ordering)
  date: string;                         // Date of attempt (derived from last_accessed in DB)
  completionStatus: 'In Progress' | 'Complete'; // Status (derived from completion state)
  score: number | null;                 // Score percentage (null if in progress)
  notes?: string;                       // Notes text (notes field in DB)
}

/**
 * Represents a chat message (maps to messages table in DB)
 */
export interface ChatMessage {
  message_id: string;                   // Unique identifier (message_id in DB)
  chat_id: string;                      // Reference to chat (chat_id in DB)
  student_sent: boolean;                // True if sent by student, false if AI
  message_content: string;              // Message text (message_content in DB)
  time_sent: string;                    // Timestamp (time_sent in DB)
  quality_score?: number;               // Optional quality score (quality_score in DB)
  quality_feedback?: string;            // Optional quality feedback (quality_feedback in DB)
  suggested_rewrite?: string;           // Optional suggested rewrite (suggested_rewrite in DB)
}

/**
 * Represents notes for a chat attempt (stored in chats.notes field in DB)
 */
export interface ChatNotes {
  attemptId: string;                    // Chat attempt ID (chat_id in DB)
  notes: string;                        // Notes text (notes field in chats table)
}

/**
 * Represents patient creation data
 */
export interface PatientCreateData {
  name: string;                         // persona_name
  age: number;                          // persona_age
  gender: string;                       // persona_gender
  prompt: string;                       // persona_prompt
  persona_number?: number;              // persona_number (optional)
  average_wpm?: number;                 // average_wpm (optional)
  voice_id?: string;                    // voice_id (optional)
  interaction_mode?: string;            // interaction_mode (optional)
}

/**
 * Represents patient update data
 */
export interface PatientUpdateData {
  id: string;                           // persona_id
  name: string;                         // persona_name
  age: number;                          // persona_age
  gender: string;                       // persona_gender
  prompt: string;                       // persona_prompt
  photoUrl?: string;                    // Photo URL (stored separately)
  persona_number?: number;              // persona_number (optional)
  average_wpm?: number;                 // average_wpm (optional)
  voice_id?: string;                    // voice_id (optional)
  interaction_mode?: string;            // interaction_mode (optional)
  llmUploadFile?: File;                 // File upload for LLM
  patientInfoFile?: File;               // File upload for patient info
  answerKeyFile?: File;                 // File upload for answer key
}

/**
 * Mock data service interface
 */
export interface MockInstructorDataService {
  getSimulationGroups: () => InstructorSimulationGroup[];
  getCurrentUser: () => UserData;
  getSimulationGroup: (id: string) => InstructorSimulationGroup | undefined;
  getOrganizationLabels: (simulationGroupId: string) => OrganizationLabels;
  getPatientAnalytics: (simulationGroupId: string) => PatientAnalytics[];
  getMessageCountData: (patientId: string) => MessageCountData[];
  generateAccessCode: (simulationGroupId: string) => string;
  getManageablePatients: (simulationGroupId: string) => ManageablePatient[];
  getPatient: (patientId: string) => ManageablePatient | undefined;
  createPatient: (simulationGroupId: string, patientData: PatientCreateData) => void;
  updatePatient: (simulationGroupId: string, patientData: PatientUpdateData) => void;
  uploadPatientPhoto: (patientId: string, photoFile: File) => Promise<string>;
  updatePatientLLMEvaluation: (patientId: string, enabled: boolean) => void;
  deletePatient: (patientId: string) => void;
  getGlobalRubricQuestions: (simulationGroupId: string) => GlobalRubricQuestion[];
  addGlobalRubricQuestion: (simulationGroupId: string, question: GlobalRubricQuestion) => void;
  updateGlobalRubricQuestion: (simulationGroupId: string, question: GlobalRubricQuestion) => void;
  deleteGlobalRubricQuestion: (simulationGroupId: string, questionId: string) => void;
  getCaseSpecificQuestions: (patientId: string) => GlobalRubricQuestion[];
  addCaseSpecificQuestion: (patientId: string, question: GlobalRubricQuestion) => void;
  updateCaseSpecificQuestion: (patientId: string, question: GlobalRubricQuestion) => void;
  deleteCaseSpecificQuestion: (patientId: string, questionId: string) => void;
  getCaseMaterials: (patientId: string) => CaseMaterial[];
  addCaseMaterial: (patientId: string, material: CaseMaterial) => void;
  updateCaseMaterial: (patientId: string, material: CaseMaterial) => void;
  deleteCaseMaterial: (patientId: string, materialId: string) => void;
  getEvaluationPrompt: (simulationGroupId: string) => string;
  getStudents: (simulationGroupId: string) => Student[];
  getStudentDetails: (studentId: string) => StudentDetails | undefined;
  getChatAttempts: (studentId: string, patientId: string) => ChatAttempt[];
  getChatMessages: (attemptId: string) => ChatMessage[];
  getChatNotes: (attemptId: string) => string;
  getDefaultPatientPrompt: () => string;
  getGlobalQuestionBank: () => QuestionBankItem[];
  getPatientSpecificQuestionBank: () => QuestionBankItem[];
  addToGlobalQuestionBank: (question: QuestionBankItem) => void;
  addToPatientSpecificQuestionBank: (question: QuestionBankItem) => void;
  getPatientCaseSpecificQuestionIds: (patientId: string) => Set<string>;
  updatePatientCaseSpecificQuestions: (patientId: string, questionIds: Set<string>) => void;
  getSimulationGroupsUsingQuestion: (questionId: string, questionType?: 'global' | 'patientSpecific') => string[];
  getPatientsUsingQuestion: (questionId: string) => string[];
  isQuestionInUse: (questionId: string, questionType?: 'global' | 'patientSpecific') => boolean;
  getKeyQuestionAnalytics: (simulationGroupId: string) => KeyQuestionAnalytics[];
  getQuestionPerformanceScores: (simulationGroupId: string) => QuestionPerformanceScore[];
  getScoreDistribution: (simulationGroupId: string, patientId: string) => ScoreDistributionBucket[];
}

/**
 * Hardcoded simulation groups for instructors
 */
const mockInstructorSimulationGroups: InstructorSimulationGroup[] = [
  {
    id: '1',
    name: 'Chronic Pain',
    subtitle: 'Medical Simulation Group',
    iconColor: getSimulationGroupColor(0),
    accessCode: 'NB3W-PI3I-Q2EH-WPA3',
    studentCount: 20,
    instructorCount: 5,
    patientCount: 2,
    organizationId: 'org-1'
  },
  {
    id: '2',
    name: 'Acne',
    subtitle: 'Medical Simulation Group',
    iconColor: getSimulationGroupColor(1),
    accessCode: 'XY7Z-AB2C-DE4F-GH8I',
    studentCount: 18,
    instructorCount: 3,
    patientCount: 3,
    organizationId: 'org-1'
  },
  {
    id: '3',
    name: 'Diabetes Management',
    subtitle: 'Medical Simulation Group',
    iconColor: getSimulationGroupColor(2),
    accessCode: 'PQ9R-ST1U-VW3X-YZ5A',
    studentCount: 32,
    instructorCount: 4,
    patientCount: 2,
    organizationId: 'org-2'
  }
];

/**
 * Hardcoded user data for instructor
 */
const mockInstructorUserData: UserData = {
  name: 'Dr. Sarah Johnson',
  avatarUrl: undefined // Will display initials
};

/**
 * Hardcoded patient analytics data
 */
const mockPatientAnalytics: Record<string, PatientAnalytics[]> = {
  '1': [ // Chronic Pain group
    {
      id: 'pamela',
      name: 'Pamela',
      instructorCompletionPercentage: 60,
      llmCompletionPercentage: 0,
      studentMessageCount: 49,
      aiMessageCount: 36,
      studentAccessCount: 10
    },
    {
      id: 'timothy',
      name: 'Timothy',
      instructorCompletionPercentage: 0,
      llmCompletionPercentage: 0,
      studentMessageCount: 32,
      aiMessageCount: 28,
      studentAccessCount: 8
    }
  ],
  '2': [ // Acne group
    {
      id: 'john',
      name: 'John Davis',
      instructorCompletionPercentage: 15,
      llmCompletionPercentage: 20,
      studentMessageCount: 65,
      aiMessageCount: 52,
      studentAccessCount: 15
    }
  ]
};

/**
 * Default patient prompt for all patients
 */
const DEFAULT_PATIENT_PROMPT = "Pretend to be a patient with the context you are given. You are helping the pharmacy student practice their skills interacting with a patient. Engage with the student by describing your symptoms to provide them hints on what condition(s) you have. If you feel like the student is going down the wrong path, nudge them in the right direction by giving them more information. This is to help the student identify the proper diagnosis of the patient you are pretending to be.";

/**
 * Hardcoded manageable patients data
 */
const mockManageablePatients: Record<string, ManageablePatient[]> = {
  '1': [ // Chronic Pain group
    {
      id: 'pamela',
      simulation_group_id: '1',
      name: 'Pamela',
      age: 56,
      gender: 'Female',
      prompt: DEFAULT_PATIENT_PROMPT,
      llmEvaluationEnabled: true
    },
    {
      id: 'timothy',
      simulation_group_id: '1',
      name: 'Timothy',
      age: 42,
      gender: 'Other',
      prompt: DEFAULT_PATIENT_PROMPT,
      llmEvaluationEnabled: true
    }
  ],
  '2': [ // Acne group
    {
      id: 'john',
      simulation_group_id: '2',
      name: 'John',
      age: 38,
      gender: 'Male',
      prompt: DEFAULT_PATIENT_PROMPT,
      llmEvaluationEnabled: false
    }
  ]
};

/**
 * Hardcoded students data
 */
const mockStudents: Record<string, Student[]> = {
  '1': [ // Chronic Pain group
    {
      id: 'student-1',
      name: 'Student 1',
      email: 'student1@example.com'
    },
    {
      id: 'student-2',
      name: 'Student 2',
      email: 'student2@example.com'
    },
    {
      id: 'student-3',
      name: 'Student 3',
      email: 'student3@example.com'
    },
    {
      id: 'student-4',
      name: 'Student 4',
      email: 'student4@example.com'
    },
    {
      id: 'student-5',
      name: 'Student 5',
      email: 'student5@example.com'
    }
  ],
  '2': [ // Acne group
    {
      id: 'student-6',
      name: 'Student 6',
      email: 'student6@example.com'
    },
    {
      id: 'student-7',
      name: 'Student 7',
      email: 'student7@example.com'
    }
  ]
};

/**
 * Hardcoded student details data
 */
const mockStudentDetails: Record<string, StudentDetails> = {
  'student-1': {
    id: 'student-1',
    name: 'Student 1',
    email: 'student1@example.com',
    groupName: 'Chronic Pain',
    casesAttempted: 4,
    caseCompletionRate: 50
  },
  'student-2': {
    id: 'student-2',
    name: 'Student 2',
    email: 'student2@example.com',
    groupName: 'Chronic Pain',
    casesAttempted: 3,
    caseCompletionRate: 67
  },
  'student-3': {
    id: 'student-3',
    name: 'Student 3',
    email: 'student3@example.com',
    groupName: 'Chronic Pain',
    casesAttempted: 2,
    caseCompletionRate: 100
  },
  'student-4': {
    id: 'student-4',
    name: 'Student 4',
    email: 'student4@example.com',
    groupName: 'Chronic Pain',
    casesAttempted: 5,
    caseCompletionRate: 80
  },
  'student-5': {
    id: 'student-5',
    name: 'Student 5',
    email: 'student5@example.com',
    groupName: 'Chronic Pain',
    casesAttempted: 1,
    caseCompletionRate: 0
  }
};

/**
 * Hardcoded chat attempts data (per student per patient)
 */
const mockChatAttempts: Record<string, Record<string, ChatAttempt[]>> = {
  'student-1': {
    'pamela': [
      {
        id: 'attempt-1',
        student_interaction_id: 'interaction-1',
        attemptNumber: 4,
        date: 'Feb 19, 2026',
        completionStatus: 'In Progress',
        score: null
      },
      {
        id: 'attempt-2',
        student_interaction_id: 'interaction-1',
        attemptNumber: 3,
        date: 'Feb 18, 2026',
        completionStatus: 'Complete',
        score: 67
      },
      {
        id: 'attempt-3',
        student_interaction_id: 'interaction-1',
        attemptNumber: 2,
        date: 'Feb 14, 2026',
        completionStatus: 'Complete',
        score: 88
      },
      {
        id: 'attempt-4',
        student_interaction_id: 'interaction-1',
        attemptNumber: 1,
        date: 'Jan 27, 2026',
        completionStatus: 'In Progress',
        score: null
      }
    ],
    'timothy': [
      {
        id: 'attempt-5',
        student_interaction_id: 'interaction-2',
        attemptNumber: 2,
        date: 'Feb 20, 2026',
        completionStatus: 'Complete',
        score: 75
      },
      {
        id: 'attempt-6',
        student_interaction_id: 'interaction-2',
        attemptNumber: 1,
        date: 'Feb 10, 2026',
        completionStatus: 'Complete',
        score: 82
      }
    ]
  }
};

/**
 * Hardcoded chat messages data (per attempt)
 */
const mockChatMessages: Record<string, ChatMessage[]> = {
  'attempt-2': [
    {
      message_id: 'msg-1',
      chat_id: 'attempt-2',
      student_sent: false,
      message_content: "Hello there! I'm Pamela, nice to meet you. I've been feeling really unwell lately, and I'm worried about these chest pains I've been having for the last week. They're quite uncomfortable and I'm not sure what's causing them. Do you think it could be related to my heart?",
      time_sent: '10:00 AM'
    },
    {
      message_id: 'msg-2',
      chat_id: 'attempt-2',
      student_sent: true,
      message_content: "Yes it's possible, can you please tell me a little bit about your medical history?",
      time_sent: '10:01 AM'
    },
    {
      message_id: 'msg-3',
      chat_id: 'attempt-2',
      student_sent: false,
      message_content: "I have a history of hypertension, which I've had for about 4 years now. I've also had a total abdominal hysterectomy, and I've been experiencing dyspnea, or shortness of breath, lately. Oh, and I've had a peptic ulcer in the past, which is why I've been taking over-the-counter non-steroidal anti-inflammatory drugs. Could any of these things be contributing to my chest pains?",
      time_sent: '10:02 AM'
    },
    {
      message_id: 'msg-4',
      chat_id: 'attempt-2',
      student_sent: true,
      message_content: "What medications are you taking?",
      time_sent: '10:03 AM'
    },
    {
      message_id: 'msg-5',
      chat_id: 'attempt-2',
      student_sent: false,
      message_content: "I'm not currently taking any prescription medications, but I do take ibuprofen (Advil) occasionally for headaches. I've also been taking NSAIDs regularly, which I know can irritate my stomach and make my peptic ulcer symptoms worse. I'm worried that maybe my medication use is related to my chest pains, but I'm not sure. Do you think that's possible?",
      time_sent: '10:04 AM'
    },
    {
      message_id: 'msg-6',
      chat_id: 'attempt-2',
      student_sent: true,
      message_content: "Tell me more about how the pain feels",
      time_sent: '10:05 AM'
    }
  ]
};

/**
 * Hardcoded notes data (per attempt)
 */
const mockChatNotes: Record<string, string> = {
  'attempt-2': 'No notes available.',
  'attempt-3': 'sample notes go here.',
  'attempt-4': ''
};

/**
 * Hardcoded evaluation prompt (markdown format)
 * This will be editable by admin users in the future
 */
const mockEvaluationPrompt = `# Evaluation Prompt

Evaluate the student's interview using the instructor-defined rubric and key questions.
Use only the provided transcript, rubric, and student responses. Do not infer actions or facts that are not clearly supported.

## Assess:

- which key questions were addressed, partially addressed, or missed
- how well the student's questions align with the rubric
- overall clinical reasoning and question quality

## Generate an AI debrief with:

- Interview Summary (3-5 sentences)
- Key Questions Successfully Addressed
- Key Questions Missed or Incomplete
- Rubric-Based Feedback (strengths, areas for improvement, next-time focus)
- Overall Assessment (rubric alignment score + summary)

## OUTPUT FORMAT

Return valid JSON in exactly this structure:

\`\`\`json
{
  "interview_summary": "string",
  "key_questions_successfully_addressed": [
    {
      "question_id": "string",
      "question_content": "string",
      "feedback": "string"
    }
  ],
  "key_questions_missed_or_incomplete": [
    {
      "question_id": "string",
      "question_content": "string",
      "status": "missed | partially_addressed",
      "feedback": "string",
      "clinical_importance": "string"
    }
  ],
  "rubric_based_feedback": {
    "strengths": ["string", "string"],
    "areas_for_improvement": ["string", "string"],
    "recommended_focus_next_time": ["string", "string"]
  },
  "overall_assessment": {
    "rubric_alignment_score": 0,
    "summary": "string"
  }
}
\`\`\`
`;

/**
 * Hardcoded global rubric questions data
 */
const mockGlobalRubricQuestions: Record<string, GlobalRubricQuestion[]> = {
  '1': [ // Chronic Pain group
    {
      id: '1',
      title: 'Medication History',
      keyQuestion: 'Ask the patient about current medications, including prescription, OTC, and supplements.',
      clinicalIntent: 'This question evaluates the student\'s ability to identify medications that may contribute to adverse reactions or drug interactions.',
      evaluationCriteria: 'Student should attempt to identify:\n• Current medications\n• Dosage if relevant\n• Duration of use\n• Recent medication changes',
      required: true,
    },
    {
      id: '2',
      title: 'Allergy History',
      keyQuestion: 'Ask the patient about any known allergies, including medications, foods, and environmental allergens.',
      clinicalIntent: 'This question evaluates the student\'s ability to identify potential allergic reactions and contraindications.',
      evaluationCriteria: 'Student should attempt to identify:\n• Known allergies\n• Type of reaction\n• Severity of reaction\n• Management strategies',
      required: true,
    },
    {
      id: '3',
      title: 'Symptom Duration',
      keyQuestion: 'Ask the patient how long they have been experiencing their current symptoms.',
      clinicalIntent: 'This question evaluates the student\'s ability to establish a timeline for the patient\'s condition.',
      evaluationCriteria: 'Student should attempt to identify:\n• Onset of symptoms\n• Duration of symptoms\n• Progression of symptoms\n• Any triggering events',
      required: false,
    },
  ],
  '2': [ // Acne group - can have different questions
    {
      id: '1',
      title: 'Skin Care Routine',
      keyQuestion: 'Ask the patient about their current skin care routine and products used.',
      clinicalIntent: 'This question evaluates the student\'s ability to identify potential irritants or contributing factors.',
      evaluationCriteria: 'Student should attempt to identify:\n• Current products used\n• Frequency of use\n• Any recent changes\n• Skin sensitivity',
      required: true,
    },
  ]
};

/**
 * Hardcoded case-specific questions data (per patient)
 */
const mockCaseSpecificQuestions: Record<string, GlobalRubricQuestion[]> = {
  'pamela': [
    {
      id: 'case-q1',
      title: 'Chest Pain Characterization',
      keyQuestion: 'Assess the characteristics of the patient\'s chest pain, including onset, duration, severity, quality and radiation.',
      clinicalIntent: 'This question evaluates the student\'s ability to gather essential details about the chest pain that help differentiate between potentially life-threatening causes (e.g., cardiac ischemia), medication-related causes, gastrointestinal causes and musculoskeletal causes, and to support appropriate clinical decision-making and triage.',
      evaluationCriteria: 'The student attempts to identify at least 3-4 of the following core characteristics of the chest pain:\n• When the pain started, whether the onset was sudden or gradual\n• Where the pain is located, localized or diffuse\n• Description of the pain (e.g., sharp, dull, pressure, burning, tightness)\n• Intensity of pain (e.g., pain scale or descriptive severity)\n• How long the pain lasts, whether it is constant or intermittent',
      required: true,
    },
    {
      id: 'case-q2',
      title: 'Exacerbating and Relieving Factors',
      keyQuestion: 'Identify factors that worsen or alleviate the patient\'s chest pain.',
      clinicalIntent: 'This question assesses the student\'s ability to explore triggers and relieving factors, which are critical for distinguishing between cardiac, musculoskeletal, and gastrointestinal causes of chest pain.',
      evaluationCriteria: 'The student attempts to identify:\n• Activities or positions that worsen the pain (e.g., exertion, deep breathing, lying down)\n• Factors that relieve the pain (e.g., rest, antacids, nitroglycerin)\n• Relationship to meals, stress, or physical activity',
      required: true,
    },
    {
      id: 'case-q3',
      title: 'Symptom Duration',
      keyQuestion: 'Determine how long the patient has been experiencing the chest pain symptoms.',
      clinicalIntent: 'Understanding symptom duration helps assess urgency and chronicity, distinguishing acute emergencies from chronic conditions.',
      evaluationCriteria: 'The student asks about:\n• When symptoms first began\n• Whether this is a new or recurring problem\n• Any changes in symptom pattern over time',
      required: false,
    },
  ],
  'timothy': [],
  'john': []
};

/**
 * Hardcoded case materials data (per patient)
 */
const mockCaseMaterials: Record<string, CaseMaterial[]> = {
  'pamela': [
    {
      id: 'material-1',
      title: 'Chest X-Ray',
      description: 'Frontal chest radiograph obtained as part of the patient\'s clinical evaluation.',
      materialType: 'image',
      contentUrl: '',
      embedLink: '',
    },
    {
      id: 'material-2',
      title: 'ECG Reading',
      description: '12-lead electrocardiogram showing cardiac electrical activity.',
      materialType: 'document',
      contentUrl: '',
      embedLink: '',
    },
    {
      id: 'material-3',
      title: 'Patient Interview Video',
      description: 'Video recording of initial patient interview and history taking.',
      materialType: 'video',
      contentUrl: '',
      embedLink: '',
    },
  ],
  'timothy': [],
  'john': []
};

/**
 * Question Bank Item - represents a question in the question bank
 * Maps to: question_bank table in DB
 */
export interface QuestionBankItem {
  id: string;                           // question_id
  title: string;                        // title
  questionText: string;                 // question_text (the key question)
  clinicalIntent: string;               // clinical_intent
  evaluationCriteria: string;           // evaluation_criteria
  category?: string;                    // category
  difficultyLevel?: string;             // difficulty_level
  isMandatory: boolean;                 // is_mandatory (maps to 'required' in UI)
  weight?: number;                      // weight
  maxScore?: number;                    // max_score
  isActive: boolean;                    // is_active
  usedBySimulationGroups: string[];     // Track which simulation groups are using this question
  usedByPatients?: string[];            // Track which patients are using this question (for patient-specific questions)
}

/**
 * Hardcoded global question bank data
 * These are available questions that can be added to simulation groups
 */
const mockGlobalQuestionBank: QuestionBankItem[] = [
  { id: 'bank-global-1', title: 'Patient History Assessment', questionText: 'Ask the patient about their complete medical history, including past diagnoses, surgeries, and hospitalizations.', clinicalIntent: 'Evaluates the student\'s ability to systematically gather a comprehensive patient history to inform clinical decision-making.', evaluationCriteria: 'Student should attempt to identify:\n• Past medical conditions and diagnoses\n• Previous surgeries or hospitalizations\n• Relevant family history\n• Social history (smoking, alcohol, occupation)', isMandatory: true, isActive: true, usedBySimulationGroups: [] },
  { id: 'bank-global-2', title: 'Medication Review', questionText: 'Review the patient\'s current medications, including dosages, frequency, and adherence.', clinicalIntent: 'Assesses the student\'s ability to identify potential drug interactions, duplications, and adherence issues.', evaluationCriteria: 'Student should attempt to identify:\n• All current prescription medications\n• OTC medications and supplements\n• Dosage and frequency for each\n• Adherence patterns and barriers', isMandatory: true, isActive: true, usedBySimulationGroups: [] },
  { id: 'bank-global-3', title: 'Communication Skills', questionText: 'Demonstrate effective communication techniques including active listening, empathy, and clear explanations.', clinicalIntent: 'Evaluates the student\'s ability to build rapport and communicate effectively with patients from diverse backgrounds.', evaluationCriteria: 'Student should demonstrate:\n• Active listening and appropriate responses\n• Use of open-ended questions\n• Empathetic and non-judgmental tone\n• Clear, jargon-free explanations', isMandatory: false, isActive: true, usedBySimulationGroups: [] },
  { id: 'bank-global-4', title: 'Clinical Reasoning', questionText: 'Apply clinical reasoning to formulate a differential diagnosis based on the patient\'s presentation.', clinicalIntent: 'Assesses the student\'s ability to synthesize patient information and apply pharmacological knowledge to clinical scenarios.', evaluationCriteria: 'Student should demonstrate:\n• Systematic approach to problem identification\n• Consideration of multiple diagnoses\n• Evidence-based reasoning\n• Appropriate prioritization of concerns', isMandatory: true, isActive: true, usedBySimulationGroups: [] },
  { id: 'bank-global-5', title: 'Patient Education', questionText: 'Provide appropriate patient education about their condition, treatment options, and self-management strategies.', clinicalIntent: 'Evaluates the student\'s ability to educate patients in an understandable and actionable manner.', evaluationCriteria: 'Student should:\n• Explain the condition in lay terms\n• Discuss treatment options and rationale\n• Provide self-management strategies\n• Verify patient understanding (teach-back)', isMandatory: false, isActive: true, usedBySimulationGroups: [] },
  { id: 'bank-global-6', title: 'Documentation Quality', questionText: 'Ensure accurate and complete documentation of the patient encounter.', clinicalIntent: 'Assesses the student\'s ability to maintain thorough clinical records that support continuity of care.', evaluationCriteria: 'Student should document:\n• Chief complaint and HPI\n• Relevant findings from assessment\n• Clinical decisions and rationale\n• Follow-up plan and recommendations', isMandatory: false, isActive: true, usedBySimulationGroups: [] },
  { id: 'bank-global-7', title: 'Professionalism', questionText: 'Demonstrate professional behavior, including respect for patient autonomy, confidentiality, and ethical practice.', clinicalIntent: 'Evaluates the student\'s adherence to professional standards and ethical guidelines in patient interactions.', evaluationCriteria: 'Student should demonstrate:\n• Respect for patient autonomy and preferences\n• Maintenance of confidentiality\n• Professional demeanor and appearance\n• Ethical decision-making', isMandatory: false, isActive: true, usedBySimulationGroups: [] },
  { id: 'bank-global-8', title: 'Safety Considerations', questionText: 'Identify and address potential safety concerns, including drug interactions, contraindications, and adverse effects.', clinicalIntent: 'Assesses the student\'s ability to prioritize patient safety and identify potential risks in the treatment plan.', evaluationCriteria: 'Student should identify:\n• Potential drug-drug interactions\n• Contraindications based on patient history\n• Common and serious adverse effects\n• Appropriate monitoring parameters', isMandatory: true, isActive: true, usedBySimulationGroups: [] },
];

/**
 * Hardcoded patient-specific question bank data
 * These are available questions that can be added to specific patients
 */
const mockPatientSpecificQuestionBank: QuestionBankItem[] = [
  { id: 'bank-patient-1', title: 'Pain Assessment Scale', questionText: 'Use a validated pain assessment scale to evaluate the patient\'s current pain level, location, and quality.', clinicalIntent: 'Evaluates the student\'s ability to systematically assess pain using standardized tools.', evaluationCriteria: 'Student should assess:\n• Pain intensity (0-10 scale)\n• Pain location and radiation\n• Quality of pain (sharp, dull, burning)\n• Impact on daily activities', isMandatory: true, isActive: true, usedBySimulationGroups: [], usedByPatients: [] },
  { id: 'bank-patient-2', title: 'Allergy Verification', questionText: 'Verify the patient\'s allergy history, including drug allergies, food allergies, and environmental allergens.', clinicalIntent: 'Assesses the student\'s diligence in confirming allergy information to prevent adverse reactions.', evaluationCriteria: 'Student should verify:\n• Known drug allergies and reaction types\n• Food and environmental allergies\n• Severity of previous reactions\n• Cross-reactivity considerations', isMandatory: true, isActive: true, usedBySimulationGroups: [], usedByPatients: [] },
  { id: 'bank-patient-3', title: 'Symptom Duration', questionText: 'Determine the onset, duration, and progression of the patient\'s primary symptoms.', clinicalIntent: 'Evaluates the student\'s ability to establish a clear timeline for symptom development.', evaluationCriteria: 'Student should determine:\n• When symptoms first appeared\n• Whether symptoms are acute or chronic\n• Progression pattern over time\n• Any triggering or precipitating events', isMandatory: false, isActive: true, usedBySimulationGroups: [], usedByPatients: [] },
  { id: 'bank-patient-4', title: 'Previous Treatment History', questionText: 'Inquire about previous treatments tried for the current condition, including their effectiveness.', clinicalIntent: 'Assesses the student\'s ability to gather treatment history to avoid repeating ineffective therapies.', evaluationCriteria: 'Student should identify:\n• Previous medications tried and outcomes\n• Non-pharmacological treatments attempted\n• Reasons for discontinuation\n• Patient preferences and concerns', isMandatory: false, isActive: true, usedBySimulationGroups: [], usedByPatients: [] },
  { id: 'bank-patient-5', title: 'Lifestyle Factors', questionText: 'Assess relevant lifestyle factors including diet, exercise, sleep patterns, and stress levels.', clinicalIntent: 'Evaluates the student\'s ability to identify modifiable lifestyle factors that impact the patient\'s condition.', evaluationCriteria: 'Student should assess:\n• Dietary habits and nutritional status\n• Physical activity level\n• Sleep quality and patterns\n• Stress and coping mechanisms', isMandatory: false, isActive: true, usedBySimulationGroups: [], usedByPatients: [] },
  { id: 'bank-patient-6', title: 'Family Medical History', questionText: 'Gather a comprehensive family medical history to identify hereditary risk factors.', clinicalIntent: 'Assesses the student\'s ability to identify genetic and familial predispositions relevant to the patient\'s care.', evaluationCriteria: 'Student should identify:\n• First-degree relatives with relevant conditions\n• Age of onset for family conditions\n• Hereditary patterns or genetic conditions\n• Impact on patient\'s risk profile', isMandatory: false, isActive: true, usedBySimulationGroups: [], usedByPatients: [] },
  { id: 'bank-patient-7', title: 'Current Medications', questionText: 'Review all current medications including prescription, OTC, herbal supplements, and vitamins.', clinicalIntent: 'Evaluates the student\'s thoroughness in identifying all substances the patient is currently taking.', evaluationCriteria: 'Student should identify:\n• All prescription medications with doses\n• OTC medications used regularly\n• Herbal supplements and vitamins\n• Recreational substance use if applicable', isMandatory: true, isActive: true, usedBySimulationGroups: [], usedByPatients: [] },
  { id: 'bank-patient-8', title: 'Treatment Goals', questionText: 'Discuss and establish shared treatment goals with the patient based on their values and preferences.', clinicalIntent: 'Assesses the student\'s ability to practice patient-centered care by incorporating patient preferences into the treatment plan.', evaluationCriteria: 'Student should:\n• Explore patient expectations and goals\n• Discuss realistic treatment outcomes\n• Align treatment plan with patient values\n• Establish measurable treatment endpoints', isMandatory: false, isActive: true, usedBySimulationGroups: [], usedByPatients: [] },
];

/**
 * Get all simulation groups for instructor
 * 
 * @returns Array of simulation groups
 */
function getSimulationGroups(): InstructorSimulationGroup[] {
  return mockInstructorSimulationGroups;
}

/**
 * Get current instructor user data
 * 
 * @returns User data object
 */
function getCurrentUser(): UserData {
  return mockInstructorUserData;
}

/**
 * Get a specific simulation group by ID
 * 
 * @param id - Simulation group ID
 * @returns Simulation group or undefined if not found
 */
function getSimulationGroup(id: string): InstructorSimulationGroup | undefined {
  return mockInstructorSimulationGroups.find(group => group.id === id);
}

/**
 * Get organization-specific labels for UI display
 * Derives all label variations from the organization's aiPersona and userRole settings
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns OrganizationLabels object with all label variations
 */
function getOrganizationLabels(simulationGroupId: string): OrganizationLabels {
  const simulationGroup = getSimulationGroup(simulationGroupId);
  const organizations = mockAdminDataService.getOrganizations();
  const organization = organizations.find((org) => org.id === simulationGroup?.organizationId);
  
  const aiPersona = organization?.aiPersona || 'Patient';
  const userRole = organization?.userRole || 'Doctor';
  
  return {
    aiPersona,
    aiPersonaPlural: `${aiPersona}s`,
    aiPersonaLower: aiPersona.toLowerCase(),
    aiPersonaPluralLower: `${aiPersona}s`.toLowerCase(),
    userRole,
    userRolePlural: `${userRole}s`,
    userRoleLower: userRole.toLowerCase(),
    userRolePluralLower: `${userRole}s`.toLowerCase(),
  };
}

/**
 * Get patient analytics for a simulation group
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of patient analytics
 */
function getPatientAnalytics(simulationGroupId: string): PatientAnalytics[] {
  return mockPatientAnalytics[simulationGroupId] || [];
}

/**
 * Get message count data for charts
 * 
 * @param patientId - Patient ID
 * @returns Array with message count data
 */
function getMessageCountData(patientId: string): MessageCountData[] {
  // Find patient across all groups
  for (const groupPatients of Object.values(mockPatientAnalytics)) {
    const patient = groupPatients.find(p => p.id === patientId);
    if (patient) {
      return [
        {
          name: 'Messages',
          'Student Messages': patient.studentMessageCount,
          'AI Messages': patient.aiMessageCount
        }
      ];
    }
  }
  return [];
}

/**
 * Get key question analytics data for charts
 * Returns mock data showing how many students answered each key question
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of key question analytics
 */
function getKeyQuestionAnalytics(simulationGroupId: string): KeyQuestionAnalytics[] {
  const rubricQuestions = getGlobalRubricQuestions(simulationGroupId);
  const students = getStudents(simulationGroupId);
  const totalStudents = students.length;
  
  return rubricQuestions.map((q, index) => ({
    questionTitle: q.title.length > 30 ? q.title.substring(0, 27) + '...' : q.title,
    studentsAnswered: Math.max(1, Math.floor(totalStudents * (0.4 + Math.sin(index * 1.7) * 0.3 + Math.cos(index * 0.9) * 0.2)))
  }));
}

/**
 * Get average quality score per key question (mock data)
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of question performance scores
 */
function getQuestionPerformanceScores(simulationGroupId: string): QuestionPerformanceScore[] {
  const rubricQuestions = getGlobalRubricQuestions(simulationGroupId);
  const students = getStudents(simulationGroupId);
  const totalStudents = students.length;
  
  return rubricQuestions.map((q, index) => {
    // Deterministic mock scores between 40–95
    const baseScore = 55 + Math.sin(index * 2.3) * 20 + Math.cos(index * 1.1) * 15;
    const score = Math.round(Math.min(95, Math.max(40, baseScore)));
    const responses = Math.max(2, Math.floor(totalStudents * (0.5 + Math.sin(index * 1.5) * 0.3)));
    return {
      questionTitle: q.title.length > 30 ? q.title.substring(0, 27) + '...' : q.title,
      averageScore: score,
      totalResponses: responses
    };
  });
}

/**
 * Get score distribution as a histogram (mock data)
 * Returns buckets: 0-20, 21-40, 41-60, 61-80, 81-100
 * 
 * @param simulationGroupId - Simulation group ID
 * @param patientId - Patient ID
 * @returns Array of score distribution buckets
 */
function getScoreDistribution(simulationGroupId: string, patientId: string): ScoreDistributionBucket[] {
  // Deterministic mock distribution that varies by patient
  const seed = patientId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  
  const buckets = [
    { range: '0–20', base: 1 },
    { range: '21–40', base: 3 },
    { range: '41–60', base: 7 },
    { range: '61–80', base: 9 },
    { range: '81–100', base: 5 },
  ];
  
  return buckets.map((b, i) => ({
    range: b.range,
    count: Math.max(0, b.base + Math.floor(Math.sin(seed + i * 2.1) * 4))
  }));
}

/**
 * Generate a new access code for a simulation group
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns New access code
 */
function generateAccessCode(simulationGroupId: string): string {
  // Mock implementation - generates random code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = 4;
  const segmentLength = 4;
  
  const code = Array.from({ length: segments }, () => {
    return Array.from({ length: segmentLength }, () => 
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  }).join('-');
  
  // Update the mock data
  const group = mockInstructorSimulationGroups.find(g => g.id === simulationGroupId);
  if (group) {
    group.accessCode = code;
  }
  
  return code;
}

/**
 * Get manageable patients for a simulation group
 * Maps to: personas table filtered by simulation_group_id
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of manageable patients with all persona fields
 */
function getManageablePatients(simulationGroupId: string): ManageablePatient[] {
  return mockManageablePatients[simulationGroupId] || [];
}

/**
 * Get a specific patient by ID
 * Maps to: personas table filtered by persona_id
 * 
 * @param patientId - Patient ID (persona_id in DB)
 * @returns Patient with all persona fields or undefined if not found
 */
function getPatient(patientId: string): ManageablePatient | undefined {
  for (const groupPatients of Object.values(mockManageablePatients)) {
    const patient = groupPatients.find(p => p.id === patientId);
    if (patient) {
      return patient;
    }
  }
  return undefined;
}

/**
 * Create a new patient
 * Maps to: INSERT into personas table
 * 
 * @param simulationGroupId - Simulation group ID
 * @param patientData - New patient data
 */
function createPatient(simulationGroupId: string, patientData: PatientCreateData): void {
  const newPatient: ManageablePatient = {
    id: `patient-${Date.now()}`,
    simulation_group_id: simulationGroupId,
    name: patientData.name,
    age: patientData.age,
    gender: patientData.gender,
    prompt: patientData.prompt || DEFAULT_PATIENT_PROMPT,
    persona_number: patientData.persona_number,
    average_wpm: patientData.average_wpm,
    voice_id: patientData.voice_id,
    interaction_mode: patientData.interaction_mode,
    llmEvaluationEnabled: false,
  };
  
  if (!mockManageablePatients[simulationGroupId]) {
    mockManageablePatients[simulationGroupId] = [];
  }
  mockManageablePatients[simulationGroupId].push(newPatient);
}

/**
 * Update patient information
 * Maps to: UPDATE personas table
 * 
 * @param simulationGroupId - Simulation group ID
 * @param patientData - Updated patient data
 */
function updatePatient(simulationGroupId: string, patientData: PatientUpdateData): void {
  const patients = mockManageablePatients[simulationGroupId];
  if (patients) {
    const index = patients.findIndex(p => p.id === patientData.id);
    if (index !== -1) {
      patients[index] = {
        ...patients[index],
        name: patientData.name,
        age: patientData.age,
        gender: patientData.gender,
        prompt: patientData.prompt,
        photoUrl: patientData.photoUrl,
        persona_number: patientData.persona_number,
        average_wpm: patientData.average_wpm,
        voice_id: patientData.voice_id,
        interaction_mode: patientData.interaction_mode,
      };
    }
  }
  // In a real implementation, files would be uploaded to a server
  // For now, we just log them
  if (patientData.llmUploadFile) {
    console.log('LLM Upload file:', patientData.llmUploadFile.name);
  }
  if (patientData.patientInfoFile) {
    console.log('Patient Info file:', patientData.patientInfoFile.name);
  }
  if (patientData.answerKeyFile) {
    console.log('Answer Key file:', patientData.answerKeyFile.name);
  }
}

/**
 * Upload patient photo
 * 
 * @param patientId - Patient ID
 * @param photoFile - Photo file to upload
 * @returns Promise with photo URL
 */
async function uploadPatientPhoto(patientId: string, photoFile: File): Promise<string> {
  // Mock implementation - in real app, this would upload to a server
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const photoUrl = reader.result as string;
      // Update patient photo in mock data
      for (const groupPatients of Object.values(mockManageablePatients)) {
        const patient = groupPatients.find(p => p.id === patientId);
        if (patient) {
          patient.photoUrl = photoUrl;
          break;
        }
      }
      resolve(photoUrl);
    };
    reader.readAsDataURL(photoFile);
  });
}

/**
 * Update patient LLM evaluation setting
 * 
 * @param patientId - Patient ID
 * @param enabled - Whether LLM evaluation is enabled
 */
function updatePatientLLMEvaluation(patientId: string, enabled: boolean): void {
  // Find and update patient across all groups
  for (const groupPatients of Object.values(mockManageablePatients)) {
    const patient = groupPatients.find(p => p.id === patientId);
    if (patient) {
      patient.llmEvaluationEnabled = enabled;
      break;
    }
  }
}

/**
 * Delete a patient
 * 
 * @param patientId - Patient ID
 */
function deletePatient(patientId: string): void {
  // Remove patient from all groups
  for (const groupId of Object.keys(mockManageablePatients)) {
    mockManageablePatients[groupId] = mockManageablePatients[groupId].filter(
      p => p.id !== patientId
    );
  }
}

/**
 * Get global rubric questions for a simulation group
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of global rubric questions
 */
function getGlobalRubricQuestions(simulationGroupId: string): GlobalRubricQuestion[] {
  return mockGlobalRubricQuestions[simulationGroupId] || [];
}

/**
 * Add a new global rubric question
 * Also updates the question bank to track this association
 * 
 * @param simulationGroupId - Simulation group ID
 * @param question - Question to add
 */
function addGlobalRubricQuestion(simulationGroupId: string, question: GlobalRubricQuestion): void {
  if (!mockGlobalRubricQuestions[simulationGroupId]) {
    mockGlobalRubricQuestions[simulationGroupId] = [];
  }
  
  // Check if question already exists to prevent duplicates
  const existingQuestion = mockGlobalRubricQuestions[simulationGroupId].find(q => q.id === question.id);
  if (existingQuestion) {
    console.log(`Question ${question.id} already exists in simulation group ${simulationGroupId}, skipping duplicate add`);
    return;
  }
  
  mockGlobalRubricQuestions[simulationGroupId].push(question);
  
  // Update question bank to track this association
  const bankQuestion = mockGlobalQuestionBank.find(q => q.id === question.id);
  if (bankQuestion && !bankQuestion.usedBySimulationGroups.includes(simulationGroupId)) {
    bankQuestion.usedBySimulationGroups.push(simulationGroupId);
  }
}

/**
 * Update a global rubric question
 * 
 * @param simulationGroupId - Simulation group ID
 * @param question - Updated question
 */
function updateGlobalRubricQuestion(simulationGroupId: string, question: GlobalRubricQuestion): void {
  const questions = mockGlobalRubricQuestions[simulationGroupId];
  if (questions) {
    const index = questions.findIndex(q => q.id === question.id);
    if (index !== -1) {
      questions[index] = question;
    }
  }
}

/**
 * Delete a global rubric question
 * Also updates the question bank to remove this association
 * 
 * @param simulationGroupId - Simulation group ID
 * @param questionId - Question ID to delete
 */
function deleteGlobalRubricQuestion(simulationGroupId: string, questionId: string): void {
  const questions = mockGlobalRubricQuestions[simulationGroupId];
  if (questions) {
    mockGlobalRubricQuestions[simulationGroupId] = questions.filter(q => q.id !== questionId);
    
    // Update question bank to remove this association
    const bankQuestion = mockGlobalQuestionBank.find(q => q.id === questionId);
    if (bankQuestion) {
      bankQuestion.usedBySimulationGroups = bankQuestion.usedBySimulationGroups.filter(
        groupId => groupId !== simulationGroupId
      );
    }
  }
}

/**
 * Get evaluation prompt for a simulation group
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Evaluation prompt as markdown string
 */
function getEvaluationPrompt(): string {
  // For now, return the same prompt for all groups
  return mockEvaluationPrompt;
}

/**
 * Get students for a simulation group
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of students
 */
function getStudents(simulationGroupId: string): Student[] {
  return mockStudents[simulationGroupId] || [];
}

/**
 * Get student details by ID
 * 
 * @param studentId - Student ID
 * @returns Student details or undefined if not found
 */
function getStudentDetails(studentId: string): StudentDetails | undefined {
  return mockStudentDetails[studentId];
}

/**
 * Get chat attempts for a student and patient
 * Maps to: chats table filtered by student_interaction_id
 * 
 * @param studentId - Student ID (user_id in DB)
 * @param patientId - Patient ID (persona_id via student_interaction)
 * @returns Array of chat attempts
 */
function getChatAttempts(studentId: string, patientId: string): ChatAttempt[] {
  return mockChatAttempts[studentId]?.[patientId] || [];
}

/**
 * Get chat messages for an attempt
 * Maps to: messages table filtered by chat_id
 * 
 * @param attemptId - Chat attempt ID (chat_id in DB)
 * @returns Array of chat messages ordered by time_sent
 */
function getChatMessages(attemptId: string): ChatMessage[] {
  return mockChatMessages[attemptId] || [];
}

/**
 * Get notes for an attempt
 * Maps to: chats.notes field
 * 
 * @param attemptId - Chat attempt ID (chat_id in DB)
 * @returns Notes text from chats.notes field
 */
function getChatNotes(attemptId: string): string {
  return mockChatNotes[attemptId] || '';
}

/**
 * Get case-specific questions for a patient
 * 
 * @param patientId - Patient ID
 * @returns Array of case-specific questions
 */
function getCaseSpecificQuestions(patientId: string): GlobalRubricQuestion[] {
  return mockCaseSpecificQuestions[patientId] || [];
}

/**
 * Add a new case-specific question
 * Also updates the question bank to track this association
 * 
 * @param patientId - Patient ID
 * @param question - Question to add
 */
function addCaseSpecificQuestion(patientId: string, question: GlobalRubricQuestion): void {
  if (!mockCaseSpecificQuestions[patientId]) {
    mockCaseSpecificQuestions[patientId] = [];
  }
  
  // Check if question already exists to prevent duplicates
  const existingQuestion = mockCaseSpecificQuestions[patientId].find(q => q.id === question.id);
  if (existingQuestion) {
    console.log(`Question ${question.id} already exists for patient ${patientId}, skipping duplicate add`);
    return;
  }
  
  mockCaseSpecificQuestions[patientId].push(question);
  
  // Update question bank to track this association
  const bankQuestion = mockPatientSpecificQuestionBank.find(q => q.id === question.id);
  if (bankQuestion && bankQuestion.usedByPatients && !bankQuestion.usedByPatients.includes(patientId)) {
    bankQuestion.usedByPatients.push(patientId);
    
    // Also track the simulation group this patient belongs to
    const patient = getPatient(patientId);
    if (patient && !bankQuestion.usedBySimulationGroups.includes(patient.simulation_group_id)) {
      bankQuestion.usedBySimulationGroups.push(patient.simulation_group_id);
    }
  }
}

/**
 * Update a case-specific question
 * 
 * @param patientId - Patient ID
 * @param question - Updated question
 */
function updateCaseSpecificQuestion(patientId: string, question: GlobalRubricQuestion): void {
  const questions = mockCaseSpecificQuestions[patientId];
  if (questions) {
    const index = questions.findIndex(q => q.id === question.id);
    if (index !== -1) {
      questions[index] = question;
    }
  }
}

/**
 * Delete a case-specific question
 * Also updates the question bank to remove this association
 * 
 * @param patientId - Patient ID
 * @param questionId - Question ID to delete
 */
function deleteCaseSpecificQuestion(patientId: string, questionId: string): void {
  const questions = mockCaseSpecificQuestions[patientId];
  if (questions) {
    mockCaseSpecificQuestions[patientId] = questions.filter(q => q.id !== questionId);
    
    // Update question bank to remove this association
    const bankQuestion = mockPatientSpecificQuestionBank.find(q => q.id === questionId);
    if (bankQuestion && bankQuestion.usedByPatients) {
      bankQuestion.usedByPatients = bankQuestion.usedByPatients.filter(
        pId => pId !== patientId
      );
      
      // If no patients are using this question anymore, remove the simulation group association
      const patient = getPatient(patientId);
      if (patient && bankQuestion.usedByPatients.length === 0) {
        bankQuestion.usedBySimulationGroups = bankQuestion.usedBySimulationGroups.filter(
          groupId => groupId !== patient.simulation_group_id
        );
      } else if (patient) {
        // Check if any other patients in this simulation group are still using this question
        const otherPatientsInGroup = getManageablePatients(patient.simulation_group_id)
          .filter(p => p.id !== patientId);
        const stillUsedInGroup = otherPatientsInGroup.some(p => 
          bankQuestion.usedByPatients?.includes(p.id)
        );
        
        if (!stillUsedInGroup) {
          bankQuestion.usedBySimulationGroups = bankQuestion.usedBySimulationGroups.filter(
            groupId => groupId !== patient.simulation_group_id
          );
        }
      }
    }
  }
}

/**
 * Get case materials for a patient
 * Maps to: persona_media table filtered by persona_id
 * 
 * @param patientId - Patient ID (persona_id in DB)
 * @returns Array of case materials (physical assessment materials)
 */
function getCaseMaterials(patientId: string): CaseMaterial[] {
  return mockCaseMaterials[patientId] || [];
}

/**
 * Add a new case material
 * 
 * @param patientId - Patient ID
 * @param material - Material to add
 */
function addCaseMaterial(patientId: string, material: CaseMaterial): void {
  if (!mockCaseMaterials[patientId]) {
    mockCaseMaterials[patientId] = [];
  }
  mockCaseMaterials[patientId].push(material);
}

/**
 * Update a case material
 * 
 * @param patientId - Patient ID
 * @param material - Updated material
 */
function updateCaseMaterial(patientId: string, material: CaseMaterial): void {
  const materials = mockCaseMaterials[patientId];
  if (materials) {
    const index = materials.findIndex(m => m.id === material.id);
    if (index !== -1) {
      materials[index] = material;
    }
  }
}

/**
 * Delete a case material
 * 
 * @param patientId - Patient ID
 * @param materialId - Material ID to delete
 */
function deleteCaseMaterial(patientId: string, materialId: string): void {
  const materials = mockCaseMaterials[patientId];
  if (materials) {
    mockCaseMaterials[patientId] = materials.filter(m => m.id !== materialId);
  }
}

/**
 * Get the default patient prompt
 * 
 * @returns Default patient prompt text
 */
function getDefaultPatientPrompt(): string {
  return DEFAULT_PATIENT_PROMPT;
}

/**
 * Get global question bank
 * 
 * @returns Array of global question bank items
 */
function getGlobalQuestionBank(): QuestionBankItem[] {
  return [...mockGlobalQuestionBank];
}

/**
 * Get patient-specific question bank
 * 
 * @returns Array of patient-specific question bank items
 */
function getPatientSpecificQuestionBank(): QuestionBankItem[] {
  return [...mockPatientSpecificQuestionBank];
}

/**
 * Add a question to the global question bank
 * 
 * @param question - Question to add
 */
function addToGlobalQuestionBank(question: QuestionBankItem): void {
  // Ensure the question has the required tracking arrays
  if (!question.usedBySimulationGroups) {
    question.usedBySimulationGroups = [];
  }
  mockGlobalQuestionBank.push(question);
}

/**
 * Add a question to the patient-specific question bank
 * 
 * @param question - Question to add
 */
function addToPatientSpecificQuestionBank(question: QuestionBankItem): void {
  // Ensure the question has the required tracking arrays
  if (!question.usedBySimulationGroups) {
    question.usedBySimulationGroups = [];
  }
  if (!question.usedByPatients) {
    question.usedByPatients = [];
  }
  mockPatientSpecificQuestionBank.push(question);
}

/**
 * Get patient's case-specific question IDs
 * Returns a Set of question IDs that are assigned to this patient
 * 
 * @param patientId - Patient ID
 * @returns Set of question IDs
 */
function getPatientCaseSpecificQuestionIds(patientId: string): Set<string> {
  const questions = mockCaseSpecificQuestions[patientId] || [];
  return new Set(questions.map(q => q.id));
}

/**
 * Update patient's case-specific questions based on question IDs
 * This is used when toggling checkboxes in the question bank
 * 
 * @param patientId - Patient ID
 * @param questionIds - Set of question IDs that should be assigned to this patient
 */
function updatePatientCaseSpecificQuestions(patientId: string, questionIds: Set<string>): void {
  // This is a helper method that doesn't directly modify data
  // The actual add/delete operations are handled by addCaseSpecificQuestion and deleteCaseSpecificQuestion
  // This method is here for consistency and future API integration
  console.log(`Updating patient ${patientId} case-specific questions:`, Array.from(questionIds));
}

/**
 * Get simulation groups using a specific question
 * 
 * @param questionId - Question ID
 * @param questionType - Type of question ('global' or 'patientSpecific')
 * @returns Array of simulation group IDs using this question
 */
function getSimulationGroupsUsingQuestion(questionId: string, questionType: 'global' | 'patientSpecific' = 'global'): string[] {
  const questionBank = questionType === 'global' ? mockGlobalQuestionBank : mockPatientSpecificQuestionBank;
  const question = questionBank.find(q => q.id === questionId);
  return question ? [...question.usedBySimulationGroups] : [];
}

/**
 * Get patients using a specific patient-specific question
 * 
 * @param questionId - Question ID
 * @returns Array of patient IDs using this question
 */
function getPatientsUsingQuestion(questionId: string): string[] {
  const question = mockPatientSpecificQuestionBank.find(q => q.id === questionId);
  return question && question.usedByPatients ? [...question.usedByPatients] : [];
}

/**
 * Check if a question is used by any simulation group
 * 
 * @param questionId - Question ID
 * @param questionType - Type of question ('global' or 'patientSpecific')
 * @returns True if the question is used by at least one simulation group
 */
function isQuestionInUse(questionId: string, questionType: 'global' | 'patientSpecific' = 'global'): boolean {
  const groups = getSimulationGroupsUsingQuestion(questionId, questionType);
  return groups.length > 0;
}

/**
 * Mock instructor data service object
 * Provides methods to retrieve hardcoded data for now
 */
export const mockInstructorDataService: MockInstructorDataService = {
  getSimulationGroups,
  getCurrentUser,
  getSimulationGroup,
  getOrganizationLabels,
  getPatientAnalytics,
  getMessageCountData,
  generateAccessCode,
  getManageablePatients,
  getPatient,
  createPatient,
  updatePatient,
  uploadPatientPhoto,
  updatePatientLLMEvaluation,
  deletePatient,
  getGlobalRubricQuestions,
  addGlobalRubricQuestion,
  updateGlobalRubricQuestion,
  deleteGlobalRubricQuestion,
  getCaseSpecificQuestions,
  addCaseSpecificQuestion,
  updateCaseSpecificQuestion,
  deleteCaseSpecificQuestion,
  getCaseMaterials,
  addCaseMaterial,
  updateCaseMaterial,
  deleteCaseMaterial,
  getEvaluationPrompt,
  getStudents,
  getStudentDetails,
  getChatAttempts,
  getChatMessages,
  getChatNotes,
  getDefaultPatientPrompt,
  getGlobalQuestionBank,
  getPatientSpecificQuestionBank,
  addToGlobalQuestionBank,
  addToPatientSpecificQuestionBank,
  getPatientCaseSpecificQuestionIds,
  updatePatientCaseSpecificQuestions,
  getSimulationGroupsUsingQuestion,
  getPatientsUsingQuestion,
  isQuestionInUse,
  getKeyQuestionAnalytics,
  getQuestionPerformanceScores,
  getScoreDistribution
};
