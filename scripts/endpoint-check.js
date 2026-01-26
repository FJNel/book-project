const endpoints = [
	{ method: 'GET', path: '/' },
	{ method: 'POST', path: '/book/list', body: { limit: 5, offset: 0, view: 'card', sortBy: 'title', order: 'asc' } },
	{ method: 'GET', path: '/tags' }
];

const baseUrl = process.env.API_BASE_URL || 'http://localhost:4000';

async function run() {
	let failed = 0;
	for (const endpoint of endpoints) {
		const url = new URL(endpoint.path, baseUrl);
		const options = {
			method: endpoint.method,
			headers: { 'Content-Type': 'application/json' }
		};
		if (endpoint.body) {
			options.body = JSON.stringify(endpoint.body);
		}
		try {
			const response = await fetch(url.href, options);
			const ok = response.ok;
			if (!ok) {
				failed += 1;
			}
			const correlationId = response.headers.get('x-correlation-id') || 'n/a';
			console.log(`${endpoint.method} ${endpoint.path} -> ${response.status} (correlationId=${correlationId})`);
		} catch (error) {
			failed += 1;
			console.error(`${endpoint.method} ${endpoint.path} -> failed: ${error.message}`);
		}
	}

	if (failed > 0) {
		console.error(`\nEndpoint check failed (${failed} failing).`);
		process.exit(1);
	}

	console.log('\nEndpoint check passed.');
}

run().catch((error) => {
	console.error('Endpoint check failed:', error.message);
	process.exit(1);
});
