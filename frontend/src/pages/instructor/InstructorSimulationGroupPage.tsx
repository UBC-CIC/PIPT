import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageContainer from '@/components/PageContainer';
import UserAvatar from '@/components/UserAvatar';
import { instructorService, type GlobalRubricQuestion, type CaseMaterial, type UserData, type QuestionBankItem, type KeyQuestionAnalytics, type KeyQuestionCoverage, type StudentDetails, type StudentPatientData } from '@/services/instructorService';
import { type AIDebriefData } from '@/services/studentService';
import { ArrowLeft, BarChart3, Users, UserCog, FileText, Eye, Key, Copy, Search, Trash2, Edit, Plus, Menu, Camera, Upload, HelpCircle, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AddQuestionDialog } from '@/components/AddQuestionDialog';
import { AddPatientSpecificQuestionDialog } from '@/components/AddPatientSpecificQuestionDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAuth } from '@/App';
import { downloadChatPdf } from "@/lib/download-chat-pdf";
import AIDebriefDialog from '../../components/AIDebriefDialog';

/**
 * InstructorSimulationGroupPage Component
 *
 * Displays the simulation group management view for instructors.
 * Includes sidebar navigation and content area for analytics, patient management, etc.
 */
function InstructorSimulationGroupPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { groupId } = useParams();
  const [activeSection, setActiveSection] = useState<'analytics' | 'patients' | 'students' | 'rubric' | 'questionBank' | 'prompt' | 'editPatient' | 'viewStudent'>('analytics');
  const [searchQuery, setSearchQuery] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [scoreDistributionTimePeriod, setScoreDistributionTimePeriod] = useState<'week' | 'month' | 'year' | 'all'>('all');
  const [enableVoiceForAll, setEnableVoiceForAll] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [, setStudentViewTab] = useState<'overview' | 'chatHistory'>('overview');
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(null);
  const [studentDetailsLoading, setStudentDetailsLoading] = useState(false);
  const [studentPatientData, setStudentPatientData] = useState<StudentPatientData | null>(null);
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [selectedPatientFilter, setSelectedPatientFilter] = useState<string>('');

  // Edit Patient state
  const [selectedPatientForEdit, setSelectedPatientForEdit] = useState<string | null>(null);
  const [editPatientTab, setEditPatientTab] = useState<'info' | 'questions' | 'materials'>('info');
  const [editPatientName, setEditPatientName] = useState('');
  const [editPatientAge, setEditPatientAge] = useState('');
  const [editPatientGender, setEditPatientGender] = useState('');
  const [editPatientPrompt, setEditPatientPrompt] = useState('');
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'idle' | 'uploading' | 'success' | 'error'>>({});
  const uploadTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const attemptPdfRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Global Rubric state
  const [globalRubricQuestions, setGlobalRubricQuestions] = useState<GlobalRubricQuestion[]>(() =>
    instructorService.getGlobalRubricQuestions(groupId || '1')
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(() => {
    const questions = instructorService.getGlobalRubricQuestions(groupId || '1');
    return questions[0]?.id || null;
  });
  const [rubricSearchQuery, setRubricSearchQuery] = useState('');
  const [isMainSidebarVisible, setIsMainSidebarVisible] = useState(true);

  // Question Bank state
  const [questionBankTab, setQuestionBankTab] = useState<'global' | 'patientSpecific'>('global');
  const [includedQuestionIds, setIncludedQuestionIds] = useState<Set<string>>(new Set());
  const [pendingQuestionIds, setPendingQuestionIds] = useState<Set<string>>(new Set());
  const [isAddQuestionDialogOpen, setIsAddQuestionDialogOpen] = useState(false);
  const [isAddPatientQuestionDialogOpen, setIsAddPatientQuestionDialogOpen] = useState(false);
  const [addQuestionType] = useState<'global' | 'patientSpecific'>('global');
  const [selectedPatientForQuestionBank, setSelectedPatientForQuestionBank] = useState<string | null>(null);
  const [globalQuestionSearchQuery, setGlobalQuestionSearchQuery] = useState('');
  const [patientQuestionSearchQuery, setPatientQuestionSearchQuery] = useState('');

  // Pagination state for Question Bank
  const [globalPagination, setGlobalPagination] = useState({
    currentPage: 1,
    itemsPerPage: 5
  });

  const [patientPagination, setPatientPagination] = useState({
    currentPage: 1,
    itemsPerPage: 5
  });

  // Question Bank questions - loaded from service
  const [globalBankQuestions, setGlobalBankQuestions] = useState<QuestionBankItem[]>([]);
  const [, setQuestionBankLoading] = useState(false);
  const [, setQuestionBankError] = useState<string | null>(null);

  const [patientSpecificBankQuestions, setPatientSpecificBankQuestions] = useState(() =>
    instructorService.getPatientSpecificQuestionBank()
  );

  // Collect all unique tags from existing questions for autocomplete
  const allExistingTags = Array.from(
    new Set(
      [...globalBankQuestions, ...patientSpecificBankQuestions]
        .flatMap(q => q.tags || [])
        .filter(t => t !== 'patient_specific')
    )
  ).sort();
  
  // Case-Specific Key Questions state
  const [caseSpecificQuestions, setCaseSpecificQuestions] = useState<GlobalRubricQuestion[]>(() =>
    selectedPatientForEdit ? instructorService.getCaseSpecificQuestions(selectedPatientForEdit) : []
  );
  const [caseQuestionSearchQuery, setCaseQuestionSearchQuery] = useState('');
  const [globalRubricSearchQuery, setGlobalRubricSearchQuery] = useState('');

  // Filter case questions based on search
  const filteredCaseQuestions = caseSpecificQuestions.filter(q =>
    q.title.toLowerCase().includes(caseQuestionSearchQuery.toLowerCase())
  );

  // Case Materials state
  const [caseMaterials, setCaseMaterials] = useState<CaseMaterial[]>(() =>
    selectedPatientForEdit ? instructorService.getCaseMaterials(selectedPatientForEdit) : []
  );
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(() => {
    const materials = selectedPatientForEdit ? instructorService.getCaseMaterials(selectedPatientForEdit) : [];
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
  const [user, setUser] = useState<UserData>({ name: 'Instructor', avatarUrl: undefined });
  const [simulationGroup, setSimulationGroup] = useState<any>(null);
  const [patientAnalytics, setPatientAnalytics] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyQuestionCoverage, setKeyQuestionCoverage] = useState<KeyQuestionCoverage[]>([]);
  const [isAccessCodeDialogOpen, setIsAccessCodeDialogOpen] = useState(false);

  // new states for AI Debrief and loading states
  const [isAIDebriefOpen, setIsAIDebriefOpen] = useState(false);
  const [selectedDebriefData, setSelectedDebriefData] = useState<AIDebriefData | null>(null);
  const [isFetchingDebrief, setIsFetchingDebrief] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);

  // Get organization-specific labels from service
  const labels = instructorService.getOrganizationLabels(groupId || '1');
  const {
    aiPersona: aiPersonaLabel,
    aiPersonaPlural: aiPersonaLabelPlural,
    aiPersonaLower: aiPersonaLabelLower,
    userRole: userRoleLabel,
  } = labels;

  // Use state for manageable patients so we can trigger re-renders
  const [manageablePatients, setManageablePatients] = useState<any[]>([]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      if (!groupId) return;

      try {
        const [userData, groupData, analyticsData, studentsData, patientsData, coverageData] = await Promise.all([
          instructorService.getCurrentUser(),
          instructorService.getSimulationGroup(groupId),
          instructorService.getPatientAnalytics(groupId),
          instructorService.getStudents(groupId),
          instructorService.getManageablePatients(groupId),
          instructorService.getKeyQuestionCoverage(groupId),
        ]);

        setUser(userData);
        setSimulationGroup(groupData);
        setPatientAnalytics(analyticsData);
        setStudents(studentsData);
        setManageablePatients(patientsData);
        setKeyQuestionCoverage(coverageData);
      } catch (error) {
        console.error('Error loading instructor data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [groupId]);

  // Load question bank data when the questionBank section is activated
  useEffect(() => {
    if (activeSection === 'questionBank') {
      const loadQuestionBank = async () => {
        try {
          setQuestionBankLoading(true);
          setQuestionBankError(null);
          const questions = await instructorService.getGlobalQuestionBank();
          setGlobalBankQuestions(questions);
        } catch (err) {
          setQuestionBankError(err instanceof Error ? err.message : 'Failed to load question bank');
        } finally {
          setQuestionBankLoading(false);
        }
      };
      loadQuestionBank();
    }
  }, [activeSection]);

  // Load assigned questions from API when rubric or questionBank section is activated
  useEffect(() => {
    if ((activeSection === 'rubric' || activeSection === 'questionBank' || activeSection === 'editPatient') && groupId) {
      instructorService.getSimulationGroupQuestions(groupId)
        .then((assigned: any[]) => {
          const rubricQuestions: GlobalRubricQuestion[] = assigned.map((q: any) => ({
            id: q.question_id,
            group_question_id: q.group_question_id,
            title: q.title || '',
            keyQuestion: q.question_text || '',
            clinicalIntent: '',
            evaluationCriteria: q.evaluation_criteria || '',
            required: q.is_mandatory ?? false,
          }));
          setGlobalRubricQuestions(rubricQuestions);
          setIncludedQuestionIds(new Set(assigned.map((q: any) => q.question_id)));
          setPendingQuestionIds(new Set(assigned.map((q: any) => q.question_id)));
          if (rubricQuestions.length > 0 && !selectedQuestionId) {
            setSelectedQuestionId(rubricQuestions[0].id);
          }
        })
        .catch((err: any) => {
          console.error('Failed to load assigned questions:', err);
        });
    }
  }, [activeSection, groupId]);

  // State for selected patient
  const [selectedPatientId, setSelectedPatientId] = useState<string>('overview');

  // Get current patient data
  const currentPatient = patientAnalytics.find(p => p.patient_id === selectedPatientId);
  const messageCountData = currentPatient
    ? [
        { name: 'Student Messages', value: currentPatient.student_message_count },
        { name: 'AI Messages', value: currentPatient.ai_message_count },
      ]
    : [];
  const donutColors = [SIMULATION_GROUP_COLOR_PALETTE[2], SIMULATION_GROUP_COLOR_PALETTE[5]];
  const totalMessages = currentPatient ? currentPatient.student_message_count + currentPatient.ai_message_count : 0;

  // Key question analytics (per patient) - fetched from dedicated endpoint
  const [keyQuestionAnalytics, setKeyQuestionAnalytics] = useState<KeyQuestionAnalytics[]>([]);

  useEffect(() => {
    if (currentPatient && groupId) {
      instructorService.getPatientKeyQuestionAnalytics(groupId, currentPatient.patient_id)
        .then(setKeyQuestionAnalytics)
        .catch(() => setKeyQuestionAnalytics([]));
    } else {
      setKeyQuestionAnalytics([]);
    }
  }, [currentPatient?.patient_id, groupId]);

  // Score distribution for current patient
  const scoreDistribution = currentPatient
    ? instructorService.getScoreDistribution(groupId || '1', currentPatient.patient_id)
    : [];

  // Fallback values
  const simulationGroupName = simulationGroup?.group_name || 'Simulation Group';
  const accessCode = simulationGroup?.group_access_code || 'XXXX-XXXX-XXXX-XXXX';

  // Filter patients based on search query
  const filteredPatients = manageablePatients.filter(patient =>
    (patient.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter students based on search query
  const filteredStudents = students.filter(student =>
    (student.name || '').toLowerCase().includes(studentSearchQuery.toLowerCase())
  );

  /**
   * Handle sign out event
   */
  const handleSignOut = async () => {
    await signOut();
  };

  /**
   * Handle back to all groups navigation
   */
  const handleBackToAllGroups = () => {
    navigate('/instructor');
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
  const handleGenerateAccessCode = async () => {
    if (groupId) {
      try {
        const newCode = await instructorService.generateAccessCode(groupId);
        console.log('Generated new access code:', newCode);
        const groupData = await instructorService.getSimulationGroup(groupId);
        setSimulationGroup(groupData);
      } catch (error) {
        console.error('Error generating access code:', error);
      }
    }
  };

  /**
   * Handle copy access code
   */
  const handleCopyAccessCode = () => {
    navigator.clipboard.writeText(accessCode);
  };

  /**
   * Handle delete patient
   */
  const handleDeletePatient = (patientId: string) => {
    if (confirm(`Are you sure you want to delete this ${aiPersonaLabelLower}?`)) {
      setManageablePatients(prevPatients =>
        prevPatients.filter(patient => patient.id !== patientId)
      );
      instructorService.deletePatient(patientId);
    }
  };

  /**
   * Handle edit patient
   */
  const handleEditPatient = (patientId: string) => {
    const patient = manageablePatients.find(p => p.id === patientId || p.patient_id === patientId);
    if (patient) {
      setSelectedPatientForEdit(patientId);
      setEditPatientName(patient.patient_name || patient.name || '');
      setEditPatientAge((patient.patient_age || patient.age || '').toString());
      setEditPatientGender(patient.patient_gender || patient.gender || '');
      setEditPatientPrompt(patient.patient_prompt || instructorService.getDefaultPatientPrompt());
      setEditPatientTab('info');

      const questions = instructorService.getCaseSpecificQuestions(patientId);
      setCaseSpecificQuestions(questions);

      const questionIds = instructorService.getPatientCaseSpecificQuestionIds(patientId);
      setIncludedQuestionIds(questionIds);
      setPendingQuestionIds(new Set(questionIds));

      const materials = instructorService.getCaseMaterials(patientId);
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
  const handleViewStudent = async (studentId: string) => {
    setSelectedStudentId(studentId);
    setStudentViewTab('overview');
    setActiveSection('viewStudent');
    setStudentDetails(null);
    setStudentPatientData(null);
    setStudentDetailsLoading(true);
    try {
      const details = await instructorService.getStudentDetails(studentId, groupId || '', simulationGroup?.group_name);
      setStudentDetails(details || null);

      if (details?.email) {
        const patientData = await instructorService.getStudentPatientData(details.email, groupId || '');
        setStudentPatientData(patientData);
        if (patientData.patientNames.length > 0) {
          setSelectedPatientFilter(patientData.patientNames[0]);
        }
      }
    } catch (error) {
      console.error('Error loading student details:', error);
    } finally {
      setStudentDetailsLoading(false);
    }
  };

  /**
   * Handle back from view student
   */
  const handleBackFromViewStudent = () => {
    setSelectedStudentId(null);
    setStudentDetails(null);
    setStudentPatientData(null);
    setActiveSection('students');
  };

  /**
   * Handle save patient changes
   */
  const handleSavePatientChanges = async () => {
    if (selectedPatientForEdit && groupId) {
      if (selectedPatientForEdit === 'new') {
        const newPersonaId = await instructorService.createPatient(groupId, {
          patient_name: editPatientName,
          patient_age: parseInt(editPatientAge) || 0,
          patient_gender: editPatientGender,
          patient_prompt: editPatientPrompt,
        });
        setSelectedPatientForEdit(newPersonaId);
      } else {
        instructorService.updatePatient(groupId, {
          patient_id: selectedPatientForEdit,
          patient_name: editPatientName,
          patient_age: parseInt(editPatientAge) || 0,
          patient_gender: editPatientGender,
          patient_prompt: editPatientPrompt,
        });
      }
      setManageablePatients(await instructorService.getManageablePatients(groupId));
      handleBackFromEditPatient();
    }
  };

  /**
   * Auto-save a new patient before allowing file uploads or other tabs.
   */
  const autoSaveNewPatient = async (): Promise<string | null> => {
    if (selectedPatientForEdit !== 'new' || !groupId) return selectedPatientForEdit;
    if (!editPatientName.trim()) {
      alert('Please enter a patient name before proceeding.');
      return null;
    }
    try {
      const newPersonaId = await instructorService.createPatient(groupId, {
        patient_name: editPatientName,
        patient_age: parseInt(editPatientAge) || 0,
        patient_gender: editPatientGender,
        patient_prompt: editPatientPrompt,
      });
      setSelectedPatientForEdit(newPersonaId);
      setManageablePatients(await instructorService.getManageablePatients(groupId));
      return newPersonaId;
    } catch (error) {
      console.error('Failed to auto-save new patient:', error);
      alert('Failed to save patient. Please try again.');
      return null;
    }
  };

  /**
   * Handle tab switch with auto-save for new patients
   */
  const handleEditPatientTabSwitch = async (tab: 'info' | 'questions' | 'materials') => {
    if (tab !== 'info' && selectedPatientForEdit === 'new') {
      const savedId = await autoSaveNewPatient();
      if (!savedId) return;
    }
    setEditPatientTab(tab);
  };

  /**
   * Handle photo upload
   */
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedPatientForEdit && groupId) {
      let patientId = selectedPatientForEdit;
      if (patientId === 'new') {
        const savedId = await autoSaveNewPatient();
        if (!savedId) return;
        patientId = savedId;
      }
      instructorService.uploadPatientPhoto(groupId, patientId, file).then(async () => {
        setManageablePatients(await instructorService.getManageablePatients(groupId));
      });
    }
  };

  /**
   * Handle file upload
   */
  const handleFileUpload = async (fileType: 'llm' | 'patientInfo' | 'answerKey', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedPatientForEdit && groupId) {
      let patientId = selectedPatientForEdit;
      if (patientId === 'new') {
        const savedId = await autoSaveNewPatient();
        if (!savedId) return;
        patientId = savedId;
      }
      const folderType = fileType === 'llm' ? 'documents' : fileType === 'patientInfo' ? 'info' : 'answer_key' as const;
      if (uploadTimers.current[fileType]) clearTimeout(uploadTimers.current[fileType]);
      setUploadStatus(prev => ({ ...prev, [fileType]: 'uploading' }));
      try {
        await instructorService.uploadPatientFile(groupId, patientId, file, folderType);
        setUploadStatus(prev => ({ ...prev, [fileType]: 'success' }));
        uploadTimers.current[fileType] = setTimeout(() => setUploadStatus(prev => ({ ...prev, [fileType]: 'idle' })), 3000);
      } catch (error) {
        console.error('Failed to upload patient file', { fileType, groupId, patientId, error });
        setUploadStatus(prev => ({ ...prev, [fileType]: 'error' }));
        uploadTimers.current[fileType] = setTimeout(() => setUploadStatus(prev => ({ ...prev, [fileType]: 'idle' })), 5000);
      }
    }
    e.target.value = '';
  };

  // Get the patient being edited
  const patientBeingEdited = selectedPatientForEdit
    ? instructorService.getPatient(selectedPatientForEdit)
    : null;

  /**
   * Handle create new patient
   */
  const handleCreateNewPatient = () => {
    setSelectedPatientForEdit('new');
    setEditPatientName('');
    setEditPatientAge('');
    setEditPatientGender('');
    setEditPatientPrompt(instructorService.getDefaultPatientPrompt());
    setEditPatientTab('info');
    setActiveSection('editPatient');
  };

  /**
   * Handle save question changes
   */
  const handleSaveQuestion = async () => {
    if (!selectedQuestion) {
      console.warn('handleSaveQuestion: no selectedQuestion');
      return;
    }
    try {
      await instructorService.updateGlobalRubricQuestion(groupId || '1', selectedQuestion);
      alert('Question saved successfully.');
    } catch (error) {
      console.error('Failed to save question:', error);
      alert('Failed to save question. Please try again.');
    }
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
    instructorService.addCaseMaterial(selectedPatientForEdit, newMaterial);
    setCaseMaterials(instructorService.getCaseMaterials(selectedPatientForEdit));
    setSelectedMaterialId(newMaterial.id);
  };

  /**
   * Handle save case material changes
   */
  const handleSaveCaseMaterial = () => {
    if (!selectedMaterial || !selectedPatientForEdit) return;
    instructorService.updateCaseMaterial(selectedPatientForEdit, selectedMaterial);
    console.log('Saving case material:', selectedMaterial);
  };

  /**
   * Handle material file upload
   */
  const handleMaterialFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedMaterialId) {
      console.log('Uploading material file:', file.name);
      handleUpdateMaterialField('contentUrl', URL.createObjectURL(file));
    }
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
    const newBankQuestion: any = {
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

    instructorService.addToPatientSpecificQuestionBank(newBankQuestion);
    setPatientSpecificBankQuestions(instructorService.getPatientSpecificQuestionBank());

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

  /**
   * Handle toggle question inclusion in rubric (called only on confirm)
   */
  const handleToggleQuestionInclusion = async (questionId: string, bankQuestion: any, isChecked: boolean) => {
    const newSet = new Set(includedQuestionIds);

    try {
      if (isChecked) {
        newSet.add(questionId);

        if (questionBankTab === 'global' || questionId.startsWith('bank-global-')) {
          await instructorService.assignQuestionToGroup(groupId || '1', questionId);

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
          await instructorService.unassignQuestion(questionId);

          instructorService.deleteGlobalRubricQuestion(groupId || '1', questionId);
          setGlobalRubricQuestions(instructorService.getGlobalRubricQuestions(groupId || '1'));
        }
      }

      setIncludedQuestionIds(newSet);
    } catch (err) {
      setQuestionBankError(err instanceof Error ? err.message : 'Failed to update question assignment');
    }
  };

  /**
   * Handle toggling a pending checkbox
   */
  const handleTogglePendingQuestion = (questionId: string) => {
    setPendingQuestionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  /**
   * Confirm pending selection changes and apply to rubric
   */
  const handleConfirmSelections = async () => {
    const allBankQuestions = questionBankTab === 'global' ? globalBankQuestions : patientSpecificBankQuestions;

    try {
      if (questionBankTab === 'global') {
        const idsToAdd = Array.from(pendingQuestionIds).filter(id => !includedQuestionIds.has(id));
        const idsToRemove = Array.from(includedQuestionIds).filter(id => !pendingQuestionIds.has(id));

        if (idsToAdd.length > 0) {
          await instructorService.assignQuestionToGroup(groupId || '1', idsToAdd);
          for (const id of idsToAdd) {
            const bankQ = allBankQuestions.find(q => q.id === id);
            if (bankQ) {
              const existingQuestion = globalRubricQuestions.find(q => q.id === id);
              if (!existingQuestion) {
                const newGlobalRubricQuestion: GlobalRubricQuestion = {
                  id: bankQ.id,
                  title: bankQ.title,
                  keyQuestion: bankQ.questionText,
                  clinicalIntent: bankQ.clinicalIntent,
                  evaluationCriteria: bankQ.evaluationCriteria,
                  required: bankQ.isMandatory,
                };
                instructorService.addGlobalRubricQuestion(groupId || '1', newGlobalRubricQuestion);
              }
            }
          }
          setGlobalRubricQuestions(instructorService.getGlobalRubricQuestions(groupId || '1'));
        }

        for (const id of idsToRemove) {
          const bankQ = allBankQuestions.find(q => q.id === id);
          if (bankQ) await handleToggleQuestionInclusion(id, bankQ, false);
        }
      } else if (questionBankTab === 'patientSpecific' && selectedPatientForQuestionBank) {
        pendingQuestionIds.forEach(id => {
          if (!includedQuestionIds.has(id)) {
            const bankQ = allBankQuestions.find(q => q.id === id);
            if (bankQ) {
              const newCaseQuestion: GlobalRubricQuestion = {
                id: bankQ.id,
                title: bankQ.title,
                keyQuestion: bankQ.questionText,
                clinicalIntent: bankQ.clinicalIntent,
                evaluationCriteria: bankQ.evaluationCriteria,
                required: bankQ.isMandatory,
              };
              instructorService.addCaseSpecificQuestion(selectedPatientForQuestionBank, newCaseQuestion);
              if (selectedPatientForEdit === selectedPatientForQuestionBank) {
                setCaseSpecificQuestions(instructorService.getCaseSpecificQuestions(selectedPatientForQuestionBank));
              }
            }
          }
        });
        includedQuestionIds.forEach(id => {
          if (!pendingQuestionIds.has(id)) {
            instructorService.deleteCaseSpecificQuestion(selectedPatientForQuestionBank, id);
            if (selectedPatientForEdit === selectedPatientForQuestionBank) {
              setCaseSpecificQuestions(instructorService.getCaseSpecificQuestions(selectedPatientForQuestionBank));
            }
          }
        });
      }

      setIncludedQuestionIds(new Set(pendingQuestionIds));
    } catch (err) {
      setQuestionBankError(err instanceof Error ? err.message : 'Failed to confirm selections');
    }
  };

  /**
   * Reset pending selections back to current included state
   */
  const handleResetSelections = () => {
    setPendingQuestionIds(new Set(includedQuestionIds));
  };

  // Calculate if there are pending changes
  const hasPendingChanges = (() => {
    if (pendingQuestionIds.size !== includedQuestionIds.size) return true;
    for (const id of pendingQuestionIds) {
      if (!includedQuestionIds.has(id)) return true;
    }
    return false;
  })();

  const pendingAddCount = [...pendingQuestionIds].filter(id => !includedQuestionIds.has(id)).length;
  const pendingRemoveCount = [...includedQuestionIds].filter(id => !pendingQuestionIds.has(id)).length;

  /**
   * Pagination helper: Get paginated questions
   */
  const getPaginatedQuestions = (questions: QuestionBankItem[], currentPage: number, itemsPerPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return questions.slice(startIndex, endIndex);
  };

  /**
   * Pagination helper: Calculate total pages
   */
  const getTotalPages = (totalItems: number, itemsPerPage: number) => {
    return Math.ceil(totalItems / itemsPerPage);
  };

  const handleGlobalPageChange = (newPage: number) => {
    setGlobalPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const handlePatientPageChange = (newPage: number) => {
    setPatientPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const handleGlobalItemsPerPageChange = (newItemsPerPage: number) => {
    setGlobalPagination({ currentPage: 1, itemsPerPage: newItemsPerPage });
  };

  const handlePatientItemsPerPageChange = (newItemsPerPage: number) => {
    setPatientPagination({ currentPage: 1, itemsPerPage: newItemsPerPage });
  };

  const filteredGlobalQuestions = globalBankQuestions.filter(q =>
    q.title.toLowerCase().includes(globalQuestionSearchQuery.toLowerCase())
  );

  const filteredPatientQuestions = patientSpecificBankQuestions.filter(q =>
    q.title.toLowerCase().includes(patientQuestionSearchQuery.toLowerCase())
  );

  const paginatedGlobalQuestions = getPaginatedQuestions(
    filteredGlobalQuestions,
    globalPagination.currentPage,
    globalPagination.itemsPerPage
  );

  const paginatedPatientQuestions = getPaginatedQuestions(
    filteredPatientQuestions,
    patientPagination.currentPage,
    patientPagination.itemsPerPage
  );

  const globalTotalPages = getTotalPages(filteredGlobalQuestions.length, globalPagination.itemsPerPage);
  const patientTotalPages = getTotalPages(filteredPatientQuestions.length, patientPagination.itemsPerPage);

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-full">
          <p style={{ color: UI_COLORS.text.muted }}>Loading...</p>
        </div>
      </PageContainer>
    );
  }

  /**
   * Handle fetching and viewing the AI Debrief for a specific session/attempt
   */
  const handleViewAIDebrief = async (attemptId: string) => {
    setIsFetchingDebrief(attemptId);
    try {
      const data = await instructorService.fetchDebrief(attemptId, groupId || '');
      if (data) {
        setSelectedDebriefData(data);
        setIsAIDebriefOpen(true);
      } else {
        alert('Debrief is still generating or not available for this session.');
      }
    } catch (error) {
      console.error('Failed to fetch AI debrief:', error);
      alert('Failed to load AI Debrief. Please try again.');
    } finally {
      setIsFetchingDebrief(null);
    }
  };

  /**
   * Handle downloading the Notes PDF
   */
  const handleDownloadNotesPDF = (attemptId: string) => {
    try {
      const notes = studentPatientData?.notes[attemptId] || '';
      const blob = new Blob([notes || 'No notes available.'], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Notes_${attemptId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download notes:', error);
    }
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
              Back to All Groups
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
              onClick={() => setActiveSection('rubric')}
              variant="ghost"
              className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
              style={{
                backgroundColor: activeSection === 'rubric' ? UI_COLORS.background.tableHeader : 'transparent',
                color: UI_COLORS.text.heading
              }}
            >
              <FileText className="w-5 h-5" />
              Global Key Questions
            </Button>

            <Button
              onClick={() => {
                setActiveSection('questionBank');

                if (questionBankTab === 'global') {
                  const globalRubric = instructorService.getGlobalRubricQuestions(groupId || '1');
                  const questionIds = new Set(globalRubric.map(q => q.id));
                  setIncludedQuestionIds(questionIds);
                  setPendingQuestionIds(new Set(questionIds));
                } else if (selectedPatientForQuestionBank) {
                  const questionIds = instructorService.getPatientCaseSpecificQuestionIds(selectedPatientForQuestionBank);
                  setIncludedQuestionIds(questionIds);
                  setPendingQuestionIds(new Set(questionIds));
                } else {
                  setIncludedQuestionIds(new Set());
                  setPendingQuestionIds(new Set());
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
              onClick={() => setActiveSection('prompt')}
              variant="ghost"
              className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
              style={{
                backgroundColor: activeSection === 'prompt' ? UI_COLORS.background.tableHeader : 'transparent',
                color: UI_COLORS.text.heading
              }}
            >
              <Eye className="w-5 h-5" />
              View Evaluation Prompt
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
              onClick={() => setIsAccessCodeDialogOpen(true)}
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
        <main className="flex-1 overflow-y-auto" style={{ padding: activeSection === 'rubric' || activeSection === 'questionBank' || activeSection === 'editPatient' || activeSection === 'viewStudent' ? '0' : '2rem' }}>
          {activeSection === 'analytics' && (
            <div className="space-y-6">
              {/* Simulation Group Title */}
              <h2 className="text-3xl font-bold tracking-tight" style={{ color: UI_COLORS.text.heading }}>
                {simulationGroupName}
              </h2>

              {/* Tabs: Overview + Patient Tabs */}
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

              {/* ===== OVERVIEW TAB ===== */}
              {selectedPatientId === 'overview' && simulationGroup && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-6">
                    {/* Personas Card */}
                    <div className="border rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveSection('patients')} style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                      <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[2] + '1a' }}>
                        <Users className="w-5 h-5" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[2] }} />
                      </div>
                      <p className="text-2xl font-bold" style={{ color: UI_COLORS.text.heading }}>{simulationGroup.persona_count}</p>
                      <p className="text-sm mt-1" style={{ color: UI_COLORS.text.muted }}>{aiPersonaLabelPlural}</p>
                    </div>
                    {/* Students Card */}
                    <div className="border rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveSection('students')} style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                      <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[5] + '1a' }}>
                        <Users className="w-5 h-5" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[5] }} />
                      </div>
                      <p className="text-2xl font-bold" style={{ color: UI_COLORS.text.heading }}>{simulationGroup.student_count}</p>
                      <p className="text-sm mt-1" style={{ color: UI_COLORS.text.muted }}>Students</p>
                    </div>
                    {/* Instructors Card */}
                    <div className="border rounded-xl p-4 text-center" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                      <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[4] + '1a' }}>
                        <UserCog className="w-5 h-5" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[4] }} />
                      </div>
                      <p className="text-2xl font-bold" style={{ color: UI_COLORS.text.heading }}>{simulationGroup.instructor_count ?? 0}</p>
                      <p className="text-sm mt-1" style={{ color: UI_COLORS.text.muted }}>Instructors</p>
                    </div>
                  </div>

                  {/* Per-Patient Completion Percentage - Horizontal Bar Graph */}
                  <div className="border rounded-lg p-6" style={{ borderColor: UI_COLORS.border.default }}>
                    <h3 className="text-xl font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                      {aiPersonaLabel} Completion Rate
                    </h3>
                    <p className="text-sm mb-6" style={{ color: UI_COLORS.text.muted }}>
                      Percentage of students who have reached the debrief with each {aiPersonaLabelLower}.
                    </p>
                    {patientAnalytics.length > 0 ? (
                      <ResponsiveContainer width="100%" height={Math.max(250, patientAnalytics.length * 50)}>
                        <BarChart
                            data={patientAnalytics.map(p => ({
                            patientName: p.patient_name || p.persona_name,
                            completionPercentage: Math.round(p.instructor_completion_percentage ?? 0),
                          }))}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                          <XAxis
                            type="number"
                            domain={[0, 100]}
                            tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                            axisLine={{ stroke: UI_COLORS.border.default }}
                            tickFormatter={(val: number) => `${val}%`}
                          />
                          <YAxis
                            type="category"
                            dataKey="patientName"
                            width={180}
                            tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                            axisLine={{ stroke: UI_COLORS.border.default }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: UI_COLORS.background.white,
                              border: `1px solid ${UI_COLORS.border.default}`,
                              borderRadius: '6px'
                            }}
                            formatter={(value: number | undefined) => [`${value ?? 0}%`, 'Completed']}
                          />
                          <Bar
                            dataKey="completionPercentage"
                            fill={SIMULATION_GROUP_COLOR_PALETTE[2]}
                            radius={[0, 4, 4, 0]}
                            barSize={28}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>No {aiPersonaLabelLower}s configured.</p>
                    )}
                  </div>

                  {/* Key Question Coverage per Patient - Horizontal Bar */}
                  {keyQuestionCoverage.length > 0 && (
                    <div className="border rounded-lg p-6" style={{ borderColor: UI_COLORS.border.default }}>
                      <h3 className="text-xl font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                        Key Question Coverage by {aiPersonaLabel}
                      </h3>
                      <p className="text-sm mb-6" style={{ color: UI_COLORS.text.muted }}>
                        Average percentage of key questions covered by students who completed their interaction.
                      </p>
                      <ResponsiveContainer width="100%" height={Math.max(250, keyQuestionCoverage.length * 50)}>
                        <BarChart
                          data={keyQuestionCoverage}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                          <XAxis
                            type="number"
                            domain={[0, 100]}
                            tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                            axisLine={{ stroke: UI_COLORS.border.default }}
                            tickFormatter={(val: number) => `${val}%`}
                          />
                          <YAxis
                            type="category"
                            dataKey="patientName"
                            width={180}
                            tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                            axisLine={{ stroke: UI_COLORS.border.default }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: UI_COLORS.background.white,
                              border: `1px solid ${UI_COLORS.border.default}`,
                              borderRadius: '6px'
                            }}
                            formatter={(value: number | undefined, _name: string | undefined, props: { payload?: { studentsDebriefed?: number } }) => [
                              `${value ?? 0}% avg (${props.payload?.studentsDebriefed ?? 0} students debriefed)`,
                              'Coverage'
                            ]}
                          />
                          <Bar
                            dataKey="avgCoverage"
                            radius={[0, 4, 4, 0]}
                            barSize={28}
                          >
                            {keyQuestionCoverage.map((entry, index) => (
                              <Cell
                                key={`cov-${index}`}
                                fill={
                                  entry.avgCoverage >= 75 ? '#22c55e' :
                                  entry.avgCoverage >= 55 ? '#eab308' :
                                  '#ef4444'
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex items-center justify-center gap-6 mt-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                          <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>Good (&ge;75%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#eab308' }} />
                          <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>Average (55&ndash;74%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                          <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>Needs Improvement (&lt;55%)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== PER-PATIENT TAB ===== */}
              {currentPatient && (
                <div className="border rounded-lg p-6" style={{ borderColor: UI_COLORS.border.default }}>
                  <h3 className="text-xl font-semibold mb-6" style={{ color: UI_COLORS.text.heading }}>
                    {currentPatient.patient_name} Overview
                  </h3>

                  {/* Message Counts + Student Access */}
                  <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="border rounded-xl p-5 text-center" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                      <p className="text-2xl font-bold" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[2] }}>{currentPatient.student_message_count}</p>
                      <p className="text-sm mt-1" style={{ color: UI_COLORS.text.muted }}>Student Messages</p>
                    </div>
                    <div className="border rounded-xl p-5 text-center" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                      <p className="text-2xl font-bold" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[5] }}>{currentPatient.ai_message_count}</p>
                      <p className="text-sm mt-1" style={{ color: UI_COLORS.text.muted }}>AI Messages</p>
                    </div>
                    <div className="border rounded-xl p-5 text-center" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                      <p className="text-2xl font-bold" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[4] }}>{currentPatient.student_access_count}</p>
                      <p className="text-sm mt-1" style={{ color: UI_COLORS.text.muted }}>Student Access Count</p>
                    </div>
                  </div>

                  {/* Key Questions Asked - Horizontal Bar Graph (per persona) */}
                  {keyQuestionAnalytics.length > 0 && (
                    <div className="mt-8">
                      <h4 className="text-lg font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                        Key Questions &mdash; Students Asked
                      </h4>
                      <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                        Number of students who asked each key question for {currentPatient.patient_name}.
                      </p>
                      <ResponsiveContainer width="100%" height={Math.max(250, keyQuestionAnalytics.length * 50)}>
                        <BarChart
                          data={keyQuestionAnalytics}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                          <XAxis
                            type="number"
                            tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                            axisLine={{ stroke: UI_COLORS.border.default }}
                            allowDecimals={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="questionTitle"
                            width={180}
                            tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                            axisLine={{ stroke: UI_COLORS.border.default }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: UI_COLORS.background.white,
                              border: `1px solid ${UI_COLORS.border.default}`,
                              borderRadius: '6px'
                            }}
                            formatter={(value: number | undefined) => [`${value ?? 0} students`, 'Asked']}
                          />
                          <Bar
                            dataKey="studentsAnswered"
                            fill={SIMULATION_GROUP_COLOR_PALETTE[2]}
                            radius={[0, 4, 4, 0]}
                            barSize={28}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Donut Chart - Message Distribution */}
                  <div className="mt-8">
                    <h4 className="text-lg font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>
                      Message Distribution
                    </h4>
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={messageCountData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                        >
                          {messageCountData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={donutColors[index % donutColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: UI_COLORS.background.white,
                            border: `1px solid ${UI_COLORS.border.default}`,
                            borderRadius: '6px'
                          }}
                          formatter={(value: number | undefined, name: string | undefined) => [`${value ?? 0} messages`, name ?? '']}
                        />
                        <Legend
                          wrapperStyle={{ color: UI_COLORS.text.body }}
                        />
                        {/* Center text */}
                        <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" style={{ fill: UI_COLORS.text.heading, fontSize: '28px', fontWeight: 700 }}>
                          {totalMessages}
                        </text>
                        <text x="50%" y="56%" textAnchor="middle" dominantBaseline="central" style={{ fill: UI_COLORS.text.muted, fontSize: '13px' }}>
                          Total Messages
                        </text>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Score Distribution - Histogram */}
                  <div className="mt-8">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                          Score Distribution
                        </h4>
                        <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>
                          Distribution of student scores for {currentPatient.patient_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium whitespace-nowrap" style={{ color: UI_COLORS.text.body }}>
                          Time Period:
                        </label>
                        <select
                          value={scoreDistributionTimePeriod}
                          onChange={(e) => setScoreDistributionTimePeriod(e.target.value as 'week' | 'month' | 'year' | 'all')}
                          className="px-3 py-2 rounded-lg border text-sm"
                          style={{
                            borderColor: UI_COLORS.border.default,
                            backgroundColor: UI_COLORS.background.white,
                            color: UI_COLORS.text.heading,
                          }}
                        >
                          <option value="week">Last Week</option>
                          <option value="month">Last Month</option>
                          <option value="year">Last Year</option>
                          <option value="all">All Time</option>
                        </select>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={scoreDistribution}
                        margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                        barSize={50}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                        <XAxis
                          dataKey="range"
                          tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                          axisLine={{ stroke: UI_COLORS.border.default }}
                          label={{ value: 'Score Range (%)', position: 'insideBottom', offset: -10, fill: UI_COLORS.text.muted, fontSize: 12 }}
                        />
                        <YAxis
                          tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                          axisLine={{ stroke: UI_COLORS.border.default }}
                          allowDecimals={false}
                          label={{ value: 'Students', angle: -90, position: 'insideLeft', fill: UI_COLORS.text.muted, fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: UI_COLORS.background.white,
                            border: `1px solid ${UI_COLORS.border.default}`,
                            borderRadius: '6px'
                          }}
                          formatter={(value: number | undefined) => [`${value ?? 0} students`, 'Count']}
                        />
                        <Bar
                          dataKey="count"
                          radius={[4, 4, 0, 0]}
                        >
                          {scoreDistribution.map((_entry, index) => (
                            <Cell
                              key={`dist-${index}`}
                              fill={[
                                '#ef4444',
                                '#f97316',
                                '#eab308',
                                '#22c55e',
                                SIMULATION_GROUP_COLOR_PALETTE[2]
                              ][index] || SIMULATION_GROUP_COLOR_PALETTE[2]}
                            />
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
                <div className="grid grid-cols-[2fr_1fr_1fr_2fr] gap-4 px-6 py-4" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
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
                    Actions
                  </div>
                </div>

                {/* Table Rows */}
                {filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="grid grid-cols-[2fr_1fr_1fr_2fr] gap-4 px-6 py-4 border-t items-center"
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
                      GLOBAL KEY QUESTIONS
                    </h2>
                    <p className="text-xs mb-4" style={{ color: UI_COLORS.text.muted }}>
                      These questions apply to all patients in this simulation group.
                      Global key questions can only be edited here.
                    </p>
                    <p className="text-xs mb-4" style={{ color: UI_COLORS.text.muted }}>
                      In each patient&apos;s page, global key questions are view-only.
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
                      const globalRubric = instructorService.getGlobalRubricQuestions(groupId || '1');
                      const questionIds = new Set(globalRubric.map(q => q.id));
                      setIncludedQuestionIds(questionIds);
                      setPendingQuestionIds(new Set(questionIds));
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
                      if (selectedPatientForQuestionBank) {
                        const questionIds = instructorService.getPatientCaseSpecificQuestionIds(selectedPatientForQuestionBank);
                        setIncludedQuestionIds(questionIds);
                        setPendingQuestionIds(new Set(questionIds));
                      } else {
                        setIncludedQuestionIds(new Set());
                        setPendingQuestionIds(new Set());
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
                        Select which global questions should be included in this simulation group&apos;s rubric. These are questions
                        that are saved in the question bank and are visible to be included for all patients in this simulation group.
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

                      {/* Pagination Info */}
                      {filteredGlobalQuestions.length > 0 && (
                        <div className="flex items-center justify-between mb-3 text-sm" style={{ color: UI_COLORS.text.muted }}>
                          <span>
                            Showing {((globalPagination.currentPage - 1) * globalPagination.itemsPerPage) + 1}&ndash;
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
                                      checked={pendingQuestionIds.has(question.id)}
                                      onChange={() => handleTogglePendingQuestion(question.id)}
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
                                  <p className="text-sm" style={{ color: UI_COLORS.text.body }}>{question.title || '\u2014'}</p>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Key Question</label>
                                  <p className="text-sm" style={{ color: question.questionText ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.questionText || '\u2014'}</p>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Clinical Intent</label>
                                  <p className="text-sm" style={{ color: question.clinicalIntent ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.clinicalIntent || '\u2014'}</p>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Evaluation Criteria</label>
                                  <p className="text-sm whitespace-pre-line" style={{ color: question.evaluationCriteria ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.evaluationCriteria || '\u2014'}</p>
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

                      {/* Confirm / Reset Buttons */}
                      <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: UI_COLORS.border.default }}>
                        <div className="flex items-center gap-3">
                          <Button
                            onClick={handleConfirmSelections}
                            disabled={!hasPendingChanges}
                            className="px-6 py-2 font-medium transition-colors"
                            style={{
                              backgroundColor: hasPendingChanges ? UI_COLORS.button.primary : UI_COLORS.background.tableHeader,
                              color: hasPendingChanges ? UI_COLORS.button.text : UI_COLORS.text.muted,
                              cursor: hasPendingChanges ? 'pointer' : 'not-allowed',
                            }}
                            onMouseEnter={(e) => hasPendingChanges && (e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover)}
                            onMouseLeave={(e) => hasPendingChanges && (e.currentTarget.style.backgroundColor = UI_COLORS.button.primary)}
                          >
                            Confirm Selections
                          </Button>
                          {hasPendingChanges && (
                            <button
                              onClick={handleResetSelections}
                              className="text-sm font-medium transition-colors bg-transparent border-0 cursor-pointer p-0"
                              style={{ color: UI_COLORS.text.muted }}
                              onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
                              onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.muted}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        {hasPendingChanges && (
                          <span className="text-xs" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[2] }}>
                            {pendingAddCount > 0 && `+${pendingAddCount} to add`}
                            {pendingAddCount > 0 && pendingRemoveCount > 0 && ', '}
                            {pendingRemoveCount > 0 && `${pendingRemoveCount} to remove`}
                          </span>
                        )}
                      </div>

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
                        Select a patient to manage their patient-specific questions. A patient-specific question
                        is asked in the context of one particular patient and will depend on the patient&apos;s unique details.
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
                            setPatientPagination({ currentPage: 1, itemsPerPage: patientPagination.itemsPerPage });
                            if (patientId) {
                              const questionIds = instructorService.getPatientCaseSpecificQuestionIds(patientId);
                              setIncludedQuestionIds(questionIds);
                              setPendingQuestionIds(new Set(questionIds));
                            } else {
                              setIncludedQuestionIds(new Set());
                              setPendingQuestionIds(new Set());
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

                      {selectedPatientForQuestionBank ? (
                        <>
                          {/* Pagination Info */}
                          {filteredPatientQuestions.length > 0 && (
                            <div className="flex items-center justify-between mb-3 text-sm" style={{ color: UI_COLORS.text.muted }}>
                              <span>
                                Showing {((patientPagination.currentPage - 1) * patientPagination.itemsPerPage) + 1}&ndash;
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
                                          checked={pendingQuestionIds.has(question.id)}
                                          onChange={() => handleTogglePendingQuestion(question.id)}
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
                                      <p className="text-sm" style={{ color: UI_COLORS.text.body }}>{question.title || '\u2014'}</p>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Key Question</label>
                                      <p className="text-sm" style={{ color: question.questionText ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.questionText || '\u2014'}</p>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Clinical Intent</label>
                                      <p className="text-sm" style={{ color: question.clinicalIntent ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.clinicalIntent || '\u2014'}</p>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Evaluation Criteria</label>
                                      <p className="text-sm whitespace-pre-line" style={{ color: question.evaluationCriteria ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.evaluationCriteria || '\u2014'}</p>
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

                          {/* Confirm / Reset Buttons */}
                          <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: UI_COLORS.border.default }}>
                            <div className="flex items-center gap-3">
                              <Button
                                onClick={handleConfirmSelections}
                                disabled={!hasPendingChanges}
                                className="px-6 py-2 font-medium transition-colors"
                                style={{
                                  backgroundColor: hasPendingChanges ? UI_COLORS.button.primary : UI_COLORS.background.tableHeader,
                                  color: hasPendingChanges ? UI_COLORS.button.text : UI_COLORS.text.muted,
                                  cursor: hasPendingChanges ? 'pointer' : 'not-allowed',
                                }}
                                onMouseEnter={(e) => hasPendingChanges && (e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover)}
                                onMouseLeave={(e) => hasPendingChanges && (e.currentTarget.style.backgroundColor = UI_COLORS.button.primary)}
                              >
                                Confirm Selections
                              </Button>
                              {hasPendingChanges && (
                                <button
                                  onClick={handleResetSelections}
                                  className="text-sm font-medium transition-colors bg-transparent border-0 cursor-pointer p-0"
                                  style={{ color: UI_COLORS.text.muted }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
                                  onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.muted}
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            {hasPendingChanges && (
                              <span className="text-xs" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[2] }}>
                                {pendingAddCount > 0 && `+${pendingAddCount} to add`}
                                {pendingAddCount > 0 && pendingRemoveCount > 0 && ', '}
                                {pendingRemoveCount > 0 && `${pendingRemoveCount} to remove`}
                              </span>
                            )}
                          </div>

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
                      ) : (
                        <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>
                          Please select a patient to manage their questions.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'prompt' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold" style={{ color: UI_COLORS.text.heading }}>
                Evaluation Prompt
              </h2>

              <div>
                <textarea
                  readOnly
                  className="w-full px-4 py-3 rounded-lg resize-none text-sm font-mono cursor-default"
                  style={{
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: UI_COLORS.border.default,
                    backgroundColor: UI_COLORS.background.tableHeader,
                    minHeight: '500px',
                  }}
                  defaultValue={`Evaluate the student's interview using the instructor-defined rubric and key questions.\nUse only the provided transcript, rubric, and student responses. Do not infer actions or facts that are not clearly supported.\n\nAssess:\n- which key questions were addressed, partially addressed, or missed\n- how well the student's questions align with the rubric\n- overall clinical reasoning and question quality\n\nGenerate an AI debrief with:\n- Interview Summary (3-5 sentences)\n- Key Questions Successfully Addressed\n- Key Questions Missed or Incomplete\n- Rubric-Based Feedback (strengths, areas for improvement, next-time focus)\n- Overall Assessment (rubric alignment score + summary)\n\nOUTPUT FORMAT\nReturn valid JSON in exactly this structure:\n\n{\n  "interview_summary": "string",\n  "key_questions_successfully_addressed": [\n    {\n      "question_id": "string",\n      "question_content": "string",\n      "feedback": "string"\n    }\n  ],\n  "key_questions_missed_or_incomplete": [\n    {\n      "question_id": "string",\n      "question_content": "string",\n      "status": "missed | partially_addressed",\n      "feedback": "string",\n      "clinical_importance": "string"\n    }\n  ],\n  "rubric_based_feedback": {\n    "strengths": ["string", "string"],\n    "areas_for_improvement": ["string", "string"],\n    "recommended_focus_next_time": ["string", "string"]\n  },\n  "overall_assessment": {\n    "rubric_alignment_score": 0,\n    "summary": "string"\n  }\n}`}
                />
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
                    onClick={() => handleEditPatientTabSwitch('info')}
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
                    onClick={() => handleEditPatientTabSwitch('questions')}
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
                    onClick={() => handleEditPatientTabSwitch('materials')}
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
                          imageUrl={patientBeingEdited?.photo_url}
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
                            if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 0 && parseInt(value) <= 100)) {
                              setEditPatientAge(value);
                            }
                          }}
                          onKeyDown={(e) => {
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
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>
                              LLM Upload
                            </span>
                            {uploadStatus['llm'] === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: UI_COLORS.text.muted }} />}
                            {uploadStatus['llm'] === 'success' && <span className="flex items-center gap-1 text-sm" style={{ color: '#16a34a' }}><CheckCircle className="w-4 h-4" /> Uploaded</span>}
                            {uploadStatus['llm'] === 'error' && <span className="flex items-center gap-1 text-sm" style={{ color: '#dc2626' }}><XCircle className="w-4 h-4" /> Failed</span>}
                          </div>
                          <label className={`cursor-pointer ${uploadStatus['llm'] === 'uploading' ? 'pointer-events-none opacity-50' : ''}`}>
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
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>
                              Patient Information
                            </span>
                            {uploadStatus['patientInfo'] === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: UI_COLORS.text.muted }} />}
                            {uploadStatus['patientInfo'] === 'success' && <span className="flex items-center gap-1 text-sm" style={{ color: '#16a34a' }}><CheckCircle className="w-4 h-4" /> Uploaded</span>}
                            {uploadStatus['patientInfo'] === 'error' && <span className="flex items-center gap-1 text-sm" style={{ color: '#dc2626' }}><XCircle className="w-4 h-4" /> Failed</span>}
                          </div>
                          <label className={`cursor-pointer ${uploadStatus['patientInfo'] === 'uploading' ? 'pointer-events-none opacity-50' : ''}`}>
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
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>
                              Answer Key
                            </span>
                            {uploadStatus['answerKey'] === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: UI_COLORS.text.muted }} />}
                            {uploadStatus['answerKey'] === 'success' && <span className="flex items-center gap-1 text-sm" style={{ color: '#16a34a' }}><CheckCircle className="w-4 h-4" /> Uploaded</span>}
                            {uploadStatus['answerKey'] === 'error' && <span className="flex items-center gap-1 text-sm" style={{ color: '#dc2626' }}><XCircle className="w-4 h-4" /> Failed</span>}
                          </div>
                          <label className={`cursor-pointer ${uploadStatus['answerKey'] === 'uploading' ? 'pointer-events-none opacity-50' : ''}`}>
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
                    <div className="max-w-5xl mx-auto p-8 space-y-6">
                      <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>
                        Case-Specific Key Questions
                      </h2>

                      {/* Search */}
                      <div className="relative mb-6">
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

                      {/* Local Patient Specific Questions Section */}
                      <div className="space-y-4">
                        <p className="text-xs italic mb-4" style={{ color: UI_COLORS.text.muted }}>
                          Click on a Key Question entry to expand and edit it.
                        </p>

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
                                style={{
                                  backgroundColor: UI_COLORS.background.white,
                                  color: UI_COLORS.text.heading
                                }}
                              >
                                <div className="flex items-center justify-between w-full pr-4">
                                  <span className="font-medium">
                                    Q{index + 1} - {question.title}
                                  </span>
                                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                                    {question.required ? 'Required' : 'Optional'}
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent
                                className="px-4 pb-4"
                                style={{ backgroundColor: UI_COLORS.background.white }}
                              >
                                <div className="space-y-4 pt-4">
                                  {/* Title */}
                                  <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                      Title
                                    </label>
                                    <Input
                                      value={question.title}
                                      onChange={(e) => {
                                        const updatedQuestions = caseSpecificQuestions.map(q =>
                                          q.id === question.id ? { ...q, title: e.target.value } : q
                                        );
                                        setCaseSpecificQuestions(updatedQuestions);
                                      }}
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
                                      value={question.keyQuestion}
                                      onChange={(e) => {
                                        const updatedQuestions = caseSpecificQuestions.map(q =>
                                          q.id === question.id ? { ...q, keyQuestion: e.target.value } : q
                                        );
                                        setCaseSpecificQuestions(updatedQuestions);
                                      }}
                                      placeholder="Assess the characteristics of the patient's chest pain..."
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
                                      value={question.clinicalIntent}
                                      onChange={(e) => {
                                        const updatedQuestions = caseSpecificQuestions.map(q =>
                                          q.id === question.id ? { ...q, clinicalIntent: e.target.value } : q
                                        );
                                        setCaseSpecificQuestions(updatedQuestions);
                                      }}
                                      placeholder="This question evaluates the student's ability..."
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
                                      value={question.evaluationCriteria}
                                      onChange={(e) => {
                                        const updatedQuestions = caseSpecificQuestions.map(q =>
                                          q.id === question.id ? { ...q, evaluationCriteria: e.target.value } : q
                                        );
                                        setCaseSpecificQuestions(updatedQuestions);
                                      }}
                                      placeholder="The student attempts to identify at least 3-4 of the following..."
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
                                      aria-checked={question.required}
                                      onClick={() => {
                                        const updatedQuestions = caseSpecificQuestions.map(q =>
                                          q.id === question.id ? { ...q, required: !q.required } : q
                                        );
                                        setCaseSpecificQuestions(updatedQuestions);
                                      }}
                                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                      style={{
                                        backgroundColor: question.required ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive
                                      }}
                                    >
                                      <span
                                        className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                                        style={{
                                          transform: question.required ? 'translateX(22px)' : 'translateX(2px)'
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
                                      onClick={() => {
                                        if (selectedPatientForEdit) {
                                          instructorService.updateCaseSpecificQuestion(selectedPatientForEdit, question);
                                        }
                                      }}
                                      className="px-8 py-3 text-base font-medium transition-colors"
                                      style={{
                                        backgroundColor: UI_COLORS.button.primary,
                                        color: UI_COLORS.button.text
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        if (selectedPatientForEdit) {
                                          instructorService.deleteCaseSpecificQuestion(selectedPatientForEdit, question.id);
                                          setCaseSpecificQuestions(caseSpecificQuestions.filter(q => q.id !== question.id));
                                        }
                                      }}
                                      variant="outline"
                                      className="px-8 py-3 text-base font-medium transition-colors text-white"
                                      style={{
                                        backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[0],
                                        borderColor: SIMULATION_GROUP_COLOR_PALETTE[0],
                                      }}
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
                      </div>

                      {/* Divider */}
                      <div className="my-8" style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: UI_COLORS.border.default }} />

                      {/* Global Key Questions Section */}
                      <div className="space-y-4">
                        <h3 className="font-semibold text-lg" style={{ color: UI_COLORS.text.heading }}>
                          GLOBAL KEY QUESTIONS
                        </h3>
                        <p className="text-xs italic mb-4" style={{ color: UI_COLORS.text.muted }}>
                          The following global questions are shown for reference to prevent redundancy. Edit global questions from the Global Rubric tab.
                        </p>

                        {/* Search Bar for Global Questions */}
                        <div className="relative mb-6">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                          <Input
                            placeholder="Search Global Questions"
                            value={globalRubricSearchQuery}
                            onChange={(e) => setGlobalRubricSearchQuery(e.target.value)}
                            className="pl-9 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                            style={{
                              borderWidth: '1px',
                              borderStyle: 'solid',
                              borderColor: UI_COLORS.border.default,
                              backgroundColor: UI_COLORS.background.white
                            }}
                          />
                        </div>

                        <Accordion type="single" collapsible className="space-y-2">
                          {(() => {
                            const filteredGlobalRubric = globalRubricQuestions.filter(q =>
                              q.title.toLowerCase().includes(globalRubricSearchQuery.toLowerCase())
                            );
                            return filteredGlobalRubric.map((question, index) => (
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
                                  style={{
                                    backgroundColor: UI_COLORS.background.tableHeader,
                                    color: UI_COLORS.text.heading
                                  }}
                                >
                                  <div className="flex items-center justify-between w-full pr-4">
                                    <span className="font-medium text-sm">
                                      Q{index + 1} - {question.title}
                                    </span>
                                    <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                                      {question.required ? 'Required' : 'Optional'}
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent
                                  className="px-4 pb-4"
                                  style={{ backgroundColor: UI_COLORS.background.white }}
                                >
                                  <div className="space-y-4 pt-4">
                                    <div>
                                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Title</label>
                                      <div className="w-full px-3 py-3 rounded-lg text-base" style={{
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        borderColor: UI_COLORS.border.default,
                                        backgroundColor: UI_COLORS.background.hoverLight,
                                        color: UI_COLORS.text.body
                                      }}>
                                        {question.title}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Key Question</label>
                                      <div className="w-full px-3 py-3 rounded-lg text-base whitespace-pre-wrap" style={{
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        borderColor: UI_COLORS.border.default,
                                        backgroundColor: UI_COLORS.background.hoverLight,
                                        color: UI_COLORS.text.body,
                                        minHeight: '150px',
                                      }}>
                                        {question.keyQuestion}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Clinical Intent</label>
                                      <div className="w-full px-3 py-3 rounded-lg text-base whitespace-pre-wrap" style={{
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        borderColor: UI_COLORS.border.default,
                                        backgroundColor: UI_COLORS.background.hoverLight,
                                        color: UI_COLORS.text.body,
                                        minHeight: '100px',
                                      }}>
                                        {question.clinicalIntent}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Evaluation Criteria</label>
                                      <div className="w-full px-3 py-3 rounded-lg text-base whitespace-pre-wrap" style={{
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        borderColor: UI_COLORS.border.default,
                                        backgroundColor: UI_COLORS.background.hoverLight,
                                        color: UI_COLORS.text.body,
                                        minHeight: '100px',
                                      }}>
                                        {question.evaluationCriteria}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                                        {question.required ? 'Required for Case Completion' : 'Optional'}
                                      </span>
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ));
                          })()}
                        </Accordion>
                      </div>
                    </div>
                  )}

                  {editPatientTab === 'materials' && (
                    <div className="max-w-5xl mx-auto p-8 space-y-6">
                      <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>
                        Physical Assessment Materials
                      </h2>

                      {/* Add New Material Button */}
                      <div className="mb-6">
                        <Button
                          onClick={handleAddNewCaseMaterial}
                          className="justify-start gap-2 py-2.5 h-auto font-medium transition-colors"
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

                      {/* Search */}
                      <div className="relative mb-6">
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

                      {/* Materials Accordion */}
                      <div className="space-y-4">
                        <p className="text-xs italic mb-4" style={{ color: UI_COLORS.text.muted }}>
                          Click on a Material entry to expand and edit it.
                        </p>

                        <Accordion type="single" collapsible className="space-y-2">
                          {filteredMaterials.map((material) => (
                            <AccordionItem
                              key={material.id}
                              value={material.id}
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
                                  <span className="font-medium">
                                    {material.title}
                                  </span>
                                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                                    {material.materialType}
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent
                                className="px-4 pb-4"
                                style={{ backgroundColor: UI_COLORS.background.white }}
                              >
                                <div className="space-y-4 pt-4">
                                  {/* Title */}
                                  <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                      Title
                                    </label>
                                    <Input
                                      value={material.title}
                                      onChange={(e) => {
                                        const updatedMaterials = caseMaterials.map(m =>
                                          m.id === material.id ? { ...m, title: e.target.value } : m
                                        );
                                        setCaseMaterials(updatedMaterials);
                                      }}
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
                                      value={material.description}
                                      onChange={(e) => {
                                        const updatedMaterials = caseMaterials.map(m =>
                                          m.id === material.id ? { ...m, description: e.target.value } : m
                                        );
                                        setCaseMaterials(updatedMaterials);
                                      }}
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
                                      Material Type
                                    </label>
                                    <select
                                      value={material.materialType}
                                      onChange={(e) => {
                                        const updatedMaterials = caseMaterials.map(m =>
                                          m.id === material.id ? { ...m, materialType: e.target.value } : m
                                        );
                                        setCaseMaterials(updatedMaterials);
                                      }}
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
                                        onChange={(e) => {
                                          setSelectedMaterialId(material.id);
                                          handleMaterialFileUpload(e);
                                        }}
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
                                      value={material.embedLink || ''}
                                      onChange={(e) => {
                                        const updatedMaterials = caseMaterials.map(m =>
                                          m.id === material.id ? { ...m, embedLink: e.target.value } : m
                                        );
                                        setCaseMaterials(updatedMaterials);
                                      }}
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
                                      onClick={() => {
                                        if (selectedPatientForEdit) {
                                          setSelectedMaterialId(material.id);
                                          handleSaveCaseMaterial();
                                        }
                                      }}
                                      className="px-8 py-3 text-base font-medium transition-colors"
                                      style={{
                                        backgroundColor: UI_COLORS.button.primary,
                                        color: UI_COLORS.button.text
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        if (selectedPatientForEdit) {
                                          instructorService.deleteCaseMaterial(selectedPatientForEdit, material.id);
                                          setCaseMaterials(caseMaterials.filter(m => m.id !== material.id));
                                        }
                                      }}
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
                  {studentDetailsLoading ? (
                    <div className="flex items-center gap-2 text-sm" style={{ color: UI_COLORS.text.muted }}>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </div>
                  ) : studentDetails ? (
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
                  ) : null}
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
                        {(studentPatientData?.patientNames || []).map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>

                    <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>
                      Click on the dropdown icon to view the student&apos;s chat history and export per-case reports.
                    </p>

                    {/* Chat Attempts */}
                    <div className="space-y-4">
                      {(studentPatientData?.attempts[selectedPatientFilter] || []).map((attempt) => {
                        const isExpanded = expandedAttemptId === attempt.id;
                        const messages = studentPatientData?.messages[attempt.id] || [];
                        const notes = studentPatientData?.notes[attempt.id] || '';
                        return (
                          <div
                            key={attempt.id}
                            className="border rounded-lg overflow-hidden"
                            style={{ borderColor: UI_COLORS.border.default }}
                          >
                            {/* Attempt Header Row */}
                            <div
                              className="grid grid-cols-[2fr_2fr_2fr_1fr] gap-4 px-6 py-4 items-center cursor-pointer transition-colors hover:bg-gray-50"
                              style={{
                                backgroundColor: isExpanded
                                  ? UI_COLORS.background.tableHeader
                                  : UI_COLORS.background.white,
                              }}
                              onClick={() => setExpandedAttemptId(isExpanded ? null : attempt.id)}
                            >
                              <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                                {attempt.date}
                              </div>
                              <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                                {attempt.completionStatus}
                              </div>
                              <div className="flex justify-end">
                                <button
                                  className="p-2 rounded transition-transform"
                                  style={{
                                    border: 'none',
                                    cursor: 'pointer',
                                    backgroundColor: 'transparent',
                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                  }}
                                >
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      d="M4 6L8 10L12 6"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Expanded Content */}
                            {isExpanded && (
                              <div className="border-t" style={{ borderColor: UI_COLORS.border.default }}>
                                {/* ── PDF-captured wrapper: header + chat history only ── */}
                                <div
                                  ref={(el) => {
                                    attemptPdfRefs.current[String(attempt.id)] = el;
                                  }}
                                  className="bg-white"
                                >
                                  {/* PDF Header */}
                                  <div className="px-6 pt-6 pb-2 border-b" style={{ borderColor: UI_COLORS.border.default }}>
                                    <h3 className="text-lg font-bold mb-1" style={{ color: UI_COLORS.text.heading }}>
                                      {studentDetails?.name ?? 'Student'}
                                    </h3>
                                    <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                                      Patient: {selectedPatientFilter || 'Unknown'}
                                    </p>
                                    <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                                      Session: {attempt.date}
                                    </p>
                                  </div>

                                  {/* Chat History Section */}
                                  <div className="p-6">
                                    <h3
                                      className="text-lg font-semibold mb-4"
                                      style={{ color: UI_COLORS.text.heading }}
                                    >
                                      Chat History
                                    </h3>
                                    <div
                                      className="border rounded-lg p-4 space-y-4 max-h-96 overflow-y-auto"
                                      style={{
                                        borderColor: UI_COLORS.border.default,
                                        backgroundColor: UI_COLORS.background.white,
                                      }}
                                    >
                                      {messages.length > 0 ? (
                                        messages.map((message) => (
                                          <div
                                            key={message.message_id}
                                            className={`flex gap-3 ${
                                              message.sender_type === 'student'
                                                ? 'justify-end'
                                                : 'justify-start'
                                            }`}
                                          >
                                            {message.sender_type !== 'student' && (
                                              <div className="flex-shrink-0">
                                                <UserAvatar
                                                  name={selectedPatientFilter || 'Patient'}
                                                  imageUrl={undefined}
                                                  size="small"
                                                />
                                              </div>
                                            )}
                                            <div
                                              className={`max-w-[70%] rounded-lg px-4 py-3 ${
                                                message.sender_type === 'student'
                                                  ? 'rounded-br-none'
                                                  : 'rounded-bl-none'
                                              }`}
                                              style={{
                                                backgroundColor:
                                                  message.sender_type === 'student'
                                                    ? SIMULATION_GROUP_COLOR_PALETTE[2]
                                                    : UI_COLORS.background.hoverLight,
                                                color:
                                                  message.sender_type === 'student'
                                                    ? UI_COLORS.button.text
                                                    : UI_COLORS.text.heading,
                                              }}
                                            >
                                              <p className="text-sm font-semibold mb-1">
                                                {message.sender_type === 'student'
                                                  ? `${studentDetails?.name || 'Student'} (User)`
                                                  : `${selectedPatientFilter || 'Patient'} (LLM)`}
                                                :
                                              </p>
                                              <p className="text-sm">{message.message_content}</p>
                                            </div>
                                            {message.sender_type === 'student' && (
                                              <div className="flex-shrink-0">
                                                <UserAvatar
                                                  name={studentDetails?.name || 'Student'}
                                                  imageUrl={undefined}
                                                  size="small"
                                                />
                                              </div>
                                            )}
                                          </div>
                                        ))
                                      ) : (
                                        <p
                                          className="text-sm italic"
                                          style={{ color: UI_COLORS.text.muted }}
                                        >
                                          No chat history available.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {/* ── End of PDF-captured wrapper ── */}

                                {/* Notes Section (on-screen only, excluded from PDF) */}
                                <div className="px-6 pb-6">
                                  <h3
                                    className="text-lg font-semibold mb-4"
                                    style={{ color: UI_COLORS.text.heading }}
                                  >
                                    Notes
                                  </h3>
                                  <div
                                    className="border rounded-lg p-4"
                                    style={{
                                      borderColor: UI_COLORS.border.default,
                                      backgroundColor: UI_COLORS.background.white,
                                    }}
                                  >
                                    <p
                                      className="text-sm"
                                      style={{
                                        color: notes
                                          ? UI_COLORS.text.heading
                                          : UI_COLORS.text.muted,
                                      }}
                                    >
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
                                      color: UI_COLORS.button.text,
                                    }}
                                    onMouseEnter={(e) =>
                                      (e.currentTarget.style.backgroundColor =
                                        UI_COLORS.button.secondaryHover)
                                    }
                                    onMouseLeave={(e) =>
                                      (e.currentTarget.style.backgroundColor =
                                        UI_COLORS.button.secondary)
                                    }
                                    onClick={async () => {
                                      const el = attemptPdfRefs.current[String(attempt.id)];
                                      if (!el) return;
                                      setIsGeneratingPdf(attempt.id);
                                      const scrollEls = Array.from(
                                        el.querySelectorAll<HTMLElement>('.overflow-y-auto')
                                      );
                                      const prev = scrollEls.map((node) => ({
                                        node,
                                        maxHeight: node.style.maxHeight,
                                        overflowY: node.style.overflowY,
                                      }));
                                      scrollEls.forEach((node) => {
                                        node.style.maxHeight = 'none';
                                        node.style.overflowY = 'visible';
                                      });
                                      try {
                                        await downloadChatPdf({
                                          element: el,
                                          filename: `chat-${attempt.id}.pdf`,
                                          scale: 2,
                                        });
                                      } catch (error) {
                                        console.error('Failed to download chat PDF:', error);
                                      } finally {
                                        prev.forEach(({ node, maxHeight, overflowY }) => {
                                          node.style.maxHeight = maxHeight;
                                          node.style.overflowY = overflowY;
                                        });
                                        setIsGeneratingPdf(null);
                                      }
                                    }}
                                  >
                                    {isGeneratingPdf === attempt.id ? 'Generating...' : 'Download Chat PDF'}
                                  </Button>
                                  <Button
                                    className="px-6 py-3 text-base font-medium transition-colors"
                                    style={{
                                      backgroundColor: UI_COLORS.button.secondary,
                                      color: UI_COLORS.button.text,
                                    }}
                                    onMouseEnter={(e) =>
                                      (e.currentTarget.style.backgroundColor =
                                        UI_COLORS.button.secondaryHover)
                                    }
                                    onMouseLeave={(e) =>
                                      (e.currentTarget.style.backgroundColor =
                                        UI_COLORS.button.secondary)
                                    }
                                    onClick={() => handleDownloadNotesPDF(attempt.id)}
                                  >
                                    Download Notes PDF
                                  </Button>
                                  {attempt.completionStatus === 'Debrief Reached' && (
                                    <Button
                                      className="px-6 py-3 text-base font-medium transition-colors"
                                      style={{
                                        backgroundColor: UI_COLORS.button.secondary,
                                        color: UI_COLORS.button.text,
                                      }}
                                      onMouseEnter={(e) =>
                                        (e.currentTarget.style.backgroundColor =
                                          UI_COLORS.button.secondaryHover)
                                      }
                                      onMouseLeave={(e) =>
                                        (e.currentTarget.style.backgroundColor =
                                          UI_COLORS.button.secondary)
                                      }
                                      onClick={() => handleViewAIDebrief(attempt.id)}
                                      disabled={!!isFetchingDebrief}
                                    >
                                      {isFetchingDebrief === attempt.id ? (
                                        <span className="flex items-center gap-2">
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Loading...
                                        </span>
                                      ) : (
                                        'View AI Debrief'
                                      )}
                                    </Button>
                                  )}
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

      {/* AI Debrief Dialog */}
      <AIDebriefDialog
        isOpen={isAIDebriefOpen}
        onClose={() => setIsAIDebriefOpen(false)}
        data={selectedDebriefData}
        simulationGroupId={groupId}
      />

      {/* Add Question Dialog */}
      <AddQuestionDialog
        open={isAddQuestionDialogOpen}
        onOpenChange={setIsAddQuestionDialogOpen}
        questionType={addQuestionType}
        existingTags={allExistingTags}
        onSave={handleSaveQuestion}
      />

      {/* Add Patient-Specific Question Dialog */}
      <AddPatientSpecificQuestionDialog
        open={isAddPatientQuestionDialogOpen}
        onOpenChange={setIsAddPatientQuestionDialogOpen}
        patients={manageablePatients.map(p => ({ id: p.id, name: p.name }))}
        onSave={handleSaveNewPatientQuestion}
      />

      {/* Confirm Generate New Access Code Dialog */}
      <Dialog open={isAccessCodeDialogOpen} onOpenChange={setIsAccessCodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: UI_COLORS.text.heading }}>Generate New Access Code</DialogTitle>
            <DialogDescription style={{ color: UI_COLORS.text.body }}>
              Are you sure? This will permanently replace the current access code. Any students using the old code will no longer be able to join.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAccessCodeDialogOpen(false)}
              style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setIsAccessCodeDialogOpen(false);
                await handleGenerateAccessCode();
              }}
              style={{ backgroundColor: UI_COLORS.status.error, color: UI_COLORS.button.text }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

export default InstructorSimulationGroupPage;
