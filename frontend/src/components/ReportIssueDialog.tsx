import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { UI_COLORS } from '@/lib/colors';
import { Button } from '@/components/ui/button';
import { studentService } from '@/services/studentService';

interface ReportIssueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (issues: string[], details: string) => void;
  simulationGroupId?: string;
  patientId?: string;
  chatId?: string;
}

function ReportIssueDialog({ isOpen, onClose, simulationGroupId, patientId, chatId }: ReportIssueDialogProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 500, height: 450 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);

  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const issueOptions = [
    'Patient acting out of character',
    'Responses don\'t make sense',
    'Patient ignoring my questions',
    'Other',
  ];

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

  useEffect(() => {
    if (isOpen) {
      // Reset form when dialog opens
      setSelectedIssues([]);
      setDetails('');
      setSubmitting(false);
      setSubmitError(null);
    }
  }, [isOpen]);

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

  const handleCheckboxChange = (issue: string) => {
    setSelectedIssues((prev) =>
      prev.includes(issue)
        ? prev.filter((i) => i !== issue)
        : [...prev, issue]
    );
  };

  const hasContext = Boolean(simulationGroupId && patientId && chatId);

  const handleSubmit = async () => {
    if (selectedIssues.length === 0) {
      alert('Please select at least one issue.');
      return;
    }

    if (!simulationGroupId || !patientId || !chatId) {
      setSubmitError('Reporting is unavailable — missing session context.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await studentService.submitIssueReport(simulationGroupId, patientId, chatId, selectedIssues, details || undefined);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit issue report. Please try again.');
      setSubmitting(false);
    }
  };

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
            <h2 className="text-2xl font-semibold" style={{ color: UI_COLORS.text.heading }}>Report Issue</h2>
            <p className="text-sm mt-1" style={{ color: UI_COLORS.text.body }}>Help us improve the AI patient simulation.</p>
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
          <div className="space-y-4">
            {/* Issue Checkboxes */}
            <div>
              <label className="text-base font-semibold mb-3 block" style={{ color: UI_COLORS.text.heading }}>
                What's the issue? (Select all that apply)
              </label>
              <div className="space-y-3">
                {issueOptions.map((issue) => (
                  <label
                    key={issue}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIssues.includes(issue)}
                      onChange={() => handleCheckboxChange(issue)}
                      className="w-4 h-4 cursor-pointer"
                      style={{ accentColor: UI_COLORS.button.secondary }}
                    />
                    <span style={{ color: UI_COLORS.text.body }}>{issue}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Details Text Area */}
            <div>
              <label className="text-base font-semibold mb-2 block" style={{ color: UI_COLORS.text.heading }}>
                Additional Details (Optional)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe what happened..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg resize-none focus:outline-none focus:ring-2"
                style={{
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: UI_COLORS.border.default,
                  outlineColor: UI_COLORS.border.medium,
                  color: UI_COLORS.text.body,
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer - Action Buttons */}
        <div
          className="flex flex-col gap-2 p-6 flex-shrink-0"
          style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: UI_COLORS.border.light }}
        >
          {submitError && (
            <p className="text-sm" style={{ color: '#991b1b' }}>{submitError}</p>
          )}
          {!hasContext && (
            <p className="text-sm" style={{ color: UI_COLORS.text.body }}>Reporting is unavailable for this session.</p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="px-6 transition-colors"
              style={{ backgroundColor: UI_COLORS.button.cancel, color: UI_COLORS.button.textDark }}
              onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = UI_COLORS.button.cancelHover; }}
              onMouseLeave={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = UI_COLORS.button.cancel; }}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleSubmit}
              disabled={submitting || !hasContext}
              className="px-6 transition-colors"
              style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
              onMouseEnter={(e) => { if (!submitting && hasContext) e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover; }}
              onMouseLeave={(e) => { if (!submitting && hasContext) e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary; }}
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
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

export default ReportIssueDialog;
