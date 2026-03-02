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
}

function DashboardHeader({ 
  title, 
  subtitle, 
  userName, 
  userAvatarUrl, 
  onSignOut 
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

      <div className="flex items-center">
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