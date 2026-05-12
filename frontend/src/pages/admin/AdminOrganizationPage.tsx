import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import SimulationGroupsSection from '@/components/SimulationGroupsSection';
import CreateSimulationGroupDialog, { type AdminCreateData } from '@/components/CreateSimulationGroupDialog';
import { mockAdminDataService, mockOrganizations } from '@/services/adminService';
import {type InstructorSimulationGroup } from '@/services/instructorService';
import { getSimulationGroupColor, UI_COLORS } from '@/lib/colors';
import { useAuth } from '@/App';
import * as adminApi from '@/services/adminApiService';
import LoadingIndicator from '@/components/LoadingIndicator';
import { useNotification } from '@/components/notifications';

/**
 * AdminOrganizationPage Component
 * 
 * Page for viewing and managing simulation groups within a specific organization.
 */
function AdminOrganizationPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { organizationId } = useParams<{ organizationId: string }>();
  const { showNotification } = useNotification();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [groups, setGroups] = useState<InstructorSimulationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<adminApi.AdminOrganization | null>(null);

  // Load user data from mock data service with error handling
  let user = mockAdminDataService.getCurrentUser();

  if (!user || !user.name) {
    console.warn('User data is missing or invalid, using default values');
    user = {
      name: 'Admin',
      avatarUrl: undefined
    };
  }

  // Load organization details and simulation groups asynchronously
  useEffect(() => {
    const loadData = async () => {
      try {
        const groupsData = await adminApi.getAllSimulationGroups(organizationId);
        // Map admin groups to the InstructorSimulationGroup shape used by the UI
        setGroups(groupsData.map((g, i) => ({
          simulation_group_id: g.simulation_group_id,
          group_name: g.group_name,
          subtitle: g.group_description || 'Simulation Group',
          icon_color: getSimulationGroupColor(i),
          group_access_code: g.group_access_code || '',
          student_count: g.student_count || 0,
          instructor_count: g.instructor_count || 0,
          persona_count: g.persona_count || 0,
          organization_id: g.organization_id || '',
        })));
      } catch (error) {
        console.error('Failed to load simulation groups:', error);
      }

      // Load org details from API, fall back to mock
      if (organizationId) {
        try {
          const orgData = await adminApi.getOrganization(organizationId);
          setOrganization(orgData);
        } catch (err) {
          console.error('Failed to load organization from API, using mock:', err);
          const mockOrg = mockOrganizations.find(o => o.organization_id === organizationId) || null;
          setOrganization(mockOrg);
        }
      }

      setLoading(false);
    };
    loadData();
  }, [organizationId]);

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

  const handleCreateGroupSubmit = async (data: AdminCreateData) => {
    try {
      const created = await adminApi.createSimulationGroup({
        group_name: data.name,
        group_description: data.description,
        group_student_access: data.active,
        system_prompt: data.systemPrompt || '',
        organization_id: organizationId,
        // instructor_voice_enabled: data.enableVoice,  // uncomment after migration 005 runs
      });

      // Enroll any specified instructors
      const instructorEmails = data.instructors.split(',').map(i => i.trim()).filter(i => i);
      for (const email of instructorEmails) {
        try {
          await adminApi.addInstructorToGroup(created.simulation_group_id, email);
        } catch (err) {
          const message = err instanceof Error ? err.message : `Failed to enroll instructor ${email}.`;
          showNotification({ message, type: 'error' });
        }
      }

      const newGroup: InstructorSimulationGroup = {
        simulation_group_id: created.simulation_group_id,
        group_name: created.group_name,
        subtitle: 'Medical Simulation Group',
        icon_color: getSimulationGroupColor(groups.length),
        group_access_code: created.group_access_code || '',
        student_count: 0,
        instructor_count: instructorEmails.length,
        persona_count: 0,
        organization_id: created.organization_id || '',
      };
      setGroups(prevGroups => [...prevGroups, newGroup]);
    } catch (error) {
      console.error('Error creating group via API, adding locally:', error);
      // Fallback: add to local state
      const instructorEmails = data.instructors.split(',').map(i => i.trim()).filter(i => i);
      const fallbackGroup: InstructorSimulationGroup = {
        simulation_group_id: `group-${Date.now()}`,
        group_name: data.name,
        subtitle: 'Medical Simulation Group',
        icon_color: getSimulationGroupColor(groups.length),
        group_access_code: Math.random().toString(36).substring(2, 10).toUpperCase(),
        student_count: 0,
        instructor_count: instructorEmails.length,
        persona_count: 0,
        organization_id: '',
      };
      setGroups(prevGroups => [...prevGroups, fallbackGroup]);
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

  const handleDeleteGroup = async (groupId: string) => {
    const group = groups.find(g => g.simulation_group_id === groupId);
    const groupName = group ? group.group_name : 'this simulation group';
    
    const confirmed = window.confirm(`Are you sure you want to delete ${groupName}? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      await adminApi.deleteSimulationGroup(groupId);
    } catch (error) {
      console.error('Error deleting group via API, removing locally:', error);
    }
    // Remove from state regardless (optimistic for mock, confirmed for real)
    setGroups(prevGroups => prevGroups.filter(g => g.simulation_group_id !== groupId));
  };

  const handleManageQuestionBank = () => {
    try {
      console.log('Navigate to question bank management');
      // Navigate to question bank page for this organization
      navigate(`/admin/organization/${organizationId}/question-bank`);
    } catch (error) {
      console.error('Error navigating to question bank:', error);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-full">
          <LoadingIndicator size="lg" message="Loading..." />
        </div>
      </PageContainer>
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
        showStudentViewButton={false}
        onStudentView={() => navigate('/student')}
        showManageQuestionBankButton={true}
        onManageQuestionBank={handleManageQuestionBank}
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
          groups={groups.map(g => ({ ...g, name: g.group_name }))}
          onJoinGroup={handleCreateGroup}
          onContinueTraining={handleViewAnalytics}
          joinButtonText="+ Create New Group"
          actionButtonText="Manage Group"
          descriptionText="Edit simulation groups and view analytics."
          sectionTitle={organization ? `${organization.name} Simulation Groups` : 'Simulation Groups'}
          showCounts={true}
          showDeleteButton={true}
          onDeleteGroup={handleDeleteGroup}
          countLabels={{
            students: organization?.user_role || 'Students',
            instructors: 'Instructors',
            patients: organization?.ai_persona || 'Patients'
          }}
        />
      </main>
      <CreateSimulationGroupDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        role="admin"
        onCreate={handleCreateGroupSubmit}
      />
    </PageContainer>
  );
}

export default AdminOrganizationPage;