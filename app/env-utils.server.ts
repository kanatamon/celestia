import invariant from 'tiny-invariant';

export function requireEnv(key: string): string {
	const value = process.env[key];
	invariant(value, `Environment variable ${key} is required`);
	return value;
}
