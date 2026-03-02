import { Button } from '@/components/ui/button';
import SimulationGroupCard from '@/components/SimulationGroupCard';
import type { SimulationGroup } from '@/services/studentService';
import { UI_COLORS } from '@/lib/colors';

interface SimulationGroupsSectionProps {
  groups: SimulationGroup[];
  onJoinGroup: () => void;
  onContinueTraining: (groupId: string) => void;
}

function SimulationGroupsSection({
  groups,
  onJoinGroup,
  onContinueTraining
}: SimulationGroupsSectionProps) {
  return (
    <div className="w-full px-4 py-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-2 text-left" style={{ color: UI_COLORS.text.heading }}>Simulation Groups</h2>
          <p className="text-sm text-left" style={{ color: UI_COLORS.text.body }}>
            Join simulation groups to practice patient interactions and develop your clinical diagnosis skills.
          </p>
        </div>
        <Button 
          onClick={onJoinGroup} 
          variant="default" 
          className="sm:shrink-0 px-6 transition-colors"
          style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
        >
          + Join Group
        </Button>
      </div>

      {/* Groups Grid or Empty State */}
      {groups.length === 0 ? (
        <div className="text-center py-12" style={{ color: UI_COLORS.text.body }}>
          No simulation groups available. Click '+ Join Group' to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <SimulationGroupCard
              key={group.id}
              group={group}
              onContinueTraining={onContinueTraining}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SimulationGroupsSection;
