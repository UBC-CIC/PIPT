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
  onSave: (recommendation: {
    title: string;
    recommendationText: string;
    evaluationCriteria: string;
    rationale: string;
  }) => void;
}

export function AddRecommendationDialog({ open, onOpenChange, onSave }: AddRecommendationDialogProps) {
  const { showNotification } = useNotification();
  const [title, setTitle] = useState('');
  const [recommendationText, setRecommendationText] = useState('');
  const [evaluationCriteria, setEvaluationCriteria] = useState('');
  const [rationale, setRationale] = useState('');

  const handleSave = () => {
    if (!title.trim() || !recommendationText.trim()) {
      showNotification({ message: 'Please fill in at least the Title and Recommendation Text fields.', type: 'warning' });
      return;
    }

    onSave({
      title: title.trim(),
      recommendationText: recommendationText.trim(),
      evaluationCriteria: evaluationCriteria.trim(),
      rationale: rationale.trim(),
    });

    // Reset form
    setTitle('');
    setRecommendationText('');
    setEvaluationCriteria('');
    setRationale('');
    onOpenChange(false);
  };

  const handleCancel = () => {
    setTitle('');
    setRecommendationText('');
    setEvaluationCriteria('');
    setRationale('');
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
            Add New Recommendation Item
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
            Save Recommendation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
