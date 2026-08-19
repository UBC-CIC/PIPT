import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle, FileText, ClipboardList } from 'lucide-react';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import { useNotification } from '@/components/notifications';
import { UI_COLORS } from '@/lib/colors';
import { instructorService } from '@/services/instructorService';
import { useAuth } from '@/App';

/** A single navigable item-bank tile. */
interface BankCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
}

/**
 * The item banks an instructor may reach from here: questions, drug therapy
 * problems, and recommendations. Everything else on the higher-privilege hub
 * stays out of instructor reach entirely — matching-threshold controls and role
 * assignment are intentionally absent from this page.
 */
const BANK_CARDS: BankCard[] = [
  {
    title: 'Question Bank',
    description:
      'Manage group-wide and patient-specific key questions used for semantic matching and debrief scoring.',
    icon: <HelpCircle className="w-8 h-8" />,
    path: '/instructor/question-bank',
  },
  {
    title: 'DTP Bank',
    description:
      'Manage Drug Therapy Problem items used for evaluating student clinical assessments.',
    icon: <FileText className="w-8 h-8" />,
    path: '/instructor/dtp-bank',
  },
  {
    title: 'Recommendations Bank',
    description:
      'Manage recommendation and rationale items for student recommendation submissions.',
    icon: <ClipboardList className="w-8 h-8" />,
    path: '/instructor/recommendations-bank',
  },
];

/**
 * InstructorConfigurationPage
 *
 * Instructor-facing scoring and configuration hub. Mirrors the layout of the
 * equivalent higher-privilege hub but exposes only the three item banks.
 */
function InstructorConfigurationPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { showNotification } = useNotification();

  const [user, setUser] = useState<{ name: string; avatarUrl?: string }>({ name: 'Instructor' });

  useEffect(() => {
    let cancelled = false;
    instructorService
      .getCurrentUser()
      .then((data) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        // Header falls back to the default name; not worth surfacing.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      showNotification({ message: 'Sign out failed. Please try again.', type: 'error' });
    }
  };

  return (
    <PageContainer>
      <DashboardHeader
        title="Instructor Dashboard"
        subtitle="Scoring & Configuration"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-6">
          <button
            onClick={() => navigate('/instructor')}
            className="font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 transition-colors"
            style={{ color: UI_COLORS.text.body }}
            onMouseEnter={(e) => (e.currentTarget.style.color = UI_COLORS.text.heading)}
            onMouseLeave={(e) => (e.currentTarget.style.color = UI_COLORS.text.body)}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>

        <h2 className="text-xl font-semibold mb-6" style={{ color: UI_COLORS.text.heading }}>
          Item Banks
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {BANK_CARDS.map((bank) => (
            <button
              key={bank.title}
              onClick={() => navigate(bank.path)}
              className="flex flex-col items-start gap-3 p-6 rounded-lg border border-border bg-card text-left transition-all hover:shadow-md hover:border-primary/50 cursor-pointer"
            >
              <div
                className="p-3 rounded-md"
                style={{
                  backgroundColor: UI_COLORS.button.primary + '15',
                  color: UI_COLORS.button.primary,
                }}
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

export default InstructorConfigurationPage;
