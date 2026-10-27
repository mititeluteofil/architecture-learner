#!/usr/bin/env node
// masterplan-lint: dependency-free checks for the spine, a masterplan manifest, its day files and vectors.
//
// Usage: node tools/masterplan-lint/lint.mjs [masterplan-dir-or-manifest]   (default: curriculum/masterplan.yaml)
//
// Rules
//   E  every spine slot is mapped in masterplan `projects`; no unknown slots
//   E  day-01 file must exist; later day files that do not exist yet are WARNINGS (lazily created per project)
//   E  every existing day file has a `## Verification` block
//   E  `verify:` verbs must be known; backticked raw shell is always allowed
//   E  vectors/*.json parse and have the documented shape (see curriculum/vectors/README.md)
// Exit code 1 when any error is reported; warnings do not fail the run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KNOWN_VERBS = ['build', 'discipline', 'vectors', 'arch', 'property', 'contract', 'image'];

// ---------------------------------------------------------------- YAML subset
// Supported: block maps, block lists, flow maps { a: b }, flow lists [a, b], quoted/plain scalars, # comments.
export function parseYaml(text) {
  const lines = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const stripped = stripComment(raw);
    if (stripped.trim() === '') return;
    lines.push({ indent: stripped.match(/^ */)[0].length, text: stripped.trim(), no: i + 1 });
  });
  let pos = 0;
  const fail = (msg, l) => { throw new Error(`YAML line ${l ? l.no : '?'}: ${msg}`); };
  const isItem = t => t.startsWith('- ') || t === '-';

  function block(indent) {
    const l = lines[pos];
    if (!l || l.indent < indent) return null;
    return isItem(l.text) ? blockList(l.indent) : blockMap(l.indent);
  }
  function blockList(indent) {
    const out = [];
    while (pos < lines.length && lines[pos].indent === indent && isItem(lines[pos].text)) {
      const l = lines[pos++];
      const rest = l.text.slice(1).trim();
      out.push(rest === '' ? block(indent + 1) : value(rest, l));
    }
    return out;
  }
  function blockMap(indent) {
    const out = {};
    while (pos < lines.length && lines[pos].indent === indent && !isItem(lines[pos].text)) {
      const l = lines[pos];
      const kv = splitKey(l.text);
      if (!kv) fail(`expected "key: value", got "${l.text}"`, l);
      pos++;
      if (kv.rest === '') {
        const next = lines[pos];
        out[kv.key] = next && next.indent > indent ? block(next.indent) : null;
      } else out[kv.key] = value(kv.rest, l);
    }
    if (pos < lines.length && lines[pos].indent > indent) fail('unexpected indentation', lines[pos]);
    return out;
  }
  function value(s, l) {
    const p = flow(s, 0, l);
    if (s.slice(p.end).trim() !== '') fail(`trailing text "${s.slice(p.end).trim()}"`, l);
    return p.value;
  }
  function skip(s, i) { while (s[i] === ' ') i++; return i; }
  function flow(s, i, l) {
    i = skip(s, i);
    if (s[i] === '{') {
      const obj = {}; i++;
      for (;;) {
        i = skip(s, i);
        if (i >= s.length) fail('unterminated "{"', l);
        if (s[i] === '}') return { value: obj, end: i + 1 };
        const k = scalar(s, i, ':', l); i = k.end;
        if (s[i] !== ':') fail('expected ":" in flow map', l);
        const v = flow(s, i + 1, l); obj[k.raw] = v.value; i = skip(s, v.end);
        if (s[i] === ',') i++; else if (s[i] !== '}') fail('expected "," or "}"', l);
      }
    }
    if (s[i] === '[') {
      const arr = []; i++;
      for (;;) {
        i = skip(s, i);
        if (i >= s.length) fail('unterminated "["', l);
        if (s[i] === ']') return { value: arr, end: i + 1 };
        const v = flow(s, i, l); arr.push(v.value); i = skip(s, v.end);
        if (s[i] === ',') i++; else if (s[i] !== ']') fail('expected "," or "]"', l);
      }
    }
    const r = scalar(s, i, ',}]', l);
    return { value: coerce(r.raw, r.quoted), end: r.end };
  }
  function scalar(s, i, stops, l) {
    i = skip(s, i);
    if (s[i] === '"' || s[i] === "'") {
      const q = s[i]; let j = i + 1; let str = '';
      while (j < s.length && s[j] !== q) { if (s[j] === '\\' && q === '"') j++; str += s[j]; j++; }
      if (s[j] !== q) fail('unterminated quote', l);
      return { raw: str, quoted: true, end: j + 1 };
    }
    let j = i;
    while (j < s.length && !stops.includes(s[j])) j++;
    return { raw: s.slice(i, j).trim(), quoted: false, end: j };
  }
  function coerce(raw, quoted) {
    if (quoted) return raw;
    if (/^-?\d+$/.test(raw)) return Number(raw);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null' || raw === '~') return null;
    return raw;
  }
  function splitKey(t) {
    const m = t.match(/^([A-Za-z0-9_.-]+):(?:\s+(.*))?$/);
    return m ? { key: m[1], rest: (m[2] ?? '').trim() } : null;
  }
  const result = lines.length ? block(lines[0].indent) : null;
  if (pos < lines.length) fail('could not parse remaining content', lines[pos]);
  return result;
}

