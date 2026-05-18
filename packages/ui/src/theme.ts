import { type ThemeConfig, theme } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

export interface CelestiaSemanticTokens {
	colorGiftGold: string;
	colorGiftGoldBg: string;
	colorGiftGoldBorder: string;
	colorJoinBlue: string;
	colorJoinBlueBg: string;
	colorJoinBlueBorder: string;
	colorGlassBg: string;
	colorPinnedGradient: string;
}

export interface CelestiaProviderProps {
	children: ReactNode;
	className?: string;
}

export type CelestiaSemanticTokenCssVariables = CSSProperties &
	Record<`--celestia-${string}`, string>;

export const celestiaSemanticTokens = {
	colorGiftGold: 'rgba(255, 223, 0, 0.95)',
	colorGiftGoldBg: 'rgba(255, 223, 0, 0.16)',
	colorGiftGoldBorder: 'rgba(255, 223, 0, 0.38)',
	colorJoinBlue: 'rgba(59, 130, 246, 0.95)',
	colorJoinBlueBg: 'rgba(59, 130, 246, 0.16)',
	colorJoinBlueBorder: 'rgba(59, 130, 246, 0.38)',
	colorGlassBg: 'rgba(0, 0, 0, 0.5)',
	colorPinnedGradient: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899, transparent)',
} as const satisfies CelestiaSemanticTokens;

export const celestiaThemeConfig: ThemeConfig = {
	algorithm: theme.darkAlgorithm,
	cssVar: {
		prefix: 'ant',
		key: 'celestia',
	},
	token: {
		colorPrimary: '#8b5cf6',
		colorInfo: '#3b82f6',
		colorBgBase: '#050507',
		colorTextBase: '#f8fafc',
		borderRadius: 8,
	},
};

export const celestiaSemanticTokenCssVariables: CelestiaSemanticTokenCssVariables = {
	'--celestia-color-gift-gold': celestiaSemanticTokens.colorGiftGold,
	'--celestia-color-gift-gold-bg': celestiaSemanticTokens.colorGiftGoldBg,
	'--celestia-color-gift-gold-border': celestiaSemanticTokens.colorGiftGoldBorder,
	'--celestia-color-join-blue': celestiaSemanticTokens.colorJoinBlue,
	'--celestia-color-join-blue-bg': celestiaSemanticTokens.colorJoinBlueBg,
	'--celestia-color-join-blue-border': celestiaSemanticTokens.colorJoinBlueBorder,
	'--celestia-color-glass-bg': celestiaSemanticTokens.colorGlassBg,
	'--celestia-color-pinned-gradient': celestiaSemanticTokens.colorPinnedGradient,
};
