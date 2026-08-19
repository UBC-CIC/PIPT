import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import InstructorBankShell from '@/components/instructor-bank/InstructorBankShell';
import { AddDTPDialog } from '@/components/AddDTPDialog';
import { useNotification } from '@/components/notifications';
import { useInstructorItemBank } from '@/hooks/useInstructorItemBank';
import {
  DTP_BANK_CONFIG,
  type DTPContentFields,
} from '@/lib/instructorBankConfig';
import {
  PATIENT_SPECIFIC_TAG,
  parseTagsInput,
  type BankTab,
} from '@/lib/instructorBankUtils';
import { UI_COLORS } from '@/lib/colors';

/**
 * The DTP read model, derived from the descriptor rather than imported from the
 * service module — the descriptor is this page's only seam to the service layer.
 */
type DTPRow = Awaited<ReturnType<typeof DTP_BANK_CONFIG.list>>[number];

/**
 * Inline edit draft for one expanded row. The raw comma-separated tag text
 * lives here too, kept apart from the parsed list so typing stays lossless.
 */
interface EditFormState {
  title: string;
  expectedDTPText: string;
  clinicalIntent: string;
  evaluationCriteria: string;
  isRequired: boolean;
  tagsInput: string;
}

const EMPTY_EDIT_FORM: EditFormState = {
  title: '',
  expectedDTPText: '',
  clinicalIntent: '',
  evaluationCriteria: '',
  isRequired: false,
  tagsInput: '',
};

/**
 * InstructorDTPBankPage
 *
 * Instructor-facing DTP bank management: read, create, and in-place edit of the
 * organization's drug therapy problem items. The chrome — header, tabs, search,
 * create control, pagination, empty states — belongs to `InstructorBankShell`;
 * this module owns only the DTP row body and the two write paths.
 *
 * Removal stays an administrator capability, so no row control here removes
 * anything, and the page names no service module: `DTP_BANK_CONFIG` is the only
 * seam to the service layer.
 */
