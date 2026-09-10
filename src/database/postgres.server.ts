import { supabaseAdmin } from "@/integrations/supabase/client.server";

import type { DatabaseAdapter, Filter, Row, SelectQuery } from "./adapter";

/**
 * Postgres implementation of the DatabaseAdapter, reached over HTTP so it runs
 * unchanged inside a Cloudflare Worker (no TCP sockets, no Node-only driver).
 * This file is the ONLY place that knows which Postgres host is in use.
 */

type Query = {
  eq: (c: string, v: unknown) => Query;
  neq: (c: string, v: unknown) => Query;
  in: (c: string, v: readonly unknown[]) => Query;
  lt: (c: string, v: unknown) => Query;
  lte: (c: string, v: unknown) => Query;
  gt: (c: string, v: unknown) => Query;
  gte: (c: string, v: unknown) => Query;
  is: (c: string, v: unknown) => Query;
  ilike: (c: string, v: string) => Query;
};

function applyFilters<T extends Query>(builder: T, filters: Filter[] = []): T {
  let query = builder;
  for (const filter of filters) {
    switch (filter.op) {
      case "eq":
        query = query.eq(filter.column, filter.value) as T;
        break;
      case "neq":
        query = query.neq(filter.column, filter.value) as T;
        break;
      case "in":
        query = query.in(filter.column, (filter.value as unknown[]) ?? []) as T;
        break;
      case "lt":
        query = query.lt(filter.column, filter.value) as T;
        break;
      case "lte":
        query = query.lte(filter.column, filter.value) as T;
        break;
      case "gt":
        query = query.gt(filter.column, filter.value) as T;
        break;
      case "gte":
        query = query.gte(filter.column, filter.value) as T;
        break;
      case "is":
        query = query.is(filter.column, filter.value) as T;
        break;
      case "ilike":
        query = query.ilike(filter.column, String(filter.value)) as T;
        break;
    }
  }
  return query;
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`Database ${context} failed: ${error?.message ?? "unknown error"}`);
}

// The generated Supabase types are table-specific; the adapter is deliberately
// generic, so table names arrive as strings.
/* eslint-disable @typescript-eslint/no-explicit-any */
const from = (table: string) => (supabaseAdmin as any).from(table);

export const postgresAdapter: DatabaseAdapter = {
  async select(table: string, query: SelectQuery = {}): Promise<Row[]> {
    let builder = applyFilters(from(table).select("*"), query.filters);
    if (query.order) {
      builder = (builder as any).order(query.order.column, {
        ascending: query.order.ascending ?? true,
      });
    }
    if (typeof query.limit === "number") {
      builder = (builder as any).range(query.offset ?? 0, (query.offset ?? 0) + query.limit - 1);
    }
    const { data, error } = await (builder as any);
    if (error) fail(`select on ${table}`, error);
    return (data ?? []) as Row[];
  },

  async selectOne(table: string, filters: Filter[]): Promise<Row | null> {
    const { data, error } = await applyFilters(from(table).select("*"), filters).maybeSingle();
    if (error) fail(`select on ${table}`, error);
    return (data ?? null) as Row | null;
  },

  async insert(table: string, values: Row): Promise<Row> {
    const { data, error } = await from(table).insert(values).select("*").single();
    if (error) fail(`insert into ${table}`, error);
    return data as Row;
  },

  async upsert(table: string, rows: Row[], onConflict: string): Promise<Row[]> {
    if (rows.length === 0) return [];
    const { data, error } = await from(table).upsert(rows, { onConflict }).select("*");
    if (error) fail(`upsert into ${table}`, error);
    return (data ?? []) as Row[];
  },

  async update(table: string, filters: Filter[], patch: Row): Promise<Row[]> {
    const { data, error } = await applyFilters(from(table).update(patch), filters).select("*");
    if (error) fail(`update on ${table}`, error);
    return (data ?? []) as Row[];
  },

  async remove(table: string, filters: Filter[]): Promise<void> {
    const { error } = await applyFilters(from(table).delete(), filters);
    if (error) fail(`delete on ${table}`, error);
  },

  async count(table: string, filters: Filter[]): Promise<number> {
    const { count, error } = await applyFilters(
      from(table).select("id", { count: "exact", head: true }),
      filters,
    );
    if (error) fail(`count on ${table}`, error);
    return count ?? 0;
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */
