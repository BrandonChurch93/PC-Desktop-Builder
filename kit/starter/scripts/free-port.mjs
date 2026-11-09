// Prints the first free port from 5311 to 5319. Used by playwright.config.ts.
import net from 'node:net';

function free(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '127.0.0.1');
  });
}

for (let port = 5311; port <= 5319; port++) {
  if (await free(port)) { console.log(port); process.exit(0); }
}
console.error('no free port between 5311 and 5319');
process.exit(1);
