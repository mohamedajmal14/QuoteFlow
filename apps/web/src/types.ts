export const quoteStages = ["discovery", "proposal", "negotiation", "won", "lost"] as const;
export type QuoteStage = (typeof quoteStages)[number];

export const followUpTypes = ["email", "call", "demo", "proposal-review"] as const;
export type FollowUpType = (typeof followUpTypes)[number];

export type QuoteHealth = "on-track" | "at-risk" | "closed";

export interface FollowUp {
  id: string;
  type: FollowUpType;
  dueDate: string;
  note: string;
  completed: boolean;
  createdAt: string;
}

export interface Quote {
  id: string;
  number: string;
  client: string;
  contact: string;
  owner: string;
  service: string;
  amount: number;
  currency: "USD";
  stage: QuoteStage;
  probability: number;
  expectedCloseDate: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  nextAction: string;
  tags: string[];
  health: QuoteHealth;
  followUps: FollowUp[];
}

export interface QuoteInput {
  client: string;
  contact: string;
  owner: string;
  service: string;
  amount: number;
  stage: QuoteStage;
  probability: number;
  expectedCloseDate: string;
  nextAction: string;
  tags: string[];
}

export type QuoteUpdate = Partial<QuoteInput>;

export interface FollowUpInput {
  type: FollowUpType;
  dueDate: string;
  note: string;
}

export interface Overview {
  metrics: {
    activeQuotes: number;
    pipelineValue: number;
    weightedValue: number;
    wonValue: number;
    atRiskCount: number;
  };
  pipeline: Array<{
    stage: QuoteStage;
    count: number;
    value: number;
  }>;
  atRisk: Quote[];
  upcomingFollowUps: Array<{
    quoteId: string;
    quoteNumber: string;
    client: string;
    followUp: FollowUp;
  }>;
}
