import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Search, ShieldCheck, ShieldAlert, UserMinus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UI_COLORS } from '@/lib/colors';
import { useNotification } from '@/components/notifications';
import * as adminApi from '@/services/adminApiService';
import type { RegisteredUser } from '@/services/adminApiService';
import PageContainer from '@/components/PageContainer';
import LoadingIndicator from '@/components/LoadingIndicator';
import { useAuth } from '@/App';

const SYSTEM_DEFAULT_THRESHOLD = 0.55;

/**
 * AdminConfigurationPage Component
 *
 * Organization-level configuration page with three tabs:
 * 1. Question Banks — informational cards about bank types
 * 2. Matching Thresholds — configure semantic matching thresholds
 * 3. Manage Users — elevate/demote users across student, instructor, admin roles
 */
function AdminConfigurationPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { user: currentUser } = useAuth();

  // ─── Threshold State ─────────────────────────────────────────────────────────
  const [thresholds, setThresholds] = useState<adminApi.ThresholdConfig>({
    key_question_threshold: null,
    dtp_threshold: null,
    recommendation_threshold: null,
  });
  const [thresholdsLoading, setThresholdsLoading] = useState(false);
  const [thresholdsSaving, setThresholdsSaving] = useState(false);

  // ─── Instructor Management State ────────────────────────────────────────────
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('question-banks');

  // ─── Load thresholds when tab is activated ──────────────────────────────────
  useEffect(() => {
    if (activeTab === 'thresholds' && organizationId) {
      loadThresholds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, organizationId]);

  // ─── Load users when instructor tab is activated ────────────────────────────
  useEffect(() => {
    if (activeTab === 'instructors') {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function loadThresholds() {
    if (!organizationId) return;
    setThresholdsLoading(true);
    try {
      const data = await adminApi.getOrganizationThresholds(organizationId);
      setThresholds(data);
    } catch (err) {
      console.error('Failed to load thresholds:', err);
      showNotification({ message: 'Failed to load thresholds.', type: 'error' });
    } finally {
      setThresholdsLoading(false);
    }
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const data = await adminApi.getAllUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
      showNotification({ message: 'Failed to load users.', type: 'error' });
    } finally {
      setUsersLoading(false);
    }
  }

  async function handleSaveThresholds() {
    if (!organizationId) return;
    setThresholdsSaving(true);
    try {
      const updated = await adminApi.updateOrganizationThresholds(organizationId, thresholds);
      setThresholds(updated);
      showNotification({ message: 'Thresholds updated successfully.', type: 'success' });
    } catch (err) {
      console.error('Failed to save thresholds:', err);
      showNotification({ message: 'Failed to save thresholds.', type: 'error' });
    } finally {
      setThresholdsSaving(false);
    }
  }

  async function handleElevateToInstructor(email: string) {
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
      console.error('Failed to elevate user:', err);
      const message = err instanceof Error ? err.message : 'Failed to elevate user.';
      showNotification({ message, type: 'error' });
    }
  }

  async function handleDemoteInstructor(email: string) {
    if (!confirm(`Are you sure you want to demote ${email} from instructor to student? This will also remove all their instructor enrollments.`)) {
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
      console.error('Failed to demote instructor:', err);
      const message = err instanceof Error ? err.message : 'Failed to demote instructor.';
      showNotification({ message, type: 'error' });
    }
  }

  async function handleElevateToAdmin(email: string) {
    if (!confirm(`Are you sure you want to elevate ${email} to admin? They will have full administrative access.`)) {
      return;
    }
    try {
      await adminApi.elevateToAdmin(email);
      setUsers(prev =>
        prev.map(u =>
          u.user_email === email
            ? { ...u, roles: [...u.roles.filter(r => r !== 'instructor'), 'admin'] }
            : u
        )
      );
      showNotification({ message: `${email} elevated to admin.`, type: 'success' });
    } catch (err) {
      console.error('Failed to elevate user to admin:', err);
      const message = err instanceof Error ? err.message : 'Failed to elevate user to admin.';
      showNotification({ message, type: 'error' });
    }
  }

  async function handleDemoteAdmin(email: string) {
    if (!confirm(`Are you sure you want to demote ${email} from admin to instructor?`)) {
      return;
    }
    try {
      await adminApi.lowerAdmin(email);
      setUsers(prev =>
        prev.map(u =>
          u.user_email === email
            ? { ...u, roles: u.roles.map(r => r === 'admin' ? 'instructor' : r) }
            : u
        )
      );
      showNotification({ message: `${email} demoted to instructor.`, type: 'success' });
    } catch (err) {
      console.error('Failed to demote admin:', err);
      const message = err instanceof Error ? err.message : 'Failed to demote admin.';
      showNotification({ message, type: 'error' });
    }
  }

  function handleThresholdChange(field: keyof adminApi.ThresholdConfig, value: string) {
    const numValue = value === '' ? null : parseFloat(value);
    setThresholds(prev => ({ ...prev, [field]: numValue }));
  }

  // Filter users by search query (case-insensitive)
  const filteredUsers = users.filter(u => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
    return fullName.includes(query) || u.user_email.toLowerCase().includes(query);
  });

  return (
    <PageContainer>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b" style={{ borderColor: UI_COLORS.border.light }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/admin/organization/${organizationId}`)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" style={{ color: UI_COLORS.icon.default }} />
          </Button>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: UI_COLORS.text.heading }}>
              Organization Configuration
            </h1>
            <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>
              Manage question banks, matching thresholds, and users
            </p>
          </div>
        </div>

        {/* Tabs Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="question-banks">Question Banks</TabsTrigger>
              <TabsTrigger value="thresholds">Matching Thresholds</TabsTrigger>
              <TabsTrigger value="instructors">Manage Users</TabsTrigger>
            </TabsList>

            {/* Tab 1: Question Banks */}
            <TabsContent value="question-banks">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <QuestionBankCard
                  title="Key Question Bank"
                  description="Defines the key clinical questions students should address during patient interactions. Questions are matched semantically against student messages during chat."
                  icon={<ShieldCheck className="h-6 w-6" style={{ color: UI_COLORS.button.primary }} />}
                />
                <QuestionBankCard
                  title="DTP Bank"
                  description="Drug Therapy Problems that students should identify. Matched against student recommendations to evaluate clinical reasoning and problem identification."
                  icon={<ShieldCheck className="h-6 w-6" style={{ color: UI_COLORS.button.primary }} />}
                />
                <QuestionBankCard
                  title="Recommendations Bank"
                  description="Expected clinical recommendations for patient cases. Used to evaluate student-submitted recommendations against best practices."
                  icon={<ShieldCheck className="h-6 w-6" style={{ color: UI_COLORS.button.primary }} />}
                />
              </div>
              <p className="text-sm mt-4" style={{ color: UI_COLORS.text.muted }}>
                Question banks are managed per simulation group. Navigate to a specific group to configure its banks.
              </p>
            </TabsContent>

            {/* Tab 2: Matching Thresholds */}
            <TabsContent value="thresholds">
              {thresholdsLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingIndicator message="Loading thresholds..." />
                </div>
              ) : (
                <div className="max-w-lg mt-4 space-y-6">
                  <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                    Configure the similarity thresholds used for semantic matching. Lower values are more permissive (match more loosely), higher values require closer matches.
                  </p>

                  <ThresholdInput
                    label="Key Question Threshold"
                    value={thresholds.key_question_threshold}
                    onChange={(v) => handleThresholdChange('key_question_threshold', v)}
                  />
                  <ThresholdInput
                    label="DTP Threshold"
                    value={thresholds.dtp_threshold}
                    onChange={(v) => handleThresholdChange('dtp_threshold', v)}
                  />
                  <ThresholdInput
                    label="Recommendation Threshold"
                    value={thresholds.recommendation_threshold}
                    onChange={(v) => handleThresholdChange('recommendation_threshold', v)}
                  />

                  <Button
                    onClick={handleSaveThresholds}
                    disabled={thresholdsSaving}
                    className="px-6"
                    style={{
                      backgroundColor: UI_COLORS.button.primary,
                      color: UI_COLORS.button.text,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = UI_COLORS.button.primary; }}
                  >
                    {thresholdsSaving ? 'Saving...' : 'Save Thresholds'}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Tab 3: Manage Users */}
            <TabsContent value="instructors">
              <div className="mt-4 space-y-4">
                {/* Search */}
                <div className="relative max-w-md">
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

                {/* Count indicator */}
                {!usersLoading && (
                  <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                    Showing {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} — {filteredUsers.filter(u => u.roles.includes('admin')).length} admin{filteredUsers.filter(u => u.roles.includes('admin')).length !== 1 ? 's' : ''}, {filteredUsers.filter(u => u.roles.includes('instructor')).length} instructor{filteredUsers.filter(u => u.roles.includes('instructor')).length !== 1 ? 's' : ''}, {filteredUsers.filter(u => u.roles.includes('student')).length} student{filteredUsers.filter(u => u.roles.includes('student')).length !== 1 ? 's' : ''}
                  </p>
                )}

                {/* User List */}
                {usersLoading ? (
                  <div className="flex justify-center py-12">
                    <LoadingIndicator message="Loading users..." />
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden" style={{ borderColor: UI_COLORS.border.default }}>
                    {/* Table Header */}
                    <div
                      className="grid grid-cols-[2fr_2fr_100px_1fr] gap-4 px-4 py-3 text-xs font-semibold uppercase tracking-wide border-b"
                      style={{ backgroundColor: UI_COLORS.background.tableHeader, color: UI_COLORS.text.body, borderColor: UI_COLORS.border.default }}
                    >
                      <span>Name</span>
                      <span>Email</span>
                      <span>Role</span>
                      <span>Actions</span>
                    </div>

                    {/* Table Body */}
                    {filteredUsers.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm" style={{ color: UI_COLORS.text.muted }}>
                        {searchQuery.trim() ? 'No users match your search.' : 'No users found.'}
                      </div>
                    ) : (
                      <div className="divide-y" style={{ borderColor: UI_COLORS.border.light }}>
                        {filteredUsers.map((user) => {
                          const isAdmin = user.roles.includes('admin');
                          const isInstructor = user.roles.includes('instructor');
                          const isSelf = user.user_email === currentUser?.email;

                          const roleBadge = isAdmin
                            ? { label: 'Admin', bg: '#FEE2E2', color: '#991B1B' }
                            : isInstructor
                            ? { label: 'Instructor', bg: '#DCFCE7', color: '#166534' }
                            : { label: 'Student', bg: '#F3F4F6', color: UI_COLORS.text.body };

                          return (
                            <div
                              key={user.user_id}
                              className="grid grid-cols-[2fr_2fr_100px_1fr] gap-4 px-4 py-3 items-center text-sm hover:bg-gray-50 transition-colors"
                            >
                              {/* Name */}
                              <div className="flex items-center gap-2">
                                {isAdmin && (
                                  <ShieldAlert className="h-4 w-4 shrink-0" style={{ color: '#991B1B' }} />
                                )}
                                {isInstructor && !isAdmin && (
                                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: UI_COLORS.status.success }} />
                                )}
                                <span style={{ color: UI_COLORS.text.heading }}>
                                  {user.first_name} {user.last_name}
                                  {isSelf && <span className="text-xs ml-1" style={{ color: UI_COLORS.text.muted }}>(you)</span>}
                                </span>
                              </div>

                              {/* Email */}
                              <span style={{ color: UI_COLORS.text.body }}>{user.user_email}</span>

                              {/* Role */}
                              <span
                                className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium"
                                style={{ backgroundColor: roleBadge.bg, color: roleBadge.color }}
                              >
                                {roleBadge.label}
                              </span>

                              {/* Actions */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {isAdmin && !isSelf && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDemoteAdmin(user.user_email)}
                                    className="text-xs gap-1 cursor-pointer"
                                    style={{ color: UI_COLORS.status.error, borderColor: UI_COLORS.status.error }}
                                  >
                                    <UserMinus className="h-3.5 w-3.5" />
                                    Demote to Instructor
                                  </Button>
                                )}
                                {isAdmin && isSelf && (
                                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>—</span>
                                )}
                                {isInstructor && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleElevateToAdmin(user.user_email)}
                                      className="text-xs gap-1 cursor-pointer"
                                      style={{ color: '#991B1B', borderColor: '#991B1B' }}
                                    >
                                      <ShieldAlert className="h-3.5 w-3.5" />
                                      Make Admin
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDemoteInstructor(user.user_email)}
                                      className="text-xs gap-1 cursor-pointer"
                                      style={{ color: UI_COLORS.status.error, borderColor: UI_COLORS.status.error }}
                                    >
                                      <UserMinus className="h-3.5 w-3.5" />
                                      Demote to Student
                                    </Button>
                                  </>
                                )}
                                {!isAdmin && !isInstructor && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleElevateToInstructor(user.user_email)}
                                    className="text-xs gap-1 cursor-pointer"
                                    style={{ color: UI_COLORS.button.primary, borderColor: UI_COLORS.button.primary }}
                                  >
                                    <UserPlus className="h-3.5 w-3.5" />
                                    Make Instructor
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageContainer>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function QuestionBankCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border p-4 space-y-2"
      style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
    >
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-medium" style={{ color: UI_COLORS.text.heading }}>{title}</h3>
      </div>
      <p className="text-sm" style={{ color: UI_COLORS.text.body }}>{description}</p>
    </div>
  );
}

function ThresholdInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>
        {label}
      </label>
      <div className="flex items-center gap-3">
        <Input
          type="number"
          min="0"
          max="1"
          step="0.01"
          placeholder={`System Default (${SYSTEM_DEFAULT_THRESHOLD})`}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-[200px] focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: UI_COLORS.border.default,
            backgroundColor: UI_COLORS.background.white,
          }}
        />
        <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>
          {value === null ? `Using default: ${SYSTEM_DEFAULT_THRESHOLD}` : `Custom: ${value}`}
        </span>
      </div>
    </div>
  );
}

export default AdminConfigurationPage;
