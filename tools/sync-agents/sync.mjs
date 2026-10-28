#!/usr/bin/env node
// Regenerates .junie/{agents,commands,skills} from .claude/{agents,commands,skills}.
//
// .claude/ is the source of truth. The trees are byte-identical except where a
// Junie-specific variant is needed (e.g. no Artifact tool in Junie). Such variants
// live in tools/sync-agents/overrides/<tree>/<path> and replace the generated file.
//
// Usage: node tools/sync-agents/sync.mjs [--check] [--root <dir>]
//   default  write mode: copy, apply overrides, delete stale files
//   --check  exit 1 and list files that would change; writes nothing
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TREES = ['agents', 'commands', 'skills'];

async function walk(dir, base = dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const out = [];
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(full, base)));
    else if (ent.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

const norm = (buf) => buf.toString('utf8').replace(/\r\n/g, '\n');

/** Compute the desired state: Map<relative path under .junie, Buffer>. */
export async function plan(root, overridesDir) {
  const desired = new Map();
  for (const tree of TREES) {
    for (const rel of await walk(path.join(root, '.claude', tree))) {
      desired.set(`${tree}/${rel}`, await fs.readFile(path.join(root, '.claude', tree, rel)));
    }
    for (const rel of await walk(path.join(overridesDir, tree))) {
      desired.set(`${tree}/${rel}`, await fs.readFile(path.join(overridesDir, tree, rel)));
    }
  }
  return desired;
}

/** Compare desired against .junie. Returns { missing, changed, stale }. */
export async function diff(root, overridesDir) {
  const desired = await plan(root, overridesDir);
  const missing = [];
  const changed = [];
  const stale = [];
  for (const [rel, buf] of desired) {
    let cur;
    try {
      cur = await fs.readFile(path.join(root, '.junie', rel));
    } catch (e) {
      if (e.code === 'ENOENT') { missing.push(rel); continue; }
      throw e;
    }
    if (norm(cur) !== norm(buf)) changed.push(rel);
  }
  for (const tree of TREES) {
    for (const rel of await walk(path.join(root, '.junie', tree))) {
      if (!desired.has(`${tree}/${rel}`)) stale.push(`${tree}/${rel}`);
    }
  }
  return { desired, missing, changed, stale };
}

export async function sync(root, overridesDir, { check = false } = {}) {
  const { desired, missing, changed, stale } = await diff(root, overridesDir);
  const drift = [...missing, ...changed, ...stale];
  if (check) return { drift };
  for (const rel of [...missing, ...changed]) {
    const dest = path.join(root, '.junie', rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, desired.get(rel));
  }
  for (const rel of stale) await fs.rm(path.join(root, '.junie', rel));
  return { drift };
}

async function main(argv) {
  const check = argv.includes('--check');
  const ri = argv.indexOf('--root');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(ri >= 0 ? argv[ri + 1] : path.join(here, '..', '..'));
  const overridesDir = path.join(here, 'overrides');
  const { drift } = await sync(root, overridesDir, { check });
  if (check) {
    if (drift.length) {
      console.error(`.junie is out of sync with .claude (${drift.length} file(s)):`);
      for (const f of drift) console.error(`  ${f}`);
      console.error('Run: node tools/sync-agents/sync.mjs');
      return 1;
    }
    console.log('.junie is in sync with .claude');
    return 0;
  }
  console.log(drift.length ? `Updated ${drift.length} file(s):\n${drift.map((f) => `  ${f}`).join('\n')}` : 'Already in sync');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await main(process.argv.slice(2)));
}
