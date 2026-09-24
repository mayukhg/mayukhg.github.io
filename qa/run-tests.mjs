#!/usr/bin/env node
/**
 * End-to-end / integration QA suite for the portfolio site and the /admin editor.
 *
 *   cd qa && npm install && npm test
 *
 * - Serves the repository root on a local static server (no external services).
 * - Drives headless Chromium via Playwright.
 * - Mocks the GitHub REST API for editor tests — nothing is ever written to GitHub.
 * - Writes screenshots to qa/screenshots/, raw results to qa/results.json and
 *   the human-readable report to qa/VALIDATION_REPORT.md.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const QA = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(QA, '..');
const SHOTS = path.join(QA, 'screenshots');

const { chromium } = await import('playwright').catch(() => import(process.env.PW_MODULE || 'playwright'));
const AXE_SRC = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

/* ------------------------------------------------------------------ server */
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.txt': 'text/plain', '.xml': 'application/xml' };
const overrides = new Map(); // path -> {status, body, type} for failure-injection tests
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (overrides.has(url)) { const o = overrides.get(url); res.writeHead(o.status, { 'Content-Type': o.type || 'text/plain' }); return res.end(o.body || ''); }
  let file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}.git`)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    return res.end(fs.readFileSync(path.join(ROOT, '404.html')));
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ------------------------------------------------------------------ harness */
const browser = await chromium.launch();
const results = [];
const PHONE_RE = /(\+?91[\s-]*)?9860[\s-]*345[\s-]*364/;
const profileJSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/profile.json'), 'utf8'));
const productsJSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/products.json'), 'utf8'));
let shotNo = 0;

class AssertionError extends Error {}
function assert(cond, msg) { if (!cond) throw new AssertionError(msg); }
function eq(a, b, msg) { if (a !== b) throw new AssertionError(`${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

async function ctx(opts = {}) {
  // ignoreHTTPSErrors only matters for the Google Fonts request when running behind a TLS-inspecting proxy.
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, ...opts });
  const errors = [];
  context.on('page', (p) => watch(p, errors));
  return { context, errors };
}
function watch(page, errors) {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().startsWith('https://api.github.com')) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
}
async function open(context, url, waitFor = 'html.ready') {
  const page = await context.newPage();
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  if (waitFor) await page.waitForSelector(waitFor, { state: 'attached', timeout: 10000 });
  return page;
}
async function revealAll(page) {
  // Finish reveal-on-scroll animations instantly so screenshots and contrast checks see final colours.
  await page.addStyleTag({ content: '.rv{transition:none!important}' });
  await page.evaluate(() => document.querySelectorAll('.rv').forEach((e) => e.classList.add('in')));
}
async function shot(target, name, opts = {}) {
  // Full-page captures are large, so they are stored as JPEG; element/viewport captures stay lossless PNG.
  const ext = opts.fullPage ? 'jpg' : 'png';
  const file = `${String(++shotNo).padStart(2, '0')}-${name}.${ext}`;
  // Element captures hide the sticky nav so it doesn't overlap the element; page captures keep it.
  const isPage = typeof target.goto === 'function';
  await target.screenshot({ path: path.join(SHOTS, file), ...(opts.fullPage ? { type: 'jpeg', quality: 82 } : {}), ...(isPage ? {} : { style: '#nav{visibility:hidden!important}' }), ...opts });
  current.shots.push(file);
  return file;
}
let current = null;
async function test(group, id, name, fn) {
  current = { group, id, name, status: 'PASS', ms: 0, notes: [], shots: [], error: '' };
  const t0 = Date.now();
  try { await fn(current); }
  catch (e) { current.status = 'FAIL'; current.error = (e instanceof AssertionError ? '' : `${e.name}: `) + e.message.split('\n')[0]; }
  current.ms = Date.now() - t0;
  results.push(current);
  console.log(`${current.status === 'PASS' ? '✔' : '✘'} ${id} ${name}${current.error ? '  → ' + current.error : ''}`);
}
const note = (s) => current.notes.push(s);

/* ------------------------------------------------------------------ fake GitHub API */
function fakeGitHub({ token = 'good-token', login = 'mayukhg', push = true } = {}) {
  const files = new Map();
  let shaN = 0;
  const b64 = (buf) => Buffer.from(buf).toString('base64');
  for (const p of ['content/profile.json', 'content/products.json', 'resume.pdf'])
    files.set(p, { content: b64(fs.readFileSync(path.join(ROOT, p))), sha: `sha${++shaN}` });
  const puts = [];
  async function handler(route) {
    const req = route.request(), url = new URL(req.url()), auth = req.headers()['authorization'];
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,PUT' } });
    if (auth !== `Bearer ${token}`) return json(401, { message: 'Bad credentials' });
    const p = url.pathname;
    if (p === '/user') return json(200, { login });
    const m = p.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/);
    if (!m) return json(404, { message: 'Not Found' });
    const rest = m[3] || '';
    if (!rest) return json(200, { full_name: `${m[1]}/${m[2]}`, permissions: { push } });
    if (rest.startsWith('/branches/')) return rest === '/branches/main' ? json(200, { name: 'main' }) : json(404, { message: 'Branch not found' });
    const cm = rest.match(/^\/contents\/(.+)$/);
    if (cm) {
      const fp = decodeURIComponent(cm[1]);
      if (req.method() === 'GET') {
        const f = files.get(fp);
        return f ? json(200, { path: fp, sha: f.sha, content: f.content.replace(/(.{60})/g, '$1\n'), encoding: 'base64' }) : json(404, { message: 'Not Found' });
      }
      if (req.method() === 'PUT') {
        const body = JSON.parse(req.postData());
        const existing = files.get(fp);
        if (existing && body.sha !== existing.sha) return json(409, { message: 'sha mismatch' });
        if (!existing && body.sha) return json(422, { message: 'sha given for new file' });
        const sha = `sha${++shaN}`;
        files.set(fp, { content: body.content, sha });
        puts.push({ path: fp, ...body });
        return json(existing ? 200 : 201, { content: { path: fp, sha }, commit: { sha: `c${shaN}`, html_url: `https://github.com/x/y/commit/c${shaN}` } });
      }
    }
    return json(404, { message: 'Not Found' });
  }
  return { files, puts, handler, decode: (p) => Buffer.from(files.get(p).content, 'base64').toString('utf8') };
}
async function adminPage(context, gh) {
  if (gh) await context.route('https://api.github.com/**', gh.handler);
  const page = await open(context, '/admin/', '#form-profile .field');
  return page;
}
function field(scope, label) {
  return scope.locator('label.field').filter({ has: scope.page().locator(':scope > span', { hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }) }).locator('input, textarea, select').first();
}
async function connectAdmin(page, token = 'good-token', remember = false) {
  await page.click('#tab-connect');
  await page.fill('#cfg-token', token);
  if (remember) await page.check('#cfg-remember');
  await page.click('#btn-connect');
  await page.waitForFunction(() => /Connected|Could not/.test(document.querySelector('#connect-result').textContent));
}

/* =================================================================== A. Static integrity */
await test('A. Static integrity', 'A1', 'All required files exist', async () => {
  const req = ['index.html', 'styles.css', 'script.js', '404.html', '.nojekyll', 'robots.txt', 'sitemap.xml', 'resume.pdf',
    'assets/mayukh.jpg', 'assets/og-card.jpg', 'content/profile.json', 'content/products.json', 'admin/index.html', 'admin/admin.js', 'admin/admin.css'];
  const missing = req.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  eq(missing.length, 0, `Missing files: ${missing.join(', ')}`);
  note(`${req.length} files checked`);
});

