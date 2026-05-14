/**
 * Recommendations Bank Service (Mocked)
 *
 * In-memory CRUD and assignment operations for Recommendation items.
 * All functions return Promises to simulate async behavior, making it easy
 * to swap for real API calls later.
 */

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface RecommendationItem {
  id: string;                    // UUID
  organizationId: string;        // Parent organization
  title: string;                 // Short descriptive title
  recommendationText: string;    // The expected recommendation
  evaluationCriteria: string;    // How to evaluate student's recommendation
  rationale: string;             // Clinical rationale for this recommendation
  createdAt: string;             // ISO timestamp
}

export interface RecommendationAssignment {
  recommendationItemId: string;
  simulationGroupId: string;
  patientId?: string;            // If assigned to specific patient
  assignedAt: string;            // ISO timestamp
}

// ─── In-Memory Data Store ────────────────────────────────────────────────────

const DEFAULT_ORG_ID = 'org-001';

const SEED_RECOMMENDATIONS: RecommendationItem[] = [
  {
    id: 'rec-001',
    organizationId: DEFAULT_ORG_ID,
    title: 'Initiate ACE Inhibitor Therapy',
    recommendationText: 'Start lisinopril 10mg once daily for blood pressure management and renal protection in this diabetic patient.',
    evaluationCriteria: 'Student should recommend an ACE inhibitor with appropriate starting dose and identify the dual benefit of BP control and nephroprotection.',
    rationale: 'ACE inhibitors are first-line for hypertension in patients with diabetes due to their renoprotective effects, reducing progression of diabetic nephropathy.',
    createdAt: '2024-11-01T10:00:00.000Z',
  },
  {
    id: 'rec-002',
    organizationId: DEFAULT_ORG_ID,
    title: 'Switch to Alternative Analgesic',
    recommendationText: 'Discontinue ibuprofen and switch to acetaminophen 650mg every 6 hours as needed for pain, given concurrent warfarin therapy.',
    evaluationCriteria: 'Student should identify the need to avoid NSAIDs with anticoagulants and recommend a safer alternative with appropriate dosing.',
    rationale: 'NSAIDs increase bleeding risk when combined with warfarin by inhibiting platelet function and potentially displacing warfarin from protein binding sites. Acetaminophen is the preferred analgesic.',
    createdAt: '2024-11-02T14:30:00.000Z',
  },
  {
    id: 'rec-003',
    organizationId: DEFAULT_ORG_ID,
    title: 'Titrate Metformin Dose',
    recommendationText: 'Increase metformin to 1000mg twice daily over 4 weeks, with GI tolerance monitoring, to achieve target HbA1c below 7%.',
    evaluationCriteria: 'Student should recommend gradual dose titration with a specific target, mention GI side effects as a monitoring parameter, and set a glycemic goal.',
    rationale: 'Metformin dose-response is well established; most patients require 1500-2000mg daily for optimal glycemic control. Gradual titration minimizes GI adverse effects.',
    createdAt: '2024-11-05T09:15:00.000Z',
  },
  {
    id: 'rec-004',
    organizationId: DEFAULT_ORG_ID,
    title: 'Discontinue Duplicate PPI',
    recommendationText: 'Discontinue pantoprazole and continue omeprazole 20mg once daily 30 minutes before breakfast. Reassess need for PPI therapy in 8 weeks.',
    evaluationCriteria: 'Student should identify the duplication, choose one agent to continue with proper administration instructions, and set a timeline for reassessment.',
    rationale: 'Therapeutic duplication of PPIs provides no additional acid suppression benefit while increasing cost and potential adverse effects including C. difficile risk and hypomagnesemia.',
    createdAt: '2024-11-08T11:45:00.000Z',
  },
  {
    id: 'rec-005',
    organizationId: DEFAULT_ORG_ID,
    title: 'Reduce Statin Dose and Monitor',
    recommendationText: 'Reduce atorvastatin to 40mg daily, obtain baseline CK level, and reassess symptoms in 2-4 weeks. Consider switching to rosuvastatin if myalgia persists.',
    evaluationCriteria: 'Student should recommend dose reduction as first step, order appropriate lab monitoring, set a follow-up timeline, and have a contingency plan.',
    rationale: 'Statin-induced myalgia is dose-dependent. Dose reduction resolves symptoms in many patients while maintaining cardiovascular benefit. CK monitoring helps rule out rhabdomyolysis.',
    createdAt: '2024-11-10T16:00:00.000Z',
  },
  {
    id: 'rec-006',
    organizationId: DEFAULT_ORG_ID,
    title: 'Implement Adherence Strategy for Inhaler',
    recommendationText: 'Counsel patient on importance of daily fluticasone use, demonstrate proper inhaler technique, and recommend linking inhaler use to an existing daily routine (e.g., brushing teeth).',
    evaluationCriteria: 'Student should address the adherence barrier with patient education, technique assessment, and a practical behavioral strategy.',
    rationale: 'Non-adherence to maintenance inhalers is the most common cause of uncontrolled asthma. Behavioral strategies and technique education significantly improve adherence rates.',
    createdAt: '2024-11-12T08:30:00.000Z',
  },
];

