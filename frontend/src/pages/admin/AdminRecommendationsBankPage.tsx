import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import { AddRecommendationDialog } from '@/components/AddRecommendationDialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { listRecommendationItems, deleteRecommendationItem } from '@/services/recommendationsBankService';
import type { RecommendationItem } from '@/services/recommendationsBankService';
import { filterByTitle, paginate } from '@/lib/bankUtils';
import LoadingIndicator from '@/components/LoadingIndicator';
import { UI_COLORS } from '@/lib/colors';

/**
 * AdminRecommendationsBankPage Component
 *
 * Organization-level Recommendations bank management for admins.
 * Follows the same pattern as AdminDTPBankPage.
 */
function AdminRecommendationsBankPage() {
  const navigate = useNavigate();
  const { organizationId } = useParams<{ organizationId: string }>();

  // Recommendation items state
  const [recommendationItems, setRecommendationItems] = useState<RecommendationItem[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; itemId: string; itemTitle: string }>({
    open: false, itemId: '', itemTitle: ''
  });

  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 5
  });

  // Loading and error state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User data (will come from auth later)
  const user = { name: 'Admin', avatarUrl: undefined };

  // Load data on mount
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await listRecommendationItems(organizationId || '');
      setRecommendationItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Recommendations bank');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) loadData();
  }, [organizationId]);

  // Filter items based on search using shared utility
  const filteredItems = filterByTitle(recommendationItems, searchQuery);

  // Pagination using shared utility
  const { items: paginatedItems, totalPages, currentPage } = paginate(
    filteredItems,
    pagination.currentPage,
    pagination.itemsPerPage
  );

  const handleSignOut = () => {
    navigate('/login');
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setPagination({ currentPage: 1, itemsPerPage: newItemsPerPage });
  };

  const handleDeleteRecommendation = async () => {
    try {
      setError(null);
      await deleteRecommendationItem(deleteConfirm.itemId);
      setRecommendationItems(prev => prev.filter(item => item.id !== deleteConfirm.itemId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete recommendation item');
    }
    setDeleteConfirm({ open: false, itemId: '', itemTitle: '' });
  };

  const handleSaveNewRecommendation = () => {
    // Reload data after successful creation
    loadData();
  };

  return (
    <PageContainer>
      <DashboardHeader
        title="Admin Dashboard"
        subtitle="Recommendations Bank Management"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
        showStudentViewButton={false}
        onStudentView={() => navigate('/student')}
      />

      {loading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <LoadingIndicator size="md" message="Loading recommendations bank..." />
        </div>
      )}

      {error && (
        <div className="mx-8 mt-4 p-4 rounded-md" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
            <Button
              onClick={loadData}
              variant="outline"
              className="text-sm"
              style={{ borderColor: '#fecaca', color: '#dc2626' }}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {!loading && (
        <main className="flex-1 overflow-y-auto">
          <div className="h-full flex flex-col">
            <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: UI_COLORS.border.default }}>
              {/* Back button */}
              <div className="mb-6">
                <Link
                  to={`/admin/organization/${organizationId}`}
                  className="font-normal text-sm flex items-center gap-1 no-underline transition-colors"
                  style={{ color: UI_COLORS.text.body }}
                  onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
                  onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Organization
                </Link>
              </div>

              <h2 className="text-2xl font-bold mb-2" style={{ color: UI_COLORS.text.heading }}>
                Recommendations Bank
              </h2>
              <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                Manage Recommendation & Rationale items for this organization.
              </p>
            </div>

            {/* Recommendations List */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="space-y-3">
                {/* Search Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                  <Input
                    type="text"
                    placeholder="Search recommendation items..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPagination(prev => ({ ...prev, currentPage: 1 }));
                    }}
                    className="pl-10"
                    style={{
                      borderColor: UI_COLORS.border.default,
                    }}
                  />
                </div>

                {/* Add New Recommendation Button */}
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="w-full justify-start gap-2 py-3 h-auto font-medium transition-colors mb-4"
                  style={{
                    backgroundColor: UI_COLORS.button.primary,
                    color: UI_COLORS.button.text
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                >
                  <Plus className="w-5 h-5" />
                  Add New Recommendation
                </Button>

                {/* Pagination Info */}
                {filteredItems.length > 0 && (
                  <div className="flex items-center justify-between mb-3 text-sm" style={{ color: UI_COLORS.text.muted }}>
                    <span>
                      Showing {((currentPage - 1) * pagination.itemsPerPage) + 1}-
                      {Math.min(currentPage * pagination.itemsPerPage, filteredItems.length)} of {filteredItems.length} items
                    </span>
                  </div>
                )}

                {/* Recommendation Items Accordion */}
                <Accordion type="single" collapsible className="space-y-2">
                  {paginatedItems.map((item) => (
                    <AccordionItem
                      key={item.id}
                      value={item.id}
                      style={{
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: UI_COLORS.border.default,
                        borderRadius: '0.5rem',
                        overflow: 'hidden'
                      }}
                    >
                      <AccordionTrigger
                        className="px-4 hover:no-underline"
                        style={{
                          backgroundColor: UI_COLORS.background.white,
                          color: UI_COLORS.text.heading
                        }}
                      >
                        <div className="flex items-center justify-between w-full pr-4">
                          <span className="font-medium text-sm">
                            {item.title}
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({ open: true, itemId: item.id, itemTitle: item.title });
                              }}
                              className="p-1 rounded transition-colors hover:bg-red-50"
                              style={{ color: UI_COLORS.text.muted }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.muted}
                              aria-label={`Delete recommendation item: ${item.title}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent
                        className="px-4 pb-4"
                        style={{ backgroundColor: UI_COLORS.background.white }}
                      >
                        <div className="space-y-3 pt-3">
                          <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Recommendation Text</label>
                            <p className="text-sm whitespace-pre-line" style={{ color: item.recommendationText ? UI_COLORS.text.body : UI_COLORS.text.muted }}>
                              {item.recommendationText || '—'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Evaluation Criteria</label>
                            <p className="text-sm whitespace-pre-line" style={{ color: item.evaluationCriteria ? UI_COLORS.text.body : UI_COLORS.text.muted }}>
                              {item.evaluationCriteria || '—'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Rationale</label>
                            <p className="text-sm whitespace-pre-line" style={{ color: item.rationale ? UI_COLORS.text.body : UI_COLORS.text.muted }}>
                              {item.rationale || '—'}
                            </p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {/* Empty state */}
                {filteredItems.length === 0 && !error && (
                  <div className="text-center py-8">
                    <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>
                      {searchQuery ? 'No recommendation items match your search.' : 'No recommendation items yet. Add your first one above.'}
                    </p>
                  </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: UI_COLORS.border.default }}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{ color: UI_COLORS.text.body }}>Items per page:</span>
                      <select
                        value={pagination.itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                        className="px-3 py-1 rounded border text-sm"
                        style={{
                          borderColor: UI_COLORS.border.default,
                          backgroundColor: UI_COLORS.background.white,
                          color: UI_COLORS.text.heading,
                        }}
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handlePageChange(currentPage - 1)}
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
                        onClick={() => handlePageChange(currentPage + 1)}
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

      {/* Add Recommendation Dialog */}
      <AddRecommendationDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        organizationId={organizationId || ''}
        onSave={handleSaveNewRecommendation}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: UI_COLORS.text.heading }}>
              Delete Recommendation Item
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
              Are you sure you want to delete "<span className="font-medium">{deleteConfirm.itemTitle}</span>"? This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: UI_COLORS.border.default }}>
            <Button
              onClick={() => setDeleteConfirm(prev => ({ ...prev, open: false }))}
              variant="outline"
              style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteRecommendation}
              style={{ backgroundColor: '#ef4444', color: '#fff' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

export default AdminRecommendationsBankPage;
