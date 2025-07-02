import { useEffect, useState } from 'react';

interface ClientOnlyProps {
	children: React.ReactNode;
	fallback?: React.ReactNode;
	loading?: React.ReactNode;
	skipHydration?: boolean;
}

/**
 * ClientOnly component prevents SSR rendering and only renders content on the client
 * Useful for components that use browser-only APIs or third-party libraries
 */
export const ClientOnly: React.FC<ClientOnlyProps> = ({
	children,
	fallback = null,
	loading = <div>Loading...</div>,
	skipHydration = false,
}) => {
	const [hasMounted, setHasMounted] = useState(false);

	useEffect(() => {
		setHasMounted(true);
	}, []);

	// During SSR or before hydration, show fallback
	if (!hasMounted) {
		return <>{fallback || loading}</>;
	}

	// Skip hydration if requested (useful for dynamic content)
	if (skipHydration) {
		return <div suppressHydrationWarning>{children}</div>;
	}

	return <>{children}</>;
};
