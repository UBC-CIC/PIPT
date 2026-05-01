export interface VoiceOption {
  id: string;
  name: string;
  gender: 'Feminine' | 'Masculine';
  accent: string;
}

/**
 * Canonical list of available English voices for patient personas.
 * Used by VoiceSelector (patient create/edit) and VoicePreview (prompt playground).
 */
export const VOICES: VoiceOption[] = [
  { id: 'tiffany', name: 'Tiffany', gender: 'Feminine', accent: 'English (US)' },
  { id: 'matthew', name: 'Matthew', gender: 'Masculine', accent: 'English (US)' },
  { id: 'amy', name: 'Amy', gender: 'Feminine', accent: 'English (UK)' },
  { id: 'olivia', name: 'Olivia', gender: 'Feminine', accent: 'English (AU)' },
  { id: 'kiara', name: 'Kiara', gender: 'Feminine', accent: 'English (IN)' },
  { id: 'arjun', name: 'Arjun', gender: 'Masculine', accent: 'English (IN)' },
];

/** Set of valid voice IDs for quick validation */
export const VALID_VOICE_IDS = new Set(VOICES.map((v) => v.id));

/** Group voices by accent for grouped dropdowns */
export function getVoicesByAccent(): { accent: string; voices: VoiceOption[] }[] {
  const groups = new Map<string, VoiceOption[]>();
  for (const voice of VOICES) {
    const list = groups.get(voice.accent) ?? [];
    list.push(voice);
    groups.set(voice.accent, list);
  }
  return Array.from(groups.entries()).map(([accent, voices]) => ({ accent, voices }));
}