await test('A. Static integrity', 'A2', 'Content JSON is valid and internally consistent', async () => {
  const ids = productsJSON.products.map((p) => p.id);
  const arenas = productsJSON.arenas.map((a) => a.id);
  eq(new Set(ids).size, ids.length, 'Product IDs must be unique');
  productsJSON.products.forEach((p) => {
    assert(arenas.includes(p.arena), `Product ${p.id} uses unknown arena ${p.arena}`);
    ['name', 'summary', 'pain', 'bet', 'why', 'tradeoff', 'validated'].forEach((k) => assert(p[k], `Product ${p.id} missing ${k}`));
  });
  profileJSON.experience.roles.forEach((r) => (r.related || []).forEach((id) => assert(ids.includes(id), `Role ${r.tab} links unknown product ${id}`)));
  assert(profileJSON.person.name && profileJSON.links.email, 'Name and email required');
  note(`${ids.length} products, ${arenas.length} arenas, ${profileJSON.experience.roles.length} roles`);
});

await test('A. Static integrity', 'A3', 'Phone number is not published in any site text file', async () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (['.git', 'node_modules', 'qa'].includes(e.name)) return [];
    return e.isDirectory() ? walk(p) : [p];
  });
  const text = walk(ROOT).filter((f) => /\.(html|css|js|json|md|txt|xml)$/.test(f));
  const hits = text.filter((f) => PHONE_RE.test(fs.readFileSync(f, 'utf8')));
  eq(hits.length, 0, `Phone number found in ${hits.join(', ')}`);
  assert(!fs.readFileSync(path.join(ROOT, 'resume.pdf')).includes('9860345364'), 'Phone digits in resume.pdf bytes');
  note(`${text.length} text files scanned; résumé PDF text layer additionally verified with pdfminer (see report)`);
});

await test('A. Static integrity', 'A4', 'Every local URL referenced by pages and content resolves (HTTP 200)', async () => {
  const refs = new Set();
  for (const f of ['index.html', '404.html', 'admin/index.html']) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)) {
      const u = m[1];
      if (/^(https?:|mailto:|data:|javascript:)/.test(u)) continue;
      refs.add(new URL(u, `${BASE}/${f}`).pathname);
    }
  }
  const json = JSON.stringify(profileJSON) + JSON.stringify(productsJSON);
  for (const m of json.matchAll(/"((?:assets\/|resume)[^"]+)"/g)) refs.add('/' + m[1]);
  const bad = [];
  for (const r of refs) { const res = await fetch(BASE + r); if (res.status !== 200) bad.push(`${r} → ${res.status}`); }
  eq(bad.length, 0, `Broken: ${bad.join(', ')}`);
  note(`${refs.size} local references checked`);
});

await test('A. Static integrity', 'A5', 'SEO & social metadata (title, description, canonical, Open Graph, JSON-LD)', async () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const re of [/<title>[^<]{10,}<\/title>/, /name="description" content="[^"]{50,}"/, /rel="canonical" href="https:\/\/mayukhg\.github\.io\/"/,
    /property="og:title"/, /property="og:image" content="https:\/\/mayukhg\.github\.io\/assets\/og-card\.jpg"/, /name="twitter:card" content="summary_large_image"/])
    assert(re.test(html), `Missing ${re}`);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  eq(ld['@type'], 'Person', 'JSON-LD type');
  const og = fs.readFileSync(path.join(ROOT, 'assets/og-card.jpg'));
  let i = 2; while (i < og.length) { if (og[i] === 0xff && og[i + 1] >= 0xc0 && og[i + 1] <= 0xc2) break; i += 2 + og.readUInt16BE(i + 2); }
  const hgt = og.readUInt16BE(i + 5), wid = og.readUInt16BE(i + 7);
  eq(`${wid}x${hgt}`, '1200x630', 'OG image size');
});

