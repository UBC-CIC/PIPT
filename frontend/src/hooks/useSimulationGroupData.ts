import { useEffect, useState } from 'react';
import {
  instructorService,
  type KeyQuestionAnalytics,
  type KeyQuestionCoverage,
  type DTPCoverage,
  type RecommendationCoverage,
  type DTPAnalytics,
  type RecommendationAnalytics,
  type StudentProgressData,
  type UserData,
  type OrganizationLabels,
} from '@/services/instructorService';
import * as adminApi from '@/services/adminApiService';
import { mockAdminDataService } from '@/services/adminService';

export interface UseSimulationGroupDataParams {
  groupId: string | undefined;
  organizationId?: string;
  role: 'admin' | 'instructor';
}

export interface UseSimulationGroupDataReturn {
  // Core data
  simulationGroup: any;
  patientAnalytics: any[];
  students: any[];
  manageablePatients: any[];
  profilePictures: Record<string, string>;
  keyQuestionCoverage: KeyQuestionCoverage[];
  dtpCoverage: DTPCoverage[];
  recommendationCoverage: RecommendationCoverage[];
  labels: OrganizationLabels;
  user: UserData;
  loading: boolean;

  // Analytics filtering
  analyticsDateRange: { start: string; end: string };
  setAnalyticsDateRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
  keyQuestionAnalytics: KeyQuestionAnalytics[];
  dtpAnalytics: DTPAnalytics[];
  recommendationAnalytics: RecommendationAnalytics[];
  studentProgress: StudentProgressData[];
  selectedPatientId: string;
  setSelectedPatientId: (id: string) => void;

  // Mutations
  setManageablePatients: React.Dispatch<React.SetStateAction<any[]>>;
  setSimulationGroup: React.Dispatch<React.SetStateAction<any>>;
  setProfilePictures: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  reloadPatients: () => Promise<void>;
}

