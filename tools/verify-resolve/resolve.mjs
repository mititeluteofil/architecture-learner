#!/usr/bin/env node
// verify-resolve: turns a day file's `## Verification` items into concrete shell commands for a stack.
// It only RESOLVES. It never executes anything: execution belongs to the verify-day skill.
//
// Usage: node tools/verify-resolve/resolve.mjs --day 1 --stack java [--masterplan <dir-or-manifest>] [--dry-run]
//
// Item forms (see POLYGLOT-PLAN.md section 2.2)
//   - [ ] `raw shell`                          -> passed through unchanged (stack independent)
//   - [ ] verify: <verb> <slot> [args...]      -> stacks/<stack>/verify.yaml template, {dir} / {args} substituted
//   - [ ] verify: discipline p1 baseline       -> dotted verb `discipline.baseline` when the pack defines it
// Anything the pack cannot resolve is reported as { status: 'unsupported' }; the resolver never guesses.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml, stripComment } from '../masterplan-lint/lint.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');

// verify.yaml is a flat `verb: template` map. Templates contain commas, braces and quotes, which the
// lint's general YAML subset would try to interpret, so this loader keeps each value verbatim.
export function parseVerifyYaml(text) {
  const out = {};
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = stripComment(raw);
    if (line.trim() === '') return;
    const m = line.match(/^([A-Za-z0-9_.-]+):[ \t]+(.*?)\s*$/);
    if (!m) throw new Error(`verify.yaml line ${i + 1}: expected "verb: command", got "${line.trim()}"`);
    out[m[1]] = m[2];
  });
  return out;
}

export function loadPack(stack, repo = REPO) {
  const dir = path.join(repo, 'stacks', stack);
  const vf = path.join(dir, 'verify.yaml');
  if (!fs.existsSync(vf)) throw new Error(`unknown stack "${stack}": ${path.relative(repo, vf)} not found`);
  const verbs = parseVerifyYaml(fs.readFileSync(vf, 'utf8'));
  const sf = path.join(dir, 'stack.yaml');
  const stackCfg = fs.existsSync(sf) ? parseYaml(fs.readFileSync(sf, 'utf8')) : {};
  return { verbs, stack: stackCfg ?? {}, file: path.relative(repo, vf).split(path.sep).join('/') };
}

export function loadManifest(target, repo = REPO) {
  let m = target ?? path.join(repo, 'curriculum', 'masterplan.yaml');
  if (fs.existsSync(m) && fs.statSync(m).isDirectory()) m = path.join(m, 'masterplan.yaml');
  return parseYaml(fs.readFileSync(m, 'utf8'));
}

// Project directory for a slot. A manifest `dir` override is a legacy Java location (projects/p1-loan-core-java8),
// so it applies to the java stack only; every other stack gets projects/<slot>-<slug>/<stack>.
export function projectDir(manifest, slotId, stack) {
  const p = manifest?.projects?.[slotId];
  if (!p) return null;
  if (p.dir && stack === 'java') return String(p.dir).replace(/\/+$/, '');
  if (!p.slug) return null;
  return `projects/${slotId}-${p.slug}/${stack}`;
}

