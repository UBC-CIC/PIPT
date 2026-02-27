/**
 * Student Service (Populated with Mock Data for now)
 * 
 * Provides hardcoded data for simulation groups and user information.
 * Designed for easy replacement with APIs
 */

import { getSimulationGroupColor } from '@/lib/colors';

/**
 * Represents a medical simulation group that students can join
 */
export interface SimulationGroup {
  id: string;              // Unique identifier
  name: string;            // Group name (e.g., "Chronic Pain")
  subtitle: string;        // Always "Medical Simulation Group"
  iconUrl?: string;        // Optional icon image URL
  iconColor?: string;      // Fallback color for avatar (hex format)
}

/**
 * Represents current user data
 */
export interface UserData {
  name: string;            // User's full name
  avatarUrl?: string;      // Optional profile picture URL
}

/**
 * Represents a patient in a simulation group
 */
export interface Patient {
  id: string;                    // Unique identifier
  name: string;                  // Patient name
  avatarUrl?: string;            // Optional patient image URL
  llmEvaluation: string;         // LLM evaluation status
  instructorEvaluation: string;  // Instructor evaluation status
}

/**
 * Mock data service interface
 */
export interface MockDataService {
  getSimulationGroups: () => SimulationGroup[];
  getCurrentUser: () => UserData;
  getPatients: () => Patient[];
}

/**
 * Hardcoded simulation groups for Phase 1
 */
const mockSimulationGroups: SimulationGroup[] = [
  {
    id: '1',
    name: 'Chronic Pain',
    subtitle: 'Medical Simulation Group',
    iconColor: getSimulationGroupColor(0)
  },
  {
    id: '2',
    name: 'Acne',
    subtitle: 'Medical Simulation Group',
    iconColor: getSimulationGroupColor(1)
  },
  {
    id: '3',
    name: 'Diabetes Management',
    subtitle: 'Medical Simulation Group',
    iconColor: getSimulationGroupColor(2)
  }
];

/**
 * Hardcoded user data until backend is set up
 */
const mockUserData: UserData = {
  name: 'Alice Smith',
  avatarUrl: undefined // Will display initials "AS"
};

/**
 * Hardcoded patient data for Phase 1
 */
const mockPatients: Patient[] = [
  {
    id: '1',
    name: 'Pamela',
    avatarUrl: undefined, // Will display initials
    llmEvaluation: 'Incomplete',
    instructorEvaluation: 'Incomplete'
  },
  {
    id: '2',
    name: 'Timothy',
    avatarUrl: undefined, // Will display initials
    llmEvaluation: 'Complete',
    instructorEvaluation: 'Incomplete'
  }
];

/**
 * Get all available simulation groups
 * 
 * @returns Array of simulation groups
 */
function getSimulationGroups(): SimulationGroup[] {
  return mockSimulationGroups;
}

/**
 * Get current user data
 * 
 * @returns User data object
 */
function getCurrentUser(): UserData {
  return mockUserData;
}

/**
 * Get all patients for the current simulation group
 * 
 * @returns Array of patients
 */
function getPatients(): Patient[] {
  return mockPatients;
}

/**
 * Mock data service object
 * Provides methods to retrieve hardcoded data for now
 */
export const mockDataService: MockDataService = {
  getSimulationGroups,
  getCurrentUser,
  getPatients
};
