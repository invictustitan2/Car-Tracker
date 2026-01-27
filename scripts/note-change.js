#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const message = process.argv.slice(2).join(' ').trim();

if (!message) {
  console.error('Usage: node scripts/note-change.js "describe the work"');
  process.exit(1);
}

const todoPath = path.resolve(__dirname, '..', 'TODO.md');
const stamp = new Date().toISOString().slice(0, 10);
const entry = `- _${stamp}_ – ${message}`;
const doneHeader = '## Done (dated)';

let content = '';
if (fs.existsSync(todoPath)) {
  content = fs.readFileSync(todoPath, 'utf8');
} else {
  content = '# TODO.md\n\n';
}

if (!content.includes(doneHeader)) {
  content = `${content.trimEnd()}\n\n${doneHeader}\n`;
}

content = `${content.trimEnd()}\n${entry}\n`;

fs.writeFileSync(todoPath, content);
console.log(`Appended to ${todoPath}: ${entry}`);
