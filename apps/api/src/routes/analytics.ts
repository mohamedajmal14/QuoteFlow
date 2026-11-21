import { Request, Response, Router } from "express";
import { QuoteStore } from "../store";

export const createAnalyticsRouter = (store: QuoteStore) => {
  const router = Router();

  router.get("/overview", async (_request: Request, response: Response) => {
    return response.json({ data: await store.analytics() });
  });

  return router;
};
