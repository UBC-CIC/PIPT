import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Camera, Trash2, Upload, Plus, Eye, CheckCircle, Loader2, XCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import UserAvatar from '@/components/UserAvatar';
import VoicePreview from '@/components/prompt-playground/VoicePreview';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import type { UsePatientEditorReturn } from '@/hooks/usePatientEditor';
import { instructorService, type OrganizationLabels, type GlobalRubricQuestion, type CaseMaterial, type UploadedFileInfo } from '@/services/instructorService';
import { useNotification } from '@/components/notifications';
import type { DTPAssignment } from '@/services/dtpBankService';
import type { RecommendationAssignment } from '@/services/recommendationsBankService';

export interface EditPatientPanelProps {
  patientEditor: UsePatientEditorReturn;
  profilePictures: Record<string, string>;
  onBack: () => void;
  labels: OrganizationLabels;
  groupId: string;
  globalRubricQuestions: GlobalRubricQuestion[];
  onSavePatient: () => Promise<void>;
  onSaveCaseQuestion: (patientId: string, question: GlobalRubricQuestion) => void;
  onDeleteCaseQuestion: (patientId: string, questionId: string) => void;
  // DTP/Rec patient-specific authoring
  onCreatePatientDTP?: (patientId: string, data: { title: string; expectedDTPText: string; clinicalIntent: string; evaluationCriteria: string; tags: string[]; isRequired: boolean }) => Promise<void>;
  onUpdatePatientDTP?: (dtpId: string, data: { title: string; expectedDTPText: string; clinicalIntent: string; evaluationCriteria: string; tags: string[]; isRequired: boolean }) => Promise<void>;
  onDeletePatientDTP?: (patientId: string, groupDtpId: string) => Promise<void>;
  patientDTPs?: DTPAssignment[];
  onCreatePatientRecommendation?: (patientId: string, data: { title: string; recommendationText: string; evaluationCriteria: string; rationale: string }) => Promise<void>;
  onUpdatePatientRecommendation?: (recommendationId: string, data: { title: string; recommendationText: string; evaluationCriteria: string; rationale: string }) => Promise<void>;
  onDeletePatientRecommendation?: (patientId: string, groupRecommendationId: string) => Promise<void>;
  patientRecommendations?: RecommendationAssignment[];
  onLoadPatientDTPs?: (patientId: string) => void;
  onLoadPatientRecommendations?: (patientId: string) => void;
}

