/**
 * Student Service
 * 
 * Calls real backend API endpoints via API Gateway.
 * Falls back to mock data if API calls fail (for local dev without backend).
 */

import { getSimulationGroupColor } from '@/lib/colors';
import { apiClient } from '@/lib/api-client';
import { authService } from '@/lib/auth';

/**
 * Represents a medical simulation group that students can join
 */
export interface SimulationGroup {
  simulation_group_id: string;              // Unique identifier
  name: string;            // Group name (e.g., "Chronic Pain")
  subtitle: string;        // Always "Medical Simulation Group"
  icon_url?: string;        // Optional icon image URL
  icon_color?: string;      // Fallback color for avatar (hex format)
  student_count?: number;   // Optional count of students (admin view only)
  instructor_count?: number; // Optional count of instructors (admin view only)
  patient_count?: number;   // Optional count of patients (admin view only)
}

/**
 * Represents current user data
 */
export interface UserData {
  name: string;
  email?: string;
  avatarUrl?: string;
}

/**
 * Represents a patient in a simulation group
 */
export interface Patient {
  patient_id: string;            // Unique identifier
  patient_name: string;          // Patient name
  avatarUrl?: string;            // Optional patient image URL
  debrief_status: 'not_started' | 'in_progress' | 'debrief_reached'; // Overall patient case status
  instructor_evaluation: string;  // Instructor evaluation status
}


/**
 * Represents a chat session
 */
export interface Session {
  session_id: string;
  student_interaction_id: string;
  session_name: string;
  last_accessed: string;
  notes?: string;
}

/**
 * Student data service — calls real API, falls back to mock
 */
const mockSimulationGroups: SimulationGroup[] = [
  {
    simulation_group_id: '1',
    name: 'Chronic Pain',
    subtitle: 'Medical Simulation Group',
    icon_color: getSimulationGroupColor(0)
  },
  {
    simulation_group_id: '2',
    name: 'Acne',
    subtitle: 'Medical Simulation Group',
    icon_color: getSimulationGroupColor(1)
  },
  {
    simulation_group_id: '3',
    name: 'Diabetes Management',
    subtitle: 'Medical Simulation Group',
    icon_color: getSimulationGroupColor(2)
  }
];

/**
 * Hardcoded patient data for Phase 1
 */
const mockPatients: Patient[] = [
  {
    patient_id: '1',
    patient_name: 'Pamela',
    avatarUrl: undefined, // Will display initials
    debrief_status: 'in_progress',
    instructor_evaluation: 'Incomplete'
  },
  {
    patient_id: '2',
    patient_name: 'Timothy',
    avatarUrl: undefined, // Will display initials
    debrief_status: 'debrief_reached',
    instructor_evaluation: 'Incomplete'
  },
  {
    patient_id: '3',
    patient_name: 'Sarah',
    avatarUrl: undefined, // Will display initials
    debrief_status: 'not_started',
    instructor_evaluation: 'Incomplete'
  }
];

/**
 * Represents a case material for physical assessment
 */
export interface StudentCaseMaterial {
  id: string;
  title: string;
  description: string;
  type: 'image' | 'video' | 'document' | 'audio';
  group: string;
}

/**
 * Represents a patient file (e.g., uploaded PDF)
 */
export interface PatientFile {
  id: string;
  filename: string;
  description: string;
}

/**
 * Represents a patient's detailed info for chat/dashboard views
 */
export interface PatientDetail {
  id: string | undefined;
  name: string;
  age: number;
  gender: string;
  imageUrl?: string;
  pronouns?: string;
  sex?: string;
  primaryComplaint?: string;
  avatarUrl?: string;
}

/**
 * Represents a chat history entry on the patient dashboard
 */
export interface ChatHistoryEntry {
  id: string;
  name: string;
  completionStatus: string;
  score: string | null;
}

/**
 * Represents key questions coverage data per attempt
 */
export interface KeyQuestionsCoverageData {
  attempt: string;
  attemptNumber: number;
  coverage: number;
}

