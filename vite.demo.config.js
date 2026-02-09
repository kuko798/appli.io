import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist-demo',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'demo.html')
            }
        }
    }
});
