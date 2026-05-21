import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UI_COLORS } from '@/lib/colors';
import { getAllInstructors, type AdminInstructor } from '@/services/adminApiService';
import LoadingIndicator from '@/components/LoadingIndicator';

interface AddInstructorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddInstructor: (email: string, name: string) => void;
  /** Emails of instructors already in the group (to exclude from the list) */
  existingInstructorEmails?: string[];
}

export function AddInstructorDialog({ open, onOpenChange, onAddInstructor, existingInstructorEmails = [] }: AddInstructorDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [availableInstructors, setAvailableInstructors] = useState<AdminInstructor[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch instructors when dialog opens
  useEffect(() => {
    if (open) {
      setLoading(true);
      getAllInstructors()
        .then((instructors) => setAvailableInstructors(instructors))
        .catch((err) => console.error('Failed to load instructors:', err))
        .finally(() => setLoading(false));
    }
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter out already-enrolled instructors and apply search
  const filteredInstructors = availableInstructors.filter((instructor) => {
    const isAlreadyEnrolled = existingInstructorEmails.includes(instructor.user_email);
    if (isAlreadyEnrolled) return false;

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${instructor.first_name} ${instructor.last_name}`.toLowerCase();
    return (
      fullName.includes(query) ||
      instructor.user_email.toLowerCase().includes(query)
    );
  });

  const handleSelect = (instructor: AdminInstructor) => {
    setSelectedEmail(instructor.user_email);
    setSelectedName(`${instructor.first_name} ${instructor.last_name}`.trim());
    setSearchQuery(`${instructor.first_name} ${instructor.last_name} (${instructor.user_email})`);
    setDropdownOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmail) return;
    onAddInstructor(selectedEmail, selectedName);
    resetForm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setSearchQuery('');
    setSelectedEmail('');
    setSelectedName('');
    setDropdownOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); onOpenChange(isOpen); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: UI_COLORS.text.heading }}>
            Add Instructor to Group
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
              Select Instructor
            </label>
            <p className="text-xs mb-2" style={{ color: UI_COLORS.text.muted }}>
              Only verified instructors with active accounts are shown.
            </p>
            <div ref={dropdownRef} className="relative">
              <Input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedEmail('');
                  setSelectedName('');
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                className="w-full focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ 
                  borderWidth: '1px', 
                  borderStyle: 'solid', 
                  borderColor: UI_COLORS.border.default,
                  backgroundColor: UI_COLORS.background.white
                }}
              />

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
                  {loading ? (
                    <div className="px-3 py-2">
                      <LoadingIndicator size="sm" message="Loading instructors..." />
                    </div>
                  ) : filteredInstructors.length === 0 ? (
                    <div className="px-3 py-2 text-sm" style={{ color: UI_COLORS.text.muted }}>
                      {searchQuery.trim()
                        ? 'No matching instructors found'
                        : 'No available instructors'}
                    </div>
                  ) : (
                    filteredInstructors.map((instructor) => (
                      <button
                        key={instructor.user_email}
                        type="button"
                        onClick={() => handleSelect(instructor)}
                        className="w-full text-left flex flex-col px-3 py-2 cursor-pointer hover:bg-gray-50"
                      >
                        <span className="text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>
                          {instructor.first_name && instructor.last_name
                            ? `${instructor.first_name} ${instructor.last_name}`
                            : instructor.user_email}
                        </span>
                        {instructor.first_name && instructor.last_name && (
                          <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                            {instructor.user_email}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedEmail && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-md"
              style={{ backgroundColor: '#e0e7ff' }}
            >
              <span className="text-sm" style={{ color: '#3730a3' }}>
                {selectedName ? `${selectedName} (${selectedEmail})` : selectedEmail}
              </span>
            </div>
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
              disabled={!selectedEmail}
              style={{ 
                backgroundColor: selectedEmail ? UI_COLORS.button.primary : UI_COLORS.border.default, 
                color: UI_COLORS.button.text 
              }}
              onMouseEnter={(e) => { if (selectedEmail) e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover; }}
              onMouseLeave={(e) => { if (selectedEmail) e.currentTarget.style.backgroundColor = UI_COLORS.button.primary; }}
            >
              Add Instructor
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
