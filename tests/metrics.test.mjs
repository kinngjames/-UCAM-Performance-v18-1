import test from "node:test";
import assert from "node:assert/strict";
import { transform } from "esbuild";
import { readFile } from "node:fs/promises";

test("el motor central conserva la definición de carga", async()=>{
  const source=await readFile(new URL("../lib/metrics.ts",import.meta.url),"utf8");
  const compiled=await transform(source,{loader:"ts",format:"esm"});
  const metrics=await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`);
  assert.equal(metrics.loadForEffort(6,67),402);
  assert.equal(metrics.loadForCompleteEffort(6,67),402);
  assert.equal(metrics.loadForCompleteEffort(null,67),null);
  assert.equal(metrics.loadForCompleteEffort(6,null),null);
  assert.equal(metrics.weeklyLoad([300,402,0,198]),900);
  assert.equal(metrics.compliancePercent(3,3,true),100);
  assert.equal(metrics.personalBaseline([7,7.2,7.4,7.1],5),null);
  assert.ok(metrics.personalBaseline([7,7.2,7.4,7.1,7.3],5));
});

test("distingue completo, parcial, sin exposición y sin datos", async()=>{
  const source=await readFile(new URL("../lib/metrics.ts",import.meta.url),"utf8");
  const compiled=await transform(source,{loader:"ts",format:"esm"});
  const metrics=await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`);
  assert.equal(metrics.classifyLoadCompleteness({expectedEfforts:4,completedEfforts:4,explicitNoExposure:false}),"COMPLETE");
  assert.equal(metrics.classifyLoadCompleteness({expectedEfforts:4,completedEfforts:3,explicitNoExposure:false}),"PARTIAL");
  assert.equal(metrics.classifyLoadCompleteness({expectedEfforts:0,completedEfforts:0,explicitNoExposure:true}),"NO_EXPOSURE");
  assert.equal(metrics.classifyLoadCompleteness({expectedEfforts:1,completedEfforts:0,explicitNoExposure:false}),"NO_DATA");
  assert.deepEqual(metrics.summarizeLoadCoverage(["COMPLETE","PARTIAL","NO_EXPOSURE","NO_DATA","COMPLETE"]),{
    complete:2,
    partial:1,
    noExposure:1,
    noData:1,
  });
});
