import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { instructorService } from '@/services/instructorService';
import { filterByTitle, paginate } from '@/lib/bankUtils';
import {
  PATIENT_SPECIFIC_TAG,
  normalizeInstructorTags,
  partitionByPatientSpecific,
  replaceItem,
  resolveActiveOrganization,
  resolveOrganizationIds,
  validateRequiredTextFields,
  type BankTab,
} from '@/lib/instructorBankUtils';
import type { InstructorBankConfig } from '@/lib/instructorBankConfig';

/** Default number of bank items shown per page. */
const DEFAULT_ITEMS_PER_PAGE = 5;

/** The minimum shape the hook needs from a bank read model. */
type BankItem = { id: string; title: string; tags?: string[] };

export interface UseInstructorItemBankReturn<T, F> {
  // data
  items: T[];
  /** Active tab list after search filtering and pagination. */
  activeItems: T[];
  /** Number of items in the active tab that match the current search. */
  filteredCount: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
  /** Distinct user tags across all loaded items, `patient_specific` excluded. */
  allExistingTags: string[];

  // tabs, search, pagination
  tab: BankTab;
  setTab: (t: BankTab) => void;
  /** Search query for the active tab; each tab keeps its own value. */
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  setPage: (p: number) => void;
  setItemsPerPage: (n: number) => void;

  // organization
  organizationIds: string[];
  activeOrganizationId: string | null;
  setActiveOrganizationId: (id: string) => void;
  /** True when an organization is resolved, i.e. reads and writes are possible. */
  canCreate: boolean;

  // lifecycle
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;

  // mutations
  createItem: (fields: F) => Promise<void>;
  updateItem: (id: string, fields: F) => Promise<void>;
}

/**
 * useInstructorItemBank
 *
 * Owns the fetch lifecycle, tab/search/pagination state, organization
 * resolution, and the create/update calls for one instructor item bank. The
 * bank itself is supplied as a descriptor, so this module names no service.
 * Every derivation delegates to the pure helpers in `@/lib/instructorBankUtils`
 * and `@/lib/bankUtils`.
 *
 * Unlike the question bank, both bank reads require an `organization_id`, so
 * resolution and the read are **sequential**: groups are fetched first and the
 * list read is issued only once an organization resolves. With no organization
 * there is nothing to read, so a groups failure surfaces as `error` rather than
 * degrading quietly — silence would present an empty bank as genuinely empty.
 */
