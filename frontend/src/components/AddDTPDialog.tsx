import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UI_COLORS } from '@/lib/colors';
import { useNotification } from '@/components/notifications';

interface AddDTPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional — passed from manage bank page but not needed by the dialog itself */
  organizationId?: string;
  /** Optional — existing tags for autocomplete suggestions */
  existingTags?: string[];
  /** When true, dialog title reflects patient-specific context and injects the patient_specific tag */
  isPatientSpecific?: boolean;
  onSave: (dtp: {
    title: string;
    expectedDTPText: string;
    clinicalIntent: string;
    evaluationCriteria: string;
    tags: string[];
    isRequired: boolean;
  }) => void;
}

export function AddDTPDialog({ open, onOpenChange, onSave, isPatientSpecific = false }: AddDTPDialogProps) {
  const { showNotification } = useNotification();
  const [title, setTitle] = useState('');
  const [expectedDTPText, setExpectedDTPText] = useState('');
  const [clinicalIntent, setClinicalIntent] = useState('');
  const [evaluationCriteria, setEvaluationCriteria] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = () => {
    if (!title.trim() || !expectedDTPText.trim()) {
      showNotification({ message: 'Please fill in at least the Title and Expected DTP Text fields.', type: 'warning' });
      return;
    }

    const finalTags = isPatientSpecific
      ? ['patient_specific', ...tags.filter(t => t !== 'patient_specific')]
      : tags.filter(t => t !== 'patient_specific');

    onSave({
      title: title.trim(),
      expectedDTPText: expectedDTPText.trim(),
      clinicalIntent: clinicalIntent.trim(),
      evaluationCriteria: evaluationCriteria.trim(),
      tags: finalTags,
      isRequired,
    });

    // Reset form
    setTitle('');
    setExpectedDTPText('');
    setClinicalIntent('');
    setEvaluationCriteria('');
    setIsRequired(false);
    setTagInput('');
    setTags([]);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setTitle('');
    setExpectedDTPText('');
    setClinicalIntent('');
    setEvaluationCriteria('');
    setIsRequired(false);
    setTagInput('');
    setTags([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle style={{ color: UI_COLORS.text.heading }}>
            {isPatientSpecific ? 'Add Patient-Specific DTP' : 'Add New DTP Item'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Unnecessary Drug Therapy"
              className="w-full"
              style={{
                borderColor: UI_COLORS.border.default,
                backgroundColor: UI_COLORS.background.white,
              }}
            />
          </div>

          {/* Expected DTP Text */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
              Expected DTP Text
            </label>
            <textarea
              value={expectedDTPText}
              onChange={(e) => setExpectedDTPText(e.target.value)}
              placeholder="e.g., The patient is taking a medication that is no longer indicated for their condition..."
              className="w-full px-3 py-2 rounded-md border resize-none"
              rows={3}
              style={{
                borderColor: UI_COLORS.border.default,
                backgroundColor: UI_COLORS.background.white,
                color: UI_COLORS.text.heading,
              }}
            />
          </div>

          {/* Clinical Intent */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
              Clinical Intent
            </label>
            <textarea
              value={clinicalIntent}
              onChange={(e) => setClinicalIntent(e.target.value)}
              placeholder="e.g., This DTP evaluates the student's ability to identify medications without a valid indication..."
              className="w-full px-3 py-2 rounded-md border resize-none"
              rows={4}
              style={{
                borderColor: UI_COLORS.border.default,
                backgroundColor: UI_COLORS.background.white,
                color: UI_COLORS.text.heading,
              }}
            />
          </div>

          {/* Evaluation Criteria */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
              Evaluation Criteria
            </label>
            <textarea
              value={evaluationCriteria}
              onChange={(e) => setEvaluationCriteria(e.target.value)}
              placeholder="e.g., The student correctly identifies the drug therapy problem and provides a clear rationale..."
              className="w-full px-3 py-2 rounded-md border resize-none"
              rows={5}
              style={{
                borderColor: UI_COLORS.border.default,
                backgroundColor: UI_COLORS.background.white,
                color: UI_COLORS.text.heading,
              }}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
              Tags
            </label>
            <p className="text-xs mb-2" style={{ color: UI_COLORS.text.muted }}>
              Add tags for filtering (e.g. Cardiovascular, Diabetes, Polypharmacy). Press Enter or comma to add.
            </p>
            <div className="flex gap-2 mb-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Type a tag and press Enter..."
                className="flex-1"
                style={{
                  borderColor: UI_COLORS.border.default,
                  backgroundColor: UI_COLORS.background.white,
                }}
              />
              <Button
                type="button"
                onClick={handleAddTag}
                variant="outline"
                style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading }}
              >
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                    style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-red-600 bg-transparent border-0 cursor-pointer p-0 text-xs"
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Required Toggle */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-2 transition-colors"
                style={{
                  backgroundColor: isRequired ? UI_COLORS.button.primary : UI_COLORS.background.tableHeader,
                }}
              >
                <div
                  className="absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform"
                  style={{
                    transform: isRequired ? 'translateX(20px)' : 'translateX(0)',
                  }}
                />
              </div>
            </label>
            <span className="text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>
              Required for Case Completion
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: UI_COLORS.border.default }}>
          <Button
            onClick={handleCancel}
            variant="outline"
            style={{
              borderColor: UI_COLORS.border.default,
              color: UI_COLORS.text.heading,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            style={{
              backgroundColor: UI_COLORS.button.primary,
              color: UI_COLORS.button.text,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = UI_COLORS.button.primary)}
          >
            Save DTP Item
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
