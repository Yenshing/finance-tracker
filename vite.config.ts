import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fetchQuote } from './src/services/prices/quoteHandler';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'quote-api',
      configureServer(server) {
        server.middlewares.use('/api/quote', async (req, res) => {
          try {
            const url = new URL(req.url ?? '', 'http://localhost');
            const symbol = url.searchParams.get('symbol') ?? '';
            const result = await fetchQuote(symbol);
            const status = 'error' in result ? result.status : 200;
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: (e as Error).message }));
          }
        });
      },
    },
  ],
});
