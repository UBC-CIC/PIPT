import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowLeft, HelpCircle, FileText, ClipboardList, CheckCircle2, Search, UserMinus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import LoadingIndicator from '@/components/LoadingIndicator';
import { mockAdminDataService } from '@/services/adminService';
import { useAuth } from '@/App';
import { UI_COLORS } from '@/lib/colors';
import ThresholdConfigSection from '@/components/ThresholdConfigSection';
import { useNotification } from '@/components/notifications';
import * as adminApi from '@/services/adminApiService';
import type { RegisteredUser } from '@/services/adminApiService';

interface BankCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
}

/**
 * AdminManageBanksPage Component
 *
 * Landing page for scoring configuration and bank management. Allows admins to
 * configure matching thresholds and manage Question Bank, DTP Bank, and Recommendations Bank.
 */
function AdminManageBanksPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { organizationId } = useParams<{ organizationId: string }>();

  let user = mockAdminDataService.getCurrentUser();
  if (!user || !user.name) {
    user = { name: 'Admin', avatarUrl: undefined };
  }

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  };

  const banks: BankCard[] = [
    {
      title: 'Question Bank',
      description: 'Manage global and patient-specific key questions used for semantic matching and debrief scoring.',
      icon: <HelpCircle className="w-8 h-8" />,
      path: `/admin/organization/${organizationId}/question-bank`,
    },
    {
      title: 'DTP Bank',
      description: 'Manage Drug Therapy Problem items used for evaluating student clinical assessments.',
      icon: <FileText className="w-8 h-8" />,
      path: `/admin/organization/${organizationId}/dtp-bank`,
    },
    {
      title: 'Recommendations Bank',
      description: 'Manage recommendation and rationale items for student recommendation submissions.',
      icon: <ClipboardList className="w-8 h-8" />,
      path: `/admin/organization/${organizationId}/recommendations-bank`,
    },
  ];

  return (
    <PageContainer>
      <DashboardHeader
        title="Admin Dashboard"
        subtitle="Scoring & Configuration"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
      />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {/* Back button */}
        <div className="mb-6">
          <button
            onClick={() => navigate(`/admin/organization/${organizationId}`)}
            className="font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 transition-colors"
            style={{ color: UI_COLORS.text.body }}
            onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
            onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Organization
          </button>
        </div>

        <h2 className="text-xl font-semibold mb-6" style={{ color: UI_COLORS.text.heading }}>
          Item Banks
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {banks.map((bank) => (
            <button
              key={bank.title}
              onClick={() => navigate(bank.path)}
              className="flex flex-col items-start gap-3 p-6 rounded-lg border border-border bg-card text-left transition-all hover:shadow-md hover:border-primary/50 cursor-pointer"
            >
              <div
                className="p-3 rounded-md"
                style={{ backgroundColor: UI_COLORS.button.primary + '15', color: UI_COLORS.button.primary }}
              >
                {bank.icon}
              </div>
              <h3 className="text-lg font-semibold" style={{ color: UI_COLORS.text.heading }}>
                {bank.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: UI_COLORS.text.body }}>
                {bank.description}
              </p>
            </button>
          ))}
        </div>

        {/* Matching Thresholds Section */}
        <div className="mt-10">
          {organizationId && <ThresholdConfigSection organizationId={organizationId} />}
        </div>

        {/* Manage Instructors Section */}
        <div className="mt-10">
          <ManageInstructorsSection />
        </div>
      </main>
    </PageContainer>
  );
}

// ─── Manage Instructors Section ──────────────────────────────────────────────

