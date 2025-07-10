self.addEventListener('activate', (event) => {
	return self.clients.claim();
});
