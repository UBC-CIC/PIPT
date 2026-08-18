/**
 * Bank descriptors for the instructor bank management pages.
 *
 * This module is the single seam between the instructor bank pages and the
 * bank service layer: the pages consume a descriptor, so they name no service
 * module at all. Everything reachable from here is instructor-scoped and
 * limited to reading, creating, and updating — no deletion, and no
 * administrator service layer.
 */

import type { BankTab } from '@/lib/instructorBankUtils';
import {
  createDTPItemAsInstructor,
  listDTPItemsAsInstructor,
  updateDTPItemAsInstructor,
  type DTPItem,
} from '@/services/dtpBankService';
import {
  createRecommendationItemAsInstructor,
  listRecommendationItemsAsInstructor,
  updateRecommendationItemAsInstructor,
  type RecommendationItem,
} from '@/services/recommendationsBankService';

// ─── Content field types ─────────────────────────────────────────────────────

/** The DTP content an instructor authors. The active flag is not among them. */
export interface DTPContentFields {
  title: string;
  expectedDTPText: string;
  clinicalIntent: string;
  evaluationCriteria: string;
  isRequired: boolean;
  tags: string[];
}

/** The recommendation content an instructor authors. */
export interface RecommendationContentFields {
  title: string;
  recommendationText: string;
  evaluationCriteria: string;
  rationale: string;
  tags: string[];
}

// ─── Copy ────────────────────────────────────────────────────────────────────

/** Per-tab copy: label, blurb, search placeholder, create control, empty state. */
export interface BankTabCopy {
  /** Tab switcher label. */
  label: string;
  /** One-line description shown above the list. */
  description: string;
  /** Search input placeholder. */
  searchPlaceholder: string;
  /** Search input accessible label. */
  searchAriaLabel: string;
  /** Create control label. */
  createButtonLabel: string;
  /** Shown when the tab holds no items at all. */
  emptyMessage: string;
}

/** All the page copy a bank needs, as plain data. */
export interface BankCopy {
  /** Dashboard header subtitle. */
  subtitle: string;
  /** Page heading. */
  heading: string;
  /** Message shown while the list request is in flight. */
  loadingMessage: string;
  /** Shown when no organization could be resolved. */
  noOrganizationMessage: string;
  /** Shown when a search excludes every item of the active tab. */
  noSearchResultsMessage: string;
  /** Noun used in the pagination summary, e.g. "Showing 1-5 of 12 DTPs". */
  itemNounPlural: string;
  copyByTab: Record<BankTab, BankTabCopy>;
}

// ─── Descriptors ─────────────────────────────────────────────────────────────

/** Field-level facts used for validation messages. */
export interface BankFieldConfig<T, F> {
  /** Required text keys, in the order errors are reported. */
  requiredKeys: readonly (keyof F & string)[];
  /** Human labels for validation messages, keyed by field name. */
  labels: Record<keyof F & string, string>;
  /** Read-model key holding the item title, for row rendering and messages. */
  titleKey: keyof T & string;
}

/** Everything the generic hook and the shared shell need to serve one bank. */
export interface InstructorBankConfig<T extends { id: string; title: string; tags?: string[] }, F> {
  key: 'dtp' | 'recommendation';
  /** Copy: page subtitle, heading, tab labels, create button labels, empty states. */
  copy: BankCopy;
  fields: BankFieldConfig<T, F>;
  /** Instructor-scoped service calls. Nothing here targets an admin route. */
  list: (organizationId: string) => Promise<T[]>;
  create: (organizationId: string, fields: F) => Promise<T>;
  update: (itemId: string, fields: F) => Promise<T>;
}

// ─── DTP bank ────────────────────────────────────────────────────────────────

export const DTP_BANK_CONFIG: InstructorBankConfig<DTPItem, DTPContentFields> = {
  key: 'dtp',
  copy: {
    subtitle: 'DTP Bank Management',
    heading: 'DTP Bank',
    loadingMessage: 'Loading DTP bank...',
    noOrganizationMessage:
      "You don't have any simulation groups yet. Create a simulation group before adding DTP bank items.",
    noSearchResultsMessage: 'No DTPs match your search.',
    itemNounPlural: 'DTPs',
    copyByTab: {
      global: {
        label: 'Group-Wide DTPs',
        description:
          'Manage group-wide drug therapy problems — these apply across all patients in a simulation group.',
        searchPlaceholder: 'Search group-wide DTPs...',
        searchAriaLabel: 'Search group-wide DTPs',
        createButtonLabel: 'Add New Group-Wide DTP',
        emptyMessage: 'No group-wide DTPs yet. Add your first one above.',
      },
      patientSpecific: {
        label: 'Patient-Specific DTPs',
        description: 'Manage patient-specific drug therapy problems.',
        searchPlaceholder: 'Search patient-specific DTPs...',
        searchAriaLabel: 'Search patient-specific DTPs',
        createButtonLabel: 'Add New Patient-Specific DTP',
        emptyMessage: 'No patient-specific DTPs yet. Add your first one above.',
      },
    },
  },
  fields: {
    requiredKeys: ['title', 'expectedDTPText'],
    labels: {
      title: 'Title',
      expectedDTPText: 'Expected DTP text',
      clinicalIntent: 'Clinical intent',
      evaluationCriteria: 'Evaluation criteria',
      isRequired: 'Required',
      tags: 'Tags',
    },
    titleKey: 'title',
  },
  list: listDTPItemsAsInstructor,
  create: createDTPItemAsInstructor,
  update: updateDTPItemAsInstructor,
};

// ─── Recommendations bank ────────────────────────────────────────────────────

export const RECOMMENDATIONS_BANK_CONFIG: InstructorBankConfig<
  RecommendationItem,
  RecommendationContentFields
> = {
  key: 'recommendation',
  copy: {
    subtitle: 'Recommendations Bank Management',
    heading: 'Recommendations Bank',
    loadingMessage: 'Loading recommendations bank...',
    noOrganizationMessage:
      "You don't have any simulation groups yet. Create a simulation group before adding recommendation bank items.",
    noSearchResultsMessage: 'No recommendations match your search.',
    itemNounPlural: 'recommendations',
    copyByTab: {
      global: {
        label: 'Group-Wide Recommendations',
        description:
          'Manage group-wide recommendations — these apply across all patients in a simulation group.',
        searchPlaceholder: 'Search group-wide recommendations...',
        searchAriaLabel: 'Search group-wide recommendations',
        createButtonLabel: 'Add New Group-Wide Recommendation',
        emptyMessage: 'No group-wide recommendations yet. Add your first one above.',
      },
      patientSpecific: {
        label: 'Patient-Specific Recommendations',
        description: 'Manage patient-specific recommendations.',
        searchPlaceholder: 'Search patient-specific recommendations...',
        searchAriaLabel: 'Search patient-specific recommendations',
        createButtonLabel: 'Add New Patient-Specific Recommendation',
        emptyMessage: 'No patient-specific recommendations yet. Add your first one above.',
      },
    },
  },
  fields: {
    requiredKeys: ['title', 'recommendationText'],
    labels: {
      title: 'Title',
      recommendationText: 'Recommendation text',
      evaluationCriteria: 'Evaluation criteria',
      rationale: 'Rationale',
      tags: 'Tags',
    },
    titleKey: 'title',
  },
  list: listRecommendationItemsAsInstructor,
  create: createRecommendationItemAsInstructor,
  update: updateRecommendationItemAsInstructor,
};
