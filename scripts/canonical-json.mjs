import { createHash } from "node:crypto";

const canonicalizeValue = (value, path, ancestors) => {
  if (value === undefined) {
    throw new TypeError(`undefined no es serializable en ${path}`);
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Número no finito en ${path}`);
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new TypeError(`Tipo no serializable ${typeof value} en ${path}`);
  }
  if (ancestors.has(value)) {
    throw new TypeError(`Referencia circular en ${path}`);
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item, index) =>
        canonicalizeValue(item, `${path}[${index}]`, ancestors),
      );
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`Objeto no plano en ${path}`);
    }

    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonicalizeValue(value[key], `${path}.${key}`, ancestors),
        ]),
    );
  } finally {
    ancestors.delete(value);
  }
};

export const canonicalizeJson = (value) =>
  canonicalizeValue(value, "$", new Set());

export const serializeCanonicalJson = (value) =>
  `${JSON.stringify(canonicalizeJson(value), null, 2)}\n`;

export const sha256Utf8 = (contents) =>
  createHash("sha256").update(contents, "utf8").digest("hex");
