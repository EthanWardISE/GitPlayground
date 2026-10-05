import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
	const startedAt = performance.now();
	let status = 500;

	try {
		const response = await next();
		status = response.status;
		return response;
	} finally {
		console.log(
			JSON.stringify({
				timestamp: new Date().toISOString(),
				level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
				message: 'http_request',
				method: context.request.method,
				path: context.url.pathname,
				status,
				durationMs: Number((performance.now() - startedAt).toFixed(2)),
			}),
		);
	}
});
