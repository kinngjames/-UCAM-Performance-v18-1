import { verifyBlock2C7Contract } from "./block2-c7-contract.mjs";

const result = await verifyBlock2C7Contract();
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