export function useSimulationGroupData({
  groupId,
  organizationId,
  role,
}: UseSimulationGroupDataParams): UseSimulationGroupDataReturn {
  // Core data state
  const [simulationGroup, setSimulationGroup] = useState<any>(undefined);
  const [patientAnalytics, setPatientAnalytics] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [manageablePatients, setManageablePatients] = useState<any[]>([]);
  const [profilePictures, setProfilePictures] = useState<Record<string, string>>({});
  const [keyQuestionCoverage, setKeyQuestionCoverage] = useState<KeyQuestionCoverage[]>([]);
  const [dtpCoverage, setDtpCoverage] = useState<DTPCoverage[]>([]);
  const [recommendationCoverage, setRecommendationCoverage] = useState<RecommendationCoverage[]>([]);
  const [loading, setLoading] = useState(true);

  // User data - admin uses mock, instructor fetches from service
  const [user, setUser] = useState<UserData>(
    role === 'admin'
      ? mockAdminDataService.getCurrentUser()
      : { name: 'Instructor', avatarUrl: undefined }
  );

  // Analytics filtering state
  const [analyticsDateRange, setAnalyticsDateRange] = useState({ start: '', end: '' });
  const [keyQuestionAnalytics, setKeyQuestionAnalytics] = useState<KeyQuestionAnalytics[]>([]);
  const [dtpAnalytics, setDtpAnalytics] = useState<DTPAnalytics[]>([]);
  const [recommendationAnalytics, setRecommendationAnalytics] = useState<RecommendationAnalytics[]>([]);
  const [studentProgress, setStudentProgress] = useState<StudentProgressData[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('overview');

  // Organization-specific labels
  const labels = instructorService.getOrganizationLabels(groupId || '1');

  // Reload patients helper
  const reloadPatients = async () => {
    if (!groupId) return;
    try {
      const patientsData = await instructorService.getManageablePatients(groupId);
      setManageablePatients(patientsData);
    } catch (error) {
      console.error('Failed to reload patients:', error);
    }
  };

  // Reset all group-specific state when navigating to a different group
  useEffect(() => {
    setSimulationGroup(undefined);
    setPatientAnalytics([]);
    setStudents([]);
    setManageablePatients([]);
    setProfilePictures({});
    setKeyQuestionCoverage([]);
    setDtpCoverage([]);
    setRecommendationCoverage([]);
    setKeyQuestionAnalytics([]);
    setDtpAnalytics([]);
    setRecommendationAnalytics([]);
    setStudentProgress([]);
    setSelectedPatientId('overview');
    setLoading(true);
  }, [groupId]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      if (!groupId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      if (role === 'instructor') {
        // Instructor: load all data via instructorService
        try {
          const [userData, groupData, analyticsData, studentsData, patientsData, profilePics] = await Promise.all([
            instructorService.getCurrentUser().catch(err => { console.error('Failed to load user:', err); return { name: 'Instructor', avatarUrl: undefined } as UserData; }),
            instructorService.getSimulationGroup(groupId).catch(err => { console.error('Failed to load group:', err); return undefined; }),
            instructorService.getPatientAnalytics(groupId).catch(err => { console.error('Failed to load analytics:', err); return [] as any[]; }),
            instructorService.getStudents(groupId).catch(err => { console.error('Failed to load students:', err); return [] as any[]; }),
            instructorService.getManageablePatients(groupId).catch(err => { console.error('Failed to load patients:', err); return [] as any[]; }),
            instructorService.fetchProfilePictures(groupId).catch(err => { console.error('Failed to load profile pictures:', err); return {} as Record<string, string>; }),
          ]);

          setUser(userData);
          setSimulationGroup(groupData);
          setPatientAnalytics(analyticsData);
          setStudents(studentsData);
          setManageablePatients(patientsData);
          setProfilePictures(profilePics);
        } catch (error) {
          console.error('Error loading instructor data:', error);
        } finally {
          setLoading(false);
        }
      } else {
        // Admin: load group via adminApi, rest via instructorService
        try {
          const [adminGroupData, analyticsData, studentsData, patientsData, profilePics] = await Promise.all([
            adminApi.getSimulationGroup(groupId).catch(err => { console.error('Failed to load group:', err); return undefined; }),
            instructorService.getPatientAnalytics(groupId).catch(err => { console.error('Failed to load analytics:', err); return [] as any[]; }),
            instructorService.getStudents(groupId).catch(err => { console.error('Failed to load students:', err); return [] as any[]; }),
            instructorService.getManageablePatients(groupId).catch(err => { console.error('Failed to load patients:', err); return [] as any[]; }),
            instructorService.fetchProfilePictures(groupId).catch(err => { console.error('Failed to load profile pictures:', err); return {} as Record<string, string>; }),
          ]);

          // Map admin API shape to InstructorSimulationGroup
          if (adminGroupData) {
            setSimulationGroup({
              simulation_group_id: adminGroupData.simulation_group_id,
              group_name: adminGroupData.group_name,
              subtitle: 'Medical Simulation Group',
              group_access_code: adminGroupData.group_access_code || '',
              student_count: adminGroupData.student_count || 0,
              instructor_count: adminGroupData.instructor_count || 0,
              persona_count: adminGroupData.persona_count || 0,
              organization_id: adminGroupData.organization_id || '',
            });
          }

          setPatientAnalytics(analyticsData);
          setStudents(studentsData);
          setManageablePatients(patientsData);
          setProfilePictures(profilePics);
        } catch (error) {
          console.error('Error loading admin simulation group data:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadData();
  }, [groupId, organizationId, role]);

  // Filter analytics data based on date range
  useEffect(() => {
    if (!groupId) return;
    const fetchFilteredAnalytics = async () => {
      try {
        const [analyticsData, coverageData, dtpCoverageData, recCoverageData] = await Promise.all([
          instructorService.getPatientAnalytics(groupId, analyticsDateRange.start, analyticsDateRange.end),
          instructorService.getKeyQuestionCoverage(groupId, analyticsDateRange.start, analyticsDateRange.end),
          instructorService.getDTPCoverage(groupId, analyticsDateRange.start, analyticsDateRange.end),
          instructorService.getRecommendationCoverage(groupId, analyticsDateRange.start, analyticsDateRange.end),
        ]);
        setPatientAnalytics(analyticsData);
        setKeyQuestionCoverage(coverageData);
        setDtpCoverage(dtpCoverageData);
        setRecommendationCoverage(recCoverageData);
      } catch (error) {
        console.error('Error fetching filtered analytics:', error);
      }
    };
    if (simulationGroup) {
      fetchFilteredAnalytics();
    }
  }, [groupId, analyticsDateRange.start, analyticsDateRange.end, simulationGroup]);

  // Key question analytics per patient
  useEffect(() => {
    const currentPatient = patientAnalytics.find(p => p.patient_id === selectedPatientId);
    if (currentPatient && groupId) {
      Promise.all([
        instructorService.getPatientKeyQuestionAnalytics(groupId, currentPatient.patient_id, analyticsDateRange.start, analyticsDateRange.end),
        instructorService.getPatientDTPAnalytics(groupId, currentPatient.patient_id, analyticsDateRange.start, analyticsDateRange.end),
        instructorService.getPatientRecommendationAnalytics(groupId, currentPatient.patient_id, analyticsDateRange.start, analyticsDateRange.end),
      ]).then(([kqData, dtpData, recData]) => {
        setKeyQuestionAnalytics(kqData);
        setDtpAnalytics(dtpData);
        setRecommendationAnalytics(recData);
      }).catch(() => {
        setKeyQuestionAnalytics([]);
        setDtpAnalytics([]);
        setRecommendationAnalytics([]);
      });
    } else {
      setKeyQuestionAnalytics([]);
      setDtpAnalytics([]);
      setRecommendationAnalytics([]);
    }
  }, [selectedPatientId, patientAnalytics, groupId, analyticsDateRange.start, analyticsDateRange.end]);

  // Student progress per patient
  useEffect(() => {
    if (groupId && selectedPatientId && selectedPatientId !== 'overview') {
      instructorService.getStudentProgress(groupId, selectedPatientId, analyticsDateRange.start, analyticsDateRange.end)
        .then(data => setStudentProgress(data))
        .catch(err => console.error(err));
    } else {
      setStudentProgress([]);
    }
  }, [groupId, selectedPatientId, analyticsDateRange.start, analyticsDateRange.end]);

  return {
    simulationGroup,
    patientAnalytics,
    students,
    manageablePatients,
    profilePictures,
    keyQuestionCoverage,
    dtpCoverage,
    recommendationCoverage,
    labels,
    user,
    loading,
    analyticsDateRange,
    setAnalyticsDateRange,
    keyQuestionAnalytics,
    dtpAnalytics,
    recommendationAnalytics,
    studentProgress,
    selectedPatientId,
    setSelectedPatientId,
    setManageablePatients,
    setSimulationGroup,
    setProfilePictures,
    reloadPatients,
  };
}
