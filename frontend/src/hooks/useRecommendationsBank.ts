import { useState, useMemo } from 'react';
import type { RecommendationItem } from '@/services/recommendationsBankService';

/**
 * Pagination state for a Recommendations bank tab
 */
export interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
}

/**
 * Parameters for the useRecommendationsBank hook
 */
export interface UseRecommendationsBankParams {
  /** Role determines loading strategy and UX flow */
  role: 'admin' | 'instructor';
}

/**
 * Return type for the useRecommendationsBank hook
 */
export interface UseRecommendationsBankReturn {
  // Item lists (raw, unfiltered)
  recommendationItems: RecommendationItem[];
  setRecommendationItems: React.Dispatch<React.SetStateAction<RecommendationItem[]>>;

  // Filtered item list
  filteredItems: RecommendationItem[];

  // Inclusion state
  includedIds: Set<string>;
  setIncludedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  pendingIds: Set<string>;
  setPendingIds: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Search state
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Pagination
  pagination: PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  handlePageChange: (newPage: number) => void;
  handleItemsPerPageChange: (newItemsPerPage: number) => void;
  getPaginatedItems: (items: RecommendationItem[], currentPage: number, itemsPerPage: number) => RecommendationItem[];
  getTotalPages: (totalItems: number, itemsPerPage: number) => number;

  // Pending changes helpers (instructor flow)
  handleTogglePendingItem: (itemId: string) => void;
  hasPendingChanges: boolean;
  pendingAddCount: number;
  pendingRemoveCount: number;
  handleResetSelections: () => void;

  // Dialog state
  isAddDialogOpen: boolean;
  setIsAddDialogOpen: (open: boolean) => void;

  // Patient selection
  selectedPatientId: string | null;
  setSelectedPatientId: (patientId: string | null) => void;

  // Loading/error state
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

/**
 * useRecommendationsBank hook
 *
 * Manages Recommendations bank state including search, pagination, included/pending IDs,
 * and item lists. Used by both InstructorSimulationGroupPage and AdminSimulationGroupPage.
 * Mirrors useQuestionBank structure exactly.
 */
export function useRecommendationsBank({ role: _role }: UseRecommendationsBankParams): UseRecommendationsBankReturn {
  // Item lists
  const [recommendationItems, setRecommendationItems] = useState<RecommendationItem[]>([]);

  // Inclusion state
  const [includedIds, setIncludedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 5,
  });

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Patient selection
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Loading/error state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtered item list
  const filteredItems = useMemo(() => {
    if (!searchQuery) return recommendationItems;
    return recommendationItems.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [recommendationItems, searchQuery]);

  // Pagination helpers
  const getPaginatedItems = (items: RecommendationItem[], currentPage: number, itemsPerPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  };

  const getTotalPages = (totalItems: number, itemsPerPage: number) => {
    return Math.max(1, Math.ceil(totalItems / itemsPerPage));
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setPagination({ currentPage: 1, itemsPerPage: newItemsPerPage });
  };

  // Pending changes helpers (instructor confirm/reset flow)
  const handleTogglePendingItem = (itemId: string) => {
    setPendingIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const hasPendingChanges = useMemo(() => {
    if (pendingIds.size !== includedIds.size) return true;
    for (const id of pendingIds) {
      if (!includedIds.has(id)) return true;
    }
    return false;
  }, [pendingIds, includedIds]);

  const pendingAddCount = useMemo(
    () => [...pendingIds].filter(id => !includedIds.has(id)).length,
    [pendingIds, includedIds]
  );

  const pendingRemoveCount = useMemo(
    () => [...includedIds].filter(id => !pendingIds.has(id)).length,
    [pendingIds, includedIds]
  );

  const handleResetSelections = () => {
    setPendingIds(new Set(includedIds));
  };

  return {
    // Item lists
    recommendationItems,
    setRecommendationItems,

    // Filtered
    filteredItems,

    // Inclusion
    includedIds,
    setIncludedIds,
    pendingIds,
    setPendingIds,

    // Search
    searchQuery,
    setSearchQuery,

    // Pagination
    pagination,
    setPagination,
    handlePageChange,
    handleItemsPerPageChange,
    getPaginatedItems,
    getTotalPages,

    // Pending changes
    handleTogglePendingItem,
    hasPendingChanges,
    pendingAddCount,
    pendingRemoveCount,
    handleResetSelections,

    // Dialog
    isAddDialogOpen,
    setIsAddDialogOpen,

    // Patient selection
    selectedPatientId,
    setSelectedPatientId,

    // Loading/error
    loading,
    setLoading,
    error,
    setError,
  };
}
