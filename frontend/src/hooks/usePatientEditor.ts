import { useEffect, useRef, useState } from 'react';
import {
  instructorService,
  type CaseMaterial,
  type GlobalRubricQuestion,
  type ManageablePatient,
} from '@/services/instructorService';

export interface UsePatientEditorParams {
  groupId: string | undefined;
  role: 'admin' | 'instructor';
  manageablePatients: ManageablePatient[];
  setManageablePatients: React.Dispatch<React.SetStateAction<any[]>>;
  profilePictures: Record<string, string>;
  setProfilePictures: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  reloadPatients: () => Promise<void>;
}

export interface UsePatientEditorReturn {
  // Form state
  selectedPatientForEdit: string | null;
  editPatientTab: 'info' | 'questions' | 'materials';
  editPatientName: string;
  editPatientAge: string;
  editPatientGender: string;
  editPatientPrompt: string;
  uploadStatus: Record<string, 'idle' | 'uploading' | 'success' | 'error'>;
  caseMaterials: CaseMaterial[];
  selectedMaterialId: string;
  caseSpecificQuestions: GlobalRubricQuestion[];

  // Setters for form fields
  setEditPatientTab: (tab: 'info' | 'questions' | 'materials') => void;
  setEditPatientName: (name: string) => void;
  setEditPatientAge: (age: string) => void;
  setEditPatientGender: (gender: string) => void;
  setEditPatientPrompt: (prompt: string) => void;
  setSelectedMaterialId: (id: string) => void;
  setCaseMaterials: React.Dispatch<React.SetStateAction<CaseMaterial[]>>;
  setCaseSpecificQuestions: React.Dispatch<React.SetStateAction<GlobalRubricQuestion[]>>;

  // Actions
  startEditing: (patientId: string) => void;
  startCreating: () => void;
  stopEditing: () => void;
  savePatient: () => Promise<void>;
  autoSaveNewPatient: () => Promise<string | null>;
  handleEditPatientTabSwitch: (tab: 'info' | 'questions' | 'materials') => Promise<void>;
  handleFileUpload: (fileType: 'llm' | 'patientInfo' | 'answerKey', e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handlePhotoDelete: () => Promise<void>;

  // Material CRUD
  handleAddNewCaseMaterial: () => Promise<void>;
  handleSaveCaseMaterial: () => Promise<void>;
}

export function usePatientEditor({
  groupId,
  role,
  manageablePatients,
  setManageablePatients,
  profilePictures: _profilePictures,
  setProfilePictures,
  reloadPatients: _reloadPatients,
}: UsePatientEditorParams): UsePatientEditorReturn {
  // Form state
  const [selectedPatientForEdit, setSelectedPatientForEdit] = useState<string | null>(null);
  const [editPatientTab, setEditPatientTab] = useState<'info' | 'questions' | 'materials'>('info');
  const [editPatientName, setEditPatientName] = useState('');
  const [editPatientAge, setEditPatientAge] = useState('');
  const [editPatientGender, setEditPatientGender] = useState('');
  const [editPatientPrompt, setEditPatientPrompt] = useState('');
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'idle' | 'uploading' | 'success' | 'error'>>({});
  const uploadTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Case materials state
  const [caseMaterials, setCaseMaterials] = useState<CaseMaterial[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');

  // Case-specific questions state
  const [caseSpecificQuestions, setCaseSpecificQuestions] = useState<GlobalRubricQuestion[]>([]);

  // Clear upload timers on unmount
  useEffect(() => {
    return () => {
      Object.values(uploadTimers.current).forEach(clearTimeout);
      uploadTimers.current = {};
    };
  }, []);

  // Load case materials from API when patient changes
  useEffect(() => {
    if (!selectedPatientForEdit || selectedPatientForEdit === 'new') return;
    let cancelled = false;
    instructorService.getCaseMaterials(selectedPatientForEdit).then((data) => {
      if (!cancelled) {
        setCaseMaterials(data);
        setSelectedMaterialId(data[0]?.id || '');
      }
    });
    return () => { cancelled = true; };
  }, [selectedPatientForEdit]);

  /**
   * Start editing an existing patient
   */
  const startEditing = (patientId: string) => {
    const patient = manageablePatients.find(
      (p: any) => p.id === patientId || p.patient_id === patientId
    );
    if (!patient) return;

    setSelectedPatientForEdit(patientId);
    setEditPatientName((patient as any).patient_name || (patient as any).name || '');
    setEditPatientAge(((patient as any).patient_age || (patient as any).age || '').toString());
    setEditPatientGender((patient as any).patient_gender || (patient as any).gender || '');
    setEditPatientPrompt((patient as any).patient_prompt || instructorService.getDefaultPatientPrompt());
    setEditPatientTab('info');

    if (role === 'admin' && groupId) {
      // Admin: load patient-specific questions from API
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
        })
        .catch(() => {
          setCaseSpecificQuestions([]);
        });
    } else {
      // Instructor: load from local service
      const questions = instructorService.getCaseSpecificQuestions(patientId);
      setCaseSpecificQuestions(questions);
    }

    // Materials are loaded by the useEffect above
  };

