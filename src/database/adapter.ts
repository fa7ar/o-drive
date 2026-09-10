/**
 * Vendor-agnostic database contract.
 *
 * Business logic and repositories depend on this interface only — never on a
 * concrete driver, connection pooler or hosting product. A Postgres
 * implementation ships in `postgres.server.ts`; a different engine (or a raw
 * SQL/Hyperdrive driver) can be dropped in without touching any repository.
 */

export type FilterOperator = "eq" | "neq" | "in" | "lt" | "lte" | "gt" | "gte" | "is" | "ilike";

export interface Filter {
  column: string;
  op: FilterOperator;
  value: unknown;
}

export interface SelectQuery {
  filters?: Filter[];
  order?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
}

export type Row = Record<string, unknown>;

export interface DatabaseAdapter {
  select(table: string, query?: SelectQuery): Promise<Row[]>;
  selectOne(table: string, filters: Filter[]): Promise<Row | null>;
  insert(table: string, values: Row): Promise<Row>;
  upsert(table: string, rows: Row[], onConflict: string): Promise<Row[]>;
  update(table: string, filters: Filter[], patch: Row): Promise<Row[]>;
  remove(table: string, filters: Filter[]): Promise<void>;
  count(table: string, filters: Filter[]): Promise<number>;
}

export const eq = (column: string, value: unknown): Filter => ({ column, op: "eq", value });
export const inList = (column: string, value: unknown[]): Filter => ({ column, op: "in", value });