/**
 * Represents AI debrief data
 */
export interface AIDebriefData {
  summary: string;
  questionsAddressed: string[];
  missedKeyQuestionsCount: number;
  missedQuestionsGuidance: string;
  recommendationFeedback: {
    strengths: string[];
    areasForImprovement: string[];
  };
  suggestedRewrites: {
    original: string;
    suggested: string;
  }[];
  rubricDescription: string;
}

/**
 * Represents a physical assessment activity
 */
export interface AssessmentActivity {
  id: string;
  name: string;
  category: string;
  icon: 'stethoscope' | 'heart' | 'thermometer' | 'eye' | 'ear' | 'activity';
}

/**
 * Represents a chat message (matching database schema)
 */
export interface StudentChatMessage {
  message_id: string;
  chat_id: string;
  student_sent: boolean;
  message_content: string;
  time_sent: string;
  quality_score?: number;
  quality_feedback?: string;
  suggested_rewrite?: string;
}

/**
 * Hardcoded case materials for student chat views
 */
const mockCaseMaterials: StudentCaseMaterial[] = [
  {
    id: '1',
    title: 'Initial Triage Vital Signs',
    description: 'Recorded upon arrival to clinic.',
    type: 'image',
    group: 'Vital Signs',
  },
  {
    id: '2',
    title: '12-Lead Electrocardiogram (ECG)',
    description: 'Standard 12-lead ECG performed during assessment to evaluate cardiac rhythm and possible ischemic changes.',
    type: 'image',
    group: 'Diagnostic Tests',
  },
  {
    id: '3',
    title: 'Lung Auscultation Recording',
    description: 'Audio recording of lung sounds to evaluate respiratory status.',
    type: 'video',
    group: 'Physical Examination',
  },
];

/**
 * Hardcoded patient files
 */
const mockPatientFiles: PatientFile[] = [
  {
    id: '1',
    filename: 'Patient_Information_Upload_Pamela.pdf',
    description: 'No description available',
  },
];

/**
 * Hardcoded patient detail for Pamela (used in chat/dashboard views)
 */
function getMockPatientDetail(patientId: string | undefined): PatientDetail {
  return {
    id: patientId,
    name: 'Pamela',
    age: 56,
    gender: 'Female',
    imageUrl: undefined,
    pronouns: 'she/her',
    sex: 'Female',
    primaryComplaint: 'Chest Pain',
    avatarUrl: undefined,
  };
}

/**
 * Hardcoded chat history for patient dashboard
 */
const mockChatHistory: ChatHistoryEntry[] = [
  {
    id: '1',
    name: 'Attempt 4 - Feb 19, 2026',
    completionStatus: 'In Progress',
    score: null,
  },
  {
    id: '2',
    name: 'Attempt 3 - Feb 18, 2026',
    completionStatus: 'Complete',
    score: '67%',
  },
  {
    id: '3',
    name: 'Attempt 2 - Feb 14, 2026',
    completionStatus: 'Complete',
    score: '88%',
  },
  {
    id: '4',
    name: 'Attempt 1 - Jan 27, 2026',
    completionStatus: 'In Progress',
    score: null,
  },
];

/**
 * Hardcoded key questions coverage data
 */
const mockKeyQuestionsCoverageData: KeyQuestionsCoverageData[] = [
  { attempt: 'Attempt 1', attemptNumber: 1, coverage: 45 },
  { attempt: 'Attempt 2', attemptNumber: 2, coverage: 72 },
  { attempt: 'Attempt 3', attemptNumber: 3, coverage: 58 },
  { attempt: 'Attempt 4', attemptNumber: 4, coverage: 63 },
  { attempt: 'Attempt 5', attemptNumber: 5, coverage: 78 },
  { attempt: 'Attempt 6', attemptNumber: 6, coverage: 82 },
  { attempt: 'Attempt 7', attemptNumber: 7, coverage: 75 },
  { attempt: 'Attempt 8', attemptNumber: 8, coverage: 88 },
  { attempt: 'Attempt 9', attemptNumber: 9, coverage: 91 },
  { attempt: 'Attempt 10', attemptNumber: 10, coverage: 0 },
];

