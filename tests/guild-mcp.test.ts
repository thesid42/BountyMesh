import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createGuildMcpServer } from "../src/lib/guild-mcp";
import type { GuildTask } from "../src/lib/guild-tasks";
import { POST } from "../src/app/api/mcp/route";

test("Guild MCP negotiates, advertises tools and validates calls with owner scope", async () => {
  const owner = randomUUID(), task: GuildTask = { id: randomUUID(), title: "Compare options", goal: "Compare three agent onboarding approaches.", rewardCents: 50, idempotencyKey: randomUUID(), createdAt: new Date().toISOString(), ownerId: owner };
  let posts = 0;
  const deps = { post: async (id: string | null) => { assert.equal(id, owner); posts++; return task; }, read: async (id: string | null, taskId: string) => { assert.equal(id, owner); assert.equal(taskId, task.id); return task; } };
  async function request(method: string, params: unknown) {
    const server = createGuildMcpServer(owner, deps), transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      const response = await transport.handleRequest(new Request("https://guild.example/api/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }));
      return await response.json();
    } finally { await server.close(); }
  }
  const initialized = await request("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test-client", version: "1.0.0" } });
  assert.equal(initialized.result.serverInfo.name, "bountymesh-guild");
  const listed = await request("tools/list", {});
  assert.deepEqual(listed.result.tools.map((x: { name: string }) => x.name), ["create_guild_task", "get_guild_task"]);
  const invalid = await request("tools/call", { name: "create_guild_task", arguments: { ...task, rewardCents: 5000 } });
  assert.equal(invalid.result.isError, true); assert.equal(posts, 0);
  const posted = await request("tools/call", { name: "create_guild_task", arguments: task });
  assert.equal(JSON.parse(posted.result.content[0].text).id, task.id); assert.equal(posts, 1);
  const read = await request("tools/call", { name: "get_guild_task", arguments: { taskId: task.id } });
  assert.equal(JSON.parse(read.result.content[0].text).ownerId, owner);
});
test("Guild MCP rejects missing authorization before accessing task storage", async () => {
  const result = await POST(new Request("https://guild.example/api/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }) }));
  assert.equal(result.status, 401); assert.match(result.headers.get("www-authenticate") ?? "", /Bearer/);
});
