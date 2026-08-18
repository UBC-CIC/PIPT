import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UI_COLORS } from '@/lib/colors';
import { useNotification } from '@/components/notifications';

interface AddRecommendationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional — passed from manage bank page but not needed by the dialog itself */
  organizationId?: string;
  /** Optional — existing tags for autocomplete suggestions */
  existingTags?: string[];
  /** When true, dialog title reflects patient-specific context and injects the patient_specific tag */
  isPatientSpecific?: boolean;
  /**
   * Persist the recommendation. May return a promise: a rejection keeps the dialog open
   * with the entered values and surfaces the rejection message inline.
   */
  onSave: (recommendation: {
    title: string;
    recommendationText: string;
    evaluationCriteria: string;
    rationale: string;
    tags: string[];
  }) => void | Promise<void>;
}

export function AddRecommendationDialog({ open, onOpenChange, onSave, isPatientSpecific = false }: AddRecommendationDialogProps) {
  const { showNotification } = useNotification();
  const [title, setTitle] = useState('');
  const [recommendationText, setRecommendationText] = useState('');
  const [evaluationCriteria, setEvaluationCriteria] = useState('');
  const [rationale, setRationale] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const handleSave = async () => {
    if (!title.trim() || !recommendationText.trim()) {
      showNotification({ message: 'Please fill in at least the Title and Recommendation Text fields.', type: 'warning' });
      return;
    }

    const finalTags = isPatientSpecific
      ? ['patient_specific', ...tags.filter(t => t !== 'patient_specific')]
      : tags.filter(t => t !== 'patient_specific');

    setSaving(true);
    setSaveError(null);
    try {
      // A rejecting onSave means the save did not happen — keep the dialog open
      // with the entered values so nothing the user typed is lost.
      await onSave({
        title: title.trim(),
        recommendationText: recommendationText.trim(),
        evaluationCriteria: evaluationCriteria.trim(),
        rationale: rationale.trim(),
        tags: finalTags,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save recommendation.');
      return;
    } finally {
      setSaving(false);
    }

    // Reset form
    setTitle('');
    setRecommendationText('');
    setEvaluationCriteria('');
    setRationale('');
    setTagInput('');
    setTags([]);
    setSaveError(null);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSaveError(null);
    setTitle('');
    setRecommendationText('');
    setEvaluationCriteria('');
    setRationale('');
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
            {isPatientSpecific ? 'Add Patient-Specific Recommendation' : 'Add New Recommendation Item'}
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
              placeholder="e.g., Discontinue Unnecessary Statin"
              className="w-full"
              style={{
                borderColor: UI_COLORS.border.default,
                backgroundColor: UI_COLORS.background.white,
              }}
            />
          </div>

          {/* Recommendation Text */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
              Recommendation Text
            </label>
            <textarea
              value={recommendationText}
              onChange={(e) => setRecommendationText(e.target.value)}
              placeholder="e.g., Recommend discontinuing atorvastatin as the patient no longer meets criteria for statin therapy..."
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
              placeholder="e.g., The student identifies the correct medication, provides clinical justification, and suggests an appropriate monitoring plan..."
              className="w-full px-3 py-2 rounded-md border resize-none"
              rows={5}
              style={{
                borderColor: UI_COLORS.border.default,
                backgroundColor: UI_COLORS.background.white,
                color: UI_COLORS.text.heading,
              }}
            />
          </div>

          {/* Rationale */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
              Rationale
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="e.g., Based on current guidelines, statin therapy is no longer indicated when the patient's cardiovascular risk has been reassessed..."
              className="w-full px-3 py-2 rounded-md border resize-none"
              rows={4}
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

        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t" style={{ borderColor: UI_COLORS.border.default }}>
          {saveError && (
            <p className="text-sm mb-3" role="alert" style={{ color: UI_COLORS.text.error }}>
              {saveError}
            </p>
          )}
          <div className="flex justify-end gap-3">
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
              onClick={() => void handleSave()}
              disabled={saving}
              style={{
                backgroundColor: UI_COLORS.button.primary,
                color: UI_COLORS.button.text,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = UI_COLORS.button.primary)}
            >
              {saving ? 'Saving...' : 'Save Recommendation'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
