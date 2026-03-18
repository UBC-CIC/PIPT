/**
 * Admin API Service
 * 
 * Calls real backend admin API endpoints via API Gateway.
 * Falls back gracefully if API calls fail (for local dev without backend).
 * 
 * Backend endpoints used:
 * - GET  /admin/instructors?instructor_email=... → list all instructors
 * - GET  /admin/simulation_groups → list all simulation groups
 * - GET  /admin/groupInstructors?simulation_group_id=... → instructors for a group
 * - GET  /admin/instructorGroups?instructor_email=... → groups for an instructor
 * - POST /admin/elevate_instructor?email=... → make user an instructor
 * - POST /admin/lower_instructor?email=... → demote instructor to student
 * - POST /admin/enroll_instructor?simulation_group_id=...&instructor_email=... → assign to group
 * - DELETE /admin/delete_instructor_enrolments?instructor_email=... → remove all enrollments
 * - DELETE /admin/delete_group_instructor_enrolments?simulation_group_id=... → remove all instructors from group
 * - POST /admin/create_simulation_group → create new group
 * - DELETE /admin/delete_group?simulation_group_id=... → delete group
 * - POST /admin/updateGroupAccess → update group settings
 */

import { apiClient } from '@/lib/api-client';
import { authService } from '@/lib/auth';
import type { QuestionBankItem } from '@/services/instructorService';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface AdminInstructor {
  user_email: string;
  first_name: string;
  last_name: string;
}

export interface AdminSimulationGroup {
  simulation_group_id: string;
  group_name: string;
  group_description: string;
  group_access_code: string;
  group_student_access: boolean;
  system_prompt: string;
  // admin_voice_enabled: boolean;      // uncomment after migration 005 runs
  // instructor_voice_enabled: boolean;  // uncomment after migration 005 runs
  organization_id?: string;
  persona_count?: number;
  student_count?: number;
  instructor_count?: number;
}

export interface InstructorGroup {
  simulation_group_id: string;
  group_name: string;
  group_description: string;
}

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Get all users with the instructor role
 */
export async function getAllInstructors(): Promise<AdminInstructor[]> {
  const user = await authService.getCurrentUser();
  if (!user?.email) throw new Error('Not authenticated');

  return apiClient.request<AdminInstructor[]>(
    `admin/instructors?instructor_email=${encodeURIComponent(user.email)}`
  );
}

/**
 * Get all simulation groups
 */
export async function getAllSimulationGroups(): Promise<AdminSimulationGroup[]> {
  return apiClient.request<AdminSimulationGroup[]>('admin/simulation_groups');
}

/**
 * Get instructors enrolled in a specific simulation group
 */
export async function getGroupInstructors(simulationGroupId: string): Promise<AdminInstructor[]> {
  return apiClient.request<AdminInstructor[]>(
    `admin/groupInstructors?simulation_group_id=${encodeURIComponent(simulationGroupId)}`
  );
}

/**
 * Get simulation groups an instructor is enrolled in
 */
export async function getInstructorGroups(instructorEmail: string): Promise<InstructorGroup[]> {
  return apiClient.request<InstructorGroup[]>(
    `admin/instructorGroups?instructor_email=${encodeURIComponent(instructorEmail)}`
  );
}

/**
 * Elevate a user to instructor role. If the user doesn't exist, creates them as instructor.
 */
export async function elevateToInstructor(email: string): Promise<{ message: string }> {
  return apiClient.request<{ message: string }>(
    `admin/elevate_instructor?email=${encodeURIComponent(email)}`,
    { method: 'POST' }
  );
}

/**
 * Demote an instructor back to student role and remove all instructor enrollments.
 */
export async function lowerInstructor(email: string): Promise<{ message: string }> {
  return apiClient.request<{ message: string }>(
    `admin/lower_instructor?email=${encodeURIComponent(email)}`,
    { method: 'POST' }
  );
}

/**
 * Enroll an instructor in a simulation group.
 * This also creates student_interactions for all patients in the group.
 */
export async function enrollInstructorInGroup(
  simulationGroupId: string,
  instructorEmail: string
): Promise<{ message: string }> {
  return apiClient.request<{ message: string }>(
    `admin/enroll_instructor?simulation_group_id=${encodeURIComponent(simulationGroupId)}&instructor_email=${encodeURIComponent(instructorEmail)}`,
    { method: 'POST' }
  );
}

