import { CelestiaProvider } from '@celestia/ui';
import 'antd/dist/reset.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SidePanel } from './side-panel.js';

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Celestia Side Panel root element was not found.');
}

createRoot(rootElement).render(
	<StrictMode>
		<CelestiaProvider>
			<SidePanel />
		</CelestiaProvider>
	</StrictMode>,
);
