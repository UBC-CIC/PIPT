import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';

export interface CoverageDatum {
  attemptNumber: number;
  coverage: number;
}

/**
 * Line chart of key-question coverage (%) per attempt for the student patient
 * dashboard. Isolated into its own module so `recharts` is code-split and only
 * downloaded when this chart actually renders (lazy-loaded by the dashboard).
 */
export default function KeyQuestionsCoverageChart({ data }: { data: CoverageDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
        <XAxis
          dataKey="attemptNumber"
          tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
          stroke={UI_COLORS.border.default}
          label={{ value: 'Attempt Number', position: 'insideBottom', offset: -10, fill: UI_COLORS.text.body }}
          tickFormatter={(value) => `#${value}`}
        />
        <YAxis
          label={{ value: 'Coverage (%)', angle: -90, position: 'insideLeft', fill: UI_COLORS.text.body }}
          tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
          domain={[0, 100]}
          stroke={UI_COLORS.border.default}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: UI_COLORS.background.white,
            border: `1px solid ${UI_COLORS.border.default}`,
            borderRadius: '6px',
            color: UI_COLORS.text.body,
          }}
          labelStyle={{ color: UI_COLORS.text.heading }}
        />
        <Line
          type="monotone"
          dataKey="coverage"
          stroke={SIMULATION_GROUP_COLOR_PALETTE[2]}
          strokeWidth={2}
          name="Coverage (%)"
          dot={{ fill: SIMULATION_GROUP_COLOR_PALETTE[2], r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