await test('A. Static integrity', 'A6', 'Crawl rules: robots.txt blocks /admin, admin + 404 are noindex, sitemap valid', async () => {
  assert(/Disallow: \/admin\//.test(fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8')), 'robots.txt must disallow /admin/');
  assert(/noindex/.test(fs.readFileSync(path.join(ROOT, 'admin/index.html'), 'utf8')), 'admin must be noindex');
  assert(/noindex/.test(fs.readFileSync(path.join(ROOT, '404.html'), 'utf8')), '404 must be noindex');
  assert(/<loc>https:\/\/mayukhg\.github\.io\/<\/loc>/.test(fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8')), 'sitemap loc');
});

/* =================================================================== B. Rendering */
await test('B. Rendering', 'B1', 'Home page loads with zero console errors, page errors or failed requests', async () => {
  const { context, errors } = await ctx();
  const page = await open(context, '/');
  await page.waitForTimeout(300);
  eq(errors.length, 0, errors.join(' | '));
  const fontsOk = await page.evaluate(() => document.fonts.check('16px "Plus Jakarta Sans"') && document.fonts.check('16px "Space Grotesk"'));
  assert(fontsOk, 'Web fonts did not load');
  const t = await page.evaluate(() => performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd);
  note(`DOMContentLoaded ${Math.round(t)} ms (local server); web fonts loaded`);
  await revealAll(page);
  await shot(page, 'desktop-1440-full-page', { fullPage: true });
  await context.close();
});

await test('B. Rendering', 'B2', 'Hero renders name, title, badge, intro (with bold), CTAs, photo and 4 stats', async () => {
  const { context } = await ctx();
  const page = await open(context, '/');
  eq(await page.locator('h1').innerText(), profileJSON.person.name, 'H1 name');
  assert((await page.locator('.hero-role').innerText()).includes(profileJSON.person.headline), 'headline');
  eq(await page.locator('.badge').innerText(), profileJSON.person.badge, 'badge');
  assert(await page.locator('.hero-lede strong').count() >= 3, 'bold markup in lede');
  eq(await page.locator('.stat').count(), profileJSON.stats.length, 'stat count');
  const ctas = await page.locator('.hero-cta a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  assert(ctas.includes('#products') && ctas.includes('resume.pdf') && ctas.includes(profileJSON.links.github), `CTAs ${ctas}`);
  const img = await page.locator('img.portrait').evaluate((i) => ({ w: i.naturalWidth, alt: i.alt, ratio: i.getBoundingClientRect().width / i.getBoundingClientRect().height }));
  assert(img.w > 0, 'photo loaded'); assert(img.alt.length > 5, 'photo alt');
  assert(Math.abs(img.ratio - 1) < 0.02, `photo should be square, ratio ${img.ratio.toFixed(2)}`);
  await shot(page.locator('header.hero'), 'hero-desktop');
  await context.close();
});

await test('B. Rendering', 'B3', 'Every section renders the expected number of items from content JSON', async () => {
  const { context } = await ctx();
  const page = await open(context, '/');
  const counts = await page.evaluate(() => ({
    facts: document.querySelectorAll('.fact').length, steps: document.querySelectorAll('.step').length,
    principles: document.querySelectorAll('.principle').length, products: document.querySelectorAll('#product-list .acc').length,
    glance: document.querySelectorAll('.glance-card').length,
    pillars: document.querySelectorAll('.pillar').length, metrics: document.querySelectorAll('.metric').length,
    roles: document.querySelectorAll('.exp-tab').length, panels: document.querySelectorAll('.exp-panel').length,
    skills: document.querySelectorAll('.skill-card').length, edu: document.querySelectorAll('.edu-item').length,
    contact: document.querySelectorAll('.contact-row a').length }));
  const exp = { facts: profileJSON.about.facts.length, steps: profileJSON.approach.steps.length, principles: profileJSON.approach.principles.length,
    products: productsJSON.products.length, glance: productsJSON.products.length, pillars: productsJSON.ecosystem.pillars.length, metrics: productsJSON.ecosystem.metrics.length,
    roles: profileJSON.experience.roles.length, panels: profileJSON.experience.roles.length, skills: profileJSON.skills.groups.length,
    edu: profileJSON.education.length, contact: 4 };
  for (const k in exp) eq(counts[k], exp[k], `${k} count`);
  note(Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', '));
  await context.close();
});

await test('B. Rendering', 'B4', 'Content fidelity: every product, role, skill and education entry appears on the page', async () => {
  const { context } = await ctx();
  const page = await open(context, '/');
  const text = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
  const missing = [];
  const strip = (s) => s.replace(/\*\*/g, '');
  productsJSON.products.forEach((p) => [p.name, p.client, ...p.stack, strip(p.pain)].forEach((s) => !text.includes(s) && missing.push(s)));
  profileJSON.experience.roles.forEach((r) => [r.title, r.dates, ...r.metrics, ...r.bullets.map(strip)].forEach((s) => !text.includes(s) && missing.push(s)));
  profileJSON.skills.groups.forEach((g) => g.items.forEach((s) => !text.includes(s) && missing.push(s)));
  profileJSON.education.forEach((e) => !text.includes(e.degree) && missing.push(e.degree));
  eq(missing.length, 0, `Missing text: ${missing.slice(0, 5).join(' | ')}`);
  assert(!PHONE_RE.test(text), 'Phone number rendered');
  assert(text.includes(profileJSON.links.email), 'email rendered');
  await context.close();
});

/* =================================================================== C. Interactions */
await test('C. Interactions', 'C1', 'Product card accordion expands and collapses (aria-expanded + height)', async () => {
  const { context } = await ctx();
  const page = await open(context, '/');
  const card = page.locator('#p-policy-foundry');
  const head = card.locator('.acc-head');
  eq(await head.getAttribute('aria-expanded'), 'false', 'initially collapsed');
  await head.click(); await page.waitForTimeout(500);
  eq(await head.getAttribute('aria-expanded'), 'true', 'expanded');
  assert((await card.locator('.acc-body').evaluate((b) => b.getBoundingClientRect().height)) > 200, 'body visible');
  assert(await card.locator('text=Customer pain').isVisible(), 'details visible');
  await revealAll(page);
  await shot(card, 'product-card-expanded');
  await head.click(); await page.waitForTimeout(500);
  eq(await head.getAttribute('aria-expanded'), 'false', 'collapsed again');
  eq(await card.locator('.acc-body').evaluate((b) => b.getBoundingClientRect().height), 0, 'body hidden');
  await context.close();
});

await test('C. Interactions', 'C2', 'Arena filter chips show the right products and counts', async () => {
  const { context } = await ctx();
  const page = await open(context, '/');
  for (const a of productsJSON.arenas) {
    const expected = productsJSON.products.filter((p) => p.arena === a.id).length;
    const chip = page.locator(`.chipbtn[data-f="${a.id}"]`);
    await chip.click();
    eq(await chip.getAttribute('aria-pressed'), 'true', `${a.id} pressed`);
    eq(await page.locator('#product-list .acc:not([hidden])').count(), expected, `${a.id} visible count`);
    eq(await chip.locator('.ct').innerText(), String(expected), `${a.id} chip count`);
  }
  await page.locator('.chipbtn[data-f="agentic"]').click();
  await revealAll(page);
  await shot(page.locator('#products'), 'filter-agentic');
  await page.locator('.chipbtn[data-f="all"]').click();
  eq(await page.locator('#product-list .acc:not([hidden])').count(), productsJSON.products.length, 'All restores every product');
  await context.close();
});

await test('C. Interactions', 'C3', 'Experience tabs: clicking each tab shows exactly its panel', async () => {
  const { context } = await ctx();
  const page = await open(context, '/');
  const tabs = page.locator('.exp-tab');
  const n = await tabs.count();
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click();
    eq(await tabs.nth(i).getAttribute('aria-selected'), 'true', `tab ${i} selected`);
    eq(await page.locator('.exp-panel:not([hidden])').count(), 1, 'one visible panel');
    const panelId = await tabs.nth(i).getAttribute('aria-controls');
    assert(await page.locator('#' + panelId).isVisible(), `panel ${panelId} visible`);
  }
  await tabs.nth(2).click(); await revealAll(page);
  await shot(page.locator('#experience'), 'experience-bp-tab');
  note(`${n} tabs exercised`);
  await context.close();
});

await test('C. Interactions', 'C4', 'Experience tabs support keyboard (Arrow keys, Home, End) with roving tabindex', async () => {
  const { context } = await ctx();
  const page = await open(context, '/');
  await page.locator('.exp-tab').first().focus();
  await page.keyboard.press('ArrowDown');
  eq(await page.evaluate(() => document.activeElement.id), await page.locator('.exp-tab').nth(1).getAttribute('id'), 'ArrowDown moves focus');
  eq(await page.locator('.exp-tab').nth(1).getAttribute('aria-selected'), 'true', 'ArrowDown selects');
  await page.keyboard.press('End');
  eq(await page.locator('.exp-tab').last().getAttribute('aria-selected'), 'true', 'End selects last');
  await page.keyboard.press('ArrowDown');
  eq(await page.locator('.exp-tab').first().getAttribute('aria-selected'), 'true', 'wraps to first');
  await page.keyboard.press('Home');
  eq(await page.locator('.exp-tab[tabindex="0"]').count(), 1, 'exactly one tabbable tab');
  await context.close();
});

await test('C. Interactions', 'C5', 'Deep links open products (URL hash, filtered state, experience “related product” links)', async () => {
  const { context } = await ctx();
  let page = await open(context, '/#p-kyc');
  await page.waitForTimeout(500);
  eq(await page.locator('#p-kyc .acc-head').getAttribute('aria-expanded'), 'true', 'hash opens card');
  await page.close();
  page = await open(context, '/');
  await page.locator('.chipbtn[data-f="agentic"]').click();
  await page.locator('.exp-tab', { hasText: 'Western Union' }).click();
  await page.locator('.exp-panel:not([hidden]) .stackline a').first().click();
  await page.waitForTimeout(600);
  assert(await page.locator('#p-kyc').isVisible(), 'filtered-out card is revealed');
  eq(await page.locator('#p-kyc .acc-head').getAttribute('aria-expanded'), 'true', 'related link opens card');
  await context.close();
});

await test('C. Interactions', 'C8', 'Summary (“at a glance”) cards: one per product, in order, each opens its product case', async () => {
  const { context } = await ctx();
  const page = await open(context, '/');
  const cards = page.locator('.glance-card');
  eq(await cards.count(), productsJSON.products.length, 'one card per product');
  const names = await cards.locator('h4').allInnerTexts();
  eq(names.join('|'), productsJSON.products.map((p) => p.name).join('|'), 'card order and names');
  const icons = await page.locator('.glance-card .g-icon use').evaluateAll((u) => u.map((x) => x.getAttribute('href')));
  eq(icons.join(','), productsJSON.products.map((p) => '#g-' + p.icon).join(','), 'icons from content');
  eq(await page.locator('.glance-title').innerText(), productsJSON.overview.title, 'panel title');
  await revealAll(page);
  await shot(page.locator('.glance'), 'summary-cards-desktop');
  // Filter to a different arena first: clicking a card must still reveal and open its product.
  await page.locator('.chipbtn[data-f="agentic"]').click();
  for (const p of [productsJSON.products[0], productsJSON.products[productsJSON.products.length - 1]]) {
    await page.locator(`.glance-card[data-product="${p.id}"]`).click();
    // wait for the smooth scroll to bring the card just below the sticky nav
    await page.waitForFunction((id) => { const t = document.getElementById(id).getBoundingClientRect().top, n = document.getElementById('nav').offsetHeight; return t >= n && t < n + 60; }, 'p-' + p.id, { timeout: 5000 }).catch(() => {});
    assert(await page.locator('#p-' + p.id).isVisible(), `${p.id} visible after click`);
    eq(await page.locator(`#p-${p.id} .acc-head`).getAttribute('aria-expanded'), 'true', `${p.id} opened`);
    eq(await page.evaluate(() => location.hash), '#p-' + p.id, 'URL hash updated');
    const top = await page.locator('#p-' + p.id).evaluate((el) => el.getBoundingClientRect().top);
    const navH = await page.locator('#nav').evaluate((n) => n.offsetHeight);
    assert(top >= navH && top < navH + 60, `${p.id} should sit just below the sticky nav (top=${Math.round(top)}, nav=${navH})`);
    await page.evaluate(() => window.scrollTo(0, document.querySelector('.glance').offsetTop - 100));
  }
  // Clicking the same card again (hash unchanged) re-opens a collapsed card.
  const last = productsJSON.products[productsJSON.products.length - 1].id;
  await page.locator(`#p-${last} .acc-head`).click();
  await page.locator(`.glance-card[data-product="${last}"]`).click();
  await page.waitForTimeout(500);
  eq(await page.locator(`#p-${last} .acc-head`).getAttribute('aria-expanded'), 'true', 're-click re-opens');
  // Keyboard: cards are links reachable with Tab and activated with Enter.
  await page.locator('.glance-card').nth(1).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  eq(await page.locator(`#p-${productsJSON.products[1].id} .acc-head`).getAttribute('aria-expanded'), 'true', 'Enter opens');
  await context.close();
});

await test('C. Interactions', 'C6', 'Nav links scroll to sections; active link and scrolled state update', async () => {
  const { context } = await ctx();
  const page = await open(context, '/');
  eq(await page.locator('#nav').evaluate((n) => n.classList.contains('scrolled')), false, 'not scrolled at top');
  for (const id of ['about', 'approach', 'products', 'experience', 'skills', 'contact']) {
    await page.locator(`.nav-links a[href="#${id}"]`).click();
    await page.waitForTimeout(900);
    const top = await page.locator('#' + id).evaluate((s) => s.getBoundingClientRect().top);
    const atBottom = await page.evaluate(() => Math.ceil(window.scrollY + innerHeight) >= document.documentElement.scrollHeight - 2);
    assert(Math.abs(top) < 120 || (atBottom && top < 900), `#${id} not scrolled into view (top=${Math.round(top)})`);
    if (id !== 'contact') eq(await page.locator(`.nav-links a[href="#${id}"]`).getAttribute('aria-current'), 'true', `${id} active`);
  }
  assert(await page.locator('#nav').evaluate((n) => n.classList.contains('scrolled')), 'nav scrolled state');
  await context.close();
});

await test('C. Interactions', 'C7', 'Links: external open safely in new tab, mailto correct, résumé PDF served', async () => {
  const { context } = await ctx();
  const page = await open(context, '/');
  const ext = await page.locator('a[href^="http"]').evaluateAll((as) => as.map((a) => ({ h: a.href, t: a.target, r: a.rel })));
  const unsafe = ext.filter((a) => a.t !== '_blank' || !a.r.includes('noopener'));
  eq(unsafe.length, 0, `Unsafe external links: ${unsafe.map((u) => u.h).join(', ')}`);
  eq(await page.locator('a[href^="mailto:"]').first().getAttribute('href'), 'mailto:' + profileJSON.links.email, 'mailto');
  const res = await page.request.get(BASE + '/resume.pdf');
  eq(res.status(), 200, 'résumé status');
  assert(res.headers()['content-type'].includes('pdf'), 'résumé content-type');
  assert((await res.body()).subarray(0, 4).toString() === '%PDF', 'résumé is a PDF');
  const gh = await page.locator('.acc-link').evaluateAll((as) => as.map((a) => a.href));
  assert(gh.every((u) => /^https:\/\/github\.com\/mayukhg\//.test(u)), 'GitHub product links');
  note(`${ext.length} external links, ${gh.length} product GitHub links`);
  await context.close();
});

/* =================================================================== D. Responsive */
const VIEWPORTS = [[1440, 900, 'desktop'], [1024, 768, 'laptop'], [768, 1024, 'tablet'], [390, 844, 'mobile'], [320, 640, 'small-mobile']];
for (const [w, hgt, label] of VIEWPORTS) {
  await test('D. Responsive', `D-${w}`, `No horizontal overflow and correct layout at ${w}px (${label})`, async () => {
    const { context, errors } = await ctx({ viewport: { width: w, height: hgt }, isMobile: w < 800, hasTouch: w < 800 });
    const page = await open(context, '/');
    await revealAll(page);
    await page.locator('.acc-head').first().click();
    await page.waitForTimeout(450);
    const o = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll('body *')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width && r.right > vw + 1 && !el.closest('.exp-tabs') && getComputedStyle(el).position !== 'fixed';
      }).slice(0, 3).map((el) => el.className || el.tagName);
      return { sw: document.documentElement.scrollWidth, vw, wide };
    });
    assert(o.sw <= o.vw, `Page scrolls horizontally: ${o.sw} > ${o.vw} (${o.wide.join(', ')})`);
    eq(o.wide.length, 0, `Elements overflow viewport: ${o.wide.join(', ')}`);
    eq(errors.length, 0, errors.join(' | '));
    await shot(page, `${label}-${w}-full-page`, { fullPage: true });
    await context.close();
  });
}

