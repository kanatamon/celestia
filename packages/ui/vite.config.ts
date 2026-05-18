import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [react()],
	build: {
		lib: {
			entry: 'src/index.ts',
			formats: ['es'],
			fileName: () => 'index.js',
		},
		rollupOptions: {
			external: ['@ant-design/icons', 'antd', 'react', 'react-dom', 'react/jsx-runtime'],
			output: {
				assetFileNames: 'styles.css',
			},
		},
	},
	test: {
		environment: 'jsdom',
		include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
	},
});