/**
 * Remove all instructor enrollments for a specific instructor (across all groups).
 */
export async function deleteInstructorEnrollments(instructorEmail: string): Promise<{ message: string }> {
  return apiClient.request<{ message: string }>(
    `admin/delete_instructor_enrolments?instructor_email=${encodeURIComponent(instructorEmail)}`,
    { method: 'DELETE' }
  );
}

/**
 * Remove all instructor enrollments from a specific group.
 */
export async function deleteGroupInstructorEnrollments(simulationGroupId: string): Promise<{ message: string }> {
  return apiClient.request<{ message: string }>(
    `admin/delete_group_instructor_enrolments?simulation_group_id=${encodeURIComponent(simulationGroupId)}`,
    { method: 'DELETE' }
  );
}

/**
 * Add an instructor to a simulation group.
 * Combines elevate (if needed) + enroll in one call sequence.
 */
export async function addInstructorToGroup(
  simulationGroupId: string,
  instructorEmail: string
): Promise<void> {
  // First ensure the user has the instructor role
  await elevateToInstructor(instructorEmail);
  // Then enroll them in the group
  await enrollInstructorInGroup(simulationGroupId, instructorEmail);
}

/**
 * Remove an instructor from a specific simulation group.
 * This removes their enrollment but keeps their instructor role.
 * 
 * Note: The backend doesn't have a single-group unenroll endpoint,
 * so we delete all instructor enrollments and re-enroll in remaining groups.
 * TODO: Add a targeted DELETE /admin/unenroll_instructor endpoint to the backend.
 */
export async function removeInstructorFromGroup(
  simulationGroupId: string,
  instructorEmail: string
): Promise<void> {
  // Get all groups this instructor is in
  const groups = await getInstructorGroups(instructorEmail);
  const remainingGroups = groups.filter(g => g.simulation_group_id !== simulationGroupId);

  // Delete all instructor enrollments
  await deleteInstructorEnrollments(instructorEmail);

  // Re-enroll in remaining groups
  for (const group of remainingGroups) {
    await enrollInstructorInGroup(group.simulation_group_id, instructorEmail);
  }
}

/**
 * Create a new simulation group
 */
export async function createSimulationGroup(params: {
  group_name: string;
  group_description: string;
  group_student_access: boolean;
  system_prompt: string;
  // admin_voice_enabled?: boolean;      // uncomment after migration 005 runs
  // instructor_voice_enabled?: boolean;  // uncomment after migration 005 runs
}): Promise<AdminSimulationGroup> {
  return apiClient.request<AdminSimulationGroup>(
    `admin/create_simulation_group`,
    {
      method: 'POST',
      body: {
        group_name: params.group_name,
        group_description: params.group_description,
        group_student_access: params.group_student_access,
        system_prompt: params.system_prompt,
        // ...(params.admin_voice_enabled !== undefined && { admin_voice_enabled: params.admin_voice_enabled }),
        // ...(params.instructor_voice_enabled !== undefined && { instructor_voice_enabled: params.instructor_voice_enabled }),
      },
    }
  );
}

/**
 * Delete a simulation group and all related records (cascading).
 */
export async function deleteSimulationGroup(simulationGroupId: string): Promise<{ message: string }> {
  return apiClient.request<{ message: string }>(
    `admin/delete_group?simulation_group_id=${encodeURIComponent(simulationGroupId)}`,
    { method: 'DELETE' }
  );
}

/**
 * Update group settings (access, empathy, voice).
 */
export async function updateGroupAccess(params: {
  simulation_group_id: string;
  access: boolean;
  // admin_voice_enabled?: boolean;      // uncomment after migration 005 runs
  // instructor_voice_enabled?: boolean;  // uncomment after migration 005 runs
}): Promise<{ message: string }> {
  const queryParams = new URLSearchParams({
    simulation_group_id: params.simulation_group_id,
    access: String(params.access),
    // ...(params.admin_voice_enabled !== undefined && { admin_voice_enabled: String(params.admin_voice_enabled) }),
    // ...(params.instructor_voice_enabled !== undefined && { instructor_voice_enabled: String(params.instructor_voice_enabled) }),
  });

  return apiClient.request<{ message: string }>(
    `admin/updateGroupAccess?${queryParams.toString()}`,
    { method: 'POST' }
  );
}

/**
 * Regenerate the access code for a simulation group.
 */
