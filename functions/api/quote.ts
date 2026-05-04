import { fetchQuote } from '../../src/services/prices/quoteHandler';

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol') ?? '';
  const result = await fetchQuote(symbol);
  const status = 'error' in result ? result.status : 200;
  return new Response(JSON.stringify(result), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
  });
};

type PagesFunction = (ctx: { request: Request }) => Promise<Response>;
