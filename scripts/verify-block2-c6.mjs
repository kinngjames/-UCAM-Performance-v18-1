import { characterizeBlock2C6Contract } from "./block2-c6-contract.mjs";

const result = await characterizeBlock2C6Contract();
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
