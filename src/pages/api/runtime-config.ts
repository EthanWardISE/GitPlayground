export const prerender = false;

export function GET() {
	const supabaseUrl = process.env.PUBLIC_SUPABASE_URL
		|| (import.meta.env.DEV ? import.meta.env.PUBLIC_SUPABASE_URL : '');
	const supabasePublishableKey = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY
		|| (import.meta.env.DEV ? import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY : '');

	if (!supabaseUrl || !supabasePublishableKey) {
		return new Response(JSON.stringify({ configured: false }), {
			status: 503,
			headers: {
				'Cache-Control': 'no-store',
				'Content-Type': 'application/json',
			},
		});
	}

	return new Response(JSON.stringify({
		configured: true,
		url: supabaseUrl,
		publishableKey: supabasePublishableKey,
	}), {
		headers: {
			'Cache-Control': 'no-store',
			'Content-Type': 'application/json',
		},
	});
}
