import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import SimulationGroupsSection from '@/components/SimulationGroupsSection';
import JoinGroupDialog from '@/components/JoinGroupDialog';
import { studentService, type SimulationGroup, type UserData } from '@/services/studentService';
import { useAuth } from '@/App';

/**
 * StudentDashboardPage Component
 * 
 * Main page component that orchestrates the student dashboard.
 * Loads simulation groups and user data from the backend API.
 */
function StudentDashboardPage() {
  const navigate = useNavigate();
  const { signOut, user: authUser } = useAuth();
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [groups, setGroups] = useState<SimulationGroup[]>([]);
  const [user, setUser] = useState<UserData>({ name: 'Loading...' });
  const [loading, setLoading] = useState(true);

  // Check if user has instructor role
  const hasInstructorRole = authUser?.groups.includes('instructor') || false;

  // Fetch data from backend on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [groupsData, userData] = await Promise.all([
          studentService.getSimulationGroups(),
          studentService.getCurrentUser(),
        ]);
        setGroups(groupsData);
        setUser(userData ?? { name: 'Unknown User' });
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  /**
   * Handle sign out event
   */
  const handleSignOut = async () => {
    await signOut();
  };

  /**
   * Handle instructor view navigation
   */
  const handleInstructorView = () => {
    navigate('/instructor');
  };

  /**
   * Handle join group event
   */
  const handleJoinGroup = () => {
    setIsJoinDialogOpen(true);
  };

  /**
   * Handle join group submission
   * Phase 1: Logs access code to console
   * Future: Will call API to join group
   *
   * @param accessCode - The access code entered by the user
   */
  const handleJoinGroupSubmit = async (accessCode: string) => {
    const result = await studentService.joinGroup(accessCode);
    if (result.success) {
      // Refresh simulation groups to show newly joined group
      const updatedGroups = await studentService.getSimulationGroups();
      setGroups(updatedGroups);
    }
    return result;
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
    navigate(`/patients/${groupId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-lg text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <PageContainer>
      <DashboardHeader
        title="Student Dashboard"
        subtitle="Home Page"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
        onInstructorView={handleInstructorView}
        showInstructorViewButton={hasInstructorRole}
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
