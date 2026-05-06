import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UI_COLORS } from '@/lib/colors';
import { getAllInstructors, type AdminInstructor } from '@/services/adminApiService';
import LoadingIndicator from '@/components/LoadingIndicator';

export type AdminCreateData = { name: string; description: string; instructors: string; systemPrompt: string; active: boolean; enableVoice: boolean };
export type InstructorCreateData = { name: string; description: string; active: boolean };

type CreateSimulationGroupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & (
  | { role: 'admin'; onCreate: (data: AdminCreateData) => void }
  | { role: 'instructor'; onCreate: (data: InstructorCreateData) => void }
);

function CreateSimulationGroupDialog({ 
  open, 
  onOpenChange, 
  role,
  onCreate 
}: CreateSimulationGroupDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [enableVoice, setEnableVoice] = useState(true);

  // Admin-only state
  const [selectedInstructors, setSelectedInstructors] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [availableInstructors, setAvailableInstructors] = useState<AdminInstructor[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingInstructors, setLoadingInstructors] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch instructors when dialog opens (admin only)
  useEffect(() => {
    if (open && role === 'admin') {
      setLoadingInstructors(true);
      getAllInstructors()
        .then((instructors) => setAvailableInstructors(instructors))
        .catch((err) => console.error('Failed to load instructors:', err))
        .finally(() => setLoadingInstructors(false));
    }
  }, [open, role]);

  // Close dropdown on outside click (admin only)
  useEffect(() => {
    if (role !== 'admin') return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [role]);

  const toggleInstructor = (email: string) => {
    setSelectedInstructors((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const isValid = role === 'admin'
    ? Boolean(name.trim() && description.trim() && selectedInstructors.length > 0)
    : Boolean(name.trim() && description.trim());

  const handleCreate = () => {
    if (!isValid) return;

    if (role === 'admin') {
      onCreate({
        name: name.trim(),
        description: description.trim(),
        instructors: selectedInstructors.join(', '),
        systemPrompt: systemPrompt.trim(),
        active,
        enableVoice
      });
    } else {
      onCreate({
        name: name.trim(),
        description: description.trim(),
        active,
      });
    }
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedInstructors([]);
    setSystemPrompt('');
    setActive(true);
    setEnableVoice(true);
    setDropdownOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Create new Simulation Group</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new simulation group with name, description, and settings
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-6 py-4 overflow-y-auto pr-2">
          {/* Name Field */}
          <div className="flex flex-col gap-2">
            <label 
              htmlFor="group-name" 
              className="text-sm font-medium"
              style={{ color: UI_COLORS.text.heading }}
            >
              Name <span style={{ color: UI_COLORS.status.error }}>*</span>
            </label>
            <Input
              id="group-name"
              placeholder="Chronic Pain"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-base focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ 
                borderWidth: '1px', 
                borderStyle: 'solid', 
                borderColor: UI_COLORS.border.default 
              }}
            />
          </div>

          {/* Description Field */}
          <div className="flex flex-col gap-2">
            <label 
              htmlFor="group-description" 
              className="text-sm font-medium"
              style={{ color: UI_COLORS.text.heading }}
            >
              Description <span style={{ color: UI_COLORS.status.error }}>*</span>
            </label>
            <Input
              id="group-description"
              placeholder="Patients suffering from different types of chronic pain"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-base focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ 
                borderWidth: '1px', 
                borderStyle: 'solid', 
                borderColor: UI_COLORS.border.default 
              }}
            />
          </div>

          {/* Instructor Multi-Select Dropdown (admin only) */}
          {role === 'admin' && (
            <div className="flex flex-col gap-2">
              <label 
                className="text-sm font-medium"
                style={{ color: UI_COLORS.text.heading }}
              >
                Add Instructors <span style={{ color: UI_COLORS.status.error }}>*</span>
              </label>
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full flex items-center justify-between text-left px-3 py-2 rounded-md text-base"
                  style={{
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: UI_COLORS.border.default,
                    backgroundColor: UI_COLORS.background.white,
                    minHeight: '40px',
                    color: selectedInstructors.length > 0 ? UI_COLORS.text.heading : '#9ca3af',
                  }}
                >
                  <span className="truncate">
                    {selectedInstructors.length > 0
                      ? `${selectedInstructors.length} instructor${selectedInstructors.length > 1 ? 's' : ''} selected`
                      : 'Select instructors...'}
                  </span>
                  <svg className="w-4 h-4 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dropdownOpen ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div
                    className="absolute z-50 w-full mt-1 rounded-md shadow-lg overflow-auto"
                    style={{
                      maxHeight: '200px',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: UI_COLORS.border.default,
                      backgroundColor: UI_COLORS.background.white,
                    }}
                  >
                    {loadingInstructors ? (
                      <div className="px-3 py-2">
                        <LoadingIndicator size="sm" message="Loading instructors..." />
                      </div>
                    ) : availableInstructors.length === 0 ? (
                      <div className="px-3 py-2 text-sm" style={{ color: UI_COLORS.text.muted }}>
                        No instructors found
                      </div>
                    ) : (
                      availableInstructors.map((instructor) => (
                        <label
                          key={instructor.user_email}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedInstructors.includes(instructor.user_email)}
                            onChange={() => toggleInstructor(instructor.user_email)}
                            className="rounded"
                          />
                          <span className="text-sm" style={{ color: UI_COLORS.text.heading }}>
                            {instructor.first_name && instructor.last_name
                              ? `${instructor.first_name} ${instructor.last_name} (${instructor.user_email})`
                              : instructor.user_email}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
              {/* Selected instructor chips */}
              {selectedInstructors.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedInstructors.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                      style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => toggleInstructor(email)}
                        className="hover:opacity-70"
                        aria-label={`Remove ${email}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* System Prompt Field (admin only) */}
          {role === 'admin' && (
            <div className="flex flex-col gap-2">
              <label 
                htmlFor="group-system-prompt" 
                className="text-sm font-medium"
                style={{ color: UI_COLORS.text.heading }}
              >
                System Prompt
              </label>
              <p className="text-xs mb-1" style={{ color: UI_COLORS.text.muted }}>
                Defines HOW the AI should behave across all patients in this group (tone, response length, rules).
              </p>
              <textarea
                id="group-system-prompt"
                placeholder="You are role-playing as a patient in a clinical training simulation. Keep responses brief (1-3 sentences). Speak in plain, everyday language. Only answer what is directly asked."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={4}
                className="text-base px-3 py-2 rounded-md resize-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ 
                  borderWidth: '1px', 
                  borderStyle: 'solid', 
                  borderColor: UI_COLORS.border.default,
                  backgroundColor: UI_COLORS.background.white
                }}
              />
            </div>
          )}

          {/* Toggle Switches */}
          <div className="flex gap-8">
            {/* Active Toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() => setActive(!active)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ 
                  backgroundColor: active ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive 
                }}
              >
                <span
                  className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                  style={{
                    transform: active ? 'translateX(22px)' : 'translateX(2px)'
                  }}
                />
              </button>
              <span 
                className="text-sm font-medium"
                style={{ color: UI_COLORS.text.heading }}
              >
                Active
              </span>
            </div>

            {/* Enable Voice Toggle (admin only — instructor voice is controlled per-patient) */}
            {role === 'admin' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={enableVoice}
                onClick={() => setEnableVoice(!enableVoice)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ 
                  backgroundColor: enableVoice ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive 
                }}
              >
                <span
                  className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                  style={{
                    transform: enableVoice ? 'translateX(22px)' : 'translateX(2px)'
                  }}
                />
              </button>
              <span 
                className="text-sm font-medium"
                style={{ color: UI_COLORS.text.heading }}
              >
                Enable Voice
              </span>
            </div>
            )}
          </div>

          {/* Create Group Button */}
          <Button
            onClick={handleCreate}
            disabled={!isValid}
            className="w-full py-6 text-base font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              backgroundColor: UI_COLORS.button.primary, 
              color: UI_COLORS.button.text 
            }}
            onMouseEnter={(e) => {
              if (isValid) {
                e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover;
              }
            }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
          >
            Create Group
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CreateSimulationGroupDialog;