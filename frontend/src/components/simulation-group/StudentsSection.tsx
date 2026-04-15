import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { UI_COLORS } from '@/lib/colors';
import type { Student, OrganizationLabels } from '@/services/instructorService';

export interface StudentsSectionProps {
  students: Student[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onViewStudent: (studentId: string) => void;
  labels: OrganizationLabels;
}

export function StudentsSection({
  students,
  searchQuery,
  onSearchChange,
  onViewStudent,
  labels,
}: StudentsSectionProps) {
  const filteredStudents = students.filter(student =>
    (student.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: UI_COLORS.text.muted }} />
        <Input
          placeholder={`Search by ${labels.userRole} Name`}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 py-6 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: UI_COLORS.border.default,
            backgroundColor: UI_COLORS.background.white
          }}
        />
      </div>

      <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>
        Click on a {labels.userRoleLower} entry to view their performance metrics.
      </p>

      {/* Student Table */}
      <div className="border rounded-lg overflow-hidden" style={{ borderColor: UI_COLORS.border.default }}>
        {/* Table Header */}
        <div className="grid grid-cols-2 gap-4 px-6 py-4" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
          <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
            {labels.userRole} Name
          </div>
          <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
            Email Address
          </div>
        </div>

        {/* Table Rows */}
        {filteredStudents.map((student) => (
          <div
            key={student.id}
            className="grid grid-cols-2 gap-4 px-6 py-4 border-t items-center cursor-pointer transition-colors hover:bg-gray-50"
            style={{ borderColor: UI_COLORS.border.default }}
            onClick={() => onViewStudent(student.id)}
          >
            <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
              {student.name}
            </div>
            <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
              {student.email}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
