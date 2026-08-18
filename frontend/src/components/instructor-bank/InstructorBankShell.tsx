import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import LoadingIndicator from '@/components/LoadingIndicator';
import { useNotification } from '@/components/notifications';
import { SIMULATION_GROUP_COLOR_PALETTE, UI_COLORS } from '@/lib/colors';
import type { BankCopy } from '@/lib/instructorBankConfig';
import type { BankTab } from '@/lib/instructorBankUtils';
import { useAuth } from '@/App';

/** The page-size options both instructor bank pages offer. */
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

/** The minimum shape the shell needs from a bank read model. */
type ShellItem = { id: string; title: string };

export interface InstructorBankShellProps<T extends ShellItem> {
  /** Distinguishes this bank's DOM ids from the other bank's. */
  bankKey: 'dtp' | 'recommendation';
  /** All page copy, supplied by the bank descriptor. */
  copy: BankCopy;

  // Header
  userName?: string;
  userAvatarUrl?: string;

  // Tabs & search
  tab: BankTab;
  setTab: (t: BankTab) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Active tab list & pagination
  activeItems: T[];
  filteredCount: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
  setPage: (p: number) => void;
  setItemsPerPage: (n: number) => void;

  // Organization
  organizationIds: string[];
  activeOrganizationId: string | null;
  setActiveOrganizationId: (id: string) => void;
  canCreate: boolean;

  // Lifecycle
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;

  /** Opens the bank's create dialog. */
  onCreate: () => void;
  /**
   * Renders one row. Per-bank row bodies differ, so the shell owns the list
   * container and the page owns the row. Every control a row renders is
   * expected to carry an `aria-label` naming its item.
   */
  renderRow: (item: T) => ReactNode;
  /** Mount point for the bank's create dialog. */
  children?: ReactNode;
}

/**
 * InstructorBankShell
 *
 * The chrome both instructor bank pages share: header, back control, heading,
 * organization region, tab switcher, search, create control, pagination, empty
 * states, and the row container. Presentational only — it fetches nothing and
 * calls no service. Every value it renders arrives as a prop, and rows come
 * from `renderRow`, because the DTP and recommendation row bodies differ.
 *
 * There is deliberately no delete affordance of any kind: removal stays an
 * administrator capability for every bank.
 */
