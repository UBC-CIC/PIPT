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
  id: string;              // Unique identifier
  name: string;            // Group name (e.g., "Chronic Pain")
  subtitle: string;        // Always "Medical Simulation Group"
  iconUrl?: string;        // Optional icon image URL
  iconColor?: string;      // Fallback color for avatar (hex format)
  studentCount?: number;   // Optional count of students (admin view only)
  instructorCount?: number; // Optional count of instructors (admin view only)
  patientCount?: number;   // Optional count of patients (admin view only)
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
  patient_id: string;
  patient_name: string;
  patient_age?: number;
  patient_gender?: string;
  patient_number?: number;
  llm_completion?: boolean;
  student_interaction_id?: string;
  patient_score?: number;
  last_accessed?: string;
  is_completed?: boolean;
  // Frontend display aliases
  id: string;
  name: string;
  avatarUrl?: string;
  debriefStatus: 'not_started' | 'in_progress' | 'debrief_reached';
  instructorEvaluation: string;
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
export const studentService = {
  /**
   * Get simulation groups for the current user
   */
  async getSimulationGroups(): Promise<SimulationGroup[]> {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const data = await apiClient.request<SimulationGroup[]>(
        `/student/simulation_group?email=${encodeURIComponent(user.email)}`
      );

      // Map backend fields to frontend display fields
      return data.map((group, index) => ({
        ...group,
        id: group.simulation_group_id,
        name: group.group_name,
        subtitle: 'Medical Simulation Group',
        iconColor: getSimulationGroupColor(index),
      }));
    } catch (error) {
      console.error('Failed to fetch simulation groups:', error);
      return [];
    }
  },

  /**
   * Get current user name
   */
  async getCurrentUser(): Promise<UserData> {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const data = await apiClient.request<{ name: string }>(
        `/student/get_name?user_email=${encodeURIComponent(user.email)}`
      );

      return {
        name: data.name || user.email,
        email: user.email,
      };
    } catch (error) {
      console.error('Failed to fetch user name:', error);
      // Fallback to auth user info
      const user = await authService.getCurrentUser();
      return {
        name: user?.email || 'Unknown',
        email: user?.email,
      };
    }
  },

  /**
   * Get patients for a simulation group
   */
  async getPatients(simulationGroupId: string): Promise<Patient[]> {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const data = await apiClient.request<Patient[]>(
        `/student/simulation_group_page?email=${encodeURIComponent(user.email)}&simulation_group_id=${encodeURIComponent(simulationGroupId)}`
      );

      // Map backend fields to frontend display fields
      return data.map((patient) => ({
        ...patient,
        id: patient.patient_id,
        name: patient.patient_name,
        avatarUrl: undefined,
        debriefStatus: patient.is_completed
          ? 'debrief_reached' as const
          : patient.last_accessed
            ? 'in_progress' as const
            : 'not_started' as const,
        instructorEvaluation: patient.patient_score ? `${patient.patient_score}%` : 'Incomplete',
      }));
    } catch (error) {
      console.error('Failed to fetch patients:', error);
      return [];
    }
  },

  /**
   * Get sessions for a specific patient
   */
  async getSessions(simulationGroupId: string, patientId: string): Promise<Session[]> {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const data = await apiClient.request<Session[]>(
        `/student/patient?email=${encodeURIComponent(user.email)}&simulation_group_id=${encodeURIComponent(simulationGroupId)}&patient_id=${encodeURIComponent(patientId)}`
      );

      return data;
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      return [];
    }
  },

  /**
   * Create a new session
   */
  async createSession(simulationGroupId: string, patientId: string, sessionName: string): Promise<Session | null> {
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
  },

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string, simulationGroupId: string, patientId: string): Promise<boolean> {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      await apiClient.request(
        `/student/delete_session?session_id=${encodeURIComponent(sessionId)}&email=${encodeURIComponent(user.email)}&simulation_group_id=${encodeURIComponent(simulationGroupId)}&patient_id=${encodeURIComponent(patientId)}`,
        { method: 'DELETE' }
      );

      return true;
    } catch (error) {
      console.error('Failed to delete session:', error);
      return false;
    }
  },

  /**
   * Create or update user in the database (call after sign up / sign in)
   */
  async createOrUpdateUser(email: string, firstName: string, lastName: string): Promise<void> {
    try {
      const username = `${firstName}_${lastName}`.toLowerCase();
      await apiClient.request(
        `/student/create_user?user_email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}`,
        { method: 'POST' }
      );
    } catch (error) {
      console.error('Failed to create/update user:', error);
    }
  },

  /**
   * Get user roles
   */
  async getUserRoles(): Promise<string[]> {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const data = await apiClient.request<{ roles: string[] }>(
        `/student/get_user_roles?user_email=${encodeURIComponent(user.email)}`
      );

      return data.roles || [];
    } catch (error) {
      console.error('Failed to fetch user roles:', error);
      return [];
    }
  },

  /**
   * Join a simulation group using an access code
   * Returns { success, error? }
   */
  async joinGroup(accessCode: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      await apiClient.request(
        `/student/enroll_student?student_email=${encodeURIComponent(user.email)}&group_access_code=${encodeURIComponent(accessCode)}`,
        { method: 'POST' }
      );

      return { success: true };
    } catch (error) {
      console.error('Failed to join group:', error);
      const message = error instanceof Error ? error.message : 'Failed to join group';
      
      if (message.includes('404')) {
        return { success: false, error: 'Invalid access code or group not available.' };
      }
      return { success: false, error: message };
    }
  },
};