await test('D. Responsive', 'D-menu', 'Mobile menu opens/closes (button, link tap, Escape) with correct ARIA', async () => {
  const { context } = await ctx({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await open(context, '/');
  const burger = page.locator('#burger');
  assert(await burger.isVisible(), 'burger visible on mobile');
  assert(!(await page.locator('#navlinks').isVisible()), 'menu closed initially');
  await burger.click();
  eq(await burger.getAttribute('aria-expanded'), 'true', 'expanded');
  assert(await page.locator('#navlinks').isVisible(), 'menu visible');
  await shot(page, 'mobile-menu-open');
  await page.locator('#navlinks a[href="#experience"]').click();
  eq(await burger.getAttribute('aria-expanded'), 'false', 'closes on link tap');
  await burger.click();
  await page.keyboard.press('Escape');
  eq(await burger.getAttribute('aria-expanded'), 'false', 'closes on Escape');
  eq(await page.evaluate(() => document.activeElement.id), 'burger', 'focus returns to burger');
  await context.close();
});

await test('D. Responsive', 'D-touch', 'Touch targets are at least 44×44px on mobile', async () => {
  const { context } = await ctx({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await open(context, '/');
  await page.locator('#burger').click();
  const small = await page.evaluate(() => [...document.querySelectorAll('#burger, .nav-links a, .btn, .chipbtn, .acc-link, .exp-tab, .acc-head')]
    .filter((el) => el.offsetParent !== null)
    .map((el) => { const r = el.getBoundingClientRect(); return { n: el.textContent.trim().slice(0, 30), w: r.width, h: r.height }; })
    .filter((r) => r.h < 44 || r.w < 44));
  eq(small.length, 0, `Small targets: ${small.map((s) => `${s.n} ${Math.round(s.w)}x${Math.round(s.h)}`).join(', ')}`);
  await context.close();
});

/* =================================================================== E. Accessibility */
async function axe(page, label) {
  await revealAll(page);
  await page.addScriptTag({ content: AXE_SRC });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
    return { v: res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, t: v.nodes[0]?.target.join(' ') })), passes: res.passes.length };
  });
  note(`${label}: ${r.passes} axe rules passed, ${r.v.length} violations${r.v.length ? ' — ' + r.v.map((v) => `${v.id} (${v.impact}, ${v.n}× e.g. ${v.t})`).join('; ') : ''}`);
  return r.v;
}
await test('E. Accessibility', 'E1', 'axe-core WCAG 2.1 AA audit — home page (desktop, with an expanded card)', async () => {
  const { context } = await ctx();
  const page = await open(context, '/');
  await page.locator('.acc-head').first().click(); await page.waitForTimeout(450);
  const v = await axe(page, 'Desktop');
  eq(v.length, 0, `axe violations: ${v.map((x) => x.id).join(', ')}`);
  await context.close();
});
await test('E. Accessibility', 'E2', 'axe-core WCAG 2.1 AA audit — home page (mobile, menu open)', async () => {
  const { context } = await ctx({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await open(context, '/');
  await page.locator('#burger').click();
  const v = await axe(page, 'Mobile');
  eq(v.length, 0, `axe violations: ${v.map((x) => x.id).join(', ')}`);
  await context.close();
});
await test('E. Accessibility', 'E3', 'Semantics: one H1, no skipped heading levels, landmarks, named controls, image alts', async () => {
  const { context } = await ctx();
  const page = await open(context, '/');
  const r = await page.evaluate(() => {
    const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((h) => h.offsetParent !== null || h.closest('[hidden]') === null).map((h) => +h.tagName[1]);
    let skip = null; for (let i = 1; i < hs.length; i++) if (hs[i] > hs[i - 1] + 1) { skip = `${hs[i - 1]}→${hs[i]}`; break; }
    return { h1: document.querySelectorAll('h1').length, skip, main: !!document.querySelector('main'), nav: !!document.querySelector('nav[aria-label]'),
      unnamed: [...document.querySelectorAll('button, a')].filter((el) => !(el.getAttribute('aria-label') || el.textContent.trim())).length,
      noAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length, lang: document.documentElement.lang };
  });
  eq(r.h1, 1, 'single h1'); eq(r.skip, null, 'heading level skipped'); assert(r.main && r.nav, 'landmarks');
  eq(r.unnamed, 0, 'unnamed controls'); eq(r.noAlt, 0, 'images without alt'); eq(r.lang, 'en', 'lang');
  await context.close();
});
await test('E. Accessibility', 'E4', 'Keyboard: skip link is first tab stop and moves focus to main content; focus is visible', async () => {
  const { context } = await ctx();
  const page = await open(context, '/');
  await page.keyboard.press('Tab');
  eq(await page.evaluate(() => document.activeElement.className), 'skip', 'first tab stop is skip link');
  assert(await page.locator('.skip').evaluate((a) => a.getBoundingClientRect().left >= 0), 'skip link visible on focus');
  await shot(page, 'keyboard-skip-link', { clip: { x: 0, y: 0, width: 600, height: 120 } });
  await page.keyboard.press('Enter');
  eq(await page.evaluate(() => location.hash), '#main', 'skip link target');
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert(outline !== 'none', 'focus outline visible');
  await context.close();
});
await test('E. Accessibility', 'E5', 'Reduced motion: content is visible immediately without animations', async () => {
  const { context } = await ctx({ reducedMotion: 'reduce' });
  const page = await open(context, '/');
  const hidden = await page.evaluate(() => [...document.querySelectorAll('.rv')].filter((e) => getComputedStyle(e).opacity !== '1').length);
  eq(hidden, 0, 'elements still hidden under reduced motion');
  await context.close();
});
await test('E. Accessibility', 'E6', 'No-JavaScript fallback shows a message with résumé + email links', async () => {
  const { context } = await ctx({ javaScriptEnabled: false });
  const page = await open(context, '/', null);
  const t = await page.locator('noscript').first().evaluate((n) => n.innerHTML);
  assert(t.includes('resume.pdf') && t.includes('mailto:'), 'noscript content');
  await context.close();
});

/* =================================================================== F. Resilience & security */
await test('F. Resilience & security', 'F1', 'If content JSON fails to load, a friendly error is shown (no crash, no blank page)', async () => {
  overrides.set('/content/products.json', { status: 500, body: 'boom' });
  const { context } = await ctx();
  const page = await context.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  overrides.clear();
  assert(await page.locator('#load-error').isVisible(), 'error message visible');
  assert(await page.locator('#load-error a[href="resume.pdf"]').count(), 'résumé fallback link');
  await shot(page, 'content-load-error', { clip: { x: 0, y: 0, width: 1440, height: 420 } });
  await context.close();
});
await test('F. Resilience & security', 'F2', 'Preview mode renders the local draft only when ?preview=1 is present', async () => {
  const { context } = await ctx();
  const page = await open(context, '/');
  await page.evaluate(([p, r]) => { p.person.headline = 'PREVIEW HEADLINE'; localStorage.setItem('portfolio-admin-draft', JSON.stringify({ profile: p, products: r })); }, [profileJSON, productsJSON]);
  await page.reload({ waitUntil: 'networkidle' });
  assert(!(await page.locator('.hero-role').innerText()).includes('PREVIEW'), 'live page must ignore draft');
  await page.goto(BASE + '/?preview=1', { waitUntil: 'networkidle' });
  assert((await page.locator('.hero-role').innerText()).includes('PREVIEW HEADLINE'), 'preview shows draft');
  assert(await page.locator('.preview-bar').isVisible(), 'preview banner');
  await context.close();
});
await test('F. Resilience & security', 'F3', 'XSS-safe rendering: HTML/script and javascript: links in content are neutralised', async () => {
  const { context, errors } = await ctx();
  const page = await open(context, '/');
  await page.evaluate(([p, r]) => {
    p.person.name = 'Evil <img src=x onerror="window.__xss=1">';
    p.person.lede = 'Hi <script>window.__xss=2</script> [click](javascript:window.__xss=3) **bold**';
    r.products[0].name = '<svg onload="window.__xss=4">';
    localStorage.setItem('portfolio-admin-draft', JSON.stringify({ profile: p, products: r }));
  }, [profileJSON, productsJSON]);
  await page.goto(BASE + '/?preview=1', { waitUntil: 'networkidle' });
  await page.locator('.hero-lede a').click().catch(() => {});
  eq(await page.evaluate(() => window.__xss), undefined, 'script executed');
  eq(await page.locator('.hero-lede a').getAttribute('href'), '#', 'javascript: link neutralised');
  assert((await page.locator('h1').innerText()).includes('<img'), 'markup shown as text');
  assert(await page.locator('.hero-lede strong').count() === 1, 'safe **bold** still works');
  await context.close();
});
await test('F. Resilience & security', 'F4', '404 page renders on unknown URLs with a way back', async () => {
  const { context } = await ctx();
  const page = await context.newPage();
  const res = await page.goto(BASE + '/does-not-exist', { waitUntil: 'networkidle' });
  eq(res.status(), 404, 'status');
  assert((await page.locator('h1').innerText()).includes("doesn't exist"), 'heading');
  eq(await page.locator('a.btn').first().getAttribute('href'), '/', 'back link');
  await shot(page, '404-page');
  await context.close();
});
await test('F. Resilience & security', 'F5', 'Admin page ships a strict Content-Security-Policy and never leaks the token in URLs', async () => {
  const html = fs.readFileSync(path.join(ROOT, 'admin/index.html'), 'utf8');
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  for (const d of ["script-src 'self'", "connect-src 'self' https://api.github.com", "object-src 'none'", "frame-src 'none'"]) assert(csp.includes(d), `CSP missing ${d}`);
  assert(!/unsafe-inline|unsafe-eval/.test(csp.match(/script-src[^;]*/)[0]), 'script-src must not allow inline/eval');
  const js = fs.readFileSync(path.join(ROOT, 'admin/admin.js'), 'utf8');
  assert(!/[?&]access_token=/.test(js), 'token must not be sent in query strings');
});

/* =================================================================== G. Admin editor */
await test('G. Admin editor', 'G1', 'Editor loads with no errors, populates every form from content, all tabs work', async () => {
  const { context, errors } = await ctx();
  const page = await adminPage(context);
  eq(await field(page.locator('#panel-profile'), 'Full name').inputValue(), profileJSON.person.name, 'name field');
  await page.click('#tab-products');
  assert(await page.locator('#panel-products').isVisible(), 'products tab');
  eq(await page.locator('#panel-products details[data-key="products"] > .section-body > .array > details.item').count(), productsJSON.products.length, 'product items');
  for (const t of ['files', 'connect', 'help', 'profile']) { await page.click(`#tab-${t}`); assert(await page.locator(`#panel-${t}`).isVisible(), `${t} tab`); }
  eq(errors.length, 0, errors.join(' | '));
  eq(await page.locator('#btn-publish').isDisabled(), true, 'publish disabled when clean');
  await shot(page, 'admin-profile-tab');
  await context.close();
});

await test('G. Admin editor', 'G2', 'Editing a field marks the draft dirty, autosaves, and “Preview draft” shows it on the real site', async () => {
  const { context } = await ctx();
  const page = await adminPage(context);
  await field(page.locator('#panel-profile'), 'Current title').fill('VP of Product — Agentic AI');
  assert(await page.locator('#dirty-flag').isVisible(), 'dirty flag');
  eq(await page.locator('#btn-publish').isDisabled(), false, 'publish enabled');
  await page.waitForTimeout(400);
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('portfolio-admin-draft')));
  eq(draft.profile.person.headline, 'VP of Product — Agentic AI', 'draft autosaved');
  const [preview] = await Promise.all([context.waitForEvent('page'), page.click('#btn-preview')]);
  await preview.waitForSelector('html.ready');
  assert((await preview.locator('.hero-role').innerText()).includes('VP of Product — Agentic AI'), 'preview shows edit');
  await shot(preview.locator('header.hero'), 'admin-preview-draft');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#form-profile .field');
  eq(await field(page.locator('#panel-profile'), 'Current title').inputValue(), 'VP of Product — Agentic AI', 'draft survives reload');
  assert((await page.locator('#notice').innerText()).includes('Restored your unpublished draft'), 'restore notice');
  await context.close();
});

