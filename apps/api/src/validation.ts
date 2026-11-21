import { z } from "zod";
import { followUpTypes, quoteStages } from "./types";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD for dates.");

export const createQuoteSchema = z.object({
  client: z.string().trim().min(2, "Client needs at least 2 characters."),
  contact: z.string().trim().min(2, "Contact needs at least 2 characters."),
  owner: z.string().trim().min(2, "Owner needs at least 2 characters."),
  service: z.string().trim().min(3, "Describe the proposed service."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  stage: z.enum(quoteStages).default("discovery"),
  probability: z.coerce.number().min(0).max(100).default(20),
  expectedCloseDate: dateString,
  nextAction: z.string().trim().min(3, "Add a clear next action."),
  tags: z.array(z.string().trim().min(1)).max(8).default([])
});

export const updateQuoteSchema = createQuoteSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export const createFollowUpSchema = z.object({
  type: z.enum(followUpTypes),
  dueDate: dateString,
  note: z.string().trim().min(3, "Add a meaningful follow-up note.")
});
