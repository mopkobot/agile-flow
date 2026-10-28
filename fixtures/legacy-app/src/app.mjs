// Legacy module: the name rule lives in two places with different limits.
// `greet` rejects over 40 characters; `handler` rejects over 50. That is a
// duplicated business rule with a divergence risk. No test covers either limit.

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

  const raw = url.searchParams.get('name');
  const name = String(raw ?? '').trim();
  if (name.length === 0) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'name is required' }));
    return;
  }
  if (name.length > 50) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'name is too long' }));
    return;
  }

  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ message: `Hello, ${name}!` }));
}
