import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { MemoryQuoteStore } from "../store";

const futureDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

describe("QuoteFlow API", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp(new MemoryQuoteStore());
  });

  it("reports its demo storage mode", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body).toMatchObject({
      status: "ok",
      service: "quote-flow-api",
      storage: "in-memory-demo"
    });
  });

  it("lists quotes and supports pipeline filters", async () => {
    const response = await request(app).get("/api/quotes?stage=proposal&search=aurelia").expect(200);

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0]).toMatchObject({
      client: "Aurelia Retail",
      stage: "proposal"
    });
  });

  it("creates a quote and includes it in analytics", async () => {
    const createResponse = await request(app)
      .post("/api/quotes")
      .send({
        client: "Punto Norte",
        contact: "Ana Cruz",
        owner: "Mohamed Ajmal",
        service: "Customer onboarding workspace",
        amount: 15400,
        stage: "proposal",
        probability: 50,
        expectedCloseDate: futureDate(30),
        nextAction: "Review delivery milestones with the sponsor.",
        tags: ["web", "onboarding"]
      })
      .expect(201);

    expect(createResponse.body.data.number).toMatch(/^QF-\d{4}-\d{3}$/);
    expect(createResponse.body.data.health).toBe("on-track");

    const analyticsResponse = await request(app).get("/api/analytics/overview").expect(200);
    expect(analyticsResponse.body.data.metrics.activeQuotes).toBe(5);
  });

  it("validates writes before they reach the store", async () => {
    const response = await request(app)
      .post("/api/quotes")
      .send({ client: "x", amount: -50 })
      .expect(422);

    expect(response.body.error).toBe("Validation failed.");
    expect(response.body.details.fieldErrors.client).toBeDefined();
  });

  it("moves a quote and schedules a follow-up", async () => {
    const updateResponse = await request(app)
      .patch("/api/quotes/quote-aurelia")
      .send({ stage: "negotiation" })
      .expect(200);

    expect(updateResponse.body.data.stage).toBe("negotiation");
    expect(updateResponse.body.data.probability).toBe(75);

    const followUpResponse = await request(app)
      .post("/api/quotes/quote-aurelia/follow-ups")
      .send({
        type: "call",
        dueDate: "2026-08-10",
        note: "Confirm the final approval path."
      })
      .expect(201);

    expect(followUpResponse.body.data.followUps).toHaveLength(2);
    expect(followUpResponse.body.data.nextAction).toBe("Confirm the final approval path.");
  });
});
