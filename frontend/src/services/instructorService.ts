/**
 * Instructor Service
 * 
 * Calls real backend API endpoints via API Gateway.
 * Falls back to mock data if API calls fail (for local dev without backend).
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
import { apiClient } from '@/lib/api-client';
import { authService } from '@/lib/auth';

/**
 * Represents a simulation group from instructor perspective
 */
export interface InstructorSimulationGroup {
  id: string;              // Unique identifier
  name: string;            // Group name (e.g., "Pregnancy")
  subtitle: string;        // Always "Medical Simulation Group"
  icon_url?: string;        // Optional icon image URL
  icon_color?: string;      // Fallback color for avatar (hex format)
  access_code: string;      // Access code for students to join
  student_count: number;    // Number of students in the group
  instructor_count?: number; // Number of instructors in the group
  patient_count: number;    // Number of patients in the group
  organization_id: string;  // Reference to parent organization
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
  patient_id: string;                   // Unique identifier
  patient_name: string;                 // Patient name
  instructor_completion_percentage: number; // 0-100
  llm_completion_percentage: number;    // 0-100
  student_message_count: number;        // Number of messages from students
  ai_message_count: number;             // Number of AI responses
  student_access_count: number;         // Number of times students accessed
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
  patient_id: string;                   // Unique identifier (persona_id in DB)
  simulation_group_id: string;          // Reference to simulation group (simulation_group_id in DB)
  patient_name: string;                 // Patient name (persona_name in DB)
  patient_age: number;                  // Patient age (persona_age in DB)
  patient_gender: string;               // Patient gender (persona_gender in DB)
  patient_number?: number;              // Patient number (persona_number in DB)
  patient_prompt: string;               // Patient prompt for LLM (persona_prompt in DB)
  average_wpm?: number;                 // Average words per minute (average_wpm in DB)
  voice_id?: string;                    // Voice ID for TTS (voice_id in DB)
  interaction_mode?: string;            // Interaction mode (interaction_mode in DB)
  llm_completion: boolean;              // Whether LLM evaluation is enabled (derived from settings)
  photo_url?: string;                   // Optional patient photo URL (stored separately or in media)
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
  patient_name: string;                 // persona_name
  patient_age: number;                  // persona_age
  patient_gender: string;               // persona_gender
  patient_prompt: string;               // persona_prompt
  patient_number?: number;              // persona_number (optional)
  average_wpm?: number;                 // average_wpm (optional)
  voice_id?: string;                    // voice_id (optional)
  interaction_mode?: string;            // interaction_mode (optional)
}

/**
 * Represents patient update data
 */
export interface PatientUpdateData {
  patient_id: string;                   // persona_id
  patient_name: string;                 // persona_name
  patient_age: number;                  // persona_age
  patient_gender: string;               // persona_gender
  patient_prompt: string;               // persona_prompt
  photo_url?: string;                   // Photo URL (stored separately)
  patient_number?: number;              // persona_number (optional)
  average_wpm?: number;                 // average_wpm (optional)
  voice_id?: string;                    // voice_id (optional)
  interaction_mode?: string;            // interaction_mode (optional)
  llm_upload_file?: File;               // File upload for LLM
  patient_info_file?: File;             // File upload for patient info
  answer_key_file?: File;               // File upload for answer key
}

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
 * Instructor data service interface
 */
