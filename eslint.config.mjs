import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const baseConfig = await generateEslintConfig({})

export default [
	...baseConfig,
	{
		// The module sources use the .js extension but are ESM (package.json "type": "module").
		// The shared config defaults to sourceType 'commonjs', so enable module parsing globally.
		languageOptions: {
			sourceType: 'module',
		},
	},
]