await test('G. Admin editor', 'G3', 'Add a new product through the form; it appears on the site with correct arena filter counts', async () => {
  const { context } = await ctx();
  const page = await adminPage(context);
  await page.click('#tab-products');
  const sec = page.locator('#panel-products details[data-key="products"]');
  await sec.locator('button.add').click();
  const item = sec.locator('details.item').last();
  await field(item, 'Product name').fill('Agent Evaluation Harness');
  await field(item, 'Product ID').focus();
  eq(await field(item, 'Product ID').inputValue(), 'agent-evaluation-harness', 'ID auto-filled from name');
  await field(item, 'Arena').selectOption('agentic');
  await field(item, 'One-line summary').fill('Golden-dataset regression testing for multi-agent systems.');
  await field(item, 'Summary card icon').selectOption('trend');
  await field(item, 'Summary card tagline').fill('Regression-test agents before they reach production.');
  await field(item, 'Built with').fill('Python\nLangSmith\nRAGAS');
  await field(item, 'Customer pain').fill('Teams ship agents without **regression tests**.');
  await field(item, 'Value & outcomes').fill('Catch regressions before GA\nFaster release cycles');
  eq(await item.locator('.item-title').innerText(), 'Agent Evaluation Harness', 'summary title updates live');
  await shot(item, 'admin-new-product-form');
  const [preview] = await Promise.all([context.waitForEvent('page'), page.click('#btn-preview')]);
  await preview.waitForSelector('html.ready');
  eq(await preview.locator('#product-list .acc').count(), productsJSON.products.length + 1, 'product added');
  const agentic = productsJSON.products.filter((p) => p.arena === 'agentic').length + 1;
  eq(await preview.locator('.chipbtn[data-f="agentic"] .ct').innerText(), String(agentic), 'filter count updated');
  eq(await preview.locator('.glance-card').count(), productsJSON.products.length + 1, 'summary card added automatically');
  const newCard = preview.locator('.glance-card[data-product="agent-evaluation-harness"]');
  eq(await newCard.locator('h4').innerText(), 'Agent Evaluation Harness', 'summary card name');
  eq(await newCard.locator('.g-icon use').getAttribute('href'), '#g-trend', 'chosen icon used');
  assert((await newCard.locator('p').innerText()).includes('Regression-test agents'), 'tagline used');
  await revealAll(preview);
  await shot(newCard, 'preview-new-summary-card');
  await newCard.click();
  await preview.waitForTimeout(500);
  eq(await preview.locator('#p-agent-evaluation-harness .acc-head').getAttribute('aria-expanded'), 'true', 'summary card opens the new product');
  assert(await preview.locator('#p-agent-evaluation-harness strong', { hasText: 'regression tests' }).isVisible(), 'rich text rendered');
  await revealAll(preview);
  await shot(preview.locator('#p-agent-evaluation-harness'), 'preview-new-product');
  await context.close();
});

