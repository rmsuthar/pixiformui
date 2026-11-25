/** Website Worker: the Pro & Cloud waitlist (site/worker.ts).  npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { challengeTime, newChallenge, type Env } from '../site/worker.ts';
import { powToken, searchPow } from '../shared/pow.ts';

const ORIGIN = 'https://pixiformui.lets.gen.in';

function makeEnv(over: Partial<Env> = {}) {
  const store = new Map<string, { value: string; metadata?: unknown }>();
  const env: Env = {
    ASSETS: { fetch: async () => new Response('asset') },
    WAITLIST: {
      get: async (k) => store.get(k)?.value ?? null,
      put: async (k, value, opts) => void store.set(k, { value, metadata: opts?.metadata }),
    },
    WAITLIST_SECRET: 'test-secret-0123456789',
    POW_DIFFICULTY: '8',
    MIN_FILL_MS: '0',
    ...over,
  };
  return { env, store };
}

async function solved(env: Env): Promise<string> {
  const res = await worker.fetch(new Request(`${ORIGIN}/api/waitlist/session`), env);
  const { pow } = (await res.json()) as { pow: { challenge: string; difficulty: number } };
  const nonce = searchPow(pow, 0, 1_000_000);
  assert.notEqual(nonce, null);
  return powToken(pow, nonce!);
}

const post = (env: Env, body: unknown, headers: Record<string, string> = {}) =>
  worker.fetch(
    new Request(`${ORIGIN}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.7', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env,
  );

const valid = { email: 'Ada@Example.com', name: 'Ada', company: 'Engines', teamSize: '2-10', interest_cloud: true, interest_card: true, interest_pro: false, interest_enterprise: false, message: 'Card field please', consent: true, source: 'pro-page' };

test('challenges are signed and carry their issue time', async () => {
  const secret = 's3cret-value';
  const t = Date.UTC(2026, 10, 25, 12, 0, 0);
  const c = await newChallenge(secret, t);
  assert.match(c, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(await challengeTime(secret, c), t);
  assert.equal(await challengeTime('other-secret', c), null);
  const forged = c.slice(0, 4) + (c[4] === 'A' ? 'B' : 'A') + c.slice(5);
  assert.equal(await challengeTime(secret, forged), null);
});

test('a valid sign-up is stored once per email (normalised), with metadata for export', async () => {
  const { env, store } = makeEnv();
  const res = await post(env, valid, { 'X-Form-Proof': await solved(env) });
  assert.equal(res.status, 200);
  assert.match(((await res.json()) as { message: string }).message, /on the list/);
  const rec = [...store].find(([k]) => k.startsWith('wl:'))!;
  const data = JSON.parse(rec[1].value);
  assert.equal(data.email, 'ada@example.com');
  assert.deepEqual(data.interests, ['cloud', 'card-field']);
  assert.equal((rec[1].metadata as { email: string }).email, 'ada@example.com');

  const again = await post(env, { ...valid, email: 'ada@example.com', company: 'Engines Ltd' }, { 'X-Form-Proof': await solved(env) });
  assert.match(((await again.json()) as { message: string }).message, /already on the list/);
  assert.equal([...store.keys()].filter((k) => k.startsWith('wl:')).length, 1);
});

test('the proof is required, must be genuine, and works once', async () => {
  const { env } = makeEnv();
  assert.equal((await post(env, valid)).status, 400);
  const forged = powToken({ challenge: 'A'.repeat(32), difficulty: 8 }, 1);
  assert.equal((await post(env, valid, { 'X-Form-Proof': forged })).status, 400);
  const proof = await solved(env);
  assert.equal((await post(env, valid, { 'X-Form-Proof': proof })).status, 200);
  assert.equal((await post(env, valid, { 'X-Form-Proof': proof })).status, 400); // reused
});

test('too-fast submissions, cross-site posts and unknown fields are refused', async () => {
  const slow = makeEnv({ MIN_FILL_MS: '60000' });
  assert.equal((await post(slow.env, valid, { 'X-Form-Proof': await solved(slow.env) })).status, 400);
  const { env } = makeEnv();
  assert.equal((await post(env, valid, { Origin: 'https://evil.example', 'X-Form-Proof': await solved(env) })).status, 403);
  assert.equal((await post(env, { ...valid, admin: true }, { 'X-Form-Proof': await solved(env) })).status, 400);
});

test('field errors come back per field', async () => {
  const { env } = makeEnv();
  const res = await post(env, { ...valid, email: 'nope', consent: false, teamSize: '9000' }, { 'X-Form-Proof': await solved(env) });
  assert.equal(res.status, 422);
  const body = (await res.json()) as { fieldErrors: Record<string, string> };
  assert.deepEqual(Object.keys(body.fieldErrors).sort(), ['consent', 'email', 'teamSize']);
});

test('without a signing secret the API refuses to run', async () => {
  const { env } = makeEnv({ WAITLIST_SECRET: '' });
  assert.equal((await worker.fetch(new Request(`${ORIGIN}/api/waitlist/session`), env)).status, 503);
});

test('rate limit per IP, and other paths fall through to static files', async () => {
  const { env } = makeEnv({ RATE_LIMIT: '2' });
  for (let i = 0; i < 2; i++) await post(env, valid, { 'X-Form-Proof': await solved(env) });
  assert.equal((await post(env, valid, { 'X-Form-Proof': await solved(env) })).status, 429);
  assert.equal(await (await worker.fetch(new Request(`${ORIGIN}/docs/`), env)).text(), 'asset');
  assert.equal((await worker.fetch(new Request(`${ORIGIN}/api/nope`), env)).status, 404);
});

test('new answers are validated; the website is normalised; long answers still fit the export metadata', async () => {
  const { env, store } = makeEnv();
  const bad = await post(env, { ...valid, useCase: 'Spam', website: 'not a url' }, { 'X-Form-Proof': await solved(env) });
  assert.equal(bad.status, 422);
  assert.deepEqual(Object.keys(((await bad.json()) as { fieldErrors: object }).fieldErrors).sort(), ['useCase', 'website']);
  const ok = await post(env, { ...valid, website: 'example.com', useCase: 'Payments or checkout', volume: '1,000–10,000', current: 'Nothing yet', timeline: 'Right away', message: 'x'.repeat(1000), company: 'c'.repeat(120) }, { 'X-Form-Proof': await solved(env) });
  assert.equal(ok.status, 200);
  const rec = [...store].find(([k]) => k.startsWith('wl:'))![1];
  assert.equal(JSON.parse(rec.value).website, 'https://example.com');
  assert.equal(JSON.parse(rec.value).timeline, 'Right away');
  assert.ok(JSON.stringify(rec.metadata).length <= 1000);
});

test('after a sign-up: a confirmation to them (first time only) and a notification to the owner', async () => {
  const sent: { to: string[]; subject: string; reply_to?: string; html: string }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input) === 'https://api.resend.com/emails') sent.push(JSON.parse(String(init?.body)));
    return new Response('{}');
  };
  try {
    const { env } = makeEnv({ RESEND_API_KEY: 're_test', MAIL_FROM: 'PixiFormUI <hello@pixiformui.lets.gen.in>', OWNER_EMAIL: 'owner@example.com' });
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p) };
    const send = async (body: unknown) => {
      const res = await worker.fetch(new Request(`${ORIGIN}/api/waitlist`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.8', 'X-Form-Proof': await solved(env) }, body: JSON.stringify(body) }), env, ctx);
      await Promise.all(pending.splice(0));
      return res;
    };
    await send({ ...valid, company: 'Engines <b>Ltd</b>' });
    assert.deepEqual(sent.map((m) => [m.to[0], m.subject]), [
      ['ada@example.com', 'You’re on the PixiFormUI Pro & Cloud waitlist'],
      ['owner@example.com', 'New waitlist sign-up: Engines <b>Ltd</b>'],
    ]);
    assert.equal(sent[0].reply_to, 'owner@example.com'); // replies reach the owner
    assert.equal(sent[1].reply_to, 'ada@example.com'); // the owner can answer them directly
    assert.ok(sent[0].html.includes('https://cloud.pixiformui.lets.gen.in'));
    assert.ok(sent[1].html.includes('Engines &lt;b&gt;Ltd&lt;/b&gt;') && !sent[1].html.includes('<b>Ltd'));
    sent.length = 0;
    await send({ ...valid, company: 'Engines Ltd' }); // the same address again
    assert.deepEqual(sent.map((m) => [m.to[0], m.subject]), [['owner@example.com', 'Waitlist sign-up updated: Engines Ltd']]); // no second confirmation
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('without a Resend key, sign-ups are stored and no email is attempted', async () => {
  let calls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => (calls++, new Response('{}'));
  try {
    const { env, store } = makeEnv();
    const pending: Promise<unknown>[] = [];
    const res = await worker.fetch(new Request(`${ORIGIN}/api/waitlist`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Form-Proof': await solved(env) }, body: JSON.stringify(valid) }), env, { waitUntil: (p) => void pending.push(p) });
    await Promise.all(pending);
    assert.equal(res.status, 200);
    assert.ok([...store.keys()].some((k) => k.startsWith('wl:')));
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});