export interface InstructorDataService {
  getSimulationGroups: () => Promise<InstructorSimulationGroup[]>;
  createSimulationGroup: (data: { name: string; description: string; active: boolean; enableVoice: boolean }) => Promise<InstructorSimulationGroup>;
  getCurrentUser: () => Promise<UserData>;
  getSimulationGroup: (id: string) => Promise<InstructorSimulationGroup | undefined>;
  getOrganizationLabels: (simulationGroupId: string) => OrganizationLabels;
  getPatientAnalytics: (simulationGroupId: string) => Promise<PatientAnalytics[]>;
  getMessageCountData: (patientId: string) => MessageCountData[];
  generateAccessCode: (simulationGroupId: string) => Promise<string>;
  getManageablePatients: (simulationGroupId: string) => Promise<ManageablePatient[]>;
  getPatient: (patientId: string) => ManageablePatient | undefined;
  createPatient: (simulationGroupId: string, patientData: PatientCreateData) => Promise<void>;
  updatePatient: (simulationGroupId: string, patientData: PatientUpdateData) => Promise<void>;
  uploadPatientPhoto: (patientId: string, photoFile: File) => Promise<string>;
  updatePatientLLMEvaluation: (patientId: string, enabled: boolean) => Promise<void>;
  deletePatient: (patientId: string) => Promise<void>;
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
  getEvaluationPrompt: (simulationGroupId: string) => Promise<string>;
  getStudents: (simulationGroupId: string) => Promise<Student[]>;
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
    icon_color: getSimulationGroupColor(0),
    access_code: 'NB3W-PI3I-Q2EH-WPA3',
    student_count: 20,
    instructor_count: 5,
    patient_count: 2,
    organization_id: 'org-1'
  },
  {
    id: '2',
    name: 'Acne',
    subtitle: 'Medical Simulation Group',
    icon_color: getSimulationGroupColor(1),
    access_code: 'XY7Z-AB2C-DE4F-GH8I',
    student_count: 18,
    instructor_count: 3,
    patient_count: 3,
    organization_id: 'org-1'
  },
  {
    id: '3',
    name: 'Diabetes Management',
    subtitle: 'Medical Simulation Group',
    icon_color: getSimulationGroupColor(2),
    access_code: 'PQ9R-ST1U-VW3X-YZ5A',
    student_count: 32,
    instructor_count: 4,
    patient_count: 2,
    organization_id: 'org-2'
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

    const data = await apiClient.request<any[]>(
      `instructor/groups?email=${encodeURIComponent(user.email)}`
    );

    return data.map((group, index) => ({
      simulation_group_id: group.simulation_group_id,
      group_name: group.group_name,
      subtitle: 'Medical Simulation Group',
      iconColor: group.icon_color || getSimulationGroupColor(index),
      access_code: group.access_code || '',
      student_count: group.student_count || 0,
      patient_count: group.patient_count || 0,
      organization_id: group.organization_id || '',
    }));
  } catch (error) {
    console.error('Failed to fetch instructor groups:', error);
    return [];
  }
}

/**
 * Create a new simulation group
 */
async function createSimulationGroup(data: { name: string; description: string; active: boolean; enableVoice: boolean }): Promise<InstructorSimulationGroup> {
  const user = await authService.getCurrentUser();
  if (!user?.email) throw new Error('Not authenticated');

  const result = await apiClient.request<any>(
    `instructor/create_simulation_group?instructor_email=${encodeURIComponent(user.email)}`,
    {
      method: 'POST',
      body: {
        group_name: data.name,
        group_description: data.description,
        group_student_access: data.active,
        instructor_voice_enabled: data.enableVoice,
      },
    }
  );

  return {
    simulation_group_id: result.simulation_group_id,
    group_name: result.group_name,
    subtitle: 'Medical Simulation Group',
    iconColor: getSimulationGroupColor(0),
    access_code: result.access_code || '',
    student_count: 0,
    patient_count: 0,
    organization_id: result.organization_id || '',
  };
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

// Mock data structures for questions
const mockGlobalRubricQuestions: Record<string, GlobalRubricQuestion[]> = {};
const mockCaseSpecificQuestions: Record<string, GlobalRubricQuestion[]> = {};

/**
 * Get current instructor user data
 * 
 * @returns User data object
 */
async function getCurrentUser(): Promise<UserData> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    const data = await apiClient.request<{ name: string }>(
      `student/get_name?user_email=${encodeURIComponent(user.email)}`
    );

    return {
      name: data.name || user.email,
      avatarUrl: undefined,
    };
  } catch (error) {
    console.error('Failed to fetch user name:', error);
    throw error;
  }
}