await test('G. Admin editor', 'G4', 'Reorder, duplicate and delete list items (with confirmation)', async () => {
  const { context } = await ctx();
  const page = await adminPage(context);
  await page.click('#tab-products');
  const items = page.locator('#panel-products details[data-key="products"] details.item');
  const first = await items.nth(0).locator('.item-title').innerText();
  const second = await items.nth(1).locator('.item-title').innerText();
  await items.nth(0).locator('button[title="Move down"]').click();
  eq(await items.nth(0).locator('.item-title').innerText(), second, 'moved down');
  eq(await items.nth(1).locator('.item-title').innerText(), first, 'moved');
  assert(await items.nth(0).locator('button[title="Move up"]').isDisabled(), 'first item cannot move up');
  await items.nth(0).locator('button[title="Duplicate"]').click();
  eq(await items.count(), productsJSON.products.length + 1, 'duplicated');
  eq(await items.nth(1).locator('.item-title').innerText(), second + ' (copy)', 'copy named');
  page.once('dialog', (d) => d.dismiss());
  await items.nth(1).locator('button[title="Delete"]').click();
  eq(await items.count(), productsJSON.products.length + 1, 'dismissed confirm keeps item');
  page.once('dialog', (d) => d.accept());
  await items.nth(1).locator('button[title="Delete"]').click();
  eq(await items.count(), productsJSON.products.length, 'deleted');
  await page.waitForTimeout(400); // autosave debounce
  const d = await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('portfolio-admin-draft')); return x.products.products.map((p) => p.id); });
  eq(d[0], productsJSON.products[1].id, 'draft order persisted');
  await context.close();
});

