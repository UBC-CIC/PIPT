import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { UI_COLORS } from '@/lib/colors';

interface NotesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function NotesDialog({ isOpen, onClose }: NotesDialogProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 600, height: 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [notes, setNotes] = useState('');
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

  const handleSave = () => {
    console.log('Notes saved:', notes);
    // Future: Save notes to backend
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
          <h2 className="text-2xl font-semibold" style={{ color: UI_COLORS.text.heading }}>Notes</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-6 h-6" style={{ color: UI_COLORS.text.body }} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 flex-1 flex flex-col gap-4">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Write your notes here..."
            className="flex-1 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-gray-400 placeholder-gray-400"
            style={{ color: UI_COLORS.text.heading }}
          />
          
          <button
            onClick={handleSave}
            className="self-end px-8 py-3 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: UI_COLORS.button.primary,
              color: UI_COLORS.button.text,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = UI_COLORS.button.primary;
            }}
          >
            Save
          </button>
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

export default NotesDialog;
