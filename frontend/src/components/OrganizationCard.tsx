import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OrganizationCardProps {
  name: string;
  aiPersona: string;
  userRole: string;
  icon: 'building';
  iconColor: string;
  onUseOrganisation: () => void;
}

/**
 * OrganizationCard Component
 * 
 * Displays an organization card with name, AI persona, user role, and actions
 */
function OrganizationCard({
  name,
  aiPersona,
  userRole,
  icon,
  iconColor,
  onUseOrganisation,
}: OrganizationCardProps) {
  return (
    <div className="border border-gray-300 rounded-lg p-6 bg-white hover:shadow-md transition-shadow">
      {/* Header with title */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: iconColor }}
        >
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900">{name}</h3>
      </div>

      {/* Organization details */}
      <div className="space-y-2 mb-6">
        <p className="text-sm text-gray-600">
          <span className="font-medium">AI Persona = </span>
          <span>{aiPersona}</span>
        </p>
        <p className="text-sm text-gray-600">
          <span className="font-medium">User Role = </span>
          <span>{userRole}</span>
        </p>
      </div>

      {/* Action button */}
      <Button
        onClick={onUseOrganisation}
        className="w-full bg-gray-900 hover:bg-gray-800 text-white"
      >
        Use Organisation
      </Button>
    </div>
  );
}

export default OrganizationCard;
