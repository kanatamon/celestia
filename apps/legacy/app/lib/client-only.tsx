import { useEffect, useState } from 'react';

interface ClientOnlyProps {
	children: React.ReactNode;
	loading?: React.ReactNode;
	skipHydration?: boolean;
}

/**
 * ClientOnly component prevents SSR rendering and only renders content on the client
 * Useful for components that use browser-only APIs or third-party libraries
 */
export const ClientOnly: React.FC<ClientOnlyProps> = ({
	children,
	loading = null,
	skipHydration = false,
}) => {
	const [hasMounted, setHasMounted] = useState(false);

	useEffect(() => {
		setHasMounted(true);
	}, []);

	// During SSR or before hydration, show fallback
	if (!hasMounted) {
		return <>{loading}</>;
	}

	// Skip hydration if requested (useful for dynamic content)
	if (skipHydration) {
		return <div suppressHydrationWarning>{children}</div>;
	}

	return <>{children}</>;
};
