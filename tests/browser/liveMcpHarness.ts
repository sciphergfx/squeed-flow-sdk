import { Client } from "../../../../backflow/backflow/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StreamableHTTPClientTransport } from "../../../../backflow/backflow/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js";
import { FLOW_COMMANDS } from "../../examples/mcp/commands";

export async function connectLiveMcp(
  executionId: string,
  token: string,
  endpoint = "https://api.backflow.dev/mcp",
) {
  const client = new Client({
    name: "squeed-visible-browser-test",
    version: "1.0.0",
  });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(endpoint), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  );
  const results: {
    command: string;
    status: string;
    error?: string;
    duration: number;
  }[] = [];
  const known = new Set(FLOW_COMMANDS.map((command) => command.name));
  let sequence = 0;
  let pending: ((event: Event) => void) | undefined;
  const call = async (
    command: string,
    fields: Record<string, unknown> = {},
  ) => {
    if (!known.has(command))
      throw new Error(`Not a catalog command: ${command}`);
    if (pending)
      throw new Error("Wait for the current test command to finish.");
    const requestId = `all-tools-${Date.now()}-${++sequence}`;
    const start = performance.now();
    let timer: ReturnType<typeof setTimeout>;
    let listener: (event: Event) => void;
    const received = new Promise<Record<string, any>>((resolve, reject) => {
      listener = (event) => {
        const result = (event as CustomEvent).detail;
        if (result.executionId !== executionId || result.command !== command)
          return;
        if (result.requestId !== undefined && result.requestId !== requestId)
          return;
        resolve(result);
      };
      timer = setTimeout(
        () =>
          reject(new Error("No correlated browser result within 45 seconds.")),
        45000,
      );
      pending = listener;
      window.addEventListener("squeed:mcp-result", listener);
    });
    try {
      const [response, applied] = await Promise.all([
        client.callTool(
          {
            name: `route_post_squeed_${command.replaceAll("-", "_")}`,
            arguments: { body: { executionId, requestId, ...fields } },
          },
          undefined,
          { timeout: 45000 },
        ),
        received,
      ]);
      if (response.isError) throw new Error("MCP returned a tool error.");
      for (const content of response.content as {
        type: string;
        text?: string;
      }[]) {
        if (content.type !== "text" || !content.text) continue;
        const value = JSON.parse(content.text);
        if (value.success === false)
          throw new Error(value.error ?? "Workflow failed.");
      }
      if (applied.status !== "applied")
        throw new Error(applied.error ?? applied.status);
      results.push({
        command,
        status: "passed",
        duration: Math.round(performance.now() - start),
      });
      return applied.result;
    } catch (cause) {
      const error =
        cause instanceof Error ? cause.message : "Live command failed.";
      results.push({
        command,
        status: "failed",
        error,
        duration: Math.round(performance.now() - start),
      });
      throw new Error(`${command}: ${error}`);
    } finally {
      clearTimeout(timer!);
      window.removeEventListener("squeed:mcp-result", listener!);
      pending = undefined;
    }
  };
  return {
    call,
    results,
    async batch(cases: [string, Record<string, unknown>?][]) {
      const completed = [];
      for (const [command, input] of cases) {
        await call(command, input);
        completed.push(command);
      }
      return completed;
    },
    coverage: () => ({
      total: known.size,
      passed: [
        ...new Set(
          results
            .filter((result) => result.status === "passed")
            .map((result) => result.command),
        ),
      ],
      missing: [...known].filter(
        (command) =>
          !results.some(
            (result) =>
              result.command === command && result.status === "passed",
          ),
      ),
      failures: results.filter((result) => result.status === "failed"),
    }),
    close: () => client.close(),
  };
}
