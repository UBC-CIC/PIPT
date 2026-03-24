import { useState, useCallback, useRef, useEffect } from 'react';

interface UseResizablePanelOptions {
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  direction: 'left' | 'right'; // 'left' = drag handle on right edge, 'right' = drag handle on left edge
}

export function useResizablePanel({
  defaultWidth,
  minWidth = 250,
  maxWidth = 700,
  direction,
}: UseResizablePanelOptions) {
  const [width, setWidth] = useState(defaultWidth);
  const isDragging = useRef(false);
  const sidebarRef = useRef<HTMLElement | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        let newWidth: number;
        if (direction === 'left') {
          // Panel is on the left; width = cursor X minus panel's left offset
          const rect = sidebarRef.current?.getBoundingClientRect();
          const left = rect ? rect.left : 0;
          newWidth = ev.clientX - left;
        } else {
          // Panel is on the right; width = viewport width minus cursor X
          newWidth = window.innerWidth - ev.clientX;
        }
        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        setWidth(newWidth);
      };

      const onMouseUp = () => {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [direction, minWidth, maxWidth],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  return { width, sidebarRef, handleMouseDown };
}
