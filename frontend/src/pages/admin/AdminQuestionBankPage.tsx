import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import { AddQuestionDialog } from '@/components/AddQuestionDialog';
import { AddPatientSpecificQuestionDialog } from '@/components/AddPatientSpecificQuestionDialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { mockAdminDataService } from '@/services/adminService';
import { mockInstructorDataService, type QuestionBankItem } from '@/services/instructorService';
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
  
  // Pagination state
  const [globalPagination, setGlobalPagination] = useState({
    currentPage: 1,
    itemsPerPage: 5
  });
  
  const [patientPagination, setPatientPagination] = useState({
    currentPage: 1,
    itemsPerPage: 5
  });
  
  // Question Bank questions - loaded from service
  const [globalBankQuestions, setGlobalBankQuestions] = useState(() => 
    mockInstructorDataService.getGlobalQuestionBank()
  );
  
  const [patientSpecificBankQuestions, setPatientSpecificBankQuestions] = useState(() => 
    mockInstructorDataService.getPatientSpecificQuestionBank()
  );
  
  // Get organization details
  const organizations = mockAdminDataService.getOrganizations();
  const organization = organizations.find(org => org.id === organizationId);
  
  // Load user data
  let user = mockAdminDataService.getCurrentUser();
  if (!user || !user.name) {
    user = { name: 'Admin', avatarUrl: undefined };
  }
  
  // Filter questions based on search
  const filteredGlobalQuestions = globalBankQuestions.filter(q =>
    q.title.toLowerCase().includes(globalQuestionSearchQuery.toLowerCase())
  );
  
  const filteredPatientQuestions = patientSpecificBankQuestions.filter(q =>
    q.title.toLowerCase().includes(patientQuestionSearchQuery.toLowerCase())
  );
  
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
  
  const handleSaveNewQuestion = (question: {
    title: string;
    keyQuestion: string;
    clinicalIntent: string;
    evaluationCriteria: string;
    required: boolean;
  }) => {
    const newQuestionId = `bank-global-${Date.now()}`;
    const newBankQuestion: QuestionBankItem = { 
      id: newQuestionId, 
      title: question.title,
      questionText: question.keyQuestion,
      clinicalIntent: question.clinicalIntent,
      evaluationCriteria: question.evaluationCriteria,
      isMandatory: question.required,
      isActive: true,
      usedBySimulationGroups: [],
      usedByPatients: undefined
    };
    
    mockInstructorDataService.addToGlobalQuestionBank(newBankQuestion);
    setGlobalBankQuestions(mockInstructorDataService.getGlobalQuestionBank());
  };
  
  const handleSaveNewPatientQuestion = (question: {
    patientId: string;
    title: string;
    keyQuestion: string;
    clinicalIntent: string;
    evaluationCriteria: string;
    required: boolean;
  }) => {
    const newQuestionId = `bank-patient-${Date.now()}`;
    const newBankQuestion: QuestionBankItem = { 
      id: newQuestionId, 
      title: question.title,
      questionText: question.keyQuestion,
      clinicalIntent: question.clinicalIntent,
      evaluationCriteria: question.evaluationCriteria,
      isMandatory: question.required,
      isActive: true,
      usedBySimulationGroups: [],
      usedByPatients: []
    };
    
    mockInstructorDataService.addToPatientSpecificQuestionBank(newBankQuestion);
    setPatientSpecificBankQuestions(mockInstructorDataService.getPatientSpecificQuestionBank());
  };
  
  return (
    <PageContainer>
      <DashboardHeader
        title="Admin Dashboard"
        subtitle="Question Bank Management"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
        showStudentViewButton={true}
        onStudentView={() => navigate('/student')}
      />
      
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
                    Select which global questions should be included in this simulation group's rubric.
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
                              <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={false}
                                  onChange={() => {}}
                                  className="w-5 h-5 rounded cursor-pointer"
                                  style={{
                                    accentColor: SIMULATION_GROUP_COLOR_PALETTE[2],
                                  }}
                                />
                                <span className="text-sm" style={{ color: UI_COLORS.text.body }}>
                                  Include
                                </span>
                              </label>
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
                              <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={false}
                                  onChange={() => {}}
                                  className="w-5 h-5 rounded cursor-pointer"
                                  style={{
                                    accentColor: SIMULATION_GROUP_COLOR_PALETTE[2],
                                  }}
                                />
                                <span className="text-sm" style={{ color: UI_COLORS.text.body }}>
                                  Include
                                </span>
                              </label>
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
      
      <AddQuestionDialog
        open={isAddQuestionDialogOpen}
        onOpenChange={setIsAddQuestionDialogOpen}
        questionType="global"
        onSave={handleSaveNewQuestion}
      />
      
      <AddPatientSpecificQuestionDialog
        open={isAddPatientQuestionDialogOpen}
        onOpenChange={setIsAddPatientQuestionDialogOpen}
        patients={[]}
        onSave={handleSaveNewPatientQuestion}
      />
    </PageContainer>
  );
}

export default AdminQuestionBankPage;
