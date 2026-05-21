import { useEffect, useRef, useState } from 'react';
import {
  instructorService,
  type CaseMaterial,
  type GlobalRubricQuestion,
  type ManageablePatient,
  type UploadedFileInfo,
} from '@/services/instructorService';
import { useNotification } from '@/components/notifications';

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
  editPatientTab: 'info' | 'questions' | 'materials' | 'dtps' | 'recommendations';
  editPatientName: string;
  editPatientAge: string;
  editPatientGender: string;
  editPatientPrompt: string;
  editPatientVoiceId: string;
  uploadStatus: Record<string, 'idle' | 'uploading' | 'success' | 'error'>;
  // Answer key file handling disabled — replaced by DTP/Recommendations Bank approach
  uploadedFiles: Record<'llm' | 'patientInfo' /* | 'answerKey' */, UploadedFileInfo[]>;
  editPatientProfilePicUrl: string | null;
  caseMaterials: CaseMaterial[];
  selectedMaterialId: string;
  caseSpecificQuestions: GlobalRubricQuestion[];

  // Setters for form fields
  setEditPatientTab: (tab: 'info' | 'questions' | 'materials' | 'dtps' | 'recommendations') => void;
  setEditPatientName: (name: string) => void;
  setEditPatientAge: (age: string) => void;
  setEditPatientGender: (gender: string) => void;
  setEditPatientPrompt: (prompt: string) => void;
  setEditPatientVoiceId: (voiceId: string) => void;
  setSelectedMaterialId: (id: string) => void;
  setCaseMaterials: React.Dispatch<React.SetStateAction<CaseMaterial[]>>;
  setCaseSpecificQuestions: React.Dispatch<React.SetStateAction<GlobalRubricQuestion[]>>;

  // Actions
  startEditing: (patientId: string) => void;
  startCreating: () => void;
  stopEditing: () => void;
  savePatient: () => Promise<void>;
  autoSaveNewPatient: () => Promise<string | null>;
  handleEditPatientTabSwitch: (tab: 'info' | 'questions' | 'materials' | 'dtps' | 'recommendations') => Promise<void>;
  // Answer key file handling disabled — replaced by DTP/Recommendations Bank approach
  handleFileUpload: (fileType: 'llm' | 'patientInfo' /* | 'answerKey' */, e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleFileDelete: (fileType: 'llm' | 'patientInfo' /* | 'answerKey' */, filename: string) => Promise<void>;
  handleDisplayNameSave: (fileType: 'llm' | 'patientInfo' /* | 'answerKey' */, filename: string, displayName: string) => Promise<void>;
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
  const { showNotification } = useNotification();
  // Form state
  const [selectedPatientForEdit, setSelectedPatientForEdit] = useState<string | null>(null);
  const [editPatientTab, setEditPatientTab] = useState<'info' | 'questions' | 'materials' | 'dtps' | 'recommendations'>('info');
  const [editPatientName, setEditPatientName] = useState('');
  const [editPatientAge, setEditPatientAge] = useState('');
  const [editPatientGender, setEditPatientGender] = useState('');
  const [editPatientPrompt, setEditPatientPrompt] = useState('');
  const [editPatientVoiceId, setEditPatientVoiceId] = useState('');
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'idle' | 'uploading' | 'success' | 'error'>>({});
  // Answer key file handling disabled — replaced by DTP/Recommendations Bank approach
  const [uploadedFiles, setUploadedFiles] = useState<Record<'llm' | 'patientInfo' /* | 'answerKey' */, UploadedFileInfo[]>>({ llm: [], patientInfo: [] /* , answerKey: [] */ });
  const [editPatientProfilePicUrl, setEditPatientProfilePicUrl] = useState<string | null>(null);
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
   * Load uploaded files for a patient from the API
   */
  const loadUploadedFiles = async (patientId: string) => {
    if (!groupId || patientId === 'new') {
      // Answer key file handling disabled — replaced by DTP/Recommendations Bank approach
      setUploadedFiles({ llm: [], patientInfo: [] /* , answerKey: [] */ });
      setEditPatientProfilePicUrl(null);
      return;
    }
    try {
      const result = await instructorService.fetchPatientUploadedFiles(groupId, patientId);
      // Answer key file handling disabled — replaced by DTP/Recommendations Bank approach
      const { llm, patientInfo } = result.files;
      setUploadedFiles({ llm, patientInfo });
      setEditPatientProfilePicUrl(result.profilePictureUrl);
    } catch {
      setUploadedFiles({ llm: [], patientInfo: [] /* , answerKey: [] */ });
      setEditPatientProfilePicUrl(null);
    }
  };

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
    setEditPatientVoiceId((patient as any).voice_id || 'tiffany');
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

    // Load uploaded files for display name editing
    loadUploadedFiles(patientId);
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
    setEditPatientVoiceId('');
    setEditPatientTab('info');
    setCaseMaterials([]);
    setSelectedMaterialId('');
    setCaseSpecificQuestions([]);
    // Answer key file handling disabled — replaced by DTP/Recommendations Bank approach
    setUploadedFiles({ llm: [], patientInfo: [] /* , answerKey: [] */ });
    setEditPatientProfilePicUrl(null);
  };

  /**
   * Stop editing / go back
   */
  const stopEditing = () => {
    setSelectedPatientForEdit(null);
    setUploadStatus({});
    // Answer key file handling disabled — replaced by DTP/Recommendations Bank approach
    setUploadedFiles({ llm: [], patientInfo: [] /* , answerKey: [] */ });
    setEditPatientProfilePicUrl(null);
    Object.values(uploadTimers.current).forEach(clearTimeout);
    uploadTimers.current = {};
  };

  /**
   * Auto-save a new patient before allowing file uploads or other tabs.
   */
  const autoSaveNewPatient = async (): Promise<string | null> => {
    if (selectedPatientForEdit !== 'new' || !groupId) return selectedPatientForEdit;
    if (!editPatientName.trim()) {
      showNotification({ message: 'Please enter a patient name before proceeding.', type: 'warning' });
      return null;
    }
    try {
      const newPersonaId = await instructorService.createPatient(groupId, {
        patient_name: editPatientName,
        patient_age: parseInt(editPatientAge) || 0,
        patient_gender: editPatientGender,
        patient_prompt: editPatientPrompt,
        voice_id: editPatientVoiceId || undefined,
      });
      setSelectedPatientForEdit(newPersonaId);
      setManageablePatients(await instructorService.getManageablePatients(groupId));
      return newPersonaId;
    } catch (error) {
      console.error('Failed to auto-save new patient:', error);
      showNotification({ message: 'Failed to save patient. Please try again.', type: 'error' });
      return null;
    }
  };

  /**
   * Handle tab switch with auto-save for new patients
   */
  const handleEditPatientTabSwitch = async (tab: 'info' | 'questions' | 'materials' | 'dtps' | 'recommendations') => {
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
        voice_id: editPatientVoiceId || undefined,
      });
      setSelectedPatientForEdit(newPersonaId);
    } else {
      await instructorService.updatePatient(groupId, {
        patient_id: selectedPatientForEdit,
        patient_name: editPatientName,
        patient_age: parseInt(editPatientAge) || 0,
        patient_gender: editPatientGender,
        patient_prompt: editPatientPrompt,
        voice_id: editPatientVoiceId || undefined,
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
      // Refresh the profile picture URL from get_all_files (reliable source)
      loadUploadedFiles(patientId);
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
      setEditPatientProfilePicUrl(null);
    } catch (error) {
      console.error('Failed to delete photo:', error);
    }
  };

  /**
   * Handle file upload (LLM documents, patient info)
   */
  // Answer key file handling disabled — replaced by DTP/Recommendations Bank approach
  const handleFileUpload = async (fileType: 'llm' | 'patientInfo' /* | 'answerKey' */, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedPatientForEdit && groupId) {
      let patientId = selectedPatientForEdit;
      if (patientId === 'new') {
        const savedId = await autoSaveNewPatient();
        if (!savedId) return;
        patientId = savedId;
      }
      const folderType = fileType === 'llm' ? 'documents' : 'info' as const;
      /* Answer key folder mapping disabled:
      const folderType = fileType === 'llm' ? 'documents' : fileType === 'patientInfo' ? 'info' : 'answer_key' as const;
      */
      if (uploadTimers.current[fileType]) clearTimeout(uploadTimers.current[fileType]);
      setUploadStatus(prev => ({ ...prev, [fileType]: 'uploading' }));
      try {
        await instructorService.uploadPatientFile(groupId, patientId, file, folderType);
        setUploadStatus(prev => ({ ...prev, [fileType]: 'success' }));
        uploadTimers.current[fileType] = setTimeout(() => setUploadStatus(prev => ({ ...prev, [fileType]: 'idle' })), 3000);
        // Refresh uploaded files list to show the new file
        loadUploadedFiles(patientId);
      } catch (error) {
        console.error('Failed to upload patient file', { fileType, groupId, patientId, error });
        setUploadStatus(prev => ({ ...prev, [fileType]: 'error' }));
        uploadTimers.current[fileType] = setTimeout(() => setUploadStatus(prev => ({ ...prev, [fileType]: 'idle' })), 5000);
      }
    }
    e.target.value = '';
  };

  /**
   * Handle file delete (remove file from S3, embeddings, and persona_data)
   */
  // Answer key file handling disabled — replaced by DTP/Recommendations Bank approach
  const handleFileDelete = async (fileType: 'llm' | 'patientInfo' /* | 'answerKey' */, filename: string) => {
    if (!selectedPatientForEdit || selectedPatientForEdit === 'new' || !groupId) return;
    if (!confirm(`Are you sure you want to delete "${filename}"? This will also remove its embeddings.`)) return;

    const lastDot = filename.lastIndexOf('.');
    const baseName = lastDot > 0 ? filename.substring(0, lastDot) : filename;
    const ext = lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase() : '';
    const folderType = fileType === 'llm' ? 'documents' : 'info' as const;
    /* Answer key folder mapping disabled:
    const folderType = fileType === 'llm' ? 'documents' : fileType === 'patientInfo' ? 'info' : 'answer_key' as const;
    */

    try {
      await instructorService.deletePatientFile(groupId, selectedPatientForEdit, baseName, ext, folderType);
      // Remove from local state immediately
      setUploadedFiles(prev => ({
        ...prev,
        [fileType]: prev[fileType].filter(f => f.filename !== filename),
      }));
    } catch (error) {
      console.error('Failed to delete patient file', { fileType, filename, error });
    }
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
      setCaseMaterials(prev => [created, ...prev]);
      setSelectedMaterialId(created.id);
      showNotification({ message: 'Material added successfully', type: 'success' });
    } catch (error) {
      console.error('Failed to add case material:', error);
      showNotification({ message: 'Failed to add material', type: 'error' });
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
      showNotification({ message: 'Material saved successfully', type: 'success' });
    } catch (error) {
      console.error('Failed to save case material:', error);
      showNotification({ message: 'Failed to save material', type: 'error' });
    }
  };

  /**
   * Save a display name for an uploaded file (auto-saves on blur)
   */
  // Answer key file handling disabled — replaced by DTP/Recommendations Bank approach
  const handleDisplayNameSave = async (fileType: 'llm' | 'patientInfo' /* | 'answerKey' */, filename: string, displayName: string) => {
    if (!selectedPatientForEdit || selectedPatientForEdit === 'new') return;
    const lastDot = filename.lastIndexOf('.');
    const baseName = lastDot > 0 ? filename.substring(0, lastDot) : filename;
    const ext = lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase() : '';
    try {
      await instructorService.updateFileDisplayName(selectedPatientForEdit, baseName, ext, displayName);
      // Update local state optimistically
      setUploadedFiles(prev => ({
        ...prev,
        [fileType]: prev[fileType].map(f =>
          f.filename === filename ? { ...f, displayName: displayName || null } : f
        ),
      }));
    } catch (error) {
      console.error('Failed to save display name:', error);
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
    editPatientVoiceId,
    uploadStatus,
    uploadedFiles,
    editPatientProfilePicUrl,
    caseMaterials,
    selectedMaterialId,
    caseSpecificQuestions,

    // Setters
    setEditPatientTab,
    setEditPatientName,
    setEditPatientAge,
    setEditPatientGender,
    setEditPatientPrompt,
    setEditPatientVoiceId,
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
    handleFileDelete,
    handleDisplayNameSave,
    handlePhotoUpload,
    handlePhotoDelete,

    // Material CRUD
    handleAddNewCaseMaterial,
    handleSaveCaseMaterial,
  };
}
