import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import UserAvatar from './UserAvatar';
import { UI_COLORS } from '@/lib/colors';

interface DashboardHeaderProps {
  title: string;
  subtitle: string;
  userName: string;
  userAvatarUrl?: string;
  onSignOut: () => void;
  onStudentView?: () => void;
  onInstructorView?: () => void;
  showStudentViewButton?: boolean;
  showInstructorViewButton?: boolean;
  onManageQuestionBank?: () => void;
  showManageQuestionBankButton?: boolean;
  onManageDTPBank?: () => void;
  showManageDTPBankButton?: boolean;
  onManageRecommendationsBank?: () => void;
  showManageRecommendationsBankButton?: boolean;
  onAdminView?: () => void;
  showAdminViewButton?: boolean;
}

function DashboardHeader({ 
  title, 
  subtitle, 
  userName, 
  userAvatarUrl, 
  onSignOut,
  onStudentView,
  onInstructorView,
  showStudentViewButton = false,
  showInstructorViewButton = false,
  onManageQuestionBank,
  showManageQuestionBankButton = false,
  onManageDTPBank,
  showManageDTPBankButton = false,
  onManageRecommendationsBank,
  showManageRecommendationsBankButton = false,
  onAdminView,
  showAdminViewButton = false
}: DashboardHeaderProps) {
  const [, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <header className="flex border-b border-border items-center justify-between py-6 px-8" style={{ backgroundColor: UI_COLORS.header.background }}>
      <div className="flex items-center gap-4">
        <UserAvatar
          name={userName}
          imageUrl={userAvatarUrl}
          size="medium"
        />
        <div className="flex flex-col gap-0.5">
          <h1 className="font-bold tracking-tight leading-tight text-2xl" style={{ color: UI_COLORS.text.heading }}>
            {title}
          </h1>
          <p className="leading-normal text-sm tracking-tight" style={{ color: UI_COLORS.text.body }}>
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {showManageQuestionBankButton && onManageQuestionBank && (
          <Button
            variant="default"
            onClick={onManageQuestionBank}
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
          >
            Manage Question Bank
          </Button>
        )}
        {showManageDTPBankButton && onManageDTPBank && (
          <Button
            variant="default"
            onClick={onManageDTPBank}
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
          >
            DTP Bank
          </Button>
        )}
        {showManageRecommendationsBankButton && onManageRecommendationsBank && (
          <Button
            variant="default"
            onClick={onManageRecommendationsBank}
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
          >
            Recommendations Bank
          </Button>
        )}
        {showStudentViewButton && onStudentView && (
          <Button
            variant="default"
            onClick={onStudentView}
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
          >
            Student View
          </Button>
        )}
        {showInstructorViewButton && onInstructorView && (
          <Button
            variant="default"
            onClick={onInstructorView}
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
          >
            Instructor View
          </Button>
        )}
        {showAdminViewButton && onAdminView && (
          <Button
            variant="default"
            onClick={onAdminView}
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
          >
            Back to Admin View
          </Button>
        )}
        <Button
        variant="default"
        onClick={onSignOut}
        className="px-6 transition-colors"
        style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
        >
          Sign Out
        </Button>
      </div>
    </header>
  );
}

export default DashboardHeader;