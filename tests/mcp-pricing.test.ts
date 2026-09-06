import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MCP_COMPUTE_PREVIEW,
  mcpRequestCostCents,
} from "../../../backflow/backflow-admin/src/pages/sdk-test/mcpPricing";

test("bridge request pricing charges $1 per 10,000 with a $5 minimum", () => {
  assert.equal(MCP_COMPUTE_PREVIEW.currency, "USD");
  assert.equal(MCP_COMPUTE_PREVIEW.requestsPerUnit, 10000);
  assert.equal(MCP_COMPUTE_PREVIEW.centsPerUnit, 100);
  assert.equal(mcpRequestCostCents(MCP_COMPUTE_PREVIEW.defaultRequests), 500);
  assert.equal(mcpRequestCostCents(100000), 1000);
  assert.equal(mcpRequestCostCents(1000000), 10000);
  assert.equal(mcpRequestCostCents(2500000), 25000);
});

test("each allowed request quantity yields an exact integer-cent price", () => {
  const pricing = MCP_COMPUTE_PREVIEW;
  for (
    let requests = pricing.minimumRequests;
    requests <= pricing.maximumRequests;
    requests += pricing.requestStep
  ) {
    const cents = mcpRequestCostCents(requests);
    assert.ok(Number.isSafeInteger(cents));
    assert.equal(cents, requests / 100);
  }
  for (const invalid of [
    0,
    -50000,
    10000,
    50001,
    75000,
    50000.5,
    2550000,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(() => mcpRequestCostCents(invalid));
  }
});
