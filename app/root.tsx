import '@ant-design/v5-patch-for-react-19';

import type { Route } from './+types/root';
import * as Sentry from '@sentry/react-router';
import { ConfigProvider, theme } from 'antd';
import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from 'react-router';
import appStyleSheet from './app.css?url';
import { getDefaultStyles } from './components/_ui/glass-modal';

export const links: Route.LinksFunction = () => [
	{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
	{
		rel: 'preconnect',
		href: 'https://fonts.gstatic.com',
		crossOrigin: 'anonymous',
	},
	{
		rel: 'stylesheet',
		href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
	},
	{
		rel: 'stylesheet',
		href: appStyleSheet,
	},
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return (
		<ConfigProvider
			theme={{
				token: {
					colorPrimary: '#a78bfa',
					colorBgElevated: 'rgba(255, 255, 255, 0.2)',
				},
				algorithm: theme.darkAlgorithm,
			}}
			typography={{
				style: {
					margin: 0,
				},
			}}
			drawer={{
				closable: false,
				styles: {
					content: {
						backdropFilter: 'blur(25px)',
					},
				},
			}}
			rangePicker={{
				style: {
					background: 'rgba(255, 255, 255, 0.2)',
					backdropFilter: 'blur(10px)',
					border: '1px solid rgba(255, 255, 255, 0.3)',
					color: 'rgba(255, 255, 255, 0.95)',
				},
			}}
			menu={{
				style: {
					padding: 0,
					background: `rgba(255, 255, 255, 0.1)`,
					backdropFilter: 'blur(10px)',
					borderRadius: '8px',
					boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
					border: 0,
				},
			}}
			popover={{
				styles: {
					body: {
						backgroundColor: 'rgba(0, 0, 0, 0.8)',
						backdropFilter: 'blur(5px)',
						fontSize: '14px',
						padding: '8px',
					},
					root: {
						'--antd-arrow-background-color': 'rgba(0, 0, 0, 0.8)',
					} as React.CSSProperties,
				},
			}}
			modal={{
				closable: false,
				styles: getDefaultStyles(),
			}}
		>
			<Outlet />
		</ConfigProvider>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = 'Oops!';
	let details = 'An unexpected error occurred.';
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? '404' : 'Error';
		details =
			error.status === 404
				? 'The requested page could not be found.'
				: error.statusText || details;
	} else if (error && error instanceof Error) {
		Sentry.captureException(error);
		if (import.meta.env.DEV) {
			details = error.message;
			stack = error.stack;
		}
	}

	if (error instanceof Error) {
		message = 'Error';
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="pt-16 p-4 container mx-auto">
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className="w-full p-4 overflow-x-auto">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
