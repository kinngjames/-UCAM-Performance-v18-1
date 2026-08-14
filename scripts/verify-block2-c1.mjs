import { verifyBlock2C1Contract } from "./block2-c1-contract.mjs";

const result = await verifyBlock2C1Contract();
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
