import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import SimulationGroupsSection from '@/components/SimulationGroupsSection';
import CreateSimulationGroupDialog from '@/components/CreateSimulationGroupDialog';
import { instructorService, type InstructorSimulationGroup } from '@/services/instructorService';
import { useAuth } from '@/App';
import LoadingIndicator from '@/components/LoadingIndicator';

/**
 * InstructorDashboardPage Component
 * 
 * Main page component for the instructor dashboard.
 * Similar to student dashboard but with instructor-specific actions.
 */
function InstructorDashboardPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [groups, setGroups] = useState<InstructorSimulationGroup[]>([]);
  const [user, setUser] = useState<{ name: string; avatarUrl?: string }>({ name: 'Instructor', avatarUrl: undefined });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [groupsData, userData] = await Promise.all([
          instructorService.getSimulationGroups(),
          instructorService.getCurrentUser(),
        ]);
        setGroups(groupsData);
        setUser(userData);
      } catch (error) {
        console.error('Error loading instructor dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSignOut = async () => {
    try {
      console.log('Sign out clicked');
      await signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  };

  const handleStudentView = () => {
    try {
      console.log('Switching to student view');
      navigate('/student');
    } catch (error) {
      console.error('Error switching to student view:', error);
    }
  };

  const handleCreateGroup = () => {
    try {
      setIsCreateDialogOpen(true);
    } catch (error) {
      console.error('Error opening create group dialog:', error);
    }
  };

  const handleCreateGroupSubmit = async (data: { name: string; description: string; active: boolean }) => {
    try {
      console.log('Creating group with data:', data);

      const newGroup = await instructorService.createSimulationGroup(data);

      // Add the new group to state
      setGroups(prevGroups => [...prevGroups, newGroup]);

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
      navigate(`/instructor/group/${groupId}`);
    } catch (error) {
      console.error('Error viewing analytics:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingIndicator size="lg" message="Loading..." />
      </div>
    );
  }

  return (
    <PageContainer>
      <DashboardHeader
        title="Instructor Dashboard"
        subtitle="Home Page"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
        onStudentView={handleStudentView}
        showStudentViewButton={true}
      />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <SimulationGroupsSection
          groups={groups.map(g => ({ ...g, name: g.group_name }))}
          onJoinGroup={handleCreateGroup}
          onContinueTraining={handleViewAnalytics}
          joinButtonText="+ Create New Group"
          actionButtonText="Manage Group"
          descriptionText="Create simulation groups and view analytics."
          emptyStateText="You don't have any simulation groups yet. Create one to get started."
          showCounts={true}
          countLabels={{
            students: 'Students',
            instructors: 'Instructors',
            patients: 'Patients'
          }}
        />
      </main>
      <CreateSimulationGroupDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        role="instructor"
        onCreate={handleCreateGroupSubmit}
      />
    </PageContainer>
  );
}


export default InstructorDashboardPage;
