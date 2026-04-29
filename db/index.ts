import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema";

let cache: NeonHttpDatabase<typeof schema> | undefined;

/**
 * Lazily creates the Drizzle client so `next build` does not evaluate Neon/Drizzle
 * until a route actually runs a query (avoids failures when DATABASE_URL is absent at build time).
 */
export function getDb(): NeonHttpDatabase<typeof schema> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it in your host’s environment (e.g. Cloudflare Pages → Settings → Variables → Production). " +
        "Paste the full Neon connection string as a single line; long lines sometimes fail when bulk-pasting a whole .env file.",
    );
  }
  if (!cache) {
    cache = drizzle(url, { schema });
  }
  return cache;
}

/** Same as `getDb()` — keeps existing `import { db } from "@/db"` call sites working. */
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
