import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    plugins: [
        react(),
        viteStaticCopy({
            targets: [
                {
                    src: 'manifest.json',
                    dest: '.'
                },
                {
                    src: 'icon.png',
                    dest: '.',
                    rename: 'icon.png'
                },
                {
                    src: 'groq.js',
                    dest: 'assets'
                },
                {
                    src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
                    dest: 'assets',
                    rename: 'pdf.worker.min.js'
                }
            ]
        })
    ],
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                popup: resolve(__dirname, 'src/popup/index.html'),
                dashboard: resolve(__dirname, 'src/dashboard/index.html'),
                background: resolve(__dirname, 'src/background/index.js'),
                auto_log: resolve(__dirname, 'src/content/auto_log.js'),
                options: resolve(__dirname, 'options.html')
            },
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]'
            }
        }
    }
});
