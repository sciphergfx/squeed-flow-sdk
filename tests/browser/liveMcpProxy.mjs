import { createServer } from "node:http";
import { Readable } from "node:stream";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const executionId = process.env.SQUEED_TEST_EXECUTION;
if (!/^[A-Za-z0-9_-]{1,128}$/.test(executionId ?? "")) throw new Error("Set SQUEED_TEST_EXECUTION to the browser test session.");
const manifest = JSON.parse(readFileSync(new URL("../../../../backflow/backflow-video/.backflow/squeed/provision.json", import.meta.url), "utf8"));
const tools = new Set(manifest.routes.map(route => `route_post_${route.path.slice(1).replaceAll("/", "_").replaceAll("-", "_")}`));
const origin = "http://localhost:5174";
const stored = spawnSync("/usr/bin/security", ["find-generic-password", "-a", "squeed@email.com", "-s", "api.backflow.dev:squeed-mcp", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 });
if (stored.status !== 0 || !stored.stdout.trim()) throw new Error("Existing Squeed MCP key is unavailable.");
const key = stored.stdout.trim();

createServer(async (request, response) => {
  if (request.headers.origin !== origin || request.url !== "/mcp") { response.writeHead(403).end(); return; }
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Headers", "authorization, content-type, mcp-session-id, mcp-protocol-version, last-event-id");
  response.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  response.setHeader("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");
  response.setHeader("Vary", "Origin");
  if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
  if (!["POST", "GET", "DELETE"].includes(request.method)) { response.writeHead(405).end(); return; }
  if (!request.headers.authorization?.startsWith("Bearer ")) { response.writeHead(401).end(); return; }
  const controller = new AbortController();
  response.on("close", () => controller.abort());
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) throw new Error("Request too large.");
      chunks.push(chunk);
    }
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    if (body) {
      const message = JSON.parse(body.toString("utf8"));
      const allowed = ["initialize", "notifications/initialized", "tools/list", "tools/call", "ping", "notifications/cancelled"];
      if (!allowed.includes(message.method)) throw new Error("RPC method is not part of this test.");
      if (message.method === "tools/call") {
        if (!tools.has(message.params?.name)) throw new Error("Tool is outside the Squeed catalog.");
        if (message.params?.arguments?.body?.executionId !== executionId) throw new Error("Wrong test execution.");
      }
    }
    const headers = { "X-API-Key": key };
    for (const name of ["accept", "content-type", "mcp-session-id", "mcp-protocol-version", "last-event-id"])
      if (request.headers[name]) headers[name] = request.headers[name];
    const upstream = await fetch("https://api.backflow.dev/mcp", { method: request.method, headers, body, signal: controller.signal, redirect: "error" });
    for (const name of ["content-type", "mcp-session-id", "mcp-protocol-version", "cache-control"])
      if (upstream.headers.has(name)) response.setHeader(name, upstream.headers.get(name));
    response.writeHead(upstream.status);
    if (upstream.body) Readable.fromWeb(upstream.body).on("error", () => response.destroy()).pipe(response);
    else response.end();
  } catch {
    if (!response.headersSent) response.writeHead(502, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Test proxy request failed." }));
  }
}).listen(0, "127.0.0.1", function () {
  console.log(`Live MCP test proxy: http://127.0.0.1:${this.address().port}/mcp`);
});