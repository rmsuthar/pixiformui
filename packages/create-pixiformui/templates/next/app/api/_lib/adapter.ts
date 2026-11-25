// Adapts the framework-neutral API in server/app.mjs to Next.js route handlers.
interface PlainResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export const toPlain = (req: Request) => ({
  method: req.method,
  headers: Object.fromEntries(req.headers), // lower-case names
  ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local',
  text: () => req.text(),
});

export const toResponse = (r: PlainResponse) => new Response(r.body, { status: r.status, headers: r.headers });
