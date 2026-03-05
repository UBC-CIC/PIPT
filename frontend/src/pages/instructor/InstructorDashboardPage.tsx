import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '@/components/DashboardHeader';
import SimulationGroupsSection from '@/components/SimulationGroupsSection';
import CreateSimulationGroupDialog from '@/components/CreateSimulationGroupDialog';
import { mockInstructorDataService, type InstructorSimulationGroup } from '@/services/instructorService';
import { getSimulationGroupColor } from '@/lib/colors';

/**
 * InstructorDashboardPage Component
 * 
 * Main page component for the instructor dashboard.
 * Similar to student dashboard but with instructor-specific actions.
 */
function InstructorDashboardPage() {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Load simulation groups from mock data service and store in state
  const [groups, setGroups] = useState<InstructorSimulationGroup[]>(() => mockInstructorDataService.getSimulationGroups());
  
  // Load user data from mock data service with error handling
  let user = mockInstructorDataService.getCurrentUser();
  
  if (!user || !user.name) {
    console.warn('User data is missing or invalid, using default values');
    user = {
      name: 'Instructor',
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

  const handleCreateGroupSubmit = (data: { name: string; description: string; active: boolean; enableVoice: boolean }) => {
    try {
      console.log('Creating group with data:', data);
      
      // Create new group object
      const newGroup: InstructorSimulationGroup = {
        id: `group-${Date.now()}`, // Temporary ID until backend provides one
        name: data.name,
        subtitle: 'Medical Simulation Group',
        iconColor: getSimulationGroupColor(groups.length), // Use next color in palette
        accessCode: mockInstructorDataService.generateAccessCode(`group-${Date.now()}`),
        studentCount: 0,
        patientCount: 0
      };
      
      // Add to state - will be replaced with API call later
      setGroups(prevGroups => [...prevGroups, newGroup]);
      
      // Future: Call API to create group
      // const createdGroup = await api.createGroup(data);
      // setGroups(prevGroups => [...prevGroups, createdGroup]);
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const handleViewAnalytics = (groupId: string) => {
    try {
      console.log(`View analytics for group: ${groupId}`);
      // Navigate to simulation group page
      navigate(`/instructor/group/${groupId}`);
    } catch (error) {
      console.error('Error viewing analytics:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <DashboardHeader
        title="Instructor Dashboard"
        subtitle="Home Page"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
        onStudentView={handleStudentView}
        showStudentViewButton={true}
      />
      <main className="px-8 py-6">
        <SimulationGroupsSection
          groups={groups}
          onJoinGroup={handleCreateGroup}
          onContinueTraining={handleViewAnalytics}
          joinButtonText="+ Create New Group"
          actionButtonText="View Analytics"
          descriptionText="Create simulation groups and view analytics."
        />
      </main>
      <CreateSimulationGroupDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreateGroupSubmit}
      />
    </div>
  );
}

export default InstructorDashboardPage;
