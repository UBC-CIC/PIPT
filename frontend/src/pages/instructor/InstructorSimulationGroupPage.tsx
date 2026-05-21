import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, Users, UserCog, FileText, Eye, Menu, HelpCircle, Pill, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import PageContainer from '@/components/PageContainer';
import UserAvatar from '@/components/UserAvatar';
import { useAuth } from '@/App';
import { instructorService, type GlobalRubricQuestion, type QuestionBankItem } from '@/services/instructorService';
import { studentService } from '@/services/studentService';
import LoadingIndicator from '@/components/LoadingIndicator';
import { UI_COLORS } from '@/lib/colors';
import { useSimulationGroupData } from '@/hooks/useSimulationGroupData';
import { usePatientEditor } from '@/hooks/usePatientEditor';
import { useQuestionBank } from '@/hooks/useQuestionBank';
import { useDTPBank } from '@/hooks/useDTPBank';
import { useRecommendationsBank } from '@/hooks/useRecommendationsBank';
import { useStudentViewer } from '@/hooks/useStudentViewer';
import { useDebriefViewer } from '@/hooks/useDebriefViewer';
import { SimulationGroupSidebar } from '@/components/simulation-group/SimulationGroupSidebar';
import { AnalyticsSection } from '@/components/simulation-group/AnalyticsSection';
import { PatientsSection } from '@/components/simulation-group/PatientsSection';
import { StudentsSection } from '@/components/simulation-group/StudentsSection';
import { StudentDetailsPanel } from '@/components/simulation-group/StudentDetailsPanel';
import { EditPatientPanel } from '@/components/simulation-group/EditPatientPanel';
import { RubricSection } from '@/components/simulation-group/RubricSection';
import { QuestionBankSection } from '@/components/simulation-group/QuestionBankSection';
import { DTPBankSection } from '@/components/simulation-group/DTPBankSection';
import { RecommendationsBankSection } from '@/components/simulation-group/RecommendationsBankSection';
import { AddQuestionDialog } from '@/components/AddQuestionDialog';
import { AddPatientSpecificQuestionDialog } from '@/components/AddPatientSpecificQuestionDialog';
import AIDebriefDialog from '../../components/AIDebriefDialog';
import { useNotification } from '@/components/notifications';
import { listDTPItemsAsInstructor, assignDTPToGroup, assignDTPToPatient, getAssignedDTPs, unassignDTP, createDTPItem } from '@/services/dtpBankService';
import type { DTPAssignment } from '@/services/dtpBankService';
import { listRecommendationItemsAsInstructor, assignRecommendationToGroup, assignRecommendationToPatient, getAssignedRecommendations, unassignRecommendation, createRecommendationItem } from '@/services/recommendationsBankService';
import type { RecommendationAssignment } from '@/services/recommendationsBankService';

type ActiveSection = 'analytics' | 'patients' | 'students' | 'rubric' | 'questionBank' | 'dtpBank' | 'recommendationsBank' | 'prompt' | 'editPatient' | 'viewStudent';

/**
 * InstructorSimulationGroupPage — thin shell composing shared hooks and components.
 * Instructor-specific: debrief prompt section, voice toggle, access code dialog.
 */
