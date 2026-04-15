import { useState, useMemo } from 'react';
import { type QuestionBankItem } from '@/services/instructorService';

/**
 * Pagination state for a question bank tab
 */
export interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
}

/**
 * Parameters for the useQuestionBank hook
 */
export interface UseQuestionBankParams {
  /** Role determines loading strategy */
  role: 'admin' | 'instructor';
}

/**
 * Return type for the useQuestionBank hook
 */
export interface UseQuestionBankReturn {
  // Tab state
  questionBankTab: 'global' | 'patientSpecific';
  setQuestionBankTab: (tab: 'global' | 'patientSpecific') => void;

  // Question lists (raw, unfiltered)
  globalBankQuestions: QuestionBankItem[];
  setGlobalBankQuestions: React.Dispatch<React.SetStateAction<QuestionBankItem[]>>;
  patientSpecificBankQuestions: QuestionBankItem[];
  setPatientSpecificBankQuestions: React.Dispatch<React.SetStateAction<QuestionBankItem[]>>;

  // Filtered question lists
  filteredGlobalQuestions: QuestionBankItem[];
  filteredPatientQuestions: QuestionBankItem[];

  // Inclusion state
  includedQuestionIds: Set<string>;
  setIncludedQuestionIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  pendingQuestionIds: Set<string>;
  setPendingQuestionIds: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Tag autocomplete
  allExistingTags: string[];

  // Search state — instructor uses per-tab search, admin uses single search + tag filter
  globalQuestionSearchQuery: string;
  setGlobalQuestionSearchQuery: (q: string) => void;
  patientQuestionSearchQuery: string;
  setPatientQuestionSearchQuery: (q: string) => void;
  questionBankSearchQuery: string;
  setQuestionBankSearchQuery: (q: string) => void;
  questionBankTagFilter: string;
  setQuestionBankTagFilter: (t: string) => void;

  // Pagination
  globalPagination: PaginationState;
  setGlobalPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  patientPagination: PaginationState;
  setPatientPagination: React.Dispatch<React.SetStateAction<PaginationState>>;

  // Pagination helpers
  handleGlobalPageChange: (newPage: number) => void;
  handlePatientPageChange: (newPage: number) => void;
  handleGlobalItemsPerPageChange: (newItemsPerPage: number) => void;
  handlePatientItemsPerPageChange: (newItemsPerPage: number) => void;
  getPaginatedQuestions: (questions: QuestionBankItem[], currentPage: number, itemsPerPage: number) => QuestionBankItem[];
  getTotalPages: (totalItems: number, itemsPerPage: number) => number;

  // Pending changes helpers (instructor flow)
  handleTogglePendingQuestion: (questionId: string) => void;
  hasPendingChanges: boolean;
  pendingAddCount: number;
  pendingRemoveCount: number;
  handleResetSelections: () => void;

  // Dialog state
  isAddQuestionDialogOpen: boolean;
  setIsAddQuestionDialogOpen: (open: boolean) => void;
  isAddPatientQuestionDialogOpen: boolean;
  setIsAddPatientQuestionDialogOpen: (open: boolean) => void;
  addQuestionType: 'global' | 'patientSpecific';
  setAddQuestionType: (type: 'global' | 'patientSpecific') => void;

  // Patient selection for question bank
  selectedPatientForQuestionBank: string | null;
  setSelectedPatientForQuestionBank: (patientId: string | null) => void;

  // Loading/error state
  questionBankLoading: boolean;
  setQuestionBankLoading: (loading: boolean) => void;
  questionBankError: string | null;
  setQuestionBankError: (error: string | null) => void;
}

/**
 * useQuestionBank hook
 *
 * Manages question bank state including tabs, search, tag filtering,
 * pagination, included/pending question IDs, and question lists.
 * Used by both InstructorSimulationGroupPage and AdminSimulationGroupPage.
 */
