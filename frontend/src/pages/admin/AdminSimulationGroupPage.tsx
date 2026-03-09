import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageContainer from '@/components/PageContainer';
import UserAvatar from '@/components/UserAvatar';
import { mockInstructorDataService, type GlobalRubricQuestion, type CaseMaterial, type QuestionBankItem } from '@/services/instructorService';
import { mockAdminDataService } from '@/services/adminService';
import { ArrowLeft, BarChart3, Users, UserCog, FileText, Eye, Key, Copy, Search, Trash2, Edit, Plus, Menu, Camera, Upload, UserPlus, FileCode, HelpCircle } from 'lucide-react';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AddQuestionDialog } from '@/components/AddQuestionDialog';
import { AddPatientSpecificQuestionDialog } from '@/components/AddPatientSpecificQuestionDialog';

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
  const [promptHistory] = useState([
    { id: 1, text: 'Previous version of the prompt...', savedAt: '2/9/2026, 11:05:11 AM' },
  ]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [, setStudentViewTab] = useState<'overview' | 'chatHistory'>('overview');
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [selectedPatientFilter, setSelectedPatientFilter] = useState<string>('pamela');
  
  // Edit Patient state
  const [selectedPatientForEdit, setSelectedPatientForEdit] = useState<string | null>(null);
  const [editPatientTab, setEditPatientTab] = useState<'info' | 'questions' | 'materials'>('info');
  const [editPatientName, setEditPatientName] = useState('');
  const [editPatientAge, setEditPatientAge] = useState('');
  const [editPatientGender, setEditPatientGender] = useState('');
  const [editPatientPrompt, setEditPatientPrompt] = useState('');
  
  // Global Rubric state
  const [globalRubricQuestions, setGlobalRubricQuestions] = useState<GlobalRubricQuestion[]>(() => 
    mockInstructorDataService.getGlobalRubricQuestions(groupId || '1')
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(() => {
    const questions = mockInstructorDataService.getGlobalRubricQuestions(groupId || '1');
    return questions[0]?.id || null;
  });
  const [rubricSearchQuery, setRubricSearchQuery] = useState('');
  const [isMainSidebarVisible, setIsMainSidebarVisible] = useState(true);
  
  // Question Bank state
  const [questionBankTab, setQuestionBankTab] = useState<'global' | 'patientSpecific'>('global');
  const [includedQuestionIds, setIncludedQuestionIds] = useState<Set<string>>(new Set());
  const [isAddQuestionDialogOpen, setIsAddQuestionDialogOpen] = useState(false);
  const [isAddPatientQuestionDialogOpen, setIsAddPatientQuestionDialogOpen] = useState(false);
  const [addQuestionType, setAddQuestionType] = useState<'global' | 'patientSpecific'>('global');
  const [selectedPatientForQuestionBank, setSelectedPatientForQuestionBank] = useState<string | null>(null);
  
  // Question Bank questions - loaded from service
  const [globalBankQuestions, setGlobalBankQuestions] = useState(() => 
    mockInstructorDataService.getGlobalQuestionBank()
  );
  
  const [patientSpecificBankQuestions, setPatientSpecificBankQuestions] = useState(() => 
    mockInstructorDataService.getPatientSpecificQuestionBank()
  );
  
  // Case-Specific Key Questions state
  const [caseSpecificQuestions, setCaseSpecificQuestions] = useState<GlobalRubricQuestion[]>(() => 
    selectedPatientForEdit ? mockInstructorDataService.getCaseSpecificQuestions(selectedPatientForEdit) : []
  );
  const [selectedCaseQuestionId, setSelectedCaseQuestionId] = useState<string>(() => {
    const questions = selectedPatientForEdit ? mockInstructorDataService.getCaseSpecificQuestions(selectedPatientForEdit) : [];
    return questions[0]?.id || '';
  });
  const [caseQuestionSearchQuery, setCaseQuestionSearchQuery] = useState('');
  
  // Get selected case question
  const selectedCaseQuestion = caseSpecificQuestions.find(q => q.id === selectedCaseQuestionId);
  
  // Filter case questions based on search
  const filteredCaseQuestions = caseSpecificQuestions.filter(q =>
    q.title.toLowerCase().includes(caseQuestionSearchQuery.toLowerCase())
  );

  // Case Materials state
  const [caseMaterials, setCaseMaterials] = useState<CaseMaterial[]>(() => 
    selectedPatientForEdit ? mockInstructorDataService.getCaseMaterials(selectedPatientForEdit) : []
  );
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(() => {
    const materials = selectedPatientForEdit ? mockInstructorDataService.getCaseMaterials(selectedPatientForEdit) : [];
    return materials[0]?.id || '';
  });
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
  
  // Mock instructors data - will be replaced with API call
  const [instructors, setInstructors] = useState([
    { id: 'inst-1', name: 'Tom Doe', email: 'email1@random.com', dateJoined: '1/1/2025' },
    { id: 'inst-2', name: 'Mary Jane', email: 'mary.jane@email.com', dateJoined: '30/2/2025' },
  ]);
  
  // Get organization details
  const organizations = mockAdminDataService.getOrganizations();
  const organization = organizations.find(org => org.id === organizationId);
  
  // Get organization-specific labels from service
  const labels = mockInstructorDataService.getOrganizationLabels(groupId || '1');
  const {
    aiPersona: aiPersonaLabel,
    aiPersonaPlural: aiPersonaLabelPlural,
    aiPersonaLower: aiPersonaLabelLower,
    aiPersonaPluralLower: aiPersonaLabelPluralLower,
    userRole: userRoleLabel,
    userRolePlural: userRoleLabelPlural,
    userRoleLower: userRoleLabelLower,
    userRolePluralLower: userRoleLabelPluralLower,
  } = labels;
  
  // Use state for manageable patients so we can trigger re-renders
  const [manageablePatients, setManageablePatients] = useState(() => 
    mockInstructorDataService.getManageablePatients(groupId || '1')
  );
  
  // State for selected patient
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    patientAnalytics.length > 0 ? patientAnalytics[0].id : ''
  );
  
  // Get current patient data
  const currentPatient = patientAnalytics.find(p => p.id === selectedPatientId);
  const messageCountData = currentPatient 
    ? mockInstructorDataService.getMessageCountData(selectedPatientId)
    : [];
  
  // Fallback values
  const simulationGroupName = simulationGroup?.name || 'Simulation Group';
  const accessCode = simulationGroup?.accessCode || 'XXXX-XXXX-XXXX-XXXX';
  
  // Filter patients based on search query (user searches by name, but ID is the unique identifier)
  const filteredPatients = manageablePatients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter students based on search query (user searches by name, but ID is the unique identifier)
  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(studentSearchQuery.toLowerCase())
  );

  // Filter instructors based on search query (user searches by name, but ID is the unique identifier)
  const filteredInstructors = instructors.filter(instructor =>
    instructor.name.toLowerCase().includes(instructorSearchQuery.toLowerCase())
  );

  /**
   * Handle sign out event
   */
  const handleSignOut = () => {
    navigate('/login');
  };

  /**
   * Handle back to organization page
   */
  const handleBackToAllGroups = () => {
    navigate(`/admin/organization/${organizationId}`);
  };

  /**
   * Handle student view navigation
   */
  const handleStudentView = () => {
    navigate('/student');
  };

  /**
   * Handle generate new access code
   */
  const handleGenerateAccessCode = () => {
    if (groupId) {
      const newCode = mockInstructorDataService.generateAccessCode(groupId);
      console.log('Generated new access code:', newCode);
      // Force re-render by navigating to same route
      navigate(`/admin/organization/${organizationId}/group/${groupId}`, { replace: true });
    }
  };

  /**
   * Handle copy access code
   */
  const handleCopyAccessCode = () => {
    navigator.clipboard.writeText(accessCode);
  };

  /**
   * Handle toggle LLM evaluation for a patient
   */
  const handleToggleLLMEvaluation = (patientId: string, currentValue: boolean) => {
    // Update the state directly with a new array
    setManageablePatients(prevPatients => 
      prevPatients.map(patient => 
        patient.id === patientId 
          ? { ...patient, llmEvaluationEnabled: !currentValue }
          : patient
      )
    );
    // Also update the service data for consistency
    mockInstructorDataService.updatePatientLLMEvaluation(patientId, !currentValue);
  };

  /**
   * Handle delete patient
   */
  const handleDeletePatient = (patientId: string) => {
    if (confirm(`Are you sure you want to delete this ${aiPersonaLabelLower}?`)) {
      // Update the state directly with filtered array
      setManageablePatients(prevPatients => 
        prevPatients.filter(patient => patient.id !== patientId)
      );
      // Also update the service data for consistency
      mockInstructorDataService.deletePatient(patientId);
    }
  };

  /**
   * Handle edit patient
   */
  const handleEditPatient = (patientId: string) => {
    const patient = mockInstructorDataService.getPatient(patientId);
    if (patient) {
      setSelectedPatientForEdit(patientId);
      setEditPatientName(patient.name);
      setEditPatientAge(patient.age.toString());
      setEditPatientGender(patient.gender);
      setEditPatientPrompt(patient.prompt || mockInstructorDataService.getDefaultPatientPrompt());
      setEditPatientTab('info');
      
      // Load case-specific questions and materials
      const questions = mockInstructorDataService.getCaseSpecificQuestions(patientId);
      setCaseSpecificQuestions(questions);
      setSelectedCaseQuestionId(questions[0]?.id || '');
      
      // Initialize includedQuestionIds with the patient's current questions
      const questionIds = mockInstructorDataService.getPatientCaseSpecificQuestionIds(patientId);
      setIncludedQuestionIds(questionIds);
      
      const materials = mockInstructorDataService.getCaseMaterials(patientId);
      setCaseMaterials(materials);
      setSelectedMaterialId(materials[0]?.id || '');
      
      setActiveSection('editPatient');
    }
  };

  /**
   * Handle back from edit patient
   */
  const handleBackFromEditPatient = () => {
    setSelectedPatientForEdit(null);
    setActiveSection('patients');
  };

  /**
   * Handle view student
   */
  const handleViewStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setStudentViewTab('overview');
    setActiveSection('viewStudent');
  };

  /**
   * Handle back from view student
   */
  const handleBackFromViewStudent = () => {
    setSelectedStudentId(null);
    setActiveSection('students');
  };

  /**
   * Handle add new instructor
   */
  const handleAddNewInstructor = () => {
    const email = prompt('Enter instructor email:');
    if (email && email.trim()) {
      const name = prompt('Enter instructor name:');
      if (name && name.trim()) {
        const newInstructor = {
          id: `inst-${Date.now()}`,
          name: name.trim(),
          email: email.trim(),
          dateJoined: new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
        };
        setInstructors(prev => [...prev, newInstructor]);
      }
    }
  };

  /**
   * Handle remove instructor
   */
  const handleRemoveInstructor = (instructorId: string) => {
    const instructor = instructors.find(i => i.id === instructorId);
    if (instructor && confirm(`Are you sure you want to remove ${instructor.name}?`)) {
      setInstructors(prev => prev.filter(i => i.id !== instructorId));
    }
  };

  /**
   * Handle load default prompt
   */
  const handleLoadDefaultPrompt = () => {
    if (selectedPromptType === 'system') {
      setSystemPromptText('Pretend to be a patient with the context you are given. You are helping the pharmacist practice their skills interacting with a patient. Engage with the pharmacist by describing your symptoms to provide them hints on what condition(s) you have.');
    } else {
      setEvaluationPromptText(mockInstructorDataService.getEvaluationPrompt(groupId || '1'));
    }
  };

  /**
   * Handle save prompt
   */
  const handleSavePrompt = () => {
    console.log('Saving prompt:', selectedPromptType, selectedPromptType === 'system' ? systemPromptText : evaluationPromptText);
    // Future: API call to save prompt
    alert('Prompt saved successfully!');
  };

  /**
   * Handle restore prompt version
   */
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

  /**
   * Handle save patient changes
   */
  const handleSavePatientChanges = () => {
    if (selectedPatientForEdit && groupId) {
      if (selectedPatientForEdit === 'new') {
        // Create new patient
        mockInstructorDataService.createPatient(groupId, {
          name: editPatientName,
          age: parseInt(editPatientAge) || 0,
          gender: editPatientGender,
          prompt: editPatientPrompt,
        });
      } else {
        // Update existing patient
        mockInstructorDataService.updatePatient(groupId, {
          id: selectedPatientForEdit,
          name: editPatientName,
          age: parseInt(editPatientAge) || 0,
          gender: editPatientGender,
          prompt: editPatientPrompt,
        });
      }
      setManageablePatients(mockInstructorDataService.getManageablePatients(groupId));
      handleBackFromEditPatient();
    }
  };

  /**
   * Handle photo upload
   */
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedPatientForEdit && groupId) {
      mockInstructorDataService.uploadPatientPhoto(selectedPatientForEdit, file).then(() => {
        setManageablePatients(mockInstructorDataService.getManageablePatients(groupId));
      });
    }
  };

  /**
   * Handle file upload
   */
  const handleFileUpload = (fileType: 'llm' | 'patientInfo' | 'answerKey', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log(`Uploading ${fileType} file:`, file.name);
      // TODO: Implement file upload to server
    }
  };

  // Get the patient being edited
  const patientBeingEdited = selectedPatientForEdit 
    ? mockInstructorDataService.getPatient(selectedPatientForEdit)
    : null;

  /**
   * Handle create new patient
   */
  const handleCreateNewPatient = () => {
    setSelectedPatientForEdit('new');
    setEditPatientName('');
    setEditPatientAge('');
    setEditPatientGender('');
    setEditPatientPrompt(mockInstructorDataService.getDefaultPatientPrompt());
    setEditPatientTab('info');
    setActiveSection('editPatient');
  };
  /**
   * Handle delete question (disassociates from simulation group)
   */
  const handleDeleteQuestion = () => {
    if (!selectedQuestionId) return;
    if (confirm('Are you sure you want to remove this question from the global rubric? It will remain in the question bank.')) {
      mockInstructorDataService.deleteGlobalRubricQuestion(groupId || '1', selectedQuestionId);
      const updatedQuestions = mockInstructorDataService.getGlobalRubricQuestions(groupId || '1');
      setGlobalRubricQuestions(updatedQuestions);
      setSelectedQuestionId(updatedQuestions[0]?.id || null);
      
      // Update the question bank checkmark
      setIncludedQuestionIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedQuestionId);
        return newSet;
      });
    }
  };

  /**
   * Handle save question changes
   */
  const handleSaveQuestion = () => {
    if (!selectedQuestion) return;
    mockInstructorDataService.updateGlobalRubricQuestion(groupId || '1', selectedQuestion);
    console.log('Saving question:', selectedQuestion);
    // TODO: API call to save question
  };

  /**
   * Handle update question field
   */
  const handleUpdateQuestionField = (field: keyof GlobalRubricQuestion, value: string | boolean) => {
    if (!selectedQuestionId) return;
    setGlobalRubricQuestions(globalRubricQuestions.map(q => 
      q.id === selectedQuestionId ? { ...q, [field]: value } : q
    ));
  };

  /**
   * Handle update case-specific question field
   */
  const handleUpdateCaseQuestionField = (field: keyof GlobalRubricQuestion, value: string | boolean) => {
    if (!selectedCaseQuestionId) return;
    setCaseSpecificQuestions(caseSpecificQuestions.map(q => 
      q.id === selectedCaseQuestionId ? { ...q, [field]: value } : q
    ));
  };

  /**
   * Handle delete case-specific question (disassociates from patient)
   */
  const handleDeleteCaseQuestion = () => {
    if (!selectedCaseQuestionId || !selectedPatientForEdit) return;
    if (confirm('Are you sure you want to remove this question from this patient? It will remain in the question bank.')) {
      mockInstructorDataService.deleteCaseSpecificQuestion(selectedPatientForEdit, selectedCaseQuestionId);
      const updatedQuestions = mockInstructorDataService.getCaseSpecificQuestions(selectedPatientForEdit);
      setCaseSpecificQuestions(updatedQuestions);
      setSelectedCaseQuestionId(updatedQuestions[0]?.id || '');
      
      // Update the question bank checkmark if this patient is selected in question bank
      if (selectedPatientForQuestionBank === selectedPatientForEdit) {
        const questionIds = mockInstructorDataService.getPatientCaseSpecificQuestionIds(selectedPatientForEdit);
        setIncludedQuestionIds(questionIds);
      }
    }
  };

  /**
   * Handle save case-specific question changes
   */
  const handleSaveCaseQuestion = () => {
    if (!selectedCaseQuestion || !selectedPatientForEdit) return;
    mockInstructorDataService.updateCaseSpecificQuestion(selectedPatientForEdit, selectedCaseQuestion);
    console.log('Saving case-specific question:', selectedCaseQuestion);
    // TODO: API call to save question
  };

  /**
   * Handle update case material field
   */
  const handleUpdateMaterialField = (field: keyof CaseMaterial, value: string) => {
    if (!selectedMaterialId) return;
    setCaseMaterials(caseMaterials.map(m => 
      m.id === selectedMaterialId ? { ...m, [field]: value } : m
    ));
  };

  /**
   * Handle add new case material
   */
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
    mockInstructorDataService.addCaseMaterial(selectedPatientForEdit, newMaterial);
    setCaseMaterials(mockInstructorDataService.getCaseMaterials(selectedPatientForEdit));
    setSelectedMaterialId(newMaterial.id);
  };

  /**
   * Handle delete case material
   */
  const handleDeleteCaseMaterial = () => {
    if (!selectedMaterialId || !selectedPatientForEdit) return;
    if (confirm('Are you sure you want to delete this material?')) {
      mockInstructorDataService.deleteCaseMaterial(selectedPatientForEdit, selectedMaterialId);
      const updatedMaterials = mockInstructorDataService.getCaseMaterials(selectedPatientForEdit);
      setCaseMaterials(updatedMaterials);
      setSelectedMaterialId(updatedMaterials[0]?.id || '');
    }
  };

  /**
   * Handle save case material changes
   */
  const handleSaveCaseMaterial = () => {
    if (!selectedMaterial || !selectedPatientForEdit) return;
    mockInstructorDataService.updateCaseMaterial(selectedPatientForEdit, selectedMaterial);
    console.log('Saving case material:', selectedMaterial);
    // TODO: API call to save material
  };

  /**
   * Handle material file upload
   */
  const handleMaterialFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedMaterialId) {
      console.log('Uploading material file:', file.name);
      // TODO: Implement file upload to server
      // For now, just update the contentUrl with a placeholder
      handleUpdateMaterialField('contentUrl', URL.createObjectURL(file));
    }
  };

  /**
   * Handle save new question from dialog
   */
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
    
    // Add to question bank via service
    if (addQuestionType === 'global') {
      mockInstructorDataService.addToGlobalQuestionBank(newBankQuestion);
      setGlobalBankQuestions(mockInstructorDataService.getGlobalQuestionBank());
    } else {
      mockInstructorDataService.addToPatientSpecificQuestionBank(newBankQuestion);
      setPatientSpecificBankQuestions(mockInstructorDataService.getPatientSpecificQuestionBank());
    }
    
    // DO NOT automatically add to global rubric or checkmark
    // The question is now in the question bank, but NOT included in the simulation group
    // Instructor must explicitly checkmark it to include it
    
    console.log('Saved new question to bank:', addQuestionType, question);
  };

  /**
   * Handle save new patient-specific question from dialog
   */
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
    
    // Add to question bank via service
    mockInstructorDataService.addToPatientSpecificQuestionBank(newBankQuestion);
    setPatientSpecificBankQuestions(mockInstructorDataService.getPatientSpecificQuestionBank());
    
    // Add to case-specific questions for the selected patient
    const newCaseQuestion: GlobalRubricQuestion = {
      id: newQuestionId,
      title: question.title,
      keyQuestion: question.keyQuestion,
      clinicalIntent: question.clinicalIntent,
      evaluationCriteria: question.evaluationCriteria,
      required: question.required,
    };
    
    mockInstructorDataService.addCaseSpecificQuestion(question.patientId, newCaseQuestion);
    
    // Update includedQuestionIds to checkmark this question for this patient
    // Only update if we're currently viewing this patient in the question bank
    if (questionBankTab === 'patientSpecific' && selectedPatientForQuestionBank === question.patientId) {
      setIncludedQuestionIds(prev => {
        const newSet = new Set(prev);
        newSet.add(newQuestionId);
        return newSet;
      });
    }
    
    // Update case-specific questions if we're editing this patient
    if (selectedPatientForEdit === question.patientId) {
      setCaseSpecificQuestions(mockInstructorDataService.getCaseSpecificQuestions(question.patientId));
    }
    
    console.log('Saved new patient-specific question:', question);
  };

  /**
   * Handle toggle question inclusion in rubric
   */
  const handleToggleQuestionInclusion = (questionId: string, bankQuestion: QuestionBankItem, isChecked: boolean) => {
    const newSet = new Set(includedQuestionIds);
    
    if (isChecked) {
      newSet.add(questionId);
      
      // Add to global rubric if it's a global question
      if (questionBankTab === 'global' || questionId.startsWith('bank-global-')) {
        // Check if already exists in rubric
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
          
          mockInstructorDataService.addGlobalRubricQuestion(groupId || '1', newGlobalRubricQuestion);
          setGlobalRubricQuestions(mockInstructorDataService.getGlobalRubricQuestions(groupId || '1'));
        }
      }
    } else {
      newSet.delete(questionId);
      
      // Remove from global rubric when unchecked
      if (questionBankTab === 'global' || questionId.startsWith('bank-global-')) {
        mockInstructorDataService.deleteGlobalRubricQuestion(groupId || '1', questionId);
        setGlobalRubricQuestions(mockInstructorDataService.getGlobalRubricQuestions(groupId || '1'));
      }
    }
    
    setIncludedQuestionIds(newSet);
  };

  return (
    <PageContainer>
      {/* Header */}
      <header className="flex-shrink-0 flex border-b border-border items-center justify-between py-6 px-8" style={{ backgroundColor: UI_COLORS.header.background }}>
        <div className="flex items-center gap-4">
          {/* Sidebar Toggle Button */}
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

          <UserAvatar
            name={user.name}
            imageUrl={user.avatarUrl}
            size="medium"
          />
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
            style={{ 
              backgroundColor: UI_COLORS.button.primary,
              color: UI_COLORS.button.text
            }}
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
          {/* Navigation Buttons */}
          <nav className="flex-1 p-4 space-y-2">
          <Button
            onClick={() => setActiveSection('analytics')}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'analytics' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <BarChart3 className="w-5 h-5" />
            Analytics
          </Button>

          <Button
            onClick={() => setActiveSection('patients')}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'patients' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <Users className="w-5 h-5" />
            Manage {aiPersonaLabelPlural}
          </Button>

          <Button
            onClick={() => setActiveSection('students')}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'students' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <UserCog className="w-5 h-5" />
            Manage {userRoleLabel}s
          </Button>

          <Button
            onClick={() => setActiveSection('instructors')}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'instructors' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <UserPlus className="w-5 h-5" />
            Manage Instructors
          </Button>

          <Button
            onClick={() => setActiveSection('rubric')}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'rubric' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <FileText className="w-5 h-5" />
            Global Rubric
          </Button>

          <Button
            onClick={() => {
              setActiveSection('questionBank');
              
              // Load included question IDs based on current tab
              if (questionBankTab === 'global') {
                // Get IDs of questions already in global rubric
                const globalRubric = mockInstructorDataService.getGlobalRubricQuestions(groupId || '1');
                const questionIds = new Set(globalRubric.map(q => q.id));
                setIncludedQuestionIds(questionIds);
              } else if (selectedPatientForQuestionBank) {
                // Get IDs of questions already in patient's case-specific rubric
                const questionIds = mockInstructorDataService.getPatientCaseSpecificQuestionIds(selectedPatientForQuestionBank);
                setIncludedQuestionIds(questionIds);
              } else {
                // No patient selected, clear checkmarks
                setIncludedQuestionIds(new Set());
              }
            }}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'questionBank' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <HelpCircle className="w-5 h-5" />
            Question Bank
          </Button>

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
            <p className="text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
              Access Code
            </p>
            <div className="flex items-center gap-2 p-3 rounded-md border" style={{ 
              backgroundColor: UI_COLORS.background.tableHeader,
              borderColor: UI_COLORS.border.default
            }}>
              <Key className="w-4 h-4" style={{ color: UI_COLORS.text.body }} />
              <span className="font-mono text-sm flex-1" style={{ color: UI_COLORS.text.heading }}>
                {accessCode}
              </span>
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
            style={{
              borderColor: UI_COLORS.border.default,
              color: UI_COLORS.text.heading
            }}
          >
            Generate new access code
          </Button>
        </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto" style={{ padding: activeSection === 'rubric' || activeSection === 'questionBank' || activeSection === 'prompts' || activeSection === 'editPatient' || activeSection === 'viewStudent' ? '0' : '2rem' }}>
          {activeSection === 'analytics' && (
            <div className="space-y-6">
              {/* Simulation Group Title */}
              <h2 className="text-3xl font-bold tracking-tight" style={{ color: UI_COLORS.text.heading }}>
                {simulationGroupName}
              </h2>

              {/* Patient Tabs */}
              <div className="flex gap-2 border-b" style={{ borderColor: UI_COLORS.border.default }}>
                {patientAnalytics.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatientId(patient.id)}
                    className="px-6 py-3 font-medium transition-colors border-b-2"
                    style={{
                      color: selectedPatientId === patient.id ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body,
                      borderColor: selectedPatientId === patient.id ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent',
                      backgroundColor: 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    {patient.name}
                  </button>
                ))}
              </div>

              {/* Patient Overview Section */}
              {currentPatient && (
              <div className="border rounded-lg p-6" style={{ borderColor: UI_COLORS.border.default }}>
                <h3 className="text-xl font-semibold mb-6" style={{ color: UI_COLORS.text.heading }}>
                  {currentPatient.name} Overview
                </h3>

                {/* Progress Bars */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                  {/* Instructor Completion Percentage */}
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                      Instructor Completion Percentage:
                    </p>
                    <div className="w-full h-2 rounded-full mb-2" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
                      <div 
                        className="h-full rounded-full" 
                        style={{ 
                          width: `${currentPatient.instructorCompletionPercentage}%`,
                          backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[4]
                        }}
                      />
                    </div>
                    <p className="text-sm text-right" style={{ color: UI_COLORS.text.body }}>
                      {currentPatient.instructorCompletionPercentage.toFixed(2)}%
                    </p>
                  </div>

                  {/* LLM Completion Percentage */}
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                      LLM Completion Percentage:
                    </p>
                    <div className="w-full h-2 rounded-full mb-2" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
                      <div 
                        className="h-full rounded-full" 
                        style={{ 
                          width: `${currentPatient.llmCompletionPercentage}%`,
                          backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[4]
                        }}
                      />
                    </div>
                    <p className="text-sm text-right" style={{ color: UI_COLORS.text.body }}>
                      {currentPatient.llmCompletionPercentage.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Message Counts */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                      Student Message Count: {currentPatient.studentMessageCount}
                    </p>
                    <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                      AI Message Count: {currentPatient.aiMessageCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                      Student Access Count: {currentPatient.studentAccessCount}
                    </p>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="mt-8">
                  <h4 className="text-lg font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>
                    Message Count
                  </h4>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={messageCountData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      barSize={60}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: UI_COLORS.text.body }}
                        axisLine={{ stroke: UI_COLORS.border.default }}
                      />
                      <YAxis 
                        tick={{ fill: UI_COLORS.text.body }}
                        axisLine={{ stroke: UI_COLORS.border.default }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: UI_COLORS.background.white,
                          border: `1px solid ${UI_COLORS.border.default}`,
                          borderRadius: '6px'
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ color: UI_COLORS.text.body }}
                      />
                      <Bar 
                        dataKey="Student Messages" 
                        fill={SIMULATION_GROUP_COLOR_PALETTE[2]} 
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar 
                        dataKey="AI Messages" 
                        fill={SIMULATION_GROUP_COLOR_PALETTE[5]} 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              )}
            </div>
          )}
          
          {activeSection === 'patients' && (
            <div className="space-y-6 max-w-4xl">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: UI_COLORS.text.muted }} />
                <Input
                  placeholder={`Search by ${aiPersonaLabel} Name`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 py-6 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                  style={{ 
                    borderWidth: '1px', 
                    borderStyle: 'solid', 
                    borderColor: UI_COLORS.border.default,
                    backgroundColor: UI_COLORS.background.white
                  }}
                />
              </div>

              {/* Patient Table */}
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: UI_COLORS.border.default }}>
                {/* Table Header */}
                <div className="grid grid-cols-[2fr_1fr_1fr_2fr_2fr] gap-4 px-6 py-4" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    Patient Name
                  </div>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    Age
                  </div>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    Gender
                  </div>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    LLM Evaluation
                  </div>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    Actions
                  </div>
                </div>

                {/* Table Rows */}
                {filteredPatients.map((patient) => (
                  <div 
                    key={patient.id}
                    className="grid grid-cols-[2fr_1fr_1fr_2fr_2fr] gap-4 px-6 py-4 border-t items-center"
                    style={{ borderColor: UI_COLORS.border.default }}
                  >
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                      {patient.name}
                    </div>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                      {patient.age}
                    </div>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                      {patient.gender}
                    </div>
                    <div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={patient.llmEvaluationEnabled}
                        onClick={() => handleToggleLLMEvaluation(patient.id, patient.llmEvaluationEnabled)}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={{ 
                          backgroundColor: patient.llmEvaluationEnabled ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive 
                        }}
                      >
                        <span
                          className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                          style={{
                            transform: patient.llmEvaluationEnabled ? 'translateX(22px)' : 'translateX(2px)'
                          }}
                        />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => handleEditPatient(patient.id)}
                        className="px-6 py-2 text-sm font-medium transition-colors"
                        style={{ 
                          backgroundColor: UI_COLORS.button.primary, 
                          color: UI_COLORS.button.text 
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <button
                        onClick={() => handleDeletePatient(patient.id)}
                        className="p-2 rounded transition-colors"
                        style={{ 
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.background.hover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Trash2 className="w-5 h-5" style={{ color: UI_COLORS.text.body }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Create New Patient Button */}
              <Button
                onClick={handleCreateNewPatient}
                className="px-6 py-6 text-base font-medium transition-colors"
                style={{ 
                  backgroundColor: UI_COLORS.button.primary, 
                  color: UI_COLORS.button.text 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
              >
                <Plus className="w-5 h-5 mr-2" />
                Create New Patient
              </Button>

              {/* Enable Voice for All Patients */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={enableVoiceForAll}
                  onClick={() => setEnableVoiceForAll(!enableVoiceForAll)}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ 
                    backgroundColor: enableVoiceForAll ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive 
                  }}
                >
                  <span
                    className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                    style={{
                      transform: enableVoiceForAll ? 'translateX(22px)' : 'translateX(2px)'
                    }}
                  />
                </button>
                <span 
                  className="text-sm font-medium"
                  style={{ color: UI_COLORS.text.body }}
                >
                  Enable voice conversations for all patients
                </span>
              </div>
            </div>
          )}
          
          {activeSection === 'students' && (
            <div className="space-y-6 max-w-4xl">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: UI_COLORS.text.muted }} />
                <Input
                  placeholder="Search by Student Name"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="pl-10 py-6 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                  style={{ 
                    borderWidth: '1px', 
                    borderStyle: 'solid', 
                    borderColor: UI_COLORS.border.default,
                    backgroundColor: UI_COLORS.background.white
                  }}
                />
              </div>

              <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>
                Click on a student entry to view their performance metrics.
              </p>

              {/* Student Table */}
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: UI_COLORS.border.default }}>
                {/* Table Header */}
                <div className="grid grid-cols-2 gap-4 px-6 py-4" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    Student Name
                  </div>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    Email Address
                  </div>
                </div>

                {/* Table Rows */}
                {filteredStudents.map((student) => (
                  <div 
                    key={student.id}
                    className="grid grid-cols-2 gap-4 px-6 py-4 border-t items-center cursor-pointer transition-colors hover:bg-gray-50"
                    style={{ borderColor: UI_COLORS.border.default }}
                    onClick={() => handleViewStudent(student.id)}
                  >
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                      {student.name}
                    </div>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                      {student.email}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'instructors' && (
            <div className="space-y-6 max-w-5xl">
              {/* Search Bar and Add Button */}
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: UI_COLORS.text.muted }} />
                  <Input
                    placeholder="Search by Instructor Name"
                    value={instructorSearchQuery}
                    onChange={(e) => setInstructorSearchQuery(e.target.value)}
                    className="pl-10 py-6 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                    style={{ 
                      borderWidth: '1px', 
                      borderStyle: 'solid', 
                      borderColor: UI_COLORS.border.default,
                      backgroundColor: UI_COLORS.background.white
                    }}
                  />
                </div>
                <Button
                  onClick={handleAddNewInstructor}
                  className="px-6 py-6 gap-2 transition-colors"
                  style={{ 
                    backgroundColor: UI_COLORS.button.primary, 
                    color: UI_COLORS.button.text 
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                >
                  <Plus className="w-5 h-5" />
                  Add Instructor
                </Button>
              </div>

              {/* Instructor Table */}
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: UI_COLORS.border.default }}>
                {/* Table Header */}
                <div className="grid grid-cols-[2fr_3fr_2fr_auto] gap-4 px-6 py-4" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    Instructor Name
                  </div>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    Email Address
                  </div>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    Date Joined
                  </div>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    Actions
                  </div>
                </div>

                {/* Table Rows */}
                {filteredInstructors.map((instructor) => (
                  <div 
                    key={instructor.id}
                    className="grid grid-cols-[2fr_3fr_2fr_auto] gap-4 px-6 py-4 border-t items-center"
                    style={{ borderColor: UI_COLORS.border.default }}
                  >
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                      {instructor.name}
                    </div>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                      {instructor.email}
                    </div>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                      {instructor.dateJoined}
                    </div>
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
                <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>
                  Question Bank
                </h2>
                
                {/* Tab Switcher */}
                <div className="flex gap-2 border-b" style={{ borderColor: UI_COLORS.border.default }}>
                  <button
                    onClick={() => {
                      setQuestionBankTab('global');
                      // Load global rubric question IDs when switching to global tab
                      const globalRubric = mockInstructorDataService.getGlobalRubricQuestions(groupId || '1');
                      const questionIds = new Set(globalRubric.map(q => q.id));
                      setIncludedQuestionIds(questionIds);
                    }}
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
                    onClick={() => {
                      setQuestionBankTab('patientSpecific');
                      // Load patient-specific question IDs when switching to patient-specific tab
                      if (selectedPatientForQuestionBank) {
                        const questionIds = mockInstructorDataService.getPatientCaseSpecificQuestionIds(selectedPatientForQuestionBank);
                        setIncludedQuestionIds(questionIds);
                      } else {
                        setIncludedQuestionIds(new Set());
                      }
                    }}
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
                      {/* Global questions from question bank */}
                      {globalBankQuestions.map((question) => (
                        <div
                          key={question.id}
                          className="flex items-center justify-between p-4 rounded-lg border transition-colors"
                          style={{
                            borderColor: UI_COLORS.border.default,
                            backgroundColor: UI_COLORS.background.white,
                          }}
                        >
                          <span className="text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>
                            {question.title}
                          </span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={includedQuestionIds.has(question.id)}
                              onChange={(e) => handleToggleQuestionInclusion(question.id, question, e.target.checked)}
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
                      ))}
                      
                      {/* Add New Global Question Button */}
                      <Button
                        onClick={() => {
                          setAddQuestionType('global');
                          setIsAddQuestionDialogOpen(true);
                        }}
                        className="w-full justify-start gap-2 py-3 h-auto font-medium transition-colors mt-4"
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
                    </>
                  )}

                  {questionBankTab === 'patientSpecific' && (
                    <>
                      <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                        Select a patient to manage their patient-specific questions.
                      </p>
                      
                      {/* Patient Selector */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
                          Select Patient
                        </label>
                        <select
                          value={selectedPatientForQuestionBank || ''}
                          onChange={(e) => {
                            const patientId = e.target.value || null;
                            setSelectedPatientForQuestionBank(patientId);
                            if (patientId) {
                              const questionIds = mockInstructorDataService.getPatientCaseSpecificQuestionIds(patientId);
                              setIncludedQuestionIds(questionIds);
                            } else {
                              setIncludedQuestionIds(new Set());
                            }
                          }}
                          className="w-full px-4 py-2 rounded-lg border"
                          style={{
                            borderColor: UI_COLORS.border.default,
                            backgroundColor: UI_COLORS.background.white,
                            color: UI_COLORS.text.heading,
                          }}
                        >
                          <option value="">-- Select a patient --</option>
                          {manageablePatients.map((patient) => (
                            <option key={patient.id} value={patient.id}>
                              {patient.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {selectedPatientForQuestionBank ? (
                        <>
                          {/* Patient-specific questions from question bank */}
                          {patientSpecificBankQuestions.map((question) => (
                            <div
                              key={question.id}
                              className="flex items-center justify-between p-4 rounded-lg border transition-colors"
                              style={{
                                borderColor: UI_COLORS.border.default,
                                backgroundColor: UI_COLORS.background.white,
                              }}
                            >
                              <span className="text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>
                                {question.title}
                              </span>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={includedQuestionIds.has(question.id)}
                                  onChange={(e) => {
                                    const newSet = new Set(includedQuestionIds);
                                    if (e.target.checked) {
                                      newSet.add(question.id);
                                      
                                      // Add to patient's case-specific questions with full data
                                      const newCaseQuestion: GlobalRubricQuestion = {
                                        id: question.id,
                                        title: question.title,
                                        keyQuestion: question.questionText,
                                        clinicalIntent: question.clinicalIntent,
                                        evaluationCriteria: question.evaluationCriteria,
                                        required: question.isMandatory,
                                      };
                                      mockInstructorDataService.addCaseSpecificQuestion(selectedPatientForQuestionBank!, newCaseQuestion);
                                      
                                      // Update case-specific questions if we're editing this patient
                                      if (selectedPatientForEdit === selectedPatientForQuestionBank) {
                                        setCaseSpecificQuestions(mockInstructorDataService.getCaseSpecificQuestions(selectedPatientForQuestionBank!));
                                      }
                                    } else {
                                      newSet.delete(question.id);
                                      
                                      // Remove from patient's case-specific questions
                                      mockInstructorDataService.deleteCaseSpecificQuestion(selectedPatientForQuestionBank!, question.id);
                                      
                                      // Update case-specific questions if we're editing this patient
                                      if (selectedPatientForEdit === selectedPatientForQuestionBank) {
                                        setCaseSpecificQuestions(mockInstructorDataService.getCaseSpecificQuestions(selectedPatientForQuestionBank!));
                                      }
                                    }
                                    setIncludedQuestionIds(newSet);
                                  }}
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
                          ))}
                        </>
                      ) : (
                        <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>
                          Please select a patient to manage their questions.
                        </p>
                      )}
                      
                      {/* Add New Patient-Specific Question Button */}
                      <Button
                        onClick={() => {
                          setIsAddPatientQuestionDialogOpen(true);
                        }}
                        className="w-full justify-start gap-2 py-3 h-auto font-medium transition-colors mt-4"
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
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'prompts' && (
            <div className="flex h-full relative">
              {/* Prompt Type Sidebar */}
              <aside 
                className="flex flex-col border-r"
                style={{ 
                  backgroundColor: UI_COLORS.background.white, 
                  borderRightWidth: '1px',
                  borderRightStyle: 'solid',
                  borderRightColor: UI_COLORS.border.default,
                  width: '16rem',
                  minWidth: '16rem',
                }}
              >
                <div className="p-6">
                  <h3 className="text-sm font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>
                    Prompt Type
                  </h3>
                  <div className="space-y-2">
                    <Button
                      onClick={() => setSelectedPromptType('system')}
                      variant="ghost"
                      className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
                      style={{
                        backgroundColor: selectedPromptType === 'system' ? UI_COLORS.background.tableHeader : 'transparent',
                        color: UI_COLORS.text.heading
                      }}
                    >
                      System Prompt
                    </Button>
                    <Button
                      onClick={() => setSelectedPromptType('evaluation')}
                      variant="ghost"
                      className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
                      style={{
                        backgroundColor: selectedPromptType === 'evaluation' ? UI_COLORS.background.tableHeader : 'transparent',
                        color: UI_COLORS.text.heading
                      }}
                    >
                      Evaluation Prompt
                    </Button>
                  </div>
                </div>
              </aside>

              {/* Main Content */}
              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl space-y-8">
                  {/* Edit Prompt Section */}
                  <div>
                    <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>
                      {selectedPromptType === 'system' ? 'System Prompt' : 'Evaluation Prompt'}
                    </h2>
                    
                    <div className="space-y-4">
                      <label className="text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>
                        Edit Prompt
                      </label>
                      <textarea
                        value={String(selectedPromptType === 'system' ? systemPromptText : evaluationPromptText)}
                        onChange={(e) => selectedPromptType === 'system' ? setSystemPromptText(e.target.value) : setEvaluationPromptText(e.target.value)}
                        placeholder="Prompt goes here..."
                        rows={6}
                        className="w-full px-4 py-3 rounded-md resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={{ 
                          borderWidth: '1px', 
                          borderStyle: 'solid', 
                          borderColor: UI_COLORS.border.default,
                          backgroundColor: UI_COLORS.background.white,
                          color: UI_COLORS.text.heading
                        }}
                      />
                      
                      <div className="flex gap-3 justify-end">
                        <Button
                          onClick={handleLoadDefaultPrompt}
                          variant="outline"
                          className="px-6 transition-colors"
                          style={{ 
                            borderColor: UI_COLORS.border.default,
                            color: UI_COLORS.text.heading,
                            backgroundColor: UI_COLORS.background.white
                          }}
                        >
                          Load Default Prompt
                        </Button>
                        <Button
                          onClick={handleSavePrompt}
                          className="px-6 transition-colors"
                          style={{ 
                            backgroundColor: UI_COLORS.button.primary, 
                            color: UI_COLORS.button.text 
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                        >
                          Save Prompt
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Prompt History Section */}
                  <div>
                    <h3 className="text-xl font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>
                      {selectedPromptType === 'system' ? 'System' : 'Evaluation'} Prompt History
                    </h3>
                    <p className="text-sm mb-6" style={{ color: UI_COLORS.text.muted }}>
                      Browse earlier versions. Restore any version you want to use.
                    </p>

                    {promptHistory.map((version, index) => (
                      <div key={version.id} className="border rounded-lg p-6 mb-4" style={{ borderColor: UI_COLORS.border.default }}>
                        <textarea
                          value={String(version.text)}
                          readOnly
                          placeholder="Prompt goes here..."
                          rows={4}
                          className="w-full px-4 py-3 rounded-md resize-none mb-4"
                          style={{ 
                            borderWidth: '1px', 
                            borderStyle: 'solid', 
                            borderColor: UI_COLORS.border.default,
                            backgroundColor: UI_COLORS.background.tableHeader,
                            color: UI_COLORS.text.heading
                          }}
                        />
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <button
                              className="text-sm"
                              style={{ 
                                color: UI_COLORS.text.muted,
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                padding: 0
                              }}
                            >
                              ← Version {index + 1} of {promptHistory.length} →
                            </button>
                            <span className="text-sm" style={{ color: UI_COLORS.text.muted }}>
                              Saved: {version.savedAt}
                            </span>
                          </div>
                          <Button
                            onClick={() => handleRestorePromptVersion(version.text)}
                            variant="outline"
                            className="px-6 transition-colors"
                            style={{ 
                              borderColor: UI_COLORS.border.default,
                              color: UI_COLORS.text.heading,
                              backgroundColor: UI_COLORS.background.white
                            }}
                          >
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
              {/* Question List Sidebar */}
              <aside 
                className="flex flex-col border-r overflow-y-auto"
                style={{ 
                  backgroundColor: UI_COLORS.background.white, 
                  borderRightWidth: '1px',
                  borderRightStyle: 'solid',
                  borderRightColor: UI_COLORS.border.default,
                  width: '20rem',
                  minWidth: '20rem',
                }}
              >
                {/* Header */}
                <div style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.default }}>
                  <div className="px-6 pt-6 pb-6">
                    <h2 className="font-semibold text-lg mb-3" style={{ color: UI_COLORS.text.heading }}>
                      GLOBAL RUBRIC
                    </h2>
                    <p className="text-xs mb-4" style={{ color: UI_COLORS.text.muted }}>
                      These questions apply to all patients in this simulation group.
                      Global key questions can only be edited here.
                    </p>
                    <p className="text-xs mb-4" style={{ color: UI_COLORS.text.muted }}>
                      In each patient's page, global key questions are view-only.
                    </p>
                    
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                      <Input
                        placeholder="Search Global Key Questions"
                        value={rubricSearchQuery}
                        onChange={(e) => setRubricSearchQuery(e.target.value)}
                        className="pl-9 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                        style={{ 
                          borderWidth: '1px', 
                          borderStyle: 'solid', 
                          borderColor: UI_COLORS.border.default,
                          backgroundColor: UI_COLORS.background.white
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Question List */}
                <div className="flex-1 overflow-y-auto">
                  {filteredRubricQuestions.map((question) => (
                    <button
                      key={question.id}
                      onClick={() => setSelectedQuestionId(question.id)}
                      className="w-full text-left py-3 transition-colors"
                      style={{
                        backgroundColor: selectedQuestionId === question.id ? UI_COLORS.background.tableHeader : 'transparent',
                        borderBottomWidth: '1px',
                        borderBottomStyle: 'solid',
                        borderBottomColor: UI_COLORS.border.default,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedQuestionId !== question.id) {
                          e.currentTarget.style.backgroundColor = UI_COLORS.background.hoverLight;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedQuestionId !== question.id) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <div className="px-6">
                        <p className="text-sm font-medium mb-1" style={{ color: UI_COLORS.text.heading }}>
                          Q{globalRubricQuestions.indexOf(question) + 1} - {question.title}
                        </p>
                        <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                          [{question.required ? 'Required' : 'Optional'}]
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </aside>

              {/* Question Detail Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-8">
                  {selectedQuestion ? (
                    <div className="max-w-4xl space-y-6">
                      <h2 className="text-2xl font-bold" style={{ color: UI_COLORS.text.heading }}>
                        Question {globalRubricQuestions.indexOf(selectedQuestion) + 1}
                      </h2>

                      {/* Title */}
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                          Title
                        </label>
                        <Input
                          value={selectedQuestion.title}
                          onChange={(e) => handleUpdateQuestionField('title', e.target.value)}
                          className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                          style={{ 
                            borderWidth: '1px', 
                            borderStyle: 'solid', 
                            borderColor: UI_COLORS.border.default,
                            backgroundColor: UI_COLORS.background.white
                          }}
                        />
                      </div>

                      {/* Key Question */}
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                          Key Question
                        </label>
                        <textarea
                          value={selectedQuestion.keyQuestion}
                          onChange={(e) => handleUpdateQuestionField('keyQuestion', e.target.value)}
                          className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                          style={{ 
                            borderWidth: '1px', 
                            borderStyle: 'solid', 
                            borderColor: UI_COLORS.border.default,
                            outlineColor: UI_COLORS.border.medium,
                            minHeight: '100px',
                          }}
                        />
                      </div>

                      {/* Clinical Intent */}
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                          Clinical Intent
                        </label>
                        <textarea
                          value={selectedQuestion.clinicalIntent}
                          onChange={(e) => handleUpdateQuestionField('clinicalIntent', e.target.value)}
                          className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                          style={{ 
                            borderWidth: '1px', 
                            borderStyle: 'solid', 
                            borderColor: UI_COLORS.border.default,
                            outlineColor: UI_COLORS.border.medium,
                            minHeight: '100px',
                          }}
                        />
                      </div>

                      {/* Evaluation Criteria */}
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                          Evaluation Criteria
                        </label>
                        <textarea
                          value={selectedQuestion.evaluationCriteria}
                          onChange={(e) => handleUpdateQuestionField('evaluationCriteria', e.target.value)}
                          className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                          style={{ 
                            borderWidth: '1px', 
                            borderStyle: 'solid', 
                            borderColor: UI_COLORS.border.default,
                            outlineColor: UI_COLORS.border.medium,
                            minHeight: '150px',
                          }}
                        />
                      </div>

                      {/* Required Toggle */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={selectedQuestion.required}
                          onClick={() => handleUpdateQuestionField('required', !selectedQuestion.required)}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                          style={{ 
                            backgroundColor: selectedQuestion.required ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive 
                          }}
                        >
                          <span
                            className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                            style={{
                              transform: selectedQuestion.required ? 'translateX(22px)' : 'translateX(2px)'
                            }}
                          />
                        </button>
                        <span className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                          Required for Case Completion
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-4 pt-4">
                        <Button
                          onClick={handleSaveQuestion}
                          className="px-8 py-3 text-base font-medium transition-colors"
                          style={{ 
                            backgroundColor: UI_COLORS.button.primary, 
                            color: UI_COLORS.button.text 
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                        >
                          Save Changes
                        </Button>
                        <Button
                          onClick={handleDeleteQuestion}
                          variant="outline"
                          className="px-8 py-3 text-base font-medium transition-colors text-white"
                          style={{ 
                            backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[0],
                            borderColor: SIMULATION_GROUP_COLOR_PALETTE[0],
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                        >
                          Delete
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
              {/* Edit Patient Sidebar */}
              <aside 
                className="flex flex-col border-r overflow-y-auto"
                style={{ 
                  backgroundColor: UI_COLORS.background.white, 
                  borderRightWidth: '1px',
                  borderRightStyle: 'solid',
                  borderRightColor: UI_COLORS.border.default,
                  width: '16rem',
                  minWidth: '16rem',
                }}
              >
                <div className="p-6">
                  <button
                    onClick={handleBackFromEditPatient}
                    className="flex items-center gap-2 mb-4 text-sm transition-colors"
                    style={{ 
                      color: UI_COLORS.text.body,
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
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
                  <button
                    onClick={() => setEditPatientTab('info')}
                    className="w-full text-left px-4 py-3 rounded-lg font-medium transition-colors"
                    style={{
                      backgroundColor: editPatientTab === 'info' ? UI_COLORS.background.tableHeader : 'transparent',
                      color: UI_COLORS.text.heading,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Patient Information
                  </button>
                  <button
                    onClick={() => setEditPatientTab('questions')}
                    className="w-full text-left px-4 py-3 rounded-lg font-medium transition-colors"
                    style={{
                      backgroundColor: editPatientTab === 'questions' ? UI_COLORS.background.tableHeader : 'transparent',
                      color: UI_COLORS.text.heading,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Case-specific Key Questions
                  </button>
                  <button
                    onClick={() => setEditPatientTab('materials')}
                    className="w-full text-left px-4 py-3 rounded-lg font-medium transition-colors"
                    style={{
                      backgroundColor: editPatientTab === 'materials' ? UI_COLORS.background.tableHeader : 'transparent',
                      color: UI_COLORS.text.heading,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Physical Assessment Materials
                  </button>
                </nav>
              </aside>

              {/* Edit Patient Content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto" style={{ padding: editPatientTab === 'questions' || editPatientTab === 'materials' ? '0' : '2rem' }}>
                  {editPatientTab === 'info' && (
                    <div className="space-y-6 max-w-2xl">
                      <h3 className="text-2xl font-semibold" style={{ color: UI_COLORS.text.heading }}>
                        {selectedPatientForEdit === 'new' ? `Create ${aiPersonaLabel} Information` : `Edit ${aiPersonaLabel} Information`}
                      </h3>

                      {/* Patient Photo */}
                      <div className="flex items-center gap-4">
                        <UserAvatar
                          name={editPatientName || 'P'}
                          imageUrl={patientBeingEdited?.photoUrl}
                          size="large"
                        />
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                          <div 
                            className="p-3 rounded-full transition-colors"
                            style={{ 
                              backgroundColor: UI_COLORS.background.tableHeader,
                              color: UI_COLORS.text.body
                            }}
                          >
                            <Camera className="w-6 h-6" />
                          </div>
                        </label>
                      </div>

                      {/* Patient Name */}
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                          Patient Name
                        </label>
                        <Input
                          value={editPatientName}
                          onChange={(e) => setEditPatientName(e.target.value)}
                          className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                          style={{ 
                            borderWidth: '1px', 
                            borderStyle: 'solid', 
                            borderColor: UI_COLORS.border.default,
                            backgroundColor: UI_COLORS.background.white
                          }}
                        />
                      </div>

                      {/* Patient Age */}
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                          Patient Age
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={editPatientAge}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Only allow numbers and empty string
                            if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 0 && parseInt(value) <= 100)) {
                              setEditPatientAge(value);
                            }
                          }}
                          onKeyDown={(e) => {
                            // Prevent non-numeric characters except backspace, delete, arrow keys, tab
                            if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                          style={{ 
                            borderWidth: '1px', 
                            borderStyle: 'solid', 
                            borderColor: UI_COLORS.border.default,
                            backgroundColor: UI_COLORS.background.white
                          }}
                        />
                      </div>

                      {/* Gender */}
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                          Gender
                        </label>
                        <Input
                          value={editPatientGender}
                          onChange={(e) => setEditPatientGender(e.target.value)}
                          className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                          style={{ 
                            borderWidth: '1px', 
                            borderStyle: 'solid', 
                            borderColor: UI_COLORS.border.default,
                            backgroundColor: UI_COLORS.background.white
                          }}
                        />
                      </div>

                      {/* Patient Prompt */}
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                          Patient Prompt
                        </label>
                        <textarea
                          value={editPatientPrompt}
                          onChange={(e) => setEditPatientPrompt(e.target.value)}
                          className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                          style={{ 
                            borderWidth: '1px', 
                            borderStyle: 'solid', 
                            borderColor: UI_COLORS.border.default,
                            outlineColor: UI_COLORS.border.medium,
                            minHeight: '120px',
                          }}
                          placeholder="Pretend to be a patient with the context you are given. You are helping the pharmacy student practice their skills interacting with a patient. Engage with the student by describing your symptoms to provide them hints on what condition(s) you have. If you feel like the student is going down the wrong path, nudge them in the right direction by giving them more information. This is to help the student identify the proper diagnosis of the patient you are pretending to be."
                        />
                      </div>

                      {/* File Upload Sections */}
                      <div className="space-y-4">
                        {/* LLM Upload */}
                        <div className="flex items-center justify-between p-4 border rounded-lg" style={{ borderColor: UI_COLORS.border.default }}>
                          <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>
                            LLM Upload
                          </span>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              onChange={(e) => handleFileUpload('llm', e)}
                              className="hidden"
                            />
                            <div 
                              className="p-2 rounded-lg transition-colors flex items-center gap-2"
                              style={{ 
                                backgroundColor: UI_COLORS.background.tableHeader,
                                color: UI_COLORS.text.body
                              }}
                            >
                              <Upload className="w-5 h-5" />
                              Upload
                            </div>
                          </label>
                        </div>

                        {/* Patient Information */}
                        <div className="flex items-center justify-between p-4 border rounded-lg" style={{ borderColor: UI_COLORS.border.default }}>
                          <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>
                            Patient Information
                          </span>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              onChange={(e) => handleFileUpload('patientInfo', e)}
                              className="hidden"
                            />
                            <div 
                              className="p-2 rounded-lg transition-colors flex items-center gap-2"
                              style={{ 
                                backgroundColor: UI_COLORS.background.tableHeader,
                                color: UI_COLORS.text.body
                              }}
                            >
                              <Upload className="w-5 h-5" />
                              Upload
                            </div>
                          </label>
                        </div>

                        {/* Answer Key */}
                        <div className="flex items-center justify-between p-4 border rounded-lg" style={{ borderColor: UI_COLORS.border.default }}>
                          <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>
                            Answer Key
                          </span>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              onChange={(e) => handleFileUpload('answerKey', e)}
                              className="hidden"
                            />
                            <div 
                              className="p-2 rounded-lg transition-colors flex items-center gap-2"
                              style={{ 
                                backgroundColor: UI_COLORS.background.tableHeader,
                                color: UI_COLORS.text.body
                              }}
                            >
                              <Upload className="w-5 h-5" />
                              Upload
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Save Button */}
                      <div className="pt-4">
                        <Button
                          onClick={handleSavePatientChanges}
                          className="px-8 py-3 text-base font-medium transition-colors"
                          style={{ 
                            backgroundColor: UI_COLORS.button.primary, 
                            color: UI_COLORS.button.text 
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  )}

                  {editPatientTab === 'questions' && (
                    <div className="flex h-full">
                      {/* Question List Sidebar */}
                      <aside 
                        className="flex flex-col border-r overflow-y-auto"
                        style={{ 
                          backgroundColor: UI_COLORS.background.white, 
                          borderRightWidth: '1px',
                          borderRightStyle: 'solid',
                          borderRightColor: UI_COLORS.border.default,
                          width: '28rem',
                          minWidth: '28rem',
                        }}
                      >
                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto">
                          {/* Case-Specific Questions Section */}
                          <div className="px-6 pt-6 pb-4">
                            <h2 className="font-semibold text-lg mb-3" style={{ color: UI_COLORS.text.heading }}>
                              RUBRIC
                            </h2>
                            <p className="text-xs mb-4 italic" style={{ color: UI_COLORS.text.muted }}>
                              Click on a Key Question entry to edit/delete it.
                            </p>
                            
                            {/* Search */}
                            <div className="relative mb-4">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                              <Input
                                placeholder="Search Key Questions"
                                value={caseQuestionSearchQuery}
                                onChange={(e) => setCaseQuestionSearchQuery(e.target.value)}
                                className="pl-9 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                                style={{ 
                                  borderWidth: '1px', 
                                  borderStyle: 'solid', 
                                  borderColor: UI_COLORS.border.default,
                                  backgroundColor: UI_COLORS.background.white
                                }}
                              />
                            </div>

                            {/* Case-Specific Question List */}
                            <div className="space-y-2">
                              {filteredCaseQuestions.map((question, index) => (
                                <button
                                  key={question.id}
                                  onClick={() => setSelectedCaseQuestionId(question.id)}
                                  className="w-full text-left px-4 py-3 rounded-lg transition-colors"
                                  style={{
                                    backgroundColor: selectedCaseQuestionId === question.id ? UI_COLORS.background.tableHeader : UI_COLORS.background.white,
                                    borderWidth: '1px',
                                    borderStyle: 'solid',
                                    borderColor: UI_COLORS.border.default,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <p className="text-sm font-medium mb-1" style={{ color: UI_COLORS.text.heading }}>
                                    Q{index + 1} - {question.title}
                                  </p>
                                  <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                                    [{question.required ? 'Required' : 'Optional'}]
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Divider */}
                          <div className="my-4 mx-6" style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: UI_COLORS.border.default }} />

                          {/* Global Rubric Section */}
                          <div className="px-6 pb-6">
                            <h2 className="font-semibold text-lg mb-3" style={{ color: UI_COLORS.text.heading }}>
                              GLOBAL RUBRIC
                            </h2>
                            <p className="text-xs mb-4 italic" style={{ color: UI_COLORS.text.muted }}>
                              The following global questions are shown for reference to prevent duplicate questions. Edit global questions from the Global Key Questions page.
                            </p>

                            {/* Global Question List */}
                            <div className="space-y-2">
                              {(() => {
                                // Get the patient's simulation group ID
                                const patientSimGroupId = patientBeingEdited?.simulation_group_id || groupId || '1';
                                // Load global rubric questions for the patient's simulation group
                                const patientGlobalRubric = mockInstructorDataService.getGlobalRubricQuestions(patientSimGroupId);
                                return patientGlobalRubric.map((question, index) => (
                                  <div
                                    key={question.id}
                                    className="w-full text-left px-4 py-3 rounded-lg"
                                    style={{
                                      backgroundColor: UI_COLORS.background.tableHeader,
                                      borderWidth: '1px',
                                      borderStyle: 'solid',
                                      borderColor: UI_COLORS.border.default,
                                      opacity: 0.7,
                                    }}
                                  >
                                    <p className="text-sm font-medium mb-1" style={{ color: UI_COLORS.text.heading }}>
                                      Q{index + 1} - {question.title}
                                    </p>
                                    <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                                      [{question.required ? 'Required' : 'Optional'}]
                                    </p>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                        </div>
                      </aside>

                      {/* Question Detail Area */}
                      <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-0">
                          {selectedCaseQuestion ? (
                            <div className="max-w-4xl space-y-6 p-8">
                              <h2 className="text-2xl font-bold" style={{ color: UI_COLORS.text.heading }}>
                                Question {caseSpecificQuestions.findIndex(q => q.id === selectedCaseQuestionId) + 1}
                              </h2>

                              {/* Title */}
                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                  Title
                                </label>
                                <Input
                                  value={selectedCaseQuestion.title}
                                  onChange={(e) => handleUpdateCaseQuestionField('title', e.target.value)}
                                  placeholder="Chest Pain Characterization"
                                  className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                                  style={{ 
                                    borderWidth: '1px', 
                                    borderStyle: 'solid', 
                                    borderColor: UI_COLORS.border.default,
                                    backgroundColor: UI_COLORS.background.white
                                  }}
                                />
                              </div>

                              {/* Key Question */}
                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                  Key Question
                                </label>
                                <textarea
                                  value={selectedCaseQuestion.keyQuestion}
                                  onChange={(e) => handleUpdateCaseQuestionField('keyQuestion', e.target.value)}
                                  placeholder="Assess the characteristics of the patient's chest pain, including onset, duration, severity, quality and radiation."
                                  className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                                  style={{ 
                                    borderWidth: '1px', 
                                    borderStyle: 'solid', 
                                    borderColor: UI_COLORS.border.default,
                                    outlineColor: UI_COLORS.border.medium,
                                    minHeight: '100px',
                                  }}
                                />
                              </div>

                              {/* Clinical Intent */}
                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                  Clinical Intent
                                </label>
                                <textarea
                                  value={selectedCaseQuestion.clinicalIntent}
                                  onChange={(e) => handleUpdateCaseQuestionField('clinicalIntent', e.target.value)}
                                  placeholder="This question evaluates the student's ability to gather essential details about the chest pain that help differentiate between potentially life-threatening causes (e.g., cardiac ischemia), medication-related causes, gastrointestinal causes and musculoskeletal causes, and to support appropriate clinical decision-making and triage."
                                  className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                                  style={{ 
                                    borderWidth: '1px', 
                                    borderStyle: 'solid', 
                                    borderColor: UI_COLORS.border.default,
                                    outlineColor: UI_COLORS.border.medium,
                                    minHeight: '100px',
                                  }}
                                />
                              </div>

                              {/* Evaluation Criteria */}
                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                  Evaluation Criteria
                                </label>
                                <textarea
                                  value={selectedCaseQuestion.evaluationCriteria}
                                  onChange={(e) => handleUpdateCaseQuestionField('evaluationCriteria', e.target.value)}
                                  placeholder="The student attempts to identify at least 3-4 of the following core characteristics of the chest pain:&#10;• When the pain started, whether the onset was sudden or gradual&#10;• Where the pain is located, localized or diffuse&#10;• Description of the pain (e.g., sharp, dull, pressure, burning, tightness)&#10;• Intensity of pain (e.g., pain scale or descriptive severity)&#10;• How long the pain lasts, whether it is constant or intermittent"
                                  className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                                  style={{ 
                                    borderWidth: '1px', 
                                    borderStyle: 'solid', 
                                    borderColor: UI_COLORS.border.default,
                                    outlineColor: UI_COLORS.border.medium,
                                    minHeight: '150px',
                                  }}
                                />
                              </div>

                              {/* Required Toggle */}
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={selectedCaseQuestion.required}
                                  onClick={() => handleUpdateCaseQuestionField('required', !selectedCaseQuestion.required)}
                                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                  style={{ 
                                    backgroundColor: selectedCaseQuestion.required ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive
                                  }}
                                >
                                  <span
                                    className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                                    style={{
                                      transform: selectedCaseQuestion.required ? 'translateX(22px)' : 'translateX(2px)'
                                    }}
                                  />
                                </button>
                                <span className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                                  Required for Case Completion
                                </span>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-4 pt-4">
                                <Button
                                  onClick={handleSaveCaseQuestion}
                                  className="px-8 py-3 text-base font-medium transition-colors"
                                  style={{ 
                                    backgroundColor: UI_COLORS.button.primary, 
                                    color: UI_COLORS.button.text 
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                                >
                                  Save Changes
                                </Button>
                                <Button
                                  onClick={handleDeleteCaseQuestion}
                                  variant="outline"
                                  className="px-8 py-3 text-base font-medium transition-colors text-white"
                                  style={{ 
                                    backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[0],
                                    borderColor: SIMULATION_GROUP_COLOR_PALETTE[0],
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                >
                                  Delete
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

                  {editPatientTab === 'materials' && (
                    <div className="flex h-full">
                      {/* Materials List Sidebar */}
                      <aside 
                        className="flex flex-col border-r overflow-y-auto"
                        style={{ 
                          backgroundColor: UI_COLORS.background.white, 
                          borderRightWidth: '1px',
                          borderRightStyle: 'solid',
                          borderRightColor: UI_COLORS.border.default,
                          width: '22rem',
                          minWidth: '22rem',
                        }}
                      >
                        {/* Header */}
                        <div style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.default }}>
                          <div className="px-6 pt-6 pb-6">
                            <h2 className="font-semibold text-lg mb-3" style={{ color: UI_COLORS.text.heading }}>
                              Physical Assessment Materials List
                            </h2>
                            <p className="text-xs mb-4 italic" style={{ color: UI_COLORS.text.muted }}>
                              Click on an entry to edit/delete the Physical Assessment Material.
                            </p>
                            
                            {/* Search */}
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                              <Input
                                placeholder="Search Materials"
                                value={materialSearchQuery}
                                onChange={(e) => setMaterialSearchQuery(e.target.value)}
                                className="pl-9 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                                style={{ 
                                  borderWidth: '1px', 
                                  borderStyle: 'solid', 
                                  borderColor: UI_COLORS.border.default,
                                  backgroundColor: UI_COLORS.background.white
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Materials List */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                          {filteredMaterials.map((material) => (
                            <button
                              key={material.id}
                              onClick={() => setSelectedMaterialId(material.id)}
                              className="w-full text-left px-4 py-3 rounded-lg transition-colors"
                              style={{
                                backgroundColor: selectedMaterialId === material.id ? UI_COLORS.background.tableHeader : UI_COLORS.background.white,
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderColor: UI_COLORS.border.default,
                                cursor: 'pointer',
                              }}
                            >
                              <p className="text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>
                                {material.title}
                              </p>
                            </button>
                          ))}
                        </div>

                        {/* Add New Material Button */}
                        <div style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: UI_COLORS.border.default }}>
                          <div className="p-6">
                            <Button
                              onClick={handleAddNewCaseMaterial}
                              className="w-full justify-start gap-2 py-2.5 h-auto font-medium transition-colors"
                              style={{ 
                                backgroundColor: UI_COLORS.button.primary, 
                                color: UI_COLORS.button.text 
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                            >
                              <Plus className="w-5 h-5" />
                              Add new Material
                            </Button>
                          </div>
                        </div>
                      </aside>

                      {/* Material Detail Area */}
                      <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-0">
                          {selectedMaterial ? (
                            <div className="max-w-4xl space-y-6 p-8">
                              <h2 className="text-2xl font-bold" style={{ color: UI_COLORS.text.heading }}>
                                Edit Materials
                              </h2>

                              {/* Title */}
                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                  Title
                                </label>
                                <Input
                                  value={selectedMaterial.title}
                                  onChange={(e) => handleUpdateMaterialField('title', e.target.value)}
                                  placeholder="Chest X-Ray"
                                  className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                                  style={{ 
                                    borderWidth: '1px', 
                                    borderStyle: 'solid', 
                                    borderColor: UI_COLORS.border.default,
                                    backgroundColor: UI_COLORS.background.white
                                  }}
                                />
                              </div>

                              {/* Description */}
                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                  Description
                                </label>
                                <textarea
                                  value={selectedMaterial.description}
                                  onChange={(e) => handleUpdateMaterialField('description', e.target.value)}
                                  placeholder="Frontal chest radiograph obtained as part of the patient's clinical evaluation."
                                  className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                                  style={{ 
                                    borderWidth: '1px', 
                                    borderStyle: 'solid', 
                                    borderColor: UI_COLORS.border.default,
                                    outlineColor: UI_COLORS.border.medium,
                                    minHeight: '80px',
                                  }}
                                />
                              </div>

                              {/* Material Type */}
                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                  Material Type (Dropdown)
                                </label>
                                <select
                                  value={selectedMaterial.materialType}
                                  onChange={(e) => handleUpdateMaterialField('materialType', e.target.value)}
                                  className="w-full px-3 py-3 rounded-lg text-base focus:outline-none focus:ring-2"
                                  style={{ 
                                    borderWidth: '1px', 
                                    borderStyle: 'solid', 
                                    borderColor: UI_COLORS.border.default,
                                    backgroundColor: UI_COLORS.background.white,
                                    outlineColor: UI_COLORS.border.medium,
                                  }}
                                >
                                  <option value="image">Image</option>
                                  <option value="video">Video</option>
                                  <option value="document">Document</option>
                                  <option value="audio">Audio</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>

                              {/* Content Upload/Embed */}
                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                  Content Upload/Embed
                                </label>
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    onChange={handleMaterialFileUpload}
                                    className="hidden"
                                  />
                                  <div 
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg transition-colors font-medium"
                                    style={{ 
                                      backgroundColor: UI_COLORS.button.primary,
                                      color: UI_COLORS.button.text
                                    }}
                                  >
                                    <Upload className="w-5 h-5" />
                                    Upload File
                                  </div>
                                </label>

                                <p className="text-sm font-medium my-3" style={{ color: UI_COLORS.text.body }}>
                                  OR
                                </p>

                                <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                  Enter H5P Embed Link
                                </label>
                                <Input
                                  value={selectedMaterial.embedLink || ''}
                                  onChange={(e) => handleUpdateMaterialField('embedLink', e.target.value)}
                                  placeholder="Value"
                                  className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                                  style={{ 
                                    borderWidth: '1px', 
                                    borderStyle: 'solid', 
                                    borderColor: UI_COLORS.border.default,
                                    backgroundColor: UI_COLORS.background.white
                                  }}
                                />
                              </div>

                              {/* Preview */}
                              <div 
                                className="border rounded-lg p-8 flex flex-col items-center justify-center"
                                style={{ 
                                  borderColor: UI_COLORS.border.default,
                                  minHeight: '200px'
                                }}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <Eye className="w-5 h-5" style={{ color: UI_COLORS.text.body }} />
                                  <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>
                                    Preview
                                  </span>
                                </div>
                                <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>
                                  Rendered preview here
                                </p>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-4 pt-4">
                                <Button
                                  onClick={handleSaveCaseMaterial}
                                  className="px-8 py-3 text-base font-medium transition-colors"
                                  style={{ 
                                    backgroundColor: UI_COLORS.button.primary, 
                                    color: UI_COLORS.button.text 
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                                >
                                  Save Changes
                                </Button>
                                <Button
                                  onClick={handleDeleteCaseMaterial}
                                  variant="outline"
                                  className="px-8 py-3 text-base font-medium transition-colors text-white"
                                  style={{ 
                                    backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[0],
                                    borderColor: SIMULATION_GROUP_COLOR_PALETTE[0],
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full" style={{ color: UI_COLORS.text.light }}>
                              <p>Select a material to edit or create a new one</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'viewStudent' && selectedStudentId && (
            <div className="flex h-full">
              {/* Student View Sidebar */}
              <aside 
                className="flex flex-col border-r overflow-y-auto"
                style={{ 
                  backgroundColor: UI_COLORS.background.white, 
                  borderRightWidth: '1px',
                  borderRightStyle: 'solid',
                  borderRightColor: UI_COLORS.border.default,
                  width: '16rem',
                  minWidth: '16rem',
                }}
              >
                <div className="p-6">
                  <button
                    onClick={handleBackFromViewStudent}
                    className="flex items-center gap-2 mb-4 text-sm transition-colors"
                    style={{ 
                      color: UI_COLORS.text.body,
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
                    onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to All Students
                  </button>
                  <h2 className="text-xl font-semibold" style={{ color: UI_COLORS.text.heading }}>
                    Overview
                  </h2>
                </div>
                
                <nav className="flex-1 px-6 space-y-4">
                  {(() => {
                    const studentDetails = mockInstructorDataService.getStudentDetails(selectedStudentId);
                    if (!studentDetails) return null;
                    
                    return (
                      <>
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: UI_COLORS.text.muted }}>
                            Student Name
                          </p>
                          <p className="text-sm" style={{ color: UI_COLORS.text.heading }}>
                            {studentDetails.name}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: UI_COLORS.text.muted }}>
                            Student Email
                          </p>
                          <p className="text-sm" style={{ color: UI_COLORS.text.heading }}>
                            {studentDetails.email}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: UI_COLORS.text.muted }}>
                            Group Name
                          </p>
                          <p className="text-sm" style={{ color: UI_COLORS.text.heading }}>
                            {studentDetails.groupName}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: UI_COLORS.text.muted }}>
                            Cases Attempted
                          </p>
                          <p className="text-sm" style={{ color: UI_COLORS.text.heading }}>
                            {studentDetails.casesAttempted}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: UI_COLORS.text.muted }}>
                            Case Completion Rate
                          </p>
                          <p className="text-sm" style={{ color: UI_COLORS.text.heading }}>
                            {studentDetails.caseCompletionRate}%
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </nav>

                <div className="p-6 border-t" style={{ borderColor: UI_COLORS.border.default }}>
                  <Button
                    className="w-full justify-center gap-2 py-2.5 h-auto font-medium transition-colors text-white"
                    style={{ 
                      backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[0],
                      borderColor: SIMULATION_GROUP_COLOR_PALETTE[0],
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    Unenroll Student
                  </Button>
                </div>
              </aside>

              {/* Chat History Content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8">
                  <div className="max-w-4xl space-y-6">
                    <h2 className="text-2xl font-semibold" style={{ color: UI_COLORS.text.heading }}>
                      Chat History
                    </h2>

                    {/* Filter by Patient Name */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                        Filter by Patient Name:
                      </label>
                      <select
                        value={selectedPatientFilter}
                        onChange={(e) => setSelectedPatientFilter(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg text-base"
                        style={{ 
                          borderWidth: '1px', 
                          borderStyle: 'solid', 
                          borderColor: UI_COLORS.border.default,
                          backgroundColor: UI_COLORS.background.white,
                          color: UI_COLORS.text.heading
                        }}
                      >
                        <option value="pamela">Pamela</option>
                        <option value="timothy">Timothy</option>
                      </select>
                    </div>

                    <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>
                      Click on the dropdown icon to view the student's chat history and export per-case reports.
                    </p>

                    {/* Chat Attempts */}
                    <div className="space-y-4">
                      {mockInstructorDataService.getChatAttempts(selectedStudentId, selectedPatientFilter).map((attempt) => {
                        const isExpanded = expandedAttemptId === attempt.id;
                        const messages = mockInstructorDataService.getChatMessages(attempt.id);
                        const notes = mockInstructorDataService.getChatNotes(attempt.id);

                        return (
                          <div 
                            key={attempt.id}
                            className="border rounded-lg overflow-hidden"
                            style={{ borderColor: UI_COLORS.border.default }}
                          >
                            {/* Attempt Header Row */}
                            <div 
                              className="grid grid-cols-[2fr_2fr_2fr_1fr] gap-4 px-6 py-4 items-center cursor-pointer transition-colors hover:bg-gray-50"
                              style={{ backgroundColor: isExpanded ? UI_COLORS.background.tableHeader : UI_COLORS.background.white }}
                              onClick={() => setExpandedAttemptId(isExpanded ? null : attempt.id)}
                            >
                              <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                                Attempt {attempt.attemptNumber} - {attempt.date}
                              </div>
                              <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                                {attempt.completionStatus}
                              </div>
                              <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                                {attempt.score !== null ? `${attempt.score}%` : '-'}
                              </div>
                              <div className="flex justify-end">
                                <button
                                  className="p-2 rounded transition-transform"
                                  style={{ 
                                    border: 'none',
                                    cursor: 'pointer',
                                    backgroundColor: 'transparent',
                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Expanded Content */}
                            {isExpanded && (
                              <div className="border-t" style={{ borderColor: UI_COLORS.border.default }}>
                                {/* Chat History Section */}
                                <div className="p-6">
                                  <h3 className="text-lg font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>
                                    Chat History
                                  </h3>
                                  <div 
                                    className="border rounded-lg p-4 space-y-4 max-h-96 overflow-y-auto"
                                    style={{ 
                                      borderColor: UI_COLORS.border.default,
                                      backgroundColor: UI_COLORS.background.white
                                    }}
                                  >
                                    {messages.length > 0 ? (
                                      messages.map((message) => (
                                        <div
                                          key={message.message_id}
                                          className={`flex gap-3 ${message.student_sent ? 'justify-end' : 'justify-start'}`}
                                        >
                                          {/* Avatar for AI patient (left side) */}
                                          {!message.student_sent && (
                                            <div className="flex-shrink-0">
                                              <UserAvatar
                                                name="Pamela"
                                                imageUrl={undefined}
                                                size="small"
                                              />
                                            </div>
                                          )}

                                          {/* Message bubble */}
                                          <div
                                            className={`max-w-[70%] rounded-lg px-4 py-3 ${
                                              message.student_sent ? 'rounded-br-none' : 'rounded-bl-none'
                                            }`}
                                            style={{
                                              backgroundColor: message.student_sent
                                                ? SIMULATION_GROUP_COLOR_PALETTE[2]
                                                : UI_COLORS.background.hoverLight,
                                              color: message.student_sent ? UI_COLORS.button.text : UI_COLORS.text.heading,
                                            }}
                                          >
                                            <p className="text-sm font-semibold mb-1">
                                              {message.student_sent ? 'Student (User)' : 'Pamela (LLM)'}:
                                            </p>
                                            <p className="text-sm">{message.message_content}</p>
                                          </div>

                                          {/* Avatar for student (right side) */}
                                          {message.student_sent && (
                                            <div className="flex-shrink-0">
                                              <UserAvatar
                                                name="Student"
                                                imageUrl={undefined}
                                                size="small"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>
                                        No chat history available.
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Notes Section */}
                                <div className="px-6 pb-6">
                                  <h3 className="text-lg font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>
                                    Notes
                                  </h3>
                                  <div 
                                    className="border rounded-lg p-4"
                                    style={{ 
                                      borderColor: UI_COLORS.border.default,
                                      backgroundColor: UI_COLORS.background.white
                                    }}
                                  >
                                    <p className="text-sm" style={{ color: notes ? UI_COLORS.text.heading : UI_COLORS.text.muted }}>
                                      {notes || 'No notes available.'}
                                    </p>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="px-6 pb-6 flex gap-4">
                                  <Button
                                    className="px-6 py-3 text-base font-medium transition-colors"
                                    style={{ 
                                      backgroundColor: UI_COLORS.button.secondary, 
                                      color: UI_COLORS.button.text 
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
                                  >
                                    Download Chat PDF
                                  </Button>
                                  <Button
                                    className="px-6 py-3 text-base font-medium transition-colors"
                                    style={{ 
                                      backgroundColor: UI_COLORS.button.secondary, 
                                      color: UI_COLORS.button.text 
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
                                  >
                                    Download Notes PDF
                                  </Button>
                                  <Button
                                    className="px-6 py-3 text-base font-medium transition-colors"
                                    style={{ 
                                      backgroundColor: UI_COLORS.button.secondary, 
                                      color: UI_COLORS.button.text 
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
                                  >
                                    View AI Debrief
                                  </Button>
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
      
      {/* Add Question Dialog */}
      <AddQuestionDialog
        open={isAddQuestionDialogOpen}
        onOpenChange={setIsAddQuestionDialogOpen}
        questionType={addQuestionType}
        onSave={handleSaveNewQuestion}
      />
      
      {/* Add Patient-Specific Question Dialog */}
      <AddPatientSpecificQuestionDialog
        open={isAddPatientQuestionDialogOpen}
        onOpenChange={setIsAddPatientQuestionDialogOpen}
        patients={manageablePatients.map(p => ({ id: p.id, name: p.name }))}
        onSave={handleSaveNewPatientQuestion}
      />
    </PageContainer>
  );
}

export default AdminSimulationGroupPage;
