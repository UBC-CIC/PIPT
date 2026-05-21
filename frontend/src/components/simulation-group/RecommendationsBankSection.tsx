import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import type { UseRecommendationsBankReturn } from '@/hooks/useRecommendationsBank';
import type { RecommendationItem } from '@/services/recommendationsBankService';

export interface RecommendationsBankSectionProps {
  recommendationsBank: UseRecommendationsBankReturn;
  role: 'admin' | 'instructor';
  groupId: string;
  patients: Array<{ id?: string; patient_id?: string; name?: string; patient_name?: string }>;
  /** Instructor flow: called when user clicks "Confirm Selections" */
  onConfirmSelections?: () => void;
  /** Admin flow: called when a checkbox is toggled immediately */
  onToggleRecommendationInclusion?: (itemId: string, item: RecommendationItem, isChecked: boolean) => void;
  /** Called when the group-wide tab is clicked — lets the page reload included IDs */
  onGroupWideTabClick?: () => void;
  /** Called when the patient-specific tab is clicked */
  onPatientSpecificTabClick?: () => void;
  /** Called when the patient selector changes in the patient-specific tab */
  onPatientSelect?: (patientId: string | null) => void;
}

/**
 * RecommendationsBankSection component
 *
 * Renders the Recommendations bank UI with group-wide and patient-specific tabs,
 * search/filter inputs, paginated item lists with checkboxes,
 * and add-item buttons. Supports both admin and instructor roles.
 */
