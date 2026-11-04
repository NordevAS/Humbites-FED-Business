import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import type { ShowcaseDatabase, D1Statement } from '../../lib/showcase/store';
export function createTestDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  const directory = new URL('../../drizzle/', import.meta.url);
  for (const file of readdirSync(directory)
    .filter((x) => x.endsWith('.sql'))
    .sort())
    sqlite.exec(readFileSync(new URL(file, directory), 'utf8'));
  class Statement implements D1Statement {
    constructor(
      readonly sql: string,
      readonly values: unknown[] = [],
    ) {}
    bind(...values: unknown[]) {
      return new Statement(this.sql, values);
    }
    runNow() {
      const result = sqlite
        .prepare(this.sql)
        .run(...(this.values as (string | number | null)[]));
      return {
        meta: {
          changes: Number(result.changes),
          last_row_id: Number(result.lastInsertRowid),
        },
      };
    }
    async run() {
      return this.runNow();
    }
    async first<T = Record<string, unknown>>(
      column?: string,
    ): Promise<T | null> {
      const row = sqlite
        .prepare(this.sql)
        .get(...(this.values as (string | number | null)[])) as
        | Record<string, unknown>
        | undefined;
      return (row ? (column ? row[column] : row) : null) as T | null;
    }
    async all<T = Record<string, unknown>>() {
      return {
        results: sqlite
          .prepare(this.sql)
          .all(...(this.values as (string | number | null)[])) as T[],
      };
    }
  }
  const db: ShowcaseDatabase = {
    prepare(sql) {
      return new Statement(sql);
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((x) => (x as Statement).runNow());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { db, sqlite, close: () => sqlite.close() };
}
