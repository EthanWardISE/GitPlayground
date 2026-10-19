import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/database';

let supabaseUrl = '';
let supabasePublishableKey = '';
let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function configureSupabaseClient(config: { url: string; publishableKey: string }) {
    supabaseUrl = config.url;
    supabasePublishableKey = config.publishableKey;
    browserClient = undefined;
}

export function createSupabaseClient() {
    if (!supabaseUrl || !supabasePublishableKey) {
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