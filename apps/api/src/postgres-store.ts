import { randomUUID } from "node:crypto";
import { Pool, QueryResultRow } from "pg";
import {
  AnalyticsOverview,
  MemoryQuoteStore,
  QuoteStore,
  deriveHealth,
  stageProbability
} from "./store";
import {
  CreateFollowUpInput,
  CreateQuoteInput,
  FollowUp,
  LeadSummary,
  Quote,
  QuoteFilters,
  QuoteStage,
  UpdateQuoteInput
} from "./types";

interface QuoteRow extends QueryResultRow {
  id: string;
  number: string;
  client: string;
  contact: string;
  owner: string;
  service: string;
  amount: string | number;
  currency: "USD";
  stage: QuoteStage;
  probability: number;
  expected_close_date: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
  last_activity_at: string | Date;
  next_action: string;
  tags: string[];
  health: Quote["health"];
}

interface FollowUpRow extends QueryResultRow {
  id: string;
  quote_id: string;
  type: FollowUp["type"];
  due_date: string | Date;
  note: string;
  completed: boolean;
  created_at: string | Date;
}

const toIso = (value: string | Date): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toDate = (value: string | Date): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

const mapFollowUp = (row: FollowUpRow): FollowUp => ({
  id: row.id,
  type: row.type,
  dueDate: toDate(row.due_date),
  note: row.note,
  completed: row.completed,
  createdAt: toIso(row.created_at)
});

const mapQuote = (row: QuoteRow, followUps: FollowUp[]): Quote => ({
  id: row.id,
  number: row.number,
  client: row.client,
  contact: row.contact,
  owner: row.owner,
  service: row.service,
  amount: Number(row.amount),
  currency: row.currency,
  stage: row.stage,
  probability: row.probability,
  expectedCloseDate: toDate(row.expected_close_date),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
  lastActivityAt: toIso(row.last_activity_at),
  nextAction: row.next_action,
  tags: row.tags ?? [],
  health: row.health,
  followUps
});

export const createDatabasePool = (connectionString = process.env.DATABASE_URL): Pool => {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required when PostgreSQL storage is enabled.");
  }

  const isSsl =
    process.env.DATABASE_SSL === "true" ||
    connectionString.includes("sslmode=require") ||
    connectionString.includes("neon.tech");

  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    ssl: isSsl ? { rejectUnauthorized: false } : undefined
  });
};

export class PostgresQuoteStore implements QuoteStore {
  readonly storageMode = "postgresql" as const;

  constructor(private readonly pool: Pool = createDatabasePool()) {}

