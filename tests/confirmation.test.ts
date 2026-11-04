import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfirmationGate } from '../lib/confirmation';

test('no mutation proceeds before an explicit positive confirmation', async () => {
  const gate = createConfirmationGate();
  let mutations = 0;
  const action = async () => {
    if (await gate.request()) mutations++;
  };
  const waiting = action();
  await Promise.resolve();
  assert.equal(mutations, 0);
  assert.equal(gate.pending, true);
  gate.settle(false);
  await waiting;
  assert.equal(mutations, 0);
  assert.equal(gate.pending, false);
  const accepted = action();
  gate.settle(true);
  await accepted;
  assert.equal(mutations, 1);
});
test('dismissal on Escape/navigation/unmount cancels, duplicate requests and double decisions cannot approve twice', async () => {
  const gate = createConfirmationGate();
  const first = gate.request();
  const duplicate = gate.request();
  assert.equal(await duplicate, false);
  assert.equal(gate.pending, true);
  gate.settle(false);
  gate.settle(true);
  assert.equal(await first, false);
  const next = gate.request();
  gate.settle(true);
  gate.settle(false);
  assert.equal(await next, true);
  const abandoned = gate.request();
  gate.settle(false);
  assert.equal(await abandoned, false);
});
test('an unmounted caller cancels only its own pending decision, never another caller', async () => {
  const gate = createConfirmationGate();
  const first = Symbol('first'),
    second = Symbol('second');
  const abandoned = gate.request(first);
  assert.equal(gate.cancel(first), true);
  assert.equal(await abandoned, false);
  const active = gate.request(second);
  assert.equal(gate.cancel(first), false);
  assert.equal(gate.pending, true);
  gate.settle(true);
  assert.equal(await active, true);
});
