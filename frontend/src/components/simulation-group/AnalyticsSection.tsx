import { Users, UserCog } from 'lucide-react';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import type {
  PatientAnalytics,
  KeyQuestionCoverage,
  KeyQuestionAnalytics,
  DTPCoverage,
  RecommendationCoverage,
  DTPAnalytics,
  RecommendationAnalytics,
  StudentProgressData,
  OrganizationLabels,
  InstructorSimulationGroup,
} from '@/services/instructorService';

export interface AnalyticsSectionProps {
  patientAnalytics: PatientAnalytics[];
  analyticsDateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
  keyQuestionCoverage: KeyQuestionCoverage[];
  keyQuestionAnalytics: KeyQuestionAnalytics[];
  dtpCoverage: DTPCoverage[];
  recommendationCoverage: RecommendationCoverage[];
  dtpAnalytics: DTPAnalytics[];
  recommendationAnalytics: RecommendationAnalytics[];
  studentProgress: StudentProgressData[];
  selectedPatientId: string;
  onPatientSelect: (id: string) => void;
  labels: OrganizationLabels;
  simulationGroup: InstructorSimulationGroup | undefined;
  onNavigateToSection: (section: string) => void;
}

export function AnalyticsSection({
  patientAnalytics,
  analyticsDateRange,
  onDateRangeChange,
  keyQuestionCoverage,
  keyQuestionAnalytics,
  dtpCoverage,
  recommendationCoverage,
  dtpAnalytics,
  recommendationAnalytics,
  studentProgress,
  selectedPatientId,
  onPatientSelect,
  labels,
  simulationGroup,
  onNavigateToSection,
}: AnalyticsSectionProps) {
  const {
    aiPersona: aiPersonaLabel,
    aiPersonaPlural: aiPersonaLabelPlural,
    aiPersonaLower: aiPersonaLabelLower,
  } = labels;

  // Color helper for coverage bars
  const getCoverageColor = (coverage: number): string => {
    if (coverage >= 75) return '#22c55e'; // green
    if (coverage >= 55) return '#eab308'; // yellow
    return '#ef4444';                      // red
  };

  const simulationGroupName = simulationGroup?.group_name || 'Simulation Group';

  // Current patient data (for per-patient tab)
  const currentPatient = patientAnalytics.find(p => p.patient_id === selectedPatientId);
  const messageCountData = currentPatient
    ? [
        { name: 'Student Messages', value: currentPatient.student_message_count },
        { name: 'AI Messages', value: currentPatient.ai_message_count },
      ]
    : [];
  const donutColors = [SIMULATION_GROUP_COLOR_PALETTE[2], SIMULATION_GROUP_COLOR_PALETTE[5]];
  const totalMessages = currentPatient
    ? currentPatient.student_message_count + currentPatient.ai_message_count
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {/* Simulation Group Title */}
        <h2 className="text-3xl font-bold tracking-tight" style={{ color: UI_COLORS.text.heading }}>
          {simulationGroupName}
        </h2>
        {/* DATE FILTER RANGE */}
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border shadow-sm">
          <div className="flex items-center gap-2">
            <label htmlFor="startDate" className="text-sm font-medium text-gray-700">From:</label>
            <input
              type="date"
              id="startDate"
              className="border-none bg-transparent text-sm focus:ring-0 cursor-pointer outline-none"
              max={analyticsDateRange.end || undefined}
              value={analyticsDateRange.start}
              onChange={(e) => onDateRangeChange({ ...analyticsDateRange, start: e.target.value })}
            />
          </div>
          <div className="h-4 w-px bg-gray-300 mx-1 border-l"></div>
          <div className="flex items-center gap-2">
            <label htmlFor="endDate" className="text-sm font-medium text-gray-700">To:</label>
            <input
              type="date"
              id="endDate"
              className="border-none bg-transparent text-sm focus:ring-0 cursor-pointer outline-none"
              min={analyticsDateRange.start || undefined}
              value={analyticsDateRange.end}
              onChange={(e) => onDateRangeChange({ ...analyticsDateRange, end: e.target.value })}
            />
          </div>
          {(analyticsDateRange.start || analyticsDateRange.end) && (
            <button
              onClick={() => onDateRangeChange({ start: '', end: '' })}
              className="ml-2 text-xs text-gray-500 hover:text-gray-800 focus:outline-none"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tabs: Overview + Patient Tabs */}
      <div className="flex gap-2 border-b" style={{ borderColor: UI_COLORS.border.default }}>
        <button
          onClick={() => onPatientSelect('overview')}
          className="px-6 py-3 font-medium transition-colors border-b-2"
          style={{
            color: selectedPatientId === 'overview' ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body,
            borderColor: selectedPatientId === 'overview' ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent',
            backgroundColor: 'transparent',
            cursor: 'pointer',
          }}
        >
          Overview
        </button>
        {patientAnalytics.map((patient) => (
          <button
            key={patient.patient_id}
            onClick={() => onPatientSelect(patient.patient_id)}
            className="px-6 py-3 font-medium transition-colors border-b-2"
            style={{
              color: selectedPatientId === patient.patient_id ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body,
              borderColor: selectedPatientId === patient.patient_id ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            {patient.patient_name}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {selectedPatientId === 'overview' && simulationGroup && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Personas Card */}
            <div
              className="border rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onNavigateToSection('patients')}
              style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
            >
              <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[2] + '1a' }}>
                <Users className="w-5 h-5" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[2] }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: UI_COLORS.text.heading }}>{simulationGroup.persona_count}</p>
              <p className="text-sm mt-1" style={{ color: UI_COLORS.text.muted }}>{aiPersonaLabelPlural}</p>
            </div>
            {/* Students Card */}
            <div
              className="border rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onNavigateToSection('students')}
              style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
            >
              <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[5] + '1a' }}>
                <Users className="w-5 h-5" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[5] }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: UI_COLORS.text.heading }}>{simulationGroup.student_count}</p>
              <p className="text-sm mt-1" style={{ color: UI_COLORS.text.muted }}>Students</p>
            </div>
            {/* Instructors Card */}
            <div
              className="border rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onNavigateToSection('instructors')}
              style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
            >
              <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[4] + '1a' }}>
                <UserCog className="w-5 h-5" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[4] }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: UI_COLORS.text.heading }}>{simulationGroup.instructor_count ?? 0}</p>
              <p className="text-sm mt-1" style={{ color: UI_COLORS.text.muted }}>Instructors</p>
            </div>
          </div>

          {/* Per-Patient Completion Percentage - Horizontal Bar Graph */}
          <div className="border rounded-lg p-6" style={{ borderColor: UI_COLORS.border.default }}>
            <h3 className="text-xl font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
              {aiPersonaLabel} Completion Rate
            </h3>
            <p className="text-sm mb-6" style={{ color: UI_COLORS.text.muted }}>
              Percentage of students who have reached the debrief with each {aiPersonaLabelLower}.
            </p>
            {patientAnalytics.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(250, patientAnalytics.length * 50)}>
                <BarChart
                  data={patientAnalytics.map(p => ({
                    patientName: p.patient_name,
                    completionPercentage: Math.round(p.instructor_completion_percentage ?? 0),
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    axisLine={{ stroke: UI_COLORS.border.default }}
                    tickFormatter={(val: number) => `${val}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="patientName"
                    width={180}
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    axisLine={{ stroke: UI_COLORS.border.default }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: UI_COLORS.background.white,
                      border: `1px solid ${UI_COLORS.border.default}`,
                      borderRadius: '6px',
                    }}
                    formatter={(value: number | undefined) => [`${value ?? 0}%`, 'Completed']}
                  />
                  <Bar
                    dataKey="completionPercentage"
                    fill={SIMULATION_GROUP_COLOR_PALETTE[2]}
                    radius={[0, 4, 4, 0]}
                    barSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>No {aiPersonaLabelLower}s configured.</p>
            )}
          </div>

          {/* Key Question Coverage per Patient - Horizontal Bar */}
          {keyQuestionCoverage.length > 0 && (
            <div className="border rounded-lg p-6" style={{ borderColor: UI_COLORS.border.default }}>
              <h3 className="text-xl font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                Key Question Coverage by {aiPersonaLabel}
              </h3>
              <p className="text-sm mb-6" style={{ color: UI_COLORS.text.muted }}>
                Average percentage of key questions covered by students who completed their interaction.
              </p>
              <ResponsiveContainer width="100%" height={Math.max(250, keyQuestionCoverage.length * 50)}>
                <BarChart
                  data={keyQuestionCoverage}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    axisLine={{ stroke: UI_COLORS.border.default }}
                    tickFormatter={(val: number) => `${val}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="patientName"
                    width={180}
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    axisLine={{ stroke: UI_COLORS.border.default }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: UI_COLORS.background.white,
                      border: `1px solid ${UI_COLORS.border.default}`,
                      borderRadius: '6px',
                    }}
                    formatter={(value: number | undefined, _name: string | undefined, props: { payload?: { studentsDebriefed?: number } }) => [
                      `${value ?? 0}% avg (${props.payload?.studentsDebriefed ?? 0} students debriefed)`,
                      'Coverage',
                    ]}
                  />
                  <Bar
                    dataKey="avgCoverage"
                    radius={[0, 4, 4, 0]}
                    barSize={28}
                  >
                    {keyQuestionCoverage.map((entry, index) => (
                      <Cell
                        key={`cov-${index}`}
                        fill={
                          entry.avgCoverage >= 75 ? '#22c55e' :
                            entry.avgCoverage >= 55 ? '#eab308' :
                              '#ef4444'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-6 mt-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>Good (&ge;75%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#eab308' }} />
                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>Average (55&ndash;74%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>Needs Improvement (&lt;55%)</span>
                </div>
              </div>
            </div>
          )}

          {/* DTP Coverage per Patient - Horizontal Bar */}
          {dtpCoverage.length > 0 && (
            <div className="border rounded-lg p-6" style={{ borderColor: UI_COLORS.border.default }}>
              <h3 className="text-xl font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                DTP Coverage by {aiPersonaLabel}
              </h3>
              <p className="text-sm mb-6" style={{ color: UI_COLORS.text.muted }}>
                Average percentage of DTPs correctly identified by students who completed their debrief.
              </p>
              <ResponsiveContainer width="100%" height={Math.max(250, dtpCoverage.length * 50)}>
                <BarChart
                  data={dtpCoverage.map(d => ({
                    personaName: d.personaName,
                    avgCoverage: Math.round(d.avgCoverage),
                    studentsDebriefed: d.studentsDebriefed,
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    axisLine={{ stroke: UI_COLORS.border.default }}
                    tickFormatter={(val: number) => `${val}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="personaName"
                    width={180}
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    axisLine={{ stroke: UI_COLORS.border.default }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: UI_COLORS.background.white,
                      border: `1px solid ${UI_COLORS.border.default}`,
                      borderRadius: '6px',
                    }}
                    formatter={(value: number | undefined, _name: string | undefined, props: { payload?: { studentsDebriefed?: number } }) => [
                      `${value ?? 0}% avg (${props.payload?.studentsDebriefed ?? 0} students debriefed)`,
                      'DTP Coverage',
                    ]}
                  />
                  <Bar
                    dataKey="avgCoverage"
                    radius={[0, 4, 4, 0]}
                    barSize={28}
                  >
                    {dtpCoverage.map((entry, index) => (
                      <Cell
                        key={`dtp-cov-${index}`}
                        fill={getCoverageColor(entry.avgCoverage)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-6 mt-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>Good (&ge;75%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#eab308' }} />
                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>Average (55&ndash;74%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>Needs Improvement (&lt;55%)</span>
                </div>
              </div>
            </div>
          )}

          {/* Recommendation Coverage per Patient - Horizontal Bar */}
          {recommendationCoverage.length > 0 && (
            <div className="border rounded-lg p-6" style={{ borderColor: UI_COLORS.border.default }}>
              <h3 className="text-xl font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                Recommendation Coverage by {aiPersonaLabel}
              </h3>
              <p className="text-sm mb-6" style={{ color: UI_COLORS.text.muted }}>
                Average percentage of recommendations correctly identified by students who completed their debrief.
              </p>
              <ResponsiveContainer width="100%" height={Math.max(250, recommendationCoverage.length * 50)}>
                <BarChart
                  data={recommendationCoverage.map(r => ({
                    personaName: r.personaName,
                    avgCoverage: Math.round(r.avgCoverage),
                    studentsDebriefed: r.studentsDebriefed,
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    axisLine={{ stroke: UI_COLORS.border.default }}
                    tickFormatter={(val: number) => `${val}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="personaName"
                    width={180}
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    axisLine={{ stroke: UI_COLORS.border.default }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: UI_COLORS.background.white,
                      border: `1px solid ${UI_COLORS.border.default}`,
                      borderRadius: '6px',
                    }}
                    formatter={(value: number | undefined, _name: string | undefined, props: { payload?: { studentsDebriefed?: number } }) => [
                      `${value ?? 0}% avg (${props.payload?.studentsDebriefed ?? 0} students debriefed)`,
                      'Recommendation Coverage',
                    ]}
                  />
                  <Bar
                    dataKey="avgCoverage"
                    radius={[0, 4, 4, 0]}
                    barSize={28}
                  >
                    {recommendationCoverage.map((entry, index) => (
                      <Cell
                        key={`rec-cov-${index}`}
                        fill={getCoverageColor(entry.avgCoverage)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-6 mt-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>Good (&ge;75%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#eab308' }} />
                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>Average (55&ndash;74%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>Needs Improvement (&lt;55%)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {currentPatient && (
        <div className="border rounded-lg p-6" style={{ borderColor: UI_COLORS.border.default }}>
          <h3 className="text-xl font-semibold mb-6" style={{ color: UI_COLORS.text.heading }}>
            {currentPatient.patient_name} Overview
          </h3>

          {/* Message Counts + Student Access */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="border rounded-xl p-5 text-center" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
              <p className="text-2xl font-bold" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[2] }}>{currentPatient.student_message_count}</p>
              <p className="text-sm mt-1" style={{ color: UI_COLORS.text.muted }}>Student Messages</p>
            </div>
            <div className="border rounded-xl p-5 text-center" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
              <p className="text-2xl font-bold" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[5] }}>{currentPatient.ai_message_count}</p>
              <p className="text-sm mt-1" style={{ color: UI_COLORS.text.muted }}>AI Messages</p>
            </div>
            <div className="border rounded-xl p-5 text-center" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
              <p className="text-2xl font-bold" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[4] }}>{currentPatient.student_access_count}</p>
              <p className="text-sm mt-1" style={{ color: UI_COLORS.text.muted }}>Student Access Count</p>
            </div>
          </div>

          {/* Key Questions Asked - Horizontal Bar Graph (per persona) */}
          {keyQuestionAnalytics.length > 0 && (
            <div className="mt-8">
              <h4 className="text-lg font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                Key Questions &mdash; Students Asked
              </h4>
              <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                Number of students who asked each key question for {currentPatient.patient_name}.
              </p>
              <ResponsiveContainer width="100%" height={Math.max(250, keyQuestionAnalytics.length * 50)}>
                <BarChart
                  data={keyQuestionAnalytics}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                  <XAxis
                    type="number"
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    axisLine={{ stroke: UI_COLORS.border.default }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="questionTitle"
                    width={180}
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    axisLine={{ stroke: UI_COLORS.border.default }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: UI_COLORS.background.white,
                      border: `1px solid ${UI_COLORS.border.default}`,
                      borderRadius: '6px',
                    }}
                    formatter={(value: number | undefined) => [`${value ?? 0} students`, 'Asked']}
                  />
                  <Bar
                    dataKey="studentsAnswered"
                    fill={SIMULATION_GROUP_COLOR_PALETTE[2]}
                    radius={[0, 4, 4, 0]}
                    barSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* DTP Analytics - Horizontal Bar Graph (per persona) */}
          {dtpAnalytics.length > 0 && (
            <div className="mt-8">
              <h4 className="text-lg font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                DTPs &mdash; Students Identified
              </h4>
              <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                Number of students who correctly identified each DTP for {currentPatient.patient_name}.
              </p>
              <ResponsiveContainer width="100%" height={Math.max(250, dtpAnalytics.length * 50)}>
                <BarChart
                  data={dtpAnalytics}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                  <XAxis
                    type="number"
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    axisLine={{ stroke: UI_COLORS.border.default }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="title"
                    width={180}
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    axisLine={{ stroke: UI_COLORS.border.default }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: UI_COLORS.background.white,
                      border: `1px solid ${UI_COLORS.border.default}`,
                      borderRadius: '6px',
                    }}
                    formatter={(value: number | undefined) => [`${value ?? 0} students`, 'Matched']}
                  />
                  <Bar
                    dataKey="studentsMatched"
                    fill={SIMULATION_GROUP_COLOR_PALETTE[2]}
                    radius={[0, 4, 4, 0]}
                    barSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recommendation Analytics - Horizontal Bar Graph (per persona) */}
          {recommendationAnalytics.length > 0 && (
            <div className="mt-8">
              <h4 className="text-lg font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                Recommendations &mdash; Students Matched
              </h4>
              <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                Number of students who correctly identified each recommendation for {currentPatient.patient_name}.
              </p>
              <ResponsiveContainer width="100%" height={Math.max(250, recommendationAnalytics.length * 50)}>
                <BarChart
                  data={recommendationAnalytics}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                  <XAxis
                    type="number"
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    axisLine={{ stroke: UI_COLORS.border.default }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="title"
                    width={180}
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    axisLine={{ stroke: UI_COLORS.border.default }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: UI_COLORS.background.white,
                      border: `1px solid ${UI_COLORS.border.default}`,
                      borderRadius: '6px',
                    }}
                    formatter={(value: number | undefined) => [`${value ?? 0} students`, 'Matched']}
                  />
                  <Bar
                    dataKey="studentsMatched"
                    fill={SIMULATION_GROUP_COLOR_PALETTE[5]}
                    radius={[0, 4, 4, 0]}
                    barSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Donut Chart - Message Distribution */}
          <div className="mt-8">
            <h4 className="text-lg font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>
              Message Distribution
            </h4>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={messageCountData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {messageCountData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={donutColors[index % donutColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: UI_COLORS.background.white,
                    border: `1px solid ${UI_COLORS.border.default}`,
                    borderRadius: '6px',
                  }}
                  formatter={(value: number | undefined, name: string | undefined) => [`${value ?? 0} messages`, name ?? '']}
                />
                <Legend wrapperStyle={{ color: UI_COLORS.text.body }} />
                {/* Center text */}
                <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" style={{ fill: UI_COLORS.text.heading, fontSize: '28px', fontWeight: 700 }}>
                  {totalMessages}
                </text>
                <text x="50%" y="56%" textAnchor="middle" dominantBaseline="central" style={{ fill: UI_COLORS.text.muted, fontSize: '13px' }}>
                  Total Messages
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Student Progress Status */}
          <div className="mt-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>
                  Student Progress Status
                </h4>
                <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>
                  Distribution of student progress status for {currentPatient.patient_name}.
                </p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={studentProgress}
                margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                barSize={50}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                <XAxis
                  dataKey="status"
                  tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                  axisLine={{ stroke: UI_COLORS.border.default }}
                  label={{ value: 'Progress Status', position: 'insideBottom', offset: -10, fill: UI_COLORS.text.muted, fontSize: 12 }}
                />
                <YAxis
                  tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                  axisLine={{ stroke: UI_COLORS.border.default }}
                  allowDecimals={false}
                  label={{ value: 'Students', angle: -90, position: 'insideLeft', fill: UI_COLORS.text.muted, fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: UI_COLORS.background.white,
                    border: `1px solid ${UI_COLORS.border.default}`,
                    borderRadius: '6px',
                    padding: 0,
                  }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const entry = payload[0].payload as StudentProgressData;
                    return (
                      <div
                        style={{
                          backgroundColor: UI_COLORS.background.white,
                          border: `1px solid ${UI_COLORS.border.default}`,
                          borderRadius: '8px',
                          padding: '12px',
                          minWidth: '180px',
                          maxWidth: '240px',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              backgroundColor: entry.fill,
                              flexShrink: 0,
                            }}
                          />
                          <span className="font-semibold text-sm" style={{ color: UI_COLORS.text.heading }}>
                            {entry.status}
                          </span>
                        </div>
                        <div className="text-sm mb-2" style={{ color: UI_COLORS.text.muted }}>
                          {entry.count} student{entry.count !== 1 ? 's' : ''}
                        </div>
                        {entry.students.length > 0 && (
                          <div
                            style={{
                              maxHeight: '150px',
                              overflowY: 'auto',
                              borderTop: `1px solid ${UI_COLORS.border.light}`,
                              paddingTop: '8px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                            }}
                          >
                            {entry.students.map((student) => (
                              <div
                                key={student.id}
                                className="text-sm"
                                style={{ color: UI_COLORS.text.body }}
                              >
                                {student.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer">
                  {studentProgress.map((_entry, index) => (
                    <Cell
                      key={`progress-${index}`}
                      fill={_entry.fill}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