/**
 * Get a specific simulation group by ID
 * 
 * @param id - Simulation group ID
 * @returns Simulation group or undefined if not found
 */
async function getSimulationGroup(id: string): Promise<InstructorSimulationGroup | undefined> {
  try {
    const groups = await getSimulationGroups();
    return groups.find(group => group.simulation_group_id === id);
  } catch (error) {
    console.error('Failed to fetch simulation group:', error);
    return undefined;
  }
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
  const organization = organizations.find((org) => org.id === simulationGroup?.organization_id);
  
  const aiPersona = organization?.ai_persona || 'Patient';
  const userRole = organization?.user_role || 'Doctor';
  
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
async function getPatientAnalytics(simulationGroupId: string): Promise<PatientAnalytics[]> {
  try {
    const data = await apiClient.request<any[]>(
      `instructor/analytics?simulation_group_id=${encodeURIComponent(simulationGroupId)}`
    );

    return data.map((patient) => ({
      patient_id: patient.patient_id,
      patient_name: patient.patient_name,
      instructor_completion_percentage: patient.instructor_completion_percentage || 0,
      llm_completion_percentage: patient.ai_score_percentage || 0,
      student_message_count: patient.student_message_count || 0,
      ai_message_count: patient.ai_message_count || 0,
      student_access_count: patient.access_count || 0,
    }));
  } catch (error) {
    console.error('Failed to fetch patient analytics:', error);
    return [];
  }
}

/**
 * Get message count data for charts
 * 
 * @param patientId - Patient ID
 * @returns Array with message count data
 */
function getMessageCountData(_patientId: string): MessageCountData[] {
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
function getScoreDistribution(patientId: string): ScoreDistributionBucket[] {
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
    group.access_code = code;
  }
}

/**
 * Get manageable patients for a simulation group
 * Maps to: personas table filtered by simulation_group_id
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of manageable patients with all persona fields
 */
async function getManageablePatients(simulationGroupId: string): Promise<ManageablePatient[]> {
  try {
    const data = await apiClient.request<any[]>(
      `instructor/view_patients?simulation_group_id=${encodeURIComponent(simulationGroupId)}`
    );

    return data.map((patient) => ({
      patient_id: patient.patient_id,
      simulation_group_id: patient.simulation_group_id,
      patient_name: patient.patient_name,
      patient_age: patient.patient_age,
      patient_gender: patient.patient_gender,
      patient_number: patient.patient_number,
      patient_prompt: patient.patient_prompt,
      average_wpm: patient.average_wpm,
      voice_id: patient.voice_id,
      interaction_mode: patient.interaction_mode,
      llm_completion: patient.llm_completion || false,
      photo_url: patient.photo_url,
    }));
  } catch (error) {
    console.error('Failed to fetch manageable patients:', error);
    return [];
  }
}

/**
 * Get a specific patient by ID
 * Maps to: personas table filtered by persona_id
 * 
 * @param patientId - Patient ID (persona_id in DB)
 * @returns Patient with all persona fields or undefined if not found
 */
function getPatient(_patientId: string): ManageablePatient | undefined {
  return undefined;
}

/**
 * Create a new patient
 * Maps to: INSERT into personas table
 * 
 * @param simulationGroupId - Simulation group ID
 * @param patientData - New patient data
 */
async function createPatient(simulationGroupId: string, patientData: PatientCreateData): Promise<void> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    const queryParams = new URLSearchParams({
      simulation_group_id: simulationGroupId,
      patient_name: patientData.patient_name,
      patient_number: patientData.patient_number?.toString() || '1',
      patient_age: patientData.patient_age.toString(),
      patient_gender: patientData.patient_gender,
      instructor_email: user.email,
    });

    if (patientData.voice_id) {
      queryParams.append('voice_id', patientData.voice_id);
    }

    await apiClient.request(`instructor/create_patient?${queryParams.toString()}`, {
      method: 'POST',
      body: {
        patient_prompt: patientData.patient_prompt || '',
      },
    });
  } catch (error) {
    console.error('Failed to create patient:', error);
    throw error;
  }
}

