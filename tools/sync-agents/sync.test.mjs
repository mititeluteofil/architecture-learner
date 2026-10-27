import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sync, diff } from './sync.mjs';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-agents-'));
  const ov = path.join(root, 'overrides');
  const put = async (p, c) => {
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, c);
  };
  await put(path.join(root, '.claude/agents/a.md'), 'agent\n');
  await put(path.join(root, '.claude/commands/c.md'), 'cmd\n');
  await put(path.join(root, '.claude/commands/d.md'), 'claude d\n');
  await put(path.join(root, '.claude/skills/s/SKILL.md'), 'skill\n');
  await put(path.join(ov, 'commands/d.md'), 'junie d\n');
  return { root, ov, put };
}

test('write mode creates files and applies overrides', async () => {
  const { root, ov } = await fixture();
  await sync(root, ov);
  assert.equal(await fs.readFile(path.join(root, '.junie/agents/a.md'), 'utf8'), 'agent\n');
  assert.equal(await fs.readFile(path.join(root, '.junie/commands/d.md'), 'utf8'), 'junie d\n');
  assert.equal(await fs.readFile(path.join(root, '.junie/skills/s/SKILL.md'), 'utf8'), 'skill\n');
});

test('check reports drift, passes after sync, ignores CRLF', async () => {
  const { root, ov, put } = await fixture();
  const before = await sync(root, ov, { check: true });
  assert.equal(before.drift.length, 4);
  await sync(root, ov);
  assert.deepEqual((await sync(root, ov, { check: true })).drift, []);
  await put(path.join(root, '.junie/agents/a.md'), 'agent\r\n');
  assert.deepEqual((await sync(root, ov, { check: true })).drift, []);
  await put(path.join(root, '.junie/agents/a.md'), 'edited\n');
  assert.deepEqual((await sync(root, ov, { check: true })).drift, ['agents/a.md']);
});

test('stale junie files are removed in write mode but junie/mcp is untouched', async () => {
  const { root, ov, put } = await fixture();
  await sync(root, ov);
  await put(path.join(root, '.junie/agents/old.md'), 'x');
  await put(path.join(root, '.junie/mcp/mcp.json'), '{}');
  assert.deepEqual((await diff(root, ov)).stale, ['agents/old.md']);
  await sync(root, ov);
  await assert.rejects(fs.access(path.join(root, '.junie/agents/old.md')));
  assert.equal(await fs.readFile(path.join(root, '.junie/mcp/mcp.json'), 'utf8'), '{}');
});
