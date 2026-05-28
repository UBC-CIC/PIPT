import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import type { UseQuestionBankReturn } from '@/hooks/useQuestionBank';
import type { QuestionBankItem } from '@/services/instructorService';

export interface QuestionBankSectionProps {
  questionBank: UseQuestionBankReturn;
  role: 'admin' | 'instructor';
  groupId: string;
  patients: Array<{ id?: string; patient_id?: string; name?: string; patient_name?: string }>;
  /** Instructor flow: called when user clicks "Confirm Selections" */
  onConfirmSelections?: () => void;
  /** Admin flow: called when a checkbox is toggled immediately */
  onToggleQuestionInclusion?: (questionId: string, question: QuestionBankItem, isChecked: boolean) => void;
  /** Called when the global tab is clicked — lets the page reload included IDs */
  onGlobalTabClick?: () => void;
  /** Called when the patient-specific tab is clicked */
  onPatientSpecificTabClick?: () => void;
  /** Called when the patient selector changes in the patient-specific tab */
  onPatientSelect?: (patientId: string | null) => void;
}

/**
 * QuestionBankSection component
 *
 * Renders the question bank UI with global and patient-specific tabs,
 * search/filter inputs, paginated question lists with checkboxes,
 * and add-question buttons. Supports both admin and instructor roles.
 */
