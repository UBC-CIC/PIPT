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
import { mockAdminDataService } from '@/services/adminService';
import { mapBackendToQuestionBankItem } from '@/services/adminApiService';

/**
 * Represents a simulation group from instructor perspective
 */
export interface InstructorSimulationGroup {
  simulation_group_id: string; // Unique identifier
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
  message_content: string;             // Message text (message_content in DB)
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
  uploadPatientPhoto: (simulationGroupId: string, patientId: string, photoFile: File) => Promise<string>;
  uploadPatientFile: (simulationGroupId: string, patientId: string, file: File, folderType: 'documents' | 'info' | 'answer_key') => Promise<void>;
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
  getGlobalQuestionBank: () => Promise<QuestionBankItem[]>;
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
  getSimulationGroupQuestions: (simulationGroupId: string, personaId?: string) => Promise<any[]>;
  assignQuestionToGroup: (simulationGroupId: string, questionId: string, personaId: string, options?: { weight_override?: number; max_score_override?: number; order?: number }) => Promise<any>;
  unassignQuestion: (groupQuestionId: string) => Promise<any>;
  updateQuestionAssignment: (groupQuestionId: string, updates: any) => Promise<any>;
}

/**
 * Hardcoded simulation groups for instructors
 */
const mockInstructorSimulationGroups: InstructorSimulationGroup[] = [
  {
    simulation_group_id: '1',
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
    simulation_group_id: '2',
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
    simulation_group_id: '3',
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
      patient_id: 'pamela',
      patient_name: 'Pamela',
      instructor_completion_percentage: 60,
      llm_completion_percentage: 0,
      student_message_count: 49,
      ai_message_count: 36,
      student_access_count: 10
    },
    {
      patient_id: 'timothy',
      patient_name: 'Timothy',
      instructor_completion_percentage: 0,
      llm_completion_percentage: 0,
      student_message_count: 32,
      ai_message_count: 28,
      student_access_count: 8
    }
  ],
  '2': [ // Acne group
    {
      patient_id: 'john',
      patient_name: 'John Davis',
      instructor_completion_percentage: 15,
      llm_completion_percentage: 20,
      student_message_count: 65,
      ai_message_count: 52,
      student_access_count: 15
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
      patient_id: 'pamela',
      simulation_group_id: '1',
      patient_name: 'Pamela',
      patient_age: 56,
      patient_gender: 'Female',
      patient_prompt: DEFAULT_PATIENT_PROMPT,
      llm_completion: true
    },
    {
      patient_id: 'timothy',
      simulation_group_id: '1',
      patient_name: 'Timothy',
      patient_age: 42,
      patient_gender: 'Other',
      patient_prompt: DEFAULT_PATIENT_PROMPT,
      llm_completion: true
    }
  ],
  '2': [ // Acne group
    {
      patient_id: 'john',
      simulation_group_id: '2',
      patient_name: 'John',
      patient_age: 38,
      patient_gender: 'Male',
      patient_prompt: DEFAULT_PATIENT_PROMPT,
      llm_completion: false
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
 * Get simulation groups for the current instructor
 */
async function getSimulationGroups(): Promise<InstructorSimulationGroup[]> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    const data = await apiClient.request<any[]>(
      `instructor/groups?email=${encodeURIComponent(user.email)}`
    );

    return data.map((group, index) => ({
      simulation_group_id: group.simulation_group_id,
      name: group.group_name,
      subtitle: 'Medical Simulation Group',
      icon_color: group.icon_color || getSimulationGroupColor(index),
      access_code: group.group_access_code || '',
      student_count: group.student_count || 0,
      instructor_count: group.instructor_count || 0,
      patient_count: group.patient_count || 0,
      organization_id: group.organization_id || '',
    }));
  } catch (error) {
    console.error('Failed to fetch instructor groups, using mock data:', error);
    return mockInstructorSimulationGroups;
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
    name: result.group_name,
    subtitle: 'Medical Simulation Group',
    icon_color: getSimulationGroupColor(0),
    access_code: result.group_access_code || '',
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
    console.error('Failed to fetch user name, using mock data:', error);
    return mockInstructorUserData;
  }
}

