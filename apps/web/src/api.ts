import { FollowUpInput, Overview, Quote, QuoteInput, QuoteUpdate } from "./types";
import { createDemoQuoteApi } from "./demo-api";

type ApiEnvelope<T> = { data: T };

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(body?.error ?? "The workspace could not complete that request.");
  }

  return body as T;
};

const remoteQuoteApi = {
  listQuotes: async (): Promise<Quote[]> => {
    const response = await request<ApiEnvelope<Quote[]>>("/api/quotes");
    return response.data;
  },

  getOverview: async (): Promise<Overview> => {
    const response = await request<ApiEnvelope<Overview>>("/api/analytics/overview");
    return response.data;
  },

  createQuote: async (input: QuoteInput): Promise<Quote> => {
    const response = await request<ApiEnvelope<Quote>>("/api/quotes", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return response.data;
  },

  updateQuote: async (id: string, input: QuoteUpdate): Promise<Quote> => {
    const response = await request<ApiEnvelope<Quote>>(`/api/quotes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
    return response.data;
  },

  addFollowUp: async (id: string, input: FollowUpInput): Promise<Quote> => {
    const response = await request<ApiEnvelope<Quote>>(`/api/quotes/${id}/follow-ups`, {
      method: "POST",
      body: JSON.stringify(input)
    });
    return response.data;
  }
};

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
const demoQuoteApi = isDemoMode ? createDemoQuoteApi() : null;

export const quoteApi = demoQuoteApi ?? remoteQuoteApi;

export const resetDemoWorkspace = () => {
  demoQuoteApi?.reset();
};
