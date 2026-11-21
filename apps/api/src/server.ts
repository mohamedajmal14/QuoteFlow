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

const shutdown = async () => {
  server.close(async () => {
    if (store instanceof PostgresQuoteStore) await store.close();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
