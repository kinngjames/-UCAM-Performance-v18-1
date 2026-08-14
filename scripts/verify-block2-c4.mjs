import { characterizeBlock2C4Contract } from "./block2-c4-contract.mjs";

const result = await characterizeBlock2C4Contract();
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
