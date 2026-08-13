import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('workspace does not choose a desktop shell while the viewport is unresolved', () => {
  const source = readFileSync('src/pages/Index.tsx', 'utf8');

  assert.match(
    source,
    /if \(authLoading \|\| patientsLoading \|\| isMobile === undefined\)/,
  );
  assert.match(source, /if \(isMobile !== false\) return;/);
  assert.match(source, /if \(isMobile === undefined\) return undefined;/);
});
