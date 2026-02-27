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
 * Mock data service interface
 */
export interface MockDataService {
  getSimulationGroups: () => SimulationGroup[];
  getCurrentUser: () => UserData;
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
 * Mock data service object
 * Provides methods to retrieve hardcoded data for now
 */
export const mockDataService: MockDataService = {
  getSimulationGroups,
  getCurrentUser
};