/**
 * Hardcoded AI debrief data
 */
const mockAIDebriefData: AIDebriefData = {
  summary: "You conducted a structured interview and identified the patient's primary concern of worsening shortness of breath. You gathered relevant medication history and symptom duration, but did not fully explore potential triggers or assess inhaler technique. Further questioning and physical assessment could have helped clarify the underlying cause.",
  questionsAddressed: [
    'Asked about symptom duration',
    'Asked about current medications',
    'Asked about previous diagnosis of asthma',
  ],
  missedKeyQuestionsCount: 5,
  missedQuestionsGuidance: "These questions are important to fully assess the patient's condition and guide appropriate clinical decision-making.",
  recommendationFeedback: {
    strengths: [
      'Identified relevant symptoms early',
      'Asked focused medication-related questions',
    ],
    areasForImprovement: [
      'Did not fully assess symptom severity',
      'Missed opportunities to confirm potential causes',
    ],
  },
  suggestedRewrites: [
    {
      original: 'Are you feeling okay lately?',
      suggested: 'When did your shortness of breath begin, and has it changed over time?',
    },
  ],
  rubricDescription: "Compare your recommendations with the answer key provided by your instructor.",
};

/**
 * Hardcoded physical assessment activities
 */
const mockAssessmentActivities: AssessmentActivity[] = [
  { id: '1', name: 'Auscultate Heart Sounds', category: 'Cardiovascular', icon: 'heart' },
  { id: '2', name: 'Auscultate Lung Sounds', category: 'Respiratory', icon: 'stethoscope' },
  { id: '3', name: 'Check Blood Pressure', category: 'Vital Signs', icon: 'activity' },
  { id: '4', name: 'Measure Temperature', category: 'Vital Signs', icon: 'thermometer' },
  { id: '5', name: 'Examine Pupils', category: 'Neurological', icon: 'eye' },
  { id: '6', name: 'Otoscopic Examination', category: 'HEENT', icon: 'ear' },
  { id: '7', name: 'Palpate Abdomen', category: 'Abdominal', icon: 'activity' },
  { id: '8', name: 'Check Peripheral Pulses', category: 'Cardiovascular', icon: 'heart' },
];

/**
 * Hardcoded chat history messages (for read-only chat history view)
 */
const mockChatHistoryMessages: StudentChatMessage[] = [
  {
    message_id: 'msg-1',
    chat_id: '',
    student_sent: true,
    message_content: 'Hello, I\'m here to help you today. Can you tell me what brings you in?',
    time_sent: '2026-02-18T10:00:00Z',
  },
  {
    message_id: 'msg-2',
    chat_id: '',
    student_sent: false,
    message_content: 'I\'ve been having chest pain for the past few hours.',
    time_sent: '2026-02-18T10:00:30Z',
  },
  {
    message_id: 'msg-3',
    chat_id: '',
    student_sent: true,
    message_content: 'I understand. Can you describe the pain? Is it sharp, dull, or pressure-like?',
    time_sent: '2026-02-18T10:01:00Z',
  },
  {
    message_id: 'msg-4',
    chat_id: '',
    student_sent: false,
    message_content: 'It feels like pressure, like my chest is being constricted.',
    time_sent: '2026-02-18T10:01:45Z',
  },
];

/**
 * Hardcoded saved note for chat history view
 */
const mockSavedNote = 'Patient reports chest pain with pressure-like sensation. Need to check ECG results and vital signs. Considering cardiac workup.';

/**
 * Get case materials for student views
 */
function getCaseMaterials(): StudentCaseMaterial[] {
  return mockCaseMaterials;
}

/**
 * Get patient files
 */
function getPatientFiles(): PatientFile[] {
  return mockPatientFiles;
}

/**
 * Get patient detail by ID
 */
function getPatientDetail(patientId: string | undefined): PatientDetail {
  return getMockPatientDetail(patientId);
}

