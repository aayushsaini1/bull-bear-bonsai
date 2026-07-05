export const config = {
  runtime: 'edge', // Run on Vercel's Edge network for sub-millisecond cold starts
};

export default async function handler(request: Request) {
  const url = new URL(request.url);
  
  // Extract path and query parameters
  // Client makes request to: /api/yahoo/v8/finance/chart/^NSEI?range=1y&interval=1d
  // We rewrite and target: https://query1.finance.yahoo.com/v8/finance/chart/^NSEI?range=1y&interval=1d
  const targetPath = url.pathname.replace(/^\/api\/yahoo/, '');
  const searchParams = url.search;
  
  const targetUrl = `https://query1.finance.yahoo.com${targetPath}${searchParams}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com/'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `Yahoo API responded with status ${response.status}`, details: errorText }), 
        {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: 'Serverless proxy failed to fetch Yahoo Finance', details: error.message }), 
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}
