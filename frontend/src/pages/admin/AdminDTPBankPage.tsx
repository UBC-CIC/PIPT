import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import { AddDTPDialog } from '@/components/AddDTPDialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { listDTPItems, deleteDTPItem } from '@/services/dtpBankService';
import type { DTPItem } from '@/services/dtpBankService';
import { filterByTitle, paginate } from '@/lib/bankUtils';
import LoadingIndicator from '@/components/LoadingIndicator';
import { UI_COLORS } from '@/lib/colors';

/**
 * AdminDTPBankPage Component
 *
 * Organization-level DTP (Drug Therapy Problem) bank management for admins.
 * Follows the same pattern as AdminQuestionBankPage.
 */
function AdminDTPBankPage() {
  const navigate = useNavigate();
  const { organizationId } = useParams<{ organizationId: string }>();

  // DTP items state
  const [dtpItems, setDtpItems] = useState<DTPItem[]>([]);
  const [isAddDTPDialogOpen, setIsAddDTPDialogOpen] = useState(false);
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
      const items = await listDTPItems(organizationId || '');
      setDtpItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load DTP bank');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) loadData();
  }, [organizationId]);

  // Filter items based on search using shared utility
  const filteredItems = filterByTitle(dtpItems, searchQuery);

  // Pagination using shared utility
  const { items: paginatedItems, totalPages, currentPage } = paginate(
    filteredItems,
    pagination.currentPage,
    pagination.itemsPerPage
  );

  // Collect all unique tags from existing items for autocomplete
  const allExistingTags = Array.from(
    new Set(dtpItems.flatMap(item => item.tags || []))
  ).sort();

  const handleSignOut = () => {
    navigate('/login');
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setPagination({ currentPage: 1, itemsPerPage: newItemsPerPage });
  };

  const handleDeleteDTP = async () => {
    try {
      setError(null);
      await deleteDTPItem(deleteConfirm.itemId);
      setDtpItems(prev => prev.filter(item => item.id !== deleteConfirm.itemId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete DTP item');
    }
    setDeleteConfirm({ open: false, itemId: '', itemTitle: '' });
  };

  const handleSaveNewDTP = () => {
    // Reload data after successful creation
    loadData();
  };

  return (
    <PageContainer>
      <DashboardHeader
        title="Admin Dashboard"
        subtitle="DTP Bank Management"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
        showStudentViewButton={false}
        onStudentView={() => navigate('/student')}
      />

      {loading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <LoadingIndicator size="md" message="Loading DTP bank..." />
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
                DTP Bank
              </h2>
              <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                Manage Drug Therapy Problem items for this organization.
              </p>
            </div>

            {/* DTP List */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="space-y-3">
                {/* Search Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                  <Input
                    type="text"
                    placeholder="Search DTP items..."
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

                {/* Add New DTP Button */}
                <Button
                  onClick={() => setIsAddDTPDialogOpen(true)}
                  className="w-full justify-start gap-2 py-3 h-auto font-medium transition-colors mb-4"
                  style={{
                    backgroundColor: UI_COLORS.button.primary,
                    color: UI_COLORS.button.text
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                >
                  <Plus className="w-5 h-5" />
                  Add New DTP
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

                {/* DTP Items Accordion */}
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
                            <span
                              className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: item.isRequired ? '#dcfce7' : '#f3f4f6',
                                color: item.isRequired ? '#166534' : '#6b7280'
                              }}
                            >
                              {item.isRequired ? 'Required' : 'Optional'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({ open: true, itemId: item.id, itemTitle: item.title });
                              }}
                              className="p-1 rounded transition-colors hover:bg-red-50"
                              style={{ color: UI_COLORS.text.muted }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.muted}
                              aria-label={`Delete DTP item: ${item.title}`}
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
                            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Expected DTP Text</label>
                            <p className="text-sm whitespace-pre-line" style={{ color: item.expectedDTPText ? UI_COLORS.text.body : UI_COLORS.text.muted }}>
                              {item.expectedDTPText || '—'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Clinical Intent</label>
                            <p className="text-sm whitespace-pre-line" style={{ color: item.clinicalIntent ? UI_COLORS.text.body : UI_COLORS.text.muted }}>
                              {item.clinicalIntent || '—'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Evaluation Criteria</label>
                            <p className="text-sm whitespace-pre-line" style={{ color: item.evaluationCriteria ? UI_COLORS.text.body : UI_COLORS.text.muted }}>
                              {item.evaluationCriteria || '—'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Requirement</label>
                            <span
                              className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: item.isRequired ? '#dcfce7' : '#f3f4f6',
                                color: item.isRequired ? '#166534' : '#6b7280'
                              }}
                            >
                              {item.isRequired ? 'Required' : 'Optional'}
                            </span>
                          </div>
                          {item.tags && item.tags.length > 0 && (
                            <div>
                              <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Tags</label>
                              <div className="flex flex-wrap gap-1">
                                {item.tags.map(tag => (
                                  <span
                                    key={tag}
                                    className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                                    style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {/* Empty state */}
                {filteredItems.length === 0 && !error && (
                  <div className="text-center py-8">
                    <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>
                      {searchQuery ? 'No DTP items match your search.' : 'No DTP items yet. Add your first one above.'}
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

      {/* Add DTP Dialog */}
      <AddDTPDialog
        open={isAddDTPDialogOpen}
        onOpenChange={setIsAddDTPDialogOpen}
        organizationId={organizationId || ''}
        existingTags={allExistingTags}
        onSave={handleSaveNewDTP}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: UI_COLORS.text.heading }}>
              Delete DTP Item
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
              onClick={handleDeleteDTP}
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

export default AdminDTPBankPage;
