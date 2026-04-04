import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    server: {
        proxy: {
            // python_classifier/service.py on 8765 → same-origin /appli-classifier in dev (see localLLM / web shim defaults).
            '/appli-classifier': {
                target: 'http://127.0.0.1:8765',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/appli-classifier/, ''),
                timeout: 120_000,
                proxyTimeout: 120_000
            },
            // LocalLLM chat: CPU + large max_tokens (e.g. resume) can run 20–30+ min — must exceed fetch AbortController in localLLM.js
            '/appli-llm': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/appli-llm/, ''),
                timeout: 1_800_000,
                proxyTimeout: 1_800_000
            },
            '/appli-company-intel': {
                target: 'http://127.0.0.1:8780',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/appli-company-intel/, ''),
                timeout: 660_000,
                proxyTimeout: 660_000
            }
        }
    },
    plugins: [
        react(),
        viteStaticCopy({
            targets: [
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
                home: resolve(__dirname, 'src/home/index.html'),
                dashboard: resolve(__dirname, 'src/dashboard/index.html')
            },
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]'
            }
        }
    }
});
