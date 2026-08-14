import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type RuntimeBindings = { DB?: D1Database };
const bindings = () => (globalThis as typeof globalThis & { __UCAM_BINDINGS__?: RuntimeBindings }).__UCAM_BINDINGS__;

export function getDb() {
  const d1 = bindings()?.DB;
  if (!d1) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(d1, { schema });
}

export function getD1(): D1Database {
  const d1 = bindings()?.DB;
  if (!d1) throw new Error("La base de datos persistente no está disponible.");
  return d1;
}
