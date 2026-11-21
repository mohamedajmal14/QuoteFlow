import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { createAnalyticsRouter } from "./routes/analytics";
import { createLeadsRouter } from "./routes/leads";
import { createQuotesRouter } from "./routes/quotes";
import { MemoryQuoteStore, QuoteStore } from "./store";

export const createApp = (store: QuoteStore = new MemoryQuoteStore()) => {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "100kb" }));

  const handleHealth = async (_request: Request, response: Response) => {
    try {
      await store.checkHealth();
      return response.json({
        status: "ok",
        service: "quote-flow-api",
        storage: store.storageMode
      });
    } catch {
      return response.status(503).json({
        status: "unavailable",
        service: "quote-flow-api",
        storage: store.storageMode
      });
    }
  };

  app.get("/health", handleHealth);
  app.get("/api/health", handleHealth);

  app.use("/api/quotes", createQuotesRouter(store));
  app.use("/api/analytics", createAnalyticsRouter(store));
  app.use("/api/leads", createLeadsRouter(store));

  app.use((_request: Request, response: Response) => {
    return response.status(404).json({ error: "Route not found." });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    console.error(error);
    return response.status(500).json({ error: "Unexpected server error." });
  });

  return app;
};
