/* Portfolio editor — edits content/*.json and uploads files through the GitHub REST API.
 * No build step, no dependencies. The token never leaves the browser except to api.github.com.
 */
(function () {
  'use strict';

  var DRAFT_KEY = 'portfolio-admin-draft';     // shared with ../script.js for ?preview=1
  var CFG_KEY = 'portfolio-admin-config';
  var TOKEN_KEY = 'portfolio-admin-token';
  var API = 'https://api.github.com';
  var DOCS = { profile: 'content/profile.json', products: 'content/products.json' };
  var DEFAULT_CFG = { owner: 'mayukhg', repo: 'mayukhg.github.io', branch: 'main' };

  /* ======================================================================
     Schema — describes every editable field. Types:
     string | email | url | path | text | md | lines | mdlines | paras | color | bool | select | object | array
     ====================================================================== */
  function S(key, label, type, extra) { var o = { key: key, label: label, type: type }; for (var k in extra) o[k] = extra[k]; return o; }

  var GLANCE_ICONS = [['shield', 'Shield'], ['target', 'Target'], ['chip', 'Chip / AI'], ['wrench', 'Wrench / tools'], ['grid', 'Grid / modules'],
    ['trend', 'Trend / growth'], ['alert', 'Alert'], ['globe', 'Globe / trade'], ['bank', 'Bank / finance'], ['bolt', 'Lightning'],
    ['search', 'Search'], ['layers', 'Layers / platform']];

  var PROFILE_SCHEMA = [
    S('person', 'Basics', 'object', { section: true, open: true, fields: [
      S('name', 'Full name', 'string', { required: true }),
      S('headline', 'Current title', 'string', { required: true, hint: 'Shown in bold under your name.' }),
      S('tags', 'Title tags', 'lines', { hint: 'One per line — shown after the title, e.g. “Agentic AI”.' }),
      S('badge', 'Availability badge', 'string', { hint: 'Small pill above your name. Leave empty to hide.' }),
      S('lede', 'Intro paragraph', 'md', { rows: 4 }),
      S('location', 'Location', 'string'),
      S('portraitCaption', 'Photo caption', 'string', { hint: 'Small line under the location on the photo.' }),
      S('photo', 'Photo file', 'path', { hint: 'Upload a new photo on the Files tab — this fills in automatically.' }),
      S('photoAlt', 'Photo description (for screen readers)', 'string')
    ] }),
    S('links', 'Contact links & files', 'object', { section: true, fields: [
      S('email', 'Email', 'email', { required: true }),
      S('linkedin', 'LinkedIn URL', 'url'),
      S('github', 'GitHub URL', 'url'),
      S('resume', 'Résumé PDF', 'path', { hint: 'Leave as resume.pdf; upload a new file on the Files tab. Empty hides the résumé buttons.' }),
      S('portfolio', 'Portfolio PDF', 'path', { hint: 'Set automatically when you upload a portfolio PDF. Empty hides the buttons.' })
    ] }),
    S('stats', 'Headline numbers', 'array', { section: true, desc: 'The big numbers under the hero. Four fit best.', itemTitle: function (x) { return x.value; }, fields: [
      S('value', 'Number', 'string', { required: true, hint: 'e.g. $2M+' }),
      S('label', 'Label', 'string', { required: true })
    ] }),
    S('about', 'About', 'object', { section: true, fields: [
      S('title', 'Heading', 'string', { required: true }),
      S('paragraphs', 'Paragraphs', 'paras', { rows: 10, hint: 'Leave a blank line between paragraphs.' }),
      S('facts', 'Quick facts', 'array', { itemTitle: function (x) { return x.label; }, fields: [
        S('label', 'Label', 'string', { required: true }), S('value', 'Value', 'string', { required: true })
      ] })
    ] }),
    S('approach', 'How I build (approach)', 'object', { section: true, fields: [
      S('title', 'Heading', 'string'), S('subtitle', 'Sub-heading', 'text'),
      S('steps', 'Process steps', 'array', { itemTitle: function (x) { return x.title; }, fields: [S('title', 'Step', 'string', { required: true }), S('text', 'Description', 'string')] }),
      S('throughline', 'Through-line callout', 'md'),
      S('principles', 'Principles', 'array', { itemTitle: function (x) { return x.title; }, fields: [S('title', 'Title', 'string', { required: true }), S('text', 'Text', 'md')] })
    ] }),
    S('experience', 'Experience', 'object', { section: true, fields: [
      S('title', 'Heading', 'string'), S('subtitle', 'Sub-heading', 'text'),
      S('roles', 'Roles (first = shown first)', 'array', { itemTitle: function (x) { return [x.title, x.company].filter(Boolean).join(' @ '); }, fields: [
        S('tab', 'Tab label', 'string', { required: true, hint: 'Short name on the tab, e.g. “Qualys”.' }),
        S('period', 'Tab years', 'string', { hint: 'e.g. 2021 – 2026' }),
        S('title', 'Job title', 'string', { required: true }),
        S('company', 'Company', 'string'),
        S('org', 'Team / location line', 'string'),
        S('dates', 'Dates', 'string', { hint: 'e.g. Feb 2026 – Present' }),
        S('summary', 'One-line summary', 'md'),
        S('metrics', 'Metric chips', 'lines', { hint: 'One per line.' }),
        S('bullets', 'Achievements', 'mdlines', { rows: 8, hint: 'One bullet per line.' }),
        S('related', 'Related product IDs', 'lines', { hint: 'Optional. One product ID per line (see the Product portfolio tab).', check: 'productIds' })
      ] })
    ] }),
    S('skills', 'Skills', 'object', { section: true, fields: [
      S('title', 'Heading', 'string'),
      S('groups', 'Skill groups', 'array', { itemTitle: function (x) { return x.name; }, fields: [
        S('name', 'Group name', 'string', { required: true }), S('items', 'Skills', 'lines', { rows: 6, hint: 'One per line.' })
      ] })
    ] }),
    S('writing', 'Writing & builds', 'object', { section: true, fields: [S('title', 'Heading', 'string'), S('text', 'Text', 'md', { rows: 4 })] }),
    S('education', 'Education', 'array', { section: true, itemTitle: function (x) { return x.degree; }, fields: [
      S('mark', 'Short badge', 'string', { hint: '2–4 letters, e.g. IIMK' }), S('degree', 'Qualification', 'string', { required: true }), S('school', 'Institution · year', 'string')
    ] }),
    S('contact', 'Contact section', 'object', { section: true, fields: [S('title', 'Heading', 'string'), S('text', 'Text', 'md')] }),
    S('meta', 'Search & sharing', 'object', { section: true, desc: 'Browser tab title and search-engine description.', fields: [
      S('title', 'Page title', 'string'), S('description', 'Description', 'text', { hint: 'About 150 characters.' })
    ] })
  ];

  var PRODUCTS_SCHEMA = [
    S('_heading', 'Section heading', 'object', { section: true, flat: true, fields: [
      S('title', 'Heading', 'string', { required: true }), S('subtitle', 'Sub-heading', 'text')
    ] }),
    S('overview', 'Summary panel (“at a glance” cards)', 'object', { section: true, desc: 'One clickable card per product is generated automatically — order and content follow the Products list below.', fields: [
      S('show', 'Show the summary panel', 'bool'),
      S('eyebrow', 'Small label', 'string'),
      S('title', 'Heading', 'string')
    ] }),
    S('arenas', 'Arenas (filter groups)', 'array', { section: true, desc: 'Each product belongs to one arena. Arenas with no products are hidden.', itemTitle: function (x) { return x.label; }, fields: [
      S('id', 'Arena ID', 'string', { required: true, check: 'id', hint: 'Lowercase letters, numbers and dashes.' }),
      S('label', 'Label', 'string', { required: true }),
      S('color', 'Colour', 'color')
    ] }),
    S('products', 'Products', 'array', { section: true, open: true, desc: 'Order here = order on the site.', itemTitle: function (x) { return x.name; }, fields: [
      S('name', 'Product name', 'string', { required: true }),
      S('id', 'Product ID', 'string', { required: true, check: 'productId', hint: 'Short unique ID used in links, e.g. “risk-copilot”. Filled from the name if left empty.' }),
      S('arena', 'Arena', 'select', { required: true, options: function () { return (state.products.arenas || []).map(function (a) { return [a.id, a.label || a.id]; }); } }),
      S('kicker', 'Label above the name', 'string', { hint: 'e.g. “AI Defence Ecosystem · Prevent”. Empty = arena name.' }),
      S('icon', 'Summary card icon', 'select', { options: function () { return GLANCE_ICONS; } }),
      S('tagline', 'Summary card tagline', 'md', { hint: 'One short sentence for the “at a glance” card. Empty = uses the one-line summary.' }),
      S('summary', 'One-line summary', 'md', { required: true }),
      S('client', 'Implemented for', 'string'),
      S('stack', 'Built with', 'lines', { hint: 'One technology per line.' }),
      S('github', 'GitHub link', 'url'),
      S('demo', 'Live demo link', 'url'),
      S('pain', 'Customer pain', 'md', { rows: 3 }),
      S('bet', 'The product bet', 'md', { rows: 3 }),
      S('whyLabel', '“Why AI” heading', 'string', { hint: 'e.g. “Why AI is the right call” or “Why not an LLM”.' }),
      S('why', 'Why AI (or not)', 'md', { rows: 3 }),
      S('tradeoff', 'Key trade-off', 'md', { rows: 3 }),
      S('validated', 'Validated with', 'md', { rows: 3 }),
      S('outcomes', 'Value & outcomes', 'mdlines', { hint: 'One per line.' }),
      S('note', 'Footnote', 'md')
    ] }),
    S('ecosystem', 'Spotlight section (AI Defence Ecosystem)', 'object', { section: true, fields: [
      S('show', 'Show this section on the site', 'bool'),
      S('eyebrow', 'Small label', 'string'), S('title', 'Heading', 'string'), S('subtitle', 'Sub-heading', 'text'),
      S('pillars', 'Pillars', 'array', { itemTitle: function (x) { return x.phase + (x.name ? ' — ' + x.name : ''); }, fields: [
        S('phase', 'Phase', 'string'), S('name', 'Product', 'string'), S('text', 'Text', 'md')
      ] }),
      S('spine', 'Callout', 'md'),
      S('opportunity', 'The opportunity', 'mdlines', { hint: 'One per line.' }),
      S('differentiator', 'The differentiator', 'mdlines', { hint: 'One per line.' }),
      S('metrics', 'Metrics', 'array', { itemTitle: function (x) { return x.value; }, fields: [
        S('value', 'Number', 'string', { required: true }), S('label', 'Label', 'string'), S('caption', 'Caption', 'string')
      ] }),
      S('note', 'Footnote', 'md')
    ] })
  ];

  /* ======================================================================
     State
     ====================================================================== */
  var state = { profile: null, products: null, published: { profile: '', products: '' }, cfg: null, token: '', login: '' };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === 'text') el.textContent = attrs[k];
      else if (k === 'class') el.className = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] === true) el.setAttribute(k, '');
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    [].concat(kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function serialize(doc) { return JSON.stringify(state[doc], null, 2) + '\n'; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  /* ---------- storage (all wrapped: private mode can throw) ---------- */
  function lsGet(k, store) { try { return (store || localStorage).getItem(k); } catch (e) { return null; } }
  function lsSet(k, v, store) { try { (store || localStorage).setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) { /* ignore */ } }

  /* ---------- toast / notice ---------- */
  var toastTimer;
  function toast(msg, kind, html) {
    var t = $('#toast');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    if (html) t.innerHTML = html; else t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, kind === 'err' ? 9000 : 5000);
  }
  function notice(content, kind) {
    var n = $('#notice');
    n.className = 'notice' + (kind ? ' ' + kind : '');
    n.innerHTML = '';
    if (!content) { n.hidden = true; return; }
    if (typeof content === 'string') n.textContent = content; else n.appendChild(content);
    n.hidden = false;
  }

  /* ======================================================================
     Form builder
     ====================================================================== */
  var saveTimer;
  function changed() {
    updateDirty();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 250);
  }

  function blankFor(fields) {
    var o = {};
    fields.forEach(function (f) {
      o[f.key] = (f.type === 'lines' || f.type === 'mdlines' || f.type === 'paras' || f.type === 'array') ? [] :
                 f.type === 'bool' ? false : f.type === 'object' ? blankFor(f.fields) : f.type === 'color' ? '#4338ca' : '';
    });
    return o;
  }

  function buildFields(fields, obj) {
    return fields.map(function (f) { return buildField(f, obj); });
  }

  function buildField(f, parent) {
    if (f.type === 'object') {
      var target = f.flat ? parent : (parent[f.key] = parent[f.key] || blankFor(f.fields));
      var body = h('div', { class: 'section-body' }, [f.desc ? h('p', { class: 'desc', text: f.desc }) : null].concat(buildFields(f.fields, target)));
      if (f.section) return h('details', { class: 'section', open: !!f.open, 'data-key': f.key }, [h('summary', { text: f.label }), body]);
      return h('div', { class: 'group' }, [h('div', { class: 'group-label', text: f.label }), body]);
    }
    if (f.type === 'array') {
      if (!Array.isArray(parent[f.key])) parent[f.key] = [];
      var arrEl = buildArray(f, parent[f.key]);
      if (f.section) {
        return h('details', { class: 'section', open: !!f.open, 'data-key': f.key }, [
          h('summary', {}, [f.label, h('small', { class: 'count', text: countText(parent[f.key]) })]),
          h('div', { class: 'section-body' }, [f.desc ? h('p', { class: 'desc', text: f.desc }) : null, arrEl])
        ]);
      }
      return h('div', { class: 'field' }, [h('span', { text: f.label }), arrEl]);
    }
    return buildInput(f, parent);
  }
  function countText(a) { return a.length + (a.length === 1 ? ' item' : ' items'); }

  function buildInput(f, parent) {
    var v = parent[f.key], input;
    var isList = f.type === 'lines' || f.type === 'mdlines' || f.type === 'paras';
    var labelKids = [f.label];
    if (f.required) labelKids.push(h('span', { class: 'req', 'aria-hidden': 'true', text: '*' }));
    if (f.type === 'md' || f.type === 'mdlines' || f.type === 'paras') labelKids.push(h('span', { class: 'md-badge', text: 'rich', title: 'Supports **bold** and [links](https://…)' }));

    if (f.type === 'bool') {
      input = h('input', { type: 'checkbox' });
      input.checked = !!v;
      input.addEventListener('change', function () { parent[f.key] = input.checked; changed(); });
      return h('label', { class: 'check' }, [input, f.label]);
    }
    if (f.type === 'select') {
      input = h('select', { required: !!f.required });
      var fill = function () {
        var cur = parent[f.key] || '';
        input.innerHTML = '';
        var opts = f.options();
        if (!f.required) input.appendChild(h('option', { value: '', text: 'Automatic' }));
        if (cur ? !opts.some(function (o) { return o[0] === cur; }) : f.required) input.appendChild(h('option', { value: cur, text: cur ? cur + ' (unknown)' : '— choose —' }));
        opts.forEach(function (o) { input.appendChild(h('option', { value: o[0], text: o[1] })); });
        input.value = cur;
      };
      fill();
      input.addEventListener('focus', fill);
      input.addEventListener('change', function () { parent[f.key] = input.value; changed(); });
    } else if (f.type === 'text' || f.type === 'md' || isList) {
      input = h('textarea', { rows: f.rows || (isList ? 4 : 2), spellcheck: 'true' });
      input.value = isList ? (v || []).join(f.type === 'paras' ? '\n\n' : '\n') : (v || '');
      input.addEventListener('input', function () {
        var raw = input.value;
        parent[f.key] = isList
          ? raw.split(f.type === 'paras' ? /\n\s*\n/ : /\n/).map(function (s) { return s.trim(); }).filter(Boolean)
          : raw;
        changed();
      });
    } else {
      var t = f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : f.type === 'color' ? 'color' : 'text';
      input = h('input', { type: t, spellcheck: t === 'text' ? 'true' : 'false', placeholder: f.type === 'url' ? 'https://…' : null });
      input.value = v == null ? '' : v;
      input.addEventListener('input', function () { parent[f.key] = f.type === 'color' ? input.value : input.value.trim() === '' ? '' : input.value; changed(); });
      input.addEventListener('blur', function () {
        if (typeof parent[f.key] === 'string' && parent[f.key] !== parent[f.key].trim()) { parent[f.key] = parent[f.key].trim(); input.value = parent[f.key]; changed(); }
      });
      if (f.check === 'productId') {
        // Auto-fill product ID from the name when empty.
        input.addEventListener('focus', function () {
          if (!input.value && parent.name) { input.value = slugify(parent.name); parent[f.key] = input.value; changed(); }
        });
      }
    }
    var wrap = h('label', { class: 'field' }, [h('span', {}, labelKids), input, f.hint ? h('small', { text: f.hint }) : null]);
    wrap._field = f; wrap._parent = parent; wrap._input = input;
    return wrap;
  }

  function buildArray(f, list) {
    var wrap = h('div', { class: 'array' });
    var openSet = new WeakSet();
    function titleOf(item, i) { var t = f.itemTitle && f.itemTitle(item); return (t && String(t).trim()) || 'Untitled ' + (i + 1); }
    function draw(focusItem) {
      wrap.innerHTML = '';
      list.forEach(function (item, i) {
        var titleEl = h('span', { class: 'item-title', text: titleOf(item, i) });
        function tool(label, sym, fn, dis, cls) {
          return h('button', { type: 'button', class: cls || null, 'aria-label': label + ': ' + titleOf(item, i), title: label, disabled: !!dis, onclick: function (e) { e.preventDefault(); e.stopPropagation(); fn(); } }, [sym]);
        }
        var body = h('div', { class: 'item-body' }, buildFields(f.fields, item));
        body.addEventListener('input', function () { titleEl.textContent = titleOf(item, i); });
        body.addEventListener('change', function () { titleEl.textContent = titleOf(item, i); });
        var det = h('details', { class: 'item', open: openSet.has(item) }, [
          h('summary', {}, [
            h('span', { class: 'item-num', text: (i + 1) + '.' }), titleEl,
            h('span', { class: 'item-tools' }, [
              tool('Move up', '↑', function () { move(i, -1); }, i === 0),
              tool('Move down', '↓', function () { move(i, 1); }, i === list.length - 1),
              tool('Duplicate', '⧉', function () { dup(i); }),
              tool('Delete', '✕', function () { del(i); }, false, 'del')
            ])
          ]),
          body
        ]);
        det.addEventListener('toggle', function () { if (det.open) openSet.add(item); else openSet.delete(item); });
        wrap.appendChild(det);
        if (item === focusItem) setTimeout(function () { det.scrollIntoView({ block: 'nearest' }); var inp = det.querySelector('.item-body input, .item-body textarea, .item-body select'); if (inp) inp.focus(); }, 0);
      });
      wrap.appendChild(h('button', { type: 'button', class: 'btn small add', onclick: add }, ['+ Add ' + (f.itemName || singular(f.label))]));
      var cnt = wrap.parentNode && wrap.closest('details.section') && wrap.closest('details.section').querySelector(':scope > summary .count');
      if (cnt) cnt.textContent = countText(list);
    }
    function move(i, d) { var x = list.splice(i, 1)[0]; list.splice(i + d, 0, x); draw(); changed(); }
    function dup(i) {
      var c = clone(list[i]);
      if ('id' in c && c.id) c.id = uniqueId(c.id + '-copy', list);
      if ('name' in c && c.name) c.name += ' (copy)';
      list.splice(i + 1, 0, c); openSet.add(c); draw(c); changed();
    }
    function del(i) {
      if (!confirm('Delete “' + titleOf(list[i], i) + '”? You can undo by discarding the draft before publishing.')) return;
      list.splice(i, 1); draw(); changed();
    }
    function add() { var n = blankFor(f.fields); list.push(n); openSet.add(n); draw(n); changed(); }
    draw();
    return wrap;
  }
  function singular(label) { return String(label).split(' (')[0].toLowerCase().replace(/ies$/, 'y').replace(/s$/, ''); }
  function uniqueId(base, list) { var id = base, n = 2; while (list.some(function (x) { return x.id === id; })) id = base + '-' + n++; return id; }

  function renderForms() {
    var fp = $('#form-profile'), fr = $('#form-products');
    var openP = openSections(fp), openR = openSections(fr);
    fp.innerHTML = ''; fr.innerHTML = '';
    buildFields(PROFILE_SCHEMA, state.profile).forEach(function (el) { fp.appendChild(el); });
    buildFields(PRODUCTS_SCHEMA, state.products).forEach(function (el) { fr.appendChild(el); });
    restoreSections(fp, openP); restoreSections(fr, openR);
    refreshFiles();
    updateDirty();
  }
  function openSections(root) { var m = {}; $$(':scope > details.section', root).forEach(function (d) { m[d.dataset.key] = d.open; }); return m; }
  function restoreSections(root, m) { $$(':scope > details.section', root).forEach(function (d) { if (d.dataset.key in m) d.open = m[d.dataset.key]; }); }

  /* ======================================================================
     Validation
     ====================================================================== */
  var URL_RE = /^https?:\/\/[^\s]+\.[^\s]+$/i;
  var PATH_RE = /^(?!javascript:)(?!\/\/)[\w\-./%]+$/i;
  function validate() {
    var errors = [];
    $$('.field.invalid').forEach(function (el) { el.classList.remove('invalid'); var m = el.querySelector('.err-msg'); if (m) m.remove(); });
    var productIds = (state.products.products || []).map(function (p) { return p.id; });
    var arenaIds = (state.products.arenas || []).map(function (a) { return a.id; });
    $$('.field').forEach(function (el) {
      var f = el._field; if (!f) return;
      var v = el._parent[f.key], msg = '';
      var empty = v == null || v === '' || (Array.isArray(v) && !v.length);
      if (f.required && empty) msg = 'Required.';
      else if (!empty && f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = 'Enter a valid email address.';
      else if (!empty && f.type === 'url' && !URL_RE.test(v)) msg = 'Enter a full link starting with https://';
      else if (!empty && f.type === 'path' && !(PATH_RE.test(v) || URL_RE.test(v))) msg = 'Use a file path like assets/file.pdf or a full https:// link.';
      else if (!empty && (f.check === 'id' || f.check === 'productId') && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)) msg = 'Use lowercase letters, numbers and dashes only.';
      else if (!empty && f.check === 'productId' && productIds.filter(function (x) { return x === v; }).length > 1) msg = 'Another product already uses this ID.';
      else if (!empty && f.check === 'id' && arenaIds.filter(function (x) { return x === v; }).length > 1) msg = 'Another arena already uses this ID.';
      else if (!empty && f.type === 'select' && f.key === 'arena' && arenaIds.indexOf(v) === -1) msg = 'Choose an existing arena.';
      else if (!empty && f.check === 'productIds') {
        var bad = v.filter(function (id) { return productIds.indexOf(id) === -1; });
        if (bad.length) msg = 'Unknown product ID: ' + bad.join(', ');
      }
      if (msg) {
        el.classList.add('invalid');
        el.appendChild(h('span', { class: 'err-msg', text: msg }));
        errors.push({ el: el, msg: msg, label: f.label, where: describe(el) });
      }
    });
    return errors;
  }
  function describe(el) {
    var parts = [], item = el.closest('details.item'), sec = el.closest('details.section'), panel = el.closest('.panel');
    if (panel) parts.push(panel.querySelector('h2').textContent);
    if (sec) parts.push(sec.querySelector(':scope > summary').firstChild.textContent);
    if (item) parts.push(item.querySelector('.item-title').textContent);
    return parts.join(' › ');
  }
  function showErrors(errors) {
    var list = h('ul');
    errors.slice(0, 12).forEach(function (e) {
      list.appendChild(h('li', {}, [h('button', { type: 'button', class: 'link', onclick: function () { reveal(e.el); } }, [e.where + ' › ' + e.label + ': ' + e.msg])]));
    });
    if (errors.length > 12) list.appendChild(h('li', { text: '…and ' + (errors.length - 12) + ' more.' }));
    notice(h('div', {}, [h('b', { text: 'Fix ' + errors.length + ' problem' + (errors.length > 1 ? 's' : '') + ' before publishing:' }), list]), 'err');
  }
  function reveal(el) {
    var panel = el.closest('.panel');
    if (panel) selectTab($('#' + panel.getAttribute('aria-labelledby')));
    var p = el.parentNode;
    while (p && p !== document.body) { if (p.tagName === 'DETAILS') p.open = true; p = p.parentNode; }
    el.scrollIntoView({ block: 'center' });
    if (el._input) el._input.focus();
  }

  /* ======================================================================
     Draft, dirty state, backup
     ====================================================================== */
  function isDirty() { return serialize('profile') !== state.published.profile || serialize('products') !== state.published.products; }
  function updateDirty() {
    var d = isDirty();
    $('#dirty-flag').hidden = !d;
    $('#btn-publish').disabled = !d;
  }
  function saveDraft() {
    if (!isDirty()) { lsDel(DRAFT_KEY); return; }
    lsSet(DRAFT_KEY, JSON.stringify({ profile: state.profile, products: state.products, savedAt: new Date().toISOString() }));
  }
  window.addEventListener('pagehide', function () { clearTimeout(saveTimer); if (state.profile) saveDraft(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && state.profile) { clearTimeout(saveTimer); saveDraft(); } });

  function download() {
    var blob = new Blob([JSON.stringify({ profile: state.profile, products: state.products }, null, 2)], { type: 'application/json' });
    var a = h('a', { href: URL.createObjectURL(blob), download: 'portfolio-backup-' + new Date().toISOString().slice(0, 10) + '.json' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function importFile(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (!d || typeof d.profile !== 'object' || typeof d.products !== 'object' || !Array.isArray(d.products.products)) throw new Error('This file is not a portfolio backup.');
        state.profile = d.profile; state.products = d.products;
        renderForms(); saveDraft();
        toast('Backup restored as a draft. Review, then publish.', 'ok');
      } catch (e) { toast('Could not restore: ' + e.message, 'err'); }
    };
    r.readAsText(file);
  }

  /* ======================================================================
     GitHub API
     ====================================================================== */
  function gh(path, opts) {
    opts = opts || {};
    var headers = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Authorization': 'Bearer ' + state.token };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(API + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store' })
      .then(function (r) {
        return r.text().then(function (t) {
          var data = null; try { data = t ? JSON.parse(t) : null; } catch (e) { /* non-JSON */ }
          if (!r.ok) { var err = new Error((data && data.message) || ('HTTP ' + r.status)); err.status = r.status; throw err; }
          return data;
        });
      });
  }
  function repoPath(p) {
    var c = state.cfg;
    return '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + '/contents/' + p.split('/').map(encodeURIComponent).join('/');
  }
  function getFile(p) {
    return gh(repoPath(p) + '?ref=' + encodeURIComponent(state.cfg.branch)).catch(function (e) { if (e.status === 404) return null; throw e; });
  }
  function putFile(p, b64, message, sha) {
    var body = { message: message, content: b64, branch: state.cfg.branch };
    if (sha) body.sha = sha;
    return gh(repoPath(p), { method: 'PUT', body: body });
  }
  function b64FromText(s) {
    var bytes = new TextEncoder().encode(s), bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function textFromB64(b64) {
    var bin = atob(String(b64).replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function friendly(e) {
    if (e.status === 401) return 'GitHub rejected the token (expired or mistyped). Reconnect on the Connect tab.';
    if (e.status === 403) return 'The token is not allowed to do this. Check it has Contents: Read and write for this repository.';
    if (e.status === 404) return 'Repository or branch not found — or the token cannot see it. Check the Connect settings.';
    if (e.status === 409) return 'GitHub reported a conflict — someone else changed the file. Reload the editor and try again.';
    if (e.status === 422) return 'GitHub refused the change: ' + e.message;
    return e.message === 'Failed to fetch' ? 'Network error — check your internet connection.' : e.message;
  }

  function connected() { return !!(state.token && state.login); }
  function setConnStatus() {
    var s = $('#conn-status');
    s.textContent = connected() ? 'Connected as @' + state.login + ' · ' + state.cfg.branch : 'Not connected';
    s.classList.toggle('ok', connected());
  }

  function connect(silent) {
    if (!state.token) { state.login = ''; setConnStatus(); return Promise.resolve(false); }
    var c = state.cfg;
    return gh('/user').then(function (u) {
      state.login = u.login;
      return gh('/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo));
    }).then(function (repo) {
      if (repo.permissions && !repo.permissions.push) { var e = new Error('This token can read the repository but cannot save to it. Give it Contents: Read and write.'); throw e; }
      return gh('/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + '/branches/' + encodeURIComponent(c.branch));
    }).then(function () {
      setConnStatus();
      return loadPublishedFromGitHub().then(function () { return true; });
    }).catch(function (e) {
      state.login = '';
      setConnStatus();
      if (!silent) throw e;
      notice('Saved GitHub connection could not be verified: ' + friendly(e) + ' Open the Connect tab to fix it.');
      return false;
    });
  }

  function loadPublishedFromGitHub() {
    return Promise.all([getFile(DOCS.profile), getFile(DOCS.products)]).then(function (r) {
      ['profile', 'products'].forEach(function (doc, i) {
        if (!r[i]) return;
        var text = textFromB64(r[i].content);
        var wasDirty = isDirty();
        state.published[doc] = JSON.stringify(JSON.parse(text), null, 2) + '\n';
        if (!wasDirty) state[doc] = JSON.parse(text);
      });
      renderForms();
    });
  }

  /* ---------- publish ---------- */
  function publish() {
    notice(null);
    var errors = validate();
    if (errors.length) { showErrors(errors); return; }
    if (!connected()) {
      selectTab($('#tab-connect'));
      notice('Connect to GitHub first — your changes are safe in the draft.');
      return;
    }
    var btn = $('#btn-publish');
    btn.disabled = true; btn.textContent = 'Publishing…';
    var docs = ['profile', 'products'].filter(function (d) { return serialize(d) !== state.published[d]; });
    var commits = [];
    docs.reduce(function (p, doc) {
      return p.then(function () {
        return getFile(DOCS[doc]).then(function (remote) {
          var remoteText = remote ? JSON.stringify(JSON.parse(textFromB64(remote.content)), null, 2) + '\n' : '';
          if (remote && state.published[doc] && remoteText !== state.published[doc] &&
              !confirm('The ' + doc + ' file changed on GitHub since you opened the editor. Overwrite it with your version?')) {
            var e = new Error('Publish cancelled.'); e.cancel = true; throw e;
          }
          var text = serialize(doc);
          return putFile(DOCS[doc], b64FromText(text), 'Update ' + doc + ' content via portfolio editor', remote && remote.sha)
            .then(function (res) { state.published[doc] = text; if (res && res.commit) commits.push(res.commit.html_url); });
        });
      });
    }, Promise.resolve()).then(function () {
      saveDraft(); updateDirty();
      var link = commits.length ? ' <a href="' + commits[commits.length - 1] + '" target="_blank" rel="noopener">View commit</a>' : '';
      toast('', 'ok', 'Published! The live site updates in about a minute.' + link);
    }).catch(function (e) {
      if (!e.cancel) notice('Publish failed: ' + friendly(e), 'err');
    }).then(function () {
      btn.textContent = 'Publish changes';
      updateDirty();
    });
  }

  /* ---------- uploads ---------- */
  var UPLOADS = {
    resume: { path: function () { return 'resume.pdf'; }, types: ['application/pdf'], max: 20, magic: '%PDF', label: 'Résumé' },
    portfolio: { path: function () { return 'assets/portfolio.pdf'; }, types: ['application/pdf'], max: 25, magic: '%PDF', label: 'Portfolio' },
    photo: { path: function (f) { return 'assets/profile-photo.' + ({ 'image/png': 'png', 'image/webp': 'webp' }[f.type] || 'jpg'); }, types: ['image/jpeg', 'image/png', 'image/webp'], max: 5, label: 'Photo' }
  };
  function upload(kind, file, statusEl) {
    var spec = UPLOADS[kind];
    function status(msg, cls) { statusEl.textContent = msg; statusEl.className = 'up-status' + (cls ? ' ' + cls : ''); }
    if (!connected()) { status('Connect to GitHub first (Connect tab).', 'err'); return Promise.resolve(); }
    if (spec.types.indexOf(file.type) === -1) { status('Wrong file type — expected ' + (kind === 'photo' ? 'JPG, PNG or WebP' : 'PDF') + '.', 'err'); return Promise.resolve(); }
    if (file.size > spec.max * 1024 * 1024) { status('File is too large (max ' + spec.max + ' MB).', 'err'); return Promise.resolve(); }
    if (!file.size) { status('That file is empty.', 'err'); return Promise.resolve(); }
    status('Uploading ' + file.name + '…');
    var path = spec.path(file);
    return readB64(file).then(function (b64) {
      if (spec.magic && atob(b64.slice(0, 8)).slice(0, 4) !== spec.magic) throw new Error('This does not look like a valid PDF file.');
      return getFile(path).then(function (existing) {
        return putFile(path, b64, 'Upload ' + spec.label.toLowerCase() + ' via portfolio editor', existing && existing.sha);
      });
    }).then(function () {
      var needsPublish = false;
      state.profile.links = state.profile.links || {};
      state.profile.person = state.profile.person || {};
      if (kind === 'resume' && state.profile.links.resume !== 'resume.pdf') { state.profile.links.resume = 'resume.pdf'; needsPublish = true; }
      if (kind === 'portfolio' && state.profile.links.portfolio !== path) { state.profile.links.portfolio = path; needsPublish = true; }
      if (kind === 'photo' && state.profile.person.photo !== path) { state.profile.person.photo = path; needsPublish = true; }
      if (kind === 'photo') lastPhotoBlob = URL.createObjectURL(file);
      renderForms(); saveDraft();
      status(spec.label + ' uploaded.' + (needsPublish ? ' Press “Publish changes” to show it on the site.' : ' It is live within about a minute.'), 'ok');
    }).catch(function (e) { status('Upload failed: ' + friendly(e), 'err'); });
  }
  var lastPhotoBlob = '';
  function readB64(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { rej(new Error('Could not read the file.')); };
      r.readAsDataURL(file);
    });
  }
  function refreshFiles() {
    var links = state.profile.links || {}, person = state.profile.person || {};
    var cp = $('#cur-portfolio');
    cp.innerHTML = '';
    if (links.portfolio) cp.appendChild(h('a', { href: '../' + links.portfolio, target: '_blank', rel: 'noopener', text: links.portfolio }));
    else cp.textContent = 'none';
    var cr = $('#cur-resume');
    cr.textContent = links.resume || 'none (buttons hidden)';
    cr.href = links.resume ? '../' + links.resume : '#';
    var img = $('#cur-photo');
    img.src = lastPhotoBlob || (person.photo && !/^https?:/i.test(person.photo) ? '../' + person.photo : '');
    img.hidden = !img.getAttribute('src');
  }

  /* ======================================================================
     Tabs + wiring
     ====================================================================== */
  function selectTab(tab) {
    $$('#tabs [role=tab]').forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  function wireTabs() {
    var tabs = $$('#tabs [role=tab]');
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { selectTab(t); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home') n = tabs[0];
        if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); selectTab(n); n.focus(); }
      });
    });
  }

  function wire() {
    wireTabs();
    $('#btn-publish').addEventListener('click', publish);
    $('#btn-preview').addEventListener('click', function () {
      lsSet(DRAFT_KEY, JSON.stringify({ profile: state.profile, products: state.products, savedAt: new Date().toISOString() }));
      window.open('../?preview=1', '_blank', 'noopener');
    });
    $('#btn-export').addEventListener('click', download);
    $('#inp-import').addEventListener('change', function (e) { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; });
    $('#btn-discard').addEventListener('click', function () {
      if (!isDirty()) { toast('There is no unpublished draft.'); return; }
      if (!confirm('Discard all unpublished changes and go back to the live content?')) return;
      state.profile = JSON.parse(state.published.profile);
      state.products = JSON.parse(state.published.products);
      lsDel(DRAFT_KEY); notice(null); renderForms();
      toast('Draft discarded.', 'ok');
    });
    $$('input[type=file][data-kind]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var f = inp.files[0]; if (!f) return;
        upload(inp.dataset.kind, f, inp.closest('.upload-card').querySelector('.up-status')).then(function () { inp.value = ''; });
      });
    });

    $('#cfg-owner').value = state.cfg.owner;
    $('#cfg-repo').value = state.cfg.repo;
    $('#cfg-branch').value = state.cfg.branch;
    $('#cfg-remember').checked = !!lsGet(TOKEN_KEY);
    $('#connect-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var out = $('#connect-result');
      var cfg = { owner: $('#cfg-owner').value.trim(), repo: $('#cfg-repo').value.trim(), branch: $('#cfg-branch').value.trim() };
      var tok = $('#cfg-token').value.trim() || state.token;
      if (!cfg.owner || !cfg.repo || !cfg.branch) { out.textContent = 'Fill in owner, repository and branch.'; out.className = 'up-status err'; return; }
      if (!tok) { out.textContent = 'Paste your access token.'; out.className = 'up-status err'; return; }
      state.cfg = cfg; state.token = tok;
      lsSet(CFG_KEY, JSON.stringify(cfg));
      out.textContent = 'Checking…'; out.className = 'up-status';
      connect(false).then(function () {
        lsDel(TOKEN_KEY);
        lsSet(TOKEN_KEY, tok, $('#cfg-remember').checked ? localStorage : sessionStorage);
        $('#cfg-token').value = '';
        out.textContent = 'Connected as @' + state.login + '. You can publish and upload files now.'; out.className = 'up-status ok';
        notice(null);
      }).catch(function (err) {
        state.token = '';
        out.textContent = 'Could not connect: ' + friendly(err); out.className = 'up-status err';
      });
    });
    $('#btn-disconnect').addEventListener('click', function () {
      state.token = ''; state.login = ''; lsDel(TOKEN_KEY); setConnStatus();
      $('#connect-result').textContent = 'Disconnected. The token was removed from this browser.'; $('#connect-result').className = 'up-status ok';
    });
  }

  /* ======================================================================
     Boot
     ====================================================================== */
  function loadSiteJSON(p) {
    return fetch('../' + p, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(p + ' → HTTP ' + r.status); return r.json(); });
  }
  function boot() {
    try { state.cfg = Object.assign({}, DEFAULT_CFG, JSON.parse(lsGet(CFG_KEY) || '{}')); } catch (e) { state.cfg = Object.assign({}, DEFAULT_CFG); }
    state.token = lsGet(TOKEN_KEY, sessionStorage) || lsGet(TOKEN_KEY) || '';
    wire();
    Promise.all([loadSiteJSON(DOCS.profile), loadSiteJSON(DOCS.products)]).then(function (r) {
      state.profile = r[0]; state.products = r[1];
      state.published.profile = serialize('profile');
      state.published.products = serialize('products');
      var draft = null;
      try { draft = JSON.parse(lsGet(DRAFT_KEY) || 'null'); } catch (e) { draft = null; }
      if (draft && draft.profile && draft.products) {
        state.profile = draft.profile; state.products = draft.products;
        if (isDirty()) notice('Restored your unpublished draft' + (draft.savedAt ? ' from ' + new Date(draft.savedAt).toLocaleString() : '') + '. Publish it, or use “Discard draft”.');
      }
      renderForms();
      setConnStatus();
      return connect(true);
    }).catch(function (e) {
      notice('Could not load the site content: ' + e.message, 'err');
    });
  }
  boot();
})();
