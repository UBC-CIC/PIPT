/**
 * DTP Bank Service (Mocked)
 *
 * In-memory CRUD and assignment operations for Drug Therapy Problem items.
 * All functions return Promises to simulate async behavior, making it easy
 * to swap for real API calls later.
 */

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface DTPItem {
  id: string;                    // UUID
  organizationId: string;        // Parent organization
  title: string;                 // Short descriptive title
  expectedDTPText: string;       // The expected drug therapy problem text
  clinicalIntent: string;        // Why this DTP matters clinically
  evaluationCriteria: string;    // How to evaluate student's identification
  tags: string[];                // Filtering tags
  isRequired: boolean;           // Required vs optional for case completion
  createdAt: string;             // ISO timestamp
}

export interface DTPAssignment {
  dtpItemId: string;
  simulationGroupId: string;
  patientId?: string;            // If assigned to specific patient (undefined = group-level)
  assignedAt: string;            // ISO timestamp
}

// ─── In-Memory Data Store ────────────────────────────────────────────────────

const DEFAULT_ORG_ID = 'org-001';

let dtpItems: DTPItem[] = [
  {
    id: 'dtp-001',
    organizationId: DEFAULT_ORG_ID,
    title: 'Untreated Hypertension',
    expectedDTPText: 'Patient has elevated blood pressure readings (>140/90 mmHg) on multiple visits without current antihypertensive therapy.',
    clinicalIntent: 'Identify uncontrolled hypertension requiring pharmacological intervention to reduce cardiovascular risk.',
    evaluationCriteria: 'Student should identify the lack of antihypertensive therapy and recommend initiating treatment based on current guidelines.',
    tags: ['cardiovascular', 'hypertension', 'untreated condition'],
    isRequired: true,
    createdAt: '2024-11-01T10:00:00.000Z',
  },
  {
    id: 'dtp-002',
    organizationId: DEFAULT_ORG_ID,
    title: 'Drug Interaction: Warfarin and NSAIDs',
    expectedDTPText: 'Patient is concurrently taking warfarin and ibuprofen, increasing the risk of gastrointestinal bleeding.',
    clinicalIntent: 'Recognize the clinically significant interaction between anticoagulants and NSAIDs that elevates bleeding risk.',
    evaluationCriteria: 'Student should identify the interaction, explain the mechanism, and suggest an alternative analgesic such as acetaminophen.',
    tags: ['drug interaction', 'anticoagulant', 'NSAID', 'bleeding risk'],
    isRequired: true,
    createdAt: '2024-11-02T14:30:00.000Z',
  },
  {
    id: 'dtp-003',
    organizationId: DEFAULT_ORG_ID,
    title: 'Subtherapeutic Metformin Dose',
    expectedDTPText: 'Patient with Type 2 diabetes is on metformin 500mg once daily with HbA1c of 8.2%, indicating subtherapeutic dosing.',
    clinicalIntent: 'Identify inadequate glycemic control due to suboptimal metformin dosing that requires titration.',
    evaluationCriteria: 'Student should recognize the elevated HbA1c, correlate with current dose, and recommend dose titration toward 1000-2000mg daily.',
    tags: ['diabetes', 'dose optimization', 'metformin'],
    isRequired: true,
    createdAt: '2024-11-05T09:15:00.000Z',
  },
  {
    id: 'dtp-004',
    organizationId: DEFAULT_ORG_ID,
    title: 'Unnecessary Duplicate Therapy',
    expectedDTPText: 'Patient is taking both omeprazole and pantoprazole, representing unnecessary therapeutic duplication of proton pump inhibitors.',
    clinicalIntent: 'Identify duplicate therapy within the same drug class that provides no additional benefit and increases cost/risk.',
    evaluationCriteria: 'Student should identify both PPIs, explain why duplication is unnecessary, and recommend discontinuing one.',
    tags: ['duplicate therapy', 'PPI', 'medication reconciliation'],
    isRequired: false,
    createdAt: '2024-11-08T11:45:00.000Z',
  },
  {
    id: 'dtp-005',
    organizationId: DEFAULT_ORG_ID,
    title: 'Adverse Drug Reaction: Statin-Induced Myalgia',
    expectedDTPText: 'Patient reports new-onset muscle pain and weakness since starting atorvastatin 80mg, consistent with statin-induced myalgia.',
    clinicalIntent: 'Recognize a common adverse drug reaction that may require dose reduction or switching to an alternative statin.',
    evaluationCriteria: 'Student should correlate symptoms with statin initiation, check CK levels, and recommend dose adjustment or alternative therapy.',
    tags: ['adverse reaction', 'statin', 'myalgia', 'monitoring'],
    isRequired: true,
    createdAt: '2024-11-10T16:00:00.000Z',
  },
  {
    id: 'dtp-006',
    organizationId: DEFAULT_ORG_ID,
    title: 'Non-Adherence to Inhaler Therapy',
    expectedDTPText: 'Patient with persistent asthma reports using rescue inhaler daily but admits to not using prescribed maintenance inhaler (fluticasone).',
    clinicalIntent: 'Identify medication non-adherence as a drug therapy problem contributing to uncontrolled asthma symptoms.',
    evaluationCriteria: 'Student should identify non-adherence pattern, explore barriers, and provide patient education on the importance of maintenance therapy.',
    tags: ['adherence', 'asthma', 'inhaler', 'patient education'],
    isRequired: false,
    createdAt: '2024-11-12T08:30:00.000Z',
  },
];

