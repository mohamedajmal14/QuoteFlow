import {
  FollowUpInput,
  Overview,
  Quote,
  QuoteHealth,
  QuoteInput,
  QuoteStage,
  QuoteUpdate,
  followUpTypes,
  quoteStages
} from "./types";

const STORAGE_KEY = "quoteflow.interactive-demo.v1";

type DemoStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type DemoApiOptions = {
  storage?: DemoStorage;
  now?: () => Date;
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const stageProbability: Record<QuoteStage, number> = {
  discovery: 20,
  proposal: 50,
  negotiation: 75,
  won: 100,
  lost: 0
};

const dateFrom = (date: Date, days: number) => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};

const isoFrom = (date: Date, days: number) => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value.toISOString();
};

const createSeedQuotes = (today: Date): Quote[] => [
  {
    id: "quote-aurelia",
    number: "QF-DEMO-014",
    client: "Aurelia Retail",
    contact: "Mariana Torres",
    owner: "Mohamed Ajmal",
    service: "Customer portal and reporting workspace",
    amount: 12800,
    currency: "USD",
    stage: "proposal",
    probability: 55,
    expectedCloseDate: dateFrom(today, 9),
    createdAt: isoFrom(today, -11),
    updatedAt: isoFrom(today, -1),
    lastActivityAt: isoFrom(today, -1),
    nextAction: "Walk through the revised scope with operations.",
    tags: ["web", "dashboard", "priority"],
    health: "on-track",
    followUps: [
      {
        id: "follow-aurelia-1",
        type: "proposal-review",
        dueDate: dateFrom(today, 2),
        note: "Confirm reporting and approval requirements.",
        completed: false,
        createdAt: isoFrom(today, -1)
      }
    ]
  },
  {
    id: "quote-nexo",
    number: "QF-DEMO-013",
    client: "Nexo Cargo",
    contact: "Raúl Medina",
    owner: "Mohamed Ajmal",
    service: "Operations API and mobile delivery tracking",
    amount: 22500,
    currency: "USD",
    stage: "negotiation",
    probability: 60,
    expectedCloseDate: dateFrom(today, 2),
    createdAt: isoFrom(today, -19),
    updatedAt: isoFrom(today, -4),
    lastActivityAt: isoFrom(today, -4),
    nextAction: "Resolve scope question before commercial approval.",
    tags: ["api", "mobile", "at-risk"],
    health: "at-risk",
    followUps: [
      {
        id: "follow-nexo-1",
        type: "call",
        dueDate: dateFrom(today, 1),
        note: "Decision call with logistics lead.",
        completed: false,
        createdAt: isoFrom(today, -4)
      }
    ]
  },
  {
    id: "quote-marea",
    number: "QF-DEMO-012",
    client: "Marea Labs",
    contact: "Inés Lozano",
    owner: "Lucía Ramos",
    service: "Discovery for an internal workflow platform",
    amount: 6400,
    currency: "USD",
    stage: "discovery",
    probability: 25,
    expectedCloseDate: dateFrom(today, 21),
    createdAt: isoFrom(today, -3),
    updatedAt: isoFrom(today, -1),
    lastActivityAt: isoFrom(today, -1),
    nextAction: "Send discovery recap and technical approach.",
    tags: ["discovery", "workflow"],
    health: "on-track",
    followUps: [
      {
        id: "follow-marea-1",
        type: "email",
        dueDate: dateFrom(today, 3),
        note: "Share discovery recap with product sponsor.",
        completed: false,
        createdAt: isoFrom(today, -1)
      }
    ]
  },
  {
    id: "quote-lumina",
    number: "QF-DEMO-011",
    client: "Lumina Health",
    contact: "Claudia Vega",
    owner: "Mohamed Ajmal",
    service: "Secure appointment and follow-up module",
    amount: 18000,
    currency: "USD",
    stage: "won",
    probability: 100,
    expectedCloseDate: dateFrom(today, -2),
    createdAt: isoFrom(today, -27),
    updatedAt: isoFrom(today, -2),
    lastActivityAt: isoFrom(today, -2),
    nextAction: "Prepare implementation kickoff notes.",
    tags: ["web", "health", "won"],
    health: "closed",
    followUps: []
  },
  {
    id: "quote-fenix",
    number: "QF-DEMO-010",
    client: "Fénix Advisory",
    contact: "Sergio Fuentes",
    owner: "Lucía Ramos",
    service: "Client intake and billing integration",
    amount: 9800,
    currency: "USD",
    stage: "proposal",
    probability: 45,
    expectedCloseDate: dateFrom(today, 14),
    createdAt: isoFrom(today, -8),
    updatedAt: isoFrom(today, -2),
    lastActivityAt: isoFrom(today, -2),
    nextAction: "Send phased implementation option.",
    tags: ["integration", "billing"],
    health: "on-track",
    followUps: [
      {
        id: "follow-fenix-1",
        type: "email",
        dueDate: dateFrom(today, 4),
        note: "Send phase-one and phase-two pricing options.",
        completed: false,
        createdAt: isoFrom(today, -2)
      }
    ]
  }
];