function InstructorBankShell<T extends ShellItem>({
  bankKey,
  copy,
  userName = 'Instructor',
  userAvatarUrl,
  tab,
  setTab,
  searchQuery,
  setSearchQuery,
  activeItems,
  filteredCount,
  totalPages,
  currentPage,
  itemsPerPage,
  setPage,
  setItemsPerPage,
  organizationIds,
  activeOrganizationId,
  setActiveOrganizationId,
  canCreate,
  loading,
  error,
  reload,
  onCreate,
  renderRow,
  children,
}: InstructorBankShellProps<T>) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { showNotification } = useNotification();

  const isPatientSpecificTab = tab === 'patientSpecific';
  const tabCopy = copy.copyByTab[tab];
  const activeTabColor = SIMULATION_GROUP_COLOR_PALETTE[2];

  const rangeStart = filteredCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const rangeEnd = Math.min(currentPage * itemsPerPage, filteredCount);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      showNotification({ message: 'Sign out failed. Please try again.', type: 'error' });
    }
  };

  return (
    <PageContainer>
      <DashboardHeader
        title="Instructor Dashboard"
        subtitle={copy.subtitle}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        onSignOut={handleSignOut}
        onStudentView={() => navigate('/student')}
        showStudentViewButton={false}
      />

      {loading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <LoadingIndicator size="md" message={copy.loadingMessage} />
        </div>
      )}

      {error && (
        <div
          className="mx-8 mt-4 p-4 rounded-md border"
          style={{
            backgroundColor: UI_COLORS.changelog.notWorkingBg,
            borderColor: UI_COLORS.status.error,
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm" style={{ color: UI_COLORS.text.error }}>
              {error}
            </p>
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
            <div
              className="px-8 pt-8 pb-6 border-b"
              style={{ borderColor: UI_COLORS.border.default }}
            >
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
                {copy.heading}
              </h2>

              {/* Organization region: guidance at zero ids, a selector at two or more */}
              {organizationIds.length === 0 && (
                <div
                  className="mb-6 p-4 rounded-md border"
                  style={{
                    backgroundColor: UI_COLORS.background.subtle,
                    borderColor: UI_COLORS.border.default,
                  }}
                >
                  <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                    {copy.noOrganizationMessage}
                  </p>
                </div>
              )}

              {organizationIds.length >= 2 && (
                <div className="mb-6 flex items-center gap-3">
                  <label
                    htmlFor={`instructor-${bankKey}-organization-select`}
                    className="text-sm font-medium"
                    style={{ color: UI_COLORS.text.body }}
                  >
                    Organization:
                  </label>
                  <select
                    id={`instructor-${bankKey}-organization-select`}
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
                  onClick={() => setTab('global')}
                  className="px-6 py-3 font-medium transition-colors border-b-2"
                  style={{
                    color: tab === 'global' ? activeTabColor : UI_COLORS.text.body,
                    borderColor: tab === 'global' ? activeTabColor : UI_COLORS.border.transparent,
                    backgroundColor: UI_COLORS.background.transparent,
                    cursor: 'pointer',
                  }}
                >
                  {copy.copyByTab.global.label}
                </button>
                <button
                  onClick={() => setTab('patientSpecific')}
                  className="px-6 py-3 font-medium transition-colors border-b-2"
                  style={{
                    color: isPatientSpecificTab ? activeTabColor : UI_COLORS.text.body,
                    borderColor: isPatientSpecificTab
                      ? activeTabColor
                      : UI_COLORS.border.transparent,
                    backgroundColor: UI_COLORS.background.transparent,
                    cursor: 'pointer',
                  }}
                >
                  {copy.copyByTab.patientSpecific.label}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="space-y-3">
                <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                  {tabCopy.description}
                </p>

                {/* Search */}
                <div className="relative mb-4">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: UI_COLORS.text.muted }}
                  />
                  <Input
                    type="text"
                    placeholder={tabCopy.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    style={{ borderColor: UI_COLORS.border.default }}
                    aria-label={tabCopy.searchAriaLabel}
                  />
                </div>

                {/* Create control — disabled while no organization is resolved */}
                <Button
                  onClick={onCreate}
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
                  {tabCopy.createButtonLabel}
                </Button>

                {/* Pagination info */}
                {filteredCount > 0 && (
                  <div
                    className="flex items-center justify-between mb-3 text-sm"
                    style={{ color: UI_COLORS.text.muted }}
                  >
                    <span>
                      Showing {rangeStart}-{rangeEnd} of {filteredCount} {copy.itemNounPlural}
                    </span>
                  </div>
                )}

                {/* Rows */}
                <div className="space-y-2">
                  {activeItems.map((item) => (
                    <div key={item.id}>{renderRow(item)}</div>
                  ))}
                </div>

                {/* Empty states: no search match versus a genuinely empty tab */}
                {filteredCount === 0 && !error && (
                  <div className="text-center py-8">
                    <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>
                      {searchQuery ? copy.noSearchResultsMessage : tabCopy.emptyMessage}
                    </p>
                  </div>
                )}

                {/* Pagination controls */}
                {filteredCount > 0 && (
                  <div
                    className="flex items-center justify-between mt-4 pt-4 border-t"
                    style={{ borderColor: UI_COLORS.border.default }}
                  >
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={`instructor-${bankKey}-page-size`}
                        className="text-sm"
                        style={{ color: UI_COLORS.text.body }}
                      >
                        Items per page:
                      </label>
                      <select
                        id={`instructor-${bankKey}-page-size`}
                        value={itemsPerPage}
                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                        className="px-3 py-1 rounded border text-sm"
                        style={{
                          borderColor: UI_COLORS.border.default,
                          backgroundColor: UI_COLORS.background.white,
                          color: UI_COLORS.text.heading,
                        }}
                      >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
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

      {children}
    </PageContainer>
  );
}

export default InstructorBankShell;
