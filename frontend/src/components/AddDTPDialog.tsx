import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UI_COLORS } from '@/lib/colors';
import { createDTPItem } from '@/services/dtpBankService';
import { useNotification } from '@/components/notifications';

interface AddDTPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  existingTags: string[];  // For tag autocomplete
  onSave: () => void;      // Callback after successful save
}

export function AddDTPDialog({ open, onOpenChange, organizationId, existingTags, onSave }: AddDTPDialogProps) {
  const { showNotification } = useNotification();
  const [title, setTitle] = useState('');
  const [expectedDTPText, setExpectedDTPText] = useState('');
  const [clinicalIntent, setClinicalIntent] = useState('');
  const [evaluationCriteria, setEvaluationCriteria] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);

  // Validation state
  const [titleError, setTitleError] = useState('');
  const [expectedDTPTextError, setExpectedDTPTextError] = useState('');

  const tagInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter suggestions: match input, exclude already-added tags
  const suggestions = existingTags.filter(
    t => t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t)
  );

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        tagInputRef.current && !tagInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setTagInput('');
    setShowSuggestions(false);
  };

  const handleRemoveTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  const resetForm = () => {
    setTitle('');
    setExpectedDTPText('');
    setClinicalIntent('');
    setEvaluationCriteria('');
    setIsRequired(false);
    setTagInput('');
    setTags([]);
    setTitleError('');
    setExpectedDTPTextError('');
  };

  const validate = (): boolean => {
    let valid = true;

    if (!title.trim()) {
      setTitleError('Title is required');
      valid = false;
    } else {
      setTitleError('');
    }

    if (!expectedDTPText.trim()) {
      setExpectedDTPTextError('Expected DTP text is required');
      valid = false;
    } else {
      setExpectedDTPTextError('');
    }

    return valid;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await createDTPItem(organizationId, {
        title: title.trim(),
        expectedDTPText: expectedDTPText.trim(),
        clinicalIntent: clinicalIntent.trim(),
        evaluationCriteria: evaluationCriteria.trim(),
        tags,
        isRequired,
      });

      showNotification({ message: 'DTP item created successfully.', type: 'success' });
      resetForm();
      onOpenChange(false);
      onSave();
    } catch {
      showNotification({ message: 'Failed to create DTP item. Please try again.', type: 'error' });
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
            Add New DTP Item
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
              placeholder="e.g., Untreated Hypertension"
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

          {/* Expected DTP Text */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
              Expected DTP Text <span className="text-red-500">*</span>
            </label>
            <textarea
              value={expectedDTPText}
              onChange={(e) => {
                setExpectedDTPText(e.target.value);
                if (e.target.value.trim()) setExpectedDTPTextError('');
              }}
              placeholder="e.g., Patient has elevated blood pressure readings (>140/90 mmHg) on multiple visits without current antihypertensive therapy."
              className="w-full px-3 py-2 rounded-md border resize-none"
              rows={3}
              maxLength={1000}
              style={{
                borderColor: expectedDTPTextError ? UI_COLORS.status.error : UI_COLORS.border.default,
                backgroundColor: UI_COLORS.background.white,
                color: UI_COLORS.text.heading,
              }}
            />
            {expectedDTPTextError && (
              <p className="text-sm mt-1" style={{ color: UI_COLORS.status.error }}>{expectedDTPTextError}</p>
            )}
          </div>

          {/* Clinical Intent */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
              Clinical Intent
            </label>
            <textarea
              value={clinicalIntent}
              onChange={(e) => setClinicalIntent(e.target.value)}
              placeholder="e.g., Identify uncontrolled hypertension requiring pharmacological intervention to reduce cardiovascular risk."
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

          {/* Evaluation Criteria */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
              Evaluation Criteria
            </label>
            <textarea
              value={evaluationCriteria}
              onChange={(e) => setEvaluationCriteria(e.target.value)}
              placeholder="e.g., Student should identify the lack of antihypertensive therapy and recommend initiating treatment based on current guidelines."
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

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
              Tags
            </label>
            <p className="text-xs mb-2" style={{ color: UI_COLORS.text.muted }}>
              Add tags for filtering (e.g. cardiovascular, drug interaction). Press Enter or comma to add.
            </p>
            <div className="relative">
              <div className="flex gap-2 mb-2">
                <Input
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  placeholder="Type a tag..."
                  className="flex-1"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={showSuggestions && suggestions.length > 0}
                  aria-controls="dtp-tag-suggestions"
                  aria-autocomplete="list"
                  style={{
                    borderColor: UI_COLORS.border.default,
                    backgroundColor: UI_COLORS.background.white,
                  }}
                />
                <Button
                  type="button"
                  onClick={() => addTag(tagInput)}
                  variant="outline"
                  style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading }}
                >
                  Add
                </Button>
              </div>
              {showSuggestions && tagInput.length > 0 && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  id="dtp-tag-suggestions"
                  role="listbox"
                  className="absolute z-50 w-full max-h-40 overflow-y-auto rounded-md border shadow-md"
                  style={{
                    backgroundColor: UI_COLORS.background.white,
                    borderColor: UI_COLORS.border.default,
                    top: '100%',
                    marginTop: '-0.5rem',
                  }}
                >
                  {suggestions.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="w-full text-left px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors border-0 bg-transparent"
                      style={{ color: UI_COLORS.text.heading }}
                      onClick={() => addTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
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
                      className="ml-1 hover:text-red-600 transition-colors bg-transparent border-0 cursor-pointer p-0"
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Required/Optional Toggle */}
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
            disabled={saving}
            style={{
              backgroundColor: UI_COLORS.button.primary,
              color: UI_COLORS.button.text,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = UI_COLORS.button.primary)}
          >
            {saving ? 'Saving...' : 'Save DTP Item'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
