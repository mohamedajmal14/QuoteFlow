import { createApp } from "../apps/api/src/app";
import { PostgresQuoteStore } from "../apps/api/src/postgres-store";
import { MemoryQuoteStore } from "../apps/api/src/store";

const store = process.env.DATABASE_URL
  ? new PostgresQuoteStore()
  : new MemoryQuoteStore();

const app = createApp(store);

export default app;
