import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UI_COLORS } from '@/lib/colors';
import { createRecommendationItem } from '@/services/recommendationsBankService';
import { useNotification } from '@/components/notifications';

interface AddRecommendationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onSave: () => void;      // Callback after successful save
}

export function AddRecommendationDialog({ open, onOpenChange, organizationId, onSave }: AddRecommendationDialogProps) {
  const { showNotification } = useNotification();
  const [title, setTitle] = useState('');
  const [recommendationText, setRecommendationText] = useState('');
  const [evaluationCriteria, setEvaluationCriteria] = useState('');
  const [rationale, setRationale] = useState('');
  const [saving, setSaving] = useState(false);

  // Validation state
  const [titleError, setTitleError] = useState('');
  const [recommendationTextError, setRecommendationTextError] = useState('');

  const resetForm = () => {
    setTitle('');
    setRecommendationText('');
    setEvaluationCriteria('');
    setRationale('');
    setTitleError('');
    setRecommendationTextError('');
  };

  const validate = (): boolean => {
    let valid = true;

    if (!title.trim()) {
      setTitleError('Title is required');
      valid = false;
    } else {
      setTitleError('');
    }

    if (!recommendationText.trim()) {
      setRecommendationTextError('Recommendation text is required');
      valid = false;
    } else {
      setRecommendationTextError('');
    }

    return valid;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await createRecommendationItem(organizationId, {
        title: title.trim(),
        recommendationText: recommendationText.trim(),
        evaluationCriteria: evaluationCriteria.trim(),
        rationale: rationale.trim(),
      });

      showNotification({ message: 'Recommendation item created successfully.', type: 'success' });
      resetForm();
      onOpenChange(false);
      onSave();
    } catch {
      showNotification({ message: 'Failed to create recommendation item. Please try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ color: UI_COLORS.text.heading }}>
            Add New Recommendation Item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (e.target.value.trim()) setTitleError('');
              }}
              placeholder="e.g., Initiate ACE Inhibitor Therapy"
              maxLength={150}
              className="w-full"
              style={{
                borderColor: titleError ? UI_COLORS.status.error : UI_COLORS.border.default,
                backgroundColor: UI_COLORS.background.white,
              }}
            />
            {titleError && (
              <p className="text-sm mt-1" style={{ color: UI_COLORS.status.error }}>{titleError}</p>
            )}
          </div>

          {/* Recommendation Text */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
              Recommendation Text <span className="text-red-500">*</span>
            </label>
            <textarea
              value={recommendationText}
              onChange={(e) => {
                setRecommendationText(e.target.value);
                if (e.target.value.trim()) setRecommendationTextError('');
              }}
              placeholder="e.g., Start lisinopril 10mg once daily for blood pressure management and renal protection in this diabetic patient."
              className="w-full px-3 py-2 rounded-md border resize-none"
              rows={3}
              maxLength={1000}
              style={{
                borderColor: recommendationTextError ? UI_COLORS.status.error : UI_COLORS.border.default,
                backgroundColor: UI_COLORS.background.white,
                color: UI_COLORS.text.heading,
              }}
            />
            {recommendationTextError && (
              <p className="text-sm mt-1" style={{ color: UI_COLORS.status.error }}>{recommendationTextError}</p>
            )}
          </div>

          {/* Evaluation Criteria */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
              Evaluation Criteria
            </label>
            <textarea
              value={evaluationCriteria}
              onChange={(e) => setEvaluationCriteria(e.target.value)}
              placeholder="e.g., Student should recommend an ACE inhibitor with appropriate starting dose and identify the dual benefit of BP control and nephroprotection."
              className="w-full px-3 py-2 rounded-md border resize-none"
              rows={3}
              maxLength={1000}
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
              placeholder="e.g., ACE inhibitors are first-line for hypertension in patients with diabetes due to their renoprotective effects."
              className="w-full px-3 py-2 rounded-md border resize-none"
              rows={4}
              maxLength={1000}
              style={{
                borderColor: UI_COLORS.border.default,
                backgroundColor: UI_COLORS.background.white,
                color: UI_COLORS.text.heading,
              }}
            />
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
      </DialogContent>
    </Dialog>
  );
}
