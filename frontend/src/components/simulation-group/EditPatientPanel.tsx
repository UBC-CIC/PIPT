import { useState } from 'react';
import { ArrowLeft, Search, Camera, Trash2, Upload, Plus, Eye, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import UserAvatar from '@/components/UserAvatar';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import type { UsePatientEditorReturn } from '@/hooks/usePatientEditor';
import { instructorService, type OrganizationLabels, type GlobalRubricQuestion, type CaseMaterial } from '@/services/instructorService';

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
        <div className="flex-1 overflow-y-auto" style={{ padding: patientEditor.editPatientTab === 'questions' || patientEditor.editPatientTab === 'materials' ? '0' : '2rem' }}>
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
  return (
    <div className="space-y-6 max-w-2xl">
      <h3 className="text-2xl font-semibold" style={{ color: UI_COLORS.text.heading }}>
        {patientEditor.selectedPatientForEdit === 'new' ? `Create ${labels.aiPersona} Information` : `Edit ${labels.aiPersona} Information`}
      </h3>

      {/* Patient Photo */}
      <div className="flex items-center gap-4">
        <UserAvatar
          name={patientEditor.editPatientName || 'P'}
          imageUrl={patientEditor.selectedPatientForEdit && patientEditor.selectedPatientForEdit !== 'new' ? profilePictures[patientEditor.selectedPatientForEdit] : undefined}
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
        {patientEditor.selectedPatientForEdit && patientEditor.selectedPatientForEdit !== 'new' && profilePictures[patientEditor.selectedPatientForEdit] && (
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
          placeholder="Pretend to be a patient with the context you are given. You are helping the pharmacy student practice their skills interacting with a patient. Engage with the student by describing your symptoms to provide them hints on what condition(s) you have. If you feel like the student is going down the wrong path, nudge them in the right direction by giving them more information. This is to help the student identify the proper diagnosis of the patient you are pretending to be."
        />
      </div>

      {/* File Upload Sections */}
      <div className="space-y-4">
        {([
          { label: 'LLM Upload', type: 'llm' as const },
          { label: 'Patient Information', type: 'patientInfo' as const },
          { label: 'Answer Key', type: 'answerKey' as const },
        ]).map(({ label, type }) => (
          <div key={type} className="flex items-center justify-between p-4 border rounded-lg" style={{ borderColor: UI_COLORS.border.default }}>
            <div className="flex items-center gap-2">
              <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>
                {label}
              </span>
              {patientEditor.uploadStatus[type] === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: UI_COLORS.text.muted }} />}
              {patientEditor.uploadStatus[type] === 'success' && <span className="flex items-center gap-1 text-sm" style={{ color: '#16a34a' }}><CheckCircle className="w-4 h-4" /> Uploaded</span>}
              {patientEditor.uploadStatus[type] === 'error' && <span className="flex items-center gap-1 text-sm" style={{ color: '#dc2626' }}><XCircle className="w-4 h-4" /> Failed</span>}
            </div>
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
          The following global questions are shown for reference to prevent redundancy. Edit global questions from the Global Rubric tab.
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

                  {/* Embed Link */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                      Embed Link
                    </label>
                    <Input
                      value={material.embedLink || ''}
                      onChange={(e) => {
                        const updatedMaterials = patientEditor.caseMaterials.map(m =>
                          m.id === material.id ? { ...m, embedLink: e.target.value } : m
                        );
                        patientEditor.setCaseMaterials(updatedMaterials);
                      }}
                      placeholder="https://..."
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
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="w-5 h-5" style={{ color: UI_COLORS.text.body }} />
                      <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>Preview</span>
                    </div>
                    {material.embedLink ? (
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
                    ) : (
                      <div
                        className="border rounded-lg p-8 flex items-center justify-center"
                        style={{ borderColor: UI_COLORS.border.default, minHeight: '120px' }}
                      >
                        <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>Enter an embed link above to see a preview</p>
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
                          } catch (error) {
                            console.error('Failed to delete material:', error);
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