await test('G. Admin editor', 'G5', 'Validation blocks publishing and points to each problem (required, email, URL, duplicate ID, unknown link)', async () => {
  const { context } = await ctx();
  const page = await adminPage(context);
  const prof = page.locator('#panel-profile');
  await field(prof, 'Full name').fill('');
  await prof.locator('details[data-key="links"] > summary').click();
  await field(prof, 'Email').fill('not-an-email');
  await field(prof, 'LinkedIn URL').fill('linkedin.com/in/x');
  await page.click('#tab-products');
  const items = page.locator('#panel-products details[data-key="products"] details.item');
  await items.nth(1).locator('summary').click();
  await field(items.nth(1), 'Product ID').fill(productsJSON.products[0].id);
  await page.click('#btn-publish');
  const txt = await page.locator('#notice').innerText();
  for (const s of ['Full name', 'valid email', 'https://', 'already uses this ID']) assert(txt.includes(s), `error for ${s}`);
  assert(await page.locator('.field.invalid').count() >= 4, 'fields highlighted');
  await page.locator('#notice button.link').first().click();
  assert(await page.locator('#panel-profile').isVisible(), 'error link switches to the right tab');
  eq(await page.evaluate(() => document.activeElement.closest('.field').classList.contains('invalid')), true, 'focus moves to the invalid field');
  await shot(page, 'admin-validation-errors');
  await context.close();
});

await test('G. Admin editor', 'G6', 'Connect flow: bad token shows a friendly error; valid token connects', async () => {
  const gh = fakeGitHub();
  const { context } = await ctx();
  const page = await adminPage(context, gh);
  await field(page.locator('#panel-profile'), 'Current title').fill('X');
  await page.click('#btn-publish');
  assert(await page.locator('#panel-connect').isVisible(), 'publish without connection opens Connect tab');
  await connectAdmin(page, 'wrong-token');
  assert((await page.locator('#connect-result').innerText()).includes('rejected the token'), 'friendly 401');
  await connectAdmin(page, 'good-token');
  assert((await page.locator('#conn-status').innerText()).includes('@mayukhg'), 'connected status');
  eq(await page.evaluate(() => [sessionStorage.getItem('portfolio-admin-token'), localStorage.getItem('portfolio-admin-token')]).then((a) => a.join('|')), 'good-token|', 'token in session only by default');
  eq(await page.locator('#cfg-token').inputValue(), '', 'token field cleared');
  await shot(page, 'admin-connected');
  await context.close();
});

await test('G. Admin editor', 'G7', 'Publish commits correct JSON to the right repo/branch with SHAs, clears dirty state', async () => {
  const gh = fakeGitHub();
  const { context } = await ctx();
  const page = await adminPage(context, gh);
  await connectAdmin(page);
  await page.click('#tab-profile');
  await field(page.locator('#panel-profile'), 'Availability badge').fill('Open to VP Product roles');
  await page.click('#btn-publish');
  await page.waitForSelector('#toast:not([hidden])');
  assert((await page.locator('#toast').innerText()).includes('Published'), 'success toast');
  eq(gh.puts.length, 1, 'only the changed file is committed');
  const put = gh.puts[0];
  eq(put.path, 'content/profile.json', 'path'); eq(put.branch, 'main', 'branch'); eq(put.sha, 'sha1', 'sha of current file');
  assert(/portfolio editor/.test(put.message), 'commit message');
  const saved = JSON.parse(gh.decode('content/profile.json'));
  eq(saved.person.badge, 'Open to VP Product roles', 'committed content');
  eq(JSON.stringify({ ...saved, person: { ...saved.person, badge: profileJSON.person.badge } }), JSON.stringify(profileJSON), 'nothing else changed');
  assert(await page.locator('#dirty-flag').isHidden(), 'dirty cleared'); assert(await page.locator('#btn-publish').isDisabled(), 'publish disabled');
  eq(await page.evaluate(() => localStorage.getItem('portfolio-admin-draft')), null, 'draft cleared');
  await shot(page, 'admin-published');
  await context.close();
});

await test('G. Admin editor', 'G8', 'Publish detects a remote change and asks before overwriting (cancel = no commit)', async () => {
  const gh = fakeGitHub();
  const { context } = await ctx();
  const page = await adminPage(context, gh);
  await connectAdmin(page);
  const other = JSON.parse(gh.decode('content/profile.json')); other.person.location = 'Changed elsewhere';
  gh.files.set('content/profile.json', { content: Buffer.from(JSON.stringify(other)).toString('base64'), sha: 'shaX' });
  await page.click('#tab-profile');
  await field(page.locator('#panel-profile'), 'Current title').fill('Changed here');
  let asked = '';
  page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
  await page.click('#btn-publish');
  await page.waitForTimeout(500);
  assert(asked.includes('changed on GitHub'), 'conflict confirmation shown');
  eq(gh.puts.length, 0, 'no commit after cancel');
  assert(await page.locator('#dirty-flag').isVisible(), 'still dirty');
  await context.close();
});

