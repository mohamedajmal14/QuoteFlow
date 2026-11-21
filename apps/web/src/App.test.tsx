import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Overview, Quote } from "./types";

const apiMocks = vi.hoisted(() => ({
  listQuotes: vi.fn(),
  getOverview: vi.fn(),
  createQuote: vi.fn(),
  updateQuote: vi.fn(),
  addFollowUp: vi.fn(),
  resetDemoWorkspace: vi.fn()
}));

vi.mock("./api", () => ({
  isDemoMode: true,
  quoteApi: {
    listQuotes: apiMocks.listQuotes,
    getOverview: apiMocks.getOverview,
    createQuote: apiMocks.createQuote,
    updateQuote: apiMocks.updateQuote,
    addFollowUp: apiMocks.addFollowUp
  },
  resetDemoWorkspace: apiMocks.resetDemoWorkspace
}));

import App from "./App";

const quote = (overrides: Partial<Quote> = {}): Quote => ({
  id: "quote-aurelia",
  number: "QF-DEMO-014",
  client: "Aurelia Retail",
  contact: "Mariana Torres",
  owner: "Mohamed Ajmal",
  service: "Customer portal",
  amount: 12800,
  currency: "USD",
  stage: "proposal",
  probability: 55,
  expectedCloseDate: "2026-07-20",
  createdAt: "2026-07-01T12:00:00.000Z",
  updatedAt: "2026-07-10T12:00:00.000Z",
  lastActivityAt: "2026-07-10T12:00:00.000Z",
  nextAction: "Review the scope.",
  tags: ["web"],
  health: "on-track",
  followUps: [],
  ...overrides
});

const overview = (quotes: Quote[]): Overview => ({
  metrics: {
    activeQuotes: quotes.filter((item) => !["won", "lost"].includes(item.stage)).length,
    pipelineValue: quotes.reduce((total, item) => total + item.amount, 0),
    weightedValue: quotes.reduce((total, item) => total + item.amount * (item.probability / 100), 0),
    wonValue: 0,
    atRiskCount: quotes.filter((item) => item.health === "at-risk").length
  },
  pipeline: ["discovery", "proposal", "negotiation", "won", "lost"].map((stage) => ({
    stage: stage as Quote["stage"],
    count: quotes.filter((item) => item.stage === stage).length,
    value: quotes.filter((item) => item.stage === stage).reduce((total, item) => total + item.amount, 0)
  })),
  atRisk: quotes.filter((item) => item.health === "at-risk"),
  upcomingFollowUps: []
});

describe("QuoteFlow dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const initial = [
      quote(),
      quote({
        id: "quote-nexo",
        number: "QF-DEMO-013",
        client: "Nexo Cargo",
        service: "Delivery tracking",
        stage: "negotiation",
        health: "at-risk"
      })
    ];
    apiMocks.listQuotes.mockResolvedValue(initial);
    apiMocks.getOverview.mockResolvedValue(overview(initial));
  });

  it("loads the pipeline, labels the demo honestly and filters by search", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText("Aurelia Retail")).toBeInTheDocument();
    expect(screen.getByText("Interactive portfolio demo")).toBeInTheDocument();
    expect(screen.getByText(/no production backend is connected/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search client or service"), "Nexo");

    expect(screen.queryByText("Aurelia Retail")).not.toBeInTheDocument();
    expect(screen.getAllByText("Nexo Cargo").length).toBeGreaterThan(0);
  });

  it("submits a new quote and refreshes the visible workspace", async () => {
    const user = userEvent.setup();
    const created = quote({ id: "quote-new", number: "QF-DEMO-015", client: "Andes Foods", amount: 7500 });
    apiMocks.createQuote.mockResolvedValue(created);
    apiMocks.listQuotes.mockResolvedValueOnce([quote()]).mockResolvedValueOnce([created, quote()]);
    apiMocks.getOverview.mockResolvedValueOnce(overview([quote()])).mockResolvedValueOnce(overview([created, quote()]));

    render(<App />);
    await screen.findByText("Aurelia Retail");
    await user.click(screen.getByRole("button", { name: /new quote/i }));
    await user.type(screen.getByLabelText("Client"), "Andes Foods");
    await user.type(screen.getByLabelText("Main contact"), "Elena Ruiz");
    await user.type(screen.getByLabelText("Proposed service"), "Ordering portal");
    await user.clear(screen.getByLabelText("Quote value (USD)"));
    await user.type(screen.getByLabelText("Quote value (USD)"), "7500");
    await user.click(screen.getByRole("button", { name: "Add to pipeline" }));

    await waitFor(() => expect(apiMocks.createQuote).toHaveBeenCalledWith(expect.objectContaining({
      client: "Andes Foods",
      contact: "Elena Ruiz",
      service: "Ordering portal",
      amount: 7500,
      tags: ["web", "workflow"]
    })));
    expect(await screen.findByText("QF-DEMO-015 was added to the pipeline.")).toBeInTheDocument();
    expect(screen.getAllByText("Andes Foods").length).toBeGreaterThan(0);
  });

  it("restores the browser sample on request", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Aurelia Retail");

    await user.click(screen.getByRole("button", { name: "Restore sample data" }));

    expect(apiMocks.resetDemoWorkspace).toHaveBeenCalledOnce();
    await waitFor(() => expect(apiMocks.listQuotes).toHaveBeenCalledTimes(2));
    expect(screen.getByText("The browser demo was restored to its sample workspace.")).toBeInTheDocument();
  });
});
