import { verifyBlock2C5Contract } from "./block2-c5-contract.mjs";

const result = await verifyBlock2C5Contract();
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
