/**
 * PixiForm MCP server (Model Context Protocol, stdio transport, no dependencies).
 *
 * Lets an AI assistant help someone sign up WITHOUT ever handling their password:
 *
 *   1. The assistant calls `validate_registration` / `start_registration` with the
 *      details it knows (name, email, country…). Same shared rules as the form and server.
 *   2. `start_registration` stores them as a short-lived, single-use draft on the
 *      PixiForm server and returns a link.
 *   3. The person opens the link: the canvas form is prefilled, and they type their
 *      password (encrypted in the browser) and accept the terms themselves.
 *
 * Run:   node --experimental-strip-types server/mcp.ts
 * Env:   PIXIFORM_URL     base URL of the PixiForm server (default http://localhost:8787)
 *        AGENT_API_TOKEN  bearer token for /api/drafts (default: .keys/agent-token)
 *
 * Client config (Claude Desktop, Claude Code, Cursor, …):
 *   { "mcpServers": { "pixiform": { "command": "node",
 *       "args": ["--experimental-strip-types", "--no-warnings", "/path/to/pixiform/server/mcp.ts"] } } }
 *
 * Protocol notes: newline-delimited JSON-RPC 2.0 on stdin/stdout; logs go to stderr only.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { REGISTRATION_DRAFT_RULES, registrationDraftSchema } from '../shared/agent.ts';
import { validatePartial } from '../shared/rules.ts';

const BASE = (process.env.PIXIFORM_URL ?? 'http://localhost:8787').replace(/\/+$/, '');
const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'pixiform', title: 'PixiForm registration', version: '0.1.0' };

function agentToken(): string {
  if (process.env.AGENT_API_TOKEN) return process.env.AGENT_API_TOKEN;
  const f = fileURLToPath(new URL('../.keys/agent-token', import.meta.url));
  if (!existsSync(f)) throw new Error('No agent token: start the PixiForm server once, or set AGENT_API_TOKEN.');
  return readFileSync(f, 'utf8').trim();
}

// ------------------------------------------------------------------ tools
interface ToolResult {
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

const text = (t: string, structured?: Record<string, unknown>, isError = false): ToolResult => ({
  content: [{ type: 'text', text: t }],
  ...(structured ? { structuredContent: structured } : {}),
  ...(isError ? { isError: true } : {}),
});

const formatErrors = (errors: Record<string, string>) =>
  Object.entries(errors)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

const TOOLS = [
  {
    name: 'validate_registration',
    title: 'Check registration details',
    description:
      'Checks account details against the sign-up rules without saving anything. Returns field errors to fix. ' +
      'Never ask the user for their password: it is entered later in the secure form.',
    inputSchema: registrationDraftSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'start_registration',
    title: 'Start a registration',
    description:
      'Saves the details the user has given as a draft and returns a secure link (valid 30 minutes, single use). ' +
      'Give the link to the user: they open it, review the prefilled form, set their password and accept the terms themselves. ' +
      'Partial details are fine. Never ask for or pass a password.',
    inputSchema: registrationDraftSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
];

async function callTool(name: string, args: unknown): Promise<ToolResult> {
  const input = args && typeof args === 'object' ? (args as Record<string, unknown>) : {};
  if ('password' in input || 'confirmPassword' in input) {
    return text('Passwords must not be sent through the assistant. Leave them out; the user sets the password in the secure form.', undefined, true);
  }
  const check = validatePartial(REGISTRATION_DRAFT_RULES, input);
  if (name === 'validate_registration') {
    if (!check.ok) return text(`These details need fixing:\n${formatErrors(check.errors)}`, { ok: false, fieldErrors: check.errors });
    const missing = Object.keys(REGISTRATION_DRAFT_RULES).filter((k) => REGISTRATION_DRAFT_RULES[k].required && !(k in input));
    return text(
      missing.length ? `Valid so far. Still missing (the user can also fill these in the form): ${missing.join(', ')}.` : 'All details are valid.',
      { ok: true, missing },
    );
  }
  if (name === 'start_registration') {
    if (!check.ok) return text(`These details need fixing first:\n${formatErrors(check.errors)}`, { ok: false, fieldErrors: check.errors }, true);
    let res: Response;
    try {
      res = await fetch(`${BASE}/api/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${agentToken()}` },
        body: JSON.stringify(check.data),
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      return text(`The registration service is unreachable (${(err as Error).message}).`, undefined, true);
    }
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; expiresAt?: string; message?: string; fieldErrors?: Record<string, string> };
    if (!res.ok || !body.id) {
      const detail = body.fieldErrors ? `\n${formatErrors(body.fieldErrors)}` : '';
      return text(`Could not start the registration: ${body.message ?? res.status}${detail}`, { ok: false, fieldErrors: body.fieldErrors }, true);
    }
    // The id travels in the URL fragment: it isn't sent to servers or leaked in Referer headers.
    const link = `${BASE}/#draft=${body.id}`;
    return text(
      `Registration started. Ask the user to open this link within 30 minutes to review the details, set a password and accept the terms:\n${link}`,
      { ok: true, link, expiresAt: body.expiresAt },
    );
  }
  throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
}

// ------------------------------------------------------------------ JSON-RPC over stdio
type Id = string | number;
interface Message {
  jsonrpc: '2.0';
  id?: Id | null;
  method?: string;
  params?: Record<string, unknown>;
}

const send = (msg: Record<string, unknown>) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
const log = (...a: unknown[]) => console.error('[pixiform-mcp]', ...a);

async function handle(msg: Message): Promise<void> {
  const isRequest = msg.id !== undefined && msg.id !== null;
  try {
    let result: unknown;
    switch (msg.method) {
      case 'initialize': {
        const asked = String(msg.params?.protocolVersion ?? '');
        result = {
          protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions:
            'Helps users create an account. Collect only non-secret details, then call start_registration and share the link. ' +
            'Never request passwords or accept terms on the user’s behalf.',
        };
        break;
      }
      case 'ping':
        result = {};
        break;
      case 'tools/list':
        result = { tools: TOOLS };
        break;
      case 'tools/call':
        result = await callTool(String(msg.params?.name ?? ''), msg.params?.arguments);
        break;
      default:
        if (!isRequest) return; // notifications (e.g. notifications/initialized) need no reply
        throw Object.assign(new Error(`Method not found: ${msg.method}`), { code: -32601 });
    }
    if (isRequest) send({ id: msg.id, result });
  } catch (err) {
    const e = err as Error & { code?: number };
    log(e.message);
    if (isRequest) send({ id: msg.id, error: { code: e.code ?? -32603, message: e.message } });
  }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg: Message;
  try {
    msg = JSON.parse(line) as Message;
  } catch {
    send({ id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }
  if (Array.isArray(msg)) {
    send({ id: null, error: { code: -32600, message: 'Batches are not supported' } });
    return;
  }
  void handle(msg);
});
rl.on('close', () => process.exit(0));
log(`ready (forms at ${BASE})`);
