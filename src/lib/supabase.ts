import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/database';

const supabaseUrl = 
    import.meta.env.PUBLIC_SUPABASE_URL || 
    (import.meta.env.SSR ? process.env.PUBLIC_SUPABASE_URL : undefined) || 
    '';

const supabasePublishableKey = 
    import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
    (import.meta.env.SSR ? process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY : undefined) || 
    '';

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createSupabaseClient() {
    if (!supabaseConfigured) {
        throw new Error('Supabase is not configured. Environment keys are missing.');
    }

    browserClient ??= createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
    return browserClient;
}

export const PHOTO_BUCKET = 'family-photos';