/**
 * Update patient information
 * Maps to: UPDATE personas table
 * 
 * @param simulationGroupId - Simulation group ID
 * @param patientData - Updated patient data
 */
async function updatePatient(simulationGroupId: string, patientData: PatientUpdateData): Promise<void> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    const queryParams = new URLSearchParams({
      patient_id: patientData.patient_id,
      instructor_email: user.email,
      simulation_group_id: simulationGroupId,
    });

    await apiClient.request(`instructor/edit_patient?${queryParams.toString()}`, {
      method: 'PUT',
      body: {
        patient_name: patientData.patient_name,
        patient_age: patientData.patient_age,
        patient_gender: patientData.patient_gender,
        patient_prompt: patientData.patient_prompt,
      },
    });

    // Handle file uploads if needed
    if (patientData.llm_upload_file) {
      console.log('LLM Upload file:', patientData.llm_upload_file.name);
    }
    if (patientData.patient_info_file) {
      console.log('Patient Info file:', patientData.patient_info_file.name);
    }
    if (patientData.answer_key_file) {
      console.log('Answer Key file:', patientData.answer_key_file.name);
    }
  } catch (error) {
    console.error('Failed to update patient:', error);
    throw error;
  }
}

/**
 * Upload patient photo
 * 
 * @param patientId - Patient ID
 * @param photoFile - Photo file to upload
 * @returns Promise with photo URL
 */
async function uploadPatientPhoto(_patientId: string, photoFile: File): Promise<string> {
  // TODO: implement real upload to S3
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
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
async function updatePatientLLMEvaluation(patientId: string, enabled: boolean): Promise<void> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    await apiClient.request(
      `instructor/toggle_llm_completion?patient_id=${encodeURIComponent(patientId)}&instructor_email=${encodeURIComponent(user.email)}`,
      {
        method: 'PUT',
        body: {
          llm_completion: enabled,
        },
      }
    );
  } catch (error) {
    console.error('Failed to update LLM evaluation:', error);
    throw error;
  }
}

/**
 * Delete a patient
 * 
 * @param patientId - Patient ID
 */
async function deletePatient(patientId: string): Promise<void> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    await apiClient.request(
      `instructor/delete_patient?patient_id=${encodeURIComponent(patientId)}&instructor_email=${encodeURIComponent(user.email)}`,
      {
        method: 'DELETE',
      }
    );
  } catch (error) {
    console.error('Failed to delete patient:', error);
    throw error;
  }
}

/**
 * Get global rubric questions for a simulation group
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of global rubric questions
 */