let dtpAssignments: DTPAssignment[] = [];

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * List all DTP items for a given organization.
 * In mock mode, returns all items regardless of organizationId for development convenience.
 */
export async function listDTPItems(_organizationId: string): Promise<DTPItem[]> {
  return dtpItems;
}

/**
 * Create a new DTP item for an organization.
 */
export async function createDTPItem(
  organizationId: string,
  data: Omit<DTPItem, 'id' | 'organizationId' | 'createdAt'>
): Promise<DTPItem> {
  const newItem: DTPItem = {
    id: crypto.randomUUID(),
    organizationId,
    createdAt: new Date().toISOString(),
    ...data,
  };
  dtpItems.push(newItem);
  return newItem;
}

/**
 * Delete a DTP item by ID.
 */
export async function deleteDTPItem(itemId: string): Promise<void> {
  dtpItems = dtpItems.filter((item) => item.id !== itemId);
  // Also remove any assignments referencing this item
  dtpAssignments = dtpAssignments.filter((a) => a.dtpItemId !== itemId);
}

/**
 * Assign a DTP item to an entire simulation group (group-level assignment).
 */
export async function assignDTPToGroup(
  dtpItemId: string,
  simulationGroupId: string
): Promise<DTPAssignment> {
  const assignment: DTPAssignment = {
    dtpItemId,
    simulationGroupId,
    assignedAt: new Date().toISOString(),
  };
  dtpAssignments.push(assignment);
  return assignment;
}

/**
 * Assign a DTP item to a specific patient within a simulation group.
 */
export async function assignDTPToPatient(
  dtpItemId: string,
  simulationGroupId: string,
  patientId: string
): Promise<DTPAssignment> {
  const assignment: DTPAssignment = {
    dtpItemId,
    simulationGroupId,
    patientId,
    assignedAt: new Date().toISOString(),
  };
  dtpAssignments.push(assignment);
  return assignment;
}

/**
 * Retrieve DTP assignments for a simulation group, optionally filtered by patient.
 * If patientId is provided, returns both group-level assignments (no patientId)
 * and patient-specific assignments for that patient.
 * If patientId is omitted, returns only group-level assignments.
 */
