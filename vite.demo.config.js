import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    base: './',
    plugins: [
        react(),
        viteStaticCopy({
            targets: [
                {
                    src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
                    dest: 'assets',
                    rename: 'pdf.worker.min.js'
                },
                {
                    src: 'icon.png',
                    dest: '.',
                    rename: 'icon.png'
                }
            ]
        })
    ],
    build: {
        outDir: 'dist-demo',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'demo.html')
            }
        }
    }
});
