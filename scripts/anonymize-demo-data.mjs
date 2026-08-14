import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dataFile = fileURLToPath(new URL("../app/data.ts", import.meta.url));
const source = readFileSync(dataFile, "utf8");
const playerBlock = /export const INITIAL_PLAYERS = (\[[\s\S]*?\]) as const;\n\nexport const INITIAL_SESSIONS/;
const match = source.match(playerBlock);

if (!match) {
  throw new Error("No se ha encontrado INITIAL_PLAYERS; no se modificó ningún archivo.");
}

const players = JSON.parse(match[1]);
const anonymized = players.map((player, index) => {
  const ordinal = String(index + 1).padStart(2, "0");
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String(((index * 3) % 27) + 1).padStart(2, "0");
  return {
    ...player,
    name: `JUGADOR ${ordinal}`,
    birthDate: `2009-${month}-${day}`,
  };
});

const replacement = `export const INITIAL_PLAYERS = ${JSON.stringify(anonymized, null, 2)} as const;\n\nexport const INITIAL_SESSIONS`;
writeFileSync(dataFile, source.replace(playerBlock, replacement));
console.log(`Anonimizados ${anonymized.length} jugadores en ${dataFile}`);
