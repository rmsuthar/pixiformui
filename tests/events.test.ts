/** Typed form event emitter.  npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FormEvents, PIXIFORM_EVENTS } from '../src/lib/events.ts';

test('on/off/once deliver typed payloads', () => {
  const ev = new FormEvents();
  const got: string[] = [];
  const off = ev.on('change', (d) => got.push(`change:${d.name}`));
  ev.once('load', (d) => got.push(`load:${d.fields}`));
  ev.emit('change', { name: 'email', value: 'x' });
  ev.emit('load', { ms: 1, fields: 3, width: 1, height: 1 });
  ev.emit('load', { ms: 1, fields: 4, width: 1, height: 1 }); // once: ignored
  off();
  ev.emit('change', { name: 'ignored', value: '' });
  assert.deepEqual(got, ['change:email', 'load:3']);
});

test('a throwing listener is reported as an error event and does not stop others', () => {
  const ev = new FormEvents();
  const got: string[] = [];
  ev.on('reset', () => {
    throw new Error('boom');
  });
  ev.on('reset', () => got.push('second listener ran'));
  ev.on('error', (d) => got.push(`${d.phase}:${d.error.message}`));
  ev.emit('reset', {});
  assert.deepEqual(got, ['listener:boom', 'second listener ran']);
});

test('addAll registers known events only', () => {
  const ev = new FormEvents();
  const got: string[] = [];
  ev.addAll({ focus: (d) => got.push(d.name), ...({ notAnEvent: () => got.push('bad') } as object) });
  ev.emit('focus', { name: 'phone' });
  assert.deepEqual(got, ['phone']);
  assert.ok(PIXIFORM_EVENTS.includes('beforesubmit') && PIXIFORM_EVENTS.includes('load'));
});