await test('G. Admin editor', 'G9', 'File uploads: résumé PDF committed; wrong type and fake PDF rejected; portfolio + photo wire into content', async () => {
  const gh = fakeGitHub();
  const { context } = await ctx();
  const page = await adminPage(context, gh);
  await connectAdmin(page);
  await page.click('#tab-files');
  const pdf = fs.readFileSync(path.join(ROOT, 'resume.pdf'));
  const card = (k) => page.locator(`.upload-card[data-upload="${k}"]`);
  await card('resume').locator('input[type=file]').setInputFiles({ name: 'cv.docx', mimeType: 'application/msword', buffer: Buffer.from('x') });
  assert((await card('resume').locator('.up-status').innerText()).includes('Wrong file type'), 'type check');
  await card('resume').locator('input[type=file]').setInputFiles({ name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('hello world, not a pdf') });
  await page.waitForFunction(() => /failed|valid PDF/.test(document.querySelector('.upload-card[data-upload="resume"] .up-status').textContent));
  assert((await card('resume').locator('.up-status').innerText()).includes('valid PDF'), 'magic-byte check');
  await card('resume').locator('input[type=file]').setInputFiles({ name: 'new-resume.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.waitForFunction(() => /uploaded/.test(document.querySelector('.upload-card[data-upload="resume"] .up-status').textContent));
  const rp = gh.puts.find((p) => p.path === 'resume.pdf');
  assert(rp && rp.sha === 'sha3' && Buffer.from(rp.content, 'base64').equals(pdf), 'résumé bytes committed with sha');
  await card('portfolio').locator('input[type=file]').setInputFiles({ name: 'portfolio.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.waitForFunction(() => /uploaded/.test(document.querySelector('.upload-card[data-upload="portfolio"] .up-status').textContent));
  assert(gh.puts.some((p) => p.path === 'assets/portfolio.pdf' && !p.sha), 'new portfolio file created');
  const png = fs.readFileSync(path.join(ROOT, 'assets/mayukh.jpg'));
  await card('photo').locator('input[type=file]').setInputFiles({ name: 'me.jpg', mimeType: 'image/jpeg', buffer: png });
  await page.waitForFunction(() => /uploaded/.test(document.querySelector('.upload-card[data-upload="photo"] .up-status').textContent));
  const d = await page.evaluate(() => JSON.parse(localStorage.getItem('portfolio-admin-draft')).profile);
  eq(d.links.portfolio, 'assets/portfolio.pdf', 'portfolio link set');
  eq(d.person.photo, 'assets/profile-photo.jpg', 'photo path set');
  assert(await page.locator('#dirty-flag').isVisible(), 'publish prompted');
  await shot(page, 'admin-files-uploaded');
  await context.close();
});

await test('G. Admin editor', 'G10', 'Backup download + restore, and “Discard draft” reverts to live content', async () => {
  const { context } = await ctx({ acceptDownloads: true });
  const page = await adminPage(context);
  await field(page.locator('#panel-profile'), 'Current title').fill('Backup me');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export')]);
  const file = await dl.path();
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  eq(data.profile.person.headline, 'Backup me', 'backup content');
  page.once('dialog', (d) => d.accept());
  await page.click('#btn-discard');
  eq(await field(page.locator('#panel-profile'), 'Current title').inputValue(), profileJSON.person.headline, 'discard reverts');
  assert(await page.locator('#dirty-flag').isHidden(), 'clean after discard');
  await page.locator('#inp-import').setInputFiles(file);
  await page.waitForTimeout(300);
  eq(await field(page.locator('#panel-profile'), 'Current title').inputValue(), 'Backup me', 'restore works');
  await page.locator('#inp-import').setInputFiles({ name: 'junk.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
  assert((await page.locator('#toast').innerText()).includes('not a portfolio backup'), 'bad backup rejected');
  await context.close();
});

await test('G. Admin editor', 'G11', '“Remember on this device” stores token in localStorage; Disconnect removes it everywhere', async () => {
  const gh = fakeGitHub();
  const { context } = await ctx();
  const page = await adminPage(context, gh);
  await connectAdmin(page, 'good-token', true);
  eq(await page.evaluate(() => localStorage.getItem('portfolio-admin-token')), 'good-token', 'remembered');
  const p2 = await adminPage(context);
  await p2.waitForFunction(() => /Connected/.test(document.querySelector('#conn-status').textContent));
  note('Reopening the editor reconnects automatically');
  await p2.click('#tab-connect'); await p2.click('#btn-disconnect');
  eq(await p2.evaluate(() => localStorage.getItem('portfolio-admin-token') || sessionStorage.getItem('portfolio-admin-token')), null, 'removed');
  assert((await p2.locator('#conn-status').innerText()).includes('Not connected'), 'status reset');
  await context.close();
});

await test('G. Admin editor', 'G12', 'Editor is usable on mobile (390px): no horizontal overflow, axe audit clean', async () => {
  // bypassCSP only so the axe audit script can be injected — the page's own CSP blocks inline scripts (verified in F5).
  const { context } = await ctx({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, bypassCSP: true });
  const page = await adminPage(context);
  const o = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert(o[0] <= o[1], `overflow ${o[0]} > ${o[1]}`);
  await shot(page, 'admin-mobile-390', { fullPage: false });
  await page.addScriptTag({ content: AXE_SRC });
  const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map((x) => `${x.id} (${x.nodes.length}× ${x.nodes[0].target.join(' ')})`));
  note(`Admin axe: ${v.length} violations${v.length ? ' — ' + v.join('; ') : ''}`);
  eq(v.length, 0, `axe: ${v.join(', ')}`);
  await context.close();
});

await test('G. Admin editor', 'G13', 'Products tab and Files tab render correctly (visual check)', async () => {
  const { context } = await ctx();
  const page = await adminPage(context);
  await page.click('#tab-products');
  await page.locator('#panel-products details[data-key="products"] details.item').first().locator('summary').click();
  await shot(page, 'admin-products-tab');
  await page.click('#tab-files');
  await shot(page, 'admin-files-tab');
  await page.click('#tab-connect');
  await shot(page, 'admin-connect-tab');
  await context.close();
});

/* ------------------------------------------------------------------ report */
await browser.close();
server.close();

const pass = results.filter((r) => r.status === 'PASS').length;
const fail = results.length - pass;
const groups = [...new Set(results.map((r) => r.group))];
const pwVersion = JSON.parse(fs.readFileSync(require.resolve('playwright/package.json'), 'utf8')).version;
const axeVersion = JSON.parse(fs.readFileSync(require.resolve('axe-core/package.json'), 'utf8')).version;
fs.writeFileSync(path.join(QA, 'results.json'), JSON.stringify({ date: new Date().toISOString(), pass, fail, results }, null, 2));

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
let md = `# Validation Report — Portfolio Site & Editor

**Run:** ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC · **Browser:** Chromium (Playwright ${pwVersion}) · **Accessibility engine:** axe-core ${axeVersion}

## Summary

| Result | Count |
|---|---|
| ✅ Passed | **${pass}** |
| ❌ Failed | **${fail}** |
| Total test cases | ${results.length} |
| Screenshots captured | ${results.reduce((n, r) => n + r.shots.length, 0)} |

${fail === 0 ? '**Overall status: PASS** — every test case passed.' : `**Overall status: FAIL** — ${fail} test case(s) need attention (see below).`}

| Area | Passed | Failed |
|---|---|---|
${groups.map((g) => { const rs = results.filter((r) => r.group === g); const p = rs.filter((r) => r.status === 'PASS').length; return `| ${g} | ${p} | ${rs.length - p} |`; }).join('\n')}

## Test cases
`;
for (const g of groups) {
  md += `\n### ${g}\n\n| ID | Test case | Result | Time | Details / evidence |\n|---|---|---|---|---|\n`;
  for (const r of results.filter((x) => x.group === g)) {
    const details = [r.error && `**Error:** ${r.error}`, ...r.notes, ...r.shots.map((s) => `[${s}](screenshots/${s})`)].filter(Boolean).join('<br>');
    md += `| ${r.id} | ${esc(r.name)} | ${r.status === 'PASS' ? '✅ Pass' : '❌ Fail'} | ${(r.ms / 1000).toFixed(1)}s | ${esc(details)} |\n`;
  }
}
md += `
## Screenshots

All screenshots are in [\`qa/screenshots/\`](screenshots/).

${results.flatMap((r) => r.shots.map((s) => `- [${s}](screenshots/${s}) — ${r.id}: ${r.name}`)).join('\n')}

## Scope & method

- **Environment:** the repository is served by a local static server built into the test runner, and tested in headless Chromium.
- **Viewports:** 1440, 1024, 768, 390 and 320 px wide; mobile runs emulate touch.
- **GitHub API:** editor tests use an in-memory mock of the GitHub REST API, so no real commits are made. The mock checks auth headers, SHAs (it rejects stale SHAs with a 409, the same way GitHub does), branch and payload encoding.
- **Accessibility:** the axe-core WCAG 2.0/2.1 A + AA rule sets plus best practices, and manual keyboard, heading, landmark and reduced-motion checks.
- **Security:** XSS attempts through content fields, the admin Content-Security-Policy, token storage and phone-number leakage.

## One-time checks done at initial build (24 Sep 2026)

These were done by hand once, outside this automated suite:

- **Résumé PDF redaction:** the phone number was removed from the PDF's content stream, and the leftover (unreferenced) copy of the original page was purged. Text extraction with \`pdfminer.six\` then found no phone number, and the contact line reads \`email | LinkedIn | Pune, India\`. Test A3 re-checks the raw bytes on every run.
- **Visual review:** every screenshot in this report was inspected at desktop and mobile sizes. That inspection found and fixed a wrapping logo mark, a stretched portrait, and a heading-level and contrast issue that axe also caught.

## Known limitations

- Only Chromium is automated here. Firefox and Safari use the same standard APIs, but aren't covered by this run.
- Real GitHub publishing and the ~1-minute GitHub Pages deploy can't be exercised offline. Do one manual publish after merging to confirm.
- Search engines and social previews read the static meta tags in \`index.html\`, so the SEO title and description edited in the editor affect only the browser tab. Regenerate the share image if your title changes a lot.

## Re-running

\`\`\`bash
cd qa
npm install        # installs Playwright + axe-core (uses your local Chromium)
npx playwright install chromium   # only if no Chromium is installed yet
npm test           # rewrites screenshots/, results.json and VALIDATION_REPORT.md
\`\`\`
`;
fs.writeFileSync(path.join(QA, 'VALIDATION_REPORT.md'), md);
console.log(`\n${pass}/${results.length} passed · report: qa/VALIDATION_REPORT.md`);
process.exit(fail ? 1 : 0);
