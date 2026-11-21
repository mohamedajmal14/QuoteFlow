import { describe, expect, it } from "vitest";
import { createDemoQuoteApi } from "./demo-api";

const fixedNow = new Date("2026-07-11T12:00:00.000Z");

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
};

describe("interactive demo API", () => {
  it("starts with a coherent sample pipeline and analytics", async () => {
    const api = createDemoQuoteApi({ storage: createStorage(), now: () => fixedNow });

    const quotes = await api.listQuotes();
    const overview = await api.getOverview();

    expect(quotes).toHaveLength(5);
    expect(overview.metrics).toEqual({
      activeQuotes: 4,
      pipelineValue: 51500,
      weightedValue: 26550,
      wonValue: 18000,
      atRiskCount: 1
    });
    expect(overview.atRisk.map((quote) => quote.client)).toEqual(["Nexo Cargo"]);
  });

  it("persists created quotes for the next browser session", async () => {
    const storage = createStorage();
    const api = createDemoQuoteApi({ storage, now: () => fixedNow });

    const created = await api.createQuote({
      client: "Andes Foods",
      contact: "Elena Ruiz",
      owner: "Mohamed Ajmal",
      service: "Ordering portal",
      amount: 7200,
      stage: "discovery",
      probability: 30,
      expectedCloseDate: "2026-08-01",
      nextAction: "Review the delivery scope.",
      tags: ["react", "node"]
    });

    const restoredApi = createDemoQuoteApi({ storage, now: () => fixedNow });
    const restored = await restoredApi.listQuotes();

    expect(created.number).toBe("QF-DEMO-015");
    expect(restored).toHaveLength(6);
    expect(restored[0]).toMatchObject({ client: "Andes Foods", health: "on-track" });
  });

  it("updates stages, schedules follow-ups and restores the original sample", async () => {
    const storage = createStorage();
    const api = createDemoQuoteApi({ storage, now: () => fixedNow });

    const moved = await api.updateQuote("quote-aurelia", { stage: "won" });
    const scheduled = await api.addFollowUp("quote-aurelia", {
      type: "call",
      dueDate: "2026-07-15",
      note: "Confirm the implementation kickoff."
    });

    expect(moved).toMatchObject({ stage: "won", probability: 100, health: "closed" });
    expect(scheduled.nextAction).toBe("Confirm the implementation kickoff.");
    expect(scheduled.followUps[scheduled.followUps.length - 1]).toMatchObject({ type: "call", completed: false });

    api.reset();
    expect(await api.listQuotes()).toHaveLength(5);
    expect((await api.listQuotes()).find((quote) => quote.id === "quote-aurelia")?.stage).toBe("proposal");
  });

  it("rejects an invalid follow-up date without poisoning browser storage", async () => {
    const storage = createStorage();
    const api = createDemoQuoteApi({ storage, now: () => fixedNow });

    await expect(api.addFollowUp("quote-aurelia", {
      type: "call",
      dueDate: "",
      note: "Confirm the implementation kickoff."
    })).rejects.toThrow("Choose a valid follow-up date.");

    const restored = await createDemoQuoteApi({ storage, now: () => fixedNow }).listQuotes();
    expect(restored).toHaveLength(5);
    expect(restored.find((quote) => quote.id === "quote-aurelia")?.followUps).toHaveLength(1);
  });

  it("discards malformed browser data and restores a safe sample", async () => {
    const storage = createStorage();
    storage.setItem("quoteflow.interactive-demo.v1", JSON.stringify([
      { id: "broken-quote", expectedCloseDate: "", followUps: [] }
    ]));

    const quotes = await createDemoQuoteApi({ storage, now: () => fixedNow }).listQuotes();

    expect(quotes).toHaveLength(5);
    expect(quotes.some((quote) => quote.id === "broken-quote")).toBe(false);
    expect(quotes[0].client).toBeTruthy();
  });
});
