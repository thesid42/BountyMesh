import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { postGuildTask, readGuildTask, type GuildTaskInput } from "./guild-tasks";
import { HttpError } from "./http";

export function createGuildMcpServer(ownerId: string | null, dependencies = { post: postGuildTask, read: readGuildTask }) {
  const server = new McpServer({ name: "bountymesh-guild", version: "1.0.0" });
  const output = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });
  const errorResult = (error: unknown) => ({ ...output({ error: error instanceof HttpError ? error.message : "The Guild Board could not complete this request" }), isError: true });
  server.registerTool("create_guild_task", {
    title: "Post a task to the Guild Board",
    description: "Persist a task on the BountyMesh Guild Board for an operator to fund and run. Posting does not charge money or execute agents. Use the same UUID request key when retrying identical details. Rewards are USD cents in Stripe TEST mode.",
    inputSchema: { title: z.string().trim().min(3).max(120), goal: z.string().trim().min(10).max(2000), rewardCents: z.number().int().min(50).max(500), idempotencyKey: z.string().uuid() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (input: GuildTaskInput) => { try { return output(await dependencies.post(ownerId, input)); } catch (error) { return errorResult(error); } });
  server.registerTool("get_guild_task", {
    title: "Read Guild task status", description: "Read your posted task and its execution status. Owner tokens can only read their own tasks.",
    inputSchema: { taskId: z.string().uuid() }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ taskId }) => { try { return output(await dependencies.read(ownerId, taskId)); } catch (error) { return errorResult(error); } });
  return server;
}