/**
 * Get a specific simulation group by ID
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
 */
function getOrganizationLabels(_simulationGroupId: string): OrganizationLabels {
  const organizations = mockAdminDataService.getOrganizations();
  const organization = organizations.length > 0 ? organizations[0] : undefined;

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
 */
async function getPatientAnalytics(simulationGroupId: string): Promise<PatientAnalytics[]> {
  try {
    const data = await apiClient.request<any[]>(
      `instructor/analytics?simulation_group_id=${encodeURIComponent(simulationGroupId)}`
    );

    return data.map((patient) => ({
      patient_id: patient.persona_id,
      patient_name: patient.persona_name,
      instructor_completion_percentage: patient.instructor_completion_percentage || 0,
      llm_completion_percentage: patient.ai_score_percentage || 0,
      student_message_count: patient.student_message_count || 0,
      ai_message_count: patient.ai_message_count || 0,
      student_access_count: patient.access_count || 0,
    }));
  } catch (error) {
    console.error('Failed to fetch patient analytics, using mock data:', error);
    return mockPatientAnalytics[simulationGroupId] || [];
  }
}

/**
 * Get message count data for charts
 */
function getMessageCountData(_patientId: string): MessageCountData[] {
  return [];
}

/**
 * Get key question analytics data for charts
 * Returns data showing how many students answered each key question
 *
 * FIX: Changed from async to sync to match InstructorDataService interface.
 */
function getKeyQuestionAnalytics(simulationGroupId: string): KeyQuestionAnalytics[] {
  const rubricQuestions = getGlobalRubricQuestions(simulationGroupId);

  return rubricQuestions.map((q, index) => ({
    questionTitle: q.title.length > 30 ? q.title.substring(0, 27) + '...' : q.title,
    studentsAnswered: Math.max(1, Math.floor(10 * (0.4 + Math.sin(index * 1.7) * 0.3 + Math.cos(index * 0.9) * 0.2)))
  }));
}

/**
 * Get average quality score per key question
 *
 * FIX: Changed from async to sync to match InstructorDataService interface.
 */
function getQuestionPerformanceScores(simulationGroupId: string): QuestionPerformanceScore[] {
  const rubricQuestions = getGlobalRubricQuestions(simulationGroupId);

  return rubricQuestions.map((q, index) => {
    const baseScore = 55 + Math.sin(index * 2.3) * 20 + Math.cos(index * 1.1) * 15;
    const score = Math.round(Math.min(95, Math.max(40, baseScore)));
    const responses = Math.max(2, Math.floor(10 * (0.5 + Math.sin(index * 1.5) * 0.3)));
    return {
      questionTitle: q.title.length > 30 ? q.title.substring(0, 27) + '...' : q.title,
      averageScore: score,
      totalResponses: responses
    };
  });
}

/**
 * Get score distribution as a histogram
 * Returns buckets: 0-20, 21-40, 41-60, 61-80, 81-100
 *
 * FIX: Added missing simulationGroupId parameter to match InstructorDataService interface.
 */
function getScoreDistribution(_simulationGroupId: string, patientId: string): ScoreDistributionBucket[] {
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
 * FIX: Changed to async to match InstructorDataService interface (Promise<string>).
 */
async function generateAccessCode(simulationGroupId: string): Promise<string> {
  const result = await apiClient.request<{ access_code: string }>(
    `instructor/generate_access_code?simulation_group_id=${encodeURIComponent(simulationGroupId)}`,
    { method: 'PUT' }
  );
  return result.access_code;
}

/**
 * Get manageable patients for a simulation group
 * Maps to: personas table filtered by simulation_group_id
 */
async function getManageablePatients(simulationGroupId: string): Promise<ManageablePatient[]> {
  try {
    const data = await apiClient.request<any[]>(
      `instructor/view_patients?simulation_group_id=${encodeURIComponent(simulationGroupId)}`
    );

    return data.map((patient) => ({
      id: patient.persona_id,
      patient_id: patient.persona_id,
      simulation_group_id: patient.simulation_group_id,
      name: patient.persona_name,
      patient_name: patient.persona_name,
      age: patient.persona_age,
      patient_age: patient.persona_age,
      gender: patient.persona_gender,
      patient_gender: patient.persona_gender,
      patient_number: patient.persona_number,
      patient_prompt: patient.persona_prompt,
      average_wpm: patient.average_wpm,
      voice_id: patient.voice_id,
      interaction_mode: patient.interaction_mode,
      llmEvaluationEnabled: patient.llm_completion || false,
      llm_completion: patient.llm_completion || false,
      photo_url: patient.photo_url,
    }));
  } catch (error) {
    console.error('Failed to fetch manageable patients, using mock data:', error);
    const mocks = mockManageablePatients[simulationGroupId] || [];
    return mocks.map((p) => ({
      ...p,
      id: p.patient_id,
      name: p.patient_name,
      age: p.patient_age,
      gender: p.patient_gender,
      llmEvaluationEnabled: p.llm_completion,
    })) as any[];
  }
}

/**
 * Get a specific patient by ID
 */
function getPatient(_patientId: string): ManageablePatient | undefined {
  return undefined;
}

/**
 * Create a new patient
 */
async function createPatient(simulationGroupId: string, patientData: PatientCreateData): Promise<void> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    const queryParams = new URLSearchParams({
      simulation_group_id: simulationGroupId,
      persona_name: patientData.patient_name,
      persona_number: patientData.patient_number?.toString() || '1',
      persona_age: patientData.patient_age.toString(),
      persona_gender: patientData.patient_gender,
      instructor_email: user.email,
    });

    if (patientData.voice_id) {
      queryParams.append('voice_id', patientData.voice_id);
    }

    await apiClient.request(`instructor/create_patient?${queryParams.toString()}`, {
      method: 'POST',
      body: {
        persona_prompt: patientData.patient_prompt || '',
      },
    });
  } catch (error) {
    console.error('Failed to create patient:', error);
    throw error;
  }
}

