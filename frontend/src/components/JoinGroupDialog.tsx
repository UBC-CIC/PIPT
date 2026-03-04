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

interface JoinGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin: (accessCode: string) => Promise<{ success: boolean; error?: string }>;
}

function JoinGroupDialog({ open, onOpenChange, onJoin }: JoinGroupDialogProps) {
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    if (!accessCode.trim()) return;
    
    setError('');
    setLoading(true);
    
    try {
      const result = await onJoin(accessCode.trim());
      if (result.success) {
        setAccessCode('');
        onOpenChange(false);
      } else {
        setError(result.error || 'Failed to join group.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setAccessCode('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setAccessCode('');
        setError('');
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Join Group</DialogTitle>
          <DialogDescription className="text-base" style={{ color: UI_COLORS.text.body }}>
            Please enter the access code provided by an instructor.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          {error && (
            <div 
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: '#FEE2E2', color: '#991B1B', borderWidth: '1px', borderStyle: 'solid', borderColor: '#FECACA' }}
            >
              {error}
            </div>
          )}
          <Input
            placeholder="Access Code"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleJoin();
              }
            }}
            className="text-base focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default }}
            disabled={loading}
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="px-8 transition-colors"
              style={{ 
                backgroundColor: UI_COLORS.button.cancel, 
                color: UI_COLORS.button.textDark,
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: UI_COLORS.border.medium
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.cancelHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.cancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleJoin}
              className="px-8 transition-colors"
              style={{ 
                backgroundColor: UI_COLORS.button.primary, 
                color: UI_COLORS.button.text,
                opacity: loading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
              disabled={loading}
            >
              {loading ? 'Joining...' : 'Join'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default JoinGroupDialog;
