#!/usr/bin/env node
// Regenerates src/viewer/render.mjs from the TypeScript source
// src/viewer/render.ts. Node refuses to strip types for files under
// node_modules, so the published package must ship plain JavaScript.
//
// Requires Node >= 22.13 (node:module stripTypeScriptTypes).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'src', 'viewer', 'render.ts');
const outputPath = path.join(root, 'src', 'viewer', 'render.mjs');

const source = fs.readFileSync(sourcePath, 'utf8');
const output = stripTypeScriptTypes(source, { mode: 'strip' });
const header =
  '// GENERATED FILE - do not edit.\n' +
  '// Source: src/viewer/render.ts (regenerate with: npm run build:viewer)\n\n';

const generated = (header + output).replace(/[ \t]+$/gm, '');
fs.writeFileSync(outputPath, generated, 'utf8');
process.stdout.write(`[flowlens] wrote ${path.relative(root, outputPath)}\n`);
