import { ConfigProvider } from 'antd';
import styles from './provider.module.css';
import {
	type CelestiaProviderProps,
	celestiaSemanticTokenCssVariables,
	celestiaThemeConfig,
} from './theme.js';

export function CelestiaProvider({ children, className }: CelestiaProviderProps) {
	const providerClassName = className ? `${styles.provider} ${className}` : styles.provider;

	return (
		<ConfigProvider theme={celestiaThemeConfig}>
			<div className={providerClassName} style={celestiaSemanticTokenCssVariables}>
				{children}
			</div>
		</ConfigProvider>
	);
}
