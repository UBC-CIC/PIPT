import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Pencil, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import LoadingIndicator from '@/components/LoadingIndicator';
import { AddQuestionDialog } from '@/components/AddQuestionDialog';
import { AddPatientSpecificQuestionBankDialog } from '@/components/AddPatientSpecificQuestionBankDialog';
import { useNotification } from '@/components/notifications';
import { useInstructorQuestionBank } from '@/hooks/useInstructorQuestionBank';
import {
  PATIENT_SPECIFIC_TAG,
  parseTagsInput,
  validateContentFields,
  type InstructorContentFields,
} from '@/lib/questionBankUtils';
import { SIMULATION_GROUP_COLOR_PALETTE, UI_COLORS } from '@/lib/colors';
import { instructorService, type QuestionBankItem } from '@/services/instructorService';
import { useAuth } from '@/App';

/** Fields the create dialogs emit. */
interface CreateDialogFields {
  title: string;
  keyQuestion: string;
  clinicalIntent: string;
  evaluationCriteria: string;
  required: boolean;
  tags?: string[];
}

/** Inline edit form state for a single expanded row. */
interface EditFormState {
  title: string;
  questionText: string;
  clinicalIntent: string;
  evaluationCriteria: string;
  isMandatory: boolean;
}

const EMPTY_EDIT_FORM: EditFormState = {
  title: '',
  questionText: '',
  clinicalIntent: '',
  evaluationCriteria: '',
  isMandatory: false,
};

/** Human labels for the fields `validateContentFields` can reject. */
const FIELD_LABELS: Record<'title' | 'question_text' | 'evaluation_criteria', string> = {
  title: 'Title',
  question_text: 'Key Question',
  evaluation_criteria: 'Evaluation Criteria',
};

/**
 * InstructorQuestionBankPage
 *
 * Instructor-facing question bank management: read, create, and in-place edit of
 * organization question bank items. Removal is an admin-only capability, so this
 * module carries no removal affordance of any kind and no admin-side import —
 * every call goes through `instructorService` via `useInstructorQuestionBank`.
 */
function InstructorQuestionBankPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { showNotification } = useNotification();

  const {
    activeItems,
    filteredCount,
    totalPages,
    currentPage,
    allExistingTags,
    tab,
    setTab,
    searchQuery,
    setSearchQuery,
    setPage,
    setItemsPerPage,
    organizationIds,
    activeOrganizationId,
    setActiveOrganizationId,
    canCreate,
    loading,
    error,
    reload,
    createItem,
    updateItem,
  } = useInstructorQuestionBank();

  const [user, setUser] = useState<{ name: string; avatarUrl?: string }>({ name: 'Instructor' });

  // Page size is mirrored locally so the "showing X–Y of N" range can be computed.
  const [itemsPerPage, setItemsPerPageLocal] = useState(5);

  // Create dialogs
  const [isAddQuestionDialogOpen, setIsAddQuestionDialogOpen] = useState(false);
  const [isAddPatientQuestionDialogOpen, setIsAddPatientQuestionDialogOpen] = useState(false);

  // Expand / in-place edit
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(EMPTY_EDIT_FORM);
  // Raw comma-separated tag text, kept apart from the parsed list so typing is lossless.
  const [editTagsInput, setEditTagsInput] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const isPatientSpecificTab = tab === 'patientSpecific';

  useEffect(() => {
    let cancelled = false;
    instructorService
      .getCurrentUser()
      .then((data) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        // Header falls back to the default name; not worth surfacing.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      showNotification({ message: 'Sign out failed. Please try again.', type: 'error' });
    }
  };

  const handleItemsPerPageChange = (next: number) => {
    setItemsPerPageLocal(next);
    setItemsPerPage(next);
  };

  const handleTabChange = (next: 'global' | 'patientSpecific') => {
    setEditingItemId(null);
    setEditError(null);
    setExpandedItemId(null);
    setTab(next);
  };

  // ─── Create ───────────────────────────────────────────────────────────────

  /**
   * Validate then create. A rejection is how the dialog learns to stay open with
   * the entered values intact, so both the validation and failure paths rethrow.
   */
  const handleCreate = async (question: CreateDialogFields) => {
    const fields: InstructorContentFields = {
      title: question.title,
      question_text: question.keyQuestion,
      clinical_intent: question.clinicalIntent,
      evaluation_criteria: question.evaluationCriteria,
      is_mandatory: question.required,
      tags: question.tags || [],
    };

    const validation = validateContentFields(fields, 'create');
    if (!validation.valid) {
      const missing = validation.errors.map((field) => FIELD_LABELS[field]).join(', ');
      showNotification({ message: `Please fill in the required fields: ${missing}.`, type: 'warning' });
      throw new Error(`Missing required fields: ${missing}`);
    }

    try {
      await createItem(fields);
      showNotification({ message: `"${fields.title.trim()}" created successfully.`, type: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create question.';
      showNotification({ message, type: 'error' });
      throw err instanceof Error ? err : new Error(message);
    }
  };

  // ─── Expand / edit ────────────────────────────────────────────────────────

  const toggleExpand = (itemId: string) => {
    if (editingItemId === itemId) return;
    setExpandedItemId((previous) => (previous === itemId ? null : itemId));
  };

  const startEditing = (item: QuestionBankItem) => {
    setExpandedItemId(item.id);
    setEditingItemId(item.id);
    setEditForm({
      title: item.title,
      questionText: item.questionText,
      clinicalIntent: item.clinicalIntent,
      evaluationCriteria: item.evaluationCriteria,
      isMandatory: item.isMandatory,
    });
    setEditTagsInput((item.tags || []).filter((t) => t !== PATIENT_SPECIFIC_TAG).join(', '));
    setEditError(null);
  };

  /** Discard the draft. The stored item was never mutated, so the row restores itself. */
  const cancelEditing = () => {
    setEditingItemId(null);
    setEditForm(EMPTY_EDIT_FORM);
    setEditTagsInput('');
    setEditError(null);
  };

  const saveEditing = async () => {
    if (editingItemId === null) return;

    const fields: InstructorContentFields = {
      title: editForm.title,
      question_text: editForm.questionText,
      clinical_intent: editForm.clinicalIntent,
      evaluation_criteria: editForm.evaluationCriteria,
      is_mandatory: editForm.isMandatory,
      tags: parseTagsInput(editTagsInput),
    };

    const validation = validateContentFields(fields, 'edit');
    if (!validation.valid) {
      const missing = validation.errors.map((field) => FIELD_LABELS[field]).join(', ');
      setEditError(`${missing} cannot be blank.`);
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      await updateItem(editingItemId, fields);
      setEditingItemId(null);
      setEditForm(EMPTY_EDIT_FORM);
      setEditTagsInput('');
      showNotification({ message: `"${fields.title.trim()}" updated successfully.`, type: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save changes.';
      setEditError(message);
      showNotification({ message, type: 'error' });
    } finally {
      setEditSaving(false);
    }
  };

  const rangeStart = filteredCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const rangeEnd = Math.min(currentPage * itemsPerPage, filteredCount);
  const activeTabColor = SIMULATION_GROUP_COLOR_PALETTE[2];

  return (
    <PageContainer>
      <DashboardHeader
        title="Instructor Dashboard"
        subtitle="Question Bank Management"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
        onStudentView={() => navigate('/student')}
        showStudentViewButton={false}
      />

      {loading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <LoadingIndicator size="md" message="Loading question bank..." />
        </div>
      )}

      {error && (
        <div
          className="mx-8 mt-4 p-4 rounded-md border"
          style={{ backgroundColor: UI_COLORS.changelog.notWorkingBg, borderColor: UI_COLORS.status.error }}
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm" style={{ color: UI_COLORS.text.error }}>{error}</p>
            <Button
              onClick={() => void reload()}
              variant="outline"
              className="text-sm"
              style={{ borderColor: UI_COLORS.status.error, color: UI_COLORS.text.error }}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {!loading && (
        <main className="flex-1 overflow-y-auto">
          <div className="h-full flex flex-col">
            <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: UI_COLORS.border.default }}>
              <div className="mb-6">
                <Link
                  to="/instructor/configuration"
                  className="font-normal text-sm flex items-center gap-1 no-underline transition-colors"
                  style={{ color: UI_COLORS.text.body }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = UI_COLORS.text.heading)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = UI_COLORS.text.body)}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Scoring & Configuration
                </Link>
              </div>

              <h2 className="text-2xl font-bold mb-4" style={{ color: UI_COLORS.text.heading }}>
                Question Bank
              </h2>

              {/* Organization region */}
              {organizationIds.length === 0 && (
                <div
                  className="mb-6 p-4 rounded-md border"
                  style={{
                    backgroundColor: UI_COLORS.background.subtle,
                    borderColor: UI_COLORS.border.default,
                  }}
                >
                  <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                    You don't have any simulation groups yet. Create a simulation group before adding
                    question bank items.
                  </p>
                </div>
              )}

              {organizationIds.length >= 2 && (
                <div className="mb-6 flex items-center gap-3">
                  <label
                    htmlFor="instructor-organization-select"
                    className="text-sm font-medium"
                    style={{ color: UI_COLORS.text.body }}
                  >
                    Organization:
                  </label>
                  <select
                    id="instructor-organization-select"
                    value={activeOrganizationId ?? ''}
                    onChange={(e) => setActiveOrganizationId(e.target.value)}
                    className="px-3 py-1.5 rounded border text-sm"
                    style={{
                      borderColor: UI_COLORS.border.default,
                      backgroundColor: UI_COLORS.background.white,
                      color: UI_COLORS.text.heading,
                    }}
                  >
                    {organizationIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tab switcher */}
              <div className="flex gap-2 border-b" style={{ borderColor: UI_COLORS.border.default }}>
                <button
                  onClick={() => handleTabChange('global')}
                  className="px-6 py-3 font-medium transition-colors border-b-2"
                  style={{
                    color: tab === 'global' ? activeTabColor : UI_COLORS.text.body,
                    borderColor: tab === 'global' ? activeTabColor : UI_COLORS.border.transparent,
                    backgroundColor: UI_COLORS.background.transparent,
                    cursor: 'pointer',
                  }}
                >
                  Group-Wide Questions
                </button>
                <button
                  onClick={() => handleTabChange('patientSpecific')}
                  className="px-6 py-3 font-medium transition-colors border-b-2"
                  style={{
                    color: isPatientSpecificTab ? activeTabColor : UI_COLORS.text.body,
                    borderColor: isPatientSpecificTab ? activeTabColor : UI_COLORS.border.transparent,
                    backgroundColor: UI_COLORS.background.transparent,
                    cursor: 'pointer',
                  }}
                >
                  Patient-Specific Questions
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="space-y-3">
                <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                  {isPatientSpecificTab
                    ? 'Manage patient-specific key questions.'
                    : 'Manage group-wide key questions — these apply across all patients in a simulation group.'}
                </p>

                {/* Search */}
                <div className="relative mb-4">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: UI_COLORS.text.muted }}
                  />
                  <Input
                    type="text"
                    placeholder={
                      isPatientSpecificTab
                        ? 'Search patient-specific questions...'
                        : 'Search group-wide questions...'
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    style={{ borderColor: UI_COLORS.border.default }}
                    aria-label={
                      isPatientSpecificTab
                        ? 'Search patient-specific questions'
                        : 'Search group-wide questions'
                    }
                  />
                </div>

                {/* Create control */}
                <Button
                  onClick={() =>
                    isPatientSpecificTab
                      ? setIsAddPatientQuestionDialogOpen(true)
                      : setIsAddQuestionDialogOpen(true)
                  }
                  disabled={!canCreate}
                  className="w-full justify-start gap-2 py-3 h-auto font-medium transition-colors mb-4"
                  style={{
                    backgroundColor: UI_COLORS.button.primary,
                    color: UI_COLORS.button.text,
                    opacity: canCreate ? 1 : 0.5,
                    cursor: canCreate ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Plus className="w-5 h-5" />
                  {isPatientSpecificTab
                    ? 'Add New Patient-Specific Question'
                    : 'Add New Group-Wide Question'}
                </Button>

                {/* Pagination info */}
                {filteredCount > 0 && (
                  <div
                    className="flex items-center justify-between mb-3 text-sm"
                    style={{ color: UI_COLORS.text.muted }}
                  >
                    <span>
                      Showing {rangeStart}-{rangeEnd} of {filteredCount} questions
                    </span>
                  </div>
                )}

                {/* Rows */}
                <div className="space-y-2">
                  {activeItems.map((item) => {
                    const isExpanded = expandedItemId === item.id;
                    const isEditing = editingItemId === item.id;
                    const visibleTags = (item.tags || []).filter((t) => t !== PATIENT_SPECIFIC_TAG);

                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border"
                        style={{
                          borderColor: UI_COLORS.border.default,
                          backgroundColor: UI_COLORS.background.white,
                        }}
                      >
                        <div className="flex items-center gap-3 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            className="flex flex-1 items-center gap-3 text-left bg-transparent border-0 p-0 cursor-pointer"
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} question: ${item.title}`}
                          >
                            <span className="flex-shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                              ) : (
                                <ChevronRight className="w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                              )}
                            </span>
                            <span
                              className="flex-1 font-medium text-sm truncate"
                              style={{ color: UI_COLORS.text.heading }}
                            >
                              {item.title}
                            </span>
                          </button>

                          <span
                            className="inline-block text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: item.isMandatory
                                ? UI_COLORS.changelog.workingBg
                                : UI_COLORS.background.hoverLight,
                              color: item.isMandatory
                                ? UI_COLORS.changelog.workingText
                                : UI_COLORS.text.muted,
                            }}
                          >
                            {item.isMandatory ? 'Required' : 'Optional'}
                          </span>

                          <button
                            type="button"
                            onClick={() => startEditing(item)}
                            className="p-1.5 rounded transition-colors flex-shrink-0 bg-transparent border-0 cursor-pointer"
                            style={{ color: UI_COLORS.icon.muted }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = UI_COLORS.text.heading)}
                            onMouseLeave={(e) => (e.currentTarget.style.color = UI_COLORS.icon.muted)}
                            aria-label={`Edit question: ${item.title}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="border-t px-4 pb-4" style={{ borderColor: UI_COLORS.border.default }}>
                            {isEditing ? (
                              <div className="space-y-4 pt-4">
                                {editError && (
                                  <p className="text-sm" style={{ color: UI_COLORS.text.error }} role="alert">
                                    {editError}
                                  </p>
                                )}
                                <div>
                                  <label
                                    className="block text-xs font-semibold mb-1"
                                    style={{ color: UI_COLORS.text.muted }}
                                  >
                                    Title
                                  </label>
                                  <Input
                                    value={editForm.title}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({ ...prev, title: e.target.value }))
                                    }
                                    placeholder="Question title"
                                    style={{ borderColor: UI_COLORS.border.default }}
                                    aria-label={`Title for question: ${item.title}`}
                                  />
                                </div>
                                <div>
                                  <label
                                    className="block text-xs font-semibold mb-1"
                                    style={{ color: UI_COLORS.text.muted }}
                                  >
                                    Key Question
                                  </label>
                                  <textarea
                                    value={editForm.questionText}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({ ...prev, questionText: e.target.value }))
                                    }
                                    placeholder="The key question the student is expected to ask..."
                                    className="w-full px-3 py-2 rounded-md border resize-none text-sm"
                                    rows={3}
                                    style={{
                                      borderColor: UI_COLORS.border.default,
                                      backgroundColor: UI_COLORS.background.white,
                                      color: UI_COLORS.text.heading,
                                    }}
                                    aria-label={`Key question for question: ${item.title}`}
                                  />
                                </div>
                                <div>
                                  <label
                                    className="block text-xs font-semibold mb-1"
                                    style={{ color: UI_COLORS.text.muted }}
                                  >
                                    Clinical Intent
                                  </label>
                                  <textarea
                                    value={editForm.clinicalIntent}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({ ...prev, clinicalIntent: e.target.value }))
                                    }
                                    placeholder="Why this question matters clinically..."
                                    className="w-full px-3 py-2 rounded-md border resize-none text-sm"
                                    rows={2}
                                    style={{
                                      borderColor: UI_COLORS.border.default,
                                      backgroundColor: UI_COLORS.background.white,
                                      color: UI_COLORS.text.heading,
                                    }}
                                    aria-label={`Clinical intent for question: ${item.title}`}
                                  />
                                </div>
                                <div>
                                  <label
                                    className="block text-xs font-semibold mb-1"
                                    style={{ color: UI_COLORS.text.muted }}
                                  >
                                    Evaluation Criteria
                                  </label>
                                  <textarea
                                    value={editForm.evaluationCriteria}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        evaluationCriteria: e.target.value,
                                      }))
                                    }
                                    placeholder="How to evaluate whether the student addressed this question..."
                                    className="w-full px-3 py-2 rounded-md border resize-none text-sm"
                                    rows={2}
                                    style={{
                                      borderColor: UI_COLORS.border.default,
                                      backgroundColor: UI_COLORS.background.white,
                                      color: UI_COLORS.text.heading,
                                    }}
                                    aria-label={`Evaluation criteria for question: ${item.title}`}
                                  />
                                </div>
                                <div>
                                  <label
                                    className="block text-xs font-semibold mb-1"
                                    style={{ color: UI_COLORS.text.muted }}
                                  >
                                    Tags (comma-separated)
                                  </label>
                                  <Input
                                    value={editTagsInput}
                                    onChange={(e) => setEditTagsInput(e.target.value)}
                                    placeholder="e.g. cardiology, history, allergies"
                                    style={{ borderColor: UI_COLORS.border.default }}
                                    aria-label={`Tags for question: ${item.title}`}
                                  />
                                </div>
                                <div className="flex items-center gap-3">
                                  <span
                                    className="text-xs font-semibold"
                                    style={{ color: UI_COLORS.text.muted }}
                                  >
                                    Requirement:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditForm((prev) => ({ ...prev, isMandatory: !prev.isMandatory }))
                                    }
                                    className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors border-0 cursor-pointer"
                                    style={{
                                      backgroundColor: editForm.isMandatory
                                        ? UI_COLORS.toggle.active
                                        : UI_COLORS.toggle.inactive,
                                    }}
                                    role="switch"
                                    aria-checked={editForm.isMandatory}
                                    aria-label={`Toggle required for question: ${item.title}`}
                                  >
                                    <span
                                      className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
                                      style={{
                                        backgroundColor: UI_COLORS.background.white,
                                        transform: editForm.isMandatory
                                          ? 'translateX(18px)'
                                          : 'translateX(3px)',
                                      }}
                                    />
                                  </button>
                                  <span
                                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: editForm.isMandatory
                                        ? UI_COLORS.changelog.workingBg
                                        : UI_COLORS.background.hoverLight,
                                      color: editForm.isMandatory
                                        ? UI_COLORS.changelog.workingText
                                        : UI_COLORS.text.muted,
                                    }}
                                  >
                                    {editForm.isMandatory ? 'Required' : 'Optional'}
                                  </span>
                                </div>
                                <div
                                  className="flex items-center gap-2 pt-3 border-t"
                                  style={{ borderColor: UI_COLORS.border.default }}
                                >
                                  <Button
                                    onClick={() => void saveEditing()}
                                    disabled={editSaving}
                                    className="gap-1.5"
                                    style={{
                                      backgroundColor: UI_COLORS.button.primary,
                                      color: UI_COLORS.button.text,
                                    }}
                                    aria-label={`Save changes to question: ${item.title}`}
                                  >
                                    <Check className="w-4 h-4" />
                                    {editSaving ? 'Saving...' : 'Save'}
                                  </Button>
                                  <Button
                                    onClick={cancelEditing}
                                    variant="outline"
                                    className="gap-1.5"
                                    style={{
                                      borderColor: UI_COLORS.border.default,
                                      color: UI_COLORS.text.heading,
                                    }}
                                    aria-label={`Cancel editing question: ${item.title}`}
                                  >
                                    <X className="w-4 h-4" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3 pt-4">
                                <div>
                                  <span
                                    className="block text-xs font-semibold mb-1"
                                    style={{ color: UI_COLORS.text.muted }}
                                  >
                                    Key Question
                                  </span>
                                  <p
                                    className="text-sm whitespace-pre-line"
                                    style={{
                                      color: item.questionText
                                        ? UI_COLORS.text.body
                                        : UI_COLORS.text.muted,
                                    }}
                                  >
                                    {item.questionText || '—'}
                                  </p>
                                </div>
                                <div>
                                  <span
                                    className="block text-xs font-semibold mb-1"
                                    style={{ color: UI_COLORS.text.muted }}
                                  >
                                    Evaluation Criteria
                                  </span>
                                  <p
                                    className="text-sm whitespace-pre-line"
                                    style={{
                                      color: item.evaluationCriteria
                                        ? UI_COLORS.text.body
                                        : UI_COLORS.text.muted,
                                    }}
                                  >
                                    {item.evaluationCriteria || '—'}
                                  </p>
                                </div>
                                <div>
                                  <span
                                    className="block text-xs font-semibold mb-1"
                                    style={{ color: UI_COLORS.text.muted }}
                                  >
                                    Tags
                                  </span>
                                  {visibleTags.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {visibleTags.map((tag) => (
                                        <span
                                          key={tag}
                                          className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                                          style={{
                                            backgroundColor: UI_COLORS.badge.interviewPracticeBg,
                                            color: UI_COLORS.badge.interviewPracticeText,
                                          }}
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>—</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Empty states: no search match versus a genuinely empty tab */}
                {filteredCount === 0 && !error && (
                  <div className="text-center py-8">
                    <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>
                      {searchQuery
                        ? 'No questions match your search.'
                        : isPatientSpecificTab
                          ? 'No patient-specific questions yet. Add your first one above.'
                          : 'No group-wide questions yet. Add your first one above.'}
                    </p>
                  </div>
                )}

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div
                    className="flex items-center justify-between mt-4 pt-4 border-t"
                    style={{ borderColor: UI_COLORS.border.default }}
                  >
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="instructor-question-bank-page-size"
                        className="text-sm"
                        style={{ color: UI_COLORS.text.body }}
                      >
                        Items per page:
                      </label>
                      <select
                        id="instructor-question-bank-page-size"
                        value={itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                        className="px-3 py-1 rounded border text-sm"
                        style={{
                          borderColor: UI_COLORS.border.default,
                          backgroundColor: UI_COLORS.background.white,
                          color: UI_COLORS.text.heading,
                        }}
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        variant="outline"
                        className="px-3 py-1 text-sm"
                        style={{
                          opacity: currentPage === 1 ? 0.5 : 1,
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Previous
                      </Button>
                      <span className="text-sm px-3" style={{ color: UI_COLORS.text.body }}>
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        onClick={() => setPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        variant="outline"
                        className="px-3 py-1 text-sm"
                        style={{
                          opacity: currentPage === totalPages ? 0.5 : 1,
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      )}

      <AddQuestionDialog
        open={isAddQuestionDialogOpen}
        onOpenChange={setIsAddQuestionDialogOpen}
        questionType="global"
        existingTags={allExistingTags}
        onSave={handleCreate}
      />

      <AddPatientSpecificQuestionBankDialog
        open={isAddPatientQuestionDialogOpen}
        onOpenChange={setIsAddPatientQuestionDialogOpen}
        onSave={handleCreate}
      />
    </PageContainer>
  );
}

export default InstructorQuestionBankPage;
