import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    server: {
        proxy: {
            // Optional: run python_classifier/service.py on 8765, then set
            // pythonClassifierUrl to http://localhost:5173/appli-classifier in extension options (or sync storage).
            '/appli-classifier': {
                target: 'http://127.0.0.1:8765',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/appli-classifier/, ''),
                timeout: 120_000,
                proxyTimeout: 120_000
            },
            // LocalLLM chat (Deep Scan, interview sim): pytorch_chat_server on :8000 (CPU gen can be slow)
            '/appli-llm': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/appli-llm/, ''),
                timeout: 660_000,
                proxyTimeout: 660_000
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
                    src: 'manifest.json',
                    dest: '.'
                },
                {
                    src: 'icon.png',
                    dest: '.',
                    rename: 'icon.png'
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
                home: resolve(__dirname, 'src/home/index.html'),
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
