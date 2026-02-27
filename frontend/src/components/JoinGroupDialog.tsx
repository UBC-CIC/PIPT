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

interface JoinGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin: (accessCode: string) => void;
}

function JoinGroupDialog({ open, onOpenChange, onJoin }: JoinGroupDialogProps) {
  const [accessCode, setAccessCode] = useState('');

  const handleJoin = () => {
    if (accessCode.trim()) {
      onJoin(accessCode.trim());
      setAccessCode('');
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setAccessCode('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Join Group</DialogTitle>
          <DialogDescription className="text-base text-gray-600">
            Please enter the access code provided by an instructor.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Input
            placeholder="Access Code"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleJoin();
              }
            }}
            className="text-base border border-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="px-8 bg-gray-200 text-gray-900 hover:bg-gray-300 border border-gray-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleJoin}
              className="px-8 bg-black text-white hover:bg-gray-800"
            >
              Join
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default JoinGroupDialog;
