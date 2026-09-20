'use client';

import { Client, ID } from "appwrite";
import { APPWRITE_DATABASE_ID, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_TABLES } from "./config";

type Listener = (payload: { new: Record<string, unknown> }) => void;

class RealtimeChannel {
  private listener: Listener | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly name: string) {}

  on(_event: string, options: { filter?: string; table?: string; [key: string]: unknown }, callback: Listener) {
    this.listener = (payload) => {
      if (options.filter) {
        const [field, expected] = options.filter.split("=eq.");
        if (field && String(payload.new[field]) !== expected) return;
      }
      callback(payload);
    };
    return this;
  }

  subscribe() {
    const client = getClient();
    const tableId = APPWRITE_TABLES.jobItems;
    this.unsubscribe = client.subscribe(
      [`databases.${APPWRITE_DATABASE_ID}.tables.${tableId}.rows`],
      (event: { payload?: Record<string, unknown> }) => {
        const payload = event.payload ?? {};
        this.listener?.({
          new: {
            ...payload,
            id: payload.$id,
            output_refs: Array.isArray(payload.output_file_ids)
              ? payload.output_file_ids.map((id) => `/api/media/${id}`)
              : payload.output_refs,
          },
        });
      },
    );
    return this;
  }

  close() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}

class QueryBuilder {
  private fields = "*";
  private filters: Array<{ field: string; values: unknown[] }> = [];
  private operation: "select" | "update" = "select";
  private updateData: Record<string, unknown> | null = null;

  constructor(private readonly table: string) {}

  select(fields = "*") {
    this.fields = fields;
    this.operation = "select";
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, values: [value] });
    return this;
  }

  in(field: string, values: unknown[]) {
    this.filters.push({ field, values });
    return this;
  }

  update(data: Record<string, unknown>) {
    this.operation = "update";
    this.updateData = data;
    return this;
  }

  single() {
    return this.execute().then((result) => ({
      data: result.data?.[0] ?? null,
      error: result.error ?? (!result.data?.[0] ? { message: "Not found" } : null),
    }));
  }

  maybeSingle() {
    return this.execute().then((result) => ({
      data: result.data?.[0] ?? null,
      error: result.error ?? null,
    }));
  }

  then<TResult1 = { data: any[]; error: any }>(
    onfulfilled?: ((value: { data: any[]; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult1 | PromiseLike<TResult1>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: any[]; error: any }> {
    try {
      if (this.operation === "update") {
        const response = await fetch(`/api/data/${encodeURIComponent(this.table)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filters: this.filters, data: this.updateData }),
          credentials: "include",
        });
        const body = await response.json();
        return { data: body.data ?? null, error: response.ok ? null : body.error };
      }

      const query = new URLSearchParams({ select: this.fields });
      query.set("filters", JSON.stringify(this.filters));
      const response = await fetch(`/api/data/${encodeURIComponent(this.table)}?${query}`, {
        credentials: "include",
      });
      const body = await response.json();
      return { data: body.data ?? [], error: response.ok ? null : body.error };
    } catch (error) {
      return { data: [], error };
    }
  }
}

function getClient() {
  const client = new Client();
  if (APPWRITE_ENDPOINT) client.setEndpoint(APPWRITE_ENDPOINT);
  if (APPWRITE_PROJECT_ID) client.setProject(APPWRITE_PROJECT_ID);
  return client;
}

export function createClient() {
  const client = getClient();
  return {
    auth: {
      async signOut() {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      },
      async signInWithOAuth({ provider, options }: { provider: string; options?: { redirectTo?: string } }) {
        const redirectTo = options?.redirectTo || `${window.location.origin}/auth/callback`;
        window.location.assign(`/api/auth/oauth?provider=${encodeURIComponent(provider)}&redirectTo=${encodeURIComponent(redirectTo)}`);
        return { data: null, error: null };
      },
    },
    from(table: string) {
      return new QueryBuilder(table);
    },
    channel(name: string) {
      return new RealtimeChannel(name);
    },
    removeChannel(channel: RealtimeChannel) {
      channel.close();
    },
    id: ID,
  };
}

export { APPWRITE_DATABASE_ID };
