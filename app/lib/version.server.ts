import { execSync } from 'child_process';
import packageJson from '../../package.json';
import { optionalEnv } from './env-utils.server';

function getGitInfo() {
	try {
		return {
			commit: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
			shortCommit: execSync('git rev-parse --short HEAD', {
				encoding: 'utf8',
			}).trim(),
			branch: execSync('git rev-parse --abbrev-ref HEAD', {
				encoding: 'utf8',
			}).trim(),
			commitMessage: execSync('git log -1 --pretty=%B', {
				encoding: 'utf8',
			}).trim(),
			author: execSync('git log -1 --pretty=format:%an', {
				encoding: 'utf8',
			}).trim(),
		};
	} catch (error) {
		return {
			commit: 'unknown',
			shortCommit: 'unknown',
			branch: 'unknown',
			commitMessage: 'unknown',
			author: 'unknown',
		};
	}
}

function getBuildNumber() {
	const railwayDeploymentId = optionalEnv('RAILWAY_DEPLOYMENT_ID');
	const railwayEnvironment = optionalEnv('RAILWAY_ENVIRONMENT_NAME');

	if (railwayDeploymentId) {
		const shortId = railwayDeploymentId.slice(0, 8);
		return railwayEnvironment ? `${railwayEnvironment}-${shortId}` : shortId;
	}

	// Fallback for local development
	const timestamp = Date.now();
	const gitInfo = getGitInfo();
	return `local-${timestamp}-${gitInfo.shortCommit}`;
}

export function getVersionInfo() {
	const gitInfo = getGitInfo();

	return {
		version: packageJson.version,
		buildNumber: getBuildNumber(),
		environment: optionalEnv('NODE_ENV') || 'development',
		git: {
			commit: gitInfo.commit,
			shortCommit: gitInfo.shortCommit,
			branch: gitInfo.branch,
			message: gitInfo.commitMessage,
			author: gitInfo.author,
		},
	};
}
