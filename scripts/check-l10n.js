#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function tokens(value, pattern) {
  return Array.from(String(value).matchAll(pattern), match => match[0]).sort();
}

function assertSameArray(label, file, key, expected, actual) {
  const e = JSON.stringify(expected);
  const a = JSON.stringify(actual);
  if (e !== a) {
    fail(`${file}: ${label} mismatch for key ${JSON.stringify(key)}: expected ${e}, got ${a}`);
  }
}

function assertKeyAndTokenParity(baseFile, localeFiles) {
  const base = readJson(baseFile);
  const baseKeys = Object.keys(base);

  for (const file of localeFiles) {
    const data = readJson(file);
    const keys = Object.keys(data);
    const missing = baseKeys.filter(key => !(key in data));
    const extra = keys.filter(key => !(key in base));

    if (missing.length || extra.length) {
      fail(`${file}: key mismatch. missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`);
      continue;
    }

    for (const key of baseKeys) {
      const baseValue = String(base[key]);
      const localeValue = String(data[key]);

      assertSameArray('placeholder', file, key, tokens(baseValue, /\{\d+\}/g), tokens(localeValue, /\{\d+\}/g));
      assertSameArray('codicon', file, key, tokens(baseValue, /\$\([^)]+\)/g), tokens(localeValue, /\$\([^)]+\)/g));

      const baseNewlines = (baseValue.match(/\n/g) || []).length;
      const localeNewlines = (localeValue.match(/\n/g) || []).length;
      if (baseNewlines !== localeNewlines) {
        fail(`${file}: newline mismatch for key ${JSON.stringify(key)}: expected ${baseNewlines}, got ${localeNewlines}`);
      }
    }
  }
}

assertKeyAndTokenParity('package.nls.json', ['package.nls.de.json', 'package.nls.it.json']);
assertKeyAndTokenParity('l10n/bundle.l10n.json', ['l10n/bundle.l10n.de.json', 'l10n/bundle.l10n.it.json']);

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('Localization keys and placeholders match.');
