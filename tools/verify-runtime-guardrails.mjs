import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const baselinePath = path.join(repoRoot, 'docs', 'runtime-guardrails-baseline.json');
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const runtimeRoot = path.join(repoRoot, baseline.runtimeRoot);
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readRuntimeFile(relativePath) {
  return readFileSync(path.join(runtimeRoot, relativePath));
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function countFiles(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) total += countFiles(fullPath);
    if (entry.isFile()) total += 1;
  }
  return total;
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function assertSameSet(label, actual, expected) {
  const a = sortedUnique(actual);
  const e = sortedUnique(expected);
  const missing = e.filter((item) => !a.includes(item));
  const extra = a.filter((item) => !e.includes(item));
  if (missing.length || extra.length) {
    fail(`${label} mismatch. missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`);
  }
}

function functionChunks(code) {
  const matches = [...code.matchAll(/function ([A-Za-z_$][\w$]*)\(/g)]
    .map((match) => ({ name: match[1], pos: match.index ?? -1 }))
    .filter((item) => item.pos >= 300000);
  return matches.map((item, index) => ({
    ...item,
    end: matches[index + 1]?.pos ?? code.length,
    text: code.slice(item.pos, matches[index + 1]?.pos ?? code.length),
  }));
}

function runtimePathsFromUrl(url) {
  if (!url || /^https?:\/\//i.test(url)) return null;
  const clean = url.replace(/^\//, '');
  const rawPath = path.join(runtimeRoot, clean);
  let decodedPath = rawPath;
  try {
    decodedPath = path.join(runtimeRoot, decodeURIComponent(clean));
  } catch {
    decodedPath = rawPath;
  }
  return sortedUnique([rawPath, decodedPath]);
}

function checkCriticalFiles() {
  for (const file of baseline.criticalFiles) {
    const fullPath = path.join(runtimeRoot, file.path);
    if (!existsSync(fullPath)) {
      fail(`Missing critical runtime file: ${file.path}`);
      continue;
    }
    const buffer = readFileSync(fullPath);
    const actualBytes = buffer.length;
    const actualHash = sha256(buffer);
    if (actualBytes !== file.bytes) {
      fail(`Size changed for ${file.path}: expected ${file.bytes}, got ${actualBytes}`);
    }
    if (actualHash !== file.sha256) {
      fail(`SHA256 changed for ${file.path}: expected ${file.sha256}, got ${actualHash}`);
    }
  }
}

function checkEntryReferences() {
  const html = readRuntimeFile(baseline.entry.html).toString('utf8');
  if (!html.includes(`/${baseline.entry.js}`)) {
    fail(`index.html does not reference /${baseline.entry.js}`);
  }
  if (!html.includes(`/${baseline.entry.css}`)) {
    fail(`index.html does not reference /${baseline.entry.css}`);
  }
}

function checkCssEncoding() {
  const cssBuffer = readRuntimeFile(baseline.entry.css);
  if (cssBuffer[0] === 0xef && cssBuffer[1] === 0xbb && cssBuffer[2] === 0xbf) {
    fail(`${baseline.entry.css} starts with UTF-8 BOM`);
  }
}

function checkRuntimeJs() {
  const code = readRuntimeFile(baseline.entry.js).toString('utf8');
  const chunks = functionChunks(code);
  const byName = new Map(chunks.map((chunk) => [chunk.name, chunk]));
  const root = byName.get('fr');
  if (!root) {
    fail('Missing root runtime function fr');
    return;
  }

  const routes = [...root.text.matchAll(/e===`([^`]+)`/g)].map((match) => match[1]);
  const routeGuards = [...root.text.matchAll(/e!==`([^`]+)`/g)].map((match) => match[1]);
  assertSameSet('Runtime routes', routes, baseline.routes);
  if (!baseline.routes.every((route) => routeGuards.includes(route))) {
    fail(`Runtime placeholder guard does not cover all routes: ${JSON.stringify(routeGuards)}`);
  }

  for (const item of baseline.uiFunctions) {
    const chunk = byName.get(item.name);
    if (!chunk) {
      fail(`Missing UI runtime function ${item.name}`);
      continue;
    }
    if (!chunk.text.includes(item.marker)) {
      fail(`UI runtime function ${item.name} no longer contains marker ${item.marker}`);
    }
  }

  const uiNames = new Set(baseline.uiFunctions.map((item) => item.name));
  const detectedUi = chunks
    .filter((chunk) =>
      chunk.text.includes('className:') ||
      [
        'app-shell',
        'home-screen',
        'page1-',
        'page4-',
        'recorder-',
        'settings-',
        'recommend-',
        'favorites-',
        'placeholder-screen',
      ].some((marker) => chunk.text.includes(marker)),
    )
    .map((chunk) => chunk.name)
    .filter((name) => name !== 'jr');
  const unknownUi = sortedUnique(detectedUi).filter((name) => !uiNames.has(name));
  if (unknownUi.length) {
    fail(`Detected unclassified UI runtime functions: ${unknownUi.join(', ')}`);
  }

  const plugins = sortedUnique([...code.matchAll(/T\(`([^`]+)`/g)].map((match) => match[1]));
  for (const plugin of [...baseline.customPlugins, ...baseline.standardPlugins]) {
    if (!plugins.includes(plugin)) {
      fail(`Missing runtime plugin registration: ${plugin}`);
    }
  }

  for (const key of baseline.storageKeys) {
    if (key.includes('${kind}')) {
      const prefix = key.replace('${kind}', '');
      if (!code.includes(prefix)) fail(`Missing storage key prefix: ${prefix}`);
      continue;
    }
    if (!code.includes(key)) {
      fail(`Missing storage key literal: ${key}`);
    }
  }

  const css = readRuntimeFile(baseline.entry.css).toString('utf8');
  for (const selector of baseline.knownLegacyCssSelectors) {
    if (!css.includes(`.${selector}`)) {
      warn(`Known legacy selector is no longer in CSS: ${selector}`);
    }
    if (code.includes(selector)) {
      fail(`Known legacy selector became active in runtime JS without baseline update: ${selector}`);
    }
  }
}

function checkAndroidPlugins() {
  const javaRoot = path.join(repoRoot, 'android', 'app', 'src', 'main', 'java', 'com', 'bone', 'app');
  const actual = new Map();
  for (const file of readdirSync(javaRoot).filter((name) => name.endsWith('.java'))) {
    const text = readFileSync(path.join(javaRoot, file), 'utf8');
    for (const match of text.matchAll(/@CapacitorPlugin\(name\s*=\s*"([^"]+)"\)/g)) {
      actual.set(match[1], file);
    }
  }
  for (const [plugin, file] of Object.entries(baseline.androidPlugins)) {
    if (actual.get(plugin) !== file) {
      fail(`Android plugin ${plugin} expected in ${file}, got ${actual.get(plugin) ?? 'missing'}`);
    }
  }
  const unexpected = [...actual.keys()].filter((plugin) => !(plugin in baseline.androidPlugins));
  if (unexpected.length) {
    fail(`Unexpected Android custom plugins: ${unexpected.join(', ')}`);
  }
}

function checkRecommendations() {
  const recRoot = path.join(runtimeRoot, 'recommendations');
  const actualTotal = countFiles(recRoot);
  if (actualTotal !== baseline.recommendations.totalFiles) {
    fail(`Recommendation file count changed: expected ${baseline.recommendations.totalFiles}, got ${actualTotal}`);
  }

  const albumCatalog = JSON.parse(readFileSync(path.join(runtimeRoot, baseline.recommendations.albumCatalog.path), 'utf8'));
  if (albumCatalog.length !== baseline.recommendations.albumCatalog.total) {
    fail(`Album catalog count changed: expected ${baseline.recommendations.albumCatalog.total}, got ${albumCatalog.length}`);
  }
  const collectionCounts = {};
  for (const item of albumCatalog) {
    const collection = item.collection ?? 'unknown';
    collectionCounts[collection] = (collectionCounts[collection] ?? 0) + 1;
    const coverPaths = runtimePathsFromUrl(item.artworkUrl);
    if (coverPaths && !coverPaths.some((coverPath) => existsSync(coverPath)) && !item.artworkUrl.includes('%')) {
      fail(`Missing album cover for ${item.albumArtist} - ${item.albumTitle}: ${item.artworkUrl}`);
    }
  }
  for (const [collection, expectedCount] of Object.entries(baseline.recommendations.albumCatalog.collections)) {
    const actualCount = collectionCounts[collection] ?? 0;
    if (actualCount !== expectedCount) {
      fail(`Album collection ${collection} changed: expected ${expectedCount}, got ${actualCount}`);
    }
  }

  const podcasts = JSON.parse(readFileSync(path.join(runtimeRoot, baseline.recommendations.podcasts.path), 'utf8'));
  if (podcasts.length !== baseline.recommendations.podcasts.total) {
    fail(`Podcast catalog count changed: expected ${baseline.recommendations.podcasts.total}, got ${podcasts.length}`);
  }

  const liveCandidates = JSON.parse(readFileSync(path.join(runtimeRoot, baseline.recommendations.liveCandidates.path), 'utf8'));
  if (liveCandidates.length !== baseline.recommendations.liveCandidates.total) {
    fail(`Live album candidate count changed: expected ${baseline.recommendations.liveCandidates.total}, got ${liveCandidates.length}`);
  }

  const legacyAlbums = JSON.parse(readFileSync(path.join(runtimeRoot, baseline.recommendations.legacyAlbums.path), 'utf8'));
  if (legacyAlbums.length !== baseline.recommendations.legacyAlbums.total) {
    fail(`Legacy albums count changed: expected ${baseline.recommendations.legacyAlbums.total}, got ${legacyAlbums.length}`);
  }

  const chineseMap = JSON.parse(readFileSync(path.join(runtimeRoot, baseline.recommendations.chineseManualCoverMap.path), 'utf8'));
  if (chineseMap.length !== baseline.recommendations.chineseManualCoverMap.total) {
    fail(`Chinese manual cover map count changed: expected ${baseline.recommendations.chineseManualCoverMap.total}, got ${chineseMap.length}`);
  }

  for (const [relativeDir, expectedCount] of Object.entries(baseline.recommendations.coverFiles)) {
    const fullPath = path.join(runtimeRoot, relativeDir);
    const actualCount = existsSync(fullPath) && statSync(fullPath).isDirectory() ? countFiles(fullPath) : -1;
    if (actualCount !== expectedCount) {
      fail(`Cover file count changed for ${relativeDir}: expected ${expectedCount}, got ${actualCount}`);
    }
  }
}

checkCriticalFiles();
checkEntryReferences();
checkCssEncoding();
checkRuntimeJs();
checkAndroidPlugins();
checkRecommendations();

for (const message of warnings) {
  console.warn(`WARN: ${message}`);
}

if (failures.length) {
  console.error('Runtime guardrails failed:');
  for (const message of failures) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log('Runtime guardrails passed.');
console.log(`Checked ${baseline.criticalFiles.length} critical files, ${baseline.routes.length} routes, ${baseline.uiFunctions.length} UI functions.`);
