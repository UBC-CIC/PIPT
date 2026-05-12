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

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: { name: string; description: string; aiPersonaTitle: string; userRoleTitle: string; systemPrompt: string }) => void;
}

function CreateOrganizationDialog({ 
  open, 
  onOpenChange, 
  onCreate 
}: CreateOrganizationDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [aiPersonaTitle, setAiPersonaTitle] = useState('');
  const [userRoleTitle, setUserRoleTitle] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');

  const handleCreate = () => {
    if (name.trim() && description.trim() && aiPersonaTitle.trim() && userRoleTitle.trim()) {
      onCreate({
        name: name.trim(),
        description: description.trim(),
        aiPersonaTitle: aiPersonaTitle.trim(),
        userRoleTitle: userRoleTitle.trim(),
        systemPrompt: systemPrompt.trim()
      });
      // Reset form
      setName('');
      setDescription('');
      setAiPersonaTitle('');
      setUserRoleTitle('');
      setSystemPrompt('');
      onOpenChange(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setAiPersonaTitle('');
    setUserRoleTitle('');
    setSystemPrompt('');
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
          <DialogTitle className="text-2xl font-bold">Create new Organization</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new organization with name, description, AI persona, and system prompt
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-6 py-4 overflow-y-auto pr-2">
          {/* Name Field */}
          <div className="flex flex-col gap-2">
            <label 
              htmlFor="org-name" 
              className="text-sm font-medium"
              style={{ color: UI_COLORS.text.heading }}
            >
              Name <span style={{ color: UI_COLORS.status.error }}>*</span>
            </label>
            <Input
              id="org-name"
              placeholder="Academic Advising"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
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
              htmlFor="org-description" 
              className="text-sm font-medium"
              style={{ color: UI_COLORS.text.heading }}
            >
              Description <span style={{ color: UI_COLORS.status.error }}>*</span>
            </label>
            <Input
              id="org-description"
              placeholder="Simulating interactions between students and academic advisors"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={250}
              className="text-base focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ 
                borderWidth: '1px', 
                borderStyle: 'solid', 
                borderColor: UI_COLORS.border.default 
              }}
            />
          </div>

          {/* AI Persona Title Field */}
          <div className="flex flex-col gap-2">
            <label 
              htmlFor="ai-persona-title" 
              className="text-sm font-medium"
              style={{ color: UI_COLORS.text.heading }}
            >
              AI Persona title <span style={{ color: UI_COLORS.status.error }}>*</span>
            </label>
            <Input
              id="ai-persona-title"
              placeholder="Student"
              value={aiPersonaTitle}
              onChange={(e) => setAiPersonaTitle(e.target.value)}
              maxLength={50}
              className="text-base focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ 
                borderWidth: '1px', 
                borderStyle: 'solid', 
                borderColor: UI_COLORS.border.default 
              }}
            />
          </div>

          {/* User Role Title Field */}
          <div className="flex flex-col gap-2">
            <label 
              htmlFor="user-role-title" 
              className="text-sm font-medium"
              style={{ color: UI_COLORS.text.heading }}
            >
              User Role title <span style={{ color: UI_COLORS.status.error }}>*</span>
            </label>
            <Input
              id="user-role-title"
              placeholder="Academic Advisor"
              value={userRoleTitle}
              onChange={(e) => setUserRoleTitle(e.target.value)}
              maxLength={50}
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
              htmlFor="system-prompt" 
              className="text-sm font-medium"
              style={{ color: UI_COLORS.text.heading }}
            >
              System Prompt
            </label>
            <p className="text-xs mb-1" style={{ color: UI_COLORS.text.muted }}>
              Defines HOW the AI should behave across all personas in this organization (tone, response length, rules).
            </p>
            <textarea
              id="system-prompt"
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

          {/* Create Organization Button */}
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || !description.trim() || !aiPersonaTitle.trim() || !userRoleTitle.trim()}
            className="w-full py-6 text-base font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              backgroundColor: UI_COLORS.button.primary, 
              color: UI_COLORS.button.text 
            }}
            onMouseEnter={(e) => {
              if (name.trim() && description.trim() && aiPersonaTitle.trim() && userRoleTitle.trim()) {
                e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover;
              }
            }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
          >
            Create Organisation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CreateOrganizationDialog;
