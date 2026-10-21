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

export function getSupabaseErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
    const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
            ? error.message
            : '';
    const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
        ? error.code
        : '';

    if (
        code === 'PGRST205'
        || code === '42P01'
        || (/schema cache/i.test(message) && /profile_claim_requests|person_relationships|tree_positions|collections|collection_photos|bounties|bounty_submissions/i.test(message))
    ) {
        return 'Kinfolk’s family database update is missing. Run the latest files in supabase/migrations in your Supabase SQL Editor, then refresh the page.';
    }

    return message || fallback;
}

export const PHOTO_BUCKET = 'family-photos';

export async function getResolvedPhotos() {
	const { data, error } = await createSupabaseClient().rpc('get_photos_with_resolved_country');
	if (error) throw error;
	return data;
}

export async function updateDefaultCountry(countryCode: string) {
	const user = (await createSupabaseClient().auth.getUser()).data.user;
	if (!user) throw new Error('You must be signed in to update location settings.');
	const { error } = await createSupabaseClient()
		.from('profiles')
		.update({ default_country_code: countryCode.toUpperCase() })
		.eq('user_id', user.id);
	if (error) throw error;
}