function ManageInstructorsSection() {
  const { showNotification } = useNotification();
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 5;

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await adminApi.getAllUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
      showNotification({ message: 'Failed to load users.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleElevate(email: string) {
    try {
      await adminApi.elevateToInstructor(email);
      setUsers(prev =>
        prev.map(u =>
          u.user_email === email
            ? { ...u, roles: [...u.roles.filter(r => r !== 'student'), 'instructor'] }
            : u
        )
      );
      showNotification({ message: `${email} elevated to instructor.`, type: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to elevate user.';
      showNotification({ message, type: 'error' });
    }
  }

  async function handleDemote(email: string) {
    if (!confirm(`Are you sure you want to demote ${email} from instructor to student? This will also remove their instructor enrollments.`)) {
      return;
    }
    try {
      await adminApi.lowerInstructor(email);
      setUsers(prev =>
        prev.map(u =>
          u.user_email === email
            ? { ...u, roles: u.roles.map(r => r === 'instructor' ? 'student' : r) }
            : u
        )
      );
      showNotification({ message: `${email} demoted to student.`, type: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to demote instructor.';
      showNotification({ message, type: 'error' });
    }
  }

  const filteredUsers = users.filter(u => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
    return fullName.includes(query) || u.user_email.toLowerCase().includes(query);
  });

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>
        Manage Instructors
      </h2>
      <p className="text-sm mb-4" style={{ color: UI_COLORS.text.body }}>
        Elevate students to instructor role or demote instructors back to student. Instructors are marked with a verification badge.
      </p>

      {/* Search */}
      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: UI_COLORS.text.muted }} />
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: UI_COLORS.border.default,
            backgroundColor: UI_COLORS.background.white,
          }}
        />
      </div>

      {/* User List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingIndicator message="Loading users..." />
        </div>
      ) : (
        <>
          <p className="text-sm mb-3" style={{ color: UI_COLORS.text.muted }}>
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} · {filteredUsers.filter(u => u.roles.includes('instructor')).length} instructor{filteredUsers.filter(u => u.roles.includes('instructor')).length !== 1 ? 's' : ''}
          </p>
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: UI_COLORS.border.default }}>
          {/* Table Header */}
          <div
            className="grid grid-cols-[2fr_2fr_100px_160px] gap-4 px-4 py-3 text-sm font-medium"
            style={{ backgroundColor: '#f9fafb', color: UI_COLORS.text.body }}
          >
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Action</span>
          </div>

          {/* Table Body */}
          {filteredUsers.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: UI_COLORS.text.muted }}>
              {searchQuery.trim() ? 'No users match your search.' : 'No users found.'}
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: UI_COLORS.border.light }}>
              {paginatedUsers.map((user) => {
                const isInstructor = user.roles.includes('instructor');
                return (
                  <div
                    key={user.user_id}
                    className="grid grid-cols-[2fr_2fr_100px_160px] gap-4 px-4 py-3 items-center text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {isInstructor && (
                        <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: '#16a34a' }} />
                      )}
                      <span style={{ color: UI_COLORS.text.heading }}>
                        {user.first_name} {user.last_name}
                      </span>
                    </div>
                    <span style={{ color: UI_COLORS.text.body }}>{user.user_email}</span>
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: isInstructor ? '#DCFCE7' : '#F3F4F6',
                        color: isInstructor ? '#166534' : UI_COLORS.text.body,
                      }}
                    >
                      {isInstructor ? 'Instructor' : 'Student'}
                    </span>
                    <div>
                      {isInstructor ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDemote(user.user_email)}
                          className="text-xs gap-1 cursor-pointer"
                          style={{ color: '#dc2626' }}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          Demote
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleElevate(user.user_email)}
                          className="text-xs gap-1 cursor-pointer"
                          style={{ color: UI_COLORS.button.primary }}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Elevate to Instructor
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Footer */}
          {filteredUsers.length > 0 && (
            <div
              className="flex items-center justify-between px-4 py-3 border-t text-sm"
              style={{ borderColor: UI_COLORS.border.light, color: UI_COLORS.text.muted }}
            >
              <span>
                Showing {startIndex + 1}–{Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="text-xs cursor-pointer"
                >
                  Previous
                </Button>
                <span className="text-xs">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="text-xs cursor-pointer"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}

export default AdminManageBanksPage;
