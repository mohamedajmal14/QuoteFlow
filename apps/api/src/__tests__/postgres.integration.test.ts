import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { runMigrations } from "../db/migrate";
import { createDatabasePool, PostgresQuoteStore } from "../postgres-store";

const futureDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

describe("PostgreSQL quote repository", () => {
  const pool = createDatabasePool();
  const store = new PostgresQuoteStore(pool);
  let createdQuoteId: string | undefined;

  beforeAll(async () => {
    await runMigrations(pool);
  });

  afterAll(async () => {
    if (createdQuoteId) await store.remove(createdQuoteId);
    await store.close();
  });

  it("persists a quote and its follow-up across API instances", async () => {
    const firstApp = createApp(store);
    const initialAnalytics = await request(firstApp).get("/api/analytics/overview").expect(200);
    const initialMetrics = initialAnalytics.body.data.metrics as {
      activeQuotes: number;
      pipelineValue: number;
    };
    const created = await request(firstApp)
      .post("/api/quotes")
      .send({
        client: "Andes Supply",
        contact: "Carla Soto",
        owner: "Mohamed Ajmal",
        service: "Procurement and approval portal",
        amount: 17200,
        stage: "proposal",
        probability: 50,
        expectedCloseDate: futureDate(20),
        nextAction: "Validate the purchasing workflow.",
        tags: ["portal", "operations"]
      })
      .expect(201);

    expect(created.body.data.number).toMatch(/^QF-\d{4}-\d{3,}$/);
    const quoteId = created.body.data.id as string;
    createdQuoteId = quoteId;

    await request(firstApp)
      .post(`/api/quotes/${quoteId}/follow-ups`)
      .send({
        type: "demo",
        dueDate: futureDate(3),
        note: "Demonstrate the approval flow to operations."
      })
      .expect(201);

    const reloadedApp = createApp(new PostgresQuoteStore(pool));
    const reloaded = await request(reloadedApp).get(`/api/quotes/${quoteId}`).expect(200);
    expect(reloaded.body.data).toMatchObject({
      client: "Andes Supply",
      amount: 17200,
      nextAction: "Demonstrate the approval flow to operations."
    });
    expect(reloaded.body.data.followUps).toHaveLength(1);

    const analytics = await request(reloadedApp).get("/api/analytics/overview").expect(200);
    expect(analytics.body.data.metrics).toMatchObject({
      activeQuotes: initialMetrics.activeQuotes + 1,
      pipelineValue: initialMetrics.pipelineValue + 17200
    });
  });
});