export function QuestionBankSection({
  questionBank,
  role,
  groupId: _groupId,
  patients,
  onConfirmSelections,
  onToggleQuestionInclusion,
  onGlobalTabClick,
  onPatientSpecificTabClick,
  onPatientSelect,
}: QuestionBankSectionProps) {
  const {
    questionBankTab, setQuestionBankTab,
    filteredGlobalQuestions, filteredPatientQuestions,
    includedQuestionIds,
    pendingQuestionIds,
    allExistingTags,
    // Instructor per-tab search
    globalQuestionSearchQuery, setGlobalQuestionSearchQuery,
    patientQuestionSearchQuery, setPatientQuestionSearchQuery,
    // Admin unified search + tag filter
    questionBankSearchQuery, setQuestionBankSearchQuery,
    questionBankTagFilter, setQuestionBankTagFilter,
    // Pagination
    globalPagination, patientPagination,
    handleGlobalPageChange, handlePatientPageChange,
    handleGlobalItemsPerPageChange, handlePatientItemsPerPageChange,
    getPaginatedQuestions, getTotalPages,
    // Pending changes (instructor)
    handleTogglePendingQuestion,
    hasPendingChanges, pendingAddCount, pendingRemoveCount,
    handleResetSelections,
    // Patient selection
    selectedPatientForQuestionBank, setSelectedPatientForQuestionBank,
    setPatientPagination,
  } = questionBank;

  // Derived pagination values (instructor only)
  const paginatedGlobalQuestions = getPaginatedQuestions(
    filteredGlobalQuestions,
    globalPagination.currentPage,
    globalPagination.itemsPerPage,
  );
  const paginatedPatientQuestions = getPaginatedQuestions(
    filteredPatientQuestions,
    patientPagination.currentPage,
    patientPagination.itemsPerPage,
  );
  const globalTotalPages = getTotalPages(filteredGlobalQuestions.length, globalPagination.itemsPerPage);
  const patientTotalPages = getTotalPages(filteredPatientQuestions.length, patientPagination.itemsPerPage);

  const handleGlobalTabSwitch = () => {
    setQuestionBankTab('global');
    if (role === 'admin') {
      setQuestionBankSearchQuery('');
      setQuestionBankTagFilter('');
    }
    onGlobalTabClick?.();
  };

  const handlePatientSpecificTabSwitch = () => {
    setQuestionBankTab('patientSpecific');
    if (role === 'admin') {
      setQuestionBankSearchQuery('');
      setQuestionBankTagFilter('');
    }
    onPatientSpecificTabClick?.();
  };

  const handlePatientSelectorChange = (patientId: string | null) => {
    setSelectedPatientForQuestionBank(patientId);
    if (role === 'instructor') {
      setPatientPagination({ currentPage: 1, itemsPerPage: patientPagination.itemsPerPage });
    }
    onPatientSelect?.(patientId);
  };

  const getPatientId = (patient: { id?: string; patient_id?: string }) => patient.id || patient.patient_id || '';
  const getPatientName = (patient: { name?: string; patient_name?: string }) => patient.name || patient.patient_name || '';

  return (
    <div className="h-full flex flex-col">
      {/* Header with tabs */}
      <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: UI_COLORS.border.default }}>
        <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>
          Question Bank
        </h2>

        {/* Tab Switcher */}
        <div className="flex gap-2 border-b" style={{ borderColor: UI_COLORS.border.default }}>
          <button
            onClick={handleGlobalTabSwitch}
            className="px-6 py-3 font-medium transition-colors border-b-2"
            style={{
              color: questionBankTab === 'global' ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body,
              borderColor: questionBankTab === 'global' ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer'
            }}
          >
            Global Questions
          </button>
          <button
            onClick={handlePatientSpecificTabSwitch}
            className="px-6 py-3 font-medium transition-colors border-b-2"
            style={{
              color: questionBankTab === 'patientSpecific' ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body,
              borderColor: questionBankTab === 'patientSpecific' ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer'
            }}
          >
            Patient-Specific Questions
          </button>
        </div>
      </div>

      {/* Question List */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="space-y-3">
          {/* Admin: unified search + tag filter (shown above both tabs) */}
          {role === 'admin' && (
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                <Input
                  placeholder="Search questions..."
                  value={questionBankSearchQuery}
                  onChange={(e) => setQuestionBankSearchQuery(e.target.value)}
                  className="pl-9 py-2 text-sm"
                  style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                />
              </div>
              <select
                value={questionBankTagFilter}
                onChange={(e) => setQuestionBankTagFilter(e.target.value)}
                className="px-3 py-2 rounded-md border text-sm"
                style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white, color: UI_COLORS.text.heading, minWidth: '10rem' }}
              >
                <option value="">All Tags</option>
                {allExistingTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          )}

          {/* ===== GLOBAL TAB ===== */}
          {questionBankTab === 'global' && (
            <>
              <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                {role === 'admin'
                  ? "Select which global questions should be included in this simulation group's rubric."
                  : "Select which global questions should be included in this simulation group\u2019s rubric. These are questions that are saved in the question bank and are visible to be included for all patients in this simulation group."}
              </p>

              {/* Instructor: per-tab search */}
              {role === 'instructor' && (
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                  <Input
                    type="text"
                    placeholder="Search global questions..."
                    value={globalQuestionSearchQuery}
                    onChange={(e) => setGlobalQuestionSearchQuery(e.target.value)}
                    className="pl-10"
                    style={{ borderColor: UI_COLORS.border.default }}
                  />
                </div>
              )}

              {/* Instructor: Pagination Info */}
              {role === 'instructor' && filteredGlobalQuestions.length > 0 && (
                <div className="flex items-center justify-between mb-3 text-sm" style={{ color: UI_COLORS.text.muted }}>
                  <span>
                    Showing {((globalPagination.currentPage - 1) * globalPagination.itemsPerPage) + 1}&ndash;
                    {Math.min(globalPagination.currentPage * globalPagination.itemsPerPage, filteredGlobalQuestions.length)} of {filteredGlobalQuestions.length} questions
                  </span>
                </div>
              )}

              {/* Instructor: Accordion-style question list */}
              {role === 'instructor' && (
                <>
                  <Accordion type="single" collapsible className="space-y-2">
                    {paginatedGlobalQuestions.map((question) => (
                      <QuestionAccordionItem
                        key={question.id}
                        question={question}
                        isChecked={pendingQuestionIds.has(question.id)}
                        onToggle={() => handleTogglePendingQuestion(question.id)}
                      />
                    ))}
                  </Accordion>

                  {/* Confirm / Reset Buttons */}
                  <ConfirmResetBar
                    hasPendingChanges={hasPendingChanges}
                    pendingAddCount={pendingAddCount}
                    pendingRemoveCount={pendingRemoveCount}
                    onConfirm={onConfirmSelections}
                    onReset={handleResetSelections}
                  />

                  {/* Pagination Controls */}
                  {globalTotalPages > 1 && (
                    <PaginationControls
                      currentPage={globalPagination.currentPage}
                      totalPages={globalTotalPages}
                      itemsPerPage={globalPagination.itemsPerPage}
                      onPageChange={handleGlobalPageChange}
                      onItemsPerPageChange={handleGlobalItemsPerPageChange}
                    />
                  )}
                </>
              )}

              {/* Admin: accordion-style question list */}
              {role === 'admin' && (
                <>
                  {filteredGlobalQuestions.length === 0 ? (
                    <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>
                      {questionBankSearchQuery || questionBankTagFilter ? 'No questions match your filters.' : 'No global questions yet.'}
                    </p>
                  ) : (
                    <Accordion type="single" collapsible className="space-y-2">
                      {filteredGlobalQuestions.map((question) => (
                        <QuestionAccordionItem
                          key={question.id}
                          question={question}
                          isChecked={includedQuestionIds.has(question.id)}
                          onToggle={() => onToggleQuestionInclusion?.(question.id, question, !includedQuestionIds.has(question.id))}
                        />
                      ))}
                    </Accordion>
                  )}
                </>
              )}
            </>
          )}

          {/* ===== PATIENT-SPECIFIC TAB ===== */}
          {questionBankTab === 'patientSpecific' && (
            <>
              <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                {role === 'admin'
                  ? "Select a patient to manage their patient-specific questions."
                  : "Select a patient to manage their patient-specific questions. A patient-specific question is asked in the context of one particular patient and will depend on the patient\u2019s unique details."}
              </p>

              {/* Patient Selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
                  Select Patient
                </label>
                <select
                  value={selectedPatientForQuestionBank || ''}
                  onChange={(e) => handlePatientSelectorChange(e.target.value || null)}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{
                    borderColor: UI_COLORS.border.default,
                    backgroundColor: UI_COLORS.background.white,
                    color: UI_COLORS.text.heading,
                  }}
                >
                  <option value="">-- Select a patient --</option>
                  {patients.map((patient) => (
                    <option key={getPatientId(patient)} value={getPatientId(patient)}>
                      {getPatientName(patient)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Instructor: per-tab search */}
              {role === 'instructor' && (
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                  <Input
                    type="text"
                    placeholder="Search patient-specific questions..."
                    value={patientQuestionSearchQuery}
                    onChange={(e) => setPatientQuestionSearchQuery(e.target.value)}
                    className="pl-10"
                    style={{ borderColor: UI_COLORS.border.default }}
                  />
                </div>
              )}

              {selectedPatientForQuestionBank ? (
                <>
                  {/* Instructor: Pagination Info */}
                  {role === 'instructor' && filteredPatientQuestions.length > 0 && (
                    <div className="flex items-center justify-between mb-3 text-sm" style={{ color: UI_COLORS.text.muted }}>
                      <span>
                        Showing {((patientPagination.currentPage - 1) * patientPagination.itemsPerPage) + 1}&ndash;
                        {Math.min(patientPagination.currentPage * patientPagination.itemsPerPage, filteredPatientQuestions.length)} of {filteredPatientQuestions.length} questions
                      </span>
                    </div>
                  )}

                  {/* Instructor: Accordion-style question list */}
                  {role === 'instructor' && (
                    <>
                      <Accordion type="single" collapsible className="space-y-2">
                        {paginatedPatientQuestions.map((question) => (
                          <QuestionAccordionItem
                            key={question.id}
                            question={question}
                            isChecked={pendingQuestionIds.has(question.id)}
                            onToggle={() => handleTogglePendingQuestion(question.id)}
                          />
                        ))}
                      </Accordion>

                      {/* Confirm / Reset Buttons */}
                      <ConfirmResetBar
                        hasPendingChanges={hasPendingChanges}
                        pendingAddCount={pendingAddCount}
                        pendingRemoveCount={pendingRemoveCount}
                        onConfirm={onConfirmSelections}
                        onReset={handleResetSelections}
                      />

                      {/* Pagination Controls */}
                      {patientTotalPages > 1 && (
                        <PaginationControls
                          currentPage={patientPagination.currentPage}
                          totalPages={patientTotalPages}
                          itemsPerPage={patientPagination.itemsPerPage}
                          onPageChange={handlePatientPageChange}
                          onItemsPerPageChange={handlePatientItemsPerPageChange}
                        />
                      )}
                    </>
                  )}

                  {/* Admin: accordion-style question list */}
                  {role === 'admin' && (
                    <>
                      {filteredPatientQuestions.length === 0 ? (
                        <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>
                          {questionBankSearchQuery || questionBankTagFilter ? 'No questions match your filters.' : 'No patient-specific questions yet.'}
                        </p>
                      ) : (
                        <Accordion type="single" collapsible className="space-y-2">
                          {filteredPatientQuestions.map((question) => (
                            <QuestionAccordionItem
                              key={question.id}
                              question={question}
                              isChecked={includedQuestionIds.has(question.id)}
                              onToggle={() => onToggleQuestionInclusion?.(question.id, question, !includedQuestionIds.has(question.id))}
                            />
                          ))}
                        </Accordion>
                      )}
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>
                  Please select a patient to manage their questions.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


/* ─── Sub-components ─── */

/**
 * Accordion-style question item used in the instructor flow.
 * Shows expandable details with title, key question, clinical intent, evaluation criteria, and requirement.
 */
function QuestionAccordionItem({
  question,
  isChecked,
  onToggle,
}: {
  question: QuestionBankItem;
  isChecked: boolean;
  onToggle: () => void;
}) {
  return (
    <AccordionItem
      value={question.id}
      style={{
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: UI_COLORS.border.default,
        borderRadius: '0.5rem',
        overflow: 'hidden'
      }}
    >
      <AccordionTrigger
        className="px-4 hover:no-underline"
        style={{
          backgroundColor: UI_COLORS.background.white,
          color: UI_COLORS.text.heading
        }}
      >
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="font-medium text-sm">
              {question.title}
            </span>
            {(question.tags || []).filter(t => t !== 'patient_specific').length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(question.tags || []).filter(t => t !== 'patient_specific').map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>
              {question.isMandatory ? 'Required' : 'Optional'}
            </span>
            <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={onToggle}
                className="w-5 h-5 rounded cursor-pointer"
                style={{ accentColor: SIMULATION_GROUP_COLOR_PALETTE[2] }}
              />
              <span className="text-sm" style={{ color: UI_COLORS.text.body }}>
                Include
              </span>
            </label>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent
        className="px-4 pb-4"
        style={{ backgroundColor: UI_COLORS.background.white }}
      >
        <div className="space-y-3 pt-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Title</label>
            <p className="text-sm" style={{ color: UI_COLORS.text.body }}>{question.title || '\u2014'}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Key Question</label>
            <p className="text-sm" style={{ color: question.questionText ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.questionText || '\u2014'}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Clinical Intent</label>
            <p className="text-sm" style={{ color: question.clinicalIntent ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.clinicalIntent || '\u2014'}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Evaluation Criteria</label>
            <p className="text-sm whitespace-pre-line" style={{ color: question.evaluationCriteria ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.evaluationCriteria || '\u2014'}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Requirement</label>
            <span
              className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: question.isMandatory ? '#dcfce7' : '#f3f4f6',
                color: question.isMandatory ? '#166534' : '#6b7280'
              }}
            >
              {question.isMandatory ? 'Required' : 'Optional'}
            </span>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * Confirm/Reset bar for the instructor pending-changes flow.
 */
function ConfirmResetBar({
  hasPendingChanges,
  pendingAddCount,
  pendingRemoveCount,
  onConfirm,
  onReset,
}: {
  hasPendingChanges: boolean;
  pendingAddCount: number;
  pendingRemoveCount: number;
  onConfirm?: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: UI_COLORS.border.default }}>
      <div className="flex items-center gap-3">
        <Button
          onClick={onConfirm}
          disabled={!hasPendingChanges}
          className="px-6 py-2 font-medium transition-colors"
          style={{
            backgroundColor: hasPendingChanges ? UI_COLORS.button.primary : UI_COLORS.background.tableHeader,
            color: hasPendingChanges ? UI_COLORS.button.text : UI_COLORS.text.muted,
            cursor: hasPendingChanges ? 'pointer' : 'not-allowed',
          }}
          onMouseEnter={(e) => hasPendingChanges && (e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover)}
          onMouseLeave={(e) => hasPendingChanges && (e.currentTarget.style.backgroundColor = UI_COLORS.button.primary)}
        >
          Confirm Selections
        </Button>
        {hasPendingChanges && (
          <button
            onClick={onReset}
            className="text-sm font-medium transition-colors bg-transparent border-0 cursor-pointer p-0"
            style={{ color: UI_COLORS.text.muted }}
            onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
            onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.muted}
          >
            Reset
          </button>
        )}
      </div>
      {hasPendingChanges && (
        <span className="text-xs" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[2] }}>
          {pendingAddCount > 0 && `+${pendingAddCount} to add`}
          {pendingAddCount > 0 && pendingRemoveCount > 0 && ', '}
          {pendingRemoveCount > 0 && `${pendingRemoveCount} to remove`}
        </span>
      )}
    </div>
  );
}

/**
 * Pagination controls for the instructor flow.
 */
function PaginationControls({
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}: {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
}) {
  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: UI_COLORS.border.default }}>
      <div className="flex items-center gap-2">
        <span className="text-sm" style={{ color: UI_COLORS.text.body }}>Items per page:</span>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
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
          onClick={() => onPageChange(currentPage - 1)}
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
          onClick={() => onPageChange(currentPage + 1)}
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
  );
}
