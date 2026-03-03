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
    secondary: '#1F2937', // gray-800
    secondaryHover: '#111827', // gray-900
    cancel: '#E5E5E5', // gray-200
    cancelHover: '#D4D4D4', // gray-300
    text: '#FFFFFF',
    textDark: '#111827', // gray-900
  },
  header: {
    background: '#E5E5E5', // gray-200
  },
  text: {
    heading: '#111827', // gray-900
    body: '#374151', // gray-600
    muted: '#6B7280', // gray-500
    light: '#9CA3AF', // gray-400
    black: '#000000',
  },
  icon: {
    default: '#262626',
    muted: '#737373', // gray-600
    dark: '#4B5563', // gray-600
  },
  border: {
    default: '#D1D5DB', // gray-300
    light: '#E5E7EB', // gray-200
    medium: '#9CA3AF', // gray-400
    transparent: 'transparent',
  },
  background: {
    white: '#FFFFFF',
    input: '#F9FAFB', // gray-50
    tableHeader: '#F9FAFB', // gray-50
    hover: '#F9FAFB', // gray-50
    hoverLight: '#F3F4F6', // gray-100
    overlay: 'rgba(0, 0, 0, 0.5)', // black/50
    transparent: 'transparent',
  },
  avatar: {
    fallback: '#646cff', // Default avatar color
  },
  gradient: {
    loginEnd: '#2E8BA8', // Login page gradient end color
    signupEnd: '#15A085', // Signup page gradient end color
  },
} as const;

/**
 * Type exports for type safety
 */
export type SimulationGroupColor = typeof SIMULATION_GROUP_COLOR_PALETTE[number];
export type UIColor = typeof UI_COLORS;
