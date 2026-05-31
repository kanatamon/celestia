import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Launcher } from './launcher.js';

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Celestia Launcher root element was not found.');
}

createRoot(rootElement).render(
	<StrictMode>
		<Launcher />
	</StrictMode>,
);