function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

// ---------------------------------------------------------------- checks
export function validateVector(file, data) {
  const errs = [];
  const need = (c, m) => { if (!c) errs.push(`${file}: ${m}`); };
  need(data && typeof data === 'object' && !Array.isArray(data), 'top level must be an object');
  if (errs.length) return errs;
  need(typeof data.name === 'string' && data.name, '"name" must be a non-empty string');
  need(data.name === path.basename(file, '.json'), `"name" (${data.name}) must match the file name`);
  need(Number.isInteger(data.version), '"version" must be an integer');
  need(Array.isArray(data.cases) && data.cases.length > 0, '"cases" must be a non-empty array');
  const ids = new Set();
  (Array.isArray(data.cases) ? data.cases : []).forEach((c, i) => {
    const w = `cases[${i}]`;
    if (!c || typeof c !== 'object') return need(false, `${w} must be an object`);
    need(typeof c.id === 'string' && c.id, `${w}.id must be a non-empty string`);
    need(!ids.has(c.id), `${w}.id "${c.id}" is duplicated`);
    ids.add(c.id);
    need(typeof c.input === 'string', `${w}.input must be a decimal string`);
    need(typeof c.expected === 'string', `${w}.expected must be a decimal string`);
    if (data.name === 'money-rounding') {
      need(typeof c.mode === 'string' && c.mode, `${w}.mode must name a rounding mode`);
      need(Number.isInteger(c.scale), `${w}.scale must be an integer`);
    }
  });
  return errs;
}

