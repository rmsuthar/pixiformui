/** Unit tests for analytics adapters (no browser needed).  npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AnalyticsEvent } from '../src/lib/analytics.ts';
import { analyticsAdapters, flattenEvent } from '../src/lib/analyticsAdapters.ts';

const ev: AnalyticsEvent = {
  type: 'submit_invalid',
  formId: 'signup',
  formSessionId: 'abc',
  t: 1200,
  errorCount: 2,
  errorFields: ['email', 'terms'],
};

test('flattenEvent turns arrays into short comma lists and keeps scalars', () => {
  assert.deepEqual(flattenEvent(ev, ['type']), { formId: 'signup', formSessionId: 'abc', t: 1200, errorCount: 2, errorFields: 'email,terms' });
  const long = flattenEvent({ ...ev, errorFields: Array.from({ length: 40 }, (_, i) => `field${i}`) });
  assert.ok(String(long.errorFields).length <= 100);
});

test('ga4 adapter prefixes event names and snake_cases parameters', () => {
  const calls: unknown[][] = [];
  analyticsAdapters.ga4({ gtag: (...a) => calls.push(a) })(ev);
  assert.deepEqual(calls[0], ['event', 'pixiform_submit_invalid', { form_id: 'signup', form_session_id: 'abc', t: 1200, error_count: 2, error_fields: 'email,terms' }]);
});

test('dataLayer, segment, posthog and combine adapters', () => {
  (globalThis as any).window = globalThis;
  analyticsAdapters.dataLayer()(ev);
  assert.equal((globalThis as any).dataLayer[0].event, 'pixiform_submit_invalid');
  const seg: [string, object][] = [];
  analyticsAdapters.segment({ track: (n, p) => seg.push([n, p!]) })(ev);
  assert.equal(seg[0][0], 'PixiForm Submit Invalid');
  const ph: string[] = [];
  const bad = () => {
    throw new Error('vendor down');
  };
  const orig = console.warn;
  console.warn = () => {};
  analyticsAdapters.combine(bad, analyticsAdapters.posthog({ capture: (n) => ph.push(n) }))(ev);
  console.warn = orig;
  assert.deepEqual(ph, ['pixiform_submit_invalid']); // one failing handler doesn't stop the others
});