const deriveHealth = (quote: Pick<Quote, "stage" | "probability" | "expectedCloseDate">, now: Date): QuoteHealth => {
  if (quote.stage === "won" || quote.stage === "lost") return "closed";

  const close = new Date(`${quote.expectedCloseDate}T00:00:00`).getTime();
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00`).getTime();
  const daysUntilClose = Math.ceil((close - today) / 86_400_000);
  return daysUntilClose <= 3 && quote.probability < 70 ? "at-risk" : "on-track";
};

const isValidDateInput = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

const isStoredFollowUp = (value: unknown) => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string"
    && followUpTypes.includes(candidate.type as (typeof followUpTypes)[number])
    && isValidDateInput(candidate.dueDate)
    && typeof candidate.note === "string"
    && typeof candidate.completed === "boolean"
    && isIsoTimestamp(candidate.createdAt);
};

const isStoredQuote = (value: unknown): value is Quote => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const stringFields = [
    "id", "number", "client", "contact", "owner", "service", "nextAction"
  ] as const;
  const healthValues: QuoteHealth[] = ["on-track", "at-risk", "closed"];

  return stringFields.every((field) => typeof candidate[field] === "string")
    && typeof candidate.amount === "number" && Number.isFinite(candidate.amount) && candidate.amount >= 0
    && candidate.currency === "USD"
    && quoteStages.includes(candidate.stage as QuoteStage)
    && typeof candidate.probability === "number" && candidate.probability >= 0 && candidate.probability <= 100
    && isValidDateInput(candidate.expectedCloseDate)
    && isIsoTimestamp(candidate.createdAt)
    && isIsoTimestamp(candidate.updatedAt)
    && isIsoTimestamp(candidate.lastActivityAt)
    && Array.isArray(candidate.tags) && candidate.tags.every((tag) => typeof tag === "string")
    && healthValues.includes(candidate.health as QuoteHealth)
    && Array.isArray(candidate.followUps) && candidate.followUps.every(isStoredFollowUp);
};

const isQuoteArray = (value: unknown): value is Quote[] =>
  Array.isArray(value) && value.every(isStoredQuote);

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getBrowserStorage = (): DemoStorage | undefined => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

export const createDemoQuoteApi = ({
  storage = getBrowserStorage(),
  now = () => new Date()
}: DemoApiOptions = {}) => {
  const read = () => {
    try {
      const saved = storage?.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isQuoteArray(parsed)) return parsed;
      }
    } catch {
      // A private browsing policy can reject localStorage. The demo still works in memory.
    }
    return createSeedQuotes(now());
  };

  let quotes = read();

  const persist = () => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(quotes));
    } catch {
      // Keep the current in-memory session available if browser storage is blocked.
    }
  };

  const getOverview = (): Overview => {
    const activeQuotes = quotes.filter((quote) => quote.stage !== "won" && quote.stage !== "lost");
    const pipeline = quoteStages.map((stage) => {
      const matching = quotes.filter((quote) => quote.stage === stage);
      return {
        stage,
        count: matching.length,
        value: matching.reduce((total, quote) => total + quote.amount, 0)
      };
    });
    const upcomingFollowUps = quotes
      .flatMap((quote) =>
        quote.followUps
          .filter((followUp) => !followUp.completed)
          .map((followUp) => ({ quoteId: quote.id, quoteNumber: quote.number, client: quote.client, followUp }))
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
        wonValue: quotes
          .filter((quote) => quote.stage === "won")
          .reduce((total, quote) => total + quote.amount, 0),
        atRiskCount: activeQuotes.filter((quote) => quote.health === "at-risk").length
      },
      pipeline,
      atRisk: clone(activeQuotes.filter((quote) => quote.health === "at-risk")),
      upcomingFollowUps: clone(upcomingFollowUps)
    };
  };

  return {
    listQuotes: async (): Promise<Quote[]> =>
      clone([...quotes].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))),

    getOverview: async (): Promise<Overview> => clone(getOverview()),

    createQuote: async (input: QuoteInput): Promise<Quote> => {
      const timestamp = now().toISOString();
      const sequence = String(quotes.length + 10).padStart(3, "0");
      const probability = input.stage === "won" || input.stage === "lost"
        ? stageProbability[input.stage]
        : input.probability;
      const quote: Quote = {
        ...input,
        client: input.client.trim(),
        contact: input.contact.trim(),
        owner: input.owner.trim(),
        service: input.service.trim(),
        nextAction: input.nextAction.trim(),
        tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
        id: createId(),
        number: `QF-DEMO-${sequence}`,
        currency: "USD",
        probability,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastActivityAt: timestamp,
        health: "on-track",
        followUps: []
      };
      quote.health = deriveHealth(quote, now());
      quotes = [quote, ...quotes];
      persist();
      return clone(quote);
    },

    updateQuote: async (id: string, input: QuoteUpdate): Promise<Quote> => {
      const index = quotes.findIndex((quote) => quote.id === id);
      if (index < 0) throw new Error("That demo quote no longer exists.");

      const current = quotes[index];
      const stage = input.stage ?? current.stage;
      const updated: Quote = {
        ...current,
        ...input,
        client: input.client?.trim() ?? current.client,
        contact: input.contact?.trim() ?? current.contact,
        owner: input.owner?.trim() ?? current.owner,
        service: input.service?.trim() ?? current.service,
        nextAction: input.nextAction?.trim() ?? current.nextAction,
        tags: input.tags ? input.tags.map((tag) => tag.trim()).filter(Boolean) : current.tags,
        stage,
        probability: input.probability ?? (input.stage ? stageProbability[stage] : current.probability),
        updatedAt: now().toISOString()
      };
      updated.health = deriveHealth(updated, now());
      quotes[index] = updated;
      persist();
      return clone(updated);
    },

    addFollowUp: async (id: string, input: FollowUpInput): Promise<Quote> => {
      const index = quotes.findIndex((quote) => quote.id === id);
      if (index < 0) throw new Error("That demo quote no longer exists.");
      if (!isValidDateInput(input.dueDate)) throw new Error("Choose a valid follow-up date.");

      const note = input.note.trim();
      if (!note) throw new Error("Add a follow-up note.");

      const timestamp = now().toISOString();
      const current = quotes[index];
      const updated: Quote = {
        ...current,
        nextAction: note,
        updatedAt: timestamp,
        lastActivityAt: timestamp,
        followUps: [
          ...current.followUps,
          { ...input, id: createId(), note, completed: false, createdAt: timestamp }
        ]
      };
      quotes[index] = updated;
      persist();
      return clone(updated);
    },

    reset: () => {
      quotes = createSeedQuotes(now());
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        // The fresh in-memory seed is enough when storage is unavailable.
      }
    }
  };
};
