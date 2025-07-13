import invariant from 'tiny-invariant';

export function requireEnv(key: string): string {
	const value = process.env[key];
	invariant(value, `Environment variable ${key} is required`);
	return value;
}

export function optionalEnv(key: string): string | undefined {
	const value = process.env[key];
	if (value === undefined) {
		console.warn(`Environment variable ${key} is not set`);
	}
	return value;
}
