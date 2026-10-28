import { createServer } from 'node:http';
import { handler } from './app.mjs';

export function createApp() {
  return createServer(handler);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => {
    console.log(`listening on ${port}`);
  });
}