/**
 * Get chat history entries for patient dashboard
 */
function getChatHistory(): ChatHistoryEntry[] {
  return mockChatHistory;
}

/**
 * Get key questions coverage data
 */
function getKeyQuestionsCoverageData(): KeyQuestionsCoverageData[] {
  return mockKeyQuestionsCoverageData;
}

/**
 * Get AI debrief data
 */
function getAIDebriefData(): AIDebriefData {
  return mockAIDebriefData;
}

/**
 * Get physical assessment activities
 */
function getAssessmentActivities(): AssessmentActivity[] {
  return mockAssessmentActivities;
}

/**
 * Get chat history messages for read-only view
 */
function getChatHistoryMessages(chatId: string): StudentChatMessage[] {
  return mockChatHistoryMessages.map(msg => ({ ...msg, chat_id: chatId }));
}

/**
 * Get saved note for a chat
 */
function getSavedNote(): string {
  return mockSavedNote;
}

/**
 * Get simulation groups — calls API, falls back to mock
 */
async function getSimulationGroups(): Promise<SimulationGroup[]> {
  try {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const data = await apiClient.request<SimulationGroup[]>(
      `/student/simulation_groups?email=${encodeURIComponent(user.email)}`
    );
    return data.map((g, i) => ({
      ...g,
      subtitle: 'Medical Simulation Group',
      icon_color: g.icon_color || getSimulationGroupColor(i),
    }));
  } catch (error) {
    console.error('Failed to fetch simulation groups, using mock data:', error);
    return mockSimulationGroups;
  }
}

/**
 * Get current user data
 */
async function getCurrentUser(): Promise<UserData | null> {
  try {
    const user = await authService.getCurrentUser();
    if (!user) return null;
    return { name: user.username || user.email, email: user.email };
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

/**
 * Get patients for a simulation group
 */
async function getPatients(simulationGroupId: string): Promise<Patient[]> {
  try {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const data = await apiClient.request<Patient[]>(
      `/student/patients?email=${encodeURIComponent(user.email)}&simulation_group_id=${encodeURIComponent(simulationGroupId)}`
    );
    return data;
  } catch (error) {
    console.error('Failed to fetch patients, using mock data:', error);
    return mockPatients;
  }
}

/**
 * Join a simulation group by access code
 */
async function joinGroup(accessCode: string): Promise<{ success: boolean }> {
  try {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    await apiClient.request(
      `/student/join_group?email=${encodeURIComponent(user.email)}&access_code=${encodeURIComponent(accessCode)}`,
      { method: 'POST' }
    );
    return { success: true };
  } catch (error) {
    console.error('Failed to join group:', error);
    return { success: false };
  }
}

/**
 * Create a new session
 */
async function createSession(simulationGroupId: string, patientId: string, sessionName: string): Promise<Session | null> {
  try {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const data = await apiClient.request<Session[]>(
      `/student/create_session?email=${encodeURIComponent(user.email)}&simulation_group_id=${encodeURIComponent(simulationGroupId)}&patient_id=${encodeURIComponent(patientId)}&session_name=${encodeURIComponent(sessionName)}`,
      { method: 'POST' }
    );

    return data[0] || null;
  } catch (error) {
    console.error('Failed to create session:', error);
    return null;
  }
}

/**
 * Student service — public API used by pages
 */
export const studentService = {
  getSimulationGroups,
  getCurrentUser,
  getPatients,
  joinGroup,
  createSession,
  getPatientDetail,
  getChatHistory,
  getKeyQuestionsCoverageData,
};

/**
 * Mock data service object
 * Provides methods to retrieve hardcoded data for now
 */
export const mockDataService = {
  getSimulationGroups,
  getCurrentUser,
  getPatients,
  getCaseMaterials,
  getPatientFiles,
  getPatientDetail,
  getChatHistory,
  getKeyQuestionsCoverageData,
  getAIDebriefData,
  getAssessmentActivities,
  getChatHistoryMessages,
  getSavedNote,
};

