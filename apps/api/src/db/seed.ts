import "dotenv/config";
import { Pool } from "pg";
import { createDemoQuotes } from "../data/demo-quotes";
import { createDatabasePool } from "../postgres-store";

export const seedDatabase = async (pool: Pool): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const quote of createDemoQuotes()) {
      await client.query(
        `INSERT INTO quotes (
          id, number, client, contact, owner, service, amount, currency, stage, probability,
          expected_close_date, created_at, updated_at, last_activity_at, next_action, tags, health
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17
        ) ON CONFLICT (id) DO NOTHING`,
        [
          quote.id,
          quote.number,
          quote.client,
          quote.contact,
          quote.owner,
          quote.service,
          quote.amount,
          quote.currency,
          quote.stage,
          quote.probability,
          quote.expectedCloseDate,
          quote.createdAt,
          quote.updatedAt,
          quote.lastActivityAt,
          quote.nextAction,
          quote.tags,
          quote.health
        ]
      );

      for (const followUp of quote.followUps) {
        await client.query(
          `INSERT INTO follow_ups (id, quote_id, type, due_date, note, completed, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            followUp.id,
            quote.id,
            followUp.type,
            followUp.dueDate,
            followUp.note,
            followUp.completed,
            followUp.createdAt
          ]
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const main = async () => {
  const pool = createDatabasePool();
  try {
    await seedDatabase(pool);
    console.log("Demo workspace seeded.");
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