export async function getAssignedDTPs(
  simulationGroupId: string,
  patientId?: string
): Promise<DTPAssignment[]> {
  return dtpAssignments.filter((a) => {
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
  dtpItems = [
    {
      id: 'dtp-001',
      organizationId: DEFAULT_ORG_ID,
      title: 'Untreated Hypertension',
      expectedDTPText: 'Patient has elevated blood pressure readings (>140/90 mmHg) on multiple visits without current antihypertensive therapy.',
      clinicalIntent: 'Identify uncontrolled hypertension requiring pharmacological intervention to reduce cardiovascular risk.',
      evaluationCriteria: 'Student should identify the lack of antihypertensive therapy and recommend initiating treatment based on current guidelines.',
      tags: ['cardiovascular', 'hypertension', 'untreated condition'],
      isRequired: true,
      createdAt: '2024-11-01T10:00:00.000Z',
    },
    {
      id: 'dtp-002',
      organizationId: DEFAULT_ORG_ID,
      title: 'Drug Interaction: Warfarin and NSAIDs',
      expectedDTPText: 'Patient is concurrently taking warfarin and ibuprofen, increasing the risk of gastrointestinal bleeding.',
      clinicalIntent: 'Recognize the clinically significant interaction between anticoagulants and NSAIDs that elevates bleeding risk.',
      evaluationCriteria: 'Student should identify the interaction, explain the mechanism, and suggest an alternative analgesic such as acetaminophen.',
      tags: ['drug interaction', 'anticoagulant', 'NSAID', 'bleeding risk'],
      isRequired: true,
      createdAt: '2024-11-02T14:30:00.000Z',
    },
    {
      id: 'dtp-003',
      organizationId: DEFAULT_ORG_ID,
      title: 'Subtherapeutic Metformin Dose',
      expectedDTPText: 'Patient with Type 2 diabetes is on metformin 500mg once daily with HbA1c of 8.2%, indicating subtherapeutic dosing.',
      clinicalIntent: 'Identify inadequate glycemic control due to suboptimal metformin dosing that requires titration.',
      evaluationCriteria: 'Student should recognize the elevated HbA1c, correlate with current dose, and recommend dose titration toward 1000-2000mg daily.',
      tags: ['diabetes', 'dose optimization', 'metformin'],
      isRequired: true,
      createdAt: '2024-11-05T09:15:00.000Z',
    },
    {
      id: 'dtp-004',
      organizationId: DEFAULT_ORG_ID,
      title: 'Unnecessary Duplicate Therapy',
      expectedDTPText: 'Patient is taking both omeprazole and pantoprazole, representing unnecessary therapeutic duplication of proton pump inhibitors.',
      clinicalIntent: 'Identify duplicate therapy within the same drug class that provides no additional benefit and increases cost/risk.',
      evaluationCriteria: 'Student should identify both PPIs, explain why duplication is unnecessary, and recommend discontinuing one.',
      tags: ['duplicate therapy', 'PPI', 'medication reconciliation'],
      isRequired: false,
      createdAt: '2024-11-08T11:45:00.000Z',
    },
    {
      id: 'dtp-005',
      organizationId: DEFAULT_ORG_ID,
      title: 'Adverse Drug Reaction: Statin-Induced Myalgia',
      expectedDTPText: 'Patient reports new-onset muscle pain and weakness since starting atorvastatin 80mg, consistent with statin-induced myalgia.',
      clinicalIntent: 'Recognize a common adverse drug reaction that may require dose reduction or switching to an alternative statin.',
      evaluationCriteria: 'Student should correlate symptoms with statin initiation, check CK levels, and recommend dose adjustment or alternative therapy.',
      tags: ['adverse reaction', 'statin', 'myalgia', 'monitoring'],
      isRequired: true,
      createdAt: '2024-11-10T16:00:00.000Z',
    },
    {
      id: 'dtp-006',
      organizationId: DEFAULT_ORG_ID,
      title: 'Non-Adherence to Inhaler Therapy',
      expectedDTPText: 'Patient with persistent asthma reports using rescue inhaler daily but admits to not using prescribed maintenance inhaler (fluticasone).',
      clinicalIntent: 'Identify medication non-adherence as a drug therapy problem contributing to uncontrolled asthma symptoms.',
      evaluationCriteria: 'Student should identify non-adherence pattern, explore barriers, and provide patient education on the importance of maintenance therapy.',
      tags: ['adherence', 'asthma', 'inhaler', 'patient education'],
      isRequired: false,
      createdAt: '2024-11-12T08:30:00.000Z',
    },
  ];
  dtpAssignments = [];
}
