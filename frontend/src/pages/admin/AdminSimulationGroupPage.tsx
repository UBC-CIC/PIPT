import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageContainer from '@/components/PageContainer';
import UserAvatar from '@/components/UserAvatar';
import { mockInstructorDataService, type GlobalRubricQuestion, type CaseMaterial, type QuestionBankItem } from '@/services/instructorService';
import { mockAdminDataService, type Instructor } from '@/services/adminService';
import { ArrowLeft, BarChart3, Users, UserCog, FileText, Eye, Key, Copy, Search, Trash2, Edit, Plus, Menu, Camera, Upload, UserPlus, FileCode } from 'lucide-react';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AddQuestionDialog } from '@/components/AddQuestionDialog';
import { AddPatientSpecificQuestionDialog } from '@/components/AddPatientSpecificQuestionDialog';
import { AddInstructorDialog } from '@/components/AddInstructorDialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

/**
 * AdminSimulationGroupPage Component
 * 
 * Displays the simulation group management view for admins.
 * Includes sidebar navigation and content area for analytics, patient management, etc.
 */
function AdminSimulationGroupPage() {
  const navigate = useNavigate();
  const { organizationId, groupId } = useParams();
  const [activeSection, setActiveSection] = useState<'analytics' | 'patients' | 'students' | 'instructors' | 'prompts' | 'rubric' | 'questionBank' | 'editPatient' | 'viewStudent'>('analytics');
  const [searchQuery, setSearchQuery] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [instructorSearchQuery, setInstructorSearchQuery] = useState('');
  const [enableVoiceForAll, setEnableVoiceForAll] = useState(false);
  const [selectedPromptType, setSelectedPromptType] = useState<'system' | 'evaluation'>('system');
  const [systemPromptText, setSystemPromptText] = useState('Pretend to be a patient with the context you are given. You are helping the pharmacist practice their skills interacting with a patient.');
  const [evaluationPromptText, setEvaluationPromptText] = useState('Evaluate the student\'s interview using the instructor-defined rubric and key questions.');
  const [promptHistory] = useState(() => mockAdminDataService.getPromptHistory());
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [, setStudentViewTab] = useState<'overview' | 'chatHistory'>('overview');
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [selectedPatientFilter, setSelectedPatientFilter] = useState<string>('pamela');
  const [questionPerformanceTimePeriod, setQuestionPerformanceTimePeriod] = useState<'week' | 'month' | 'year' | 'all'>('all');
  const [scoreDistributionTimePeriod, setScoreDistributionTimePeriod] = useState<'week' | 'month' | 'year' | 'all'>('all');
  
  // Edit Patient state
  const [selectedPatientForEdit, setSelectedPatientForEdit] = useState<string | null>(null);
  const [editPatientTab, setEditPatientTab] = useState<'info' | 'questions' | 'materials'>('info');
  const [editPatientName, setEditPatientName] = useState('');
  const [editPatientAge, setEditPatientAge] = useState('');
  const [editPatientGender, setEditPatientGender] = useState('');
  const [editPatientPrompt, setEditPatientPrompt] = useState('');
  
  // Global Rubric state
  const [globalRubricQuestions, setGlobalRubricQuestions] = useState<GlobalRubricQuestion[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [rubricSearchQuery, setRubricSearchQuery] = useState('');
  const [isMainSidebarVisible, setIsMainSidebarVisible] = useState(true);
  
  // Question Bank state
  const [questionBankTab, setQuestionBankTab] = useState<'global' | 'patientSpecific'>('global');
  const [includedQuestionIds, setIncludedQuestionIds] = useState<Set<string>>(new Set());
  const [isAddQuestionDialogOpen, setIsAddQuestionDialogOpen] = useState(false);
  const [isAddPatientQuestionDialogOpen, setIsAddPatientQuestionDialogOpen] = useState(false);
  const [isAddInstructorDialogOpen, setIsAddInstructorDialogOpen] = useState(false);
  const [addQuestionType, setAddQuestionType] = useState<'global' | 'patientSpecific'>('global');
  const [selectedPatientForQuestionBank, setSelectedPatientForQuestionBank] = useState<string | null>(null);
  
  // Question Bank questions - loaded from service
  const [globalBankQuestions, setGlobalBankQuestions] = useState<QuestionBankItem[]>([]);
  const [patientSpecificBankQuestions, setPatientSpecificBankQuestions] = useState<QuestionBankItem[]>([]);
  
  // Case-Specific Key Questions state
  const [caseSpecificQuestions, setCaseSpecificQuestions] = useState<GlobalRubricQuestion[]>(() => 
    selectedPatientForEdit ? mockInstructorDataService.getCaseSpecificQuestions(selectedPatientForEdit) : []
  );
  const [, setSelectedCaseQuestionId] = useState<string>(() => {
    const questions = selectedPatientForEdit ? mockInstructorDataService.getCaseSpecificQuestions(selectedPatientForEdit) : [];
    return questions[0]?.id || '';
  });
  const [caseQuestionSearchQuery, setCaseQuestionSearchQuery] = useState('');
  const [globalRubricSearchQuery, setGlobalRubricSearchQuery] = useState('');
  
  // Get selected case question
  
  // Filter case questions based on search
  const filteredCaseQuestions = caseSpecificQuestions.filter(q =>
    q.title.toLowerCase().includes(caseQuestionSearchQuery.toLowerCase())
  );

  // Case Materials state
  const [caseMaterials, setCaseMaterials] = useState<CaseMaterial[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  
  // Get selected material
  const selectedMaterial = caseMaterials.find(m => m.id === selectedMaterialId);
  
  // Filter materials based on search
  const filteredMaterials = caseMaterials.filter(m =>
    m.title.toLowerCase().includes(materialSearchQuery.toLowerCase())
  );
  
  // Get selected question
  const selectedQuestion = globalRubricQuestions.find(q => q.id === selectedQuestionId);
  
  // Filter questions based on search
  const filteredRubricQuestions = globalRubricQuestions.filter(q =>
    q.title.toLowerCase().includes(rubricSearchQuery.toLowerCase())
  );
  
  // Load data from instructor service
  const user = mockAdminDataService.getCurrentUser();
  const simulationGroup = mockInstructorDataService.getSimulationGroup(groupId || '1');
  const patientAnalytics = mockInstructorDataService.getPatientAnalytics(groupId || '1');
  const students = mockInstructorDataService.getStudents(groupId || '1');
  
  // Load instructors from admin service
  const [instructors, setInstructors] = useState<Instructor[]>(() => mockAdminDataService.getInstructors());
  
  // Get organization details
  const organizations = mockAdminDataService.getOrganizations();
  const organization = organizations.find(org => org.id === organizationId);
  
  // Get organization-specific labels from service
  const labels = instructorService.getOrganizationLabels(groupId || '1');
  const {
    aiPersona: aiPersonaLabel,
    aiPersonaPlural: aiPersonaLabelPlural,
    aiPersonaLower: aiPersonaLabelLower,
    userRole: userRoleLabel,
  } = labels;
  
  // Load data asynchronously
  useEffect(() => {
    const loadData = async () => {
      if (!groupId) return;
      
      try {
        const [groupData, analyticsData, studentsData, patientsData, bankGlobal, bankPatient] = await Promise.all([
          instructorService.getSimulationGroup(groupId),
          instructorService.getPatientAnalytics(groupId),
          instructorService.getStudents(groupId),
          instructorService.getManageablePatients(groupId),
          Promise.resolve(instructorService.getGlobalQuestionBank()),
          Promise.resolve(instructorService.getPatientSpecificQuestionBank()),
        ]);
        
        setSimulationGroup(groupData);
        setPatientAnalytics(analyticsData);
        setStudents(studentsData);
        setManageablePatients(patientsData);
        setGlobalBankQuestions(bankGlobal);
        setPatientSpecificBankQuestions(bankPatient);
        
        // Set initial selected patient if analytics available
        if (analyticsData.length > 0) {
          setSelectedPatientId(analyticsData[0].patient_id);
        }
      } catch (error) {
        console.error('Error loading admin simulation group data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [groupId]);
  
  // State for selected patient (for analytics tabs)
  const [selectedPatientId, setSelectedPatientId] = useState<string>('overview');
  
  // Get current patient data
  const currentPatient = patientAnalytics.find(p => p.patient_id === selectedPatientId);
  const messageCountData = currentPatient 
    ? [
        { name: 'Student Messages', value: currentPatient.studentMessageCount },
        { name: 'AI Messages', value: currentPatient.aiMessageCount },
      ]
    : [];
  const donutColors = [SIMULATION_GROUP_COLOR_PALETTE[2], SIMULATION_GROUP_COLOR_PALETTE[5]];
  const totalMessages = currentPatient ? currentPatient.studentMessageCount + currentPatient.aiMessageCount : 0;
  
  // Key question analytics (per patient)
  const keyQuestionAnalytics = currentPatient
    ? mockInstructorDataService.getKeyQuestionAnalytics(groupId || '1')
    : [];
  
  // Question performance scores
  const questionPerformanceScores = mockInstructorDataService.getQuestionPerformanceScores(groupId || '1');
  
  // Score distribution for current patient
  const scoreDistribution = currentPatient 
    ? mockInstructorDataService.getScoreDistribution(groupId || '1', currentPatient.id)
    : [];
  
  // Fallback values
  const simulationGroupName = simulationGroup?.name || 'Simulation Group';
  const accessCode = simulationGroup?.access_code || 'XXXX-XXXX-XXXX-XXXX';
  
  // Filter patients based on search query
  const filteredPatients = manageablePatients.filter(patient =>
    patient.patient_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter students based on search query
  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(studentSearchQuery.toLowerCase())
  );

  // Filter instructors based on search query
  const filteredInstructors = instructors.filter(instructor =>
    instructor.name.toLowerCase().includes(instructorSearchQuery.toLowerCase())
  );

  const handleSignOut = () => {
    navigate('/login');
  };

  const handleBackToAllGroups = () => {
    navigate(`/admin/organization/${organizationId}`);
  };

  const handleStudentView = () => {
    navigate('/student');
  };

  const handleGenerateAccessCode = () => {
    if (groupId) {
      const newCode = mockInstructorDataService.generateAccessCode(groupId);
      console.log('Generated new access code:', newCode);
      navigate(`/admin/organization/${organizationId}/group/${groupId}`, { replace: true });
    }
  };

  const handleCopyAccessCode = () => {
    navigator.clipboard.writeText(accessCode);
  };

  const handleToggleLLMEvaluation = (patientId: string, currentValue: boolean) => {
    setManageablePatients(prevPatients => 
      prevPatients.map(patient => 
        patient.patient_id === patientId 
          ? { ...patient, llm_completion: !currentValue }
          : patient
      )
    );
    mockInstructorDataService.updatePatientLLMEvaluation(patientId, !currentValue);
  };

  const handleDeletePatient = (patientId: string) => {
    if (confirm(`Are you sure you want to delete this ${aiPersonaLabelLower}?`)) {
      setManageablePatients(prevPatients => 
        prevPatients.filter(patient => patient.patient_id !== patientId)
      );
      mockInstructorDataService.deletePatient(patientId);
    }
  };

  const handleEditPatient = (patientId: string) => {
    const patient = manageablePatients.find(p => p.patient_id === patientId);
    if (patient) {
      setSelectedPatientForEdit(patientId);
      setEditPatientName(patient.patient_name);
      setEditPatientAge(patient.patient_age.toString());
      setEditPatientGender(patient.patient_gender);
      setEditPatientPrompt(patient.patient_prompt || instructorService.getDefaultPatientPrompt());
      setEditPatientTab('info');
      
      const questions = mockInstructorDataService.getCaseSpecificQuestions(patientId);
      setCaseSpecificQuestions(questions);
      setSelectedCaseQuestionId(questions[0]?.id || '');
      
      const questionIds = mockInstructorDataService.getPatientCaseSpecificQuestionIds(patientId);
      setIncludedQuestionIds(questionIds);
      
      const materials = instructorService.getCaseMaterials(patientId);
      setCaseMaterials(materials);
      setSelectedMaterialId(materials[0]?.id || '');
      
      setActiveSection('editPatient');
    }
  };

  const handleBackFromEditPatient = () => {
    setSelectedPatientForEdit(null);
    setActiveSection('patients');
  };

  const handleViewStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setStudentViewTab('overview');
    setActiveSection('viewStudent');
  };

  const handleBackFromViewStudent = () => {
    setSelectedStudentId(null);
    setActiveSection('students');
  };

  const handleAddNewInstructor = () => {
    setIsAddInstructorDialogOpen(true);
  };

  const handleAddInstructorSubmit = (email: string, name: string) => {
    const newInstructor: Instructor = {
      id: `inst-${Date.now()}`,
      name: name,
      email: email,
      date_joined: new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
    };
    setInstructors(prev => [...prev, newInstructor]);
  };

  const handleRemoveInstructor = (instructorId: string) => {
    const instructor = instructors.find(i => i.id === instructorId);
    if (instructor && confirm(`Are you sure you want to remove ${instructor.name}?`)) {
      setInstructors(prev => prev.filter(i => i.id !== instructorId));
    }
  };

  const handleLoadDefaultPrompt = () => {
    if (selectedPromptType === 'system') {
      setSystemPromptText('Pretend to be a patient with the context you are given. You are helping the pharmacist practice their skills interacting with a patient. Engage with the pharmacist by describing your symptoms to provide them hints on what condition(s) you have.');
    } else {
      const prompt = await instructorService.getEvaluationPrompt(groupId || '1');
      setEvaluationPromptText(prompt);
    }
  };

  const handleSavePrompt = () => {
    console.log('Saving prompt:', selectedPromptType, selectedPromptType === 'system' ? systemPromptText : evaluationPromptText);
    alert('Prompt saved successfully!');
  };

  const handleRestorePromptVersion = (versionText: string) => {
    if (confirm('Are you sure you want to restore this version?')) {
      if (selectedPromptType === 'system') {
        setSystemPromptText(versionText);
      } else {
        setEvaluationPromptText(versionText);
      }
      console.log('Restored prompt version');
    }
  };

  const handleSavePatientChanges = () => {
    if (selectedPatientForEdit && groupId) {
      if (selectedPatientForEdit === 'new') {
        mockInstructorDataService.createPatient(groupId, {
          name: editPatientName,
          age: parseInt(editPatientAge) || 0,
          gender: editPatientGender,
          prompt: editPatientPrompt,
        });
      } else {
        mockInstructorDataService.updatePatient(groupId, {
          id: selectedPatientForEdit,
          name: editPatientName,
          age: parseInt(editPatientAge) || 0,
          gender: editPatientGender,
          prompt: editPatientPrompt,
        });
      }
    }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedPatientForEdit && groupId) {
      instructorService.uploadPatientPhoto(selectedPatientForEdit, file).then(async () => {
        const manageablePatients = await instructorService.getManageablePatients(groupId);
        setManageablePatients(manageablePatients);
      });
    }
  };

  const handleFileUpload = (fileType: 'llm' | 'patientInfo' | 'answerKey', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log(`Uploading ${fileType} file:`, file.name);
    }
  };

  // Get the patient being edited
  const patientBeingEdited = selectedPatientForEdit 
    ? instructorService.getPatient(selectedPatientForEdit)
    : null;

  const handleCreateNewPatient = () => {
    setSelectedPatientForEdit('new');
    setEditPatientName('');
    setEditPatientAge('');
    setEditPatientGender('');
    setEditPatientPrompt(instructorService.getDefaultPatientPrompt());
    setEditPatientTab('info');
    setActiveSection('editPatient');
  };

  const handleDeleteQuestion = () => {
    if (!selectedQuestionId) return;
    if (confirm('Are you sure you want to remove this question from the global rubric? It will remain in the question bank.')) {
      instructorService.deleteGlobalRubricQuestion(groupId || '1', selectedQuestionId);
      const updatedQuestions = instructorService.getGlobalRubricQuestions(groupId || '1');
      setGlobalRubricQuestions(updatedQuestions);
      setSelectedQuestionId(updatedQuestions[0]?.id || null);
      
      setIncludedQuestionIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedQuestionId);
        return newSet;
      });
    }
  };

  const handleSaveQuestion = () => {
    if (!selectedQuestion) return;
    instructorService.updateGlobalRubricQuestion(groupId || '1', selectedQuestion);
    console.log('Saving question:', selectedQuestion);
  };

  const handleUpdateQuestionField = (field: keyof GlobalRubricQuestion, value: string | boolean) => {
    if (!selectedQuestionId) return;
    setGlobalRubricQuestions(globalRubricQuestions.map(q => 
      q.id === selectedQuestionId ? { ...q, [field]: value } : q
    ));
  };




  const handleUpdateMaterialField = (field: keyof CaseMaterial, value: string) => {
    if (!selectedMaterialId) return;
    setCaseMaterials(caseMaterials.map(m => 
      m.id === selectedMaterialId ? { ...m, [field]: value } : m
    ));
  };

  const handleAddNewCaseMaterial = () => {
    if (!selectedPatientForEdit) return;
    const newMaterial: CaseMaterial = {
      id: `material-${Date.now()}`,
      title: 'New Material',
      description: '',
      materialType: 'document',
      contentUrl: '',
      embedLink: '',
    };
    instructorService.addCaseMaterial(selectedPatientForEdit, newMaterial);
    setCaseMaterials(instructorService.getCaseMaterials(selectedPatientForEdit));
    setSelectedMaterialId(newMaterial.id);
  };


  const handleSaveCaseMaterial = () => {
    if (!selectedMaterial || !selectedPatientForEdit) return;
    instructorService.updateCaseMaterial(selectedPatientForEdit, selectedMaterial);
    console.log('Saving case material:', selectedMaterial);
  };

  const handleMaterialFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedMaterialId) {
      console.log('Uploading material file:', file.name);
      handleUpdateMaterialField('contentUrl', URL.createObjectURL(file));
    }
  };

  const handleSaveNewQuestion = (question: {
    title: string;
    keyQuestion: string;
    clinicalIntent: string;
    evaluationCriteria: string;
    required: boolean;
  }) => {
    const newQuestionId = `bank-${addQuestionType}-${Date.now()}`;
    const newBankQuestion: QuestionBankItem = { 
      id: newQuestionId, 
      title: question.title,
      questionText: question.keyQuestion,
      clinicalIntent: question.clinicalIntent,
      evaluationCriteria: question.evaluationCriteria,
      isMandatory: question.required,
      isActive: true,
      usedBySimulationGroups: [],
      usedByPatients: addQuestionType === 'patientSpecific' ? [] : undefined
    };
    
    if (addQuestionType === 'global') {
      instructorService.addToGlobalQuestionBank(newBankQuestion);
      setGlobalBankQuestions(instructorService.getGlobalQuestionBank());
    } else {
      instructorService.addToPatientSpecificQuestionBank(newBankQuestion);
      setPatientSpecificBankQuestions(instructorService.getPatientSpecificQuestionBank());
    }
    
    console.log('Saved new question to bank:', addQuestionType, question);
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
    
    const newCaseQuestion: GlobalRubricQuestion = {
      id: newQuestionId,
      title: question.title,
      keyQuestion: question.keyQuestion,
      clinicalIntent: question.clinicalIntent,
      evaluationCriteria: question.evaluationCriteria,
      required: question.required,
    };
    
    instructorService.addCaseSpecificQuestion(question.patientId, newCaseQuestion);
    
    if (questionBankTab === 'patientSpecific' && selectedPatientForQuestionBank === question.patientId) {
      setIncludedQuestionIds(prev => {
        const newSet = new Set(prev);
        newSet.add(newQuestionId);
        return newSet;
      });
    }
    
    if (selectedPatientForEdit === question.patientId) {
      setCaseSpecificQuestions(instructorService.getCaseSpecificQuestions(question.patientId));
    }
    
    console.log('Saved new patient-specific question:', question);
  };

  const handleToggleQuestionInclusion = (questionId: string, bankQuestion: QuestionBankItem, isChecked: boolean) => {
    const newSet = new Set(includedQuestionIds);
    
    if (isChecked) {
      newSet.add(questionId);
      
      if (questionBankTab === 'global' || questionId.startsWith('bank-global-')) {
        const existingQuestion = globalRubricQuestions.find(q => q.id === questionId);
        if (!existingQuestion) {
          const newGlobalRubricQuestion: GlobalRubricQuestion = {
            id: questionId,
            title: bankQuestion.title,
            keyQuestion: bankQuestion.questionText,
            clinicalIntent: bankQuestion.clinicalIntent,
            evaluationCriteria: bankQuestion.evaluationCriteria,
            required: bankQuestion.isMandatory,
          };
          
          instructorService.addGlobalRubricQuestion(groupId || '1', newGlobalRubricQuestion);
          setGlobalRubricQuestions(instructorService.getGlobalRubricQuestions(groupId || '1'));
        }
      }
    } else {
      newSet.delete(questionId);
      
      if (questionBankTab === 'global' || questionId.startsWith('bank-global-')) {
        instructorService.deleteGlobalRubricQuestion(groupId || '1', questionId);
        setGlobalRubricQuestions(instructorService.getGlobalRubricQuestions(groupId || '1'));
      }
    }
    
    setIncludedQuestionIds(newSet);
  };

  // Reusable accordion for case-specific questions (editable)
  const renderCaseQuestionsAccordion = () => (
    <Accordion type="single" collapsible className="space-y-2">
      {filteredCaseQuestions.map((question, index) => (
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
            style={{ backgroundColor: UI_COLORS.background.white, color: UI_COLORS.text.heading }}
          >
            <div className="flex items-center justify-between w-full pr-4">
              <span className="font-medium">Q{index + 1} - {question.title}</span>
              <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                {question.required ? 'Required' : 'Optional'}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4" style={{ backgroundColor: UI_COLORS.background.white }}>
            <div className="space-y-4 pt-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Title</label>
                <Input
                  value={question.title}
                  onChange={(e) => setCaseSpecificQuestions(caseSpecificQuestions.map(q => q.id === question.id ? { ...q, title: e.target.value } : q))}
                  placeholder="Chest Pain Characterization"
                  className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                  style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Key Question</label>
                <textarea
                  value={question.keyQuestion}
                  onChange={(e) => setCaseSpecificQuestions(caseSpecificQuestions.map(q => q.id === question.id ? { ...q, keyQuestion: e.target.value } : q))}
                  placeholder="Assess the characteristics of the patient's chest pain..."
                  className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                  style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, outlineColor: UI_COLORS.border.medium, minHeight: '100px' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Clinical Intent</label>
                <textarea
                  value={question.clinicalIntent}
                  onChange={(e) => setCaseSpecificQuestions(caseSpecificQuestions.map(q => q.id === question.id ? { ...q, clinicalIntent: e.target.value } : q))}
                  placeholder="This question evaluates the student's ability..."
                  className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                  style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, outlineColor: UI_COLORS.border.medium, minHeight: '100px' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Evaluation Criteria</label>
                <textarea
                  value={question.evaluationCriteria}
                  onChange={(e) => setCaseSpecificQuestions(caseSpecificQuestions.map(q => q.id === question.id ? { ...q, evaluationCriteria: e.target.value } : q))}
                  placeholder="The student attempts to identify at least 3-4 of the following..."
                  className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                  style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, outlineColor: UI_COLORS.border.medium, minHeight: '150px' }}
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={question.required}
                  onClick={() => setCaseSpecificQuestions(caseSpecificQuestions.map(q => q.id === question.id ? { ...q, required: !q.required } : q))}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ backgroundColor: question.required ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive }}
                >
                  <span
                    className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                    style={{ transform: question.required ? 'translateX(22px)' : 'translateX(2px)' }}
                  />
                </button>
                <span className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>Required for Case Completion</span>
              </div>
              <div className="flex items-center gap-4 pt-4">
                <Button
                  onClick={() => { if (selectedPatientForEdit) mockInstructorDataService.updateCaseSpecificQuestion(selectedPatientForEdit, question); }}
                  className="px-8 py-3 text-base font-medium transition-colors"
                  style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                >
                  Save
                </Button>
                <Button
                  onClick={() => {
                    if (selectedPatientForEdit) {
                      mockInstructorDataService.deleteCaseSpecificQuestion(selectedPatientForEdit, question.id);
                      setCaseSpecificQuestions(caseSpecificQuestions.filter(q => q.id !== question.id));
                    }
                  }}
                  variant="outline"
                  className="px-8 py-3 text-base font-medium transition-colors text-white"
                  style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[0], borderColor: SIMULATION_GROUP_COLOR_PALETTE[0] }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Remove
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );

  // Reusable accordion for global rubric questions (read-only)
  const renderGlobalRubricAccordion = () => {
    const patientSimGroupId = patientBeingEdited?.simulation_group_id || groupId || '1';
    const patientGlobalRubric = mockInstructorDataService.getGlobalRubricQuestions(patientSimGroupId);
    const filteredGlobalRubric = patientGlobalRubric.filter(q =>
      q.title.toLowerCase().includes(globalRubricSearchQuery.toLowerCase())
    );
    return (
      <Accordion type="single" collapsible className="space-y-2">
        {filteredGlobalRubric.map((question, index) => (
          <AccordionItem 
            key={question.id} 
            value={question.id}
            style={{
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: UI_COLORS.border.default,
              borderRadius: '0.5rem',
              overflow: 'hidden',
              opacity: 0.7,
            }}
          >
            <AccordionTrigger
              className="px-4 hover:no-underline"
              style={{ backgroundColor: UI_COLORS.background.tableHeader, color: UI_COLORS.text.heading }}
            >
              <div className="flex items-center justify-between w-full pr-4">
                <span className="font-medium text-sm">Q{index + 1} - {question.title}</span>
                <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                  {question.required ? 'Required' : 'Optional'}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4" style={{ backgroundColor: UI_COLORS.background.white }}>
              <div className="space-y-4 pt-4">
                {[
                  { label: 'Title', value: question.title, minHeight: undefined },
                  { label: 'Key Question', value: question.keyQuestion, minHeight: '150px' },
                  { label: 'Clinical Intent', value: question.clinicalIntent, minHeight: '100px' },
                  { label: 'Evaluation Criteria', value: question.evaluationCriteria, minHeight: '100px' },
                ].map(({ label, value, minHeight }) => (
                  <div key={label}>
                    <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>{label}</label>
                    <div
                      className="w-full px-3 py-3 rounded-lg text-base whitespace-pre-wrap"
                      style={{
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: UI_COLORS.border.default,
                        backgroundColor: UI_COLORS.background.hoverLight,
                        color: UI_COLORS.text.body,
                        minHeight,
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    {question.required ? 'Required for Case Completion' : 'Optional'}
                  </span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  return (
    <PageContainer>
      {/* Header */}
      <header className="flex-shrink-0 flex border-b border-border items-center justify-between py-6 px-8" style={{ backgroundColor: UI_COLORS.header.background }}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMainSidebarVisible(!isMainSidebarVisible)}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <UserAvatar name={user.name} imageUrl={user.avatarUrl} size="medium" />
          <div className="flex flex-col items-start gap-0.5">
            <h1 className="font-bold tracking-tight leading-tight text-2xl" style={{ color: UI_COLORS.text.heading }}>
              Simulation Group View
            </h1>
            <button
              onClick={handleBackToAllGroups}
              className="font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 transition-colors"
              style={{ color: UI_COLORS.text.body }}
              onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
              onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to {organization?.name || 'Organization'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="default"
            onClick={handleStudentView}
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
          >
            Student View
          </Button>
          <Button
            variant="default"
            onClick={handleSignOut}
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
          >
            Sign Out
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside 
          className="flex flex-col transition-all duration-300 ease-in-out border-r"
          aria-hidden={!isMainSidebarVisible}
          style={{ 
            backgroundColor: UI_COLORS.background.white, 
            borderRightWidth: isMainSidebarVisible ? '1px' : '0px',
            borderRightStyle: 'solid',
            borderRightColor: UI_COLORS.border.default,
            width: isMainSidebarVisible ? '16rem' : '0rem',
            minWidth: isMainSidebarVisible ? '16rem' : '0rem',
            overflowY: isMainSidebarVisible ? 'auto' : 'hidden',
            overflowX: 'hidden',
            opacity: isMainSidebarVisible ? 1 : 0,
            pointerEvents: isMainSidebarVisible ? 'auto' : 'none',
          }}
        >
          <nav className="flex-1 p-4 space-y-2">
            {[
              { section: 'analytics', icon: <BarChart3 className="w-5 h-5" />, label: 'Analytics' },
              { section: 'patients', icon: <Users className="w-5 h-5" />, label: `Manage ${aiPersonaLabelPlural}` },
              { section: 'students', icon: <UserCog className="w-5 h-5" />, label: `Manage ${userRoleLabel}s` },
              { section: 'instructors', icon: <UserPlus className="w-5 h-5" />, label: 'Manage Instructors' },
              { section: 'rubric', icon: <FileText className="w-5 h-5" />, label: 'Global Rubric' },
            ].map(({ section, icon, label }) => (
              <Button
                key={section}
                onClick={() => setActiveSection(section as typeof activeSection)}
                variant="ghost"
                className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
                style={{
                  backgroundColor: activeSection === section ? UI_COLORS.background.tableHeader : 'transparent',
                  color: UI_COLORS.text.heading
                }}
              >
                {icon}
                {label}
              </Button>
            ))}

            <Button
              onClick={() => setActiveSection('prompts')}
              variant="ghost"
              className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
              style={{
                backgroundColor: activeSection === 'prompts' ? UI_COLORS.background.tableHeader : 'transparent',
                color: UI_COLORS.text.heading
              }}
            >
              <FileCode className="w-5 h-5" />
              Manage Prompts
            </Button>
          </nav>

          {/* Access Code Section */}
          <div className="border-t p-4 space-y-3" style={{ borderColor: UI_COLORS.border.default }}>
            <div>
              <p className="text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Access Code</p>
              <div className="flex items-center gap-2 p-3 rounded-md border" style={{ backgroundColor: UI_COLORS.background.tableHeader, borderColor: UI_COLORS.border.default }}>
                <Key className="w-4 h-4" style={{ color: UI_COLORS.text.body }} />
                <span className="font-mono text-sm flex-1" style={{ color: UI_COLORS.text.heading }}>{accessCode}</span>
                <button
                  onClick={handleCopyAccessCode}
                  className="p-1 rounded hover:bg-gray-200 transition-colors"
                  style={{ border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                  title="Copy access code"
                >
                  <Copy className="w-4 h-4" style={{ color: UI_COLORS.text.body }} />
                </button>
              </div>
            </div>
            <Button
              onClick={handleGenerateAccessCode}
              variant="outline"
              className="w-full justify-start gap-2 py-2.5 h-auto font-medium"
              style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading }}
            >
              Generate new access code
            </Button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto" style={{ padding: activeSection === 'rubric' || activeSection === 'questionBank' || activeSection === 'prompts' || activeSection === 'editPatient' || activeSection === 'viewStudent' ? '0' : '2rem' }}>
          {activeSection === 'analytics' && (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold tracking-tight" style={{ color: UI_COLORS.text.heading }}>
                {simulationGroupName}
              </h2>

              {/* Tabs */}
              <div className="flex gap-2 border-b" style={{ borderColor: UI_COLORS.border.default }}>
                <button
                  onClick={() => setSelectedPatientId('overview')}
                  className="px-6 py-3 font-medium transition-colors border-b-2"
                  style={{
                    color: selectedPatientId === 'overview' ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body,
                    borderColor: selectedPatientId === 'overview' ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent',
                    backgroundColor: 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  Overview
                </button>
                {patientAnalytics.map((patient) => (
                  <button
                    key={patient.patient_id}
                    onClick={() => setSelectedPatientId(patient.patient_id)}
                    className="px-6 py-3 font-medium transition-colors border-b-2"
                    style={{
                      color: selectedPatientId === patient.patient_id ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body,
                      borderColor: selectedPatientId === patient.patient_id ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent',
                      backgroundColor: 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    {patient.patient_name}
                  </button>
                ))}
              </div>

              {/* Overview Tab */}
              {selectedPatientId === 'overview' && simulationGroup && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-6">
                    {[
                      { count: simulationGroup.patient_count, label: aiPersonaLabelPlural, colorIndex: 2, Icon: Users },
                      { count: simulationGroup.student_count, label: 'Students', colorIndex: 5, Icon: Users },
                      { count: simulationGroup.instructor_count ?? 0, label: 'Instructors', colorIndex: 4, Icon: UserCog },
                    ].map(({ count, label, colorIndex, Icon }) => (
                      <div key={label} className="border rounded-xl p-6 text-center" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                        <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[colorIndex] + '1a' }}>
                          <Icon className="w-6 h-6" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[colorIndex] }} />
                        </div>
                        <p className="text-3xl font-bold" style={{ color: UI_COLORS.text.heading }}>{count}</p>
                        <p className="text-sm mt-1" style={{ color: UI_COLORS.text.muted }}>{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Global Key Questions Bar */}
                  <div className="border rounded-lg p-6" style={{ borderColor: UI_COLORS.border.default }}>
                    <h3 className="text-xl font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                      Global Key Questions — Students Answered
                    </h3>
                    <p className="text-sm mb-6" style={{ color: UI_COLORS.text.muted }}>
                      Number of students who answered each global key question across all personas
                    </p>
                    {(() => {
                      const globalKeyQuestionData = mockInstructorDataService.getKeyQuestionAnalytics(groupId || '1');
                      return globalKeyQuestionData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={Math.max(250, globalKeyQuestionData.length * 50)}>
                          <BarChart data={globalKeyQuestionData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                            <XAxis type="number" tick={{ fill: UI_COLORS.text.body, fontSize: 12 }} axisLine={{ stroke: UI_COLORS.border.default }} allowDecimals={false} />
                            <YAxis type="category" dataKey="questionTitle" width={180} tick={{ fill: UI_COLORS.text.body, fontSize: 12 }} axisLine={{ stroke: UI_COLORS.border.default }} />
                            <Tooltip contentStyle={{ backgroundColor: UI_COLORS.background.white, border: `1px solid ${UI_COLORS.border.default}`, borderRadius: '6px' }} formatter={(value: number | undefined) => [`${value ?? 0} students`, 'Answered']} />
                            <Bar dataKey="studentsAnswered" fill={SIMULATION_GROUP_COLOR_PALETTE[2]} radius={[0, 4, 4, 0]} barSize={28} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>No key questions configured.</p>
                      );
                    })()}
                  </div>

                  {/* Question Performance Scores */}
                  {questionPerformanceScores.length > 0 && (
                    <div className="border rounded-lg p-6" style={{ borderColor: UI_COLORS.border.default }}>
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <h3 className="text-xl font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>Question Performance Scores</h3>
                          <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>Average quality score per key question across all student responses</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium whitespace-nowrap" style={{ color: UI_COLORS.text.body }}>Time Period:</label>
                          <select
                            value={questionPerformanceTimePeriod}
                            onChange={(e) => setQuestionPerformanceTimePeriod(e.target.value as 'week' | 'month' | 'year' | 'all')}
                            className="px-3 py-2 rounded-lg border text-sm"
                            style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white, color: UI_COLORS.text.heading }}
                          >
                            <option value="week">Last Week</option>
                            <option value="month">Last Month</option>
                            <option value="year">Last Year</option>
                            <option value="all">All Time</option>
                          </select>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={Math.max(250, questionPerformanceScores.length * 50)}>
                        <BarChart data={questionPerformanceScores} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: UI_COLORS.text.body, fontSize: 12 }} axisLine={{ stroke: UI_COLORS.border.default }} tickFormatter={(val: number) => `${val}%`} />
                          <YAxis type="category" dataKey="questionTitle" width={180} tick={{ fill: UI_COLORS.text.body, fontSize: 12 }} axisLine={{ stroke: UI_COLORS.border.default }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: UI_COLORS.background.white, border: `1px solid ${UI_COLORS.border.default}`, borderRadius: '6px' }}
                            formatter={(value: number | undefined, _name: string | undefined, props: { payload?: { totalResponses?: number } }) => [
                              `${value ?? 0}% avg (${props.payload?.totalResponses ?? 0} responses)`, 'Score'
                            ]}
                          />
                          <Bar dataKey="averageScore" radius={[0, 4, 4, 0]} barSize={28}>
                            {questionPerformanceScores.map((entry, index) => (
                              <Cell key={`perf-${index}`} fill={entry.averageScore >= 75 ? '#22c55e' : entry.averageScore >= 55 ? '#eab308' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex items-center justify-center gap-6 mt-3">
                        {[
                          { color: '#22c55e', label: 'Good (≥75%)' },
                          { color: '#eab308', label: 'Average (55–74%)' },
                          { color: '#ef4444', label: 'Needs Improvement (<55%)' },
                        ].map(({ color, label }) => (
                          <div key={label} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Per-Patient Tab */}
              {currentPatient && (
                <div className="border rounded-lg p-6" style={{ borderColor: UI_COLORS.border.default }}>
                  <h3 className="text-xl font-semibold mb-6" style={{ color: UI_COLORS.text.heading }}>
                    {currentPatient.name} Overview
                  </h3>

                  <div className="grid grid-cols-3 gap-6 mb-8">
                    {[
                      { value: currentPatient.studentMessageCount, label: 'Student Messages', colorIndex: 2 },
                      { value: currentPatient.aiMessageCount, label: 'AI Messages', colorIndex: 5 },
                      { value: currentPatient.studentAccessCount, label: 'Student Access Count', colorIndex: 4 },
                    ].map(({ value, label, colorIndex }) => (
                      <div key={label} className="border rounded-xl p-5 text-center" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                        <p className="text-2xl font-bold" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[colorIndex] }}>{value}</p>
                        <p className="text-sm mt-1" style={{ color: UI_COLORS.text.muted }}>{label}</p>
                      </div>
                    ))}
                  </div>

                  {keyQuestionAnalytics.length > 0 && (
                    <div className="mt-8">
                      <h4 className="text-lg font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>Key Questions — Students Answered</h4>
                      <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>Number of students who answered each key question for {currentPatient.name}</p>
                      <ResponsiveContainer width="100%" height={Math.max(250, keyQuestionAnalytics.length * 50)}>
                        <BarChart data={keyQuestionAnalytics} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                          <XAxis type="number" tick={{ fill: UI_COLORS.text.body, fontSize: 12 }} axisLine={{ stroke: UI_COLORS.border.default }} allowDecimals={false} />
                          <YAxis type="category" dataKey="questionTitle" width={180} tick={{ fill: UI_COLORS.text.body, fontSize: 12 }} axisLine={{ stroke: UI_COLORS.border.default }} />
                          <Tooltip contentStyle={{ backgroundColor: UI_COLORS.background.white, border: `1px solid ${UI_COLORS.border.default}`, borderRadius: '6px' }} formatter={(value: number | undefined) => [`${value ?? 0} students`, 'Answered']} />
                          <Bar dataKey="studentsAnswered" fill={SIMULATION_GROUP_COLOR_PALETTE[2]} radius={[0, 4, 4, 0]} barSize={28} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="mt-8">
                    <h4 className="text-lg font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>Message Distribution</h4>
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie data={messageCountData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={4} dataKey="value" stroke="none">
                          {messageCountData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={donutColors[index % donutColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: UI_COLORS.background.white, border: `1px solid ${UI_COLORS.border.default}`, borderRadius: '6px' }} formatter={(value: number | undefined, name: string | undefined) => [`${value ?? 0} messages`, name ?? '']} />
                        <Legend wrapperStyle={{ color: UI_COLORS.text.body }} />
                        <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" style={{ fill: UI_COLORS.text.heading, fontSize: '28px', fontWeight: 700 }}>{totalMessages}</text>
                        <text x="50%" y="56%" textAnchor="middle" dominantBaseline="central" style={{ fill: UI_COLORS.text.muted, fontSize: '13px' }}>Total Messages</text>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-8">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>Score Distribution</h4>
                        <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>Distribution of student scores for {currentPatient.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium whitespace-nowrap" style={{ color: UI_COLORS.text.body }}>Time Period:</label>
                        <select
                          value={scoreDistributionTimePeriod}
                          onChange={(e) => setScoreDistributionTimePeriod(e.target.value as 'week' | 'month' | 'year' | 'all')}
                          className="px-3 py-2 rounded-lg border text-sm"
                          style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white, color: UI_COLORS.text.heading }}
                        >
                          <option value="week">Last Week</option>
                          <option value="month">Last Month</option>
                          <option value="year">Last Year</option>
                          <option value="all">All Time</option>
                        </select>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={scoreDistribution} margin={{ top: 10, right: 30, left: 10, bottom: 20 }} barSize={50}>
                        <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                        <XAxis dataKey="range" tick={{ fill: UI_COLORS.text.body, fontSize: 12 }} axisLine={{ stroke: UI_COLORS.border.default }} label={{ value: 'Score Range (%)', position: 'insideBottom', offset: -10, fill: UI_COLORS.text.muted, fontSize: 12 }} />
                        <YAxis tick={{ fill: UI_COLORS.text.body, fontSize: 12 }} axisLine={{ stroke: UI_COLORS.border.default }} allowDecimals={false} label={{ value: 'Students', angle: -90, position: 'insideLeft', fill: UI_COLORS.text.muted, fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: UI_COLORS.background.white, border: `1px solid ${UI_COLORS.border.default}`, borderRadius: '6px' }} formatter={(value: number | undefined) => [`${value ?? 0} students`, 'Count']} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {scoreDistribution.map((_entry, index) => (
                            <Cell key={`dist-${index}`} fill={(['#ef4444', '#f97316', '#eab308', '#22c55e', SIMULATION_GROUP_COLOR_PALETTE[2]] as string[])[index] || SIMULATION_GROUP_COLOR_PALETTE[2]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeSection === 'patients' && (
            <div className="space-y-6 max-w-4xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: UI_COLORS.text.muted }} />
                <Input
                  placeholder={`Search by ${aiPersonaLabel} Name`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 py-6 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                  style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                />
              </div>

              <div className="border rounded-lg overflow-hidden" style={{ borderColor: UI_COLORS.border.default }}>
                <div className="grid grid-cols-[2fr_1fr_1fr_2fr_2fr] gap-4 px-6 py-4" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
                  {['Patient Name', 'Age', 'Gender', 'LLM Evaluation', 'Actions'].map(h => (
                    <div key={h} className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>{h}</div>
                  ))}
                </div>

                {filteredPatients.map((patient) => (
                  <div key={patient.id} className="grid grid-cols-[2fr_1fr_1fr_2fr_2fr] gap-4 px-6 py-4 border-t items-center" style={{ borderColor: UI_COLORS.border.default }}>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{patient.name}</div>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{patient.age}</div>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{patient.gender}</div>
                    <div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={patient.llm_completion}
                        onClick={() => handleToggleLLMEvaluation(patient.patient_id, patient.llm_completion)}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={{ backgroundColor: patient.llmEvaluationEnabled ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive }}
                      >
                        <span className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform" style={{ transform: patient.llmEvaluationEnabled ? 'translateX(22px)' : 'translateX(2px)' }} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => handleEditPatient(patient.patient_id)}
                        className="px-6 py-2 text-sm font-medium transition-colors"
                        style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <button
                        onClick={() => handleDeletePatient(patient.patient_id)}
                        className="p-2 rounded transition-colors"
                        style={{ border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.background.hover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Trash2 className="w-5 h-5" style={{ color: UI_COLORS.text.body }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleCreateNewPatient}
                className="px-6 py-6 text-base font-medium transition-colors"
                style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
              >
                <Plus className="w-5 h-5 mr-2" />
                Create New Patient
              </Button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={enableVoiceForAll}
                  onClick={() => setEnableVoiceForAll(!enableVoiceForAll)}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ backgroundColor: enableVoiceForAll ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive }}
                >
                  <span className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform" style={{ transform: enableVoiceForAll ? 'translateX(22px)' : 'translateX(2px)' }} />
                </button>
                <span className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>Enable voice conversations for all patients</span>
              </div>
            </div>
          )}
          
          {activeSection === 'students' && (
            <div className="space-y-6 max-w-4xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: UI_COLORS.text.muted }} />
                <Input
                  placeholder="Search by Student Name"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="pl-10 py-6 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                  style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                />
              </div>

              <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>Click on a student entry to view their performance metrics.</p>

              <div className="border rounded-lg overflow-hidden" style={{ borderColor: UI_COLORS.border.default }}>
                <div className="grid grid-cols-2 gap-4 px-6 py-4" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>Student Name</div>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>Email Address</div>
                </div>
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="grid grid-cols-2 gap-4 px-6 py-4 border-t items-center cursor-pointer transition-colors hover:bg-gray-50"
                    style={{ borderColor: UI_COLORS.border.default }}
                    onClick={() => handleViewStudent(student.id)}
                  >
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{student.name}</div>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{student.email}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'instructors' && (
            <div className="space-y-6 max-w-5xl">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: UI_COLORS.text.muted }} />
                  <Input
                    placeholder="Search by Instructor Name"
                    value={instructorSearchQuery}
                    onChange={(e) => setInstructorSearchQuery(e.target.value)}
                    className="pl-10 py-6 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                    style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                  />
                </div>
                <Button
                  onClick={handleAddNewInstructor}
                  className="px-6 py-6 gap-2 transition-colors"
                  style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                >
                  <Plus className="w-5 h-5" />
                  Add Instructor
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden" style={{ borderColor: UI_COLORS.border.default }}>
                <div className="grid grid-cols-[2fr_3fr_2fr_auto] gap-4 px-6 py-4" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
                  {['Instructor Name', 'Email Address', 'Date Joined', 'Actions'].map(h => (
                    <div key={h} className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>{h}</div>
                  ))}
                </div>
                {filteredInstructors.map((instructor) => (
                  <div key={instructor.id} className="grid grid-cols-[2fr_3fr_2fr_auto] gap-4 px-6 py-4 border-t items-center" style={{ borderColor: UI_COLORS.border.default }}>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{instructor.name}</div>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{instructor.email}</div>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{instructor.date_joined}</div>
                    <div>
                      <button
                        onClick={() => handleRemoveInstructor(instructor.id)}
                        className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                        style={{ border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                        aria-label="Remove instructor"
                      >
                        <Trash2 className="w-5 h-5" style={{ color: UI_COLORS.status.error }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'questionBank' && (
            <div className="h-full flex flex-col">
              <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: UI_COLORS.border.default }}>
                <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>Question Bank</h2>
                <div className="flex gap-2 border-b" style={{ borderColor: UI_COLORS.border.default }}>
                  <button
                    onClick={() => {
                      setQuestionBankTab('global');
                      const globalRubric = mockInstructorDataService.getGlobalRubricQuestions(groupId || '1');
                      setIncludedQuestionIds(new Set(globalRubric.map(q => q.id)));
                    }}
                    className="px-6 py-3 font-medium transition-colors border-b-2"
                    style={{ color: questionBankTab === 'global' ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body, borderColor: questionBankTab === 'global' ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent', backgroundColor: 'transparent', cursor: 'pointer' }}
                  >
                    Global Questions
                  </button>
                  <button
                    onClick={() => {
                      setQuestionBankTab('patientSpecific');
                      if (selectedPatientForQuestionBank) {
                        setIncludedQuestionIds(mockInstructorDataService.getPatientCaseSpecificQuestionIds(selectedPatientForQuestionBank));
                      } else {
                        setIncludedQuestionIds(new Set());
                      }
                    }}
                    className="px-6 py-3 font-medium transition-colors border-b-2"
                    style={{ color: questionBankTab === 'patientSpecific' ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body, borderColor: questionBankTab === 'patientSpecific' ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent', backgroundColor: 'transparent', cursor: 'pointer' }}
                  >
                    Patient-Specific Questions
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-6">
                <div className="space-y-3">
                  {questionBankTab === 'global' && (
                    <>
                      <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>Select which global questions should be included in this simulation group's rubric.</p>
                      <Button
                        onClick={() => { setAddQuestionType('global'); setIsAddQuestionDialogOpen(true); }}
                        className="w-full justify-start gap-2 py-3 h-auto font-medium transition-colors mb-4"
                        style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                      >
                        <Plus className="w-5 h-5" />
                        Add New Global Question
                      </Button>
                      {globalBankQuestions.map((question) => (
                        <div key={question.id} className="flex items-center justify-between p-4 rounded-lg border transition-colors" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                          <span className="text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>{question.title}</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={includedQuestionIds.has(question.id)}
                              onChange={(e) => handleToggleQuestionInclusion(question.id, question, e.target.checked)}
                              className="w-5 h-5 rounded cursor-pointer"
                              style={{ accentColor: SIMULATION_GROUP_COLOR_PALETTE[2] }}
                            />
                            <span className="text-sm" style={{ color: UI_COLORS.text.body }}>Include</span>
                          </label>
                        </div>
                      ))}
                    </>
                  )}

                  {questionBankTab === 'patientSpecific' && (
                    <>
                      <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>Select a patient to manage their patient-specific questions.</p>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>Select Patient</label>
                        <select
                          value={selectedPatientForQuestionBank || ''}
                          onChange={(e) => {
                            const patientId = e.target.value || null;
                            setSelectedPatientForQuestionBank(patientId);
                            if (patientId) {
                              setIncludedQuestionIds(mockInstructorDataService.getPatientCaseSpecificQuestionIds(patientId));
                            } else {
                              setIncludedQuestionIds(new Set());
                            }
                          }}
                          className="w-full px-4 py-2 rounded-lg border"
                          style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white, color: UI_COLORS.text.heading }}
                        >
                          <option value="">-- Select a patient --</option>
                          {manageablePatients.map((patient) => (
                            <option key={patient.id} value={patient.id}>{patient.name}</option>
                          ))}
                        </select>
                      </div>
                      <Button
                        onClick={() => setIsAddPatientQuestionDialogOpen(true)}
                        className="w-full justify-start gap-2 py-3 h-auto font-medium transition-colors mb-4"
                        style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                      >
                        <Plus className="w-5 h-5" />
                        Add New Patient-Specific Question
                      </Button>
                      {selectedPatientForQuestionBank ? (
                        patientSpecificBankQuestions.map((question) => (
                          <div key={question.id} className="flex items-center justify-between p-4 rounded-lg border transition-colors" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                            <span className="text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>{question.title}</span>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={includedQuestionIds.has(question.id)}
                                onChange={(e) => {
                                  const newSet = new Set(includedQuestionIds);
                                  if (e.target.checked) {
                                    newSet.add(question.id);
                                    const newCaseQuestion: GlobalRubricQuestion = {
                                      id: question.id, title: question.title, keyQuestion: question.questionText,
                                      clinicalIntent: question.clinicalIntent, evaluationCriteria: question.evaluationCriteria, required: question.isMandatory,
                                    };
                                    mockInstructorDataService.addCaseSpecificQuestion(selectedPatientForQuestionBank!, newCaseQuestion);
                                    if (selectedPatientForEdit === selectedPatientForQuestionBank) {
                                      setCaseSpecificQuestions(mockInstructorDataService.getCaseSpecificQuestions(selectedPatientForQuestionBank!));
                                    }
                                  } else {
                                    newSet.delete(question.id);
                                    mockInstructorDataService.deleteCaseSpecificQuestion(selectedPatientForQuestionBank!, question.id);
                                    if (selectedPatientForEdit === selectedPatientForQuestionBank) {
                                      setCaseSpecificQuestions(mockInstructorDataService.getCaseSpecificQuestions(selectedPatientForQuestionBank!));
                                    }
                                  }
                                  setIncludedQuestionIds(newSet);
                                }}
                                className="w-5 h-5 rounded cursor-pointer"
                                style={{ accentColor: SIMULATION_GROUP_COLOR_PALETTE[2] }}
                              />
                              <span className="text-sm" style={{ color: UI_COLORS.text.body }}>Include</span>
                            </label>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>Please select a patient to manage their questions.</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'prompts' && (
            <div className="flex h-full relative">
              <aside className="flex flex-col border-r" style={{ backgroundColor: UI_COLORS.background.white, borderRightWidth: '1px', borderRightStyle: 'solid', borderRightColor: UI_COLORS.border.default, width: '16rem', minWidth: '16rem' }}>
                <div className="p-6">
                  <h3 className="text-sm font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>Prompt Type</h3>
                  <div className="space-y-2">
                    {(['system', 'evaluation'] as const).map((type) => (
                      <Button
                        key={type}
                        onClick={() => setSelectedPromptType(type)}
                        variant="ghost"
                        className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
                        style={{ backgroundColor: selectedPromptType === type ? UI_COLORS.background.tableHeader : 'transparent', color: UI_COLORS.text.heading }}
                      >
                        {type === 'system' ? 'System Prompt' : 'Evaluation Prompt'}
                      </Button>
                    ))}
                  </div>
                </div>
              </aside>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>
                      {selectedPromptType === 'system' ? 'System Prompt' : 'Evaluation Prompt'}
                    </h2>
                    <div className="space-y-4">
                      <label className="text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>Edit Prompt</label>
                      <textarea
                        value={String(selectedPromptType === 'system' ? systemPromptText : evaluationPromptText)}
                        onChange={(e) => selectedPromptType === 'system' ? setSystemPromptText(e.target.value) : setEvaluationPromptText(e.target.value)}
                        placeholder="Prompt goes here..."
                        rows={6}
                        className="w-full px-4 py-3 rounded-md resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white, color: UI_COLORS.text.heading }}
                      />
                      <div className="flex gap-3 justify-end">
                        <Button onClick={handleLoadDefaultPrompt} variant="outline" className="px-6 transition-colors" style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading, backgroundColor: UI_COLORS.background.white }}>
                          Load Default Prompt
                        </Button>
                        <Button
                          onClick={handleSavePrompt}
                          className="px-6 transition-colors"
                          style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                        >
                          Save Prompt
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>
                      {selectedPromptType === 'system' ? 'System' : 'Evaluation'} Prompt History
                    </h3>
                    <p className="text-sm mb-6" style={{ color: UI_COLORS.text.muted }}>Browse earlier versions. Restore any version you want to use.</p>
                    {promptHistory.map((version, index) => (
                      <div key={version.id} className="border rounded-lg p-6 mb-4" style={{ borderColor: UI_COLORS.border.default }}>
                        <textarea
                          value={String(version.text)}
                          readOnly
                          placeholder="Prompt goes here..."
                          rows={4}
                          className="w-full px-4 py-3 rounded-md resize-none mb-4"
                          style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.tableHeader, color: UI_COLORS.text.heading }}
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <button className="text-sm" style={{ color: UI_COLORS.text.muted, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                              ← Version {index + 1} of {promptHistory.length} →
                            </button>
                            <span className="text-sm" style={{ color: UI_COLORS.text.muted }}>Saved: {version.savedAt}</span>
                          </div>
                          <Button onClick={() => handleRestorePromptVersion(version.text)} variant="outline" className="px-6 transition-colors" style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading, backgroundColor: UI_COLORS.background.white }}>
                            Restore This Version
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeSection === 'rubric' && (
            <div className="flex h-full relative">
              <aside className="flex flex-col border-r overflow-y-auto" style={{ backgroundColor: UI_COLORS.background.white, borderRightWidth: '1px', borderRightStyle: 'solid', borderRightColor: UI_COLORS.border.default, width: '20rem', minWidth: '20rem' }}>
                <div style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.default }}>
                  <div className="px-6 pt-6 pb-6">
                    <h2 className="font-semibold text-lg mb-3" style={{ color: UI_COLORS.text.heading }}>GLOBAL KEY QUESTIONS</h2>
                    <p className="text-xs mb-4" style={{ color: UI_COLORS.text.muted }}>These questions apply to all patients in this simulation group. Global key questions can only be edited here.</p>
                    <p className="text-xs mb-4" style={{ color: UI_COLORS.text.muted }}>In each patient's page, global key questions are view-only.</p>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                      <Input
                        placeholder="Search Global Key Questions"
                        value={rubricSearchQuery}
                        onChange={(e) => setRubricSearchQuery(e.target.value)}
                        className="pl-9 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                        style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {filteredRubricQuestions.map((question) => (
                    <button
                      key={question.id}
                      onClick={() => setSelectedQuestionId(question.id)}
                      className="w-full text-left py-3 transition-colors"
                      style={{
                        backgroundColor: selectedQuestionId === question.id ? UI_COLORS.background.tableHeader : 'transparent',
                        borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.default, cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (selectedQuestionId !== question.id) e.currentTarget.style.backgroundColor = UI_COLORS.background.hoverLight; }}
                      onMouseLeave={(e) => { if (selectedQuestionId !== question.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <div className="px-6">
                        <p className="text-sm font-medium mb-1" style={{ color: UI_COLORS.text.heading }}>
                          Q{globalRubricQuestions.indexOf(question) + 1} - {question.title}
                        </p>
                        <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>[{question.required ? 'Required' : 'Optional'}]</p>
                      </div>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8">
                  {selectedQuestion ? (
                    <div className="max-w-4xl space-y-6">
                      <h2 className="text-2xl font-bold" style={{ color: UI_COLORS.text.heading }}>
                        Question {globalRubricQuestions.indexOf(selectedQuestion) + 1}
                      </h2>
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Title</label>
                        <Input value={selectedQuestion.title} onChange={(e) => handleUpdateQuestionField('title', e.target.value)} className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }} />
                      </div>
                      {[
                        { field: 'keyQuestion' as const, label: 'Key Question', minHeight: '100px' },
                        { field: 'clinicalIntent' as const, label: 'Clinical Intent', minHeight: '100px' },
                        { field: 'evaluationCriteria' as const, label: 'Evaluation Criteria', minHeight: '150px' },
                      ].map(({ field, label, minHeight }) => (
                        <div key={field}>
                          <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>{label}</label>
                          <textarea
                            value={selectedQuestion[field] as string}
                            onChange={(e) => handleUpdateQuestionField(field, e.target.value)}
                            className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                            style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, outlineColor: UI_COLORS.border.medium, minHeight }}
                          />
                        </div>
                      ))}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={selectedQuestion.required}
                          onClick={() => handleUpdateQuestionField('required', !selectedQuestion.required)}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                          style={{ backgroundColor: selectedQuestion.required ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive }}
                        >
                          <span className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform" style={{ transform: selectedQuestion.required ? 'translateX(22px)' : 'translateX(2px)' }} />
                        </button>
                        <span className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>Required for Case Completion</span>
                      </div>
                      <div className="flex items-center gap-4 pt-4">
                        <Button onClick={handleSaveQuestion} className="px-8 py-3 text-base font-medium transition-colors" style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}>
                          Save Changes
                        </Button>
                        <Button onClick={handleDeleteQuestion} variant="outline" className="px-8 py-3 text-base font-medium transition-colors text-white" style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[0], borderColor: SIMULATION_GROUP_COLOR_PALETTE[0] }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full" style={{ color: UI_COLORS.text.light }}>
                      <p>Select a question to edit or create a new one</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'editPatient' && (
            <div className="flex h-full">
              <aside className="flex flex-col border-r overflow-y-auto" style={{ backgroundColor: UI_COLORS.background.white, borderRightWidth: '1px', borderRightStyle: 'solid', borderRightColor: UI_COLORS.border.default, width: '16rem', minWidth: '16rem' }}>
                <div className="p-6">
                  <button
                    onClick={handleBackFromEditPatient}
                    className="flex items-center gap-2 mb-4 text-sm transition-colors"
                    style={{ color: UI_COLORS.text.body, backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
                    onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to All {aiPersonaLabelPlural}
                  </button>
                  <h2 className="text-xl font-semibold" style={{ color: UI_COLORS.text.heading }}>
                    {selectedPatientForEdit === 'new' ? `Create ${aiPersonaLabel}` : `Edit ${aiPersonaLabel}`}
                  </h2>
                </div>
                <nav className="flex-1 px-3 space-y-1">
                  {[
                    { tab: 'info', label: 'Patient Information' },
                    { tab: 'questions', label: 'Case-specific Key Questions' },
                    { tab: 'materials', label: 'Physical Assessment Materials' },
                  ].map(({ tab, label }) => (
                    <button
                      key={tab}
                      onClick={() => setEditPatientTab(tab as typeof editPatientTab)}
                      className="w-full text-left px-4 py-3 rounded-lg font-medium transition-colors"
                      style={{ backgroundColor: editPatientTab === tab ? UI_COLORS.background.tableHeader : 'transparent', color: UI_COLORS.text.heading, border: 'none', cursor: 'pointer' }}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              </aside>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto" style={{ padding: editPatientTab === 'questions' || editPatientTab === 'materials' ? '0' : '2rem' }}>
                  {editPatientTab === 'info' && (
                    <div className="space-y-6 max-w-2xl">
                      <h3 className="text-2xl font-semibold" style={{ color: UI_COLORS.text.heading }}>
                        {selectedPatientForEdit === 'new' ? `Create ${aiPersonaLabel} Information` : `Edit ${aiPersonaLabel} Information`}
                      </h3>

                      <div className="flex items-center gap-4">
                        <UserAvatar name={editPatientName || 'P'} imageUrl={patientBeingEdited?.photoUrl} size="large" />
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                          <div className="p-3 rounded-full transition-colors" style={{ backgroundColor: UI_COLORS.background.tableHeader, color: UI_COLORS.text.body }}>
                            <Camera className="w-6 h-6" />
                          </div>
                        </label>
                      </div>

                      {[
                        { label: 'Patient Name', value: editPatientName, setter: setEditPatientName, type: 'text' },
                        { label: 'Gender', value: editPatientGender, setter: setEditPatientGender, type: 'text' },
                      ].map(({ label, value, setter, type }) => (
                        <div key={label}>
                          <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>{label}</label>
                          <Input value={value} onChange={(e) => setter(e.target.value)} type={type} className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }} />
                        </div>
                      ))}

                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Patient Age</label>
                        <Input
                          type="number" min="0" max="100" value={editPatientAge}
                          onChange={(e) => { const v = e.target.value; if (v === '' || (/^\d+$/.test(v) && parseInt(v) >= 0 && parseInt(v) <= 100)) setEditPatientAge(v); }}
                          onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.key)) e.preventDefault(); }}
                          className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                          style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Patient Prompt</label>
                        <textarea
                          value={editPatientPrompt}
                          onChange={(e) => setEditPatientPrompt(e.target.value)}
                          className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                          style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, outlineColor: UI_COLORS.border.medium, minHeight: '120px' }}
                          placeholder="Pretend to be a patient with the context you are given..."
                        />
                      </div>

                      <div className="space-y-4">
                        {[
                          { label: 'LLM Upload', type: 'llm' as const },
                          { label: 'Patient Information', type: 'patientInfo' as const },
                          { label: 'Answer Key', type: 'answerKey' as const },
                        ].map(({ label, type }) => (
                          <div key={type} className="flex items-center justify-between p-4 border rounded-lg" style={{ borderColor: UI_COLORS.border.default }}>
                            <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>{label}</span>
                            <label className="cursor-pointer">
                              <input type="file" onChange={(e) => handleFileUpload(type, e)} className="hidden" />
                              <div className="p-2 rounded-lg transition-colors flex items-center gap-2" style={{ backgroundColor: UI_COLORS.background.tableHeader, color: UI_COLORS.text.body }}>
                                <Upload className="w-5 h-5" />
                                Upload
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4">
                        <Button
                          onClick={handleSavePatientChanges}
                          className="px-8 py-3 text-base font-medium transition-colors"
                          style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  )}

                  {editPatientTab === 'questions' && (
                    <div className="max-w-5xl mx-auto p-8 space-y-6">
                      <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>Case-Specific Key Questions</h2>

                      <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                        <Input
                          placeholder="Search Key Questions"
                          value={caseQuestionSearchQuery}
                          onChange={(e) => setCaseQuestionSearchQuery(e.target.value)}
                          className="pl-9 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                          style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                        />
                      </div>

                      <div className="space-y-4">
                        <p className="text-xs italic mb-4" style={{ color: UI_COLORS.text.muted }}>Click on a Key Question entry to expand and edit it.</p>
                        {renderCaseQuestionsAccordion()}
                      </div>

                      <div className="my-8" style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: UI_COLORS.border.default }} />

                      <div className="space-y-4">
                        <h3 className="font-semibold text-lg" style={{ color: UI_COLORS.text.heading }}>GLOBAL KEY QUESTIONS</h3>
                        <p className="text-xs italic mb-4" style={{ color: UI_COLORS.text.muted }}>The following global questions are shown for reference to prevent redundancy. Edit global questions from the Global Rubric tab.</p>

                        <div className="relative mb-6">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                          <Input
                            placeholder="Search Global Questions"
                            value={globalRubricSearchQuery}
                            onChange={(e) => setGlobalRubricSearchQuery(e.target.value)}
                            className="pl-9 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                            style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                          />
                        </div>

                        {renderGlobalRubricAccordion()}
                      </div>
                    </div>
                  )}

                  {editPatientTab === 'materials' && (
                    <div className="max-w-5xl mx-auto p-8 space-y-6">
                      <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>Physical Assessment Materials</h2>

                      <div className="mb-6">
                        <Button
                          onClick={handleAddNewCaseMaterial}
                          className="justify-start gap-2 py-2.5 h-auto font-medium transition-colors"
                          style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                        >
                          <Plus className="w-5 h-5" />
                          Add new Material
                        </Button>
                      </div>

                      <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                        <Input
                          placeholder="Search Materials"
                          value={materialSearchQuery}
                          onChange={(e) => setMaterialSearchQuery(e.target.value)}
                          className="pl-9 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                          style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                        />
                      </div>

                      <div className="space-y-4">
                        <p className="text-xs italic mb-4" style={{ color: UI_COLORS.text.muted }}>Click on a Material entry to expand and edit it.</p>
                        <Accordion type="single" collapsible className="space-y-2">
                          {filteredMaterials.map((material) => (
                            <AccordionItem key={material.id} value={material.id} style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, borderRadius: '0.5rem', overflow: 'hidden' }}>
                              <AccordionTrigger className="px-4 hover:no-underline" style={{ backgroundColor: UI_COLORS.background.white, color: UI_COLORS.text.heading }}>
                                <div className="flex items-center justify-between w-full pr-4">
                                  <span className="font-medium">{material.title}</span>
                                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>{material.materialType}</span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-4 pb-4" style={{ backgroundColor: UI_COLORS.background.white }}>
                                <div className="space-y-4 pt-4">
                                  <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Title</label>
                                    <Input
                                      value={material.title}
                                      onChange={(e) => setCaseMaterials(caseMaterials.map(m => m.id === material.id ? { ...m, title: e.target.value } : m))}
                                      placeholder="Chest X-Ray"
                                      className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                                      style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Description</label>
                                    <textarea
                                      value={material.description}
                                      onChange={(e) => setCaseMaterials(caseMaterials.map(m => m.id === material.id ? { ...m, description: e.target.value } : m))}
                                      placeholder="Frontal chest radiograph obtained as part of the patient's clinical evaluation."
                                      className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                                      style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, outlineColor: UI_COLORS.border.medium, minHeight: '80px' }}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Material Type</label>
                                    <select
                                      value={material.materialType}
                                      onChange={(e) => setCaseMaterials(caseMaterials.map(m => m.id === material.id ? { ...m, materialType: e.target.value } : m))}
                                      className="w-full px-3 py-3 rounded-lg text-base focus:outline-none focus:ring-2"
                                      style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white, outlineColor: UI_COLORS.border.medium }}
                                    >
                                      {['image', 'video', 'document', 'audio', 'other'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Content Upload/Embed</label>
                                    <label className="cursor-pointer">
                                      <input type="file" onChange={(e) => { setSelectedMaterialId(material.id); handleMaterialFileUpload(e); }} className="hidden" />
                                      <div className="inline-flex items-center gap-2 px-6 py-3 rounded-lg transition-colors font-medium" style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}>
                                        <Upload className="w-5 h-5" />
                                        Upload File
                                      </div>
                                    </label>
                                    <p className="text-sm font-medium my-3" style={{ color: UI_COLORS.text.body }}>OR</p>
                                    <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Enter H5P Embed Link</label>
                                    <Input
                                      value={material.embedLink || ''}
                                      onChange={(e) => setCaseMaterials(caseMaterials.map(m => m.id === material.id ? { ...m, embedLink: e.target.value } : m))}
                                      placeholder="Value"
                                      className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                                      style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                                    />
                                  </div>
                                  <div className="border rounded-lg p-8 flex flex-col items-center justify-center" style={{ borderColor: UI_COLORS.border.default, minHeight: '200px' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Eye className="w-5 h-5" style={{ color: UI_COLORS.text.body }} />
                                      <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>Preview</span>
                                    </div>
                                    <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>Rendered preview here</p>
                                  </div>
                                  <div className="flex items-center gap-4 pt-4">
                                    <Button
                                      onClick={() => { if (selectedPatientForEdit) { setSelectedMaterialId(material.id); handleSaveCaseMaterial(); } }}
                                      className="px-8 py-3 text-base font-medium transition-colors"
                                      style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      onClick={() => { if (selectedPatientForEdit) { mockInstructorDataService.deleteCaseMaterial(selectedPatientForEdit, material.id); setCaseMaterials(caseMaterials.filter(m => m.id !== material.id)); } }}
                                      variant="outline"
                                      className="px-8 py-3 text-base font-medium transition-colors text-white"
                                      style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[0], borderColor: SIMULATION_GROUP_COLOR_PALETTE[0] }}
                                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'viewStudent' && selectedStudentId && (
            <div className="flex h-full">
              <aside className="flex flex-col border-r overflow-y-auto" style={{ backgroundColor: UI_COLORS.background.white, borderRightWidth: '1px', borderRightStyle: 'solid', borderRightColor: UI_COLORS.border.default, width: '16rem', minWidth: '16rem' }}>
                <div className="p-6">
                  <button
                    onClick={handleBackFromViewStudent}
                    className="flex items-center gap-2 mb-4 text-sm transition-colors"
                    style={{ color: UI_COLORS.text.body, backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
                    onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to All Students
                  </button>
                  <h2 className="text-xl font-semibold" style={{ color: UI_COLORS.text.heading }}>Overview</h2>
                </div>
                <nav className="flex-1 px-6 space-y-4">
                  {(() => {
                    const studentDetails = instructorService.getStudentDetails(selectedStudentId);
                    if (!studentDetails) return null;
                    return (
                      <>
                        {[
                          { label: 'Student Name', value: studentDetails.name },
                          { label: 'Student Email', value: studentDetails.email },
                          { label: 'Group Name', value: studentDetails.groupName },
                          { label: 'Cases Attempted', value: String(studentDetails.casesAttempted) },
                          { label: 'Case Completion Rate', value: `${studentDetails.caseCompletionRate}%` },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-xs font-medium mb-1" style={{ color: UI_COLORS.text.muted }}>{label}</p>
                            <p className="text-sm" style={{ color: UI_COLORS.text.heading }}>{value}</p>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </nav>
                <div className="p-6 border-t" style={{ borderColor: UI_COLORS.border.default }}>
                  <Button
                    className="w-full justify-center gap-2 py-2.5 h-auto font-medium transition-colors text-white"
                    style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[0], borderColor: SIMULATION_GROUP_COLOR_PALETTE[0] }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    Unenroll Student
                  </Button>
                </div>
              </aside>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8">
                  <div className="max-w-4xl space-y-6">
                    <h2 className="text-2xl font-semibold" style={{ color: UI_COLORS.text.heading }}>Chat History</h2>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Filter by Patient Name:</label>
                      <select
                        value={selectedPatientFilter}
                        onChange={(e) => setSelectedPatientFilter(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg text-base"
                        style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white, color: UI_COLORS.text.heading }}
                      >
                        <option value="pamela">Pamela</option>
                        <option value="timothy">Timothy</option>
                      </select>
                    </div>

                    <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>Click on the dropdown icon to view the student's chat history and export per-case reports.</p>

                    <div className="space-y-4">
                      {instructorService.getChatAttempts(selectedStudentId, selectedPatientFilter).map((attempt) => {
                        const isExpanded = expandedAttemptId === attempt.id;
                        const messages = instructorService.getChatMessages(attempt.id);
                        const notes = instructorService.getChatNotes(attempt.id);

                        return (
                          <div key={attempt.id} className="border rounded-lg overflow-hidden" style={{ borderColor: UI_COLORS.border.default }}>
                            <div
                              className="grid grid-cols-[2fr_2fr_2fr_1fr] gap-4 px-6 py-4 items-center cursor-pointer transition-colors hover:bg-gray-50"
                              style={{ backgroundColor: isExpanded ? UI_COLORS.background.tableHeader : UI_COLORS.background.white }}
                              onClick={() => setExpandedAttemptId(isExpanded ? null : attempt.id)}
                            >
                              <div className="text-base" style={{ color: UI_COLORS.text.heading }}>Attempt {attempt.attemptNumber} - {attempt.date}</div>
                              <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{attempt.completionStatus}</div>
                              <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{attempt.score !== null ? `${attempt.score}%` : '-'}</div>
                              <div className="flex justify-end">
                                <button className="p-2 rounded transition-transform" style={{ border: 'none', cursor: 'pointer', backgroundColor: 'transparent', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="border-t" style={{ borderColor: UI_COLORS.border.default }}>
                                <div className="p-6">
                                  <h3 className="text-lg font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>Chat History</h3>
                                  <div className="border rounded-lg p-4 space-y-4 max-h-96 overflow-y-auto" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                                    {messages.length > 0 ? messages.map((message) => (
                                      <div key={message.message_id} className={`flex gap-3 ${message.student_sent ? 'justify-end' : 'justify-start'}`}>
                                        {!message.student_sent && <div className="flex-shrink-0"><UserAvatar name="Pamela" imageUrl={undefined} size="small" /></div>}
                                        <div
                                          className={`max-w-[70%] rounded-lg px-4 py-3 ${message.student_sent ? 'rounded-br-none' : 'rounded-bl-none'}`}
                                          style={{ backgroundColor: message.student_sent ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.background.hoverLight, color: message.student_sent ? UI_COLORS.button.text : UI_COLORS.text.heading }}
                                        >
                                          <p className="text-sm font-semibold mb-1">{message.student_sent ? 'Student (User)' : 'Pamela (LLM)'}:</p>
                                          <p className="text-sm">{message.message_content}</p>
                                        </div>
                                        {message.student_sent && <div className="flex-shrink-0"><UserAvatar name="Student" imageUrl={undefined} size="small" /></div>}
                                      </div>
                                    )) : (
                                      <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>No chat history available.</p>
                                    )}
                                  </div>
                                </div>

                                <div className="px-6 pb-6">
                                  <h3 className="text-lg font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>Notes</h3>
                                  <div className="border rounded-lg p-4" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                                    <p className="text-sm" style={{ color: notes ? UI_COLORS.text.heading : UI_COLORS.text.muted }}>{notes || 'No notes available.'}</p>
                                  </div>
                                </div>

                                <div className="px-6 pb-6 flex gap-4">
                                  {['Download Chat PDF', 'Download Notes PDF', 'View AI Debrief'].map((label) => (
                                    <Button
                                      key={label}
                                      className="px-6 py-3 text-base font-medium transition-colors"
                                      style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
                                    >
                                      {label}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      
      <AddQuestionDialog
        open={isAddQuestionDialogOpen}
        onOpenChange={setIsAddQuestionDialogOpen}
        questionType={addQuestionType}
        onSave={handleSaveNewQuestion}
      />
      
      <AddPatientSpecificQuestionDialog
        open={isAddPatientQuestionDialogOpen}
        onOpenChange={setIsAddPatientQuestionDialogOpen}
        patients={manageablePatients.map(p => ({ id: p.patient_id, name: p.patient_name }))}
        onSave={handleSaveNewPatientQuestion}
      />
      
      <AddInstructorDialog
        open={isAddInstructorDialogOpen}
        onOpenChange={setIsAddInstructorDialogOpen}
        onAddInstructor={handleAddInstructorSubmit}
      />
    </PageContainer>
  );
}

export default AdminSimulationGroupPage;
