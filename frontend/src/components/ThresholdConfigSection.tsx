import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNotification } from '@/components/notifications';
import { UI_COLORS } from '@/lib/colors';
import * as adminApi from '@/services/adminApiService';
import type { ThresholdConfig } from '@/services/adminApiService';
import { RotateCcw } from 'lucide-react';

interface ThresholdConfigSectionProps {
  organizationId: string;
}

interface ThresholdField {
  key: keyof ThresholdConfig;
  label: string;
  description: string;
}

const THRESHOLD_FIELDS: ThresholdField[] = [
  {
    key: 'key_question_threshold',
    label: 'Key Question Threshold',
    description: 'Controls how closely a student message must match a key question to be considered addressed. Used during live chat matching.',
  },
  {
    key: 'dtp_threshold',
    label: 'DTP Threshold',
    description: 'Controls how closely a student-submitted Drug Therapy Problem must match an expected DTP to count as correct during debrief scoring.',
  },
  {
    key: 'recommendation_threshold',
    label: 'Recommendation Threshold',
    description: 'Controls how closely a student-submitted recommendation must match an expected recommendation to count as correct during debrief scoring.',
  },
];

function validateThresholdValue(value: string): { valid: boolean; error: string | null } {
  if (value === '') return { valid: true, error: null };
  const num = parseFloat(value);
  if (isNaN(num)) return { valid: false, error: 'Must be a number' };
  if (num < 0 || num > 1) return { valid: false, error: 'Must be between 0.0 and 1.0' };
  return { valid: true, error: null };
}

/**
 * ThresholdConfigSection Component
 *
 * Displays and manages the matching threshold configuration for an organization.
 * Allows admins to set key question, DTP, and recommendation similarity thresholds.
 */
function ThresholdConfigSection({ organizationId }: ThresholdConfigSectionProps) {
  const { showNotification } = useNotification();

  // Form state — string values for controlled inputs (empty string = null/default)
  const [formValues, setFormValues] = useState<Record<keyof ThresholdConfig, string>>({
    key_question_threshold: '',
    dtp_threshold: '',
    recommendation_threshold: '',
  });
  const [errors, setErrors] = useState<Record<keyof ThresholdConfig, string | null>>({
    key_question_threshold: null,
    dtp_threshold: null,
    recommendation_threshold: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch current thresholds on mount
  useEffect(() => {
    const fetchThresholds = async () => {
      try {
        const config = await adminApi.getOrganizationThresholds(organizationId);
        setFormValues({
          key_question_threshold: config.key_question_threshold !== null ? String(config.key_question_threshold) : '',
          dtp_threshold: config.dtp_threshold !== null ? String(config.dtp_threshold) : '',
          recommendation_threshold: config.recommendation_threshold !== null ? String(config.recommendation_threshold) : '',
        });
      } catch (error) {
        console.error('Failed to load thresholds:', error);
        showNotification({ message: 'Failed to load threshold configuration.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchThresholds();
  }, [organizationId, showNotification]);

  const handleInputChange = useCallback((field: keyof ThresholdConfig, value: string) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
    const { error } = validateThresholdValue(value);
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const handleReset = useCallback((field: keyof ThresholdConfig) => {
    setFormValues(prev => ({ ...prev, [field]: '' }));
    setErrors(prev => ({ ...prev, [field]: null }));
  }, []);

  const hasValidationErrors = Object.values(errors).some(e => e !== null);

  const handleSave = async () => {
    if (hasValidationErrors) return;

    setSaving(true);
    try {
      const params: Partial<ThresholdConfig> = {};
      for (const field of THRESHOLD_FIELDS) {
        const value = formValues[field.key];
        if (value === '') {
          params[field.key] = null;
        } else {
          params[field.key] = parseFloat(value);
        }
      }

      const updated = await adminApi.updateOrganizationThresholds(organizationId, params);

      // Sync form with server response
      setFormValues({
        key_question_threshold: updated.key_question_threshold !== null ? String(updated.key_question_threshold) : '',
        dtp_threshold: updated.dtp_threshold !== null ? String(updated.dtp_threshold) : '',
        recommendation_threshold: updated.recommendation_threshold !== null ? String(updated.recommendation_threshold) : '',
      });

      showNotification({ message: 'Thresholds updated successfully.', type: 'success' });
    } catch (error) {
      console.error('Failed to save thresholds:', error);
      const message = error instanceof Error ? error.message : 'Failed to save threshold configuration.';
      showNotification({ message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="border rounded-lg p-6 mb-6 animate-pulse" style={{ borderColor: UI_COLORS.border.default }}>
        <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
        <div className="space-y-4">
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="border rounded-lg p-6 mb-6"
      style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
    >
      {/* Header */}
      <h3 className="text-lg font-semibold mb-1" style={{ color: UI_COLORS.text.heading }}>
        Matching Thresholds
      </h3>
      <p className="text-sm mb-6" style={{ color: UI_COLORS.text.muted }}>
        Configure the minimum similarity scores required for semantic matching. Higher values mean stricter matching (fewer but more confident matches). Lower values mean more permissive matching (more matches but potentially less accurate). Leave empty to use the system default of 0.55.
      </p>

      {/* Threshold inputs */}
      <div className="space-y-5">
        {THRESHOLD_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor={field.key}
                className="text-sm font-medium"
                style={{ color: UI_COLORS.text.body }}
              >
                {field.label}
              </label>
              <button
                type="button"
                onClick={() => handleReset(field.key)}
                className="text-xs flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 transition-colors hover:opacity-80"
                style={{ color: UI_COLORS.text.muted }}
                title="Reset to default (0.55)"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to Default
              </button>
            </div>
            <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>
              {field.description}
            </p>
            <Input
              id={field.key}
              type="number"
              min={0}
              max={1}
              step={0.01}
              placeholder="0.55 (default)"
              value={formValues[field.key]}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              className={errors[field.key] ? 'border-red-500 focus-visible:ring-red-500' : ''}
              aria-invalid={!!errors[field.key]}
              aria-describedby={errors[field.key] ? `${field.key}-error` : undefined}
            />
            {errors[field.key] && (
              <p
                id={`${field.key}-error`}
                className="text-xs"
                style={{ color: UI_COLORS.status.error }}
                role="alert"
              >
                {errors[field.key]}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="mt-6">
        <Button
          onClick={handleSave}
          disabled={hasValidationErrors}
          loading={saving}
        >
          Save Thresholds
        </Button>
      </div>
    </div>
  );
}

export default ThresholdConfigSection;
