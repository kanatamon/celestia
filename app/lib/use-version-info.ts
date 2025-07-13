import type { loader as rootLoader } from '~/root';
import { useRouteLoaderData } from 'react-router';
import invariant from 'tiny-invariant';

export function useVersionInfo() {
	const rootData = useRouteLoaderData<typeof rootLoader>('root');
	invariant(
		rootData,
		`Root data is required to access version info, please ensure the root loader is defined correctly.`,
	);
	return rootData.versionInfo;
}
