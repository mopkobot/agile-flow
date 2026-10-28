export function greet(name) {
  const clean = String(name ?? '').trim();
  if (clean.length === 0) throw new Error('name is required');
  if (clean.length > 40) throw new Error('name is too long');
  return `Hello, ${clean}!`;
}

export function handler(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (req.method !== 'GET' || url.pathname !== '/greet') {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }
  try {
    const body = { message: greet(url.searchParams.get('name')) };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}