export function EditPatientPanel({
  patientEditor,
  profilePictures,
  onBack,
  labels,
  groupId: _groupId,
  globalRubricQuestions,
  onSavePatient,
  onSaveCaseQuestion,
  onDeleteCaseQuestion,
  onUpdatePatientDTP,
  onDeletePatientDTP,
  patientDTPs = [],
  onUpdatePatientRecommendation,
  onDeletePatientRecommendation,
  patientRecommendations = [],
  onLoadPatientDTPs,
  onLoadPatientRecommendations,
}: EditPatientPanelProps) {
  const [caseQuestionSearchQuery, setCaseQuestionSearchQuery] = useState('');
  const [globalRubricSearchQuery, setGlobalRubricSearchQuery] = useState('');
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');

  const filteredCaseQuestions = patientEditor.caseSpecificQuestions.filter(q =>
    q.title.toLowerCase().includes(caseQuestionSearchQuery.toLowerCase())
  );

  const filteredMaterials = patientEditor.caseMaterials.filter(m =>
    m.title.toLowerCase().includes(materialSearchQuery.toLowerCase())
  );

  const filteredGlobalRubric = globalRubricQuestions.filter(q =>
    q.title.toLowerCase().includes(globalRubricSearchQuery.toLowerCase())
  );

  return (
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
            onClick={onBack}
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
            Back to All {labels.aiPersonaPlural}
          </button>
          <h2 className="text-xl font-semibold" style={{ color: UI_COLORS.text.heading }}>
            {patientEditor.selectedPatientForEdit === 'new' ? `Create ${labels.aiPersona}` : `Edit ${labels.aiPersona}`}
          </h2>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {[
            { tab: 'info' as const, label: 'Patient Information' },
            { tab: 'questions' as const, label: 'Case-specific Key Questions' },
            { tab: 'dtps' as const, label: 'Patient-Specific DTPs' },
            { tab: 'recommendations' as const, label: 'Patient-Specific Recommendations' },
            { tab: 'materials' as const, label: 'Physical Assessment Materials' },
          ].map(({ tab, label }) => (
            <button
              key={tab}
              onClick={() => patientEditor.handleEditPatientTabSwitch(tab)}
              className="w-full text-left px-4 py-3 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: patientEditor.editPatientTab === tab ? UI_COLORS.background.tableHeader : 'transparent',
                color: UI_COLORS.text.heading,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Edit Patient Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto" style={{ padding: patientEditor.editPatientTab === 'questions' || patientEditor.editPatientTab === 'materials' || patientEditor.editPatientTab === 'dtps' || patientEditor.editPatientTab === 'recommendations' ? '0' : '2rem' }}>
          {patientEditor.editPatientTab === 'info' && (
            <InfoTab
              patientEditor={patientEditor}
              profilePictures={profilePictures}
              labels={labels}
              onSavePatient={onSavePatient}
            />
          )}

          {patientEditor.editPatientTab === 'questions' && (
            <QuestionsTab
              patientEditor={patientEditor}
              caseQuestionSearchQuery={caseQuestionSearchQuery}
              onCaseQuestionSearchChange={setCaseQuestionSearchQuery}
              filteredCaseQuestions={filteredCaseQuestions}
              globalRubricSearchQuery={globalRubricSearchQuery}
              onGlobalRubricSearchChange={setGlobalRubricSearchQuery}
              filteredGlobalRubric={filteredGlobalRubric}
              onSaveCaseQuestion={onSaveCaseQuestion}
              onDeleteCaseQuestion={onDeleteCaseQuestion}
            />
          )}

          {patientEditor.editPatientTab === 'dtps' && (
            <PatientDTPsTab
              patientEditor={patientEditor}
              patientDTPs={patientDTPs}
              onUpdatePatientDTP={onUpdatePatientDTP}
              onDeletePatientDTP={onDeletePatientDTP}
              onLoadPatientDTPs={onLoadPatientDTPs}
            />
          )}

          {patientEditor.editPatientTab === 'recommendations' && (
            <PatientRecommendationsTab
              patientEditor={patientEditor}
              patientRecommendations={patientRecommendations}
              onUpdatePatientRecommendation={onUpdatePatientRecommendation}
              onDeletePatientRecommendation={onDeletePatientRecommendation}
              onLoadPatientRecommendations={onLoadPatientRecommendations}
            />
          )}

          {patientEditor.editPatientTab === 'materials' && (
            <MaterialsTab
              patientEditor={patientEditor}
              materialSearchQuery={materialSearchQuery}
              onMaterialSearchChange={setMaterialSearchQuery}
              filteredMaterials={filteredMaterials}
            />
          )}
        </div>
      </div>
    </div>
  );
}


/* ─── Info Tab ─── */

function InfoTab({
  patientEditor,
  profilePictures,
  labels,
  onSavePatient,
}: {
  patientEditor: UsePatientEditorReturn;
  profilePictures: Record<string, string>;
  labels: OrganizationLabels;
  onSavePatient: () => Promise<void>;
}) {
  const [previewFile, setPreviewFile] = useState<UploadedFileInfo | null>(null);

  return (
    <div className="space-y-6 max-w-2xl">
      <h3 className="text-2xl font-semibold" style={{ color: UI_COLORS.text.heading }}>
        {patientEditor.selectedPatientForEdit === 'new' ? `Create ${labels.aiPersona} Information` : `Edit ${labels.aiPersona} Information`}
      </h3>

      {/* Patient Photo */}
      <div className="flex items-center gap-4">
        <UserAvatar
          name={patientEditor.editPatientName || 'P'}
          imageUrl={patientEditor.editPatientProfilePicUrl || (patientEditor.selectedPatientForEdit && patientEditor.selectedPatientForEdit !== 'new' ? profilePictures[patientEditor.selectedPatientForEdit] : undefined)}
          size="large"
        />
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            onChange={patientEditor.handlePhotoUpload}
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
        {patientEditor.selectedPatientForEdit && patientEditor.selectedPatientForEdit !== 'new' && (patientEditor.editPatientProfilePicUrl || profilePictures[patientEditor.selectedPatientForEdit]) && (
          <button
            onClick={patientEditor.handlePhotoDelete}
            className="p-3 rounded-full transition-colors"
            style={{ backgroundColor: UI_COLORS.background.tableHeader, color: UI_COLORS.text.body }}
            title="Remove photo"
          >
            <Trash2 className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Patient Name */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
          Patient Name
        </label>
        <Input
          value={patientEditor.editPatientName}
          onChange={(e) => patientEditor.setEditPatientName(e.target.value)}
          maxLength={100}
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
          value={patientEditor.editPatientAge}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 0 && parseInt(value) <= 100)) {
              patientEditor.setEditPatientAge(value);
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
          value={patientEditor.editPatientGender}
          onChange={(e) => patientEditor.setEditPatientGender(e.target.value)}
          maxLength={50}
          className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: UI_COLORS.border.default,
            backgroundColor: UI_COLORS.background.white
          }}
        />
      </div>

      {/* Voice */}
      <div>
        <VoicePreview
          value={patientEditor.editPatientVoiceId}
          onChange={(voiceId) => patientEditor.setEditPatientVoiceId(voiceId)}
        />
      </div>

      {/* Patient Prompt */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
          Patient Prompt
        </label>
        <p className="text-xs mb-2" style={{ color: UI_COLORS.text.muted }}>
          Defines WHO this patient is — their personality, symptoms, backstory, and condition details. This is unique per patient.
        </p>
        <textarea
          value={patientEditor.editPatientPrompt}
          onChange={(e) => patientEditor.setEditPatientPrompt(e.target.value)}
          className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: UI_COLORS.border.default,
            outlineColor: UI_COLORS.border.medium,
            minHeight: '120px',
          }}
          placeholder="You are a 45-year-old patient who has been experiencing persistent headaches for the past 2 weeks. You also have mild nausea in the mornings. You take ibuprofen occasionally but it only helps temporarily. You are worried it might be something serious."
        />
      </div>

      {/* File Upload Sections */}
      <div className="space-y-4">
        {([
          { label: 'LLM Upload', type: 'llm' as const, description: 'Document used by the AI to roleplay as this patient.' },
          { label: 'Patient Information', type: 'patientInfo' as const, description: 'Medical record for this patient. This document is visible to students.' },
          // Answer key file upload disabled — replaced by DTP/Recommendations Bank approach
          /* { label: 'Answer Key', type: 'answerKey' as const, description: 'Reference answers for debrief evaluation.' }, */
        ]).map(({ label, type, description }) => (
          <div key={type} className="p-4 border rounded-lg space-y-3" style={{ borderColor: UI_COLORS.border.default }}>
            {/* Header row: label + status + upload button */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>
                  {label}
                </span>
                <p className="text-xs mt-0.5" style={{ color: UI_COLORS.text.muted }}>{description}</p>
              </div>
              <div className="flex items-center gap-2">
                {patientEditor.uploadStatus[type] === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: UI_COLORS.text.muted }} />}
                {patientEditor.uploadStatus[type] === 'success' && <span className="flex items-center gap-1 text-sm" style={{ color: '#16a34a' }}><CheckCircle className="w-4 h-4" /> Uploaded</span>}
                {patientEditor.uploadStatus[type] === 'error' && <span className="flex items-center gap-1 text-sm" style={{ color: '#dc2626' }}><XCircle className="w-4 h-4" /> Failed</span>}
                <label className={`cursor-pointer ${patientEditor.uploadStatus[type] === 'uploading' ? 'pointer-events-none opacity-50' : ''}`}>
                  <input
                    type="file"
                    onChange={(e) => patientEditor.handleFileUpload(type, e)}
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

            {/* Uploaded files list / inline preview */}
            {patientEditor.uploadedFiles[type].length > 0 && (
              <div className="pt-1">
                {previewFile && patientEditor.uploadedFiles[type].some(f => f.filename === previewFile.filename) ? (
                  <div className="flex flex-col">
                    <button
                      onClick={() => setPreviewFile(null)}
                      className="flex items-center gap-1 text-sm mb-3 bg-transparent border-0 cursor-pointer p-0 transition-colors"
                      style={{ color: UI_COLORS.text.body }}
                      onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
                      onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to files
                    </button>
                    <h4 className="font-semibold text-sm mb-2" style={{ color: UI_COLORS.text.heading }}>
                      {previewFile.displayName || previewFile.filename}
                    </h4>
                    {previewFile.url ? (
                      <iframe
                        src={previewFile.url}
                        title={previewFile.displayName || previewFile.filename}
                        className="w-full rounded border"
                        style={{ borderColor: UI_COLORS.border.default, minHeight: '400px' }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>No preview available for this file.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {patientEditor.uploadedFiles[type].map((file) => (
                      <FileDisplayNameRow
                        key={file.filename}
                        file={file}
                        fileType={type}
                        onSaveDisplayName={patientEditor.handleDisplayNameSave}
                        onDelete={patientEditor.handleFileDelete}
                        onPreview={setPreviewFile}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="pt-4">
        <Button
          onClick={onSavePatient}
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
  );
}


/* ─── File Display Name Row ─── */

function FileDisplayNameRow({
  file,
  fileType,
  onSaveDisplayName,
  onDelete,
  onPreview,
}: {
  file: import('@/services/instructorService').UploadedFileInfo;
  // Answer key file handling disabled — replaced by DTP/Recommendations Bank approach
  fileType: 'llm' | 'patientInfo' /* | 'answerKey' */;
  onSaveDisplayName: (fileType: 'llm' | 'patientInfo' /* | 'answerKey' */, filename: string, displayName: string) => Promise<void>;
  onDelete: (fileType: 'llm' | 'patientInfo' /* | 'answerKey' */, filename: string) => Promise<void>;
  onPreview: (file: import('@/services/instructorService').UploadedFileInfo) => void;
}) {
  const [localName, setLocalName] = useState(file.displayName || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleBlur = async () => {
    if (localName === (file.displayName || '')) return;
    setSaving(true);
    try {
      await onSaveDisplayName(fileType, file.filename, localName);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg"
      style={{ backgroundColor: UI_COLORS.background.tableHeader }}
    >
      <FileText className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: UI_COLORS.text.muted }} />
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-xs truncate" style={{ color: UI_COLORS.text.muted }} title={file.filename}>
          {file.filename}
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            placeholder="Enter display name..."
            className="h-8 text-sm flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: UI_COLORS.border.default,
              backgroundColor: UI_COLORS.background.white,
            }}
          />
          {saving && <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" style={{ color: UI_COLORS.text.muted }} />}
          {saved && <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: '#16a34a' }} />}
          <button
            onClick={() => onPreview(file)}
            className="p-1 rounded transition-colors flex-shrink-0"
            style={{ color: UI_COLORS.text.muted }}
            onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
            onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.muted}
            title="Preview file"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(fileType, file.filename)}
            className="p-1 rounded transition-colors flex-shrink-0"
            style={{ color: UI_COLORS.text.muted }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
            onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.muted}
            title="Delete file"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}


/* ─── Questions Tab ─── */

function QuestionsTab({
  patientEditor,
  caseQuestionSearchQuery,
  onCaseQuestionSearchChange,
  filteredCaseQuestions,
  globalRubricSearchQuery,
  onGlobalRubricSearchChange,
  filteredGlobalRubric,
  onSaveCaseQuestion,
  onDeleteCaseQuestion,
}: {
  patientEditor: UsePatientEditorReturn;
  caseQuestionSearchQuery: string;
  onCaseQuestionSearchChange: (query: string) => void;
  filteredCaseQuestions: GlobalRubricQuestion[];
  globalRubricSearchQuery: string;
  onGlobalRubricSearchChange: (query: string) => void;
  filteredGlobalRubric: GlobalRubricQuestion[];
  onSaveCaseQuestion: (patientId: string, question: GlobalRubricQuestion) => void;
  onDeleteCaseQuestion: (patientId: string, questionId: string) => void;
}) {
  return (
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
          onChange={(e) => onCaseQuestionSearchChange(e.target.value)}
          className="pl-9 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: UI_COLORS.border.default,
            backgroundColor: UI_COLORS.background.white
          }}
        />
      </div>

      {/* Case-Specific Questions */}
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
                        const updatedQuestions = patientEditor.caseSpecificQuestions.map(q =>
                          q.id === question.id ? { ...q, title: e.target.value } : q
                        );
                        patientEditor.setCaseSpecificQuestions(updatedQuestions);
                      }}
                      placeholder="Chest Pain Characterization"
                      maxLength={150}
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
                        const updatedQuestions = patientEditor.caseSpecificQuestions.map(q =>
                          q.id === question.id ? { ...q, keyQuestion: e.target.value } : q
                        );
                        patientEditor.setCaseSpecificQuestions(updatedQuestions);
                      }}
                      placeholder="Assess the characteristics of the patient's chest pain..."
                      maxLength={500}
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
                        const updatedQuestions = patientEditor.caseSpecificQuestions.map(q =>
                          q.id === question.id ? { ...q, clinicalIntent: e.target.value } : q
                        );
                        patientEditor.setCaseSpecificQuestions(updatedQuestions);
                      }}
                      placeholder="This question evaluates the student's ability..."
                      maxLength={500}
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
                        const updatedQuestions = patientEditor.caseSpecificQuestions.map(q =>
                          q.id === question.id ? { ...q, evaluationCriteria: e.target.value } : q
                        );
                        patientEditor.setCaseSpecificQuestions(updatedQuestions);
                      }}
                      placeholder="The student attempts to identify at least 3-4 of the following..."
                      maxLength={500}
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
                        const updatedQuestions = patientEditor.caseSpecificQuestions.map(q =>
                          q.id === question.id ? { ...q, required: !q.required } : q
                        );
                        patientEditor.setCaseSpecificQuestions(updatedQuestions);
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
                        if (patientEditor.selectedPatientForEdit) {
                          onSaveCaseQuestion(patientEditor.selectedPatientForEdit, question);
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
                        if (patientEditor.selectedPatientForEdit) {
                          onDeleteCaseQuestion(patientEditor.selectedPatientForEdit, question.id);
                          patientEditor.setCaseSpecificQuestions(patientEditor.caseSpecificQuestions.filter(q => q.id !== question.id));
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
          The following global questions are shown for reference to prevent redundancy. Edit global questions from the Global Key Questions tab.
        </p>

        {/* Search Bar for Global Questions */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
          <Input
            placeholder="Search Global Questions"
            value={globalRubricSearchQuery}
            onChange={(e) => onGlobalRubricSearchChange(e.target.value)}
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
      </div>
    </div>
  );
}


/* ─── Materials Tab ─── */

function MaterialsTab({
  patientEditor,
  materialSearchQuery,
  onMaterialSearchChange,
  filteredMaterials,
}: {
  patientEditor: UsePatientEditorReturn;
  materialSearchQuery: string;
  onMaterialSearchChange: (query: string) => void;
  filteredMaterials: CaseMaterial[];
}) {
  const { showNotification } = useNotification();
  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>
        Physical Assessment Materials
      </h2>

      {/* Add New Material Button */}
      <div className="mb-6">
        <Button
          onClick={patientEditor.handleAddNewCaseMaterial}
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
          onChange={(e) => onMaterialSearchChange(e.target.value)}
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
                        const updatedMaterials = patientEditor.caseMaterials.map(m =>
                          m.id === material.id ? { ...m, title: e.target.value } : m
                        );
                        patientEditor.setCaseMaterials(updatedMaterials);
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
                        const updatedMaterials = patientEditor.caseMaterials.map(m =>
                          m.id === material.id ? { ...m, description: e.target.value } : m
                        );
                        patientEditor.setCaseMaterials(updatedMaterials);
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
                        const updatedMaterials = patientEditor.caseMaterials.map(m =>
                          m.id === material.id ? { ...m, materialType: e.target.value as CaseMaterial['materialType'] } : m
                        );
                        patientEditor.setCaseMaterials(updatedMaterials);
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
                      <option value="kaltura">Kaltura</option>
                      <option value="panopto">Panopto</option>
                      <option value="h5p">H5P</option>
                    </select>
                  </div>

                  {/* Embed Link or Code */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: UI_COLORS.text.body }}>
                      Embed Link or Code
                    </label>
                    <p className="text-xs mb-2" style={{ color: UI_COLORS.text.muted }}>
                      Paste a URL or full embed code (e.g. {'<iframe ...>'}). Aspect ratio is auto-detected from embed dimensions.
                    </p>
                    <textarea
                      value={material.embedLink || ''}
                      onChange={(e) => {
                        const updatedMaterials = patientEditor.caseMaterials.map(m =>
                          m.id === material.id ? { ...m, embedLink: e.target.value } : m
                        );
                        patientEditor.setCaseMaterials(updatedMaterials);
                      }}
                      placeholder={'https://... or <iframe src="..." width="800" height="600"></iframe>'}
                      rows={3}
                      className="w-full px-3 py-3 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 resize-y"
                      style={{
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: UI_COLORS.border.default,
                        backgroundColor: UI_COLORS.background.white,
                        minHeight: '72px',
                      }}
                    />
                  </div>

                  {/* Preview */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="w-5 h-5" style={{ color: UI_COLORS.text.body }} />
                      <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>Preview</span>
                    </div>
                    {material.embedLink ? (
                      material.embedLink.trimStart().toLowerCase().startsWith('<iframe') ? (
                        <div
                          className="embed-responsive rounded-lg overflow-hidden"
                          style={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: (() => {
                              const match = material.embedLink!.match(/width=["']?(\d+)["']?/i);
                              const matchH = material.embedLink!.match(/height=["']?(\d+)["']?/i);
                              const w = match ? parseInt(match[1], 10) : 0;
                              const h = matchH ? parseInt(matchH[1], 10) : 0;
                              return w > 0 && h > 0 ? `${w} / ${h}` : '16 / 9';
                            })(),
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderColor: UI_COLORS.border.default,
                          }}
                          dangerouslySetInnerHTML={{ __html: material.embedLink }}
                        />
                      ) : (
                        <div
                          className="rounded-lg overflow-hidden"
                          style={{
                            position: 'relative',
                            width: '100%',
                            paddingBottom: '56.25%',
                            height: 0,
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderColor: UI_COLORS.border.default,
                          }}
                        >
                          <iframe
                            src={material.embedLink}
                            title={material.title || 'Preview'}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                            allowFullScreen
                            allow="autoplay *; fullscreen *; encrypted-media *"
                            sandbox="allow-downloads allow-forms allow-same-origin allow-scripts allow-top-navigation allow-pointer-lock allow-popups allow-modals allow-orientation-lock allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation"
                          />
                        </div>
                      )
                    ) : (
                      <div
                        className="border rounded-lg p-8 flex items-center justify-center"
                        style={{ borderColor: UI_COLORS.border.default, minHeight: '120px' }}
                      >
                        <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>Enter an embed link or code above to see a preview</p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-4 pt-4">
                    <Button
                      onClick={() => {
                        if (patientEditor.selectedPatientForEdit) {
                          patientEditor.setSelectedMaterialId(material.id);
                          patientEditor.handleSaveCaseMaterial();
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
                      onClick={async () => {
                        if (patientEditor.selectedPatientForEdit) {
                          try {
                            await instructorService.deleteCaseMaterial(patientEditor.selectedPatientForEdit, material.id);
                            patientEditor.setCaseMaterials(patientEditor.caseMaterials.filter(m => m.id !== material.id));
                            showNotification({ message: 'Material deleted successfully', type: 'success' });
                          } catch (error) {
                            console.error('Failed to delete material:', error);
                            showNotification({ message: 'Failed to delete material', type: 'error' });
                          }
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
  );
}


/* ─── Patient-Specific DTPs Tab ─── */

function PatientDTPsTab({
  patientEditor,
  patientDTPs,
  onUpdatePatientDTP,
  onDeletePatientDTP,
  onLoadPatientDTPs,
}: {
  patientEditor: UsePatientEditorReturn;
  patientDTPs: DTPAssignment[];
  onUpdatePatientDTP?: (dtpId: string, data: { title: string; expectedDTPText: string; clinicalIntent: string; evaluationCriteria: string; tags: string[]; isRequired: boolean }) => Promise<void>;
  onDeletePatientDTP?: (patientId: string, groupDtpId: string) => Promise<void>;
  onLoadPatientDTPs?: (patientId: string) => void;
}) {
  const { showNotification } = useNotification();
  const [searchQuery, setSearchQuery] = useState('');

  // Local editable state for existing DTPs
  const [editableDTPs, setEditableDTPs] = useState<DTPAssignment[]>([]);

  const patientId = patientEditor.selectedPatientForEdit;

  // Load DTPs when tab is shown
  useEffect(() => {
    if (patientId && patientId !== 'new' && onLoadPatientDTPs) {
      onLoadPatientDTPs(patientId);
    }
  }, [patientId]);

  // Sync local editable state when patientDTPs changes
  useEffect(() => {
    setEditableDTPs(patientDTPs);
  }, [patientDTPs]);

  const filteredDTPs = editableDTPs.filter(d =>
    (d.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (groupDtpId: string) => {
    if (!patientId || !onDeletePatientDTP) return;
    await onDeletePatientDTP(patientId, groupDtpId);
  };

  const handleSaveExisting = async (dtp: DTPAssignment) => {
    if (!onUpdatePatientDTP || !dtp.dtpId) return;
    try {
      await onUpdatePatientDTP(dtp.dtpId, {
        title: dtp.title || '',
        expectedDTPText: dtp.expectedDTPText || '',
        clinicalIntent: dtp.clinicalIntent || '',
        evaluationCriteria: dtp.evaluationCriteria || '',
        tags: dtp.tags || [],
        isRequired: dtp.isRequired || false,
      });
      showNotification({ message: 'DTP saved successfully.', type: 'success' });
    } catch {
      showNotification({ message: 'Failed to save DTP.', type: 'error' });
    }
  };

  const updateEditableDTP = (groupDtpId: string, updates: Partial<DTPAssignment>) => {
    setEditableDTPs(prev => prev.map(d => d.groupDtpId === groupDtpId ? { ...d, ...updates } : d));
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>
        Patient-Specific DTPs
      </h2>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
        <Input
          placeholder="Search DTPs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
        />
      </div>

      {/* Existing DTPs — Inline Editable */}
      <div className="space-y-4">
        <p className="text-xs italic mb-4" style={{ color: UI_COLORS.text.muted }}>
          Click on a DTP entry to expand and edit it.
        </p>

        {filteredDTPs.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>No patient-specific DTPs yet.</p>
        ) : (
          <Accordion type="single" collapsible className="space-y-2">
            {filteredDTPs.map((dtp, index) => (
              <AccordionItem key={dtp.groupDtpId} value={dtp.groupDtpId} style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, borderRadius: '0.5rem', overflow: 'hidden' }}>
                <AccordionTrigger className="px-4 hover:no-underline" style={{ backgroundColor: UI_COLORS.background.white, color: UI_COLORS.text.heading }}>
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-medium">
                      DTP{index + 1} - {dtp.title || 'Untitled DTP'}
                    </span>
                    <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>{dtp.isRequired ? 'Required' : 'Optional'}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4" style={{ backgroundColor: UI_COLORS.background.white }}>
                  <div className="space-y-4 pt-4">
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Title</label>
                      <Input
                        value={dtp.title || ''}
                        onChange={(e) => updateEditableDTP(dtp.groupDtpId, { title: e.target.value })}
                        placeholder="DTP Title"
                        maxLength={150}
                        className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                        style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                      />
                    </div>

                    {/* Expected DTP Text */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Expected DTP Text</label>
                      <textarea
                        value={dtp.expectedDTPText || ''}
                        onChange={(e) => updateEditableDTP(dtp.groupDtpId, { expectedDTPText: e.target.value })}
                        placeholder="Describe the expected drug therapy problem..."
                        maxLength={500}
                        className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                        style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, outlineColor: UI_COLORS.border.medium, minHeight: '100px' }}
                      />
                    </div>

                    {/* Clinical Intent */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Clinical Intent</label>
                      <textarea
                        value={dtp.clinicalIntent || ''}
                        onChange={(e) => updateEditableDTP(dtp.groupDtpId, { clinicalIntent: e.target.value })}
                        placeholder="Why this DTP matters clinically..."
                        maxLength={500}
                        className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                        style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, outlineColor: UI_COLORS.border.medium, minHeight: '100px' }}
                      />
                    </div>

                    {/* Evaluation Criteria */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Evaluation Criteria</label>
                      <textarea
                        value={dtp.evaluationCriteria || ''}
                        onChange={(e) => updateEditableDTP(dtp.groupDtpId, { evaluationCriteria: e.target.value })}
                        placeholder="How to evaluate the student's identification..."
                        maxLength={500}
                        className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                        style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, outlineColor: UI_COLORS.border.medium, minHeight: '150px' }}
                      />
                    </div>

                    {/* Required Toggle */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={dtp.isRequired || false}
                        onClick={() => updateEditableDTP(dtp.groupDtpId, { isRequired: !dtp.isRequired })}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={{ backgroundColor: dtp.isRequired ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive }}
                      >
                        <span className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform" style={{ transform: dtp.isRequired ? 'translateX(22px)' : 'translateX(2px)' }} />
                      </button>
                      <span className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>Required for Case Completion</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-4 pt-4">
                      <Button
                        onClick={() => handleSaveExisting(dtp)}
                        className="px-8 py-3 text-base font-medium transition-colors"
                        style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => handleDelete(dtp.groupDtpId)}
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
        )}
      </div>
    </div>
  );
}


/* ─── Patient-Specific Recommendations Tab ─── */

function PatientRecommendationsTab({
  patientEditor,
  patientRecommendations,
  onUpdatePatientRecommendation,
  onDeletePatientRecommendation,
  onLoadPatientRecommendations,
}: {
  patientEditor: UsePatientEditorReturn;
  patientRecommendations: RecommendationAssignment[];
  onUpdatePatientRecommendation?: (recommendationId: string, data: { title: string; recommendationText: string; evaluationCriteria: string; rationale: string }) => Promise<void>;
  onDeletePatientRecommendation?: (patientId: string, groupRecommendationId: string) => Promise<void>;
  onLoadPatientRecommendations?: (patientId: string) => void;
}) {
  const { showNotification } = useNotification();
  const [searchQuery, setSearchQuery] = useState('');

  // Local editable state for existing recommendations
  const [editableRecs, setEditableRecs] = useState<RecommendationAssignment[]>([]);

  const patientId = patientEditor.selectedPatientForEdit;

  // Load recommendations when tab is shown
  useEffect(() => {
    if (patientId && patientId !== 'new' && onLoadPatientRecommendations) {
      onLoadPatientRecommendations(patientId);
    }
  }, [patientId]);

  // Sync local editable state when patientRecommendations changes
  useEffect(() => {
    setEditableRecs(patientRecommendations);
  }, [patientRecommendations]);

  const filteredRecs = editableRecs.filter(r =>
    (r.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (groupRecommendationId: string) => {
    if (!patientId || !onDeletePatientRecommendation) return;
    await onDeletePatientRecommendation(patientId, groupRecommendationId);
  };

  const handleSaveExisting = async (rec: RecommendationAssignment) => {
    if (!onUpdatePatientRecommendation || !rec.recommendationId) return;
    try {
      await onUpdatePatientRecommendation(rec.recommendationId, {
        title: rec.title || '',
        recommendationText: rec.recommendationText || '',
        evaluationCriteria: rec.evaluationCriteria || '',
        rationale: rec.rationale || '',
      });
      showNotification({ message: 'Recommendation saved successfully.', type: 'success' });
    } catch {
      showNotification({ message: 'Failed to save recommendation.', type: 'error' });
    }
  };

  const updateEditableRec = (groupRecommendationId: string, updates: Partial<RecommendationAssignment>) => {
    setEditableRecs(prev => prev.map(r => r.groupRecommendationId === groupRecommendationId ? { ...r, ...updates } : r));
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>
        Patient-Specific Recommendations
      </h2>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
        <Input
          placeholder="Search Recommendations"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
        />
      </div>

      {/* Existing Recommendations — Inline Editable */}
      <div className="space-y-4">
        <p className="text-xs italic mb-4" style={{ color: UI_COLORS.text.muted }}>
          Click on a Recommendation entry to expand and edit it.
        </p>

        {filteredRecs.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>No patient-specific recommendations yet.</p>
        ) : (
          <Accordion type="single" collapsible className="space-y-2">
            {filteredRecs.map((rec, index) => (
              <AccordionItem key={rec.groupRecommendationId} value={rec.groupRecommendationId} style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, borderRadius: '0.5rem', overflow: 'hidden' }}>
                <AccordionTrigger className="px-4 hover:no-underline" style={{ backgroundColor: UI_COLORS.background.white, color: UI_COLORS.text.heading }}>
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-medium">
                      R{index + 1} - {rec.title || 'Untitled Recommendation'}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4" style={{ backgroundColor: UI_COLORS.background.white }}>
                  <div className="space-y-4 pt-4">
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Title</label>
                      <Input
                        value={rec.title || ''}
                        onChange={(e) => updateEditableRec(rec.groupRecommendationId, { title: e.target.value })}
                        placeholder="Recommendation Title"
                        maxLength={150}
                        className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                        style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                      />
                    </div>

                    {/* Recommendation Text */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Recommendation Text</label>
                      <textarea
                        value={rec.recommendationText || ''}
                        onChange={(e) => updateEditableRec(rec.groupRecommendationId, { recommendationText: e.target.value })}
                        placeholder="Describe the recommendation..."
                        maxLength={500}
                        className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                        style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, outlineColor: UI_COLORS.border.medium, minHeight: '100px' }}
                      />
                    </div>

                    {/* Evaluation Criteria */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Evaluation Criteria</label>
                      <textarea
                        value={rec.evaluationCriteria || ''}
                        onChange={(e) => updateEditableRec(rec.groupRecommendationId, { evaluationCriteria: e.target.value })}
                        placeholder="How to evaluate the student's recommendation..."
                        maxLength={500}
                        className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                        style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, outlineColor: UI_COLORS.border.medium, minHeight: '100px' }}
                      />
                    </div>

                    {/* Rationale */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Rationale</label>
                      <textarea
                        value={rec.rationale || ''}
                        onChange={(e) => updateEditableRec(rec.groupRecommendationId, { rationale: e.target.value })}
                        placeholder="Clinical rationale for this recommendation..."
                        maxLength={500}
                        className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                        style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, outlineColor: UI_COLORS.border.medium, minHeight: '100px' }}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-4 pt-4">
                      <Button
                        onClick={() => handleSaveExisting(rec)}
                        className="px-8 py-3 text-base font-medium transition-colors"
                        style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => handleDelete(rec.groupRecommendationId)}
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
        )}
      </div>
    </div>
  );
}
