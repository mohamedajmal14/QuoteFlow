import { NextFunction, Request, Response, Router } from "express";
import { ZodError } from "zod";
import { QuoteStore } from "../store";
import { QuoteStage, quoteStages } from "../types";
import { createFollowUpSchema, createQuoteSchema, updateQuoteSchema } from "../validation";

const queryValue = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const routeParam = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;

const sendValidationError = (response: Response, error: ZodError) =>
  response.status(422).json({
    error: "Validation failed.",
    details: error.flatten()
  });

const validStage = (value: string | undefined): value is QuoteStage =>
  Boolean(value && quoteStages.includes(value as QuoteStage));

export const createQuotesRouter = (store: QuoteStore) => {
  const router = Router();

  router.get("/", async (request: Request, response: Response) => {
    const stage = queryValue(request.query.stage);
    if (stage && !validStage(stage)) {
      return response.status(400).json({ error: `Unknown stage. Use one of: ${quoteStages.join(", ")}.` });
    }

    const quotes = await store.list({
      stage: validStage(stage) ? stage : undefined,
      owner: queryValue(request.query.owner),
      search: queryValue(request.query.search)
    });

    return response.json({
      data: quotes,
      meta: {
        total: quotes.length,
        storage: store.storageMode
      }
    });
  });

  router.post("/", async (request: Request, response: Response, next: NextFunction) => {
    try {
      const quote = await store.create(createQuoteSchema.parse(request.body));
      return response.status(201).json({ data: quote });
    } catch (error) {
      if (error instanceof ZodError) return sendValidationError(response, error);
      return next(error);
    }
  });

  router.post("/:id/follow-ups", async (request: Request, response: Response, next: NextFunction) => {
    try {
      const id = routeParam(request.params.id);
      if (!id) return response.status(400).json({ error: "Quote id is required." });
      const quote = await store.addFollowUp(id, createFollowUpSchema.parse(request.body));
      if (!quote) return response.status(404).json({ error: "Quote not found." });
      return response.status(201).json({ data: quote });
    } catch (error) {
      if (error instanceof ZodError) return sendValidationError(response, error);
      return next(error);
    }
  });

  router.get("/:id", async (request: Request, response: Response) => {
    const id = routeParam(request.params.id);
    if (!id) return response.status(400).json({ error: "Quote id is required." });
    const quote = await store.get(id);
    if (!quote) return response.status(404).json({ error: "Quote not found." });
    return response.json({ data: quote });
  });

  router.patch("/:id", async (request: Request, response: Response, next: NextFunction) => {
    try {
      const id = routeParam(request.params.id);
      if (!id) return response.status(400).json({ error: "Quote id is required." });
      const quote = await store.update(id, updateQuoteSchema.parse(request.body));
      if (!quote) return response.status(404).json({ error: "Quote not found." });
      return response.json({ data: quote });
    } catch (error) {
      if (error instanceof ZodError) return sendValidationError(response, error);
      return next(error);
    }
  });

  router.delete("/:id", async (request: Request, response: Response) => {
    const id = routeParam(request.params.id);
    if (!id) return response.status(400).json({ error: "Quote id is required." });
    const removed = await store.remove(id);
    if (!removed) return response.status(404).json({ error: "Quote not found." });
    return response.status(204).send();
  });

  return router;
};