export function checkDayFile(file, text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(l => /^## Verification\s*$/.test(l));
  if (start < 0) return [`${file}: missing "## Verification" block`];
  const errors = [];
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  const items = lines.slice(start + 1, end).filter(l => /^\s*- \[[ xX]\]/.test(l));
  if (items.length === 0) errors.push(`${file}: "## Verification" block has no checklist items`);
  for (const l of items) {
    const body = l.replace(/^\s*- \[[ xX]\]\s*/, '');
    const v = body.match(/^verify:\s*(\S+)/);
    if (v) {
      if (!KNOWN_VERBS.includes(v[1])) errors.push(`${file}: unknown verify verb "${v[1]}" (known: ${KNOWN_VERBS.join(', ')})`);
    } else if (!body.includes('`')) {
      errors.push(`${file}: checklist item is neither "verify: <verb>" nor backticked shell: "${body}"`);
    }
  }
  return errors;
}

function findRoot(from) {
  let d = path.resolve(from);
  for (;;) {
    if (fs.existsSync(path.join(d, 'curriculum', 'spine.yaml'))) return d;
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
}

export function lint(target) {
  const errors = []; const warnings = [];
  let manifest = target;
  if (fs.existsSync(manifest) && fs.statSync(manifest).isDirectory()) manifest = path.join(manifest, 'masterplan.yaml');
  if (!fs.existsSync(manifest)) return { errors: [`manifest not found: ${manifest}`], warnings };
  const root = findRoot(path.dirname(path.resolve(manifest)));
  if (!root) return { errors: ['could not locate curriculum/spine.yaml above the manifest'], warnings };

  let spine, mp;
  try { spine = parseYaml(fs.readFileSync(path.join(root, 'curriculum', 'spine.yaml'), 'utf8')); }
  catch (e) { return { errors: [`spine.yaml: ${e.message}`], warnings }; }
  try { mp = parseYaml(fs.readFileSync(manifest, 'utf8')); }
  catch (e) { return { errors: [`${manifest}: ${e.message}`], warnings }; }

  const slots = Array.isArray(spine?.slots) ? spine.slots : [];
  if (!slots.length) errors.push('spine.yaml: no slots');
  for (const s of slots) {
    if (!s.id || !s.concept || !Array.isArray(s.days) || s.days.length !== 2) errors.push(`spine.yaml: slot ${s.id ?? '?'} needs id, concept and days: [from, to]`);
  }
  for (const k of ['id', 'title']) if (!mp?.[k]) errors.push(`manifest: missing "${k}"`);
  const projects = mp?.projects ?? {};
  for (const s of slots) {
    const p = projects[s.id];
    if (!p) errors.push(`manifest: spine slot "${s.id}" is not mapped in projects`);
    else if (!p.slug) errors.push(`manifest: projects.${s.id} has no slug`);
    else if (!p.brief) errors.push(`manifest: projects.${s.id} has no brief`);
    if (p?.dir && !fs.existsSync(path.join(root, p.dir))) warnings.push(`manifest: projects.${s.id}.dir "${p.dir}" does not exist yet`);
  }
  for (const id of Object.keys(projects)) if (!slots.some(s => s.id === id)) errors.push(`manifest: projects.${id} is not a spine slot`);

  const abs = p => path.join(root, p ?? '');
  const daysDir = mp?.paths?.days;
  if (!daysDir) errors.push('manifest: missing paths.days');
  else {
    for (const s of slots) {
      if (!Array.isArray(s.days)) continue;
      for (let d = s.days[0]; d <= s.days[1]; d++) {
        const name = `day-${String(d).padStart(2, '0')}.md`;
        const f = path.join(abs(daysDir), name);
        const shown = path.posix.join(daysDir, name);
        if (!fs.existsSync(f)) {
          (d === 1 ? errors : warnings).push(`${shown}: day file does not exist${d === 1 ? '' : ' yet (lazily created)'}`);
          continue;
        }
        errors.push(...checkDayFile(shown, fs.readFileSync(f, 'utf8')));
      }
    }
  }
  const vdir = mp?.paths?.vectors;
  if (vdir && fs.existsSync(abs(vdir))) {
    for (const f of fs.readdirSync(abs(vdir)).filter(n => n.endsWith('.json'))) {
      const shown = path.posix.join(vdir, f);
      try { errors.push(...validateVector(shown, JSON.parse(fs.readFileSync(path.join(abs(vdir), f), 'utf8')))); }
      catch (e) { errors.push(`${shown}: invalid JSON (${e.message})`); }
    }
  } else if (vdir) warnings.push(`manifest: vectors dir "${vdir}" does not exist`);
  return { errors, warnings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = findRoot(process.cwd());
  const target = process.argv[2] ?? path.join(root ?? '.', 'curriculum', 'masterplan.yaml');
  const { errors, warnings } = lint(target);
  warnings.forEach(w => console.log(`WARN  ${w}`));
  errors.forEach(e => console.log(`ERROR ${e}`));
  console.log(`masterplan-lint: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length ? 1 : 0);
}
