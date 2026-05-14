import { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import { listDTPItems } from '@/services/dtpBankService';
import type { DTPItem } from '@/services/dtpBankService';
import { filterByTitle, paginate } from '@/lib/bankUtils';

export interface DTPBankSectionProps {
  groupId: string;
  organizationId: string;
  patients: Array<{ id?: string; patient_id?: string; name?: string; patient_name?: string }>;
  /** Set of DTP item IDs currently assigned to the group/patient */
  includedDTPIds: Set<string>;
  /** Called when a checkbox is toggled */
  onToggleDTPInclusion: (dtpItemId: string, dtpItem: DTPItem, isChecked: boolean) => void;
  /** Currently selected patient for patient-specific assignment (null = global) */
  selectedPatientId: string | null;
  onPatientSelect: (patientId: string | null) => void;
}

/**
 * DTPBankSection component
 *
 * Renders the DTP Bank assignment UI within a simulation group page.
 * Shows all available DTP items from the org-level bank with checkboxes
 * to assign/unassign them to the group or a specific patient.
 * Each item can be expanded to preview its full content.
 */
export function DTPBankSection({
  groupId: _groupId,
  organizationId,
  patients,
  includedDTPIds,
  onToggleDTPInclusion,
  selectedPatientId,
  onPatientSelect,
}: DTPBankSectionProps) {
  const [dtpItems, setDtpItems] = useState<DTPItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    setLoading(true);
    listDTPItems(organizationId).then((items) => {
      setDtpItems(items);
      setLoading(false);
    });
  }, [organizationId]);

  const filteredItems = filterByTitle(dtpItems, searchQuery);
  const { items: paginatedItems, totalPages, currentPage: page } = paginate(filteredItems, currentPage, pageSize);

  const toggleExpand = (itemId: string) => {
    setExpandedItemId(prev => prev === itemId ? null : itemId);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: UI_COLORS.border.default }}>
        <h2 className="text-2xl font-bold mb-2" style={{ color: UI_COLORS.text.heading }}>
          DTP Bank Assignment
        </h2>
        <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
          Assign Drug Therapy Problem items from the organization bank to this simulation group or specific patients.
        </p>

        {/* Patient selector */}
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>
            Assign to:
          </label>
          <select
            value={selectedPatientId || 'global'}
            onChange={(e) => onPatientSelect(e.target.value === 'global' ? null : e.target.value)}
            className="px-3 py-1.5 rounded border text-sm"
            style={{
              borderColor: UI_COLORS.border.default,
              backgroundColor: UI_COLORS.background.white,
              color: UI_COLORS.text.heading,
            }}
          >
            <option value="global">Entire Group (Global)</option>
            {patients.map((p) => {
              const id = p.id || p.patient_id || '';
              const name = p.name || p.patient_name || 'Unknown Patient';
              return (
                <option key={id} value={id}>
                  {name}
                </option>
              );
            })}
          </select>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
          <Input
            type="text"
            placeholder="Search DTP items..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
            style={{ borderColor: UI_COLORS.border.default }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>Loading DTP items...</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>
            {searchQuery ? 'No DTP items match your search.' : 'No DTP items available. Add items in the DTP Bank page first.'}
          </p>
        ) : (
          <div className="space-y-2">
            {paginatedItems.map((item) => (
              <DTPCardItem
                key={item.id}
                item={item}
                isChecked={includedDTPIds.has(item.id)}
                isExpanded={expandedItemId === item.id}
                onToggle={(checked) => onToggleDTPInclusion(item.id, item, checked)}
                onToggleExpand={() => toggleExpand(item.id)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t" style={{ borderColor: UI_COLORS.border.default }}>
            <button
              onClick={() => setCurrentPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm rounded border disabled:opacity-50"
              style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading }}
            >
              Previous
            </button>
            <span className="text-sm px-3" style={{ color: UI_COLORS.text.body }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm rounded border disabled:opacity-50"
              style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DTPCardItem({
  item,
  isChecked,
  isExpanded,
  onToggle,
  onToggleExpand,
}: {
  item: DTPItem;
  isChecked: boolean;
  isExpanded: boolean;
  onToggle: (checked: boolean) => void;
  onToggleExpand: () => void;
}) {
  return (
    <div
      className="rounded-lg border transition-colors"
      style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 flex-1 min-w-0 mr-3">
          <button
            onClick={onToggleExpand}
            className="p-0.5 rounded transition-colors hover:bg-gray-100 flex-shrink-0"
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
            ) : (
              <ChevronRight className="w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
            )}
          </button>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggleExpand}>
            <span className="text-sm font-medium block" style={{ color: UI_COLORS.text.heading }}>
              {item.title}
            </span>
            {!isExpanded && (
              <span className="text-xs block mt-0.5" style={{ color: UI_COLORS.text.muted }}>
                {item.expectedDTPText.length > 100 ? item.expectedDTPText.slice(0, 100) + '...' : item.expectedDTPText}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span
            className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: item.isRequired ? '#dcfce7' : '#f3f4f6',
              color: item.isRequired ? '#166534' : '#6b7280',
            }}
          >
            {item.isRequired ? 'Required' : 'Optional'}
          </span>
          <label className="flex items-center gap-2 cursor-pointer">
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
      </div>

      {/* Expanded preview */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 ml-7 border-t" style={{ borderColor: UI_COLORS.border.default }}>
          <div className="space-y-3 pt-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Expected DTP Text</label>
              <p className="text-sm whitespace-pre-line" style={{ color: UI_COLORS.text.body }}>
                {item.expectedDTPText || '—'}
              </p>
            </div>
            {item.clinicalIntent && (
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Clinical Intent</label>
                <p className="text-sm whitespace-pre-line" style={{ color: UI_COLORS.text.body }}>
                  {item.clinicalIntent}
                </p>
              </div>
            )}
            {item.evaluationCriteria && (
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Evaluation Criteria</label>
                <p className="text-sm whitespace-pre-line" style={{ color: UI_COLORS.text.body }}>
                  {item.evaluationCriteria}
                </p>
              </div>
            )}
            {item.tags.length > 0 && (
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Tags</label>
                <div className="flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DTPBankSection;
