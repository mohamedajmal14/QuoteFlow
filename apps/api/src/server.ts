import "dotenv/config";
import { createApp } from "./app";
import { PostgresQuoteStore } from "./postgres-store";
import { MemoryQuoteStore } from "./store";

const port = Number(process.env.PORT ?? 3001);
const store = process.env.DATABASE_URL ? new PostgresQuoteStore() : new MemoryQuoteStore();
const app = createApp(store);

const server = app.listen(port, () => {
  console.log(`QuoteFlow API listening on http://localhost:${port} (${store.storageMode})`);
});

// Keep-alive: Ping /health every 30 seconds if running on Render or if KEEP_ALIVE_URL is configured
const keepAliveUrl = process.env.RENDER_EXTERNAL_URL || process.env.KEEP_ALIVE_URL;
let keepAliveTimer: NodeJS.Timeout | null = null;

if (keepAliveUrl) {
  const intervalMs = Number(process.env.KEEP_ALIVE_INTERVAL_MS ?? 30000);
  const targetUrl = `${keepAliveUrl.replace(/\/$/, "")}/health`;
  console.log(`[Keep-Alive] Ping enabled for ${targetUrl} every ${intervalMs / 1000}s`);

  keepAliveTimer = setInterval(async () => {
    try {
      const res = await fetch(targetUrl);
      console.log(`[Keep-Alive] Pinged ${targetUrl} - Status: ${res.status}`);
    } catch (error) {
      console.error(`[Keep-Alive] Ping failed:`, error instanceof Error ? error.message : error);
    }
  }, intervalMs);
}

const shutdown = async () => {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  server.close(async () => {
    if (store instanceof PostgresQuoteStore) await store.close();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
