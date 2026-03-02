import { defineConfig } from 'eslint/config';
import shared from '@zenfs/core/eslint';

export default defineConfig(
	...shared,
	{
		files: ['src/**/*.ts'],
		name: 'Enable typed checking',
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		files: ['src/bin/*.ts'],
		name: 'Core utils',
		rules: {
			'@typescript-eslint/only-throw-error': 'off',
		},
	}
);
