function isViteDevelopment() {
	return (
		self.location.port === '5173' || // Vite default port
		self.location.hostname === 'localhost' || // Local development
		self.location.protocol === 'http:'
	); // Dev usually HTTP
}

self.addEventListener('install', (event) => {
	console.log('📦 Installing...');
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	console.log('🚀 Activating...');
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	// Skip service worker entirely during development
	if (isViteDevelopment()) {
		return; // Let requests go directly to dev server
	}

	// Only handle GET requests from same origin
	if (
		event.request.method !== 'GET' ||
		!event.request.url.startsWith(self.location.origin)
	) {
		return; // Let browser handle it normally
	}

	// Production: Handle with proper error handling
	event.respondWith(
		fetch(event.request)
			.then((response) => {
				console.log('✅ Fetch successful:', event.request.url);
				return response;
			})
			.catch((error) => {
				console.error('❌ Fetch failed:', event.request.url, error);

				// Provide appropriate fallback
				if (event.request.mode === 'navigate') {
					// For page navigation, try to serve cached page or offline page
					return (
						caches.match('/') ||
						new Response('App offline', {
							status: 503,
							headers: { 'Content-Type': 'text/html' },
						})
					);
				} else {
					// For other resources, return error response
					return new Response('Resource unavailable', {
						status: 503,
						statusText: 'Service Unavailable',
					});
				}
			}),
	);
});

console.log('🎯 Service Worker ready (development-safe)');
