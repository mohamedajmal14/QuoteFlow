import { randomUUID } from "node:crypto";
import { createDemoQuotes } from "./data/demo-quotes";
import {
  CreateFollowUpInput,
  CreateQuoteInput,
  FollowUp,
  LeadSummary,
  PipelineStageSummary,
  Quote,
  QuoteFilters,
  QuoteHealth,
  QuoteStage,
  UpcomingFollowUp,
  UpdateQuoteInput,
  quoteStages
} from "./types";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

export const stageProbability: Record<QuoteStage, number> = {
  discovery: 20,
  proposal: 50,
  negotiation: 75,
  won: 100,
  lost: 0
};

export const deriveHealth = (quote: Pick<Quote, "stage" | "probability" | "expectedCloseDate">): QuoteHealth => {
  if (quote.stage === "won" || quote.stage === "lost") {
    return "closed";
  }

  const daysUntilClose = Math.ceil(
    (new Date(`${quote.expectedCloseDate}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) /
      86_400_000
  );

  return daysUntilClose <= 3 && quote.probability < 70 ? "at-risk" : "on-track";
};

export interface AnalyticsOverview {
  metrics: {
    activeQuotes: number;
    pipelineValue: number;
    weightedValue: number;
    wonValue: number;
    atRiskCount: number;
  };
  pipeline: PipelineStageSummary[];
  atRisk: Quote[];
  upcomingFollowUps: UpcomingFollowUp[];
}

export type StoreResult<T> = T | Promise<T>;

export interface QuoteStore {
  readonly storageMode: "in-memory-demo" | "postgresql";
  checkHealth(): StoreResult<void>;
  list(filters?: QuoteFilters): StoreResult<Quote[]>;
  get(id: string): StoreResult<Quote | undefined>;
  create(input: CreateQuoteInput): StoreResult<Quote>;
  update(id: string, input: UpdateQuoteInput): StoreResult<Quote | undefined>;
  remove(id: string): StoreResult<boolean>;
  addFollowUp(id: string, input: CreateFollowUpInput): StoreResult<Quote | undefined>;
  analytics(): StoreResult<AnalyticsOverview>;
  leads(): StoreResult<LeadSummary[]>;
}

export class MemoryQuoteStore implements QuoteStore {
  readonly storageMode = "in-memory-demo" as const;
  private quotes: Quote[];

  constructor(seed: Quote[] = createDemoQuotes()) {
    this.quotes = clone(seed);
  }

  checkHealth(): void {
    // The in-memory adapter is always available while the process is running.
  }

  list(filters: QuoteFilters = {}): Quote[] {
    const search = filters.search?.trim().toLocaleLowerCase();
    const owner = filters.owner?.trim().toLocaleLowerCase();

    return clone(
      this.quotes
        .filter((quote) => !filters.stage || quote.stage === filters.stage)
        .filter((quote) => !owner || quote.owner.toLocaleLowerCase() === owner)
        .filter((quote) => {
          if (!search) return true;
          return [quote.client, quote.contact, quote.service, quote.number, ...quote.tags]
            .join(" ")
            .toLocaleLowerCase()
            .includes(search);
        })
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    );
  }

  get(id: string): Quote | undefined {
    const quote = this.quotes.find((item) => item.id === id);
    return quote ? clone(quote) : undefined;
  }

  create(input: CreateQuoteInput): Quote {
    const timestamp = now();
    const sequence = String(this.quotes.length + 10).padStart(3, "0");
    const stage = input.stage;
    const quote: Quote = {
      id: randomUUID(),
      number: `QF-${new Date().getFullYear()}-${sequence}`,
      client: input.client.trim(),
      contact: input.contact.trim(),
      owner: input.owner.trim(),
      service: input.service.trim(),
      amount: input.amount,
      currency: "USD",
      stage,
      probability: stage === "won" || stage === "lost" ? stageProbability[stage] : input.probability,
      expectedCloseDate: input.expectedCloseDate,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastActivityAt: timestamp,
      nextAction: input.nextAction.trim(),
      tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
      health: "on-track",
      followUps: []
    };

    quote.health = deriveHealth(quote);
    this.quotes.unshift(quote);
    return clone(quote);
  }

  update(id: string, input: UpdateQuoteInput): Quote | undefined {
    const index = this.quotes.findIndex((item) => item.id === id);
    if (index === -1) return undefined;

    const current = this.quotes[index];
    const nextStage = input.stage ?? current.stage;
    const nextProbability =
      input.probability ?? (input.stage && input.stage !== current.stage ? stageProbability[nextStage] : current.probability);

    const updated: Quote = {
      ...current,
      ...input,
      client: input.client?.trim() ?? current.client,
      contact: input.contact?.trim() ?? current.contact,
      owner: input.owner?.trim() ?? current.owner,
      service: input.service?.trim() ?? current.service,
      nextAction: input.nextAction?.trim() ?? current.nextAction,
      tags: input.tags ? input.tags.map((tag) => tag.trim()).filter(Boolean) : current.tags,
      stage: nextStage,
      probability: nextProbability,
      updatedAt: now()
    };

    updated.health = deriveHealth(updated);
    this.quotes[index] = updated;
    return clone(updated);
  }

  remove(id: string): boolean {
    const before = this.quotes.length;
    this.quotes = this.quotes.filter((item) => item.id !== id);
    return this.quotes.length < before;
  }

  addFollowUp(id: string, input: CreateFollowUpInput): Quote | undefined {
    const index = this.quotes.findIndex((item) => item.id === id);
    if (index === -1) return undefined;

    const createdAt = now();
    const followUp: FollowUp = {
      id: randomUUID(),
      type: input.type,
      dueDate: input.dueDate,
      note: input.note.trim(),
      completed: false,
      createdAt
    };

    const current = this.quotes[index];
    const updated: Quote = {
      ...current,
      followUps: [...current.followUps, followUp],
      lastActivityAt: createdAt,
      updatedAt: createdAt,
      nextAction: input.note.trim()
    };
    updated.health = deriveHealth(updated);
    this.quotes[index] = updated;
    return clone(updated);
  }

  analytics(): AnalyticsOverview {
    const activeQuotes = this.quotes.filter((quote) => quote.stage !== "won" && quote.stage !== "lost");
    const pipeline = quoteStages.map((stage) => {
      const quotes = this.quotes.filter((quote) => quote.stage === stage);
      return {
        stage,
        count: quotes.length,
        value: quotes.reduce((total, quote) => total + quote.amount, 0)
      };
    });

    const upcomingFollowUps = this.quotes
      .flatMap((quote) =>
        quote.followUps
          .filter((followUp) => !followUp.completed)
          .map((followUp) => ({
            quoteId: quote.id,
            quoteNumber: quote.number,
            client: quote.client,
            followUp
          }))
      )
      .sort((left, right) => left.followUp.dueDate.localeCompare(right.followUp.dueDate))
      .slice(0, 5);

    return {
      metrics: {
        activeQuotes: activeQuotes.length,
        pipelineValue: activeQuotes.reduce((total, quote) => total + quote.amount, 0),
        weightedValue: Math.round(
          activeQuotes.reduce((total, quote) => total + quote.amount * (quote.probability / 100), 0)
        ),
        wonValue: this.quotes
          .filter((quote) => quote.stage === "won")
          .reduce((total, quote) => total + quote.amount, 0),
        atRiskCount: activeQuotes.filter((quote) => quote.health === "at-risk").length
      },
      pipeline,
      atRisk: clone(activeQuotes.filter((quote) => quote.health === "at-risk")),
      upcomingFollowUps: clone(upcomingFollowUps)
    };
  }

  leads(): LeadSummary[] {
    const grouped = new Map<string, Quote[]>();
    this.quotes.forEach((quote) => {
      grouped.set(quote.client, [...(grouped.get(quote.client) ?? []), quote]);
    });

    return Array.from(grouped.values())
      .map((quotes) => {
        const latest = [...quotes].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
        const activeValue = quotes
          .filter((quote) => quote.stage !== "won" && quote.stage !== "lost")
          .reduce((total, quote) => total + quote.amount, 0);
        return {
          client: latest.client,
          contact: latest.contact,
          quoteCount: quotes.length,
          activeValue,
          latestStage: latest.stage,
          nextAction: latest.nextAction
        };
      })
      .sort((left, right) => right.activeValue - left.activeValue);
  }
}