export function extractItems(dayText) {
  const lines = dayText.split(/\r?\n/);
  const start = lines.findIndex(l => /^## Verification\s*$/.test(l));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  return lines.slice(start + 1, end)
    .filter(l => /^\s*- \[[ xX]\]/.test(l))
    .map(l => l.replace(/^\s*- \[[ xX]\]\s*/, '').trim());
}

const SLOT = /^(p\d+|capstone)(-.+)?$/;

// Resolve a single checklist item. Returns
//   { item, kind: 'raw'|'verb', status: 'ok'|'unsupported', command?, verb?, slot?, reason? }
export function resolveItem(item, ctx) {
  const v = item.match(/^verify:\s*(.*)$/);
  if (!v) {
    const raw = item.match(/^`([^`]+)`/);
    if (!raw) return { item, kind: 'raw', status: 'unsupported', reason: 'item is neither "verify: <verb> <slot>" nor starts with a backticked command' };
    return { item, kind: 'raw', status: 'ok', command: raw[1] };
  }
  const [verb, slotTok, ...rest] = v[1].replace(/\s+#.*$/, '').trim().split(/\s+/);
  const fail = reason => ({ item, kind: 'verb', status: 'unsupported', verb, slot: slotTok, reason });
  if (!verb) return fail('empty verify item');
  const { pack, manifest, stack } = ctx;
  const where = `stacks/${stack}/verify.yaml`;

  // dotted verb first (`discipline p1 baseline` -> discipline.baseline), then the plain verb with all extras as {args}
  let key = null; let args = rest;
  if (rest.length && Object.hasOwn(pack.verbs, `${verb}.${rest[0]}`)) { key = `${verb}.${rest[0]}`; args = rest.slice(1); }
  else if (Object.hasOwn(pack.verbs, verb)) key = verb;
  if (!key) {
    const dotted = Object.keys(pack.verbs).filter(k => k.startsWith(`${verb}.`));
    const hint = dotted.length ? ` (the pack defines ${dotted.join(', ')}; the sub-verb is missing or misspelled)` : '';
    return fail(`verb "${verb}" is not defined by the ${stack} pack${hint}: add it to ${where}`);
  }
  if (!slotTok || !SLOT.test(slotTok)) return fail(`"${verb}" needs a project slot such as p1 as its first argument`);
  const slotId = slotTok.match(SLOT)[1];
  const dir = projectDir(manifest, slotId, stack);
  if (!dir) return fail(`slot "${slotId}" is not mapped (with a slug) in the masterplan manifest`);

  const subs = { dir, args: args.join(' '), ...numericKeys(pack.stack, ['image_size_max_mb']) };
  const missing = [];
  const command = pack.verbs[key].replace(/\{(dir|args|image_size_max_mb)\}/g, (m, name) => {
    if (subs[name] === undefined) { missing.push(name); return m; }
    return subs[name];
  });
  if (missing.length) return fail(`"${key}" needs stack.yaml key ${missing.join(', ')}, which is not set`);
  return { item, kind: 'verb', status: 'ok', verb: key, slot: slotId, command };
}

function numericKeys(cfg, keys) {
  const o = {};
  for (const k of keys) if (cfg && cfg[k] !== undefined && cfg[k] !== null) o[k] = String(cfg[k]);
  return o;
}

export function resolveDay({ day, stack, masterplan, repo = REPO }) {
  const manifest = loadManifest(masterplan, repo);
  const daysDir = manifest?.paths?.days ?? 'curriculum/day-by-day';
  const file = path.join(repo, daysDir, `day-${String(day).padStart(2, '0')}.md`);
  if (!fs.existsSync(file)) throw new Error(`day file not found: ${path.relative(repo, file)}`);
  const items = extractItems(fs.readFileSync(file, 'utf8'));
  if (!items || !items.length) throw new Error(`no "## Verification" checklist items in ${path.relative(repo, file)}`);
  const ctx = { pack: loadPack(stack, repo), manifest, stack };
  return { day, stack, results: items.map(i => resolveItem(i, ctx)) };
}

function main(argv) {
  const opt = { dry: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opt.dry = true;
    else if (a === '--day') opt.day = Number(argv[++i]);
    else if (a === '--stack') opt.stack = argv[++i];
    else if (a === '--masterplan') opt.masterplan = argv[++i];
    else { console.error(`unknown argument ${a}`); return 2; }
  }
  if (!Number.isInteger(opt.day) || !opt.stack) {
    console.error('usage: resolve.mjs --day N --stack <id> [--masterplan <dir>] [--dry-run]');
    return 2;
  }
  if (!opt.dry) console.error('note: the resolver never executes commands; printing them (same as --dry-run).');
  let r;
  try { r = resolveDay(opt); } catch (e) { console.error(`resolve error: ${e.message}`); return 2; }
  let bad = 0;
  r.results.forEach((x, i) => {
    if (x.status === 'ok') console.log(`${i + 1}. [${x.kind}] ${x.command}`);
    else { bad++; console.log(`${i + 1}. [unsupported] ${x.item}\n     -> ${x.reason}`); }
  });
  return bad ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
