import { useState, useRef, useEffect } from 'react';
import { X, Image, Video } from 'lucide-react';

interface CaseMaterial {
  id: string;
  title: string;
  description: string;
  type: 'image' | 'video' | 'audio';
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
        return <Image className="w-6 h-6 text-gray-600" />;
      case 'video':
        return <Video className="w-6 h-6 text-gray-600" />;
      default:
        return <Image className="w-6 h-6 text-gray-600" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={dialogRef}
        className="absolute bg-white rounded-lg shadow-2xl border border-gray-300 pointer-events-auto flex flex-col"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
        }}
      >
        {/* Header - Draggable */}
        <div
          className="flex items-center justify-between p-6 border-b border-gray-200 cursor-move flex-shrink-0"
          onMouseDown={handleMouseDown}
        >
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Case Materials</h2>
            <p className="text-sm text-gray-600 mt-1">Click to view the embedded content.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            {materials.map((material) => (
              <div
                key={material.id}
                onClick={() => handleMaterialClick(material)}
                className="flex gap-4 p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-200"
              >
                <div className="flex-shrink-0 mt-1">
                  {getIcon(material.type)}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {material.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {material.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resize Handle */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleResizeMouseDown}
          style={{
            background: 'linear-gradient(135deg, transparent 50%, #9CA3AF 50%)',
          }}
        />
      </div>
    </div>
  );
}

export default CaseMaterialsDialog;