  /**
   * Start creating a new patient
   */
  const startCreating = () => {
    setSelectedPatientForEdit('new');
    setEditPatientName('');
    setEditPatientAge('');
    setEditPatientGender('');
    setEditPatientPrompt(instructorService.getDefaultPatientPrompt());
    setEditPatientTab('info');
    setCaseMaterials([]);
    setSelectedMaterialId('');
    setCaseSpecificQuestions([]);
  };

  /**
   * Stop editing / go back
   */
  const stopEditing = () => {
    setSelectedPatientForEdit(null);
    setUploadStatus({});
    Object.values(uploadTimers.current).forEach(clearTimeout);
    uploadTimers.current = {};
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
   * Save patient changes (create or update)
   */
  const savePatient = async () => {
    if (!selectedPatientForEdit || !groupId) return;

    if (selectedPatientForEdit === 'new') {
      const newPersonaId = await instructorService.createPatient(groupId, {
        patient_name: editPatientName,
        patient_age: parseInt(editPatientAge) || 0,
        patient_gender: editPatientGender,
        patient_prompt: editPatientPrompt,
      });
      setSelectedPatientForEdit(newPersonaId);
    } else {
      await instructorService.updatePatient(groupId, {
        patient_id: selectedPatientForEdit,
        patient_name: editPatientName,
        patient_age: parseInt(editPatientAge) || 0,
        patient_gender: editPatientGender,
        patient_prompt: editPatientPrompt,
      });
    }

    // Reload patients list
    setManageablePatients(await instructorService.getManageablePatients(groupId));
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
      await instructorService.uploadPatientPhoto(groupId, patientId, file);
      const [patients, pics] = await Promise.all([
        instructorService.getManageablePatients(groupId),
        instructorService.fetchProfilePictures(groupId),
      ]);
      setManageablePatients(patients);
      setProfilePictures(pics);
    }
  };

  /**
   * Handle photo delete
   */
  const handlePhotoDelete = async () => {
    if (!selectedPatientForEdit || selectedPatientForEdit === 'new' || !groupId) return;
    if (!confirm('Are you sure you want to remove this photo?')) return;
    try {
      await instructorService.deletePatientPhoto(groupId, selectedPatientForEdit);
      setProfilePictures(await instructorService.fetchProfilePictures(groupId));
    } catch (error) {
      console.error('Failed to delete photo:', error);
    }
  };

  /**
   * Handle file upload (LLM documents, patient info, answer key)
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

  /**
   * Add a new case material
   */
  const handleAddNewCaseMaterial = async () => {
    if (!selectedPatientForEdit) return;
    const newMaterial: CaseMaterial = {
      id: `material-${Date.now()}`,
      title: 'New Material',
      description: '',
      materialType: 'kaltura',
      contentUrl: '',
      embedLink: '',
    };
    try {
      const created = await instructorService.addCaseMaterial(selectedPatientForEdit, newMaterial);
      setCaseMaterials(prev => [...prev, created]);
      setSelectedMaterialId(created.id);
    } catch (error) {
      console.error('Failed to add case material:', error);
    }
  };

  /**
   * Save case material changes
   */
  const handleSaveCaseMaterial = async () => {
    const selectedMaterial = caseMaterials.find(m => m.id === selectedMaterialId);
    if (!selectedMaterial || !selectedPatientForEdit) return;
    try {
      const updated = await instructorService.updateCaseMaterial(selectedPatientForEdit, selectedMaterial);
      setCaseMaterials(prev => prev.map(m => m.id === updated.id ? updated : m));
    } catch (error) {
      console.error('Failed to save case material:', error);
    }
  };

  return {
    // Form state
    selectedPatientForEdit,
    editPatientTab,
    editPatientName,
    editPatientAge,
    editPatientGender,
    editPatientPrompt,
    uploadStatus,
    caseMaterials,
    selectedMaterialId,
    caseSpecificQuestions,

    // Setters
    setEditPatientTab,
    setEditPatientName,
    setEditPatientAge,
    setEditPatientGender,
    setEditPatientPrompt,
    setSelectedMaterialId,
    setCaseMaterials,
    setCaseSpecificQuestions,

    // Actions
    startEditing,
    startCreating,
    stopEditing,
    savePatient,
    autoSaveNewPatient,
    handleEditPatientTabSwitch,
    handleFileUpload,
    handlePhotoUpload,
    handlePhotoDelete,

    // Material CRUD
    handleAddNewCaseMaterial,
    handleSaveCaseMaterial,
  };
}
