import { test } from 'node:test';
import fsMod from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveItem, resolveDay, loadPack, loadManifest, parseVerifyYaml, extractItems, projectDir, REPO } from './resolve.mjs';
import { KNOWN_VERBS } from '../masterplan-lint/lint.mjs';

const manifest = loadManifest(undefined, REPO);
const ctx = stack => ({ pack: loadPack(stack, REPO), manifest, stack });
const STACKS = ['java', 'dotnet', 'node', 'python', 'ruby'];

test('backticked lines pass through unchanged', () => {
  const r = resolveItem('`test -f a/b.md` (note)', ctx('java'));
  assert.deepEqual([r.kind, r.status, r.command], ['raw', 'ok', 'test -f a/b.md']);
});

test('plain text that is neither verb nor backticked is unsupported', () => {
  assert.equal(resolveItem('looks fine to me', ctx('java')).status, 'unsupported');
});

test('build resolves with the manifest dir override for java', () => {
  const r = resolveItem('verify: build p1', ctx('java'));
  assert.equal(r.command, './mvnw -pl projects/p1-loan-core-java8 -am verify');
});

test('non-java stacks ignore the legacy dir override and use projects/p<N>-<slug>/<stack>', () => {
  assert.equal(projectDir(manifest, 'p1', 'python'), 'projects/p1-loan-core/python');
  assert.equal(resolveItem('verify: build p3', ctx('python')).command, 'uv run --directory projects/p3-loan-domain-hex/python pytest -q');
});

test('dotted verb: discipline p1 baseline', () => {
  const r = resolveItem('verify: discipline p1 baseline', ctx('java'));
  assert.equal(r.verb, 'discipline.baseline');
  assert.match(r.command, /^test "\$\(grep -rE 'var \|record \|sealed ' projects\/p1-loan-core-java8\/src\/main\/java \| wc -l\)" -eq 0$/);
});

test('dotted verb with unknown sub-verb is unsupported, with a hint', () => {
  const r = resolveItem('verify: discipline p1 sideways', ctx('java'));
  assert.equal(r.status, 'unsupported');
  assert.match(r.reason, /discipline\.baseline/);
});

test('unknown verb is unsupported and points at the pack file', () => {
  const r = resolveItem('verify: teleport p1', ctx('ruby'));
  assert.equal(r.status, 'unsupported');
  assert.match(r.reason, /stacks\/ruby\/verify\.yaml/);
  assert.equal(r.command, undefined);
});

test('verb missing from a pack is unsupported, never guessed', () => {
  const c = ctx('java'); delete c.pack.verbs.chaos;
  assert.equal(resolveItem('verify: chaos p5', c).status, 'unsupported');
});

test('unmapped slot and missing slot are unsupported', () => {
  assert.equal(resolveItem('verify: build p42', ctx('java')).status, 'unsupported');
  assert.equal(resolveItem('verify: build', ctx('java')).status, 'unsupported');
});

test('{args} is substituted and extra args are tolerated', () => {
  const c = ctx('java'); c.pack.verbs.x = 'run {dir} --only {args}';
  assert.equal(resolveItem('verify: x p1 a b', c).command, 'run projects/p1-loan-core-java8 --only a b');
  assert.equal(resolveItem('verify: vectors p1 money-rounding', ctx('node')).status, 'ok');
});

test('verify: day p1-end resolves the slot from a slot-suffix token', () => {
  assert.equal(resolveItem('verify: day p1-end', ctx('java')).status, 'ok');
});

test('image-size substitutes image_size_max_mb from stack.yaml and keeps docker format braces', () => {
  const r = resolveItem('verify: image-size p7', ctx('java'));
  assert.match(r.command, /\$\(\( 250 \* 1024 \* 1024 \)\)/);
  assert.match(r.command, /\{\{\.Size\}\}/);
});

test('image-size without the stack.yaml key is unsupported', () => {
  const c = ctx('java'); delete c.pack.stack.image_size_max_mb;
  assert.equal(resolveItem('verify: image-size p7', c).status, 'unsupported');
});

test('every verb used by achievements is defined in all five packs and known to the lint', () => {
  
  const files = ['progress/achievements.json', ...STACKS.map(s => `stacks/${s}/achievements.json`)];
  const verbs = new Set();
  for (const f of files) {
    const text = fsMod.readFileSync(path.join(REPO, f), 'utf8');
    for (const m of text.matchAll(/verify:\s*([a-z][a-z-]*)/g)) verbs.add(m[1]);
  }
  assert.ok(verbs.size >= 8);
  for (const v of verbs) {
    assert.ok(KNOWN_VERBS.includes(v), `lint does not know verb ${v}`);
    for (const s of STACKS) assert.ok(Object.hasOwn(loadPack(s, REPO).verbs, v), `${s} pack lacks ${v}`);
  }
});

test('every stack.yaml has the new keys and a complete ci block', () => {
  for (const s of STACKS) {
    const { stack } = loadPack(s, REPO);
    for (const k of ['property_lib', 'aggregate_marker', 'image_size_max_mb']) assert.ok(stack[k], `${s}: ${k}`);
    assert.deepEqual(Object.keys(stack.ci).sort(), ['manifest', 'setup', 'test_cmd', 'test_glob']);
    assert.ok(['java', 'dotnet', 'node', 'python', 'ruby'].includes(stack.ci.setup));
    assert.ok(stack.ci.test_cmd.includes('{dir}'));
    new RegExp(stack.ci.test_glob);
    new RegExp(stack.aggregate_marker.replace('{core_aggregate}', 'Loan'));
  }
});

test('parseVerifyYaml keeps commas, braces and quotes verbatim and strips comments', () => {
  const y = parseVerifyYaml("# c\na.b: x -Dtest='*A,*B' {dir}  # trailing\nc: \"q # not comment\"\n");
  assert.deepEqual(y, { 'a.b': "x -Dtest='*A,*B' {dir}", c: '"q # not comment"' });
});

test('extractItems reads only the Verification block', () => {
  assert.deepEqual(extractItems('## A\n- [ ] no\n## Verification\n\n- [x] one\n- [ ] two\n## B\n- [ ] no\n'), ['one', 'two']);
  assert.equal(extractItems('# nothing'), null);
});

test('real day 1: resolves for all five stacks, java output matches the pre-migration commands', () => {
  const java = resolveDay({ day: 1, stack: 'java' });
  assert.ok(java.results.every(r => r.status === 'ok'));
  assert.equal(java.results[0].command, './mvnw -pl projects/p1-loan-core-java8 -am verify');
  assert.equal(java.results[1].command, `test "$(grep -rE 'var |record |sealed ' projects/p1-loan-core-java8/src/main/java | wc -l)" -eq 0`);
  for (const s of STACKS) assert.ok(resolveDay({ day: 1, stack: s }).results.every(r => r.status === 'ok'), s);
});

test('unknown stack and missing day throw', () => {
  assert.throws(() => resolveDay({ day: 1, stack: 'cobol' }), /unknown stack/);
  assert.throws(() => resolveDay({ day: 99, stack: 'java' }), /day file not found/);
});

