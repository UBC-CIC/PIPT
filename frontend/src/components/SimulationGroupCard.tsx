import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import { Trash2 } from 'lucide-react';
import type { SimulationGroup } from '@/services/studentService';
import { UI_COLORS } from '@/lib/colors';

interface SimulationGroupCardProps {
  group: SimulationGroup;
  onContinueTraining: (groupId: string) => void;
  actionButtonText?: string;
  showCounts?: boolean;
  showDeleteButton?: boolean;
  onDelete?: (groupId: string) => void;
  countLabels?: {
    students?: string;
    instructors?: string;
    patients?: string;
  };
}

function SimulationGroupCard({ 
  group, 
  onContinueTraining, 
  actionButtonText = 'Continue Training',
  showCounts = false,
  showDeleteButton = false,
  onDelete,
  countLabels = {
    students: 'Students',
    instructors: 'Instructors',
    patients: 'Patients'
  }
}: SimulationGroupCardProps) {
  return (
    <div className="flex flex-col gap-4 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
      <div className="flex items-start gap-4">
        {!showCounts && (
          <UserAvatar
            name={group.name}
            imageUrl={group.icon_url}
            size="medium"
            backgroundColor={group.icon_color}
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg leading-tight mb-1" style={{ color: UI_COLORS.text.heading }}>
            {group.name}
          </h3>
          {!showCounts && (
            <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
              {group.subtitle}
            </p>
          )}
          {showCounts && (
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                {countLabels.students} : {group.student_count || 0}
              </p>
              <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                {countLabels.instructors} : {group.instructor_count || 0}
              </p>
              <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                {countLabels.patients} : {group.patient_count || 0}
              </p>
              {(group as any).access_code && (
                <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                  Access Code : {(group as any).access_code}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => onContinueTraining(group.simulation_group_id)}
          variant="default"
          className="flex-1 transition-colors"
          style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
        >
          {actionButtonText}
        </Button>
        {showDeleteButton && onDelete && (
          <button
            onClick={() => onDelete(group.simulation_group_id)}
            className="p-3 rounded-md hover:bg-gray-100 transition-colors"
            style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default }}
            aria-label="Delete simulation group"
          >
            <Trash2 className="w-5 h-5" style={{ color: UI_COLORS.icon.default }} />
          </button>
        )}
      </div>
    </div>
  );
}

export default SimulationGroupCard;
