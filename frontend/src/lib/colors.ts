/**
 * Color palette for simulation group icons
 * Colors are assigned to groups dynamically based on their index or ID
 */
export const SIMULATION_GROUP_COLOR_PALETTE = [
  '#FF6B6B', // Red/Pink
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#9B59B6', // Purple
  '#F39C12', // Orange
  '#E74C3C', // Red
  '#2ECC71', // Green
  '#3498DB', // Light Blue
  '#E67E22', // Dark Orange
  '#1ABC9C', // Turquoise
] as const;

/**
 * Get a color from the palette for a simulation group
 * Uses modulo to cycle through colors if there are more groups than colors
 * 
 * @param index - The index or ID of the simulation group
 * @returns A hex color string from the palette
 */
export function getSimulationGroupColor(index: number): string {
  return SIMULATION_GROUP_COLOR_PALETTE[index % SIMULATION_GROUP_COLOR_PALETTE.length];
}

/**
 * UI Component colors
 */
export const UI_COLORS = {
  button: {
    primary: '#262626',
    primaryHover: '#171717',
    text: '#FFFFFF',
  },
  header: {
    background: '#E5E5E5',
  },
  text: {
    heading: '#111827',
    body: '#374151',
    muted: '#6B7280',
  },
  icon: {
    default: '#262626',
    muted: '#737373',
  },
} as const;

/**
 * Type exports for type safety
 */
export type SimulationGroupColor = typeof SIMULATION_GROUP_COLOR_PALETTE[number];
export type UIColor = typeof UI_COLORS;
