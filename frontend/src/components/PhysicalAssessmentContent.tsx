import { UI_COLORS } from '@/lib/colors';
import type { PersonaMedia } from '@/services/studentService';

interface PhysicalAssessmentContentProps {
  materials: PersonaMedia[];
  loading?: boolean;
}

function PhysicalAssessmentContent({ materials, loading }: PhysicalAssessmentContentProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>Loading materials...</p>
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>No physical assessment materials available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {materials.map((material) => (
        <div key={material.media_id} className="space-y-2">
          <h3 className="text-sm font-semibold" style={{ color: UI_COLORS.text.heading }}>
            {material.title}
          </h3>
          {material.description && (
            <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>
              {material.description}
            </p>
          )}
          {material.url && (
            <div
              className="rounded-lg overflow-hidden"
              style={{
                position: 'relative',
                width: '100%',
                paddingBottom: '56.25%',
                height: 0,
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: UI_COLORS.border.default,
              }}
            >
              <iframe
                src={material.url}
                title={material.title}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 0,
                }}
                allowFullScreen
                allow="autoplay *; fullscreen *; encrypted-media *"
                sandbox="allow-downloads allow-forms allow-same-origin allow-scripts allow-top-navigation allow-pointer-lock allow-popups allow-modals allow-orientation-lock allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default PhysicalAssessmentContent;
