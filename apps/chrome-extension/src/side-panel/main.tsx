import { CelestiaProvider, configureSoundManagerStorage } from '@celestia/ui';
import 'antd/dist/reset.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
	createSoundManagerStorage,
	hydrateUserPreferences,
} from '../user-preferences/user-preferences.js';
import { SidePanel } from './side-panel.js';

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Celestia Side Panel root element was not found.');
}

await hydrateUserPreferences();
configureSoundManagerStorage(await createSoundManagerStorage());

createRoot(rootElement).render(
	<StrictMode>
		<CelestiaProvider>
			<SidePanel />
		</CelestiaProvider>
	</StrictMode>,
);
