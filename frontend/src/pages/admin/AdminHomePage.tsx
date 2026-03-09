import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import OrganizationCard from '@/components/OrganizationCard';
import CreateOrganizationDialog from '@/components/CreateOrganizationDialog';
import { Button } from '@/components/ui/button';
import { mockAdminDataService, type Organization } from '@/services/adminService';
import { getSimulationGroupColor } from '@/lib/colors';

/**
 * AdminHomePage Component
 * 
 * Main page component for the admin dashboard.
 * Displays sample organizations that can be used.
 */
function AdminHomePage() {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Load organizations from mock data service and store in state
  const [organizations, setOrganizations] = useState<Organization[]>(() => mockAdminDataService.getOrganizations());

  // Load user data from mock data service with error handling
  let user = mockAdminDataService.getCurrentUser();

  if (!user || !user.name) {
    console.warn('User data is missing or invalid, using default values');
    user = {
      name: 'Admin',
      avatarUrl: undefined
    };
  }

  const handleSignOut = () => {
    try {
      console.log('Sign out clicked');
      navigate('/login');
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  };

  const handleUseOrganisation = (organizationId: string) => {
    try {
      console.log(`Using organization: ${organizationId}`);
      // Navigate to organization page
      navigate(`/admin/organization/${organizationId}`);
    } catch (error) {
      console.error('Error using organization:', error);
    }
  };

  const handleCreateNewOrganization = () => {
    try {
      setIsCreateDialogOpen(true);
    } catch (error) {
      console.error('Error opening create organization dialog:', error);
    }
  };

  const handleCreateOrganizationSubmit = (data: { name: string; description: string; aiPersonaTitle: string; userRoleTitle: string; systemPrompt: string }) => {
    try {
      console.log('Creating organization with data:', data);
      
      // Create new organization object
      const newOrganization: Organization = {
        id: `org-${Date.now()}`,
        name: data.name,
        aiPersona: data.aiPersonaTitle,
        userRole: data.userRoleTitle,
        icon: 'building',
        iconColor: getSimulationGroupColor(organizations.length),
      };

      // Add to state
      setOrganizations(prevOrgs => [...prevOrgs, newOrganization]);

      // Future: Call API to create organization
      // const createdOrg = await api.createOrganization(data);
      // setOrganizations(prevOrgs => [...prevOrgs, createdOrg]);
    } catch (error) {
      console.error('Error creating organization:', error);
    }
  };

  return (
    <PageContainer>
      <DashboardHeader
        title="Admin Dashboard"
        subtitle="Home Page"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
        showStudentViewButton={true}
        onStudentView={() => navigate('/student')}
      />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {/* Header section */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Sample Organizations</h2>
          <Button
            onClick={handleCreateNewOrganization}
            className="bg-gray-900 hover:bg-gray-800 text-white px-6"
          >
            Create New Organization
          </Button>
        </div>

        {/* Organizations grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organizations.map((org) => (
            <OrganizationCard
              key={org.id}
              name={org.name}
              aiPersona={org.aiPersona}
              userRole={org.userRole}
              icon={org.icon}
              iconColor={org.iconColor}
              onUseOrganisation={() => handleUseOrganisation(org.id)}
            />
          ))}
        </div>
      </main>
      <CreateOrganizationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreateOrganizationSubmit}
      />
    </PageContainer>
  );
}

export default AdminHomePage;