let recommendationItems: RecommendationItem[] = [...SEED_RECOMMENDATIONS];

let recommendationAssignments: RecommendationAssignment[] = [];

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * List all Recommendation items for a given organization.
 * In mock mode, returns all items regardless of organizationId for development convenience.
 */
export async function listRecommendationItems(_organizationId: string): Promise<RecommendationItem[]> {
  return recommendationItems;
}

/**
 * Create a new Recommendation item for an organization.
 */
export async function createRecommendationItem(
  organizationId: string,
  data: Omit<RecommendationItem, 'id' | 'organizationId' | 'createdAt'>
): Promise<RecommendationItem> {
  const newItem: RecommendationItem = {
    id: crypto.randomUUID(),
    organizationId,
    createdAt: new Date().toISOString(),
    ...data,
  };
  recommendationItems.push(newItem);
  return newItem;
}

/**
 * Delete a Recommendation item by ID.
 */
export async function deleteRecommendationItem(itemId: string): Promise<void> {
  recommendationItems = recommendationItems.filter((item) => item.id !== itemId);
  // Also remove any assignments referencing this item
  recommendationAssignments = recommendationAssignments.filter((a) => a.recommendationItemId !== itemId);
}

/**
 * Assign a Recommendation item to an entire simulation group (group-level assignment).
 */
export async function assignRecommendationToGroup(
  recommendationItemId: string,
  simulationGroupId: string
): Promise<RecommendationAssignment> {
  const assignment: RecommendationAssignment = {
    recommendationItemId,
    simulationGroupId,
    assignedAt: new Date().toISOString(),
  };
  recommendationAssignments.push(assignment);
  return assignment;
}

/**
 * Assign a Recommendation item to a specific patient within a simulation group.
 */
export async function assignRecommendationToPatient(
  recommendationItemId: string,
  simulationGroupId: string,
  patientId: string
): Promise<RecommendationAssignment> {
  const assignment: RecommendationAssignment = {
    recommendationItemId,
    simulationGroupId,
    patientId,
    assignedAt: new Date().toISOString(),
  };
  recommendationAssignments.push(assignment);
  return assignment;
}

/**
 * Retrieve Recommendation assignments for a simulation group, optionally filtered by patient.
 * If patientId is provided, returns both group-level assignments (no patientId)
 * and patient-specific assignments for that patient.
 * If patientId is omitted, returns only group-level assignments.
 */
export async function getAssignedRecommendations(
  simulationGroupId: string,
  patientId?: string
): Promise<RecommendationAssignment[]> {
  return recommendationAssignments.filter((a) => {
    if (a.simulationGroupId !== simulationGroupId) return false;
    if (patientId) {
      // Return group-level (no patientId) and patient-specific assignments
      return a.patientId === undefined || a.patientId === patientId;
    }
    // No patientId filter — return only group-level assignments
    return a.patientId === undefined;
  });
}

// ─── Test Helpers (for resetting state in tests) ─────────────────────────────

export function _resetStore() {
  recommendationItems = [...SEED_RECOMMENDATIONS];
  recommendationAssignments = [];
}
