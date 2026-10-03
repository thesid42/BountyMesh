import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createGuildMcpServer } from "@/lib/guild-mcp";
import { authorizeGuildMcp } from "@/lib/guild-tasks";
import { readJsonBody, safeError } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    const ownerId = await authorizeGuildMcp(request);
    const body = await readJsonBody(request, 32_768);
    const server = createGuildMcpServer(ownerId);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      const response = await transport.handleRequest(request, { parsedBody: body });
      response.headers.set("cache-control", "no-store"); return response;
    } finally { await server.close(); }
  } catch (error) {
    const e = safeError(error);
    return Response.json({ jsonrpc: "2.0", error: { code: -32000, message: e.message }, id: null }, { status: e.status, headers: { "cache-control": "no-store", ...(e.status === 401 ? { "www-authenticate": 'Bearer realm="BountyMesh Guild"' } : {}) } });
  }
}
// This stateless endpoint uses POST responses; there is no persistent SSE session.
export async function GET() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
export async function DELETE() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
