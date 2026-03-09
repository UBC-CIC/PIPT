import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import SimulationGroupsSection from '@/components/SimulationGroupsSection';
import JoinGroupDialog from '@/components/JoinGroupDialog';
import { mockDataService } from '@/services/studentService';

/**
 * StudentDashboardPage Component
 * 
 * Main page component that orchestrates the student dashboard.
 * Loads simulation groups and user data from mockDataService.
 * Handles sign out, join group, and continue training events.
 */
function StudentDashboardPage() {
  const navigate = useNavigate();
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);

  // Load simulation groups from mock data service
  const groups = mockDataService.getSimulationGroups();

  // Load user data from mock data service with error handling
  let user = mockDataService.getCurrentUser();

  // Error handling for missing user data (Requirement 12.1, 12.2)
  if (!user || !user.name) {
    console.warn('User data is missing or invalid, using default values');
    user = {
      name: 'Student',
      avatarUrl: undefined
    };
  }

  /**
   * Handle sign out event
   * Navigates to login page
   * Future: Will call API to clear session
   *
   * Requirement 8.2
   */
  const handleSignOut = () => {
    try {
      console.log('Sign out clicked');
      // Future: Call API to clear session
      navigate('/login');
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  };

  /**
   * Handle join group event
   * Opens the join group dialog
   *
   * Requirement 6.3
   */
  const handleJoinGroup = () => {
    try {
      setIsJoinDialogOpen(true);
    } catch (error) {
      console.error('Error opening join group dialog:', error);
    }
  };

  /**
   * Handle join group submission
   * Phase 1: Logs access code to console
   * Future: Will call API to join group
   *
   * @param accessCode - The access code entered by the user
   */
  const handleJoinGroupSubmit = (accessCode: string) => {
    try {
      console.log('Joining group with access code:', accessCode);
      // Future: Call API to join group
    } catch (error) {
      console.error('Error joining group:', error);
    }
  };

  /**
   * Handle continue training event
   * Navigates to the patients page for the selected group
   *
   * Requirement 7.2
   *
   * @param groupId - The ID of the simulation group to continue training in
   */
  const handleContinueTraining = (groupId: string) => {
    try {
      console.log(`Continue training for group: ${groupId}`);
      navigate(`/patients/${groupId}`);
    } catch (error) {
      console.error('Error during continue training:', error);
    }
  };

  return (
    <PageContainer>
      <DashboardHeader
        title="Student Dashboard"
        subtitle="Home Page"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
      />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <SimulationGroupsSection
          groups={groups}
          onJoinGroup={handleJoinGroup}
          onContinueTraining={handleContinueTraining}
        />
      </main>
      <JoinGroupDialog
        open={isJoinDialogOpen}
        onOpenChange={setIsJoinDialogOpen}
        onJoin={handleJoinGroupSubmit}
      />
    </PageContainer>
  );
}


export default StudentDashboardPage;
