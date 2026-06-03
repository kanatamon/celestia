import {
	CelestiaProvider,
	configureCelebrationSettingsStorage,
	configureSoundManagerStorage,
} from '@celestia/ui';
import 'antd/dist/reset.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
	createCelebrationSettingsStorage,
	createSoundManagerStorage,
	hydrateUserPreferences,
} from '../user-preferences/user-preferences.js';
import { SessionTab } from './session-tab.js';

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Celestia Session Tab root element was not found.');
}

const tiktokTabId = readTiktokTabId();

await hydrateUserPreferences();
configureSoundManagerStorage(await createSoundManagerStorage());
configureCelebrationSettingsStorage(await createCelebrationSettingsStorage());

createRoot(rootElement).render(
	<StrictMode>
		<CelestiaProvider>
			<SessionTab tiktokTabId={tiktokTabId} />
		</CelestiaProvider>
	</StrictMode>,
);

function readTiktokTabId(): number {
	const params = new URLSearchParams(window.location.search);
	return Number(params.get('tiktokTabId'));
}
