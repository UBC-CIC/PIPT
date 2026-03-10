import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import SimulationGroupsSection from '@/components/SimulationGroupsSection';
import CreateSimulationGroupDialog from '@/components/CreateSimulationGroupDialog';
import { mockAdminDataService } from '@/services/adminService';
import { instructorService, type InstructorSimulationGroup } from '@/services/instructorService';
import { UI_COLORS } from '@/lib/colors';
import { useAuth } from '@/App';

/**
 * AdminOrganizationPage Component
 * 
 * Page for viewing and managing simulation groups within a specific organization.
 */
function AdminOrganizationPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { organizationId } = useParams<{ organizationId: string }>();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [groups, setGroups] = useState<InstructorSimulationGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Get organization details
  const organizations = mockAdminDataService.getOrganizations();
  const organization = organizations.find(org => org.id === organizationId);

  // Load user data from mock data service with error handling
  let user = mockAdminDataService.getCurrentUser();

  if (!user || !user.name) {
    console.warn('User data is missing or invalid, using default values');
    user = {
      name: 'Admin',
      avatarUrl: undefined
    };
  }

  // Load simulation groups asynchronously
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const groupsData = await instructorService.getSimulationGroups();
        setGroups(groupsData);
      } catch (error) {
        console.error('Failed to load simulation groups:', error);
      } finally {
        setLoading(false);
      }
    };
    loadGroups();
  }, []);

  const handleSignOut = async () => {
    try {
      console.log('Sign out clicked');
      await signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  };

  const handleBackToAllOrganizations = () => {
    try {
      navigate('/admin');
    } catch (error) {
      console.error('Error navigating back to organizations:', error);
    }
  };

  const handleCreateGroup = () => {
    try {
      setIsCreateDialogOpen(true);
    } catch (error) {
      console.error('Error opening create group dialog:', error);
    }
  };

  const handleCreateGroupSubmit = async (data: { name: string; description: string; instructors: string; systemPrompt: string; active: boolean; enableVoice: boolean }) => {
    try {
      console.log('Creating group with data:', data);

      // Call the real API via instructorService
      const createdGroup = await instructorService.createSimulationGroup(data);

      // Add the real group from backend to state
      setGroups(prevGroups => [...prevGroups, createdGroup]);

      // Close the dialog
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating group:', error);
      // TODO: Show error toast to user
    }
  };

  const handleViewAnalytics = (groupId: string) => {
    try {
      console.log(`View analytics for group: ${groupId}`);
      // Navigate to simulation group page
      navigate(`/admin/organization/${organizationId}/group/${groupId}`);
    } catch (error) {
      console.error('Error viewing analytics:', error);
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    try {
      const group = groups.find(g => g.simulation_group_id === groupId);
      const groupName = group ? group.group_name : 'this simulation group';
      
      // Show confirmation alert
      const confirmed = window.confirm(`Are you sure you want to delete ${groupName}? This action cannot be undone.`);
      
      if (confirmed) {
        console.log(`Delete group: ${groupId}`);
        // Remove from state
        setGroups(prevGroups => prevGroups.filter(g => g.simulation_group_id !== groupId));
        // Future: Call API to delete group
      }
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <PageContainer>
      <DashboardHeader
        title="Admin Dashboard"
        subtitle="Organization Page"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
        showStudentViewButton={true}
        onStudentView={() => navigate('/student')}
      />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {/* Back to All Organizations button */}
        <div className="mb-6">
          <button
            onClick={handleBackToAllOrganizations}
            className="font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 transition-colors"
            style={{ color: UI_COLORS.text.body }}
            onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
            onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Organizations
          </button>
        </div>

        <SimulationGroupsSection
          groups={groups}
          onJoinGroup={handleCreateGroup}
          onContinueTraining={handleViewAnalytics}
          joinButtonText="+ Create New Group"
          actionButtonText="View Analytics"
          descriptionText="Edit simulation groups and view analytics."
          sectionTitle={organization ? `${organization.name} Simulation Groups` : 'Simulation Groups'}
          showCounts={true}
          showDeleteButton={true}
          onDeleteGroup={handleDeleteGroup}
          countLabels={{
            students: organization?.userRole || 'Students',
            instructors: 'Instructors',
            patients: organization?.aiPersona || 'Patients'
          }}
        />
      </main>
      <CreateSimulationGroupDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreateGroupSubmit}
      />
    </PageContainer>
  );
}

export default AdminOrganizationPage;
