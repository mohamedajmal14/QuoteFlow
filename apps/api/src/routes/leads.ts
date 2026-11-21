import { Request, Response, Router } from "express";
import { QuoteStore } from "../store";

export const createLeadsRouter = (store: QuoteStore) => {
  const router = Router();

  router.get("/", async (_request: Request, response: Response) => {
    const leads = await store.leads();
    return response.json({ data: leads, meta: { total: leads.length } });
  });

  return router;
};
