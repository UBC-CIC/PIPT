import { useState, useRef, useEffect } from 'react';
import { X, Image, Video } from 'lucide-react';
import { UI_COLORS } from '@/lib/colors';

interface CaseMaterial {
  id: string;
  title: string;
  description: string;
  type: 'image' | 'video' | 'audio';
  group?: string; // Optional group/category for the material
}

interface CaseMaterialsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  materials: CaseMaterial[];
}

function CaseMaterialsDialog({ isOpen, onClose, materials }: CaseMaterialsDialogProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 600, height: 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        setSize({
          width: Math.max(400, resizeStart.width + deltaX),
          height: Math.max(300, resizeStart.height + deltaY),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeStart]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!dialogRef.current) return;
    
    const rect = dialogRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    });
    setIsResizing(true);
  };

  const handleMaterialClick = (material: CaseMaterial) => {
    console.log('Material clicked:', material);
    // Future: Open material viewer/player
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="w-6 h-6" style={{ color: UI_COLORS.icon.dark }} />;
      case 'video':
        return <Video className="w-6 h-6" style={{ color: UI_COLORS.icon.dark }} />;
      default:
        return <Image className="w-6 h-6" style={{ color: UI_COLORS.icon.dark }} />;
    }
  };

  // Group materials by their group property
  const groupedMaterials = materials.reduce((acc, material) => {
    const groupName = material.group || 'Ungrouped';
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(material);
    return acc;
  }, {} as Record<string, CaseMaterial[]>);

  // Check if any materials have groups defined
  const hasGroups = materials.some(m => m.group);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={dialogRef}
        className="absolute rounded-lg shadow-2xl pointer-events-auto flex flex-col"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          backgroundColor: UI_COLORS.background.white,
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: UI_COLORS.border.default
        }}
      >
        {/* Header - Draggable */}
        <div
          className="flex items-center justify-between p-6 cursor-move flex-shrink-0"
          style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.light }}
          onMouseDown={handleMouseDown}
        >
          <div>
            <h2 className="text-2xl font-semibold" style={{ color: UI_COLORS.text.heading }}>Case Materials</h2>
            <p className="text-sm mt-1" style={{ color: UI_COLORS.text.body }}>Click to view the embedded content.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ backgroundColor: UI_COLORS.background.transparent }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.background.hoverLight}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.background.transparent}
            aria-label="Close dialog"
          >
            <X className="w-6 h-6" style={{ color: UI_COLORS.icon.dark }} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 overflow-y-auto flex-1">
          {hasGroups ? (
            // Render grouped materials with headers
            <div className="space-y-6">
              {Object.entries(groupedMaterials).map(([groupName, groupMaterials]) => (
                <div key={groupName}>
                  {groupName !== 'Ungrouped' && (
                    <h3 
                      className="text-lg font-semibold mb-3 pb-2" 
                      style={{ 
                        color: UI_COLORS.text.heading,
                        borderBottomWidth: '1px',
                        borderBottomStyle: 'solid',
                        borderBottomColor: UI_COLORS.border.light
                      }}
                    >
                      {groupName}
                    </h3>
                  )}
                  <div className="space-y-4">
                    {groupMaterials.map((material) => (
                      <div
                        key={material.id}
                        onClick={() => handleMaterialClick(material)}
                        className="flex gap-4 p-4 rounded-lg cursor-pointer transition-colors"
                        style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.transparent }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = UI_COLORS.background.hover;
                          e.currentTarget.style.borderColor = UI_COLORS.border.light;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = UI_COLORS.background.transparent;
                          e.currentTarget.style.borderColor = UI_COLORS.border.transparent;
                        }}
                      >
                        <div className="flex-shrink-0 mt-1">
                          {getIcon(material.type)}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                            {material.title}
                          </h3>
                          <p className="leading-relaxed" style={{ color: UI_COLORS.text.body }}>
                            {material.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Render flat list without groups
            <div className="space-y-4">
              {materials.map((material) => (
                <div
                  key={material.id}
                  onClick={() => handleMaterialClick(material)}
                  className="flex gap-4 p-4 rounded-lg cursor-pointer transition-colors"
                  style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.transparent }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = UI_COLORS.background.hover;
                    e.currentTarget.style.borderColor = UI_COLORS.border.light;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = UI_COLORS.background.transparent;
                    e.currentTarget.style.borderColor = UI_COLORS.border.transparent;
                  }}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(material.type)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                      {material.title}
                    </h3>
                    <p className="leading-relaxed" style={{ color: UI_COLORS.text.body }}>
                      {material.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resize Handle */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleResizeMouseDown}
          style={{
            background: `linear-gradient(135deg, transparent 50%, ${UI_COLORS.border.medium} 50%)`,
          }}
        />
      </div>
    </div>
  );
}

export default CaseMaterialsDialog;
