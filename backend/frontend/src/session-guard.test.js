import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionGuard } from './session-guard.js';

test('session changes abort old requests and make their responses stale', () => {
  const guard = createSessionGuard();
  guard.transition('account-a');
  const accountARequest = guard.begin();

  guard.transition(null);
  guard.transition('account-b');

  assert.equal(accountARequest.signal.aborted, true);
  assert.equal(accountARequest.isCurrent(), false);
  assert.equal(guard.begin().isCurrent(), true);
});
