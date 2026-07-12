import assert from 'node:assert/strict';
import test from 'node:test';
import { decideDataOwnerAction } from './database';

test('same authenticated owner preserves persisted offline work on reload', () => {
  assert.equal(decideDataOwnerAction('user-a', 'user-a'), 'preserve');
});

test('a changed identity clears before claiming persisted offline work', () => {
  assert.equal(decideDataOwnerAction('user-a', 'user-b'), 'clear-and-claim');
  assert.equal(decideDataOwnerAction(null, 'user-b'), 'clear-and-claim');
});

test('sign-out clears the persisted owner and all owned records', () => {
  assert.equal(decideDataOwnerAction('user-a', null), 'clear');
});