function InstructorSimulationGroupPage() {
  const navigate = useNavigate();
  const { signOut, user: authUser } = useAuth();
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const adminReturnUrl = searchParams.get('returnUrl');
  const { showNotification } = useNotification();

  // Section navigation
  const [activeSection, setActiveSection] = useState<ActiveSection>('analytics');
  const [isMainSidebarVisible, setIsMainSidebarVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Shared hooks
  const groupData = useSimulationGroupData({ groupId, role: 'instructor' });
  const patientEditor = usePatientEditor({
    groupId, role: 'instructor',
    manageablePatients: groupData.manageablePatients, setManageablePatients: groupData.setManageablePatients,
    profilePictures: groupData.profilePictures, setProfilePictures: groupData.setProfilePictures,
    reloadPatients: groupData.reloadPatients,
  });
  const questionBank = useQuestionBank({ role: 'instructor' });
  const dtpBank = useDTPBank({ role: 'instructor' });
  const recommendationsBank = useRecommendationsBank({ role: 'instructor' });
  const studentViewer = useStudentViewer({ groupId, groupName: groupData.simulationGroup?.group_name });
  const debriefViewer = useDebriefViewer({ groupId });

  // Instructor-specific: prompts
  const [, setEvaluationPromptText] = useState('');
  const [debriefPromptText, setDebriefPromptText] = useState('');

  // Global rubric state
  const [globalRubricQuestions, setGlobalRubricQuestions] = useState<GlobalRubricQuestion[]>(() =>
    instructorService.getGlobalRubricQuestions(groupId || '1')
  );
  // Mapping from question bank ID → group_question_id (assignment record ID) for unassign
  const questionIdToGroupQuestionId = useRef<Map<string, string>>(new Map());
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(() => {
    const questions = instructorService.getGlobalRubricQuestions(groupId || '1');
    return questions[0]?.id || null;
  });
  const [rubricSearchQuery, setRubricSearchQuery] = useState('');
  const [isAccessCodeDialogOpen, setIsAccessCodeDialogOpen] = useState(false);

  const { labels, simulationGroup, setSimulationGroup, manageablePatients, profilePictures, students,
    patientAnalytics, analyticsDateRange, setAnalyticsDateRange, keyQuestionCoverage,
    keyQuestionAnalytics, studentProgress, selectedPatientId, setSelectedPatientId, loading, user,
  } = groupData;

  const { includedQuestionIds, setIncludedQuestionIds, pendingQuestionIds, setPendingQuestionIds,
    questionBankTab, globalBankQuestions, patientSpecificBankQuestions, setPatientSpecificBankQuestions,
    allExistingTags, setGlobalBankQuestions, setQuestionBankLoading, setQuestionBankError,
    isAddQuestionDialogOpen, setIsAddQuestionDialogOpen,
    isAddPatientQuestionDialogOpen, setIsAddPatientQuestionDialogOpen,
    selectedPatientForQuestionBank,
  } = questionBank;

  const { aiPersonaLabelLower, aiPersonaPlural: aiPersonaLabelPlural, userRole: userRoleLabel } = {
    aiPersonaLabelLower: labels.aiPersonaLower, aiPersonaPlural: labels.aiPersonaPlural, userRole: labels.userRole,
  };

  const accessCode = simulationGroup?.group_access_code || 'XXXX-XXXX-XXXX-XXXX';
  const hasAdminRole = authUser?.groups.includes('admin') || false;
  const selectedQuestion = globalRubricQuestions.find(q => q.id === selectedQuestionId);
  const enableVoiceForAll = manageablePatients.length > 0 && manageablePatients.every((p: any) => p.voice_enabled !== false);

  // ── Load prompts ──
  useEffect(() => {
    if (!groupId) return;
    (async () => {
      try {
        const [evalPrompt, debriefPrompt] = await Promise.all([
          instructorService.getEvaluationPrompt(groupId),
          instructorService.getDebriefPrompt(groupId),
        ]);
        setEvaluationPromptText(evalPrompt);
        setDebriefPromptText(debriefPrompt);
      } catch (error) { console.error('Error loading prompts:', error); }
    })();
  }, [groupId]);

  // ── Load question bank data ──
  useEffect(() => {
    if (activeSection !== 'questionBank') return;
    (async () => {
      try {
        setQuestionBankLoading(true); setQuestionBankError(null);
        const questions = await instructorService.getGlobalQuestionBank();
        setGlobalBankQuestions(questions);
      } catch (err) {
        setQuestionBankError(err instanceof Error ? err.message : 'Failed to load question bank');
      } finally { setQuestionBankLoading(false); }
    })();
  }, [activeSection]);

  // ── Load assigned questions ──
  useEffect(() => {
    if ((activeSection === 'rubric' || activeSection === 'questionBank' || activeSection === 'editPatient') && groupId) {
      instructorService.getSimulationGroupQuestions(groupId)
        .then((assigned: any[]) => {
          const rubricQuestions: GlobalRubricQuestion[] = assigned.map((q: any) => ({
            id: q.question_id, group_question_id: q.group_question_id,
            title: q.title || '', keyQuestion: q.question_text || '',
            clinicalIntent: '', evaluationCriteria: q.evaluation_criteria || '',
            required: q.is_mandatory ?? false,
          }));
          setGlobalRubricQuestions(rubricQuestions);
          setIncludedQuestionIds(new Set(assigned.map((q: any) => q.question_id)));
          setPendingQuestionIds(new Set(assigned.map((q: any) => q.question_id)));
          // Build questionId → groupQuestionId mapping
          const map = new Map<string, string>();
          for (const q of assigned) {
            if (q.question_id && q.group_question_id) map.set(q.question_id, q.group_question_id);
          }
          questionIdToGroupQuestionId.current = map;
          if (rubricQuestions.length > 0 && !selectedQuestionId) setSelectedQuestionId(rubricQuestions[0].id);
        })
        .catch((err: any) => console.error('Failed to load assigned questions:', err));
    }
  }, [activeSection, groupId]);

  // ── DTP Bank: mapping from DTP item ID → group_dtp_id for unassign ──
  const dtpIdToGroupDtpId = useRef<Map<string, string>>(new Map());

  // ── Recommendations Bank: mapping from Recommendation item ID → group_recommendation_id for unassign ──
  const recIdToGroupRecId = useRef<Map<string, string>>(new Map());

  // ── Load DTP bank items when section becomes active ──
  useEffect(() => {
    if (activeSection !== 'dtpBank' || !groupId) return;
    const orgId = simulationGroup?.organization_id;
    if (orgId) {
      dtpBank.setLoading(true);
      listDTPItemsAsInstructor(orgId).then((items) => {
        dtpBank.setDtpItems(items);
        dtpBank.setLoading(false);
      }).catch(() => dtpBank.setLoading(false));
    }
    // Load assignments (group-wide by default)
    getAssignedDTPs(groupId).then((assignments) => {
      dtpBank.setIncludedIds(new Set(assignments.map(a => a.dtpId)));
      dtpBank.setPendingIds(new Set(assignments.map(a => a.dtpId)));
      dtpIdToGroupDtpId.current.clear();
      for (const a of assignments) dtpIdToGroupDtpId.current.set(a.dtpId, a.groupDtpId);
    }).catch(() => dtpBank.setIncludedIds(new Set()));
  }, [activeSection, groupId, simulationGroup?.organization_id]);

  // ── Load Recommendations bank items when section becomes active ──
  useEffect(() => {
    if (activeSection !== 'recommendationsBank' || !groupId) return;
    const orgId = simulationGroup?.organization_id;
    if (orgId) {
      recommendationsBank.setLoading(true);
      listRecommendationItemsAsInstructor(orgId).then((items) => {
        recommendationsBank.setRecommendationItems(items);
        recommendationsBank.setLoading(false);
      }).catch(() => recommendationsBank.setLoading(false));
    }
    // Load assignments (group-wide by default)
    getAssignedRecommendations(groupId).then((assignments) => {
      recommendationsBank.setIncludedIds(new Set(assignments.map(a => a.recommendationId)));
      recommendationsBank.setPendingIds(new Set(assignments.map(a => a.recommendationId)));
      recIdToGroupRecId.current.clear();
      for (const a of assignments) recIdToGroupRecId.current.set(a.recommendationId, a.groupRecommendationId);
    }).catch(() => recommendationsBank.setIncludedIds(new Set()));
  }, [activeSection, groupId, simulationGroup?.organization_id]);

  // ── DTP Bank: confirm selections handler ──
  const handleConfirmDTPSelections = async () => {
    if (!groupId) return;
    try {
      const idsToAdd = [...dtpBank.pendingIds].filter(id => !dtpBank.includedIds.has(id));
      const idsToRemove = [...dtpBank.includedIds].filter(id => !dtpBank.pendingIds.has(id));

      for (const id of idsToAdd) {
        const result = dtpBank.selectedPatientId
          ? await assignDTPToPatient(id, groupId, dtpBank.selectedPatientId)
          : await assignDTPToGroup(id, groupId);
        if (result?.groupDtpId) dtpIdToGroupDtpId.current.set(id, result.groupDtpId);
      }
      for (const id of idsToRemove) {
        const groupDtpId = dtpIdToGroupDtpId.current.get(id);
        if (groupDtpId) {
          await unassignDTP(groupDtpId);
          dtpIdToGroupDtpId.current.delete(id);
        }
      }
      dtpBank.setIncludedIds(new Set(dtpBank.pendingIds));
      showNotification({ message: 'DTP selections confirmed.', type: 'success' });
    } catch (err) {
      console.error('Failed to confirm DTP selections:', err);
      showNotification({ message: 'Failed to confirm DTP selections.', type: 'error' });
    }
  };

  // ── Recommendations Bank: confirm selections handler ──
  const handleConfirmRecommendationSelections = async () => {
    if (!groupId) return;
    try {
      const idsToAdd = [...recommendationsBank.pendingIds].filter(id => !recommendationsBank.includedIds.has(id));
      const idsToRemove = [...recommendationsBank.includedIds].filter(id => !recommendationsBank.pendingIds.has(id));

      for (const id of idsToAdd) {
        const result = recommendationsBank.selectedPatientId
          ? await assignRecommendationToPatient(id, groupId, recommendationsBank.selectedPatientId)
          : await assignRecommendationToGroup(id, groupId);
        if (result?.groupRecommendationId) recIdToGroupRecId.current.set(id, result.groupRecommendationId);
      }
      for (const id of idsToRemove) {
        const groupRecId = recIdToGroupRecId.current.get(id);
        if (groupRecId) {
          await unassignRecommendation(groupRecId);
          recIdToGroupRecId.current.delete(id);
        }
      }
      recommendationsBank.setIncludedIds(new Set(recommendationsBank.pendingIds));
      showNotification({ message: 'Recommendation selections confirmed.', type: 'success' });
    } catch (err) {
      console.error('Failed to confirm Recommendation selections:', err);
      showNotification({ message: 'Failed to confirm Recommendation selections.', type: 'error' });
    }
  };

  // ── DTP/Rec tab sync helpers ──
  const syncDTPGroupWideIds = () => {
    if (!groupId) return;
    getAssignedDTPs(groupId).then((assignments) => {
      dtpBank.setIncludedIds(new Set(assignments.map(a => a.dtpId)));
      dtpBank.setPendingIds(new Set(assignments.map(a => a.dtpId)));
      dtpIdToGroupDtpId.current.clear();
      for (const a of assignments) dtpIdToGroupDtpId.current.set(a.dtpId, a.groupDtpId);
    }).catch(() => { dtpBank.setIncludedIds(new Set()); dtpBank.setPendingIds(new Set()); });
  };

  const syncDTPPatientIds = (patientId: string | null) => {
    if (!groupId || !patientId) { dtpBank.setIncludedIds(new Set()); dtpBank.setPendingIds(new Set()); return; }
    getAssignedDTPs(groupId, patientId).then((assignments) => {
      dtpBank.setIncludedIds(new Set(assignments.map(a => a.dtpId)));
      dtpBank.setPendingIds(new Set(assignments.map(a => a.dtpId)));
      dtpIdToGroupDtpId.current.clear();
      for (const a of assignments) dtpIdToGroupDtpId.current.set(a.dtpId, a.groupDtpId);
    }).catch(() => { dtpBank.setIncludedIds(new Set()); dtpBank.setPendingIds(new Set()); });
  };

  const syncRecGroupWideIds = () => {
    if (!groupId) return;
    getAssignedRecommendations(groupId).then((assignments) => {
      recommendationsBank.setIncludedIds(new Set(assignments.map(a => a.recommendationId)));
      recommendationsBank.setPendingIds(new Set(assignments.map(a => a.recommendationId)));
      recIdToGroupRecId.current.clear();
      for (const a of assignments) recIdToGroupRecId.current.set(a.recommendationId, a.groupRecommendationId);
    }).catch(() => { recommendationsBank.setIncludedIds(new Set()); recommendationsBank.setPendingIds(new Set()); });
  };

  const syncRecPatientIds = (patientId: string | null) => {
    if (!groupId || !patientId) { recommendationsBank.setIncludedIds(new Set()); recommendationsBank.setPendingIds(new Set()); return; }
    getAssignedRecommendations(groupId, patientId).then((assignments) => {
      recommendationsBank.setIncludedIds(new Set(assignments.map(a => a.recommendationId)));
      recommendationsBank.setPendingIds(new Set(assignments.map(a => a.recommendationId)));
      recIdToGroupRecId.current.clear();
      for (const a of assignments) recIdToGroupRecId.current.set(a.recommendationId, a.groupRecommendationId);
    }).catch(() => { recommendationsBank.setIncludedIds(new Set()); recommendationsBank.setPendingIds(new Set()); });
  };

  // ── Edit Patient: Patient-specific DTPs/Recs state ──
  const [patientDTPs, setPatientDTPs] = useState<DTPAssignment[]>([]);
  const [patientRecommendations, setPatientRecommendations] = useState<RecommendationAssignment[]>([]);

  const handleLoadPatientDTPs = (patientId: string) => {
    if (!groupId) return;
    getAssignedDTPs(groupId, patientId).then(setPatientDTPs).catch(() => setPatientDTPs([]));
  };

  const handleLoadPatientRecommendations = (patientId: string) => {
    if (!groupId) return;
    getAssignedRecommendations(groupId, patientId).then(setPatientRecommendations).catch(() => setPatientRecommendations([]));
  };

  const handleCreatePatientDTP = async (patientId: string, data: { title: string; expectedDTPText: string; clinicalIntent: string; evaluationCriteria: string; tags: string[]; isRequired: boolean }) => {
    const orgId = simulationGroup?.organization_id;
    if (!orgId || !groupId) return;
    try {
      const created = await createDTPItem(orgId, data);
      const assignment = await assignDTPToPatient(created.id, groupId, patientId);
      setPatientDTPs(prev => [...prev, assignment]);
      showNotification({ message: 'DTP created and assigned to patient.', type: 'success' });
    } catch (err) {
      console.error('Failed to create patient DTP:', err);
      showNotification({ message: 'Failed to create patient DTP.', type: 'error' });
    }
  };

  const handleDeletePatientDTP = async (_patientId: string, groupDtpId: string) => {
    try {
      await unassignDTP(groupDtpId);
      setPatientDTPs(prev => prev.filter(d => d.groupDtpId !== groupDtpId));
      showNotification({ message: 'DTP removed from patient.', type: 'success' });
    } catch (err) {
      console.error('Failed to remove patient DTP:', err);
      showNotification({ message: 'Failed to remove patient DTP.', type: 'error' });
    }
  };

  const handleCreatePatientRecommendation = async (patientId: string, data: { title: string; recommendationText: string; evaluationCriteria: string; rationale: string }) => {
    const orgId = simulationGroup?.organization_id;
    if (!orgId || !groupId) return;
    try {
      const created = await createRecommendationItem(orgId, data);
      const assignment = await assignRecommendationToPatient(created.id, groupId, patientId);
      setPatientRecommendations(prev => [...prev, assignment]);
      showNotification({ message: 'Recommendation created and assigned to patient.', type: 'success' });
    } catch (err) {
      console.error('Failed to create patient Recommendation:', err);
      showNotification({ message: 'Failed to create patient Recommendation.', type: 'error' });
    }
  };

  const handleDeletePatientRecommendation = async (_patientId: string, groupRecommendationId: string) => {
    try {
      await unassignRecommendation(groupRecommendationId);
      setPatientRecommendations(prev => prev.filter(r => r.groupRecommendationId !== groupRecommendationId));
      showNotification({ message: 'Recommendation removed from patient.', type: 'success' });
    } catch (err) {
      console.error('Failed to remove patient Recommendation:', err);
      showNotification({ message: 'Failed to remove patient Recommendation.', type: 'error' });
    }
  };

  // ── Navigation handlers ──
  const handleSignOut = async () => { await signOut(); };
  const handleBackToAllGroups = () => navigate('/instructor');
  const handleStudentView = async () => {
    const instructorReturnUrl = `/instructor/group/${groupId}`;
    if (groupId && accessCode && accessCode !== 'XXXX-XXXX-XXXX-XXXX') {
      const result = await studentService.joinGroup(accessCode, 'preview');
      if (result?.success) { navigate(`/patients/${groupId}`, { state: { adminReturnUrl: instructorReturnUrl } }); return; }
      showNotification({ message: 'Unable to join this simulation group as a student. Redirecting to your student dashboard.', type: 'warning' });
    }
    navigate('/student');
  };
  const handleAdminView = () => {
    const orgId = simulationGroup?.organization_id;
    orgId && groupId ? navigate(`/admin/organization/${orgId}/group/${groupId}`) : navigate('/admin');
  };
  const handleCopyAccessCode = () => navigator.clipboard.writeText(accessCode);
  const handleGenerateAccessCode = async () => {
    if (!groupId) return;
    try {
      await instructorService.generateAccessCode(groupId);
      setSimulationGroup(await instructorService.getSimulationGroup(groupId));
    } catch (error) { console.error('Error generating access code:', error); }
  };

  // ── Patient / student section handlers ──
  const handleDeletePatient = (patientId: string) => {
    if (confirm(`Are you sure you want to delete this ${aiPersonaLabelLower}?`)) {
      groupData.setManageablePatients(prev => prev.filter(p => p.id !== patientId));
      instructorService.deletePatient(patientId);
    }
  };
  const handleEditPatient = (patientId: string) => {
    patientEditor.startEditing(patientId);
    const questionIds = instructorService.getPatientCaseSpecificQuestionIds(patientId);
    setIncludedQuestionIds(questionIds); setPendingQuestionIds(new Set(questionIds));
    setActiveSection('editPatient');
  };
  const handleBackFromEditPatient = () => { patientEditor.stopEditing(); setActiveSection('patients'); };
  const handleSavePatientChanges = async () => { await patientEditor.savePatient(); handleBackFromEditPatient(); };
  const handleCreateNewPatient = () => { patientEditor.startCreating(); setActiveSection('editPatient'); };
  const handleTogglePatientVoice = async (patientId: string, enabled: boolean) => {
    groupData.setManageablePatients(prev =>
      prev.map(p => (p.id === patientId || p.patient_id === patientId) ? { ...p, voice_enabled: enabled } : p)
    );
    if (groupId) {
      try { await instructorService.updatePatientVoiceEnabled(patientId, groupId, enabled); }
      catch (err) { console.error('Failed to update voice setting:', err); }
    }
  };
  const handleViewStudent = async (studentId: string) => { await studentViewer.viewStudent(studentId); setActiveSection('viewStudent'); };
  const handleBackFromViewStudent = () => { studentViewer.closeStudentView(); setActiveSection('students'); };

  // ── Rubric handlers ──
  const handleSaveQuestion = async () => {
    if (!selectedQuestion) return;
    try { await instructorService.updateGlobalRubricQuestion(groupId || '1', selectedQuestion); showNotification({ message: 'Question saved successfully.', type: 'success' }); }
    catch { showNotification({ message: 'Failed to save question. Please try again.', type: 'error' }); }
  };
  const handleUpdateQuestionField = (field: keyof GlobalRubricQuestion, value: string | boolean) => {
    if (!selectedQuestionId) return;
    setGlobalRubricQuestions(prev => prev.map(q => q.id === selectedQuestionId ? { ...q, [field]: value } : q));
  };

  // ── Question bank handlers (complex business logic) ──
  const handleSaveNewPatientQuestion = (question: { patientId: string; title: string; keyQuestion: string; clinicalIntent: string; evaluationCriteria: string; required: boolean }) => {
    const newQuestionId = `bank-patient-${Date.now()}`;
    const newBankQuestion: any = { id: newQuestionId, title: question.title, questionText: question.keyQuestion, clinicalIntent: question.clinicalIntent, evaluationCriteria: question.evaluationCriteria, isMandatory: question.required, isActive: true, usedBySimulationGroups: [], usedByPatients: [] };
    instructorService.addToPatientSpecificQuestionBank(newBankQuestion);
    setPatientSpecificBankQuestions(instructorService.getPatientSpecificQuestionBank());
    const newCaseQuestion: GlobalRubricQuestion = { id: newQuestionId, title: question.title, keyQuestion: question.keyQuestion, clinicalIntent: question.clinicalIntent, evaluationCriteria: question.evaluationCriteria, required: question.required };
    instructorService.addCaseSpecificQuestion(question.patientId, newCaseQuestion);
    if (questionBankTab === 'patientSpecific' && selectedPatientForQuestionBank === question.patientId) {
      setIncludedQuestionIds(prev => { const s = new Set(prev); s.add(newQuestionId); return s; });
    }
    if (patientEditor.selectedPatientForEdit === question.patientId) {
      patientEditor.setCaseSpecificQuestions(instructorService.getCaseSpecificQuestions(question.patientId));
    }
  };

  const handleToggleQuestionInclusion = async (questionId: string, bankQuestion: QuestionBankItem, isChecked: boolean) => {
    const newSet = new Set(includedQuestionIds);
    try {
      if (isChecked) {
        newSet.add(questionId);
        if (questionBankTab === 'global' || questionId.startsWith('bank-global-')) {
          const result = await instructorService.assignQuestionToGroup(groupId || '1', questionId);
          // Store the new group_question_id in the mapping
          if (result?.group_question_id) {
            questionIdToGroupQuestionId.current.set(questionId, result.group_question_id);
          } else if (Array.isArray(result) && result[0]?.group_question_id) {
            questionIdToGroupQuestionId.current.set(questionId, result[0].group_question_id);
          }
          if (!globalRubricQuestions.find(q => q.id === questionId)) {
            instructorService.addGlobalRubricQuestion(groupId || '1', { id: questionId, title: bankQuestion.title, keyQuestion: bankQuestion.questionText, clinicalIntent: bankQuestion.clinicalIntent, evaluationCriteria: bankQuestion.evaluationCriteria, required: bankQuestion.isMandatory });
            setGlobalRubricQuestions(instructorService.getGlobalRubricQuestions(groupId || '1'));
          }
        }
      } else {
        newSet.delete(questionId);
        if (questionBankTab === 'global' || questionId.startsWith('bank-global-')) {
          const groupQuestionId = questionIdToGroupQuestionId.current.get(questionId);
          if (!groupQuestionId) {
            console.error('No group_question_id found for question:', questionId);
            return;
          }
          await instructorService.unassignQuestion(groupQuestionId);
          questionIdToGroupQuestionId.current.delete(questionId);
          instructorService.deleteGlobalRubricQuestion(groupId || '1', questionId);
          setGlobalRubricQuestions(instructorService.getGlobalRubricQuestions(groupId || '1'));
        }
      }
      setIncludedQuestionIds(newSet);
    } catch (err) { setQuestionBankError(err instanceof Error ? err.message : 'Failed to update question assignment'); }
  };

  const handleConfirmSelections = async () => {
    const allBankQuestions = questionBankTab === 'global' ? globalBankQuestions : patientSpecificBankQuestions;
    try {
      if (questionBankTab === 'global') {
        const idsToAdd = Array.from(pendingQuestionIds).filter(id => !includedQuestionIds.has(id));
        const idsToRemove = Array.from(includedQuestionIds).filter(id => !pendingQuestionIds.has(id));
        if (idsToAdd.length > 0) {
          const result = await instructorService.assignQuestionToGroup(groupId || '1', idsToAdd);
          // Populate questionId → groupQuestionId mapping from the response
          const assignments = Array.isArray(result) ? result : (result ? [result] : []);
          for (const a of assignments) {
            if (a?.question_id && a?.group_question_id) {
              questionIdToGroupQuestionId.current.set(a.question_id, a.group_question_id);
            }
          }
          for (const id of idsToAdd) {
            const bankQ = allBankQuestions.find(q => q.id === id);
            if (bankQ && !globalRubricQuestions.find(q => q.id === id)) {
              instructorService.addGlobalRubricQuestion(groupId || '1', { id: bankQ.id, title: bankQ.title, keyQuestion: bankQ.questionText, clinicalIntent: bankQ.clinicalIntent, evaluationCriteria: bankQ.evaluationCriteria, required: bankQ.isMandatory });
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
              instructorService.addCaseSpecificQuestion(selectedPatientForQuestionBank, { id: bankQ.id, title: bankQ.title, keyQuestion: bankQ.questionText, clinicalIntent: bankQ.clinicalIntent, evaluationCriteria: bankQ.evaluationCriteria, required: bankQ.isMandatory });
              if (patientEditor.selectedPatientForEdit === selectedPatientForQuestionBank) patientEditor.setCaseSpecificQuestions(instructorService.getCaseSpecificQuestions(selectedPatientForQuestionBank));
            }
          }
        });
        includedQuestionIds.forEach(id => {
          if (!pendingQuestionIds.has(id)) {
            instructorService.deleteCaseSpecificQuestion(selectedPatientForQuestionBank, id);
            if (patientEditor.selectedPatientForEdit === selectedPatientForQuestionBank) patientEditor.setCaseSpecificQuestions(instructorService.getCaseSpecificQuestions(selectedPatientForQuestionBank));
          }
        });
      }
      setIncludedQuestionIds(new Set(pendingQuestionIds));
    } catch (err) { setQuestionBankError(err instanceof Error ? err.message : 'Failed to confirm selections'); }
  };

  // ── Question bank tab sync helpers ──
  const syncGlobalIds = () => {
    const ids = new Set(instructorService.getGlobalRubricQuestions(groupId || '1').map(q => q.id));
    setIncludedQuestionIds(ids); setPendingQuestionIds(new Set(ids));
  };
  const syncPatientIds = (patientId: string | null) => {
    if (patientId) {
      const ids = instructorService.getPatientCaseSpecificQuestionIds(patientId);
      setIncludedQuestionIds(ids); setPendingQuestionIds(new Set(ids));
    } else { setIncludedQuestionIds(new Set()); setPendingQuestionIds(new Set()); }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-full">
          <LoadingIndicator size="lg" message="Loading..." />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Header */}
      <header className="flex-shrink-0 flex border-b border-border items-center justify-between py-6 px-8" style={{ backgroundColor: UI_COLORS.header.background }}>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsMainSidebarVisible(!isMainSidebarVisible)} className="p-2 rounded-lg transition-colors" style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }} onMouseEnter={e => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover} onMouseLeave={e => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary} aria-label="Toggle sidebar">
            <Menu className="w-5 h-5" />
          </button>
          <UserAvatar name={user.name} imageUrl={user.avatarUrl} size="medium" />
          <div className="flex flex-col items-start gap-0.5">
            <h1 className="font-bold tracking-tight leading-tight text-2xl" style={{ color: UI_COLORS.text.heading }}>Simulation Group View</h1>
            <button onClick={handleBackToAllGroups} className="font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 transition-colors" style={{ color: UI_COLORS.text.body }} onMouseEnter={e => e.currentTarget.style.color = UI_COLORS.text.heading} onMouseLeave={e => e.currentTarget.style.color = UI_COLORS.text.body}>
              <ArrowLeft className="w-4 h-4" /> Back to All Groups
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {adminReturnUrl && (
            <Button variant="default" onClick={() => navigate(adminReturnUrl)} className="px-6 transition-colors" style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }} onMouseEnter={e => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover} onMouseLeave={e => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}>Back to Admin View</Button>
          )}
          <Button variant="default" onClick={handleStudentView} className="px-6 transition-colors" style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }} onMouseEnter={e => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover} onMouseLeave={e => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}>Student View</Button>
          {hasAdminRole && (
            <Button variant="default" onClick={handleAdminView} className="px-6 transition-colors" style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }} onMouseEnter={e => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover} onMouseLeave={e => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}>Admin View</Button>
          )}
          <Button variant="default" onClick={handleSignOut} className="px-6 transition-colors" style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }} onMouseEnter={e => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover} onMouseLeave={e => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}>Sign Out</Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <SimulationGroupSidebar
          activeSection={activeSection}
          onSectionChange={section => setActiveSection(section as ActiveSection)}
          sections={[
            { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
            { id: 'patients', label: `Manage ${aiPersonaLabelPlural}`, icon: <Users className="w-5 h-5" /> },
            { id: 'students', label: `Manage ${userRoleLabel}s`, icon: <UserCog className="w-5 h-5" /> },
            { id: 'rubric', label: 'Global Key Questions', icon: <FileText className="w-5 h-5" /> },
            { id: 'questionBank', label: 'Question Bank', icon: <HelpCircle className="w-5 h-5" />, onClick: () => { setActiveSection('questionBank'); questionBankTab === 'global' ? syncGlobalIds() : syncPatientIds(selectedPatientForQuestionBank); } },
            { id: 'dtpBank', label: 'DTP Bank', icon: <Pill className="w-5 h-5" /> },
            { id: 'recommendationsBank', label: 'Recommendations Bank', icon: <ClipboardList className="w-5 h-5" /> },
            { id: 'prompt', label: 'View Debrief Prompt', icon: <Eye className="w-5 h-5" /> },
          ]}
          accessCode={accessCode}
          onCopyAccessCode={handleCopyAccessCode}
          onGenerateAccessCode={() => setIsAccessCodeDialogOpen(true)}
          isVisible={isMainSidebarVisible}
          onToggleVisibility={() => setIsMainSidebarVisible(!isMainSidebarVisible)}
        />

        <main className="flex-1 overflow-y-auto" style={{ padding: ['rubric', 'questionBank', 'dtpBank', 'recommendationsBank', 'editPatient', 'viewStudent'].includes(activeSection) ? '0' : '2rem' }}>
          {activeSection === 'analytics' && <AnalyticsSection patientAnalytics={patientAnalytics} analyticsDateRange={analyticsDateRange} onDateRangeChange={setAnalyticsDateRange} keyQuestionCoverage={keyQuestionCoverage} keyQuestionAnalytics={keyQuestionAnalytics} studentProgress={studentProgress} selectedPatientId={selectedPatientId} onPatientSelect={setSelectedPatientId} labels={labels} simulationGroup={simulationGroup} onNavigateToSection={section => setActiveSection(section as ActiveSection)} />}
          {activeSection === 'patients' && <PatientsSection patients={manageablePatients} profilePictures={profilePictures} searchQuery={searchQuery} onSearchChange={setSearchQuery} onEditPatient={handleEditPatient} onDeletePatient={handleDeletePatient} onCreatePatient={handleCreateNewPatient} onTogglePatientVoice={handleTogglePatientVoice} labels={labels} enableVoiceForAll={enableVoiceForAll} onToggleVoice={async (enabled) => {
            for (const p of manageablePatients) {
              const pid = (p as any).id || (p as any).patient_id;
              await handleTogglePatientVoice(pid, enabled);
            }
          }} />}
          {activeSection === 'students' && <StudentsSection students={students} searchQuery={studentSearchQuery} onSearchChange={setStudentSearchQuery} onViewStudent={handleViewStudent} labels={labels} />}
          {activeSection === 'rubric' && <RubricSection questions={globalRubricQuestions} selectedQuestionId={selectedQuestionId} onSelectQuestion={setSelectedQuestionId} searchQuery={rubricSearchQuery} onSearchChange={setRubricSearchQuery} onSaveQuestion={handleSaveQuestion} onUpdateField={handleUpdateQuestionField} />}
          {activeSection === 'questionBank' && <QuestionBankSection questionBank={questionBank} role="instructor" groupId={groupId || '1'} patients={manageablePatients} onConfirmSelections={handleConfirmSelections} onGlobalTabClick={syncGlobalIds} onPatientSpecificTabClick={() => syncPatientIds(selectedPatientForQuestionBank)} onPatientSelect={syncPatientIds} />}
          {activeSection === 'dtpBank' && <DTPBankSection dtpBank={dtpBank} role="instructor" groupId={groupId || ''} patients={manageablePatients} onConfirmSelections={handleConfirmDTPSelections} onGroupWideTabClick={syncDTPGroupWideIds} onPatientSpecificTabClick={() => syncDTPPatientIds(dtpBank.selectedPatientId)} onPatientSelect={syncDTPPatientIds} />}
          {activeSection === 'recommendationsBank' && <RecommendationsBankSection recommendationsBank={recommendationsBank} role="instructor" groupId={groupId || ''} patients={manageablePatients} onConfirmSelections={handleConfirmRecommendationSelections} onGroupWideTabClick={syncRecGroupWideIds} onPatientSpecificTabClick={() => syncRecPatientIds(recommendationsBank.selectedPatientId)} onPatientSelect={syncRecPatientIds} />}
          {activeSection === 'prompt' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold" style={{ color: UI_COLORS.text.heading }}>View Debrief Prompt</h2>
              <textarea readOnly className="w-full px-4 py-3 rounded-lg resize-none text-sm font-mono cursor-default" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.tableHeader, minHeight: '500px' }} defaultValue={debriefPromptText || 'Default built-in debrief prompt is in use.'} />
            </div>
          )}
          {activeSection === 'editPatient' && <EditPatientPanel patientEditor={patientEditor} profilePictures={profilePictures} onBack={handleBackFromEditPatient} labels={labels} groupId={groupId || ''} globalRubricQuestions={globalRubricQuestions} onSavePatient={handleSavePatientChanges} onSaveCaseQuestion={(pid, q) => instructorService.updateCaseSpecificQuestion(pid, q)} onDeleteCaseQuestion={(pid, qid) => instructorService.deleteCaseSpecificQuestion(pid, qid)} onCreatePatientDTP={handleCreatePatientDTP} onDeletePatientDTP={handleDeletePatientDTP} patientDTPs={patientDTPs} onLoadPatientDTPs={handleLoadPatientDTPs} onCreatePatientRecommendation={handleCreatePatientRecommendation} onDeletePatientRecommendation={handleDeletePatientRecommendation} patientRecommendations={patientRecommendations} onLoadPatientRecommendations={handleLoadPatientRecommendations} />}
          {activeSection === 'viewStudent' && studentViewer.selectedStudentId && <StudentDetailsPanel studentDetails={studentViewer.studentDetails} studentDetailsLoading={studentViewer.studentDetailsLoading} studentPatientData={studentViewer.studentPatientData} expandedAttemptId={studentViewer.expandedAttemptId} onExpandAttempt={studentViewer.setExpandedAttemptId} selectedPatientFilter={studentViewer.selectedPatientFilter} onPatientFilterChange={studentViewer.setSelectedPatientFilter} onViewDebrief={debriefViewer.viewDebrief} isFetchingDebrief={debriefViewer.isFetchingDebrief} onDownloadPdf={async (attemptId) => { const el = debriefViewer.attemptPdfRefs.current[String(attemptId)]; if (el) await debriefViewer.downloadPdf(attemptId, el); }} isGeneratingPdf={debriefViewer.isGeneratingPdf} onBack={handleBackFromViewStudent} attemptPdfRefs={debriefViewer.attemptPdfRefs} labels={labels} />}
        </main>
      </div>

      <AIDebriefDialog isOpen={debriefViewer.isAIDebriefOpen} onClose={debriefViewer.closeDebrief} data={debriefViewer.selectedDebriefData} simulationGroupId={groupId} />
      <AddQuestionDialog open={isAddQuestionDialogOpen} onOpenChange={setIsAddQuestionDialogOpen} questionType={questionBankTab === 'global' ? 'global' : 'patientSpecific'} existingTags={allExistingTags} onSave={(q) => handleSaveNewPatientQuestion({ ...q, patientId: selectedPatientForQuestionBank || '' })} />
      <AddPatientSpecificQuestionDialog open={isAddPatientQuestionDialogOpen} onOpenChange={setIsAddPatientQuestionDialogOpen} patients={manageablePatients.map(p => ({ id: p.id, name: p.name }))} onSave={handleSaveNewPatientQuestion} />

      <Dialog open={isAccessCodeDialogOpen} onOpenChange={setIsAccessCodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: UI_COLORS.text.heading }}>Generate New Access Code</DialogTitle>
            <DialogDescription style={{ color: UI_COLORS.text.body }}>Are you sure? This will permanently replace the current access code. Any students using the old code will no longer be able to join.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAccessCodeDialogOpen(false)} style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading }}>Cancel</Button>
            <Button onClick={async () => { setIsAccessCodeDialogOpen(false); await handleGenerateAccessCode(); }} style={{ backgroundColor: UI_COLORS.status.error, color: UI_COLORS.button.text }}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

export default InstructorSimulationGroupPage;