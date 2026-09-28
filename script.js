/* Mayukh Ghosh — portfolio renderer + interactions (vanilla JS, no dependencies)
 *
 * All copy lives in content/profile.json and content/products.json and is edited
 * through /admin. This file only turns that data into markup.
 * Text fields support **bold** and [link text](https://url) — nothing else.
 */
(function () {
  'use strict';

  var DRAFT_KEY = 'portfolio-admin-draft';

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeUrl(u) {
    u = String(u || '').trim();
    return /^(https?:|mailto:|#|\/|[\w.\-]+(\/|$|\.))/i.test(u) && !/^javascript:/i.test(u) ? u : '#';
  }
  // Minimal, safe inline markup: escape first, then **bold** and [text](url).
  function md(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) {
        var ext = /^https?:/i.test(u);
        return '<a href="' + esc(safeUrl(u.replace(/&amp;/g, '&'))) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>';
      });
  }
  function arr(a) { return Array.isArray(a) ? a.filter(function (x) { return x !== '' && x != null; }) : []; }
  function slot(name) { return document.querySelector('[data-slot="' + name + '"]'); }
  function set(name, html) { var el = slot(name); if (el) el.innerHTML = html; return el; }
  function icon(id) { return '<svg aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function ext(href) { return /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : ''; }
  function slug(s, i) { return (String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item') + (i != null ? '-' + i : ''); }
  // Inline custom property for a content-supplied colour (hex only), e.g. --arena or --track.
  function colorVar(name, c) { return /^#[0-9a-f]{3,8}$/i.test(c || '') ? ' style="' + name + ':' + c + '"' : ''; }
  function docLink(href, cls, label, extra) {
    return '<a class="' + cls + '" href="' + esc(safeUrl(href)) + '" target="_blank" rel="noopener"' + (extra || '') + '>' + icon('i-file') + label + '</a>';
  }

  // How much a figure can be trusted: shown as a badge next to outcomes and metrics.
  var EVIDENCE = {
    modelled: ['Modelled estimate', 'Estimated on the public build; production figures are under NDA'],
    production: ['In production', 'Measured in production']
  };
  function evBadge(kind) {
    var e = EVIDENCE[kind];
    return e ? '<span class="ev ev-' + kind + '" title="' + esc(e[1]) + '">' + esc(e[0]) + '</span>' : '';
  }

  /* ---------- data loading ---------- */
  function loadJSON(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' → HTTP ' + r.status);
      return r.json();
    });
  }
  function loadContent() {
    var preview = /[?&]preview=1\b/.test(location.search);
    if (preview) {
      try {
        var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (d && d.profile && d.products) return Promise.resolve({ profile: d.profile, products: d.products, preview: true });
      } catch (e) { /* fall through to published content */ }
    }
    return Promise.all([loadJSON('content/profile.json'), loadJSON('content/products.json')])
      .then(function (r) { return { profile: r[0], products: r[1], preview: false }; });
  }

  /* ---------- renderers ---------- */
  function renderHero(p, prodCount) {
    var person = p.person || {}, links = p.links || {};
    var name = String(person.name || '').trim();
    set('badge', esc(person.badge));
    slot('badge').closest('.badge').hidden = !person.badge;
    set('name', esc(name));
    set('role', '<b>' + esc(person.headline) + '</b>' + (arr(person.tags).length
      ? ' <span class="grp">' + arr(person.tags).map(function (t) { return '<span class="sep" aria-hidden="true"></span>' + esc(t); }).join('') + '</span>' : ''));
    set('lede', md(person.lede));

    // Amber = documents (résumé, portfolio) everywhere on the page, so recruiters can spot them at a glance.
    var cta = '';
    if (links.resume) cta += '<span class="btn-pair">' + docLink(links.resume, 'btn btn-doc', 'View résumé') +
      '<a class="btn btn-doc btn-icon" href="' + esc(safeUrl(links.resume)) + '" download aria-label="Download résumé (PDF)" title="Download résumé (PDF)">' + icon('i-doc') + '</a></span>';
    if (links.portfolio) cta += docLink(links.portfolio, 'btn btn-doc-ghost', 'Portfolio (PDF)');
    cta += '<a class="btn btn-ghost" href="#products">Explore ' + (prodCount ? prodCount + ' ' : '') + 'AI products ' + icon('i-arrow') + '</a>';
    set('hero-cta', cta);
    set('cta-note', links.resume && links.resumeUpdated ? 'Résumé updated ' + esc(links.resumeUpdated) + ' · PDF' : '').hidden = !(links.resume && links.resumeUpdated);
    set('nav-resume', links.resume ? docLink(links.resume, 'btn btn-doc nav-resume', 'Résumé') : '').hidden = !links.resume;

    var portrait = slot('portrait');
    if (person.photo) {
      portrait.hidden = false;
      portrait.innerHTML = '<img class="portrait" src="' + esc(safeUrl(person.photo)) + '" width="640" height="640" alt="' + esc(person.photoAlt || name) + '" fetchpriority="high">' +
        (person.location || person.portraitCaption ? '<div class="portrait-tag"><span>' + esc(person.location) + '<small>' + esc(person.portraitCaption) + '</small></span></div>' : '');
    } else { portrait.hidden = true; }

    var stats = arr(p.stats);
    var st = set('stats', stats.map(function (s) {
      return '<div class="stat"><dt class="sr-only">' + esc(s.label) + '</dt><dd><span class="n">' + esc(s.value) + '</span><span class="l">' + esc(s.label) + '</span></dd></div>';
    }).join(''));
    st.hidden = !stats.length;
    st.style.setProperty('--cols', Math.min(stats.length || 1, 4));
  }

  function renderSnapshot(p) {
    var sn = p.snapshot || {}, groups = arr(sn.groups);
    document.getElementById('snapshot').hidden = !groups.length;
    set('snapshot-title', esc(sn.title || 'At a glance'));
    set('snapshot', groups.map(function (g) {
      var tone = /^[a-z0-9-]+$/.test(g.tone || '') ? ' data-tone="' + g.tone + '"' : '';
      return '<div class="sn-card"' + tone + '><h3>' + esc(g.name) + '</h3><dl>' + arr(g.items).map(function (it) {
        return '<div class="sn-item"><dt>' + esc(it.label) + '</dt><dd>' + md(it.value) + '</dd></div>';
      }).join('') + '</dl></div>';
    }).join(''));
  }

  function renderAbout(p) {
    var a = p.about || {};
    set('about-title', esc(a.title));
    set('about-body', arr(a.paragraphs).map(function (t) { return '<p>' + md(t) + '</p>'; }).join(''));
    set('facts', arr(a.facts).map(function (f) {
      return '<div class="fact"><dt>' + esc(f.label) + '</dt><dd>' + esc(f.value) + '</dd></div>';
    }).join(''));
  }

  function renderApproach(p) {
    var a = p.approach || {};
    set('approach-title', esc(a.title));
    set('approach-sub', esc(a.subtitle));
    set('steps', arr(a.steps).map(function (s) { return '<li class="step"><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></li>'; }).join(''));
    slot('steps').style.setProperty('--cols', Math.min(arr(a.steps).length || 1, 6));
    set('throughline', md(a.throughline)).hidden = !a.throughline;
    set('principles', arr(a.principles).map(function (s) { return '<div class="principle"><h3>' + esc(s.title) + '</h3><p>' + md(s.text) + '</p></div>'; }).join(''));
  }

  function renderProducts(d) {
    var arenas = arr(d.arenas), products = arr(d.products);
    var arenaById = {};
    arenas.forEach(function (a) { arenaById[a.id] = a; });
    set('products-title', esc(d.title));
    set('products-sub', esc(d.subtitle));

    var counts = {};
    products.forEach(function (p) { counts[p.arena] = (counts[p.arena] || 0) + 1; });
    var used = arenas.filter(function (a) { return counts[a.id]; });
    set('filters', used.length > 1
      ? '<button type="button" class="chipbtn" data-f="all" aria-pressed="true">All <span class="ct">' + products.length + '</span></button>' +
        used.map(function (a) { return '<button type="button" class="chipbtn" data-f="' + esc(a.id) + '" aria-pressed="false"' + colorVar('--arena', a.color) + '><span class="swatch" aria-hidden="true"></span>' + esc(a.label) + ' <span class="ct">' + counts[a.id] + '</span></button>'; }).join('')
      : '');

    set('products', products.map(function (p, i) {
      var id = slug(p.id || p.name), a = arenaById[p.arena] || {};
      var color = colorVar('--arena', a.color);
      var headline = p.headline || arr(p.outcomes)[0];
      var tags = (p.client ? '<span class="client"><i>Implemented for</i> ' + esc(p.client) + '</span>' : '') +
        arr(p.stack).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
      var links = '';
      if (p.github) links += '<a class="acc-link" href="' + esc(safeUrl(p.github)) + '"' + ext(p.github) + '>' + icon('i-gh') + 'View on GitHub</a>';
      if (p.demo) links += '<a class="acc-link" href="' + esc(safeUrl(p.demo)) + '"' + ext(p.demo) + '>' + icon('i-arrow') + 'Live demo</a>';
      var snaps = [['Customer pain', p.pain], ['The product bet', p.bet], [p.whyLabel || 'Why AI is the right call', p.why]]
        .filter(function (x) { return x[1]; })
        .map(function (x, k) { return '<div class="snap" style="--i:' + k + '"><h4>' + esc(x[0]) + '</h4><p>' + md(x[1]) + '</p></div>'; }).join('');
      var decide = '';
      var d = 3;
      if (p.tradeoff) decide += '<div style="--i:' + d++ + '"><h4>Key trade-off</h4><p>' + md(p.tradeoff) + '</p></div>';
      if (p.validated) decide += '<div style="--i:' + d++ + '"><h4>Validated with</h4><p>' + md(p.validated) + '</p></div>';
      if (arr(p.outcomes).length) decide += '<div style="--i:' + d++ + '"><h4>Value &amp; outcomes</h4><ul>' + arr(p.outcomes).map(function (o) { return '<li>' + md(o) + '</li>'; }).join('') + '</ul></div>';
      // Teaser: first lines of the customer pain, faded out, so the card shows there is depth inside.
      var peek = p.pain ? '<div class="acc-peek" aria-hidden="true"><div class="peek-in"><span class="peek-label">Customer pain</span><p>' + md(p.pain) + '</p></div></div>' : '';
      return '<article class="acc" data-arena="' + esc(p.arena) + '" id="p-' + esc(id) + '"' + color + '>' +
        '<div class="acc-head">' +
          '<span class="kicker">' + esc(p.kicker || a.label || '') + '</span>' +
          '<h3 class="acc-title">' + esc(p.name) + '</h3>' +
          '<p class="acc-sum">' + md(p.summary) + '</p>' +
          (headline ? '<p class="acc-outcome"><span class="acc-outcome-l">Outcome</span><span class="acc-outcome-t">' + md(headline) + '</span>' + evBadge(p.evidence) + '</p>' : '') +
          (tags ? '<div class="acc-meta">' + tags + '</div>' : '') +
        '</div>' +
        peek +
        '<div class="acc-links">' +
          '<button class="acc-toggle" type="button" aria-expanded="false" aria-controls="b-' + esc(id) + '">' +
            '<span class="t-labels"><span class="t-open">Explore case study</span><span class="t-close" aria-hidden="true">Hide details</span></span>' +
            '<span class="t-arrow" aria-hidden="true"><svg><use href="#i-arrow"/></svg></span>' +
          '</button>' +
          links +
        '</div>' +
        '<div class="acc-body" id="b-' + esc(id) + '" role="region" aria-label="' + esc(p.name) + ' details" inert><div class="acc-inner">' +
          (snaps ? '<div class="snapshot">' + snaps + '</div>' : '') +
          (decide ? '<div class="decide">' + decide + '</div>' : '') +
          (p.note ? '<p class="note">' + md(p.note) + '</p>' : '') +
        '</div></div>' +
      '</article>';
    }).join(''));
  }

  var GLANCE_ICONS = ['shield', 'target', 'chip', 'wrench', 'grid', 'trend', 'alert', 'globe', 'bank', 'bolt', 'search', 'layers', 'heart'];
  function renderGlance(d) {
    var o = d.overview || {}, products = arr(d.products), el = slot('glance');
    if (o.show === false || !products.length) { el.hidden = true; el.innerHTML = ''; return; }
    var arenaById = {};
    arr(d.arenas).forEach(function (a) { arenaById[a.id] = a; });
    el.hidden = false;
    el.innerHTML =
      (o.eyebrow ? '<p class="eyebrow">' + esc(o.eyebrow) + '</p>' : '') +
      (o.title ? '<h3 class="glance-title">' + esc(o.title) + '</h3>' : '') +
      '<ul class="glance-grid">' + products.map(function (p, i) {
        var id = slug(p.id || p.name);
        var icon = GLANCE_ICONS.indexOf(p.icon) > -1 ? p.icon : GLANCE_ICONS[i % GLANCE_ICONS.length];
        var a = arenaById[p.arena] || {}, arena = a.label || '';
        return '<li><a class="glance-card" href="#p-' + esc(id) + '" data-product="' + esc(id) + '"' + colorVar('--arena', a.color) + '>' +
          '<span class="g-icon" aria-hidden="true"><svg><use href="#g-' + icon + '"/></svg></span>' +
          (arena ? '<span class="g-arena">' + esc(arena) + '</span>' : '') +
          '<h4>' + esc(p.name) + '</h4>' +
          '<p>' + md(p.tagline || p.summary) + '</p>' +
          '<span class="g-more" aria-hidden="true">View case study →</span>' +
        '</a></li>';
      }).join('') + '</ul>';
  }

  function renderEcosystem(d) {
    var e = d.ecosystem || {}, el = slot('ecosystem');
    if (!e.show) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    function list(title, items) {
      return arr(items).length ? '<div class="eco-col"><h3>' + esc(title) + '</h3><ul>' + arr(items).map(function (t) { return '<li>' + md(t) + '</li>'; }).join('') + '</ul></div>' : '';
    }
    el.innerHTML = '<div class="wrap">' +
      '<p class="eyebrow">' + esc(e.eyebrow || 'Spotlight') + '</p>' +
      '<h2 class="s-title">' + esc(e.title) + '</h2>' +
      '<p class="s-sub">' + esc(e.subtitle) + '</p>' +
      '<div class="pillars">' + arr(e.pillars).map(function (x) {
        return '<div class="pillar"><span class="ph">' + esc(x.phase) + '</span><h3>' + esc(x.name) + '</h3><p>' + md(x.text) + '</p></div>';
      }).join('') + '</div>' +
      (e.spine ? '<p class="spine">' + md(e.spine) + '</p>' : '') +
      '<div class="eco-cols">' + list('The opportunity', e.opportunity) + list('The differentiator', e.differentiator) + '</div>' +
      (EVIDENCE[e.evidence] && arr(e.metrics).length ? '<p class="metrics-ev">' + evBadge(e.evidence) + '</p>' : '') +
      '<div class="metrics">' + arr(e.metrics).map(function (m) {
        return '<div class="metric"><span class="n">' + esc(m.value) + '</span><span class="l">' + esc(m.label) + '</span><span class="c">' + esc(m.caption) + '</span></div>';
      }).join('') + '</div>' +
      (e.note ? '<p class="note">' + md(e.note) + '</p>' : '') +
      '</div>';
  }

  // Experience as a colour-coded timeline: every role's headline is visible at once (for scanning);
  // the full achievements expand per role. The first (current) role starts open.
  function renderExperience(p, productIndex, arenaById) {
    var x = p.experience || {}, roles = arr(x.roles), trackById = {};
    arr(x.tracks).forEach(function (t) { trackById[t.id] = t; });
    set('exp-title', esc(x.title));
    set('exp-sub', esc(x.subtitle));
    var used = arr(x.tracks).filter(function (t) { return roles.some(function (r) { return r.track === t.id; }); });
    set('exp-legend', used.map(function (t) {
      return '<li' + colorVar('--track', t.color) + '><span class="swatch" aria-hidden="true"></span>' + esc(t.label) + '</li>';
    }).join('')).hidden = !used.length;
    set('exp-timeline', roles.map(function (r, i) {
      var k = slug(r.tab || r.company, i), t = trackById[r.track] || {}, open = i === 0;
      var bullets = arr(r.bullets);
      var rel = arr(r.related).map(function (id) {
        var prod = productIndex[slug(id)], a = prod && arenaById[prod.arena] || {};
        return prod ? '<a href="#p-' + esc(slug(id)) + '"' + colorVar('--arena', a.color) + '><span class="swatch" aria-hidden="true"></span>' + esc(prod.name) + '</a>' : '';
      }).filter(Boolean);
      return '<li class="tl-item' + (open ? ' open' : '') + '" id="role-' + k + '"' + colorVar('--track', t.color) + '>' +
        '<span class="tl-period">' + esc(r.period) + '</span>' +
        '<div class="tl-card">' +
          (t.label ? '<span class="tl-track">' + esc(t.label) + '</span>' : '') +
          '<div class="exp-head"><div><h3>' + esc(r.title) + (r.company ? ' <span>@ ' + esc(r.company) + '</span>' : '') + '</h3>' +
          (r.org ? '<p class="exp-org">' + esc(r.org) + '</p>' : '') + '</div>' +
          (r.dates ? '<span class="pill-date">' + esc(r.dates) + '</span>' : '') + '</div>' +
          (r.summary ? '<p class="exp-summary">' + md(r.summary) + '</p>' : '') +
          (arr(r.metrics).length ? '<ul class="exp-metrics" aria-label="Key metrics">' + arr(r.metrics).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') +
          (rel.length ? '<p class="stackline"><b>Related product' + (rel.length > 1 ? 's' : '') + ':</b> ' + rel.join('') + '</p>' : '') +
          (bullets.length ? '<button class="tl-toggle" type="button" aria-expanded="' + open + '" aria-controls="tb-' + k + '" data-n="' + bullets.length + '">' +
            '<span class="tl-label">' + (open ? 'Hide achievements' : 'Show ' + bullets.length + ' achievements') + '</span><svg aria-hidden="true"><use href="#i-chev"/></svg></button>' +
            '<div class="tl-body" id="tb-' + k + '"' + (open ? '' : ' inert') + '><div class="tl-inner"><ul class="exp-list">' +
            bullets.map(function (b) { return '<li>' + md(b) + '</li>'; }).join('') + '</ul></div></div>' : '') +
        '</div>' +
      '</li>';
    }).join(''));
  }

  function renderRest(p) {
    var s = p.skills || {}, links = p.links || {};
    set('skills-title', esc(s.title));
    // Top skills first; the rest sit behind a "+N more" toggle so each group stays scannable.
    var TOP = 6;
    set('skills', arr(s.groups).map(function (g, gi) {
      var items = arr(g.items), extra = items.length - TOP;
      return '<div class="skill-card"><h3>' + esc(g.name) + '</h3><ul class="pills" id="sk-' + gi + '">' + items.map(function (t, i) {
        return '<li class="pill' + (i >= TOP ? ' pill-extra' : '') + '"' + (i >= TOP ? ' hidden' : '') + '>' + esc(t) + '</li>';
      }).join('') + '</ul>' +
      (extra > 0 ? '<button type="button" class="pill-more" aria-expanded="false" aria-controls="sk-' + gi + '" data-more="+' + extra + ' more">+' + extra + ' more</button>' : '') + '</div>';
    }).join(''));

    var w = p.writing || {};
    var wl = '';
    if (links.linkedin) wl += '<a class="btn" href="' + esc(safeUrl(links.linkedin)) + '" target="_blank" rel="noopener">' + icon('i-in') + 'Read on LinkedIn</a>';
    if (links.github) wl += '<a class="btn" href="' + esc(safeUrl(links.github)) + '" target="_blank" rel="noopener">' + icon('i-gh') + 'Builds on GitHub</a>';
    set('writing', '<h3>' + esc(w.title) + '</h3><p>' + md(w.text) + '</p>' + (wl ? '<div class="hero-cta card-cta">' + wl + '</div>' : ''));
    set('education', arr(p.education).map(function (e) {
      return '<li class="edu-item"><span class="edu-mark" aria-hidden="true">' + esc(e.mark) + '</span><div><h4>' + esc(e.degree) + '</h4><p>' + esc(e.school) + '</p></div></li>';
    }).join(''));

    var c = p.contact || {};
    set('contact-title', esc(c.title));
    set('contact-text', md(c.text));
    var cl = '';
    if (links.email) cl += '<a class="btn btn-light" href="mailto:' + esc(links.email) + '">' + icon('i-mail') + esc(links.email) + '</a>';
    if (links.linkedin) cl += '<a class="btn btn-ghost" href="' + esc(safeUrl(links.linkedin)) + '" target="_blank" rel="noopener">' + icon('i-in') + 'LinkedIn</a>';
    if (links.github) cl += '<a class="btn btn-ghost" href="' + esc(safeUrl(links.github)) + '" target="_blank" rel="noopener">' + icon('i-gh') + 'GitHub</a>';
    if (links.resume) cl += docLink(links.resume, 'btn btn-doc', 'Résumé (PDF)');
    if (links.portfolio) cl += docLink(links.portfolio, 'btn btn-doc-ghost', 'Portfolio (PDF)');
    set('contact-links', cl);
    set('foot-name', esc((p.person || {}).name) + ((p.person || {}).location ? ' · ' + esc(p.person.location) : ''));

    var m = p.meta || {};
    if (m.title) document.title = m.title;
    var desc = document.querySelector('meta[name="description"]');
    if (desc && m.description) desc.setAttribute('content', m.description);
  }

  function render(c) {
    var productIndex = {}, arenaById = {};
    arr(c.products.products).forEach(function (p) { productIndex[slug(p.id || p.name)] = p; });
    arr(c.products.arenas).forEach(function (a) { arenaById[a.id] = a; });
    renderHero(c.profile, arr(c.products.products).length);
    renderSnapshot(c.profile);
    renderAbout(c.profile);
    renderApproach(c.profile);
    renderGlance(c.products);
    renderProducts(c.products);
    renderEcosystem(c.products);
    renderExperience(c.profile, productIndex, arenaById);
    renderRest(c.profile);
    // Reveal-on-scroll targets
    document.querySelectorAll('.s-title, .s-sub, .glance, .about-body, .about-side, .step, .principle, .acc, .pillar, .eco-col, .metric, .sn-card, .legend, .tl-item, .skill-card, .card, .contact h2, .contact-row')
      .forEach(function (el) { el.classList.add('rv'); });
    if (c.preview) {
      var bar = document.createElement('div');
      bar.className = 'preview-bar';
      bar.setAttribute('role', 'status');
      bar.innerHTML = 'Preview of unpublished draft <a href="./">View live site</a>';
      document.body.appendChild(bar);
    }
  }

  /* ---------- interactions ---------- */
  function wire() {
    var nav = document.getElementById('nav');
    // Product cards: one real toggle button per card (keyboard + screen readers); the rest of the
    // card surface is a mouse/touch shortcut. Height animates in CSS (grid rows 0fr → 1fr).
    function setAcc(acc, open) {
      var btn = acc.querySelector('.acc-toggle'), body = acc.querySelector('.acc-body');
      acc.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.querySelector('.t-open').setAttribute('aria-hidden', open ? 'true' : 'false');
      btn.querySelector('.t-close').setAttribute('aria-hidden', open ? 'false' : 'true');
      if (open) body.removeAttribute('inert'); else body.setAttribute('inert', '');
    }
    document.querySelectorAll('.acc').forEach(function (acc) {
      acc.querySelector('.acc-toggle').addEventListener('click', function (e) {
        e.stopPropagation();
        setAcc(acc, !acc.classList.contains('open'));
      });
      acc.addEventListener('click', function (e) {
        if (e.target.closest('a, button, .acc-body')) return;          // links, buttons and the open content keep their own behaviour
        if (String(window.getSelection && window.getSelection()).length) return; // don't toggle while selecting text
        setAcc(acc, !acc.classList.contains('open'));
      });
    });
    // One-time hint: the first card's button pulses gently the first time it scrolls into view.
    var firstToggle = document.querySelector('.acc .acc-toggle');
    var seenHint = false;
    try { seenHint = localStorage.getItem('portfolio-explore-hint') === '1'; } catch (e) { /* storage unavailable */ }
    if (firstToggle && !seenHint && 'IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var hio = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return;
        hio.disconnect();
        setTimeout(function () { firstToggle.classList.add('hint'); }, 500);
        try { localStorage.setItem('portfolio-explore-hint', '1'); } catch (e) { /* ignore */ }
      }, { threshold: 1 });
      hio.observe(firstToggle);
    }

    var chips = document.querySelectorAll('.chipbtn');
    function applyFilter(f) {
      chips.forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.f === f ? 'true' : 'false'); });
      document.querySelectorAll('#product-list .acc').forEach(function (card) {
        card.hidden = !(f === 'all' || card.dataset.arena === f);
      });
    }
    chips.forEach(function (c) { c.addEventListener('click', function () { applyFilter(c.dataset.f); }); });

    function openProduct(id) {
      var card = document.getElementById(id);
      if (!card || !card.classList.contains('acc')) return false;
      if (card.hidden) applyFilter('all');
      card.classList.add('in');
      setAcc(card, true);
      // offsetTop ignores the reveal animation's transform, so the card lands exactly below the sticky nav.
      var y = 0, el = card;
      while (el) { y += el.offsetTop; el = el.offsetParent; }
      window.scrollTo({ top: Math.max(0, y - nav.offsetHeight - 16) });
      var btn = card.querySelector('.acc-toggle');
      if (btn) btn.focus({ preventScroll: true });
      return true;
    }
    function openFromHash() {
      var id = decodeURIComponent(location.hash.slice(1));
      if (/^p-/.test(id)) openProduct(id);
    }
    window.addEventListener('hashchange', openFromHash);
    // Summary cards: open the product even when its hash is already in the URL.
    document.querySelectorAll('.glance-card').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = 'p-' + a.dataset.product;
        if (openProduct(id)) {
          e.preventDefault();
          if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
        }
      });
    });

    // Experience timeline: each role's achievements expand in place (height animates in CSS).
    document.querySelectorAll('.tl-toggle').forEach(function (btn) {
      var item = btn.closest('.tl-item'), body = document.getElementById(btn.getAttribute('aria-controls'));
      btn.addEventListener('click', function () {
        var open = !item.classList.contains('open');
        item.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.querySelector('.tl-label').textContent = open ? 'Hide achievements' : 'Show ' + btn.dataset.n + ' achievements';
        if (open) body.removeAttribute('inert'); else body.setAttribute('inert', '');
      });
    });

    // Skills: "+N more" reveals the rest of a group.
    document.querySelectorAll('.pill-more').forEach(function (btn) {
      var list = document.getElementById(btn.getAttribute('aria-controls'));
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') !== 'true';
        list.querySelectorAll('.pill-extra').forEach(function (p) { p.hidden = !open; });
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.textContent = open ? 'Show fewer' : btn.dataset.more;
      });
    });

    var links = [].slice.call(document.querySelectorAll('.nav-links a[href^="#"]:not(.nav-cta)'));
    var secs = [].slice.call(document.querySelectorAll('main > section[id]:not([hidden]), main > header[id]'));
    var navMap = { ecosystem: 'products', education: 'skills' };
    function onScroll() {
      nav.classList.toggle('scrolled', window.scrollY > 12);
      var pos = window.scrollY + 120, cur = '';
      secs.forEach(function (s) { if (s.offsetTop <= pos) cur = s.id; });
      cur = navMap[cur] || cur;
      links.forEach(function (l) {
        var on = l.getAttribute('href') === '#' + cur;
        l.classList.toggle('active', on);
        if (on) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var burger = document.getElementById('burger'), navlinks = document.getElementById('navlinks');
    function setMenu(open) {
      navlinks.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    burger.addEventListener('click', function () { setMenu(!navlinks.classList.contains('open')); });
    navlinks.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navlinks.classList.contains('open')) { setMenu(false); burger.focus(); }
    });

    var rv = document.querySelectorAll('.rv');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
      }, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });
      rv.forEach(function (el) { io.observe(el); });
    } else {
      rv.forEach(function (el) { el.classList.add('in'); });
    }

    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();

    openFromHash();
    if (location.hash && !/^#p-/.test(location.hash)) {
      var t = document.getElementById(location.hash.slice(1));
      if (t) t.scrollIntoView();
    }
  }

  var main = document.getElementById('main');
  loadContent().then(function (c) {
    render(c);
    wire();
    main.removeAttribute('aria-busy');
    document.documentElement.classList.add('ready');
  }).catch(function (err) {
    console.error('Portfolio content failed to load:', err);
    main.removeAttribute('aria-busy');
    document.querySelectorAll('main > header, main > section').forEach(function (s) { s.hidden = true; });
    document.getElementById('load-error').hidden = false;
  });
})();