export function RecommendationsBankSection({
  recommendationsBank,
  role,
  groupId: _groupId,
  patients,
  onConfirmSelections,
  onToggleRecommendationInclusion,
  onGroupWideTabClick,
  onPatientSpecificTabClick,
  onPatientSelect,
}: RecommendationsBankSectionProps) {
  const {
    filteredItems,
    includedIds,
    pendingIds,
    searchQuery, setSearchQuery,
    pagination,
    handlePageChange,
    handleItemsPerPageChange,
    getPaginatedItems,
    getTotalPages,
    handleTogglePendingItem,
    hasPendingChanges, pendingAddCount, pendingRemoveCount,
    handleResetSelections,
    setIsAddDialogOpen,
    selectedPatientId, setSelectedPatientId,
  } = recommendationsBank;

  // Tab state (group-wide vs patient-specific)
  const [activeTab, setActiveTab] = useState<'groupWide' | 'patientSpecific'>('groupWide');

  const paginatedItems = getPaginatedItems(filteredItems, pagination.currentPage, pagination.itemsPerPage);
  const totalPages = getTotalPages(filteredItems.length, pagination.itemsPerPage);

  const handleGroupWideTabSwitch = () => {
    setActiveTab('groupWide');
    setSelectedPatientId(null);
    onGroupWideTabClick?.();
  };

  const handlePatientSpecificTabSwitch = () => {
    setActiveTab('patientSpecific');
    onPatientSpecificTabClick?.();
  };

  const handlePatientSelectorChange = (patientId: string | null) => {
    setSelectedPatientId(patientId);
    onPatientSelect?.(patientId);
  };

  const getPatientId = (patient: { id?: string; patient_id?: string }) => patient.id || patient.patient_id || '';
  const getPatientName = (patient: { name?: string; patient_name?: string }) => patient.name || patient.patient_name || '';

  return (
    <div className="h-full flex flex-col">
      {/* Header with tabs */}
      <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: UI_COLORS.border.default }}>
        <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>
          Recommendations Bank
        </h2>

        {/* Tab Switcher */}
        <div className="flex gap-2 border-b" style={{ borderColor: UI_COLORS.border.default }}>
          <button
            onClick={handleGroupWideTabSwitch}
            className="px-6 py-3 font-medium transition-colors border-b-2"
            style={{
              color: activeTab === 'groupWide' ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body,
              borderColor: activeTab === 'groupWide' ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            Group-wide
          </button>
          <button
            onClick={handlePatientSpecificTabSwitch}
            className="px-6 py-3 font-medium transition-colors border-b-2"
            style={{
              color: activeTab === 'patientSpecific' ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body,
              borderColor: activeTab === 'patientSpecific' ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            Patient-Specific
          </button>
        </div>
      </div>

      {/* Item List */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="space-y-3">
          {/* ===== GROUP-WIDE TAB ===== */}
          {activeTab === 'groupWide' && (
            <>
              <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                {role === 'admin'
                  ? "Select which recommendation items should be included for all patients in this simulation group."
                  : "Select which recommendation items should be included for all patients in this simulation group. These apply to every patient encounter."}
              </p>

              {/* Admin: Add New Recommendation button */}
              {role === 'admin' && (
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="w-full justify-start gap-2 py-3 h-auto font-medium transition-colors mb-4"
                  style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                >
                  <Plus className="w-5 h-5" />
                  Add New Recommendation Item
                </Button>
              )}

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                <Input
                  type="text"
                  placeholder="Search recommendation items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  style={{ borderColor: UI_COLORS.border.default }}
                />
              </div>

              {/* Pagination Info */}
              {filteredItems.length > 0 && (
                <div className="flex items-center justify-between mb-3 text-sm" style={{ color: UI_COLORS.text.muted }}>
                  <span>
                    Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1}&ndash;
                    {Math.min(pagination.currentPage * pagination.itemsPerPage, filteredItems.length)} of {filteredItems.length} items
                  </span>
                </div>
              )}

              {/* Instructor: Accordion-style item list */}
              {role === 'instructor' && (
                <>
                  <Accordion type="single" collapsible className="space-y-2">
                    {paginatedItems.map((item) => (
                      <RecommendationAccordionItem
                        key={item.id}
                        item={item}
                        isChecked={pendingIds.has(item.id)}
                        onToggle={() => handleTogglePendingItem(item.id)}
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
                  {totalPages > 1 && (
                    <PaginationControls
                      currentPage={pagination.currentPage}
                      totalPages={totalPages}
                      itemsPerPage={pagination.itemsPerPage}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                    />
                  )}
                </>
              )}

              {/* Admin: flat card-style item list */}
              {role === 'admin' && (
                <>
                  {filteredItems.length === 0 ? (
                    <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>
                      {searchQuery ? 'No recommendation items match your search.' : 'No recommendation items yet.'}
                    </p>
                  ) : paginatedItems.map((item) => (
                    <RecommendationCardItem
                      key={item.id}
                      item={item}
                      isChecked={includedIds.has(item.id)}
                      onToggle={(checked) => onToggleRecommendationInclusion?.(item.id, item, checked)}
                    />
                  ))}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <PaginationControls
                      currentPage={pagination.currentPage}
                      totalPages={totalPages}
                      itemsPerPage={pagination.itemsPerPage}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                    />
                  )}
                </>
              )}
            </>
          )}

          {/* ===== PATIENT-SPECIFIC TAB ===== */}
          {activeTab === 'patientSpecific' && (
            <>
              <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                {role === 'admin'
                  ? "Select a patient to manage their patient-specific recommendation items."
                  : "Select a patient to manage their patient-specific recommendation items. These apply only to the selected patient encounter."}
              </p>

              {/* Patient Selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
                  Select Patient
                </label>
                <select
                  value={selectedPatientId || ''}
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

              {/* Admin: Add New Recommendation button */}
              {role === 'admin' && (
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="w-full justify-start gap-2 py-3 h-auto font-medium transition-colors mb-4"
                  style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                >
                  <Plus className="w-5 h-5" />
                  Add New Recommendation Item
                </Button>
              )}

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                <Input
                  type="text"
                  placeholder="Search recommendation items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  style={{ borderColor: UI_COLORS.border.default }}
                />
              </div>

              {selectedPatientId ? (
                <>
                  {/* Pagination Info */}
                  {filteredItems.length > 0 && (
                    <div className="flex items-center justify-between mb-3 text-sm" style={{ color: UI_COLORS.text.muted }}>
                      <span>
                        Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1}&ndash;
                        {Math.min(pagination.currentPage * pagination.itemsPerPage, filteredItems.length)} of {filteredItems.length} items
                      </span>
                    </div>
                  )}

                  {/* Instructor: Accordion-style item list */}
                  {role === 'instructor' && (
                    <>
                      <Accordion type="single" collapsible className="space-y-2">
                        {paginatedItems.map((item) => (
                          <RecommendationAccordionItem
                            key={item.id}
                            item={item}
                            isChecked={pendingIds.has(item.id)}
                            onToggle={() => handleTogglePendingItem(item.id)}
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
                      {totalPages > 1 && (
                        <PaginationControls
                          currentPage={pagination.currentPage}
                          totalPages={totalPages}
                          itemsPerPage={pagination.itemsPerPage}
                          onPageChange={handlePageChange}
                          onItemsPerPageChange={handleItemsPerPageChange}
                        />
                      )}
                    </>
                  )}

                  {/* Admin: flat card-style item list */}
                  {role === 'admin' && (
                    <>
                      {filteredItems.length === 0 ? (
                        <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>
                          {searchQuery ? 'No recommendation items match your search.' : 'No recommendation items yet.'}
                        </p>
                      ) : paginatedItems.map((item) => (
                        <RecommendationCardItem
                          key={item.id}
                          item={item}
                          isChecked={includedIds.has(item.id)}
                          onToggle={(checked) => onToggleRecommendationInclusion?.(item.id, item, checked)}
                        />
                      ))}

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <PaginationControls
                          currentPage={pagination.currentPage}
                          totalPages={totalPages}
                          itemsPerPage={pagination.itemsPerPage}
                          onPageChange={handlePageChange}
                          onItemsPerPageChange={handleItemsPerPageChange}
                        />
                      )}
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>
                  Please select a patient to manage their recommendation items.
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
 * Accordion-style Recommendation item used in the instructor flow.
 */
function RecommendationAccordionItem({
  item,
  isChecked,
  onToggle,
}: {
  item: RecommendationItem;
  isChecked: boolean;
  onToggle: () => void;
}) {
  return (
    <AccordionItem
      value={item.id}
      style={{
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: UI_COLORS.border.default,
        borderRadius: '0.5rem',
        overflow: 'hidden',
      }}
    >
      <AccordionTrigger
        className="px-4 hover:no-underline"
        style={{
          backgroundColor: UI_COLORS.background.white,
          color: UI_COLORS.text.heading,
        }}
      >
        <div className="flex items-center justify-between w-full pr-4">
          <span className="font-medium text-sm">{item.title}</span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={onToggle}
                className="w-5 h-5 rounded cursor-pointer"
                style={{ accentColor: SIMULATION_GROUP_COLOR_PALETTE[2] }}
              />
              <span className="text-sm" style={{ color: UI_COLORS.text.body }}>Include</span>
            </label>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4" style={{ backgroundColor: UI_COLORS.background.white }}>
        <div className="space-y-3 pt-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Title</label>
            <p className="text-sm" style={{ color: UI_COLORS.text.body }}>{item.title || '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Recommendation Text</label>
            <p className="text-sm whitespace-pre-line" style={{ color: item.recommendationText ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{item.recommendationText || '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Evaluation Criteria</label>
            <p className="text-sm whitespace-pre-line" style={{ color: item.evaluationCriteria ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{item.evaluationCriteria || '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Rationale</label>
            <p className="text-sm whitespace-pre-line" style={{ color: item.rationale ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{item.rationale || '—'}</p>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * Card-style Recommendation item used in the admin flow.
 */
function RecommendationCardItem({
  item,
  isChecked,
  onToggle,
}: {
  item: RecommendationItem;
  isChecked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border transition-colors" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
      <div className="flex-1 min-w-0 mr-3">
        <span className="text-sm font-medium block" style={{ color: UI_COLORS.text.heading }}>{item.title}</span>
        <span className="text-xs block mt-0.5" style={{ color: UI_COLORS.text.muted }}>
          {item.recommendationText.length > 120 ? item.recommendationText.slice(0, 120) + '...' : item.recommendationText}
        </span>
      </div>
      <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-5 h-5 rounded cursor-pointer"
          style={{ accentColor: SIMULATION_GROUP_COLOR_PALETTE[2] }}
        />
        <span className="text-sm" style={{ color: UI_COLORS.text.body }}>Include</span>
      </label>
    </div>
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
 * Pagination controls.
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

export default RecommendationsBankSection;