export function useInstructorItemBank<T extends BankItem, F>(
  config: InstructorBankConfig<T, F>
): UseInstructorItemBankReturn<T, F> {
  // Loaded data
  const [items, setItems] = useState<T[]>([]);

  // Tab, per-tab search, pagination
  const [tab, setTabState] = useState<BankTab>('global');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPageState] = useState(DEFAULT_ITEMS_PER_PAGE);

  // Organization resolution
  const [organizationIds, setOrganizationIds] = useState<string[]>([]);
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string | null>(null);

  // Lifecycle
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The prior selection, readable without making `reload` depend on it — a
  // changing `reload` identity would re-trigger the mount effect. Written only
  // from `reload` and the selection setter, never during render.
  const activeOrganizationIdRef = useRef<string | null>(null);

  // The organization a read has already been issued for, so the selection
  // effect does not repeat the read `reload` just performed.
  const readOrganizationIdRef = useRef<string | null>(null);

  const { list, create, update, fields: fieldConfig, copy } = config;

  /** Build a deterministic message naming the blank required fields. */
  const describeMissing = useCallback(
    (missing: readonly string[]) => {
      const labels = missing.map(
        (key) => fieldConfig.labels[key as keyof F & string] ?? key
      );
      return `Please fill in the required fields: ${labels.join(', ')}.`;
    },
    [fieldConfig]
  );

  /** Read the bank for one organization. Failures surface as `error`. */
  const loadItems = useCallback(
    async (organizationId: string) => {
      readOrganizationIdRef.current = organizationId;
      setLoading(true);
      setError(null);
      try {
        const loaded = await list(organizationId);
        setItems(loaded);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : `Failed to load ${copy.itemNounPlural}. Please try again.`
        );
      } finally {
        setLoading(false);
      }
    },
    [list, copy.itemNounPlural]
  );

  /**
   * Resolve the organization, then read. Sequential by necessity: the read is
   * scoped by `organization_id`, so it cannot start before resolution finishes.
   * A null resolution short-circuits with zero service calls.
   */
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    let resolved: string | null;
    try {
      const groups = await instructorService.getSimulationGroups();
      const ids = resolveOrganizationIds(groups);
      resolved = resolveActiveOrganization(ids, activeOrganizationIdRef.current);
      setOrganizationIds(ids);
      setActiveOrganizationIdState(resolved);
      activeOrganizationIdRef.current = resolved;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load your simulation groups. Please try again.'
      );
      setLoading(false);
      return;
    }

    if (resolved === null) {
      readOrganizationIdRef.current = null;
      setItems([]);
      setLoading(false);
      return;
    }

    await loadItems(resolved);
  }, [loadItems]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Changing the selection re-runs the read only — resolution already happened.
  useEffect(() => {
    if (activeOrganizationId === null) return;
    if (readOrganizationIdRef.current === activeOrganizationId) return;
    void loadItems(activeOrganizationId);
  }, [activeOrganizationId, loadItems]);

  // Tab partitioning
  const { global: globalItems, patientSpecific: patientSpecificItems } = useMemo(
    () => partitionByPatientSpecific(items),
    [items]
  );

  // Tag suggestions across both tabs, with the classification tag excluded
  const allExistingTags = useMemo(
    () =>
      Array.from(
        new Set(
          items.flatMap((item) => item.tags || []).filter((t) => t !== PATIENT_SPECIFIC_TAG)
        )
      ).sort(),
    [items]
  );

  // Active tab derivations: partition, then search, then paginate
  const searchQuery = tab === 'global' ? globalSearchQuery : patientSearchQuery;
  const tabItems = tab === 'global' ? globalItems : patientSpecificItems;
  const filteredItems = useMemo(
    () => filterByTitle(tabItems, searchQuery),
    [tabItems, searchQuery]
  );
  const pagination = useMemo(
    () => paginate(filteredItems, page, itemsPerPage),
    [filteredItems, page, itemsPerPage]
  );

  const setTab = useCallback((next: BankTab) => {
    setTabState(next);
    setPage(1);
  }, []);

  const setSearchQuery = useCallback(
    (q: string) => {
      if (tab === 'global') {
        setGlobalSearchQuery(q);
      } else {
        setPatientSearchQuery(q);
      }
      setPage(1);
    },
    [tab]
  );

  const setItemsPerPage = useCallback((n: number) => {
    setItemsPerPageState(n);
    setPage(1);
  }, []);

  const setActiveOrganizationId = useCallback((id: string) => {
    activeOrganizationIdRef.current = id;
    setActiveOrganizationIdState(id);
  }, []);

  /**
   * Create an item under the resolved organization. Tags are normalized against
   * the active tab, so an item created from the patient-specific tab carries
   * `patient_specific` and one created from the group-wide tab never does.
   * Blank required text throws before any service call; a service failure
   * propagates, which is how the dialog stays open with the entered values.
   */
  const createItem = useCallback(
    async (fields: F) => {
      if (activeOrganizationId === null) return;

      const validation = validateRequiredTextFields(
        fields as Partial<Record<string, string>>,
        fieldConfig.requiredKeys as readonly string[]
      );
      if (!validation.valid) throw new Error(describeMissing(validation.errors));

      const tags = normalizeInstructorTags(
        (fields as { tags?: string[] }).tags || [],
        tab === 'patientSpecific'
      );
      const created = await create(activeOrganizationId, { ...fields, tags });
      setItems((previous) => [created, ...previous]);
    },
    [activeOrganizationId, create, describeMissing, fieldConfig, tab]
  );

  /**
   * Update an item in place. Tags are normalized against the item's own
   * `patient_specific` membership rather than the active tab, so an edit can
   * never silently move an item between tabs. Blank required text throws before
   * any service call; a service failure propagates so the caller can stay in
   * edit mode with the entered values.
   */
  const updateItem = useCallback(
    async (id: string, fields: F) => {
      const validation = validateRequiredTextFields(
        fields as Partial<Record<string, string>>,
        fieldConfig.requiredKeys as readonly string[]
      );
      if (!validation.valid) throw new Error(describeMissing(validation.errors));

      const existing = items.find((item) => item.id === id);
      const patientSpecific = (existing?.tags || []).includes(PATIENT_SPECIFIC_TAG);
      const tags = normalizeInstructorTags(
        (fields as { tags?: string[] }).tags || [],
        patientSpecific
      );
      const updated = await update(id, { ...fields, tags });
      setItems((previous) => replaceItem(previous, updated));
    },
    [describeMissing, fieldConfig, items, update]
  );

  return {
    // data
    items,
    activeItems: pagination.items,
    filteredCount: filteredItems.length,
    totalPages: pagination.totalPages,
    currentPage: pagination.currentPage,
    itemsPerPage,
    allExistingTags,

    // tabs, search, pagination
    tab,
    setTab,
    searchQuery,
    setSearchQuery,
    setPage,
    setItemsPerPage,

    // organization
    organizationIds,
    activeOrganizationId,
    setActiveOrganizationId,
    canCreate: activeOrganizationId !== null,

    // lifecycle
    loading,
    error,
    reload,

    // mutations
    createItem,
    updateItem,
  };
}
