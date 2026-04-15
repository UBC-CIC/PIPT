import { useState } from 'react';
import {
  instructorService,
  type StudentDetails,
  type StudentPatientData,
} from '@/services/instructorService';

export interface UseStudentViewerParams {
  groupId: string | undefined;
  groupName: string | undefined;
}

export interface UseStudentViewerReturn {
  selectedStudentId: string | null;
  studentDetails: StudentDetails | null;
  studentDetailsLoading: boolean;
  studentPatientData: StudentPatientData | null;
  expandedAttemptId: string | null;
  selectedPatientFilter: string;
  viewStudent: (studentId: string) => Promise<void>;
  closeStudentView: () => void;
  setExpandedAttemptId: (id: string | null) => void;
  setSelectedPatientFilter: (filter: string) => void;
}

export function useStudentViewer({ groupId, groupName }: UseStudentViewerParams): UseStudentViewerReturn {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(null);
  const [studentDetailsLoading, setStudentDetailsLoading] = useState(false);
  const [studentPatientData, setStudentPatientData] = useState<StudentPatientData | null>(null);
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [selectedPatientFilter, setSelectedPatientFilter] = useState<string>('');

  const viewStudent = async (studentId: string) => {
    setSelectedStudentId(studentId);
    setStudentDetails(null);
    setStudentPatientData(null);
    setStudentDetailsLoading(true);
    try {
      const details = await instructorService.getStudentDetails(studentId, groupId || '', groupName);
      setStudentDetails(details || null);

      if (details?.email) {
        const patientData = await instructorService.getStudentPatientData(details.email, groupId || '');
        setStudentPatientData(patientData);
        if (patientData.patientNames.length > 0) {
          setSelectedPatientFilter(patientData.patientNames[0]);
        }
      }
    } catch (error) {
      console.error('Error loading student details:', error);
    } finally {
      setStudentDetailsLoading(false);
    }
  };

  const closeStudentView = () => {
    setSelectedStudentId(null);
    setStudentDetails(null);
    setStudentPatientData(null);
  };

  return {
    selectedStudentId,
    studentDetails,
    studentDetailsLoading,
    studentPatientData,
    expandedAttemptId,
    selectedPatientFilter,
    viewStudent,
    closeStudentView,
    setExpandedAttemptId,
    setSelectedPatientFilter,
  };
}
