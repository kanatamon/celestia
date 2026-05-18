import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
	CelestiaProvider,
	celestiaSemanticTokenCssVariables,
	celestiaSemanticTokens,
	celestiaThemeConfig,
} from '../src/index.js';

describe('CelestiaProvider', () => {
	it('exposes the dark Ant Design theme and Celestia semantic CSS variables', () => {
		expect(celestiaThemeConfig.cssVar).toEqual({
			prefix: 'ant',
			key: 'celestia',
		});
		expect(celestiaThemeConfig.algorithm).toBeDefined();
		expect(celestiaSemanticTokens.colorGiftGold).toBe('rgba(255, 223, 0, 0.95)');
		expect(celestiaSemanticTokens.colorJoinBlue).toBe('rgba(59, 130, 246, 0.95)');
		expect(celestiaSemanticTokens.colorGlassBg).toBe('rgba(0, 0, 0, 0.5)');
		expect(celestiaSemanticTokens.colorPinnedGradient).toContain('#6366f1');
		expect(celestiaSemanticTokenCssVariables['--celestia-color-gift-gold']).toBe(
			celestiaSemanticTokens.colorGiftGold,
		);

		const html = renderToString(
			<CelestiaProvider>
				<section>Side Panel</section>
			</CelestiaProvider>,
		);

		expect(html).toContain('Side Panel');
		expect(html).toContain('--celestia-color-gift-gold');
		expect(html).toContain('--celestia-color-pinned-gradient');
	});
});
