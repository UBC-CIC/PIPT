import { useState } from 'react';
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

interface CreateSimulationGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: { name: string; description: string; instructors: string; systemPrompt: string; active: boolean; enableVoice: boolean }) => void;
}

function CreateSimulationGroupDialog({ 
  open, 
  onOpenChange, 
  onCreate 
}: CreateSimulationGroupDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructors, setInstructors] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [active, setActive] = useState(true);
  const [enableVoice, setEnableVoice] = useState(true);

  const handleCreate = () => {
    if (name.trim() && description.trim() && instructors.trim()) {
      onCreate({
        name: name.trim(),
        description: description.trim(),
        instructors: instructors.trim(),
        systemPrompt: systemPrompt.trim(),
        active,
        enableVoice
      });
      // Reset form
      setName('');
      setDescription('');
      setInstructors('');
      setSystemPrompt('');
      setActive(true);
      setEnableVoice(true);
      onOpenChange(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setInstructors('');
    setSystemPrompt('');
    setActive(true);
    setEnableVoice(true);
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

          {/* Add Instructors Field */}
          <div className="flex flex-col gap-2">
            <label 
              htmlFor="group-instructors" 
              className="text-sm font-medium"
              style={{ color: UI_COLORS.text.heading }}
            >
              Add Instructors <span style={{ color: UI_COLORS.status.error }}>*</span>
            </label>
            <Input
              id="group-instructors"
              placeholder="instructor1@example.com, instructor2@example.com, instructor3@example.com"
              value={instructors}
              onChange={(e) => setInstructors(e.target.value)}
              className="text-base focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ 
                borderWidth: '1px', 
                borderStyle: 'solid', 
                borderColor: UI_COLORS.border.default 
              }}
            />
          </div>

          {/* System Prompt Field */}
          <div className="flex flex-col gap-2">
            <label 
              htmlFor="group-system-prompt" 
              className="text-sm font-medium"
              style={{ color: UI_COLORS.text.heading }}
            >
              System Prompt
            </label>
            <textarea
              id="group-system-prompt"
              placeholder="Pretend to be a patient with the context you are given. You are helping the pharmacist practice their skills interacting with a patient. Engage with the pharmacist by describing your symptoms to provide them hints on what condition(s) you have. If you feel like the pharmacist is going down the wrong path, nudge them in the right direction by giving them more information. This is to help the pharmacist identify the proper diagnosis of the patient you are pretending to be."
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

            {/* Enable Voice Toggle */}
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
          </div>

          {/* Create Group Button */}
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || !description.trim() || !instructors.trim()}
            className="w-full py-6 text-base font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              backgroundColor: UI_COLORS.button.primary, 
              color: UI_COLORS.button.text 
            }}
            onMouseEnter={(e) => {
              if (name.trim() && description.trim() && instructors.trim()) {
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
