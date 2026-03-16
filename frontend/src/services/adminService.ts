/**
 * Admin Service
 * 
 * Mock data service for admin functionality
 */

export interface Organization {
  id: string;
  name: string;
  ai_persona: string;
  user_role: string;
  icon: 'building';
  icon_color: string;
}

export interface AdminUser {
  name: string;
  avatarUrl?: string;
}

/**
 * Represents an instructor in a simulation group
 */
export interface Instructor {
  id: string;
  name: string;
  email: string;
  date_joined: string;
}

/**
 * Represents a prompt history entry
 */
export interface PromptHistoryEntry {
  id: number;
  text: string;
  savedAt: string;
}

/**
 * Mock data service for admin operations
 */
class AdminDataService {
  private organizations: Organization[] = [
    {
      id: 'org-1',
      name: 'Pharmacy',
      ai_persona: 'Patient',
      user_role: 'Student',
      icon: 'building',
      icon_color: '#03045E',
    },
    {
      id: 'org-2',
      name: 'Legal',
      ai_persona: 'Law Client',
      user_role: 'Legal Advisor',
      icon: 'building',
      icon_color: '#0077B6',
    },
  ];

  private currentUser: AdminUser = {
    name: 'Admin User',
    avatarUrl: undefined,
  };

  private instructors: Instructor[] = [
    { id: 'inst-1', name: 'Tom Doe', email: 'email1@random.com', date_joined: '1/1/2025' },
    { id: 'inst-2', name: 'Mary Jane', email: 'mary.jane@email.com', date_joined: '30/2/2025' },
  ];

  private promptHistory: PromptHistoryEntry[] = [
    { id: 1, text: 'Previous version of the prompt...', savedAt: '2/9/2026, 11:05:11 AM' },
  ];

  /**
   * Get all organizations
   */
  getOrganizations(): Organization[] {
    return [...this.organizations];
  }

  /**
   * Get current admin user
   */
  getCurrentUser(): AdminUser {
    return { ...this.currentUser };
  }

  /**
   * Use an organization (navigate to it)
   */
  useOrganization(organizationId: string): void {
    console.log(`Using organization: ${organizationId}`);
    // Future: API call to set active organization
  }

  /**
   * Get mock instructors
   */
  getInstructors(): Instructor[] {
    return [...this.instructors];
  }

  /**
   * Add an instructor
   */
  addInstructor(instructor: Instructor): void {
    this.instructors.push(instructor);
  }

  /**
   * Remove an instructor by ID
   */
  removeInstructor(instructorId: string): void {
    this.instructors = this.instructors.filter(i => i.id !== instructorId);
  }

  /**
   * Get prompt history
   */
  getPromptHistory(): PromptHistoryEntry[] {
    return [...this.promptHistory];
  }
}

export const mockAdminDataService = new AdminDataService();
