import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml, lint, checkDayFile, validateVector } from './lint.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');

test('parseYaml handles maps, lists, flow values and comments', () => {
  const y = parseYaml('a: 1 # c\nb:\n  - { id: p1, days: [1, 3], brief: "x: y # z" }\n  - plain\nc: { k: v }\n');
  assert.deepEqual(y, { a: 1, b: [{ id: 'p1', days: [1, 3], brief: 'x: y # z' }, 'plain'], c: { k: 'v' } });
});

test('parseYaml rejects garbage', () => {
  assert.throws(() => parseYaml('a: { b: 1\n'));
});

test('real Loan Servicing manifest passes', () => {
  const r = lint(path.join(repo, 'curriculum', 'masterplan.yaml'));
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some(w => w.includes('day-02.md')));
});

test('template passes', () => {
  assert.deepEqual(lint(path.join(repo, 'curriculum', 'masterplans', '_template')).errors, []);
});

test('day file rules', () => {
  assert.equal(checkDayFile('d', '# x\n').length, 1);
  assert.deepEqual(checkDayFile('d', '## Verification\n\n- [ ] verify: build p1\n- [ ] `ls`\n\n## Next\n'), []);
  assert.match(checkDayFile('d', '## Verification\n- [ ] verify: teleport p1\n')[0], /unknown verify verb/);
  assert.match(checkDayFile('d', '## Verification\n- [ ] do the thing\n')[0], /neither/);
});

test('vector shape', () => {
  const good = { name: 'v', version: 1, cases: [{ id: 'a', input: '1', expected: '1' }] };
  assert.deepEqual(validateVector('v.json', good), []);
  assert.ok(validateVector('v.json', { ...good, cases: [{ id: 'a', input: 1, expected: '1' }] }).length > 0);
  assert.ok(validateVector('x.json', good).length > 0);
});

test('unmapped slot and missing day-01 are errors, later days are not', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mpl-'));
  fs.mkdirSync(path.join(tmp, 'curriculum'));
  fs.copyFileSync(path.join(repo, 'curriculum', 'spine.yaml'), path.join(tmp, 'curriculum', 'spine.yaml'));
  fs.writeFileSync(path.join(tmp, 'curriculum', 'masterplan.yaml'),
    'id: t\ntitle: T\npaths: { days: curriculum/days }\nprojects:\n  p1: { slug: a, brief: b }\n');
  const r = lint(path.join(tmp, 'curriculum', 'masterplan.yaml'));
  assert.ok(r.errors.some(e => e.includes('"p2" is not mapped')));
  assert.ok(r.errors.some(e => e.includes('day-01.md')));
  assert.ok(!r.errors.some(e => e.includes('day-02.md')));
});
