'use server';

import { createClient } from '../lib/supabase/server';

/**
 * RSVP timing configuration type (duplicated from frontend to avoid cross-package imports)
 */
export interface RsvpTimingConfig {
  wpm: number;
  commaMultiplier: number;
  periodMultiplier: number;
  questionMultiplier: number;
  paragraphMultiplier: number;
  phraseBoundaryMultiplier: number;
  enableLongRunRelief: boolean;
  maxWordsWithoutPause: number;
  enableParagraphEaseIn: boolean;
  enableShortWordBoost: boolean;
  enableComplexityFactor: boolean;
  enableSyllableWeight: boolean;
  domainMode: 'prose' | 'technical' | 'math' | 'code';
  enableMomentum: boolean;
  momentumMaxBoost: number;
}

/**
 * Partial RSVP timing config for user overrides.
 * Only the fields the user has customized are stored.
 */
export type RsvpUserSettings = Partial<RsvpTimingConfig>;

/**
 * Get the user's saved RSVP settings.
 * Returns null if no settings have been saved yet.
 */
export async function getRsvpSettings(): Promise<RsvpUserSettings | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('user_rsvp_settings')
    .select('settings')
    .eq('user_id', user.id)
    .single();

  if (error) {
    // No settings found - that's OK, return null
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(error.message);
  }

  return data.settings as RsvpUserSettings;
}

/**
 * Save the user's RSVP settings.
 * Uses upsert to create or update the settings row.
 */
export async function saveRsvpSettings(settings: RsvpUserSettings): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('user_rsvp_settings')
    .upsert(
      {
        user_id: user.id,
        settings,
      },
      {
        onConflict: 'user_id',
      }
    );

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Reset the user's RSVP settings to factory defaults.
 * Deletes the settings row entirely.
 */
export async function resetRsvpSettings(): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('user_rsvp_settings')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    throw new Error(error.message);
  }
}
