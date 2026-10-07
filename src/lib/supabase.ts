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
        console.error('Supabase configuration missing: URL or Key is empty.');
        throw new Error('Supabase is not configured.');
    }

    try {
        browserClient ??= createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
        return browserClient;
    } catch (err) {
        console.error('Failed to create Supabase client instance:', err);
        throw err;
    }
}

export const PHOTO_BUCKET = 'family-photos';