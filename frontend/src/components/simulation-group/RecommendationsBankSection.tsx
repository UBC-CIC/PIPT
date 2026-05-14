import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import { listRecommendationItems } from '@/services/recommendationsBankService';
import type { RecommendationItem } from '@/services/recommendationsBankService';
import { filterByTitle, paginate } from '@/lib/bankUtils';

export interface RecommendationsBankSectionProps {
  groupId: string;
  patients: Array<{ id?: string; patient_id?: string; name?: string; patient_name?: string }>;
  /** Set of Recommendation item IDs currently assigned to the group/patient */
  includedRecommendationIds: Set<string>;
  /** Called when a checkbox is toggled */
  onToggleRecommendationInclusion: (itemId: string, item: RecommendationItem, isChecked: boolean) => void;
  /** Currently selected patient for patient-specific assignment (null = global) */
  selectedPatientId: string | null;
  onPatientSelect: (patientId: string | null) => void;
}

/**
 * RecommendationsBankSection component
 *
 * Renders the Recommendations Bank assignment UI within a simulation group page.
 * Shows all available Recommendation items from the org-level bank with checkboxes
 * to assign/unassign them to the group or a specific patient.
 */
export function RecommendationsBankSection({
  groupId: _groupId,
  patients,
  includedRecommendationIds,
  onToggleRecommendationInclusion,
  selectedPatientId,
  onPatientSelect,
}: RecommendationsBankSectionProps) {
  const [recommendationItems, setRecommendationItems] = useState<RecommendationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 10;

  useEffect(() => {
    setLoading(true);
    listRecommendationItems('org-001').then((items) => {
      setRecommendationItems(items);
      setLoading(false);
    });
  }, []);

  const filteredItems = filterByTitle(recommendationItems, searchQuery);
  const { items: paginatedItems, totalPages, currentPage: page } = paginate(filteredItems, currentPage, pageSize);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: UI_COLORS.border.default }}>
        <h2 className="text-2xl font-bold mb-2" style={{ color: UI_COLORS.text.heading }}>
          Recommendations Bank Assignment
        </h2>
        <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
          Assign Recommendation & Rationale items from the organization bank to this simulation group or specific patients.
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
            placeholder="Search recommendation items..."
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
          <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>Loading recommendation items...</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>
            {searchQuery ? 'No recommendation items match your search.' : 'No recommendation items available. Add items in the Recommendations Bank page first.'}
          </p>
        ) : (
          <div className="space-y-2">
            {paginatedItems.map((item) => (
              <RecommendationCardItem
                key={item.id}
                item={item}
                isChecked={includedRecommendationIds.has(item.id)}
                onToggle={(checked) => onToggleRecommendationInclusion(item.id, item, checked)}
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
    <div
      className="flex items-center justify-between p-4 rounded-lg border transition-colors"
      style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
    >
      <div className="flex-1 min-w-0 mr-3">
        <span className="text-sm font-medium block" style={{ color: UI_COLORS.text.heading }}>
          {item.title}
        </span>
        <span className="text-xs block mt-0.5" style={{ color: UI_COLORS.text.muted }}>
          {item.recommendationText.length > 120 ? item.recommendationText.slice(0, 120) + '...' : item.recommendationText}
        </span>
        {item.rationale && (
          <span className="text-xs block mt-0.5 italic" style={{ color: UI_COLORS.text.muted }}>
            Rationale: {item.rationale.length > 80 ? item.rationale.slice(0, 80) + '...' : item.rationale}
          </span>
        )}
      </div>
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
  );
}

export default RecommendationsBankSection;