  async checkHealth(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async list(filters: QuoteFilters = {}): Promise<Quote[]> {
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (filters.stage) {
      values.push(filters.stage);
      conditions.push(`stage = $${values.length}`);
    }
    if (filters.owner?.trim()) {
      values.push(filters.owner.trim().toLocaleLowerCase());
      conditions.push(`LOWER(owner) = $${values.length}`);
    }
    if (filters.search?.trim()) {
      values.push(`%${filters.search.trim().toLocaleLowerCase()}%`);
      conditions.push(
        `LOWER(CONCAT_WS(' ', client, contact, service, number, array_to_string(tags, ' '))) LIKE $${values.length}`
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await this.pool.query<QuoteRow>(
      `SELECT * FROM quotes ${where} ORDER BY updated_at DESC`,
      values
    );
    return this.hydrateQuotes(result.rows);
  }

  async get(id: string): Promise<Quote | undefined> {
    const result = await this.pool.query<QuoteRow>("SELECT * FROM quotes WHERE id = $1", [id]);
    const [quote] = await this.hydrateQuotes(result.rows);
    return quote;
  }

  async create(input: CreateQuoteInput): Promise<Quote> {
    const client = await this.pool.connect();
    const id = randomUUID();

    try {
      await client.query("BEGIN");
      const sequenceResult = await client.query<{ sequence: string }>(
        "SELECT nextval('quote_number_seq')::text AS sequence"
      );
      const sequence = sequenceResult.rows[0].sequence.padStart(3, "0");
      const number = `QF-${new Date().getFullYear()}-${sequence}`;
      const probability =
        input.stage === "won" || input.stage === "lost" ? stageProbability[input.stage] : input.probability;
      const health = deriveHealth({
        stage: input.stage,
        probability,
        expectedCloseDate: input.expectedCloseDate
      });

      await client.query(
        `INSERT INTO quotes (
          id, number, client, contact, owner, service, amount, currency, stage, probability,
          expected_close_date, next_action, tags, health
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'USD', $8, $9, $10, $11, $12, $13)`,
        [
          id,
          number,
          input.client.trim(),
          input.contact.trim(),
          input.owner.trim(),
          input.service.trim(),
          input.amount,
          input.stage,
          probability,
          input.expectedCloseDate,
          input.nextAction.trim(),
          input.tags.map((tag) => tag.trim()).filter(Boolean),
          health
        ]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const quote = await this.get(id);
    if (!quote) throw new Error("The created quote could not be reloaded.");
    return quote;
  }

  async update(id: string, input: UpdateQuoteInput): Promise<Quote | undefined> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await client.query<QuoteRow>("SELECT * FROM quotes WHERE id = $1 FOR UPDATE", [id]);
      const row = result.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return undefined;
      }

      const current = mapQuote(row, []);
      const stage = input.stage ?? current.stage;
      const probability =
        input.probability ??
        (input.stage && input.stage !== current.stage ? stageProbability[stage] : current.probability);
      const expectedCloseDate = input.expectedCloseDate ?? current.expectedCloseDate;
      const health = deriveHealth({ stage, probability, expectedCloseDate });

      await client.query(
        `UPDATE quotes SET
          client = $2, contact = $3, owner = $4, service = $5, amount = $6,
          stage = $7, probability = $8, expected_close_date = $9, next_action = $10,
          tags = $11, health = $12, updated_at = NOW()
        WHERE id = $1`,
        [
          id,
          input.client?.trim() ?? current.client,
          input.contact?.trim() ?? current.contact,
          input.owner?.trim() ?? current.owner,
          input.service?.trim() ?? current.service,
          input.amount ?? current.amount,
          stage,
          probability,
          expectedCloseDate,
          input.nextAction?.trim() ?? current.nextAction,
          input.tags ? input.tags.map((tag) => tag.trim()).filter(Boolean) : current.tags,
          health
        ]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return this.get(id);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM quotes WHERE id = $1", [id]);
    return result.rowCount === 1;
  }

  async addFollowUp(id: string, input: CreateFollowUpInput): Promise<Quote | undefined> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const quoteResult = await client.query("SELECT id FROM quotes WHERE id = $1 FOR UPDATE", [id]);
      if (!quoteResult.rowCount) {
        await client.query("ROLLBACK");
        return undefined;
      }

      await client.query(
        `INSERT INTO follow_ups (id, quote_id, type, due_date, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), id, input.type, input.dueDate, input.note.trim()]
      );
      await client.query(
        `UPDATE quotes
         SET next_action = $2, last_activity_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [id, input.note.trim()]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return this.get(id);
  }

  async analytics(): Promise<AnalyticsOverview> {
    const quotes = await this.list();
    return new MemoryQuoteStore(quotes).analytics();
  }

  async leads(): Promise<LeadSummary[]> {
    const quotes = await this.list();
    return new MemoryQuoteStore(quotes).leads();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async hydrateQuotes(rows: QuoteRow[]): Promise<Quote[]> {
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const followUpResult = await this.pool.query<FollowUpRow>(
      `SELECT * FROM follow_ups
       WHERE quote_id = ANY($1::text[])
       ORDER BY due_date ASC, created_at ASC`,
      [ids]
    );
    const followUpsByQuote = new Map<string, FollowUp[]>();
    for (const row of followUpResult.rows) {
      followUpsByQuote.set(row.quote_id, [...(followUpsByQuote.get(row.quote_id) ?? []), mapFollowUp(row)]);
    }

    return rows.map((row) => mapQuote(row, followUpsByQuote.get(row.id) ?? []));
  }
}
