export interface ScoreDisplayPreferences {
  positions: boolean;
  fingerings: boolean;
  noteNames: boolean;
  chords: boolean;
  lyrics: boolean;
}

export type ScoreDisplayLayer = keyof ScoreDisplayPreferences;

export const DEFAULT_SCORE_DISPLAY_PREFERENCES: ScoreDisplayPreferences = {
  positions: true,
  fingerings: true,
  noteNames: true,
  chords: true,
  lyrics: true,
};
