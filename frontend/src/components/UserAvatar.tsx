import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { UI_COLORS } from '@/lib/colors';

interface UserAvatarProps {
  name: string;
  imageUrl?: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  backgroundColor?: string;
}

const sizeClasses = {
  small: 'h-11 w-11 text-sm',
  medium: 'h-16 w-16 text-xl',
  large: 'h-24 w-24 text-3xl',
  xlarge: 'h-32 w-32 text-4xl',
};

function UserAvatar({ name, imageUrl, size = 'medium', backgroundColor }: UserAvatarProps) {
  const getInitials = (fullName: string): string => {
    const parts = fullName.trim().split(' ');
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <Avatar className={sizeClasses[size]}>
      {imageUrl && <AvatarImage src={imageUrl} alt={name} />}
      <AvatarFallback
        className="font-semibold text-white select-none"
        style={{ backgroundColor: backgroundColor || UI_COLORS.avatar.fallback }}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export default UserAvatar;