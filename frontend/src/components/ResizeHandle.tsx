import { GripVertical } from 'lucide-react';

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  direction: 'left' | 'right'; // 'left' = handle on right edge, 'right' = handle on left edge
}

/**
 * A visible drag handle for resizable panels.
 * Shows a grip icon centered vertically with hover highlight.
 */
export default function ResizeHandle({ onMouseDown, direction }: ResizeHandleProps) {
  const positionStyle = direction === 'left'
    ? { right: -6 }
    : { left: -6 };

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 12,
        cursor: 'col-resize',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...positionStyle,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)';
        const icon = e.currentTarget.querySelector('.grip-icon') as HTMLElement;
        if (icon) icon.style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        const icon = e.currentTarget.querySelector('.grip-icon') as HTMLElement;
        if (icon) icon.style.opacity = '0.45';
      }}
    >
      {/* Vertical line */}
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 2,
        backgroundColor: 'rgba(0,0,0,0.12)',
        borderRadius: 1,
      }} />
      {/* Grip dots icon */}
      <div
        className="grip-icon"
        style={{
          position: 'relative',
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderRadius: 4,
          padding: '4px 0',
          opacity: 0.45,
          transition: 'opacity 150ms ease',
        }}
      >
        <GripVertical size={14} strokeWidth={2.5} color="rgba(0,0,0,0.55)" />
      </div>
    </div>
  );
}