export function useQuestionBank({ role }: UseQuestionBankParams): UseQuestionBankReturn {
  // Tab state
  const [questionBankTab, setQuestionBankTab] = useState<'global' | 'patientSpecific'>('global');

  // Question lists
  const [globalBankQuestions, setGlobalBankQuestions] = useState<QuestionBankItem[]>([]);
  const [patientSpecificBankQuestions, setPatientSpecificBankQuestions] = useState<QuestionBankItem[]>([]);

  // Inclusion state
  const [includedQuestionIds, setIncludedQuestionIds] = useState<Set<string>>(new Set());
  const [pendingQuestionIds, setPendingQuestionIds] = useState<Set<string>>(new Set());

  // Search state — instructor uses per-tab search queries
  const [globalQuestionSearchQuery, setGlobalQuestionSearchQuery] = useState('');
  const [patientQuestionSearchQuery, setPatientQuestionSearchQuery] = useState('');
  // Admin uses a single search query + tag filter
  const [questionBankSearchQuery, setQuestionBankSearchQuery] = useState('');
  const [questionBankTagFilter, setQuestionBankTagFilter] = useState<string>('');

  // Pagination state
  const [globalPagination, setGlobalPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 5,
  });
  const [patientPagination, setPatientPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 5,
  });

  // Dialog state
  const [isAddQuestionDialogOpen, setIsAddQuestionDialogOpen] = useState(false);
  const [isAddPatientQuestionDialogOpen, setIsAddPatientQuestionDialogOpen] = useState(false);
  const [addQuestionType, setAddQuestionType] = useState<'global' | 'patientSpecific'>('global');

  // Patient selection for question bank
  const [selectedPatientForQuestionBank, setSelectedPatientForQuestionBank] = useState<string | null>(null);

  // Loading/error state
  const [questionBankLoading, setQuestionBankLoading] = useState(false);
  const [questionBankError, setQuestionBankError] = useState<string | null>(null);

  // Compute all unique tags from loaded questions for autocomplete
  const allExistingTags = useMemo(() => {
    return Array.from(
      new Set(
        [...globalBankQuestions, ...patientSpecificBankQuestions]
          .flatMap(q => q.tags || [])
          .filter(t => t !== 'patient_specific')
      )
    ).sort();
  }, [globalBankQuestions, patientSpecificBankQuestions]);

  // Filtered question lists
  const filteredGlobalQuestions = useMemo(() => {
    if (role === 'admin') {
      return globalBankQuestions.filter(q => {
        const matchesSearch = !questionBankSearchQuery || q.title.toLowerCase().includes(questionBankSearchQuery.toLowerCase());
        const matchesTag = !questionBankTagFilter || (q.tags || []).includes(questionBankTagFilter);
        return matchesSearch && matchesTag;
      });
    }
    // Instructor: per-tab search, no tag filter
    return globalBankQuestions.filter(q =>
      q.title.toLowerCase().includes(globalQuestionSearchQuery.toLowerCase())
    );
  }, [role, globalBankQuestions, questionBankSearchQuery, questionBankTagFilter, globalQuestionSearchQuery]);

  const filteredPatientQuestions = useMemo(() => {
    if (role === 'admin') {
      return patientSpecificBankQuestions.filter(q => {
        const matchesSearch = !questionBankSearchQuery || q.title.toLowerCase().includes(questionBankSearchQuery.toLowerCase());
        const matchesTag = !questionBankTagFilter || (q.tags || []).includes(questionBankTagFilter);
        return matchesSearch && matchesTag;
      });
    }
    // Instructor: per-tab search, no tag filter
    return patientSpecificBankQuestions.filter(q =>
      q.title.toLowerCase().includes(patientQuestionSearchQuery.toLowerCase())
    );
  }, [role, patientSpecificBankQuestions, questionBankSearchQuery, questionBankTagFilter, patientQuestionSearchQuery]);

  // Pagination helpers
  const getPaginatedQuestions = (questions: QuestionBankItem[], currentPage: number, itemsPerPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return questions.slice(startIndex, endIndex);
  };

  const getTotalPages = (totalItems: number, itemsPerPage: number) => {
    return Math.ceil(totalItems / itemsPerPage);
  };

  const handleGlobalPageChange = (newPage: number) => {
    setGlobalPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const handlePatientPageChange = (newPage: number) => {
    setPatientPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const handleGlobalItemsPerPageChange = (newItemsPerPage: number) => {
    setGlobalPagination({ currentPage: 1, itemsPerPage: newItemsPerPage });
  };

  const handlePatientItemsPerPageChange = (newItemsPerPage: number) => {
    setPatientPagination({ currentPage: 1, itemsPerPage: newItemsPerPage });
  };

  // Pending changes helpers (instructor confirm/reset flow)
  const handleTogglePendingQuestion = (questionId: string) => {
    setPendingQuestionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const hasPendingChanges = useMemo(() => {
    if (pendingQuestionIds.size !== includedQuestionIds.size) return true;
    for (const id of pendingQuestionIds) {
      if (!includedQuestionIds.has(id)) return true;
    }
    return false;
  }, [pendingQuestionIds, includedQuestionIds]);

  const pendingAddCount = useMemo(
    () => [...pendingQuestionIds].filter(id => !includedQuestionIds.has(id)).length,
    [pendingQuestionIds, includedQuestionIds]
  );

  const pendingRemoveCount = useMemo(
    () => [...includedQuestionIds].filter(id => !pendingQuestionIds.has(id)).length,
    [pendingQuestionIds, includedQuestionIds]
  );

  const handleResetSelections = () => {
    setPendingQuestionIds(new Set(includedQuestionIds));
  };

  return {
    // Tab
    questionBankTab,
    setQuestionBankTab,

    // Question lists
    globalBankQuestions,
    setGlobalBankQuestions,
    patientSpecificBankQuestions,
    setPatientSpecificBankQuestions,

    // Filtered
    filteredGlobalQuestions,
    filteredPatientQuestions,

    // Inclusion
    includedQuestionIds,
    setIncludedQuestionIds,
    pendingQuestionIds,
    setPendingQuestionIds,

    // Tags
    allExistingTags,

    // Search
    globalQuestionSearchQuery,
    setGlobalQuestionSearchQuery,
    patientQuestionSearchQuery,
    setPatientQuestionSearchQuery,
    questionBankSearchQuery,
    setQuestionBankSearchQuery,
    questionBankTagFilter,
    setQuestionBankTagFilter,

    // Pagination
    globalPagination,
    setGlobalPagination,
    patientPagination,
    setPatientPagination,
    handleGlobalPageChange,
    handlePatientPageChange,
    handleGlobalItemsPerPageChange,
    handlePatientItemsPerPageChange,
    getPaginatedQuestions,
    getTotalPages,

    // Pending changes
    handleTogglePendingQuestion,
    hasPendingChanges,
    pendingAddCount,
    pendingRemoveCount,
    handleResetSelections,

    // Dialogs
    isAddQuestionDialogOpen,
    setIsAddQuestionDialogOpen,
    isAddPatientQuestionDialogOpen,
    setIsAddPatientQuestionDialogOpen,
    addQuestionType,
    setAddQuestionType,

    // Patient selection
    selectedPatientForQuestionBank,
    setSelectedPatientForQuestionBank,

    // Loading/error
    questionBankLoading,
    setQuestionBankLoading,
    questionBankError,
    setQuestionBankError,
  };
}
