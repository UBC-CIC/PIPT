/**
 * DTP Bank Service
 *
 * CRUD and assignment operations for Drug Therapy Problem items.
 * Calls real backend API endpoints via apiClient.
 */

import { apiClient } from '@/lib/api-client';

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
  isActive: boolean;             // Whether the item is active
  createdAt: string;             // ISO timestamp
}

export interface DTPAssignment {
  groupDtpId: string;
  dtpId: string;
  simulationGroupId: string;
  personaId?: string;
  sortOrder: number;
  addedAt: string;
  // Joined fields from dtp_bank
  title?: string;
  expectedDTPText?: string;
  clinicalIntent?: string;
  evaluationCriteria?: string;
  tags?: string[];
  isRequired?: boolean;
  isActive?: boolean;
}

// ─── Mapping Functions ───────────────────────────────────────────────────────

/**
 * Maps a backend snake_case row to the camelCase DTPItem interface.
 */
export function mapBackendToDTPItem(row: Record<string, unknown>): DTPItem {
  return {
    id: row.dtp_id as string,
    organizationId: row.organization_id as string,
    title: row.title as string,
    expectedDTPText: row.expected_dtp_text as string,
    clinicalIntent: (row.clinical_intent as string) || '',
    evaluationCriteria: (row.evaluation_criteria as string) || '',
    tags: (row.tags as string[]) || [],
    isRequired: (row.is_required as boolean) || false,
    isActive: row.is_active !== false,
    createdAt: row.created_at as string,
  };
}

/**
 * Maps a backend snake_case assignment row to the camelCase DTPAssignment interface.
 */
function mapBackendToDTPAssignment(row: Record<string, unknown>): DTPAssignment {
  return {
    groupDtpId: row.group_dtp_id as string,
    dtpId: row.dtp_id as string,
    simulationGroupId: row.simulation_group_id as string,
    personaId: row.persona_id as string | undefined,
    sortOrder: (row.sort_order as number) || 0,
    addedAt: row.added_at as string,
    title: row.title as string | undefined,
    expectedDTPText: row.expected_dtp_text as string | undefined,
    clinicalIntent: row.clinical_intent as string | undefined,
    evaluationCriteria: row.evaluation_criteria as string | undefined,
    tags: row.tags as string[] | undefined,
    isRequired: row.is_required as boolean | undefined,
    isActive: row.is_active as boolean | undefined,
  };
}

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * List all DTP items for a given organization.
 */
export async function listDTPItems(organizationId: string): Promise<DTPItem[]> {
  const rows = await apiClient.request<Record<string, unknown>[]>(
    `admin/dtp_bank?organization_id=${organizationId}`
  );
  return rows.map(mapBackendToDTPItem);
}

/**
 * Create a new DTP item for an organization.
 */
export async function createDTPItem(
  organizationId: string,
  data: Omit<DTPItem, 'id' | 'organizationId' | 'createdAt' | 'isActive'>
): Promise<DTPItem> {
  const row = await apiClient.request<Record<string, unknown>>(
    `admin/dtp_bank?organization_id=${organizationId}`,
    {
      method: 'POST',
      body: {
        title: data.title,
        expected_dtp_text: data.expectedDTPText,
        clinical_intent: data.clinicalIntent || null,
        evaluation_criteria: data.evaluationCriteria || null,
        tags: data.tags || [],
        is_required: data.isRequired || false,
      },
    }
  );
  return mapBackendToDTPItem(row);
}

/**
 * Update an existing DTP item.
 */
export async function updateDTPItem(
  itemId: string,
  data: Partial<Pick<DTPItem, 'title' | 'expectedDTPText' | 'clinicalIntent' | 'evaluationCriteria' | 'tags' | 'isRequired' | 'isActive'>>
): Promise<DTPItem> {
  const row = await apiClient.request<Record<string, unknown>>(
    `admin/dtp_bank?dtp_id=${itemId}`,
    {
      method: 'PUT',
      body: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.expectedDTPText !== undefined && { expected_dtp_text: data.expectedDTPText }),
        ...(data.clinicalIntent !== undefined && { clinical_intent: data.clinicalIntent }),
        ...(data.evaluationCriteria !== undefined && { evaluation_criteria: data.evaluationCriteria }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.isRequired !== undefined && { is_required: data.isRequired }),
        ...(data.isActive !== undefined && { is_active: data.isActive }),
      },
    }
  );
  return mapBackendToDTPItem(row);
}

/**
 * Delete a DTP item by ID.
 */
export async function deleteDTPItem(itemId: string): Promise<void> {
  await apiClient.request(`admin/dtp_bank?dtp_id=${itemId}`, {
    method: 'DELETE',
  });
}

/**
 * Assign a DTP item to an entire simulation group (group-level assignment).
 */
export async function assignDTPToGroup(
  dtpId: string,
  simulationGroupId: string
): Promise<DTPAssignment> {
  const row = await apiClient.request<Record<string, unknown>>(
    `instructor/simulation_group_dtps?simulation_group_id=${simulationGroupId}`,
    {
      method: 'POST',
      body: { dtp_id: dtpId },
    }
  );
  return mapBackendToDTPAssignment(row);
}

/**
 * Assign a DTP item to a specific patient within a simulation group.
 */
export async function assignDTPToPatient(
  dtpId: string,
  simulationGroupId: string,
  patientId: string
): Promise<DTPAssignment> {
  const row = await apiClient.request<Record<string, unknown>>(
    `instructor/simulation_group_dtps?simulation_group_id=${simulationGroupId}`,
    {
      method: 'POST',
      body: { dtp_id: dtpId, persona_id: patientId },
    }
  );
  return mapBackendToDTPAssignment(row);
}

/**
 * Retrieve DTP assignments for a simulation group, optionally filtered by persona.
 * Returns items in sort order.
 */
export async function getAssignedDTPs(
  simulationGroupId: string,
  patientId?: string
): Promise<DTPAssignment[]> {
  let endpoint = `instructor/simulation_group_dtps?simulation_group_id=${simulationGroupId}`;
  if (patientId) {
    endpoint += `&persona_id=${patientId}`;
  }
  const rows = await apiClient.request<Record<string, unknown>[]>(endpoint);
  return rows.map(mapBackendToDTPAssignment);
}

/**
 * Reorder DTP assignments within a simulation group.
 * Accepts an array of {group_dtp_id, sort_order} pairs.
 */
export async function reorderDTPs(
  simulationGroupId: string,
  order: Array<{ group_dtp_id: string; sort_order: number }>
): Promise<DTPAssignment[]> {
  const rows = await apiClient.request<Record<string, unknown>[]>(
    `instructor/simulation_group_dtps?simulation_group_id=${simulationGroupId}`,
    {
      method: 'PUT',
      body: { order },
    }
  );
  return rows.map(mapBackendToDTPAssignment);
}
