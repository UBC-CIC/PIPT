import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import type { SimulationGroup } from '@/services/studentService';
import { UI_COLORS } from '@/lib/colors';

interface SimulationGroupCardProps {
  group: SimulationGroup;
  onContinueTraining: (groupId: string) => void;
  actionButtonText?: string;
}

function SimulationGroupCard({ group, onContinueTraining, actionButtonText = 'Continue Training' }: SimulationGroupCardProps) {
  return (
    <div className="flex flex-col gap-4 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
      <div className="flex items-start gap-4">
        <UserAvatar
          name={group.name}
          imageUrl={group.iconUrl}
          size="medium"
          backgroundColor={group.iconColor}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg leading-tight mb-1" style={{ color: UI_COLORS.text.heading }}>
            {group.name}
          </h3>
          <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
            {group.subtitle}
          </p>
        </div>
      </div>
      <Button
        onClick={() => onContinueTraining(group.id)}
        variant="default"
        className="w-full transition-colors"
        style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
      >
        {actionButtonText}
      </Button>
    </div>
  );
}

export default SimulationGroupCard;
