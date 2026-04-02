import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageContainer from '@/components/PageContainer';
import UserAvatar from '@/components/UserAvatar';
import { mockInstructorDataService, type GlobalRubricQuestion, type CaseMaterial, type QuestionBankItem, instructorService, type InstructorSimulationGroup, type PatientAnalytics, type Student, type ManageablePatient, type KeyQuestionAnalytics, type KeyQuestionCoverage, type StudentDetails, type StudentPatientData, type StudentProgressData } from '@/services/instructorService';
import { mockAdminDataService, mockGroupInstructors, mockOrganizations } from '@/services/adminService';
import { ArrowLeft, BarChart3, Users, UserCog, FileText, Eye, Key, Copy, Search, Trash2, Edit, Plus, Menu, Camera, Upload, UserPlus, FileCode, CheckCircle, Loader2, XCircle, HelpCircle } from 'lucide-react';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AddQuestionDialog } from '@/components/AddQuestionDialog';
import { AddPatientSpecificQuestionDialog } from '@/components/AddPatientSpecificQuestionDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AddInstructorDialog } from '@/components/AddInstructorDialog';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import * as adminApi from '@/services/adminApiService';
import { downloadChatPdf } from '@/lib/download-chat-pdf';
import AIDebriefDialog from '@/components/AIDebriefDialog';
import { type AIDebriefData, studentService } from '@/services/studentService';

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
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(null);
  const [studentDetailsLoading, setStudentDetailsLoading] = useState(false);
  const [studentPatientData, setStudentPatientData] = useState<StudentPatientData | null>(null);
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [selectedPatientFilter, setSelectedPatientFilter] = useState<string>('');

  // AI Debrief and PDF generation state
  const [isAIDebriefOpen, setIsAIDebriefOpen] = useState(false);
  const [selectedDebriefData, setSelectedDebriefData] = useState<AIDebriefData | null>(null);
  const [isFetchingDebrief, setIsFetchingDebrief] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);
  const attemptPdfRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [selectedPatientForEdit, setSelectedPatientForEdit] = useState<string | null>(null);
  const [editPatientTab, setEditPatientTab] = useState<'info' | 'questions' | 'materials'>('info');
  const [editPatientName, setEditPatientName] = useState('');
  const [editPatientAge, setEditPatientAge] = useState('');
  const [editPatientGender, setEditPatientGender] = useState('');
  const [editPatientPrompt, setEditPatientPrompt] = useState('');
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'idle' | 'uploading' | 'success' | 'error'>>({});

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
  const [questionBankSearchQuery, setQuestionBankSearchQuery] = useState('');
  const [questionBankTagFilter, setQuestionBankTagFilter] = useState<string>('');

  // Question Bank questions - loaded from service
  const [globalBankQuestions, setGlobalBankQuestions] = useState<QuestionBankItem[]>([]);
  const [patientSpecificBankQuestions, setPatientSpecificBankQuestions] = useState<QuestionBankItem[]>([]);

  // Collect all unique tags from existing questions for autocomplete
  const allExistingTags = Array.from(
    new Set(
      [...globalBankQuestions, ...patientSpecificBankQuestions]
        .flatMap(q => q.tags || [])
        .filter(t => t !== 'patient_specific')
    )
  ).sort();

  // Filter question bank questions by search query and tag
  const filteredGlobalBankQuestions = globalBankQuestions.filter(q => {
    const matchesSearch = !questionBankSearchQuery || q.title.toLowerCase().includes(questionBankSearchQuery.toLowerCase());
    const matchesTag = !questionBankTagFilter || (q.tags || []).includes(questionBankTagFilter);
    return matchesSearch && matchesTag;
  });
  const filteredPatientBankQuestions = patientSpecificBankQuestions.filter(q => {
    const matchesSearch = !questionBankSearchQuery || q.title.toLowerCase().includes(questionBankSearchQuery.toLowerCase());
    const matchesTag = !questionBankTagFilter || (q.tags || []).includes(questionBankTagFilter);
    return matchesSearch && matchesTag;
  });

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

  // State for async-loaded data
  const [simulationGroup, setSimulationGroup] = useState<InstructorSimulationGroup | undefined>(undefined);
  const [patientAnalytics, setPatientAnalytics] = useState<PatientAnalytics[]>([]);
  const [analyticsDateRange, setAnalyticsDateRange] = useState({ start: '', end: '' });
  const [students, setStudents] = useState<Student[]>([]);
  const [manageablePatients, setManageablePatients] = useState<ManageablePatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyQuestionCoverage, setKeyQuestionCoverage] = useState<KeyQuestionCoverage[]>([]);
  const [isAccessCodeDialogOpen, setIsAccessCodeDialogOpen] = useState(false);

  // Load data from instructor service (sync)
  const user = mockAdminDataService.getCurrentUser();

  // Load instructors from API (real backend)
  const [instructors, setInstructors] = useState<adminApi.AdminInstructor[]>([]);
  const [instructorsLoading, setInstructorsLoading] = useState(false);

  // Organization details (loaded from API with mock fallback)
  const [organization, setOrganization] = useState<adminApi.AdminOrganization | null>(null);

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
        // Load each data source independently so one failure doesn't block the rest
        const [adminGroupData, analyticsData, studentsData, patientsData, bankGlobal, bankPatient] = await Promise.all([
          adminApi.getSimulationGroup(groupId).catch(err => { console.error('Failed to load group:', err); return undefined; }),
          instructorService.getPatientAnalytics(groupId).catch(err => { console.error('Failed to load analytics:', err); return [] as PatientAnalytics[]; }),
          instructorService.getStudents(groupId).catch(err => { console.error('Failed to load students:', err); return [] as Student[]; }),
          instructorService.getManageablePatients(groupId).catch(err => { console.error('Failed to load patients:', err); return [] as ManageablePatient[]; }),
          organizationId
            ? adminApi.getQuestionBankQuestions(organizationId).catch(err => { console.error('Failed to load global questions:', err); return [] as QuestionBankItem[]; })
            : instructorService.getGlobalQuestionBank().catch(err => { console.error('Failed to load global questions:', err); return [] as QuestionBankItem[]; }),
          Promise.resolve(instructorService.getPatientSpecificQuestionBank()),
        ]);

        // Map admin API shape to InstructorSimulationGroup
        const groupData = adminGroupData ? {
          simulation_group_id: adminGroupData.simulation_group_id,
          group_name: adminGroupData.group_name,
          subtitle: adminGroupData.group_description || 'Simulation Group',
          group_access_code: adminGroupData.group_access_code || '',
          student_count: adminGroupData.student_count || 0,
          instructor_count: adminGroupData.instructor_count || 0,
          persona_count: adminGroupData.persona_count || 0,
          organization_id: adminGroupData.organization_id || '',
        } as InstructorSimulationGroup : undefined;

        setSimulationGroup(groupData ? {
          simulation_group_id: groupData.simulation_group_id,
          group_name: groupData.group_name,
          subtitle: 'Medical Simulation Group',
          group_access_code: groupData.group_access_code || '',
          student_count: groupData.student_count || 0,
          instructor_count: groupData.instructor_count || 0,
          persona_count: groupData.persona_count || 0,
          organization_id: groupData.organization_id || '',
        } : undefined);
        setPatientAnalytics(analyticsData);
        setStudents(studentsData);
        setManageablePatients(patientsData);

        // Split questions by tags: patient_specific vs global
        if (organizationId) {
          const global: QuestionBankItem[] = [];
          const patientSpecific: QuestionBankItem[] = [];
          for (const q of bankGlobal) {
            if (q.tags?.includes('patient_specific')) {
              patientSpecific.push(q);
            } else {
              global.push(q);
            }
          }
          setGlobalBankQuestions(global);
          setPatientSpecificBankQuestions(patientSpecific);
        } else {
          setGlobalBankQuestions(bankGlobal);
          setPatientSpecificBankQuestions(bankPatient);
        }

        // Set initial selected patient if analytics available
        if (analyticsData.length > 0) {
          setSelectedPatientId(analyticsData[0].patient_id);
        }
      } catch (error) {
        console.error('Error loading admin simulation group data:', error);
      } finally {
        setLoading(false);
      }

      // Load organization details from API, fall back to mock
      if (organizationId) {
        try {
          const orgData = await adminApi.getOrganization(organizationId);
          setOrganization(orgData);
        } catch (err) {
          console.error('Failed to load organization from API, using mock:', err);
          const mockOrg = mockOrganizations.find(o => o.organization_id === organizationId) || null;
          setOrganization(mockOrg);
        }
      }
    };

    loadData();
  }, [groupId, organizationId]);

  // Filter analytics data based on date range
  useEffect(() => {
    if (!groupId) return;
    const fetchFilteredAnalytics = async () => {
      try {
        const [analyticsData, coverageData] = await Promise.all([
          instructorService.getPatientAnalytics(groupId, analyticsDateRange.start, analyticsDateRange.end),
          instructorService.getKeyQuestionCoverage(groupId, analyticsDateRange.start, analyticsDateRange.end),
        ]);
        setPatientAnalytics(analyticsData);
        setKeyQuestionCoverage(coverageData);
      } catch (error) {
        console.error('Error fetching filtered analytics:', error);
      }
    };
    if (simulationGroup) {
      fetchFilteredAnalytics();
    }
  }, [groupId, analyticsDateRange.start, analyticsDateRange.end, simulationGroup]);

  // Load instructors from real API when section is active, fall back to mock
  useEffect(() => {
    if (activeSection === 'instructors' && groupId) {
      setInstructorsLoading(true);
      adminApi.getGroupInstructors(groupId)
        .then(setInstructors)
        .catch((err) => {
          console.error('Failed to load group instructors, using mock data:', err);
          setInstructors(mockGroupInstructors);
        })
        .finally(() => setInstructorsLoading(false));
    }
  }, [activeSection, groupId]);

  // Load assigned questions from API when rubric or questionBank section is activated
  useEffect(() => {
    if ((activeSection === 'rubric' || activeSection === 'questionBank' || activeSection === 'editPatient') && groupId) {
      instructorService.getSimulationGroupQuestions(groupId)
        .then((assigned: any[]) => {
          // Filter to only global questions (no persona_id) for the global rubric view
          const globalAssigned = assigned.filter((q: any) => !q.persona_id);
          const rubricQuestions: GlobalRubricQuestion[] = globalAssigned.map((q: any) => ({
            id: q.question_id,
            title: q.title || '',
            keyQuestion: q.question_text || '',
            clinicalIntent: '',
            evaluationCriteria: q.evaluation_criteria || '',
            required: q.is_mandatory ?? false,
          }));
          setGlobalRubricQuestions(rubricQuestions);
          // Only update includedQuestionIds for rubric/questionBank (not editPatient, which handles its own)
          if (activeSection !== 'editPatient') {
            setIncludedQuestionIds(new Set(globalAssigned.map((q: any) => q.question_id)));
          }
          if (rubricQuestions.length > 0 && !selectedQuestionId) {
            setSelectedQuestionId(rubricQuestions[0].id);
          }
        })
        .catch((err: any) => {
          console.error('Failed to load assigned questions:', err);
        });
    }
  }, [activeSection, groupId]);

  // State for selected patient (for analytics tabs)
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
      instructorService.getPatientKeyQuestionAnalytics(groupId, currentPatient.patient_id, analyticsDateRange.start, analyticsDateRange.end)
        .then(setKeyQuestionAnalytics)
        .catch(() => setKeyQuestionAnalytics([]));
    } else {
      setKeyQuestionAnalytics([]);
    }
  }, [currentPatient?.patient_id, groupId, analyticsDateRange.start, analyticsDateRange.end]);

  // Student progress data for current patient
  const [studentProgress, setStudentProgress] = useState<StudentProgressData[]>([]);

  useEffect(() => {
    if (groupId && selectedPatientId && selectedPatientId !== 'overview') {
      instructorService.getStudentProgress(groupId, selectedPatientId, analyticsDateRange.start, analyticsDateRange.end)
        .then(data => setStudentProgress(data))
        .catch(err => console.error(err));
    } else {
      setStudentProgress([]);
    }
  }, [groupId, selectedPatientId, analyticsDateRange.start, analyticsDateRange.end]);

  // Fallback values
  const simulationGroupName = simulationGroup?.group_name || 'Simulation Group';
  const accessCode = simulationGroup?.group_access_code || 'XXXX-XXXX-XXXX-XXXX';

  // Filter patients based on search query
  const filteredPatients = manageablePatients.filter(patient =>
    patient.patient_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter students based on search query
  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(studentSearchQuery.toLowerCase())
  );

  // Filter instructors based on search query
  const filteredInstructors = instructors.filter(instructor => {
    const fullName = `${instructor.first_name} ${instructor.last_name}`.toLowerCase();
    return fullName.includes(instructorSearchQuery.toLowerCase()) ||
      instructor.user_email.toLowerCase().includes(instructorSearchQuery.toLowerCase());
  });

  const handleSignOut = () => {
    navigate('/login');
  };

  const handleBackToAllGroups = () => {
    navigate(`/admin/organization/${organizationId}`);
  };

  const handleStudentView = async () => {
    // If we're on a sim group page, auto-enroll as student and go directly to that group
    if (groupId && accessCode && accessCode !== 'XXXX-XXXX-XXXX-XXXX') {
      try {
        const result = await studentService.joinGroup(accessCode);
        if (result?.success) {
          navigate(`/patients/${groupId}`);
        } else {
          console.error('Failed to enroll as student in group:', { groupId, accessCode });
          window.alert('Unable to enroll in this simulation group. Taking you to the student dashboard instead.');
          navigate('/student');
        }
      } catch (error) {
        console.error('Unexpected error while enrolling as student:', error);
        window.alert('An unexpected error occurred while enrolling in this simulation group. Taking you to the student dashboard instead.');
        navigate('/student');
      }
    } else {
      navigate('/student');
    }
  };

  const handleInstructorView = async () => {
    if (groupId) {
      try {
        const user = await import('@/lib/auth').then(m => m.authService.getCurrentUser());
        if (user?.email) {
          await adminApi.enrollInstructorInGroup(groupId, user.email);
        }
      } catch (err) {
        console.error('Failed to enroll as instructor:', err);
      }
      navigate(`/instructor/group/${groupId}`);
    } else {
      navigate('/instructor');
    }
  };

  const handleGenerateAccessCode = async () => {
    if (!groupId) return;
    try {
      const result = await adminApi.regenerateAccessCode(groupId);
      // Update local state with the new access code
      setSimulationGroup(prev => prev ? { ...prev, group_access_code: result.access_code } : prev);
    } catch (err) {
      console.error('Failed to regenerate access code via API, using mock:', err);
      const newCode = await mockInstructorDataService.generateAccessCode(groupId);
      setSimulationGroup(prev => prev ? { ...prev, group_access_code: newCode } : prev);
    }
  };

  const handleCopyAccessCode = () => {
    navigator.clipboard.writeText(accessCode);
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

      // Load patient-specific questions from API
      if (groupId) {
        instructorService.getSimulationGroupQuestions(groupId, patientId)
          .then((assigned: any[]) => {
            const patientQuestions: GlobalRubricQuestion[] = assigned.map((q: any) => ({
              id: q.question_id,
              title: q.title || '',
              keyQuestion: q.question_text || '',
              clinicalIntent: '',
              evaluationCriteria: q.evaluation_criteria || '',
              required: q.is_mandatory ?? false,
            }));
            setCaseSpecificQuestions(patientQuestions);
            setSelectedCaseQuestionId(patientQuestions[0]?.id || '');
            setIncludedQuestionIds(new Set(assigned.map((q: any) => q.question_id)));
          })
          .catch(() => {
            setCaseSpecificQuestions([]);
            setSelectedCaseQuestionId('');
            setIncludedQuestionIds(new Set());
          });
      }

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

  const handleBackFromViewStudent = () => {
    setSelectedStudentId(null);
    setStudentDetails(null);
    setStudentPatientData(null);
    setActiveSection('students');
  };

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

  const handleAddNewInstructor = () => {
    setIsAddInstructorDialogOpen(true);
  };

  const handleAddInstructorSubmit = async (email: string, name: string) => {
    if (!groupId) return;
    try {
      // Elevate to instructor role (if needed) + enroll in this group
      await adminApi.addInstructorToGroup(groupId, email);
      // Refresh the instructor list from the API
      const updated = await adminApi.getGroupInstructors(groupId);
      setInstructors(updated);
    } catch (err) {
      console.error('Failed to add instructor via API, adding locally:', err);
      // Fallback: add to local state so the UI still works
      const [first_name, ...rest] = name.split(' ');
      const last_name = rest.join(' ') || '';
      setInstructors(prev => [...prev, { user_email: email, first_name, last_name }]);
    }
  };

  const handleRemoveInstructor = async (instructorEmail: string) => {
    if (!groupId) return;
    const instructor = instructors.find(i => i.user_email === instructorEmail);
    const displayName = instructor ? `${instructor.first_name} ${instructor.last_name}` : instructorEmail;
    if (confirm(`Are you sure you want to remove ${displayName} from this group?`)) {
      try {
        await adminApi.removeInstructorFromGroup(groupId, instructorEmail);
        const updated = await adminApi.getGroupInstructors(groupId);
        setInstructors(updated);
      } catch (err) {
        console.error('Failed to remove instructor via API, removing locally:', err);
        // Fallback: remove from local state
        setInstructors(prev => prev.filter(i => i.user_email !== instructorEmail));
      }
    }
  };

  const handleLoadDefaultPrompt = async () => {
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
        mockInstructorDataService.updatePatient(groupId, {
          patient_id: selectedPatientForEdit,
          patient_name: editPatientName,
          patient_age: parseInt(editPatientAge) || 0,
          patient_gender: editPatientGender,
          patient_prompt: editPatientPrompt,
        });
      }
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
        const manageablePatients = await instructorService.getManageablePatients(groupId);
        setManageablePatients(manageablePatients);
      });
    }
  };

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
      setUploadStatus(prev => ({ ...prev, [fileType]: 'uploading' }));
      try {
        await instructorService.uploadPatientFile(groupId, patientId, file, folderType);
        setUploadStatus(prev => ({ ...prev, [fileType]: 'success' }));
        setTimeout(() => setUploadStatus(prev => ({ ...prev, [fileType]: 'idle' })), 3000);
      } catch (error) {
        console.error('Failed to upload patient file', { groupId, patientId, fileType, error });
        setUploadStatus(prev => ({ ...prev, [fileType]: 'error' }));
        setTimeout(() => setUploadStatus(prev => ({ ...prev, [fileType]: 'idle' })), 5000);
      }
    }
    e.target.value = '';
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

  const handleSaveNewQuestion = async (question: {
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
      tags: addQuestionType === 'patientSpecific' ? ['patient_specific'] : [],
      usedBySimulationGroups: [],
      usedByPatients: addQuestionType === 'patientSpecific' ? [] : undefined
    };

    if (addQuestionType === 'global') {
      if (organizationId) {
        try {
          await adminApi.createQuestionBankQuestion(organizationId, {
            title: question.title,
            question_text: question.keyQuestion,
            evaluation_criteria: question.evaluationCriteria,
            is_mandatory: question.required,
            tags: [],
          });
          // Reload questions from admin API (org-scoped)
          const allQuestions = await adminApi.getQuestionBankQuestions(organizationId);
          const global = allQuestions.filter(q => !q.tags?.includes('patient_specific'));
          setGlobalBankQuestions(global);
        } catch (err) {
          console.error('Failed to create question via API, falling back to mock:', err);
          instructorService.addToGlobalQuestionBank(newBankQuestion);
          setGlobalBankQuestions(prev => [...prev, newBankQuestion]);
        }
      } else {
        // No org context — local-only fallback
        instructorService.addToGlobalQuestionBank(newBankQuestion);
        setGlobalBankQuestions(prev => [...prev, newBankQuestion]);
      }
    } else {
      instructorService.addToPatientSpecificQuestionBank(newBankQuestion);
      setPatientSpecificBankQuestions(instructorService.getPatientSpecificQuestionBank());
    }

    console.log('Saved new question to bank:', addQuestionType, question);
  };

  const handleSaveNewPatientQuestion = async (question: {
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
      tags: ['patient_specific'],
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

    try {
      // 1. Create the question in the question_bank via real API
      const created = await adminApi.createQuestionBankQuestion(organizationId!, {
        title: question.title,
        question_text: question.keyQuestion,
        evaluation_criteria: question.evaluationCriteria,
        is_mandatory: question.required,
      });

      // 2. Assign it to the group with persona_id to make it patient-specific
      await instructorService.assignQuestionToGroup(
        groupId || '',
        created.id,
        question.patientId
      );

      // 3. Refresh the question bank from the API
      const updatedBank = await instructorService.getGlobalQuestionBank();
      setGlobalBankQuestions(updatedBank);

      // 4. Update UI state for the included checkmark
      if (questionBankTab === 'patientSpecific' && selectedPatientForQuestionBank === question.patientId) {
        setIncludedQuestionIds(prev => {
          const newSet = new Set(prev);
          newSet.add(created.id);
          return newSet;
        });
      }

      console.log('Created patient-specific question via API:', created.id);
    } catch (err) {
      console.error('Failed to create patient-specific question:', err);
    }
  };

  const handleToggleQuestionInclusion = async (questionId: string, bankQuestion: QuestionBankItem, isChecked: boolean) => {
    const newSet = new Set(includedQuestionIds);
    const isGlobal = questionBankTab === 'global' || questionId.startsWith('bank-global-');
    const personaId = !isGlobal ? selectedPatientForQuestionBank : undefined;

    try {
      if (isChecked) {
        newSet.add(questionId);

        // Call API to assign question to group (with persona for patient-specific)
        await instructorService.assignQuestionToGroup(groupId || '1', questionId, personaId || undefined);

        if (isGlobal) {
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

        // Call API to unassign question
        await instructorService.unassignQuestion(questionId);

        if (isGlobal) {
          instructorService.deleteGlobalRubricQuestion(groupId || '1', questionId);
          setGlobalRubricQuestions(instructorService.getGlobalRubricQuestions(groupId || '1'));
        }
      }

      setIncludedQuestionIds(newSet);
    } catch (err) {
      console.error('Failed to update question assignment:', err);
    }
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
    const filteredGlobalRubric = globalRubricQuestions.filter(q =>
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

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-full">
          <p style={{ color: UI_COLORS.text.muted }}>Loading...</p>
        </div>
      </PageContainer>
    );
  }

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
            onClick={handleInstructorView}
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
          >
            Instructor View
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
              { section: 'questionBank', icon: <HelpCircle className="w-5 h-5" />, label: 'Question Bank' },
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
              onClick={() => setIsAccessCodeDialogOpen(true)}
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
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight" style={{ color: UI_COLORS.text.heading }}>
                  {simulationGroupName}
                </h2>
                {/* DATE FILTER RANGE */}
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border shadow-sm">
                  <div className="flex items-center gap-2">
                    <label htmlFor="startDate" className="text-sm font-medium text-gray-700">From:</label>
                    <input
                      type="date"
                      id="startDate"
                      className="border-none bg-transparent text-sm focus:ring-0 cursor-pointer outline-none"
                      max={analyticsDateRange.end || undefined}
                      value={analyticsDateRange.start}
                      onChange={(e) => setAnalyticsDateRange(prev => ({ ...prev, start: e.target.value }))}
                    />
                  </div>
                  <div className="h-4 w-px bg-gray-300 mx-1 border-l"></div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="endDate" className="text-sm font-medium text-gray-700">To:</label>
                    <input
                      type="date"
                      id="endDate"
                      className="border-none bg-transparent text-sm focus:ring-0 cursor-pointer outline-none"
                      min={analyticsDateRange.start || undefined}
                      value={analyticsDateRange.end}
                      onChange={(e) => setAnalyticsDateRange(prev => ({ ...prev, end: e.target.value }))}
                    />
                  </div>
                  {(analyticsDateRange.start || analyticsDateRange.end) && (
                    <button
                      onClick={() => setAnalyticsDateRange({ start: '', end: '' })}
                      className="ml-2 text-xs text-gray-500 hover:text-gray-800 focus:outline-none"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

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
                    <div className="border rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveSection('instructors')} style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                      <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[4] + '1a' }}>
                        <UserCog className="w-5 h-5" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[4] }} />
                      </div>
                      <p className="text-2xl font-bold" style={{ color: UI_COLORS.text.heading }}>{simulationGroup.instructor_count ?? 0}</p>
                      <p className="text-sm mt-1" style={{ color: UI_COLORS.text.muted }}>Instructors</p>
                    </div>
                  </div>

                  {/* Per-Patient Completion Percentage Bar */}
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
                            patientName: p.patient_name,
                            completionPercentage: Math.round(p.instructor_completion_percentage ?? 0),
                          }))}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: UI_COLORS.text.body, fontSize: 12 }} axisLine={{ stroke: UI_COLORS.border.default }} tickFormatter={(val: number) => `${val}%`} />
                          <YAxis type="category" dataKey="patientName" width={180} tick={{ fill: UI_COLORS.text.body, fontSize: 12 }} axisLine={{ stroke: UI_COLORS.border.default }} />
                          <Tooltip contentStyle={{ backgroundColor: UI_COLORS.background.white, border: `1px solid ${UI_COLORS.border.default}`, borderRadius: '6px' }} formatter={(value: number | undefined) => [`${value ?? 0}%`, 'Completed']} />
                          <Bar dataKey="completionPercentage" fill={SIMULATION_GROUP_COLOR_PALETTE[2]} radius={[0, 4, 4, 0]} barSize={28} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>No {aiPersonaLabelLower}s configured.</p>
                    )}
                  </div>

                  {/* Key Question Coverage per Patient */}
                  {keyQuestionCoverage.length > 0 && (
                    <div className="border rounded-lg p-6" style={{ borderColor: UI_COLORS.border.default }}>
                      <h3 className="text-xl font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                        Key Question Coverage by {aiPersonaLabel}
                      </h3>
                      <p className="text-sm mb-6" style={{ color: UI_COLORS.text.muted }}>
                        Average percentage of key questions covered by students who completed their interaction.
                      </p>
                      <ResponsiveContainer width="100%" height={Math.max(250, keyQuestionCoverage.length * 50)}>
                        <BarChart data={keyQuestionCoverage} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: UI_COLORS.text.body, fontSize: 12 }} axisLine={{ stroke: UI_COLORS.border.default }} tickFormatter={(val: number) => `${val}%`} />
                          <YAxis type="category" dataKey="patientName" width={180} tick={{ fill: UI_COLORS.text.body, fontSize: 12 }} axisLine={{ stroke: UI_COLORS.border.default }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: UI_COLORS.background.white, border: `1px solid ${UI_COLORS.border.default}`, borderRadius: '6px' }}
                            formatter={(value: number | undefined, _name: string | undefined, props: { payload?: { studentsDebriefed?: number } }) => [
                              `${value ?? 0}% avg (${props.payload?.studentsDebriefed ?? 0} students debriefed)`, 'Coverage'
                            ]}
                          />
                          <Bar dataKey="avgCoverage" radius={[0, 4, 4, 0]} barSize={28}>
                            {keyQuestionCoverage.map((entry, index) => (
                              <Cell key={`cov-${index}`} fill={entry.avgCoverage >= 75 ? '#22c55e' : entry.avgCoverage >= 55 ? '#eab308' : '#ef4444'} />
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
                    {currentPatient.patient_name} Overview
                  </h3>

                  <div className="grid grid-cols-3 gap-6 mb-8">
                    {[
                      { value: currentPatient.student_message_count, label: 'Student Messages', colorIndex: 2 },
                      { value: currentPatient.ai_message_count, label: 'AI Messages', colorIndex: 5 },
                      { value: currentPatient.student_access_count, label: 'Student Access Count', colorIndex: 4 },
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
                      <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>Number of students who answered each key question for {currentPatient.patient_name}.</p>
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
                        <h4 className="text-lg font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                          Student Progress Status
                        </h4>
                        <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>
                          Distribution of student progress status for {currentPatient.patient_name}.
                        </p>
                      </div>

                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={studentProgress}
                        margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                        barSize={50}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                        <XAxis
                          dataKey="status"
                          tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                          axisLine={{ stroke: UI_COLORS.border.default }}
                          label={{ value: 'Progress Status', position: 'insideBottom', offset: -10, fill: UI_COLORS.text.muted, fontSize: 12 }}
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
                            borderRadius: '6px',
                            padding: 0,
                          }}
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null;
                            const entry = payload[0].payload as StudentProgressData;
                            return (
                              <div
                                style={{
                                  backgroundColor: UI_COLORS.background.white,
                                  border: `1px solid ${UI_COLORS.border.default}`,
                                  borderRadius: '8px',
                                  padding: '12px',
                                  minWidth: '180px',
                                  maxWidth: '240px',
                                }}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <div
                                    style={{
                                      width: 10,
                                      height: 10,
                                      borderRadius: '50%',
                                      backgroundColor: entry.fill,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span className="font-semibold text-sm" style={{ color: UI_COLORS.text.heading }}>
                                    {entry.status}
                                  </span>
                                </div>
                                <div className="text-sm mb-2" style={{ color: UI_COLORS.text.muted }}>
                                  {entry.count} student{entry.count !== 1 ? 's' : ''}
                                </div>
                                {entry.students.length > 0 && (
                                  <div
                                    style={{
                                      maxHeight: '150px',
                                      overflowY: 'auto',
                                      borderTop: `1px solid ${UI_COLORS.border.light}`,
                                      paddingTop: '8px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '4px',
                                    }}
                                  >
                                    {entry.students.map((student) => (
                                      <div
                                        key={student.id}
                                        className="text-sm"
                                        style={{ color: UI_COLORS.text.body }}
                                      >
                                        {student.name}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer">
                          {studentProgress.map((_entry, index) => (
                            <Cell
                              key={`progress-${index}`}
                              fill={_entry.fill}
                              style={{ cursor: 'pointer' }}
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
                <div className="grid grid-cols-[2fr_1fr_1fr_2fr] gap-4 px-6 py-4" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
                  {['Patient Name', 'Age', 'Gender', 'Actions'].map(h => (
                    <div key={h} className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>{h}</div>
                  ))}
                </div>

                {filteredPatients.map((patient) => (
                  <div key={patient.patient_id} className="grid grid-cols-[2fr_1fr_1fr_2fr] gap-4 px-6 py-4 border-t items-center" style={{ borderColor: UI_COLORS.border.default }}>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{patient.patient_name}</div>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{patient.patient_age}</div>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{patient.patient_gender}</div>
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
                  onClick={async () => {
                    const newValue = !enableVoiceForAll;
                    setEnableVoiceForAll(newValue);
                    if (groupId) {
                      try {
                        await adminApi.updateGroupAccess({
                          simulation_group_id: groupId,
                          access: true,
                          // admin_voice_enabled: newValue,      // uncomment after migration 005 runs
                          // instructor_voice_enabled: newValue,  // uncomment after migration 005 runs
                        });
                      } catch (err) {
                        console.error('Failed to update voice setting via API:', err);
                        // State already updated locally, so UI stays consistent
                      }
                    }
                  }}
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
                <div className="grid grid-cols-[2fr_3fr_auto] gap-4 px-6 py-4" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
                  {['Instructor Name', 'Email Address', 'Actions'].map(h => (
                    <div key={h} className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>{h}</div>
                  ))}
                </div>
                {instructorsLoading ? (
                  <div className="px-6 py-8 text-center" style={{ color: UI_COLORS.text.muted }}>
                    Loading instructors...
                  </div>
                ) : filteredInstructors.length === 0 ? (
                  <div className="px-6 py-8 text-center" style={{ color: UI_COLORS.text.muted }}>
                    {instructorSearchQuery ? 'No instructors match your search.' : 'No instructors assigned to this group yet.'}
                  </div>
                ) : (
                  filteredInstructors.map((instructor) => (
                    <div key={instructor.user_email} className="grid grid-cols-[2fr_3fr_auto] gap-4 px-6 py-4 border-t items-center" style={{ borderColor: UI_COLORS.border.default }}>
                      <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{instructor.first_name} {instructor.last_name}</div>
                      <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{instructor.user_email}</div>
                      <div>
                        <button
                          onClick={() => handleRemoveInstructor(instructor.user_email)}
                          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                          style={{ border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                          aria-label="Remove instructor from group"
                          title="Remove from group"
                        >
                          <Trash2 className="w-5 h-5" style={{ color: UI_COLORS.status.error }} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
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
                      setQuestionBankSearchQuery('');
                      setQuestionBankTagFilter('');
                      const globalRubric = instructorService.getGlobalRubricQuestions(groupId || '1');
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
                      setQuestionBankSearchQuery('');
                      setQuestionBankTagFilter('');
                      if (selectedPatientForQuestionBank && groupId) {
                        instructorService.getSimulationGroupQuestions(groupId, selectedPatientForQuestionBank)
                          .then((assigned: any[]) => {
                            setIncludedQuestionIds(new Set(assigned.map((q: any) => q.question_id)));
                          })
                          .catch(() => setIncludedQuestionIds(new Set()));
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
                  {/* Search and Tag Filter */}
                  <div className="flex gap-3 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                      <Input
                        placeholder="Search questions..."
                        value={questionBankSearchQuery}
                        onChange={(e) => setQuestionBankSearchQuery(e.target.value)}
                        className="pl-9 py-2 text-sm"
                        style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                      />
                    </div>
                    <select
                      value={questionBankTagFilter}
                      onChange={(e) => setQuestionBankTagFilter(e.target.value)}
                      className="px-3 py-2 rounded-md border text-sm"
                      style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white, color: UI_COLORS.text.heading, minWidth: '10rem' }}
                    >
                      <option value="">All Tags</option>
                      {allExistingTags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>

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
                      {filteredGlobalBankQuestions.length === 0 ? (
                        <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>
                          {questionBankSearchQuery || questionBankTagFilter ? 'No questions match your filters.' : 'No global questions yet.'}
                        </p>
                      ) : filteredGlobalBankQuestions.map((question) => (
                        <div key={question.id} className="flex items-center justify-between p-4 rounded-lg border transition-colors" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                          <div className="flex-1 min-w-0 mr-3">
                            <span className="text-sm font-medium block" style={{ color: UI_COLORS.text.heading }}>{question.title}</span>
                            {(question.tags || []).filter(t => t !== 'patient_specific').length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {question.tags!.filter(t => t !== 'patient_specific').map(tag => (
                                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
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
                            if (patientId && groupId) {
                              // Load assigned questions for this patient from API
                              instructorService.getSimulationGroupQuestions(groupId, patientId)
                                .then((assigned: any[]) => {
                                  setIncludedQuestionIds(new Set(assigned.map((q: any) => q.question_id)));
                                })
                                .catch(() => setIncludedQuestionIds(new Set()));
                            } else {
                              setIncludedQuestionIds(new Set());
                            }
                          }}
                          className="w-full px-4 py-2 rounded-lg border"
                          style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white, color: UI_COLORS.text.heading }}
                        >
                          <option value="">-- Select a patient --</option>
                          {manageablePatients.map((patient) => (
                            <option key={patient.patient_id} value={patient.patient_id}>{patient.patient_name}</option>
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
                        filteredPatientBankQuestions.length === 0 ? (
                          <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>
                            {questionBankSearchQuery || questionBankTagFilter ? 'No questions match your filters.' : 'No patient-specific questions yet.'}
                          </p>
                        ) : filteredPatientBankQuestions.map((question) => (
                          <div key={question.id} className="flex items-center justify-between p-4 rounded-lg border transition-colors" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                            <div className="flex-1 min-w-0 mr-3">
                              <span className="text-sm font-medium block" style={{ color: UI_COLORS.text.heading }}>{question.title}</span>
                              {(question.tags || []).filter(t => t !== 'patient_specific').length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {question.tags!.filter(t => t !== 'patient_specific').map(tag => (
                                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
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
                      onClick={() => handleEditPatientTabSwitch(tab as typeof editPatientTab)}
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
                        <UserAvatar name={editPatientName || 'P'} imageUrl={patientBeingEdited?.photo_url} size="large" />
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
                            <div className="flex items-center gap-2">
                              <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>{label}</span>
                              {uploadStatus[type] === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: UI_COLORS.text.muted }} />}
                              {uploadStatus[type] === 'success' && <span className="flex items-center gap-1 text-sm" style={{ color: '#16a34a' }}><CheckCircle className="w-4 h-4" /> Uploaded</span>}
                              {uploadStatus[type] === 'error' && <span className="flex items-center gap-1 text-sm" style={{ color: '#dc2626' }}><XCircle className="w-4 h-4" /> Failed</span>}
                            </div>
                            <label className={`cursor-pointer ${uploadStatus[type] === 'uploading' ? 'pointer-events-none opacity-50' : ''}`}>
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
                  {studentDetailsLoading ? (
                    <div className="flex items-center gap-2 text-sm" style={{ color: UI_COLORS.text.muted }}>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </div>
                  ) : studentDetails ? (
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
                  ) : null}
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
                        {(studentPatientData?.patientNames || []).map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>

                    <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>Click on the dropdown icon to view the student's chat history and export per-case reports.</p>

                    <div className="space-y-4">
                      {(studentPatientData?.attempts[selectedPatientFilter] || []).map((attempt) => {
                        const isExpanded = expandedAttemptId === attempt.id;
                        const messages = studentPatientData?.messages[attempt.id] || [];
                        const notes = studentPatientData?.notes[attempt.id] || '';

                        return (
                          <div key={attempt.id} className="border rounded-lg overflow-hidden" style={{ borderColor: UI_COLORS.border.default }}>
                            <div
                              className="grid grid-cols-[2fr_2fr_2fr_1fr] gap-4 px-6 py-4 items-center cursor-pointer transition-colors hover:bg-gray-50"
                              style={{ backgroundColor: isExpanded ? UI_COLORS.background.tableHeader : UI_COLORS.background.white }}
                              onClick={() => setExpandedAttemptId(isExpanded ? null : attempt.id)}
                            >
                              <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{attempt.date}</div>
                              <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{attempt.completionStatus}</div>
                              <div className="flex justify-end">
                                <button className="p-2 rounded transition-transform" style={{ border: 'none', cursor: 'pointer', backgroundColor: 'transparent', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="border-t" style={{ borderColor: UI_COLORS.border.default }}>
                                <div
                                  ref={(el) => {
                                    attemptPdfRefs.current[String(attempt.id)] = el;
                                  }}
                                  className="bg-white"
                                >
                                <div className="p-6">
                                  <h3 className="text-lg font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>Chat History</h3>
                                  <div className="border rounded-lg p-4 space-y-4 max-h-96 overflow-y-auto" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                                    {messages.length > 0 ? messages.map((message) => (
                                      <div key={message.message_id} className={`flex gap-3 ${message.sender_type === 'student' ? 'justify-end' : 'justify-start'}`}>
                                        {message.sender_type !== 'student' && <div className="flex-shrink-0"><UserAvatar name={selectedPatientFilter || 'Patient'} imageUrl={undefined} size="small" /></div>}
                                        <div
                                          className={`max-w-[70%] rounded-lg px-4 py-3 ${message.sender_type === 'student' ? 'rounded-br-none' : 'rounded-bl-none'}`}
                                          style={{ backgroundColor: message.sender_type === 'student' ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.background.hoverLight, color: message.sender_type === 'student' ? UI_COLORS.button.text : UI_COLORS.text.heading }}
                                        >
                                          <p className="text-sm font-semibold mb-1">{message.sender_type === 'student' ? `${studentDetails?.name || 'Student'} (User)` : `${selectedPatientFilter || 'Patient'} (LLM)`}:</p>
                                          <p className="text-sm">{message.message_content}</p>
                                        </div>
                                        {message.sender_type === 'student' && <div className="flex-shrink-0"><UserAvatar name={studentDetails?.name || 'Student'} imageUrl={undefined} size="small" /></div>}
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
                                </div>

                                <div className="px-6 pb-6 flex gap-4">
                                  <Button
                                    className="px-6 py-3 text-base font-medium transition-colors"
                                    style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
                                    onClick={async () => {
                                      const el = attemptPdfRefs.current[String(attempt.id)];
                                      if (!el) return;
                                      setIsGeneratingPdf(attempt.id);
                                      const scrollEls = Array.from(el.querySelectorAll<HTMLElement>('.overflow-y-auto'));
                                      const prev = scrollEls.map((node) => ({ node, maxHeight: node.style.maxHeight, overflowY: node.style.overflowY }));
                                      scrollEls.forEach((node) => { node.style.maxHeight = 'none'; node.style.overflowY = 'visible'; });
                                      try {
                                        await downloadChatPdf({ element: el, filename: `chat-${attempt.id}.pdf`, scale: 2 });
                                      } catch (error) {
                                        console.error('Failed to download chat PDF:', error);
                                      } finally {
                                        prev.forEach(({ node, maxHeight, overflowY }) => { node.style.maxHeight = maxHeight; node.style.overflowY = overflowY; });
                                        setIsGeneratingPdf(null);
                                      }
                                    }}
                                  >
                                    {isGeneratingPdf === attempt.id ? 'Generating...' : 'Download Chat PDF'}
                                  </Button>
                                  <Button
                                    className="px-6 py-3 text-base font-medium transition-colors"
                                    style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
                                    onClick={() => handleDownloadNotesPDF(attempt.id)}
                                  >
                                    Download Notes PDF
                                  </Button>
                                  {attempt.completionStatus === 'Debrief Reached' && (
                                    <Button
                                      className="px-6 py-3 text-base font-medium transition-colors"
                                      style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
                                      onClick={() => handleViewAIDebrief(attempt.id)}
                                      disabled={!!isFetchingDebrief}
                                    >
                                      {isFetchingDebrief === attempt.id ? (
                                        <span className="flex items-center gap-2">
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Loading...
                                        </span>
                                      ) : 'View AI Debrief'}
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

      <AddQuestionDialog
        open={isAddQuestionDialogOpen}
        onOpenChange={setIsAddQuestionDialogOpen}
        questionType={addQuestionType}
        existingTags={allExistingTags}
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

      <AIDebriefDialog
        isOpen={isAIDebriefOpen}
        onClose={() => setIsAIDebriefOpen(false)}
        data={selectedDebriefData}
        simulationGroupId={groupId}
      />
    </PageContainer>
  );
}

export default AdminSimulationGroupPage;
