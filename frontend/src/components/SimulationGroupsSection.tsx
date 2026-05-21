import { Button } from '@/components/ui/button';
import SimulationGroupCard from '@/components/SimulationGroupCard';
import type { SimulationGroup } from '@/services/studentService';
import { UI_COLORS } from '@/lib/colors';

interface SimulationGroupsSectionProps {
  groups: SimulationGroup[];
  onJoinGroup: () => void;
  onContinueTraining: (groupId: string) => void;
  joinButtonText?: string;
  actionButtonText?: string;
  descriptionText?: string;
  sectionTitle?: string;
  emptyStateText?: string;
  showCounts?: boolean;
  showDeleteButton?: boolean;
  onDeleteGroup?: (groupId: string) => void;
  countLabels?: {
    students?: string;
    instructors?: string;
    patients?: string;
  };
}

function SimulationGroupsSection({
  groups,
  onJoinGroup,
  onContinueTraining,
  joinButtonText = '+ Join Group',
  actionButtonText = 'Continue Training',
  descriptionText = 'Join simulation groups to practice patient interactions and develop your clinical diagnosis skills.',
  sectionTitle = 'Simulation Groups',
  emptyStateText = 'Get started by joining a simulation group with an access code from your instructor.',
  showCounts = false,
  showDeleteButton = false,
  onDeleteGroup,
  countLabels
}: SimulationGroupsSectionProps) {
  return (
    <div className="w-full px-4 py-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-2 text-left" style={{ color: UI_COLORS.text.heading }}>{sectionTitle}</h2>
          <p className="text-sm text-left" style={{ color: UI_COLORS.text.body }}>
            {descriptionText}
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
          {joinButtonText}
        </Button>
      </div>

      {/* Groups Grid or Empty State */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: UI_COLORS.background.hover }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={UI_COLORS.text.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>No simulation groups yet</h3>
          <p className="text-sm text-center max-w-md mb-6" style={{ color: UI_COLORS.text.body }}>
            {emptyStateText}
          </p>
          <Button
            onClick={onJoinGroup}
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
          >
            {joinButtonText}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <SimulationGroupCard
              key={group.simulation_group_id}
              group={group}
              onContinueTraining={onContinueTraining}
              actionButtonText={actionButtonText}
              showCounts={showCounts}
              showDeleteButton={showDeleteButton}
              onDelete={onDeleteGroup}
              countLabels={countLabels}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SimulationGroupsSection;
