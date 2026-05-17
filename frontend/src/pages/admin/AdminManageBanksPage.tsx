import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, HelpCircle, FileText, ClipboardList } from 'lucide-react';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import { mockAdminDataService } from '@/services/adminService';
import { useAuth } from '@/App';
import { UI_COLORS } from '@/lib/colors';

interface BankCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
}

/**
 * AdminManageBanksPage Component
 *
 * Landing page for bank management. Allows admins to choose between
 * Question Bank, DTP Bank, and Recommendations Bank.
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
        subtitle="Manage Banks"
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
          Choose a Bank to Manage
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
      </main>
    </PageContainer>
  );
}

export default AdminManageBanksPage;
