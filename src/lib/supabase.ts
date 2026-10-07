import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || '';
const supabasePublishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createSupabaseClient() {
    if (!supabaseConfigured) {
        throw new Error('Supabase is not configured. Copy .env.example to .env and add your project URL and publishable key.');
    }

    browserClient ??= createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
    return browserClient;
}

export const PHOTO_BUCKET = 'family-photos';