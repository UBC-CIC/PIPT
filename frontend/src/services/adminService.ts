/**
 * Admin Service
 * 
 * Mock data service for admin functionality
 */

export interface Organization {
  id: string;
  name: string;
  aiPersona: string;
  userRole: string;
  icon: 'building';
  iconColor: string;
}

export interface AdminUser {
  name: string;
  avatarUrl?: string;
}

/**
 * Mock data service for admin operations
 */
class AdminDataService {
  private organizations: Organization[] = [
    {
      id: 'org-1',
      name: 'Pharmacy',
      aiPersona: 'Patient',
      userRole: 'Student',
      icon: 'building',
      iconColor: '#03045E',
    },
    {
      id: 'org-2',
      name: 'Legal',
      aiPersona: 'Law Client',
      userRole: 'Legal Advisor',
      icon: 'building',
      iconColor: '#0077B6',
    },
  ];

  private currentUser: AdminUser = {
    name: 'Admin User',
    avatarUrl: undefined,
  };

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
}

export const mockAdminDataService = new AdminDataService();
