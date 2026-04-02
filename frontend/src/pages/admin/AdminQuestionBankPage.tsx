import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import { AddQuestionDialog } from '@/components/AddQuestionDialog';
import { AddPatientSpecificQuestionBankDialog } from '@/components/AddPatientSpecificQuestionBankDialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { type QuestionBankItem } from '@/services/instructorService';
import { getQuestionBankQuestions, getOrganization, createQuestionBankQuestion, deleteQuestionBankQuestion } from '@/services/adminApiService';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';

/**
 * AdminQuestionBankPage Component
 * 
 * Organization-level question bank management for admins.
 */
function AdminQuestionBankPage() {
  const navigate = useNavigate();
  const { organizationId } = useParams<{ organizationId: string }>();
  
  // Question Bank state
  const [questionBankTab, setQuestionBankTab] = useState<'global' | 'patientSpecific'>('global');
  const [isAddQuestionDialogOpen, setIsAddQuestionDialogOpen] = useState(false);
  const [isAddPatientQuestionDialogOpen, setIsAddPatientQuestionDialogOpen] = useState(false);
  const [globalQuestionSearchQuery, setGlobalQuestionSearchQuery] = useState('');
  const [patientQuestionSearchQuery, setPatientQuestionSearchQuery] = useState('');
  
  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; questionId: string; questionTitle: string; type: 'global' | 'patient' }>({
    open: false, questionId: '', questionTitle: '', type: 'global'
  });
  
  // Pagination state
  const [globalPagination, setGlobalPagination] = useState({
    currentPage: 1,
    itemsPerPage: 5
  });
  
  const [patientPagination, setPatientPagination] = useState({
    currentPage: 1,
    itemsPerPage: 5
  });
  
  // Loading and error state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Question Bank questions - loaded from API
  const [globalBankQuestions, setGlobalBankQuestions] = useState<QuestionBankItem[]>([]);
  
  const [patientSpecificBankQuestions, setPatientSpecificBankQuestions] = useState<QuestionBankItem[]>([]);
  
  // Organization details
  const [organization, setOrganization] = useState<any>(null);
  
  // User data (will come from auth later)
  const user = { name: 'Admin', avatarUrl: undefined };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [questions, org] = await Promise.all([
          getQuestionBankQuestions(organizationId || ''),
          getOrganization(organizationId || '').catch(() => null),
        ]);
        // Split questions by tags: patient_specific vs global
        const global: QuestionBankItem[] = [];
        const patientSpecific: QuestionBankItem[] = [];
        for (const q of questions) {
          if (q.tags?.includes('patient_specific')) {
            patientSpecific.push(q);
          } else {
            global.push(q);
          }
        }
        setGlobalBankQuestions(global);
        setPatientSpecificBankQuestions(patientSpecific);
        if (org) setOrganization(org);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load question bank');
      } finally {
        setLoading(false);
      }
    };
    if (organizationId) loadData();
  }, [organizationId]);
  
  // Filter questions based on search
  const filteredGlobalQuestions = globalBankQuestions.filter(q =>
    q.title.toLowerCase().includes(globalQuestionSearchQuery.toLowerCase())
  );
  
  const filteredPatientQuestions = patientSpecificBankQuestions.filter(q =>
    q.title.toLowerCase().includes(patientQuestionSearchQuery.toLowerCase())
  );

  // Collect all unique tags from existing questions for autocomplete
  const allExistingTags = Array.from(
    new Set(
      [...globalBankQuestions, ...patientSpecificBankQuestions]
        .flatMap(q => q.tags || [])
        .filter(t => t !== 'patient_specific')
    )
  ).sort();
  
  // Pagination calculations
  const globalTotalPages = Math.ceil(filteredGlobalQuestions.length / globalPagination.itemsPerPage);
  const paginatedGlobalQuestions = filteredGlobalQuestions.slice(
    (globalPagination.currentPage - 1) * globalPagination.itemsPerPage,
    globalPagination.currentPage * globalPagination.itemsPerPage
  );
  
  const patientTotalPages = Math.ceil(filteredPatientQuestions.length / patientPagination.itemsPerPage);
  const paginatedPatientQuestions = filteredPatientQuestions.slice(
    (patientPagination.currentPage - 1) * patientPagination.itemsPerPage,
    patientPagination.currentPage * patientPagination.itemsPerPage
  );
  
  const handleSignOut = () => {
    navigate('/login');
  };
  
  const handleBackToOrganization = () => {
    navigate(`/admin/organization/${organizationId}`);
  };
  
  const handleGlobalPageChange = (newPage: number) => {
    setGlobalPagination(prev => ({ ...prev, currentPage: newPage }));
  };
  
  const handleGlobalItemsPerPageChange = (newItemsPerPage: number) => {
    setGlobalPagination({ currentPage: 1, itemsPerPage: newItemsPerPage });
  };
  
  const handlePatientPageChange = (newPage: number) => {
    setPatientPagination(prev => ({ ...prev, currentPage: newPage }));
  };
  
  const handlePatientItemsPerPageChange = (newItemsPerPage: number) => {
    setPatientPagination({ currentPage: 1, itemsPerPage: newItemsPerPage });
  };
  
  const handleSaveNewQuestion = async (question: {
    title: string;
    keyQuestion: string;
    clinicalIntent: string;
    evaluationCriteria: string;
    required: boolean;
    tags?: string[];
  }) => {
    try {
      setError(null);
      const created = await createQuestionBankQuestion(
        organizationId || '',
        {
          title: question.title,
          question_text: question.keyQuestion,
          evaluation_criteria: question.evaluationCriteria,
          is_mandatory: question.required,
          tags: question.tags || [],
        }
      );
      setGlobalBankQuestions(prev => [...prev, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create question');
    }
  };
  
  const handleSaveNewPatientQuestion = async (question: {
    title: string;
    keyQuestion: string;
    clinicalIntent: string;
    evaluationCriteria: string;
    required: boolean;
    tags?: string[];
  }) => {
    try {
      setError(null);
      const created = await createQuestionBankQuestion(
        organizationId || '',
        {
          title: question.title,
          question_text: question.keyQuestion,
          evaluation_criteria: question.evaluationCriteria,
          is_mandatory: question.required,
          tags: ['patient_specific', ...(question.tags || [])],
        }
      );
      setPatientSpecificBankQuestions(prev => [...prev, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create patient-specific question');
    }
  };
  
  const handleDeleteQuestion = async () => {
    try {
      setError(null);
      await deleteQuestionBankQuestion(deleteConfirm.questionId);
      if (deleteConfirm.type === 'global') {
        setGlobalBankQuestions(prev => prev.filter(q => q.id !== deleteConfirm.questionId));
      } else {
        setPatientSpecificBankQuestions(prev => prev.filter(q => q.id !== deleteConfirm.questionId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete question');
    }
    setDeleteConfirm({ open: false, questionId: '', questionTitle: '', type: 'global' });
  };
  
  return (
    <PageContainer>
      <DashboardHeader
        title="Admin Dashboard"
        subtitle="Question Bank Management"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
        showStudentViewButton={false}
        onStudentView={() => navigate('/student')}
      />
      
      {loading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>Loading question bank...</p>
        </div>
      )}

      {error && (
        <div className="mx-8 mt-4 p-4 rounded-md" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
          <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
        </div>
      )}

      {!loading && (
      <main className="flex-1 overflow-y-auto">
        <div className="h-full flex flex-col">
          <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: UI_COLORS.border.default }}>
            {/* Back button */}
            <div className="mb-6">
              <button
                onClick={handleBackToOrganization}
                className="font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 transition-colors"
                style={{ color: UI_COLORS.text.body }}
                onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
                onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to {organization?.name || 'Organization'}
              </button>
            </div>
            
            <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>
              Question Bank
            </h2>
            
            {/* Tab Switcher */}
            <div className="flex gap-2 border-b" style={{ borderColor: UI_COLORS.border.default }}>
              <button
                onClick={() => setQuestionBankTab('global')}
                className="px-6 py-3 font-medium transition-colors border-b-2"
                style={{
                  color: questionBankTab === 'global' ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body,
                  borderColor: questionBankTab === 'global' ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent',
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                }}
              >
                Global Questions
              </button>
              <button
                onClick={() => setQuestionBankTab('patientSpecific')}
                className="px-6 py-3 font-medium transition-colors border-b-2"
                style={{
                  color: questionBankTab === 'patientSpecific' ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body,
                  borderColor: questionBankTab === 'patientSpecific' ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent',
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                }}
              >
                Patient-Specific Questions
              </button>
            </div>
          </div>

          {/* Question List */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="space-y-3">
              {questionBankTab === 'global' && (
                <>
                  <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                    Manage global key questions for this organization.
                  </p>
                  
                  {/* Search Bar */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                    <Input
                      type="text"
                      placeholder="Search global questions..."
                      value={globalQuestionSearchQuery}
                      onChange={(e) => setGlobalQuestionSearchQuery(e.target.value)}
                      className="pl-10"
                      style={{
                        borderColor: UI_COLORS.border.default,
                      }}
                    />
                  </div>
                  
                  {/* Add New Global Question Button */}
                  <Button
                    onClick={() => setIsAddQuestionDialogOpen(true)}
                    className="w-full justify-start gap-2 py-3 h-auto font-medium transition-colors mb-4"
                    style={{ 
                      backgroundColor: UI_COLORS.button.primary, 
                      color: UI_COLORS.button.text 
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                  >
                    <Plus className="w-5 h-5" />
                    Add New Global Question
                  </Button>
                  
                  {/* Pagination Info */}
                  {filteredGlobalQuestions.length > 0 && (
                    <div className="flex items-center justify-between mb-3 text-sm" style={{ color: UI_COLORS.text.muted }}>
                      <span>
                        Showing {((globalPagination.currentPage - 1) * globalPagination.itemsPerPage) + 1}-
                        {Math.min(globalPagination.currentPage * globalPagination.itemsPerPage, filteredGlobalQuestions.length)} of {filteredGlobalQuestions.length} questions
                      </span>
                    </div>
                  )}
                  
                  {/* Global questions from question bank */}
                  <Accordion type="single" collapsible className="space-y-2">
                    {paginatedGlobalQuestions.map((question) => (
                      <AccordionItem 
                        key={question.id} 
                        value={question.id}
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
                              {question.title}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                                {question.isMandatory ? 'Required' : 'Optional'}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm({ open: true, questionId: question.id, questionTitle: question.title, type: 'global' });
                                }}
                                className="p-1 rounded transition-colors hover:bg-red-50"
                                style={{ color: UI_COLORS.text.muted }}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.muted}
                                aria-label={`Delete question: ${question.title}`}
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
                              <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Title</label>
                              <p className="text-sm" style={{ color: UI_COLORS.text.body }}>{question.title || '—'}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Key Question</label>
                              <p className="text-sm" style={{ color: question.questionText ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.questionText || '—'}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Clinical Intent</label>
                              <p className="text-sm" style={{ color: question.clinicalIntent ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.clinicalIntent || '—'}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Evaluation Criteria</label>
                              <p className="text-sm whitespace-pre-line" style={{ color: question.evaluationCriteria ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.evaluationCriteria || '—'}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Requirement</label>
                              <span 
                                className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ 
                                  backgroundColor: question.isMandatory ? '#dcfce7' : '#f3f4f6',
                                  color: question.isMandatory ? '#166534' : '#6b7280'
                                }}
                              >
                                {question.isMandatory ? 'Required' : 'Optional'}
                              </span>
                            </div>
                            {question.tags && question.tags.length > 0 && (
                            <div>
                              <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Tags</label>
                              <div className="flex flex-wrap gap-1">
                                {question.tags.map(tag => (
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

                  {/* Pagination Controls */}
                  {globalTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: UI_COLORS.border.default }}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm" style={{ color: UI_COLORS.text.body }}>Items per page:</span>
                        <select
                          value={globalPagination.itemsPerPage}
                          onChange={(e) => handleGlobalItemsPerPageChange(Number(e.target.value))}
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
                          onClick={() => handleGlobalPageChange(globalPagination.currentPage - 1)}
                          disabled={globalPagination.currentPage === 1}
                          variant="outline"
                          className="px-3 py-1 text-sm"
                          style={{
                            opacity: globalPagination.currentPage === 1 ? 0.5 : 1,
                            cursor: globalPagination.currentPage === 1 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Previous
                        </Button>
                        
                        <span className="text-sm px-3" style={{ color: UI_COLORS.text.body }}>
                          Page {globalPagination.currentPage} of {globalTotalPages}
                        </span>
                        
                        <Button
                          onClick={() => handleGlobalPageChange(globalPagination.currentPage + 1)}
                          disabled={globalPagination.currentPage === globalTotalPages}
                          variant="outline"
                          className="px-3 py-1 text-sm"
                          style={{
                            opacity: globalPagination.currentPage === globalTotalPages ? 0.5 : 1,
                            cursor: globalPagination.currentPage === globalTotalPages ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {questionBankTab === 'patientSpecific' && (
                <>
                  <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                    Manage patient-specific questions for this organization.
                  </p>
                  
                  {/* Search Bar */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                    <Input
                      type="text"
                      placeholder="Search patient-specific questions..."
                      value={patientQuestionSearchQuery}
                      onChange={(e) => setPatientQuestionSearchQuery(e.target.value)}
                      className="pl-10"
                      style={{
                        borderColor: UI_COLORS.border.default,
                      }}
                    />
                  </div>
                  
                  {/* Add New Patient-Specific Question Button */}
                  <Button
                    onClick={() => setIsAddPatientQuestionDialogOpen(true)}
                    className="w-full justify-start gap-2 py-3 h-auto font-medium transition-colors mb-4"
                    style={{ 
                      backgroundColor: UI_COLORS.button.primary, 
                      color: UI_COLORS.button.text 
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                  >
                    <Plus className="w-5 h-5" />
                    Add New Patient-Specific Question
                  </Button>
                  
                  {/* Pagination Info */}
                  {filteredPatientQuestions.length > 0 && (
                    <div className="flex items-center justify-between mb-3 text-sm" style={{ color: UI_COLORS.text.muted }}>
                      <span>
                        Showing {((patientPagination.currentPage - 1) * patientPagination.itemsPerPage) + 1}-
                        {Math.min(patientPagination.currentPage * patientPagination.itemsPerPage, filteredPatientQuestions.length)} of {filteredPatientQuestions.length} questions
                      </span>
                    </div>
                  )}
                  
                  {/* Patient-specific questions from question bank */}
                  <Accordion type="single" collapsible className="space-y-2">
                    {paginatedPatientQuestions.map((question) => (
                      <AccordionItem 
                        key={question.id} 
                        value={question.id}
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
                              {question.title}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                                {question.isMandatory ? 'Required' : 'Optional'}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm({ open: true, questionId: question.id, questionTitle: question.title, type: 'patient' });
                                }}
                                className="p-1 rounded transition-colors hover:bg-red-50"
                                style={{ color: UI_COLORS.text.muted }}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.muted}
                                aria-label={`Delete question: ${question.title}`}
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
                              <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Title</label>
                              <p className="text-sm" style={{ color: UI_COLORS.text.body }}>{question.title || '—'}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Key Question</label>
                              <p className="text-sm" style={{ color: question.questionText ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.questionText || '—'}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Clinical Intent</label>
                              <p className="text-sm" style={{ color: question.clinicalIntent ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.clinicalIntent || '—'}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Evaluation Criteria</label>
                              <p className="text-sm whitespace-pre-line" style={{ color: question.evaluationCriteria ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.evaluationCriteria || '—'}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Requirement</label>
                              <span 
                                className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ 
                                  backgroundColor: question.isMandatory ? '#dcfce7' : '#f3f4f6',
                                  color: question.isMandatory ? '#166534' : '#6b7280'
                                }}
                              >
                                {question.isMandatory ? 'Required' : 'Optional'}
                              </span>
                            </div>
                            {question.tags && question.tags.filter(t => t !== 'patient_specific').length > 0 && (
                            <div>
                              <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Tags</label>
                              <div className="flex flex-wrap gap-1">
                                {question.tags.filter(t => t !== 'patient_specific').map(tag => (
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

                  {/* Pagination Controls */}
                  {patientTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: UI_COLORS.border.default }}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm" style={{ color: UI_COLORS.text.body }}>Items per page:</span>
                        <select
                          value={patientPagination.itemsPerPage}
                          onChange={(e) => handlePatientItemsPerPageChange(Number(e.target.value))}
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
                          onClick={() => handlePatientPageChange(patientPagination.currentPage - 1)}
                          disabled={patientPagination.currentPage === 1}
                          variant="outline"
                          className="px-3 py-1 text-sm"
                          style={{
                            opacity: patientPagination.currentPage === 1 ? 0.5 : 1,
                            cursor: patientPagination.currentPage === 1 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Previous
                        </Button>
                        
                        <span className="text-sm px-3" style={{ color: UI_COLORS.text.body }}>
                          Page {patientPagination.currentPage} of {patientTotalPages}
                        </span>
                        
                        <Button
                          onClick={() => handlePatientPageChange(patientPagination.currentPage + 1)}
                          disabled={patientPagination.currentPage === patientTotalPages}
                          variant="outline"
                          className="px-3 py-1 text-sm"
                          style={{
                            opacity: patientPagination.currentPage === patientTotalPages ? 0.5 : 1,
                            cursor: patientPagination.currentPage === patientTotalPages ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      )}
      
      <AddQuestionDialog
        open={isAddQuestionDialogOpen}
        onOpenChange={setIsAddQuestionDialogOpen}
        questionType="global"
        existingTags={allExistingTags}
        onSave={handleSaveNewQuestion}
      />
      
      <AddPatientSpecificQuestionBankDialog
        open={isAddPatientQuestionDialogOpen}
        onOpenChange={setIsAddPatientQuestionDialogOpen}
        onSave={handleSaveNewPatientQuestion}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: UI_COLORS.text.heading }}>
              Delete Question
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
              Are you sure you want to delete "<span className="font-medium">{deleteConfirm.questionTitle}</span>"? This will remove it from all simulation groups currently using this question.
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
              onClick={handleDeleteQuestion}
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

export default AdminQuestionBankPage;