/**
 * Update patient information
 */
async function updatePatient(simulationGroupId: string, patientData: PatientUpdateData): Promise<void> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    const queryParams = new URLSearchParams({
      persona_id: patientData.patient_id,
      instructor_email: user.email,
      simulation_group_id: simulationGroupId,
    });

    await apiClient.request(`instructor/edit_patient?${queryParams.toString()}`, {
      method: 'PUT',
      body: {
        persona_name: patientData.patient_name,
        persona_age: patientData.patient_age,
        persona_gender: patientData.patient_gender,
        persona_prompt: patientData.patient_prompt,
      },
    });

    if (patientData.llm_upload_file) {
      await uploadFileToS3(simulationGroupId, patientData.patient_id, patientData.llm_upload_file, 'documents');
    }
    if (patientData.patient_info_file) {
      await uploadFileToS3(simulationGroupId, patientData.patient_id, patientData.patient_info_file, 'info');
    }
    if (patientData.answer_key_file) {
      await uploadFileToS3(simulationGroupId, patientData.patient_id, patientData.answer_key_file, 'answer_key');
    }
  } catch (error) {
    console.error('Failed to update patient:', error);
    throw error;
  }
}

/**
 * Get a presigned URL and upload a file to S3
 */
async function uploadFileToS3(
  simulationGroupId: string,
  patientId: string,
  file: File,
  folderType: 'documents' | 'info' | 'answer_key' | 'profile_picture'
): Promise<void> {
  const lastDot = file.name.lastIndexOf('.');
  const fileName = lastDot > 0 ? file.name.substring(0, lastDot) : file.name;
  const fileType = lastDot > 0 ? file.name.substring(lastDot + 1).toLowerCase() : '';

  const queryParams = new URLSearchParams({
    simulation_group_id: simulationGroupId,
    patient_id: patientId,
    patient_name: patientId,
    file_name: fileName,
    file_type: fileType,
    folder_type: folderType,
  });

  const data = await apiClient.request<{ presignedurl: string }>(
    `instructor/generate_presigned_url?${queryParams.toString()}`
  );

  await fetch(data.presignedurl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
}

/**
 * Upload a patient file (document, info, or answer key) to S3
 */
async function uploadPatientFile(
  simulationGroupId: string,
  patientId: string,
  file: File,
  folderType: 'documents' | 'info' | 'answer_key'
): Promise<void> {
  await uploadFileToS3(simulationGroupId, patientId, file, folderType);
}

/**
 * Upload patient photo
 */
async function uploadPatientPhoto(simulationGroupId: string, patientId: string, photoFile: File): Promise<string> {
  await uploadFileToS3(simulationGroupId, patientId, photoFile, 'profile_picture');
  return '';
}

/**
 * Update patient LLM evaluation setting
 */
async function updatePatientLLMEvaluation(patientId: string, enabled: boolean): Promise<void> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    await apiClient.request(
      `instructor/toggle_llm_completion?persona_id=${encodeURIComponent(patientId)}&instructor_email=${encodeURIComponent(user.email)}`,
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
 */
async function deletePatient(patientId: string): Promise<void> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    await apiClient.request(
      `instructor/delete_patient?persona_id=${encodeURIComponent(patientId)}&instructor_email=${encodeURIComponent(user.email)}`,
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
 */
function getGlobalRubricQuestions(_simulationGroupId: string): GlobalRubricQuestion[] {
  return [];
}

/**
 * Add a new global rubric question
 */
function addGlobalRubricQuestion(simulationGroupId: string, question: GlobalRubricQuestion): void {
  if (!mockGlobalRubricQuestions[simulationGroupId]) {
    mockGlobalRubricQuestions[simulationGroupId] = [];
  }

  const existingQuestion = mockGlobalRubricQuestions[simulationGroupId].find(q => q.id === question.id);
  if (existingQuestion) {
    console.log(`Question ${question.id} already exists in simulation group ${simulationGroupId}, skipping duplicate add`);
    return;
  }

  mockGlobalRubricQuestions[simulationGroupId].push(question);

  const bankQuestion = mockGlobalQuestionBank.find(q => q.id === question.id);
  if (bankQuestion && !bankQuestion.usedBySimulationGroups.includes(simulationGroupId)) {
    bankQuestion.usedBySimulationGroups.push(simulationGroupId);
  }
}

/**
 * Update a global rubric question
 */
function updateGlobalRubricQuestion(_simulationGroupId: string, _question: GlobalRubricQuestion): void {
  // TODO: implement API call
}

/**
 * Delete a global rubric question
 */
function deleteGlobalRubricQuestion(simulationGroupId: string, questionId: string): void {
  const questions = mockGlobalRubricQuestions[simulationGroupId];
  if (questions) {
    mockGlobalRubricQuestions[simulationGroupId] = questions.filter(q => q.id !== questionId);

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
 */
async function getEvaluationPrompt(simulationGroupId: string): Promise<string> {
  try {
    const data = await apiClient.request<{ system_prompt: string }>(
      `instructor/get_prompt?simulation_group_id=${encodeURIComponent(simulationGroupId)}`
    );

    return data.system_prompt || '';
  } catch (error) {
    console.error('Failed to fetch evaluation prompt:', error);
    // FIX: Return empty string instead of [] as any
    return '';
  }
}

/**
 * Get students for a simulation group
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
    console.error('Failed to fetch students, using mock data:', error);
    return mockStudents[simulationGroupId] || [];
  }
}

/**
 * Get student details by ID
 *
 * FIX: Return undefined instead of [] as any to match StudentDetails | undefined.
 */
function getStudentDetails(studentId: string): StudentDetails | undefined {
  return mockStudentDetails[studentId];
}

/**
 * Get chat attempts for a student and patient
 */
function getChatAttempts(studentId: string, patientId: string): ChatAttempt[] {
  return mockChatAttempts[studentId]?.[patientId] || [];
}

/**
 * Get chat messages for an attempt
 */
function getChatMessages(attemptId: string): ChatMessage[] {
  return mockChatMessages[attemptId] || [];
}

/**
 * Get notes for an attempt
 *
 * FIX: Return empty string instead of [] as any to match string return type.
 */
function getChatNotes(_attemptId: string): string {
  return '';
}

/**
 * Get case-specific questions for a patient
 */
function getCaseSpecificQuestions(_patientId: string): GlobalRubricQuestion[] {
  return [];
}

/**
 * Add a new case-specific question
 *
 * FIX: Changed from async to sync (void) to match InstructorDataService interface.
 * Removed async getManageablePatients call that was called with empty string anyway.
 */
function addCaseSpecificQuestion(patientId: string, question: GlobalRubricQuestion): void {
  if (!mockCaseSpecificQuestions[patientId]) {
    mockCaseSpecificQuestions[patientId] = [];
  }

  const existingQuestion = mockCaseSpecificQuestions[patientId].find(q => q.id === question.id);
  if (existingQuestion) {
    console.log(`Question ${question.id} already exists for patient ${patientId}, skipping duplicate add`);
    return;
  }

  mockCaseSpecificQuestions[patientId].push(question);

  const bankQuestion = mockPatientSpecificQuestionBank.find(q => q.id === question.id);
  if (bankQuestion) {
    if (!bankQuestion.usedByPatients) {
      bankQuestion.usedByPatients = [];
    }
    if (!bankQuestion.usedByPatients.includes(patientId)) {
      bankQuestion.usedByPatients.push(patientId);
    }
  }
}

/**
 * Update a case-specific question
 */
function updateCaseSpecificQuestion(_patientId: string, _question: GlobalRubricQuestion): void {
  // TODO: implement API call
}

/**
 * Delete a case-specific question
 *
 * FIX: Changed from async to sync (void) to match InstructorDataService interface.
 * Removed async getManageablePatients calls that used an empty string group ID.
 */
function deleteCaseSpecificQuestion(patientId: string, questionId: string): void {
  const questions = mockCaseSpecificQuestions[patientId];
  if (questions) {
    mockCaseSpecificQuestions[patientId] = questions.filter(q => q.id !== questionId);

    const bankQuestion = mockPatientSpecificQuestionBank.find(q => q.id === questionId);
    if (bankQuestion && bankQuestion.usedByPatients) {
      bankQuestion.usedByPatients = bankQuestion.usedByPatients.filter(
        pId => pId !== patientId
      );
    }
  }
}

/**
 * Get case materials for a patient
 */
function getCaseMaterials(_patientId: string): CaseMaterial[] {
  return [];
}

/**
 * Add a new case material
 */
function addCaseMaterial(_patientId: string, _material: CaseMaterial): void {
  // TODO: implement API call
}

/**
 * Update a case material
 */
function updateCaseMaterial(_patientId: string, _material: CaseMaterial): void {
  // TODO: implement API call
}

/**
 * Delete a case material
 */
function deleteCaseMaterial(_patientId: string, _materialId: string): void {
  // TODO: implement API call
}

/**
 * Get the default patient prompt
 */
function getDefaultPatientPrompt(): string {
  return '';
}

/**
 * Get global question bank
 */
async function getGlobalQuestionBank(): Promise<QuestionBankItem[]> {
  try {
    const rows = await apiClient.request<any[]>('instructor/question_bank');
    return rows.map(mapBackendToQuestionBankItem);
  } catch (error) {
    console.error('Failed to fetch global question bank from API, falling back to mock data:', error);
    return [...mockGlobalQuestionBank];
  }
}

/**
 * Get patient-specific question bank
 */
function getPatientSpecificQuestionBank(): QuestionBankItem[] {
  return [...mockPatientSpecificQuestionBank];
}

/**
 * Add a question to the global question bank
 */
function addToGlobalQuestionBank(question: QuestionBankItem): void {
  if (!question.usedBySimulationGroups) {
    question.usedBySimulationGroups = [];
  }
  mockGlobalQuestionBank.push(question);
}

/**
 * Add a question to the patient-specific question bank
 */
function addToPatientSpecificQuestionBank(question: QuestionBankItem): void {
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
 */
function getPatientCaseSpecificQuestionIds(patientId: string): Set<string> {
  const questions = mockCaseSpecificQuestions[patientId] || [];
  return new Set(questions.map(q => q.id));
}

/**
 * Update patient's case-specific questions based on question IDs
 */
function updatePatientCaseSpecificQuestions(patientId: string, questionIds: Set<string>): void {
  console.log(`Updating patient ${patientId} case-specific questions:`, Array.from(questionIds));
}

/**
 * Get simulation groups using a specific question
 */
function getSimulationGroupsUsingQuestion(questionId: string, questionType: 'global' | 'patientSpecific' = 'global'): string[] {
  const questionBank = questionType === 'global' ? mockGlobalQuestionBank : mockPatientSpecificQuestionBank;
  const question = questionBank.find(q => q.id === questionId);
  return question ? [...question.usedBySimulationGroups] : [];
}

/**
 * Get patients using a specific patient-specific question
 */
function getPatientsUsingQuestion(questionId: string): string[] {
  const question = mockPatientSpecificQuestionBank.find(q => q.id === questionId);
  return question && question.usedByPatients ? [...question.usedByPatients] : [];
}

/**
 * Check if a question is used by any simulation group
 */
function isQuestionInUse(questionId: string, questionType: 'global' | 'patientSpecific' = 'global'): boolean {
  const groups = getSimulationGroupsUsingQuestion(questionId, questionType);
  return groups.length > 0;
}

/**
 * Get questions assigned to a simulation group, optionally filtered by persona
 */
async function getSimulationGroupQuestions(simulationGroupId: string, personaId?: string): Promise<any[]> {
  let endpoint = `instructor/simulation_group_questions?simulation_group_id=${simulationGroupId}`;
  if (personaId) {
    endpoint += `&persona_id=${personaId}`;
  }
  return apiClient.request<any[]>(endpoint);
}

/**
 * Assign a question to a simulation group for a specific persona
 */
async function assignQuestionToGroup(
  simulationGroupId: string,
  questionId: string,
  personaId: string,
  options?: { weight_override?: number; max_score_override?: number; order?: number }
): Promise<any> {
  return apiClient.request<any>(
    `instructor/simulation_group_questions?simulation_group_id=${simulationGroupId}&question_id=${questionId}&persona_id=${personaId}`,
    { method: 'POST', body: options }
  );
}

/**
 * Unassign a question from a simulation group
 */
async function unassignQuestion(groupQuestionId: string): Promise<any> {
  return apiClient.request<any>(
    `instructor/simulation_group_questions?group_question_id=${groupQuestionId}`,
    { method: 'DELETE' }
  );
}

/**
 * Update a question assignment (weight, max score, order)
 */
async function updateQuestionAssignment(groupQuestionId: string, updates: any): Promise<any> {
  return apiClient.request<any>(
    `instructor/simulation_group_questions?group_question_id=${groupQuestionId}`,
    { method: 'PUT', body: updates }
  );
}

/**
 * Instructor data service object
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
  uploadPatientFile,
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
  getScoreDistribution,
  getSimulationGroupQuestions,
  assignQuestionToGroup,
  unassignQuestion,
  updateQuestionAssignment
};

// Keep backward-compatible export
export const mockInstructorDataService = instructorService;