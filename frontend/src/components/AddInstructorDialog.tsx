import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UI_COLORS } from '@/lib/colors';

interface AddInstructorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddInstructor: (email: string, name: string) => void;
}

export function AddInstructorDialog({ open, onOpenChange, onAddInstructor }: AddInstructorDialogProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    
    // Validate name
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    
    // Call the callback
    onAddInstructor(email.trim(), name.trim());
    
    // Reset form
    setEmail('');
    setName('');
    setError('');
    onOpenChange(false);
  };

  const handleCancel = () => {
    setEmail('');
    setName('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: UI_COLORS.text.heading }}>
            Add New Instructor
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
              Instructor Email
            </label>
            <Input
              type="email"
              placeholder="instructor@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              className="w-full focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ 
                borderWidth: '1px', 
                borderStyle: 'solid', 
                borderColor: error ? UI_COLORS.status.error : UI_COLORS.border.default,
                backgroundColor: UI_COLORS.background.white
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
              Instructor Name
            </label>
            <Input
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              className="w-full focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ 
                borderWidth: '1px', 
                borderStyle: 'solid', 
                borderColor: error ? UI_COLORS.status.error : UI_COLORS.border.default,
                backgroundColor: UI_COLORS.background.white
              }}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: UI_COLORS.status.error }}>
              {error}
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              onClick={handleCancel}
              variant="outline"
              className="px-6"
              style={{ 
                borderColor: UI_COLORS.border.default,
                color: UI_COLORS.text.heading,
                backgroundColor: UI_COLORS.background.white
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="px-6"
              style={{ 
                backgroundColor: UI_COLORS.button.primary, 
                color: UI_COLORS.button.text 
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
            >
              Add Instructor
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
