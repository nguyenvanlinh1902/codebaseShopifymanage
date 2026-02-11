import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';
import {fileURLToPath} from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isEmbed = process.env.IS_EMBEDDED_APP === 'yes';
const templateOutFile = isEmbed ? 'embed.html' : 'index.html';

// Load env from functions/.env for SHOPIFY_API_KEY
dotenv.config({path: path.resolve(__dirname, '../functions/.env')});

const shopifyApiKey = process.env.SHOPIFY_API_KEY || '';

console.log('Build mode:', isEmbed ? 'embedded' : 'standalone', '| Template:', templateOutFile);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'shopify-api-key-html',
      transformIndexHtml(html) {
        return html.replace(/\{\{SHOPIFY_API_KEY\}\}/g, shopifyApiKey);
      }
    },
    {
      name: 'embed-spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          const isHtml = req.headers.accept?.includes('text/html');

          // Redirect /?embedded=1 to /embed so embed.html is served
          if (isHtml && !url.startsWith('/embed') && url.includes('embedded=1')) {
            res.writeHead(302, {Location: '/embed' + (url.startsWith('/') ? url.slice(1) : url)});
            res.end();
            return;
          }

          // SPA fallback: route /embed/** to embed.html
          if (isHtml && url.startsWith('/embed') && !url.includes('.')) {
            req.url = '/embed.html';
          }
          next();
        });
      }
    }
  ],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: []
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx'
      }
    }
  },
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@assets': path.resolve(__dirname, './src'),
      react: path.resolve(__dirname, '../../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../../node_modules/react-dom')
    },
    dedupe: ['react', 'react-dom']
  },
  build: {
    outDir: '../../static',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, templateOutFile)
      }
    }
  }
});
