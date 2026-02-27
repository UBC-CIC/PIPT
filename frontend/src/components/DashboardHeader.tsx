import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import UserAvatar from './UserAvatar';

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
    <header className="flex bg-gray-200 border-b border-border items-center justify-between py-6 px-8">
      <div className="flex items-center gap-4">
        <UserAvatar
          name={userName}
          imageUrl={userAvatarUrl}
          size="medium"
        />
        <div className="flex flex-col gap-0.5">
          <h1 className="font-bold tracking-tight text-gray-900 leading-tight text-2xl">
            {title}
          </h1>
          <p className="text-gray-600 leading-normal text-sm tracking-tight">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center">
        <Button
        variant="default"
        onClick={onSignOut}
        className="bg-gray-800 text-white hover:bg-gray-900 px-6"
        >
          Sign Out
        </Button>
      </div>
    </header>
  );
}

export default DashboardHeader;