export async function regenerateAccessCode(simulationGroupId: string): Promise<{ access_code: string }> {
  return apiClient.request<{ access_code: string }>(
    `admin/regenerate_access_code?simulation_group_id=${encodeURIComponent(simulationGroupId)}`,
    { method: 'POST' }
  );
}


// ─── Organization API Functions ──────────────────────────────────────────────

export interface AdminOrganization {
  organization_id: string;
  name: string;
  description: string | null;
  type: string | null;
  ai_persona: string;
  user_role: string;
  icon_color: string;
  system_prompt: string | null;
  created_at: string;
}

/**
 * Get all organizations
 */
export async function getOrganizations(): Promise<AdminOrganization[]> {
  return apiClient.request<AdminOrganization[]>('admin/organizations');
}

/**
 * Get a single organization by ID
 */
export async function getOrganization(organizationId: string): Promise<AdminOrganization> {
  return apiClient.request<AdminOrganization>(
    `admin/organization?organization_id=${encodeURIComponent(organizationId)}`
  );
}

/**
 * Create a new organization
 */
export async function createOrganization(params: {
  name: string;
  description?: string;
  type?: string;
  ai_persona?: string;
  user_role?: string;
  icon_color?: string;
  system_prompt?: string;
}): Promise<AdminOrganization> {
  return apiClient.request<AdminOrganization>('admin/create_organization', {
    method: 'POST',
    body: params,
  });
}

/**
 * Update an existing organization
 */
export async function updateOrganization(
  organizationId: string,
  params: {
    name?: string;
    description?: string;
    type?: string;
    ai_persona?: string;
    user_role?: string;
    icon_color?: string;
    system_prompt?: string;
  }
): Promise<AdminOrganization> {
  return apiClient.request<AdminOrganization>(
    `admin/update_organization?organization_id=${encodeURIComponent(organizationId)}`,
    {
      method: 'PUT',
      body: params,
    }
  );
}

/**
 * Delete an organization and all related records (cascading).
 */
export async function deleteOrganization(organizationId: string): Promise<{ message: string }> {
  return apiClient.request<{ message: string }>(
    `admin/delete_organization?organization_id=${encodeURIComponent(organizationId)}`,
    { method: 'DELETE' }
  );
}


// ─── Question Bank API Functions ─────────────────────────────────────────────

/**
 * Map a snake_case backend question_bank row to a camelCase QuestionBankItem.
 */
export function mapBackendToQuestionBankItem(row: any): QuestionBankItem {
  return {
    id: row.question_id,
    title: row.title,
    questionText: row.question_text,
    clinicalIntent: '',
    evaluationCriteria: row.evaluation_criteria,
    category: row.category,
    difficultyLevel: row.difficulty_level,
    isMandatory: row.is_mandatory ?? false,
    weight: row.weight,
    maxScore: row.max_score,
    isActive: row.is_active ?? true,
    usedBySimulationGroups: [],
  };
}

/**
 * Get all question bank questions for an organization.
 */
export async function getQuestionBankQuestions(organizationId: string): Promise<QuestionBankItem[]> {
  const rows = await apiClient.request<any[]>(
    `admin/question_bank?organization_id=${encodeURIComponent(organizationId)}`
  );
  return rows.map(mapBackendToQuestionBankItem);
}

/**
 * Create a new question bank question for an organization.
 */
export async function createQuestionBankQuestion(
  organizationId: string,
  createdBy: string,
  questionData: any
): Promise<QuestionBankItem> {
  const row = await apiClient.request<any>(
    `admin/question_bank?organization_id=${encodeURIComponent(organizationId)}&created_by=${encodeURIComponent(createdBy)}`,
    {
      method: 'POST',
      body: questionData,
    }
  );
  return mapBackendToQuestionBankItem(row);
}

/**
 * Update an existing question bank question.
 */
export async function updateQuestionBankQuestion(
  questionId: string,
  questionData: any
): Promise<QuestionBankItem> {
  const row = await apiClient.request<any>(
    `admin/question_bank?question_id=${encodeURIComponent(questionId)}`,
    {
      method: 'PUT',
      body: questionData,
    }
  );
  return mapBackendToQuestionBankItem(row);
}

/**
 * Delete (soft-delete) a question bank question.
 */
export async function deleteQuestionBankQuestion(
  questionId: string
): Promise<{ message: string }> {
  return apiClient.request<{ message: string }>(
    `admin/question_bank?question_id=${encodeURIComponent(questionId)}`,
    { method: 'DELETE' }
  );
}
