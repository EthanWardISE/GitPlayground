import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createSupabaseClient() {
	if (!supabaseConfigured) {
		throw new Error('Supabase is not configured. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY, then rebuild and redeploy the app.');
	}

	browserClient ??= createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
	return browserClient;
}

export const PHOTO_BUCKET = 'family-photos';
