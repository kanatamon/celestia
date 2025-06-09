/** @type {import("prettier").Options} */
export const config = {
	arrowParens: 'always',
	bracketSameLine: false,
	bracketSpacing: true,
	embeddedLanguageFormatting: 'auto',
	endOfLine: 'lf',
	htmlWhitespaceSensitivity: 'css',
	insertPragma: false,
	jsxSingleQuote: false,
	printWidth: 80,
	proseWrap: 'always',
	quoteProps: 'as-needed',
	requirePragma: false,
	semi: true,
	singleAttributePerLine: false,
	singleQuote: true,
	tabWidth: 2,
	trailingComma: 'all',
	useTabs: true,
	overrides: [
		// formatting the package.json with anything other than spaces will cause
		// issues when running install...
		{
			files: ['**/package.json'],
			options: {
				useTabs: false,
			},
		},
	],
	plugins: ['@ianvs/prettier-plugin-sort-imports'],
	importOrder: [
		'',
		'<TYPES>^(node:)',
		'<TYPES>',
		'<TYPES>^~/(.*)$',
		'<TYPES>^../(.*)$',
		'<TYPES>^[./]',
		'<BUILTIN_MODULES>',
		'<THIRD_PARTY_MODULES>',
		'^~/(.*)$',
		'^../(.*)$',
		'^[./]',
		'',
	],
};

// this is for backward compatibility
export default config;