function InstructorDTPBankPage() {
  const { showNotification } = useNotification();

  const {
    activeItems,
    filteredCount,
    totalPages,
    currentPage,
    itemsPerPage,
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
  } = useInstructorItemBank(DTP_BANK_CONFIG);

  // Create dialog — one dialog serves both tabs, told which by `isPatientSpecific`.
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Expand / in-place edit
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(EMPTY_EDIT_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  /** Switching tabs abandons any draft — the row it belonged to is leaving view. */
  const handleTabChange = (next: BankTab) => {
    setEditingItemId(null);
    setEditForm(EMPTY_EDIT_FORM);
    setEditError(null);
    setExpandedItemId(null);
    setTab(next);
  };

  // ─── Create ───────────────────────────────────────────────────────────────

  /**
   * Persist a new DTP item. The hook validates the required text and throws a
   * message naming any blank field before it calls the service, so there is no
   * validation to repeat here — surfacing the message and rethrowing is what
   * keeps the dialog open with the entered values intact.
   */
  const handleCreate = async (dtp: DTPContentFields) => {
    try {
      await createItem(dtp);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save DTP item.';
      showNotification({ message, type: 'error' });
      throw err instanceof Error ? err : new Error(message);
    }
    showNotification({ message: `"${dtp.title.trim()}" created successfully.`, type: 'success' });
  };

  // ─── Expand / edit ────────────────────────────────────────────────────────

  const toggleExpand = (itemId: string) => {
    if (editingItemId === itemId) return;
    setExpandedItemId((previous) => (previous === itemId ? null : itemId));
  };

  const startEditing = (item: DTPRow) => {
    setExpandedItemId(item.id);
    setEditingItemId(item.id);
    setEditForm({
      title: item.title,
      expectedDTPText: item.expectedDTPText,
      clinicalIntent: item.clinicalIntent,
      evaluationCriteria: item.evaluationCriteria,
      isRequired: item.isRequired,
      tagsInput: (item.tags || []).filter((t) => t !== PATIENT_SPECIFIC_TAG).join(', '),
    });
    setEditError(null);
  };

  /**
   * Discard the draft. The stored item was never mutated — the draft only ever
   * lived in `editForm` — so the row restores its displayed values by
   * construction rather than by copying anything back.
   */
  const cancelEditing = () => {
    setEditingItemId(null);
    setEditForm(EMPTY_EDIT_FORM);
    setEditError(null);
  };

  const saveEditing = async () => {
    if (editingItemId === null) return;

    const fields: DTPContentFields = {
      title: editForm.title,
      expectedDTPText: editForm.expectedDTPText,
      clinicalIntent: editForm.clinicalIntent,
      evaluationCriteria: editForm.evaluationCriteria,
      isRequired: editForm.isRequired,
      tags: parseTagsInput(editForm.tagsInput),
    };

    setEditSaving(true);
    setEditError(null);
    try {
      // The hook rejects blank required text before it calls the service, and a
      // service failure propagates — either way the row stays in edit mode with
      // the entered values and the reason shown inline.
      await updateItem(editingItemId, fields);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save changes.';
      setEditError(message);
      showNotification({ message, type: 'error' });
      return;
    } finally {
      setEditSaving(false);
    }

    setEditingItemId(null);
    setEditForm(EMPTY_EDIT_FORM);
    showNotification({ message: `"${fields.title.trim()}" updated successfully.`, type: 'success' });
  };

  // ─── Row ──────────────────────────────────────────────────────────────────

  const renderRow = (item: DTPRow) => {
    const isExpanded = expandedItemId === item.id;
    const isEditing = editingItemId === item.id;
    const visibleTags = (item.tags || []).filter((t) => t !== PATIENT_SPECIFIC_TAG);

    return (
      <div
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
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} DTP: ${item.title}`}
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
              backgroundColor: item.isRequired
                ? UI_COLORS.changelog.workingBg
                : UI_COLORS.background.hoverLight,
              color: item.isRequired ? UI_COLORS.changelog.workingText : UI_COLORS.text.muted,
            }}
          >
            {item.isRequired ? 'Required' : 'Optional'}
          </span>

          <button
            type="button"
            onClick={() => startEditing(item)}
            className="p-1.5 rounded transition-colors flex-shrink-0 bg-transparent border-0 cursor-pointer"
            style={{ color: UI_COLORS.icon.muted }}
            onMouseEnter={(e) => (e.currentTarget.style.color = UI_COLORS.text.heading)}
            onMouseLeave={(e) => (e.currentTarget.style.color = UI_COLORS.icon.muted)}
            aria-label={`Edit DTP: ${item.title}`}
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
                    onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="DTP title"
                    style={{ borderColor: UI_COLORS.border.default }}
                    aria-label={`Title for DTP: ${item.title}`}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold mb-1"
                    style={{ color: UI_COLORS.text.muted }}
                  >
                    Expected DTP Text
                  </label>
                  <textarea
                    value={editForm.expectedDTPText}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, expectedDTPText: e.target.value }))
                    }
                    placeholder="The drug therapy problem the student is expected to identify..."
                    className="w-full px-3 py-2 rounded-md border resize-none text-sm"
                    rows={3}
                    style={{
                      borderColor: UI_COLORS.border.default,
                      backgroundColor: UI_COLORS.background.white,
                      color: UI_COLORS.text.heading,
                    }}
                    aria-label={`Expected DTP text for DTP: ${item.title}`}
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
                    placeholder="Why this DTP matters clinically..."
                    className="w-full px-3 py-2 rounded-md border resize-none text-sm"
                    rows={2}
                    style={{
                      borderColor: UI_COLORS.border.default,
                      backgroundColor: UI_COLORS.background.white,
                      color: UI_COLORS.text.heading,
                    }}
                    aria-label={`Clinical intent for DTP: ${item.title}`}
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
                      setEditForm((prev) => ({ ...prev, evaluationCriteria: e.target.value }))
                    }
                    placeholder="How to evaluate whether the student identified this DTP..."
                    className="w-full px-3 py-2 rounded-md border resize-none text-sm"
                    rows={2}
                    style={{
                      borderColor: UI_COLORS.border.default,
                      backgroundColor: UI_COLORS.background.white,
                      color: UI_COLORS.text.heading,
                    }}
                    aria-label={`Evaluation criteria for DTP: ${item.title}`}
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
                    value={editForm.tagsInput}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, tagsInput: e.target.value }))
                    }
                    placeholder="e.g. cardiovascular, polypharmacy"
                    style={{ borderColor: UI_COLORS.border.default }}
                    aria-label={`Tags for DTP: ${item.title}`}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold" style={{ color: UI_COLORS.text.muted }}>
                    Requirement:
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, isRequired: !prev.isRequired }))}
                    className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors border-0 cursor-pointer"
                    style={{
                      backgroundColor: editForm.isRequired
                        ? UI_COLORS.toggle.active
                        : UI_COLORS.toggle.inactive,
                    }}
                    role="switch"
                    aria-checked={editForm.isRequired}
                    aria-label={`Toggle required for DTP: ${item.title}`}
                  >
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
                      style={{
                        backgroundColor: UI_COLORS.background.white,
                        transform: editForm.isRequired ? 'translateX(18px)' : 'translateX(3px)',
                      }}
                    />
                  </button>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: editForm.isRequired
                        ? UI_COLORS.changelog.workingBg
                        : UI_COLORS.background.hoverLight,
                      color: editForm.isRequired
                        ? UI_COLORS.changelog.workingText
                        : UI_COLORS.text.muted,
                    }}
                  >
                    {editForm.isRequired ? 'Required' : 'Optional'}
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
                    aria-label={`Save changes to DTP: ${item.title}`}
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
                    aria-label={`Cancel editing DTP: ${item.title}`}
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
                    Expected DTP Text
                  </span>
                  <p
                    className="text-sm whitespace-pre-line"
                    style={{
                      color: item.expectedDTPText ? UI_COLORS.text.body : UI_COLORS.text.muted,
                    }}
                  >
                    {item.expectedDTPText || '—'}
                  </p>
                </div>
                <div>
                  <span
                    className="block text-xs font-semibold mb-1"
                    style={{ color: UI_COLORS.text.muted }}
                  >
                    Clinical Intent
                  </span>
                  <p
                    className="text-sm whitespace-pre-line"
                    style={{
                      color: item.clinicalIntent ? UI_COLORS.text.body : UI_COLORS.text.muted,
                    }}
                  >
                    {item.clinicalIntent || '—'}
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
                      color: item.evaluationCriteria ? UI_COLORS.text.body : UI_COLORS.text.muted,
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
                    <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>
                      —
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <InstructorBankShell
      bankKey="dtp"
      copy={DTP_BANK_CONFIG.copy}
      tab={tab}
      setTab={handleTabChange}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      activeItems={activeItems}
      filteredCount={filteredCount}
      totalPages={totalPages}
      currentPage={currentPage}
      itemsPerPage={itemsPerPage}
      setPage={setPage}
      setItemsPerPage={setItemsPerPage}
      organizationIds={organizationIds}
      activeOrganizationId={activeOrganizationId}
      setActiveOrganizationId={setActiveOrganizationId}
      canCreate={canCreate}
      loading={loading}
      error={error}
      reload={reload}
      onCreate={() => setIsAddDialogOpen(true)}
      renderRow={renderRow}
    >
      <AddDTPDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        organizationId={activeOrganizationId ?? undefined}
        existingTags={allExistingTags}
        isPatientSpecific={tab === 'patientSpecific'}
        onSave={handleCreate}
      />
    </InstructorBankShell>
  );
}

export default InstructorDTPBankPage;
