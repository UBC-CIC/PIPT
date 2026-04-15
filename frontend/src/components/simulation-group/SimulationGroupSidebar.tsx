import { Button } from '@/components/ui/button';
import { Key, Copy } from 'lucide-react';
import { UI_COLORS } from '@/lib/colors';

export interface SidebarSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

export interface SimulationGroupSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  sections: SidebarSection[];
  accessCode: string;
  onCopyAccessCode: () => void;
  onGenerateAccessCode: () => void;
  isVisible: boolean;
  onToggleVisibility: () => void;
}

export function SimulationGroupSidebar({
  activeSection,
  onSectionChange,
  sections,
  accessCode,
  onCopyAccessCode,
  onGenerateAccessCode,
  isVisible,
}: SimulationGroupSidebarProps) {
  return (
    <aside
      className="flex flex-col transition-all duration-300 ease-in-out border-r"
      aria-hidden={!isVisible}
      style={{
        backgroundColor: UI_COLORS.background.white,
        borderRightWidth: isVisible ? '1px' : '0px',
        borderRightStyle: 'solid',
        borderRightColor: UI_COLORS.border.default,
        width: isVisible ? '16rem' : '0rem',
        minWidth: isVisible ? '16rem' : '0rem',
        overflowY: isVisible ? 'auto' : 'hidden',
        overflowX: 'hidden',
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      <nav className="flex-1 p-4 space-y-2">
        {sections.map(({ id, label, icon, onClick }) => (
          <Button
            key={id}
            onClick={() => (onClick ? onClick() : onSectionChange(id))}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === id ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading,
            }}
          >
            {icon}
            {label}
          </Button>
        ))}
      </nav>

      {/* Access Code Section */}
      <div className="border-t p-4 space-y-3" style={{ borderColor: UI_COLORS.border.default }}>
        <div>
          <p className="text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
            Access Code
          </p>
          <div
            className="flex items-center gap-2 p-3 rounded-md border"
            style={{
              backgroundColor: UI_COLORS.background.tableHeader,
              borderColor: UI_COLORS.border.default,
            }}
          >
            <Key className="w-4 h-4" style={{ color: UI_COLORS.text.body }} />
            <span className="font-mono text-sm flex-1" style={{ color: UI_COLORS.text.heading }}>
              {accessCode}
            </span>
            <button
              onClick={onCopyAccessCode}
              className="p-1 rounded hover:bg-gray-200 transition-colors"
              style={{ border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
              title="Copy access code"
            >
              <Copy className="w-4 h-4" style={{ color: UI_COLORS.text.body }} />
            </button>
          </div>
        </div>
        <Button
          onClick={onGenerateAccessCode}
          variant="outline"
          className="w-full justify-start gap-2 py-2.5 h-auto font-medium"
          style={{
            borderColor: UI_COLORS.border.default,
            color: UI_COLORS.text.heading,
          }}
        >
          Generate new access code
        </Button>
      </div>
    </aside>
  );
}