function getGlobalRubricQuestions(_simulationGroupId: string): GlobalRubricQuestion[] {
  return [];
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
function updateGlobalRubricQuestion(_simulationGroupId: string, _question: GlobalRubricQuestion): void {
  // TODO: implement API call
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
async function getEvaluationPrompt(simulationGroupId: string): Promise<string> {
  try {
    const data = await apiClient.request<{ system_prompt: string }>(
      `instructor/get_prompt?simulation_group_id=${encodeURIComponent(simulationGroupId)}`
    );

    return data.system_prompt || '';
  } catch (error) {
    console.error('Failed to fetch evaluation prompt:', error);
    return [] as any;
  }
}

/**
 * Get students for a simulation group
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of students
 */
async function getStudents(simulationGroupId: string): Promise<Student[]> {
  try {
    const data = await apiClient.request<any[]>(
      `instructor/view_students?simulation_group_id=${encodeURIComponent(simulationGroupId)}`
    );

    return data.map((student) => ({
      id: student.user_id,
      name: `${student.first_name} ${student.last_name}`.trim() || student.username,
      email: student.user_email,
    }));
  } catch (error) {
    console.error('Failed to fetch students:', error);
    return [];
  }
}

/**
 * Get student details by ID
 * 
 * @param studentId - Student ID
 * @returns Student details or undefined if not found
 */
function getStudentDetails(_studentId: string): StudentDetails | undefined {
  return [] as any;
}

/**
 * Get chat attempts for a student and patient
 * Maps to: chats table filtered by student_interaction_id
 * 
 * @param studentId - Student ID (user_id in DB)
 * @param patientId - Patient ID (persona_id via student_interaction)
 * @returns Array of chat attempts
 */
function getChatAttempts(_studentId: string, _patientId: string): ChatAttempt[] {
  return [];
}

/**
 * Get chat messages for an attempt
 * Maps to: messages table filtered by chat_id
 * 
 * @param attemptId - Chat attempt ID (chat_id in DB)
 * @returns Array of chat messages ordered by time_sent
 */
function getChatMessages(_attemptId: string): ChatMessage[] {
  return [];
}

/**
 * Get notes for an attempt
 * Maps to: chats.notes field
 * 
 * @param attemptId - Chat attempt ID (chat_id in DB)
 * @returns Notes text from chats.notes field
 */
function getChatNotes(_attemptId: string): string {
  return [] as any;
}

/**
 * Get case-specific questions for a patient
 * 
 * @param patientId - Patient ID
 * @returns Array of case-specific questions
 */
function getCaseSpecificQuestions(_patientId: string): GlobalRubricQuestion[] {
  return [];
}

/**
 * Add a new case-specific question
 * Also updates the question bank to track this association
 * 
 * @param patientId - Patient ID
 * @param question - Question to add
 */
async function addCaseSpecificQuestion(patientId: string, question: GlobalRubricQuestion): Promise<void> {
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
    const patients = await getManageablePatients('');
    const patient = patients.find(p => p.patient_id === patientId);
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
function updateCaseSpecificQuestion(_patientId: string, _question: GlobalRubricQuestion): void {
  // TODO: implement API call
}

/**
 * Delete a case-specific question
 * Also updates the question bank to remove this association
 * 
 * @param patientId - Patient ID
 * @param questionId - Question ID to delete
 */
async function deleteCaseSpecificQuestion(patientId: string, questionId: string): Promise<void> {
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
      const patients = await getManageablePatients('');
      const patient = patients.find(p => p.patient_id === patientId);
      if (patient && bankQuestion.usedByPatients.length === 0) {
        bankQuestion.usedBySimulationGroups = bankQuestion.usedBySimulationGroups.filter(
          groupId => groupId !== patient.simulation_group_id
        );
      } else if (patient) {
        // Check if any other patients in this simulation group are still using this question
        const otherPatientsInGroup = (await getManageablePatients(patient.simulation_group_id))
          .filter(p => p.patient_id !== patientId);
        const stillUsedInGroup = otherPatientsInGroup.some(p => 
          bankQuestion.usedByPatients?.includes(p.patient_id)
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
function getCaseMaterials(_patientId: string): CaseMaterial[] {
  return [];
}

/**
 * Add a new case material
 * 
 * @param patientId - Patient ID
 * @param material - Material to add
 */
function addCaseMaterial(_patientId: string, _material: CaseMaterial): void {
  // TODO: implement API call
}

/**
 * Update a case material
 * 
 * @param patientId - Patient ID
 * @param material - Updated material
 */
function updateCaseMaterial(_patientId: string, _material: CaseMaterial): void {
  // TODO: implement API call
}

/**
 * Delete a case material
 * 
 * @param patientId - Patient ID
 * @param materialId - Material ID to delete
 */
function deleteCaseMaterial(_patientId: string, _materialId: string): void {
  // TODO: implement API call
}

/**
 * Get the default patient prompt
 * 
 * @returns Default patient prompt text
 */
function getDefaultPatientPrompt(): string {
  return '';
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
export const instructorService: InstructorDataService = {
  getSimulationGroups,
  createSimulationGroup,
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

// Keep backward-compatible export
export const mockInstructorDataService = instructorService;
