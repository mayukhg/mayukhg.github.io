/* Mayukh Ghosh — portfolio renderer + interactions (vanilla JS, no dependencies)
 *
 * All copy lives in content/*.json and is edited through /admin.
 * This file only turns that data into markup.
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
    production: ['In production', 'Measured in production'],
    pipeline: ['Pipeline', 'Pipeline or pilots, not booked revenue']
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
        if (d && d.profile && d.products) {
          return Promise.resolve({
            profile: d.profile,
            products: d.products,
            metrics: d.metrics || null,
            walkthroughs: d.walkthroughs || null,
            preview: true
          });
        }
      } catch (e) { /* fall through to published content */ }
    }
    return Promise.all([
      loadJSON('content/profile.json'),
      loadJSON('content/products.json'),
      loadJSON('content/metrics.json').catch(function () { return null; }),
      loadJSON('content/walkthroughs.json').catch(function () { return null; })
    ]).then(function (r) {
      return { profile: r[0], products: r[1], metrics: r[2], walkthroughs: r[3], preview: false };
    });
  }

  /* ---------- walkthrough helpers ---------- */
  var WALKTHROUGHS = null;
  var WT_BY_PRODUCT = {};
  function indexWalkthroughs(w) {
    WALKTHROUGHS = w;
    WT_BY_PRODUCT = {};
    if (!w || !w.products) return;
    Object.keys(w.products).forEach(function (id) { WT_BY_PRODUCT[id] = w.products[id]; });
  }

  /* ---------- metrics helpers ---------- */
  var METRICS = null;
  var METRICS_BY_PRODUCT = {};
  function indexMetrics(m) {
    METRICS = m;
    METRICS_BY_PRODUCT = {};
    if (!m) return;
    arr(m.apps).forEach(function (app) {
      if (app.productId && app.productId !== 'ecosystem') METRICS_BY_PRODUCT[app.productId] = app;
    });
  }
  function thresholdLadder(thresholds, limit) {
    var rows = arr(thresholds);
    if (limit) rows = rows.slice(0, limit);
    return '<ul class="ladder" aria-label="Action thresholds">' + rows.map(function (t) {
      return '<li><span class="l-metric">' + esc(t.metric) + '</span><span class="bands">' +
        '<span class="band band-good"><b>Good</b><span>' + esc(t.green) + '</span></span>' +
        '<span class="band band-watch"><b>Watch</b><span>' + esc(t.amber) + '</span></span>' +
        '<span class="band band-act"><b>Act</b><span>' + esc(t.red) + '</span></span>' +
      '</span></li>';
    }).join('') + '</ul>';
  }
  function metricsDisclaimer(text) {
    return '<p class="metrics-disclaimer" role="note">' + icon('g-info') + '<span>' + esc(text) + '</span></p>';
  }
  function metricsDetailHtml(app, disclaimer) {
    if (!app) return '';
    var decided = app.howDecided || {};
    var mapRows = arr(app.mapping).map(function (r) {
      return '<tr><td>' + esc(r.step) + '</td><td><code>' + esc(r.event) + '</code></td><td>' + esc(r.metric) + '</td></tr>';
    }).join('');
    return metricsDisclaimer(disclaimer || (METRICS && METRICS.disclaimer) || '') +
      '<div class="mx-block"><h4>How it was decided</h4><ul class="mx-decided">' +
        '<li><strong>Problem</strong> ' + esc(decided.problem || '') + '</li>' +
        '<li><strong>Workflow</strong> ' + esc(decided.workflow || '') + '</li>' +
        '<li><strong>Approach</strong> ' + esc(decided.approach || '') + '</li>' +
      '</ul></div>' +
      (mapRows ? '<div class="mx-block"><h4>Journey → metric</h4><div class="mx-table-wrap"><table class="mx-table"><thead><tr><th scope="col">Step</th><th scope="col">Event</th><th scope="col">Metric</th></tr></thead><tbody>' + mapRows + '</tbody></table></div></div>' : '') +
      (arr(app.objectives).length ? '<div class="mx-block"><h4>Objectives</h4><ul class="mx-obj">' + arr(app.objectives).map(function (o) {
        return '<li><strong>' + esc(o.title) + '.</strong> ' + esc(o.text) + '</li>';
      }).join('') + '</ul></div>' : '') +
      (arr(app.thresholds).length ? '<div class="mx-block"><h4>Threshold ladder</h4>' + thresholdLadder(app.thresholds) +
        (app.action ? '<p class="note">' + esc(app.action) + '</p>' : '') + '</div>' : '') +
      (arr(app.value).length ? '<div class="mx-block"><h4>Value delivered</h4><ul class="mx-value">' + arr(app.value).map(function (v) {
        return '<li><strong>' + esc(v.audience) + '</strong>' + esc(v.text) + '</li>';
      }).join('') + '</ul></div>' : '') +
      (arr(app.images).length ? '<div class="mx-block"><h4>Dashboard</h4>' + metricsDisclaimer(disclaimer || (METRICS && METRICS.disclaimer) || '') +
        '<div class="mx-shots">' + arr(app.images).map(function (img, i) {
          return '<button type="button" class="mx-shot" data-app="' + esc(app.id) + '" data-i="' + i + '" aria-label="Open dashboard image ' + (i + 1) + '">' +
            '<img src="' + esc(safeUrl(img.file)) + '" alt="' + esc(img.alt || app.name) + '" width="' + (img.w || 1440) + '" height="' + (img.h || 900) + '" loading="lazy">' +
          '</button>';
        }).join('') + '</div></div>' : '');
  }
  var METRICS_SITE_KEY = {
    'agent-val': 'val',
    'soc-portal': 'soc',
    'ai-spm': 'spm',
    'policy-foundry': 'pf',
    'ellyra-pulse': 'ell',
    'cropguard': 'agr',
    'defence-ecosystem': 'def'
  };
  function renderMetrics(m, products) {
    var el = slot('metrics');
    var sec = document.getElementById('metrics');
    if (!el || !m || !arr(m.apps).length) { if (sec) sec.hidden = true; if (el) el.innerHTML = ''; return; }
    if (sec) sec.hidden = false;
    var arenaById = {}, productById = {};
    arr(products.arenas).forEach(function (a) { arenaById[a.id] = a; });
    arr(products.products).forEach(function (p) { productById[p.id] = p; });
    var method = '<ol class="method-flow" aria-label="How I measure">' + arr(m.method).map(function (step, i) {
      return '<li><span class="m-step">Step ' + (i + 1) + '</span><span class="m-label">' + esc(step.label) + '</span><span class="m-text">' + esc(step.text) + '</span></li>';
    }).join('') + '</ol>';
    var tiles = '<div class="metrics-grid metrics-grid-compact">' + arr(m.apps).map(function (app) {
      var prod = productById[app.productId] || {};
      var arena = arenaById[prod.arena] || {};
      var color = colorVar('--arena', arena.color);
      var img = arr(app.images)[0];
      var siteKey = METRICS_SITE_KEY[app.id] || app.id;
      var thr = arr(app.thresholds)[0];
      var band = thr
        ? '<div class="m-band-row" aria-label="' + esc(thr.metric) + ' thresholds">' +
            '<span class="band band-good"><b>Good</b><span>' + esc(thr.green) + '</span></span>' +
            '<span class="band band-watch"><b>Watch</b><span>' + esc(thr.amber) + '</span></span>' +
            '<span class="band band-act"><b>Act</b><span>' + esc(thr.red) + '</span></span>' +
          '</div>'
        : '';
      return '<a class="m-tile m-tile-compact' + (app.umbrella ? ' umbrella' : '') + '" href="metrics/#' + esc(siteKey) + '"' + color + '>' +
        (img ? '<span class="m-thumb-sm"><img src="' + esc(safeUrl(img.file)) + '" alt="' + esc(img.alt || app.name) + '" width="' + (img.w || 1440) + '" height="' + (img.h || 900) + '" loading="lazy"></span>' : '') +
        '<h3>' + esc(app.name) + '</h3>' +
        '<p class="m-star">' + esc(app.northStar) + '</p>' +
        band +
      '</a>';
    }).join('') +
      '<a class="m-tile m-tile-all" href="metrics/">All 38 metrics →</a>' +
    '</div>';
    var pdfHref = m.pdf || 'assets/My_Product_Metrics.pdf';
    el.innerHTML =
      '<div class="metrics-head">' +
        (m.eyebrow ? '<p class="eyebrow">' + esc(m.eyebrow) + '</p>' : '') +
        '<h2 class="s-title" id="metrics-title">' + esc(m.title || 'Product metrics') + '</h2>' +
        (m.subtitle ? '<p class="s-sub">' + esc(m.subtitle) + '</p>' : '') +
        metricsDisclaimer(m.disclaimer) +
      '</div>' +
      method + tiles +
      '<div class="metrics-cta">' +
        '<a class="btn btn-doc" href="metrics/">Explore the full metrics site →</a>' +
        '<p class="metrics-meta">7 chapters · 38 metrics · 29 dashboards · <a href="' + esc(safeUrl(pdfHref)) + '" target="_blank" rel="noopener">PDF</a></p>' +
      '</div>' +
      '<div class="lightbox" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="Dashboard image">' +
        '<div class="lightbox-dialog" tabindex="-1">' +
          '<button type="button" class="lightbox-close" aria-label="Close">×</button>' +
          '<button type="button" class="lightbox-prev" aria-label="Previous image">‹</button>' +
          '<img id="lightbox-img" alt="">' +
          '<button type="button" class="lightbox-next" aria-label="Next image">›</button>' +
          '<p class="lightbox-caption" id="lightbox-cap"></p>' +
        '</div>' +
      '</div>' +
      '<div class="umbrella-drawer" id="umbrella-drawer" hidden>' +
        '<div class="umbrella-panel" role="dialog" aria-modal="true" aria-labelledby="umbrella-title" tabindex="-1">' +
          '<button type="button" class="btn ud-close" data-close-umbrella>Close</button>' +
          '<h2 id="umbrella-title"></h2>' +
          '<div id="umbrella-body"></div>' +
        '</div>' +
      '</div>';
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
    var trust = p.trust || {};
    var thesisEl = set('thesis', trust.line ? md(trust.line) : '');
    if (thesisEl) thesisEl.hidden = !trust.line;
    var traits = arr(trust.traits);
    var traitsEl = set('traits', traits.map(function (t) {
      return '<li><span>' + esc(t.label) + '</span><p>' + esc(t.text) + '</p></li>';
    }).join(''));
    if (traitsEl) traitsEl.hidden = !traits.length;

    // Amber = documents (résumé, portfolio) everywhere on the page, so recruiters can spot them at a glance.
    var cta = '';
    if (links.resume) cta += '<span class="btn-pair">' + docLink(links.resume, 'btn btn-doc', 'View Resume') +
      '<a class="btn btn-doc btn-icon" href="' + esc(safeUrl(links.resume)) + '" download aria-label="Download Resume (PDF)" title="Download Resume (PDF)">' + icon('i-doc') + '</a></span>';
    if (links.portfolio) cta += docLink(links.portfolio, 'btn btn-doc-ghost', 'Portfolio PDF');
    cta += '<a class="btn btn-doc-ghost" href="metrics/">' + icon('g-chart') + 'How I measure products</a>';
    set('hero-cta', cta);
    set('cta-note', '').hidden = true;
    set('nav-resume', '').hidden = true;

    var portrait = slot('portrait');
    if (person.photo) {
      portrait.hidden = false;
      portrait.innerHTML = '<img class="portrait" src="' + esc(safeUrl(person.photo)) + '" width="640" height="640" alt="' + esc(person.photoAlt || name) + '" fetchpriority="high">' +
        (person.location || person.portraitCaption ? '<div class="portrait-tag"><span>' + esc(person.location) + '<small>' + esc(person.portraitCaption) + '</small></span></div>' : '');
    } else { portrait.hidden = true; }

    var stats = arr(p.stats);
    var st = set('stats', stats.map(function (s) {
      var tags = '';
      if (s.company) tags += '<span class="tag-co">' + esc(s.company) + '</span>';
      if (s.statusLabel) tags += '<span class="tag-st tag-' + esc(s.status || 'direct') + '">' + esc(s.statusLabel) + '</span>';
      return '<div class="stat"><dt class="sr-only">' + esc(s.label) + '</dt><dd><span class="n">' + esc(s.value) + '</span>' +
        (tags ? '<span class="stat-tags">' + tags + '</span>' : '') +
        '<span class="l">' + esc(s.label) + '</span></dd></div>';
    }).join(''));
    st.hidden = !stats.length;
    st.style.setProperty('--cols', Math.min(stats.length || 1, 4));
  }

  function renderFit(p) {
    var fit = p.fit || {}, el = slot('fit');
    if (!el) return;
    if (!fit.open && !fit.level) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    var role = fit.level ? '<span class="fit-role">' + esc(fit.level) + '</span>' : '';
    var meta = [fit.mode, (p.person || {}).location, fit.notice].filter(Boolean)
      .map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('<span class="fit-dot" aria-hidden="true"></span>');
    el.innerHTML = '<div class="fit-in">' +
      (fit.open ? '<span class="fit-live"><i aria-hidden="true"></i>' + esc(fit.open) + '</span>' : '') +
      role +
      (meta ? '<span class="fit-meta">' + meta + '</span>' : '') +
      '</div>';
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
    var paras = arr(a.paragraphs);
    // First two sentences visible; full about + facts behind Read more.
    var preview = [];
    paras.forEach(function (t) {
      var plain = String(t).replace(/\*\*/g, '');
      var parts = plain.match(/[^.!?]+[.!?]+/g) || [plain];
      parts.forEach(function (s) { if (preview.length < 2) preview.push(s.trim()); });
    });
    set('how-quote', preview.map(function (q) { return '<p>' + esc(q) + '</p>'; }).join(''));
    var factsHtml = arr(a.facts).length
      ? '<dl class="facts how-facts-toggle">' + arr(a.facts).map(function (f) {
          return '<div class="fact"><dt>' + esc(f.label) + '</dt><dd>' + esc(f.value) + '</dd></div>';
        }).join('') + '</dl>'
      : '';
    set('about-body', paras.map(function (t) { return '<p>' + md(t) + '</p>'; }).join('') + factsHtml);
    set('facts', '');
    var factsSlot = slot('facts');
    if (factsSlot) {
      var side = factsSlot.closest('.about-side');
      if (side) side.hidden = true;
    }
    var more = document.getElementById('how-more');
    var full = document.getElementById('how-about-full');
    if (more && full && paras.length) {
      more.hidden = false;
      more.onclick = function () {
        var open = more.getAttribute('aria-expanded') !== 'true';
        more.setAttribute('aria-expanded', open ? 'true' : 'false');
        full.hidden = !open;
        more.textContent = open ? 'Show less' : 'Read more';
      };
    }
  }

  function renderApproach(p) {
    var a = p.approach || {};
    set('approach-title', esc(a.title));
    set('approach-sub', esc(a.subtitle));
    var rows = arr(a.contrast);
    var para = slot('paradigm');
    if (para) {
      para.hidden = !rows.length;
      para.innerHTML = rows.length
        ? '<div class="para-head"><span>Industry default</span><span>What I ship</span></div>' + rows.map(function (r) {
          return '<div class="para-row"><p>' + esc(r.default) + '</p><p>' + esc(r.mine) + '</p></div>';
        }).join('')
        : '';
    }
    var stepIcons = ['g-search', 'g-target', 'g-chip', 'g-layers', 'g-trend', 'g-bolt'];
    set('steps', arr(a.steps).map(function (st, i) {
      return '<li class="step"><span class="step-icon" aria-hidden="true"><svg><use href="#' + stepIcons[i % stepIcons.length] + '"/></svg></span><h3>' + esc(st.title) + '</h3><p>' + esc(st.text) + '</p></li>';
    }).join(''));
    slot('steps').style.setProperty('--cols', Math.min(arr(a.steps).length || 1, 3));
    set('throughline', md(a.throughline)).hidden = !a.throughline;
    // Principle cards removed — hero traits already cover this.
    set('principles', '');
    var prin = slot('principles');
    if (prin) prin.hidden = true;
  }

  function domainFilters(d) {
    var domains = arr(d.domains), products = arr(d.products), counts = {};
    products.forEach(function (p) { if (p.domain) counts[p.domain] = (counts[p.domain] || 0) + 1; });
    var used = domains.filter(function (a) { return counts[a.id]; });
    if (used.length < 2) return '';
    return '<button type="button" class="chipbtn" data-f="all" aria-pressed="true">All <span class="ct">' + products.length + '</span></button>' +
      used.map(function (a) {
        return '<button type="button" class="chipbtn" data-f="' + esc(a.id) + '" aria-pressed="false"' + colorVar('--arena', a.color) + '><span class="swatch" aria-hidden="true"></span>' + esc(a.label) + ' <span class="ct">' + counts[a.id] + '</span></button>';
      }).join('');
  }

  function walkthroughPanelHtml(productId, wt) {
    var chapters = arr(wt.chapters);
    var disc = (WALKTHROUGHS && WALKTHROUGHS.disclaimer) || 'Demo environment · synthetic data';
    var chBtns = chapters.map(function (ch, i) {
      return '<button type="button" class="wt-chapter" data-start="' + esc(ch.start) + '" data-i="' + i + '"' +
        ' data-label="' + esc(ch.label) + '" data-decision="' + esc(ch.decision) + '" data-metric="' + esc(ch.metric) + '"' +
        (i === 0 ? ' aria-current="step"' : '') + '>' +
        '<span class="wt-ch-time">' + esc(ch.time) + '</span>' +
        '<span class="wt-ch-label">' + esc(ch.label) + '</span>' +
        '<span class="wt-ch-decision"><b>Decision.</b> ' + esc(ch.decision) + '</span>' +
        '<span class="wt-ch-metric"><b>Metric.</b> ' + esc(ch.metric) + '</span>' +
      '</button>';
    }).join('');
    var first = chapters[0] || {};
    return '<div class="wt-panel" data-wt-product="' + esc(productId) + '">' +
      '<div class="wt-media">' +
        '<div class="wt-video-wrap">' +
          '<span class="wt-demo" role="note">' + esc(disc) + '</span>' +
          '<video class="wt-video" controls playsinline preload="metadata" poster="' + esc(safeUrl(wt.poster)) + '">' +
            '<source src="' + esc(safeUrl(wt.video)) + '" type="video/mp4">' +
          '</video>' +
        '</div>' +
        '<div class="wt-now" aria-live="polite">' +
          '<p class="wt-now-kicker">Now showing</p>' +
          '<p class="wt-now-title"><span class="wt-now-n">1</span>. <span class="wt-now-label">' + esc(first.label || '') + '</span></p>' +
          '<p class="wt-now-decision"><b>Decision.</b> <span>' + esc(first.decision || '') + '</span></p>' +
          '<p class="wt-now-metric"><b>Metric that watches this step.</b> <span>' + esc(first.metric || '') + '</span></p>' +
        '</div>' +
        '<p class="wt-hint">Select a chapter to jump to that step. The chapter list is the text version of the video.</p>' +
      '</div>' +
      '<div class="wt-chapters">' +
        '<h4 class="wt-ch-head">Chapters · user journey</h4>' +
        '<div class="wt-ch-list">' + chBtns + '</div>' +
      '</div>' +
    '</div>';
  }

  function renderProducts(d) {
    var arenas = arr(d.arenas), products = arr(d.products);
    var arenaById = {}, domainById = {};
    arenas.forEach(function (a) { arenaById[a.id] = a; });
    arr(d.domains).forEach(function (a) { domainById[a.id] = a; });
    set('products-title', esc(d.title));
    set('products-sub', esc(d.subtitle));
    var bar = domainFilters(d);
    set('filters', bar);
    var expFilters = slot('exp-filters');
    if (expFilters) expFilters.innerHTML = bar;

    set('products', products.map(function (p) {
      var id = slug(p.id || p.name), a = arenaById[p.arena] || {}, dom = domainById[p.domain] || {};
      var color = colorVar('--arena', dom.color || a.color);
      var headline = p.headline || arr(p.outcomes)[0];
      var tags = arr(p.stack).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
      var links = '';
      var wt = WT_BY_PRODUCT[p.id];
      if (p.github) links += '<a class="acc-link" href="' + esc(safeUrl(p.github)) + '"' + ext(p.github) + '>' + icon('i-gh') + 'View on GitHub</a>';
      if (p.demo && !/\.mp4(\?|$)/i.test(p.demo)) links += '<a class="acc-link" href="' + esc(safeUrl(p.demo)) + '"' + ext(p.demo) + '>' + icon('i-arrow') + 'Live demo</a>';
      var snaps = [['Customer pain', p.pain], ['The product bet', p.bet], [p.whyLabel || 'Why AI is the right call', p.why]]
        .filter(function (x) { return x[1]; })
        .map(function (x, k) { return '<div class="snap" style="--i:' + k + '"><h4>' + esc(x[0]) + '</h4><p>' + md(x[1]) + '</p></div>'; }).join('');
      var decide = '';
      var n = 3;
      if (p.tradeoff) decide += '<div style="--i:' + n++ + '"><h4>Key trade-off</h4><p>' + md(p.tradeoff) + '</p></div>';
      if (p.validated) decide += '<div style="--i:' + n++ + '"><h4>Validated with</h4><p>' + md(p.validated) + '</p></div>';
      if (arr(p.outcomes).length) decide += '<div style="--i:' + n++ + '"><h4>Value &amp; outcomes</h4><ul>' + arr(p.outcomes).map(function (o) { return '<li>' + md(o) + '</li>'; }).join('') + '</ul></div>';
      var mx = METRICS_BY_PRODUCT[p.id];
      var measured = mx ? '<button type="button" class="badge-measured" data-open-metrics="' + esc(id) + '" aria-label="Open metrics for ' + esc(p.name) + '">' + icon('g-chart') + 'Measured</button>' : '';
      var noteBadge = '';
      var noteKey = String(p.note || '').toLowerCase();
      if (p.note) {
        if (noteKey === 'prototype') noteBadge = '<span class="ev ev-prototype" title="Prototype / independent build">Prototype</span>';
        else noteBadge = '<p class="note">' + md(p.note) + '</p>';
      }
      var evidenceBadges = evBadge(p.evidence) + (noteKey === 'prototype' ? noteBadge : '');
      // Walkthrough tab replaces the old inline Case-tab video; keep workflow figure only.
      var figure = (p.thumbnail || (!wt && p.poster))
        ? '<figure class="acc-figure"><img src="' + esc(safeUrl(p.thumbnail || p.poster)) + '" alt="' + esc(p.name) + ' architecture workflow" width="1200" height="675" loading="lazy"></figure>'
        : '';
      var teardownBlock = (d.flagship && d.flagship.productId === p.id) ? flagshipTeardownHtml(d.flagship) : '';
      var caseHtml =
        (p.summary ? '<p class="acc-brief">' + md(p.summary) + '</p>' : '') +
        figure +
        ((tags || links) ? '<div class="acc-tools">' + (tags ? '<div class="acc-meta">' + tags + '</div>' : '') + links + '</div>' : '') +
        (snaps ? '<div class="snapshot">' + snaps + '</div>' : '') +
        (decide ? '<div class="decide">' + decide + '</div>' : '') +
        (noteBadge && noteKey !== 'prototype' ? noteBadge : '') +
        teardownBlock;
      var bodyInner;
      var hasTabs = !!(wt || mx);
      if (hasTabs) {
        var wtId = 'wt-' + id, caseId = 'case-' + id, mxId = 'mx-' + id;
        var tabs = '';
        tabs += '<button type="button" class="case-tab" role="tab" id="tab-' + caseId + '" aria-controls="' + caseId + '" aria-selected="true" tabindex="0" data-tab="case">Case</button>';
        if (mx) {
          tabs += '<button type="button" class="case-tab" role="tab" id="tab-' + mxId + '" aria-controls="' + mxId + '" aria-selected="false" tabindex="-1" data-tab="metrics">Metrics</button>';
        }
        if (wt) {
          tabs += '<button type="button" class="case-tab" role="tab" id="tab-' + wtId + '" aria-controls="' + wtId + '" aria-selected="false" tabindex="-1" data-tab="walkthrough">Walkthrough</button>';
        }
        bodyInner =
          '<div class="case-tabs" role="tablist" aria-label="' + esc(p.name) + ' case, metrics and walkthrough">' + tabs + '</div>' +
          '<div class="case-panel" role="tabpanel" id="' + caseId + '" aria-labelledby="tab-' + caseId + '">' + caseHtml + '</div>' +
          (mx ? '<div class="case-panel" role="tabpanel" id="' + mxId + '" aria-labelledby="tab-' + mxId + '" hidden data-metrics-panel>' + metricsDetailHtml(mx) + '</div>' : '') +
          (wt ? '<div class="case-panel" role="tabpanel" id="' + wtId + '" aria-labelledby="tab-' + wtId + '" hidden>' + walkthroughPanelHtml(p.id, wt) + '</div>' : '');
      } else {
        bodyInner = caseHtml;
      }
      var thumbSrc = p.thumbnail || p.poster || (mx && arr(mx.images)[0] && arr(mx.images)[0].file);
      var arenaCol = dom.color || a.color || '#9cc4ff';
      var thumbHtml;
      if (wt && wt.teaser) {
        thumbHtml = '<div class="tile-thumb tile-thumb-video">' +
          '<video class="tile-teaser" muted playsinline loop preload="none" poster="' + esc(safeUrl(wt.poster || thumbSrc || '')) + '" src="' + esc(safeUrl(wt.teaser)) + '" aria-hidden="true"></video>' +
          '<button type="button" class="tile-wt-badge" data-open-walkthrough="' + esc(id) + '" aria-label="Open ' + esc(p.name) + ' walkthrough, ' + esc(wt.duration || '') + '">▶ Walkthrough · ' + esc(wt.duration || '') + '</button>' +
        '</div>';
      } else if (thumbSrc) {
        thumbHtml = '<div class="tile-thumb"><img src="' + esc(safeUrl(thumbSrc)) + '" alt="" width="640" height="360" loading="lazy"></div>';
      } else {
        var icn = (['shield','target','chip','wrench','grid','trend','alert','globe','bank','bolt','search','layers','heart','leaf'].indexOf(p.icon) > -1) ? p.icon : 'layers';
        thumbHtml = '<div class="tile-thumb tile-pattern" style="--arena:' + arenaCol + '" aria-hidden="true"><span class="tile-ico"><svg><use href="#g-' + icn + '"/></svg></span></div>';
      }
      var decisionClamp = p.tradeoff || p.summary || '';
      var openLabel = wt ? 'Watch the case' : 'Read the case';
      return '<article class="acc tile" data-arena="' + esc(p.arena) + '" data-domain="' + esc(p.domain || '') + '" id="p-' + esc(id) + '"' + color + '>' +
        '<div class="acc-face">' +
          thumbHtml +
          '<div class="acc-main">' +
            '<span class="kicker">' + esc(p.kicker || dom.label || a.label || '') + '</span>' +
            '<h3 class="acc-title">' + esc(p.name) + '</h3>' +
            '<div class="tile-badges">' + evidenceBadges + measured + '</div>' +
            (headline ? '<p class="tile-outcome">' + md(headline) + '</p>' : '') +
            (decisionClamp ? '<p class="tile-decision">' + md(decisionClamp) + '</p>' : '') +
            (p.client ? '<p class="tile-client"><span class="client">' + esc(p.client) + '</span></p>' : '') +
            '<div class="acc-links">' +
              '<button class="acc-toggle" type="button" aria-expanded="false" aria-controls="b-' + esc(id) + '">' +
                '<span class="t-labels"><span class="t-open">' + openLabel + '</span><span class="t-close" aria-hidden="true">Hide details</span></span>' +
                '<span class="t-arrow" aria-hidden="true"><svg><use href="#i-arrow"/></svg></span>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="acc-body" id="b-' + esc(id) + '" role="region" aria-label="' + esc(p.name) + ' details" inert><div class="acc-inner">' +
          bodyInner +
        '</div></div>' +
      '</article>';
    }).join(''));
  }

  var GLANCE_ICONS = ['shield', 'target', 'chip', 'wrench', 'grid', 'trend', 'alert', 'globe', 'bank', 'bolt', 'search', 'layers', 'heart', 'leaf'];
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
    var ecoWt = WALKTHROUGHS && WALKTHROUGHS.ecosystem;
    var disc = (WALKTHROUGHS && WALKTHROUGHS.disclaimer) || 'Demo environment · synthetic data';
    var tour = ecoWt
      ? '<div class="eco-tour">' +
          '<div class="eco-video-wrap">' +
            '<span class="wt-demo" role="note">' + esc(disc) + '</span>' +
            '<video class="eco-video" controls playsinline preload="none" poster="' + esc(safeUrl(ecoWt.poster)) + '">' +
              '<source src="' + esc(safeUrl(ecoWt.video)) + '" type="video/mp4">' +
            '</video>' +
            (ecoWt.title ? '<p class="eco-video-title">' + esc(ecoWt.title) + (ecoWt.duration ? ' · ' + esc(ecoWt.duration) : '') + '</p>' : '') +
            (ecoWt.text ? '<p class="eco-video-text">' + esc(ecoWt.text) + '</p>' : '') +
          '</div>' +
          '<div class="pillars">' + arr(e.pillars).map(function (x) {
            return '<div class="pillar"><span class="ph">' + esc(x.phase) + '</span><h3>' + esc(x.name) + '</h3><p>' + md(x.text) + '</p></div>';
          }).join('') + '</div>' +
        '</div>' +
        '<p class="eco-loop">One trust layer: Detect feeds Prevent; Protect is watched by Detect.</p>'
      : '<div class="pillars">' + arr(e.pillars).map(function (x) {
          return '<div class="pillar"><span class="ph">' + esc(x.phase) + '</span><h3>' + esc(x.name) + '</h3><p>' + md(x.text) + '</p></div>';
        }).join('') + '</div>';
    var why = (arr(e.opportunity).length || arr(e.differentiator).length)
      ? '<details class="eco-why"><summary>Why this platform</summary><div class="eco-cols">' +
          list('The opportunity', e.opportunity) + list('The differentiator', e.differentiator) +
        '</div></details>'
      : '';
    el.innerHTML = '<div class="wrap">' +
      '<p class="eyebrow">' + esc(e.eyebrow || 'Spotlight') + '</p>' +
      '<h2 class="s-title">' + esc(e.title) + '</h2>' +
      '<p class="s-sub">' + esc(e.subtitle) + '</p>' +
      tour +
      (e.spine ? '<p class="spine">' + md(e.spine) + '</p>' : '') +
      why +
      (EVIDENCE[e.evidence] && arr(e.metrics).length ? '<p class="metrics-ev">' + evBadge(e.evidence) + '</p>' : '') +
      '<div class="metrics">' + arr(e.metrics).map(function (m) {
        return '<div class="metric"><span class="n">' + esc(m.value) + '</span><span class="l">' + esc(m.label) + '</span><span class="c">' + esc(m.caption) + '</span></div>';
      }).join('') + '</div>' +
      (e.note ? '<p class="note">' + md(e.note) + '</p>' : '') +
      '</div>';
  }

  // Compact experience: career bar + one row per role; achievements collapsed by default.
  function renderExperience(p, productIndex, arenaById) {
    var x = p.experience || {}, roles = arr(x.roles), trackById = {};
    arr(x.tracks).forEach(function (t) { trackById[t.id] = t; });
    set('exp-title', esc(x.title));
    set('exp-sub', esc(x.subtitle));
    var career = [
      { label: 'Quality', span: '2005–13', years: 8, color: '#7dd3a7' },
      { label: 'Architecture', span: '2013–21', years: 8, color: '#9cc4ff' },
      { label: 'Product leadership', span: '2021–now', years: 5, color: '#fbbf24' }
    ];
    var totalYears = career.reduce(function (s, c) { return s + c.years; }, 0);
    var legend = slot('exp-legend');
    if (legend) {
      legend.hidden = false;
      legend.className = 'career-bar';
      legend.setAttribute('aria-label', 'Career stages');
      legend.innerHTML = career.map(function (c) {
        return '<li style="--track:' + c.color + ';flex:' + c.years + '"><span class="cb-label">' + esc(c.label) + '</span><span class="cb-span">' + esc(c.span) + '</span></li>';
      }).join('');
    }
    set('exp-timeline', roles.map(function (r, i) {
      var k = slug(r.tab || r.company, i), t = trackById[r.track] || {}, open = false;
      var bullets = arr(r.bullets);
      var rel = arr(r.related).map(function (id) {
        var prod = productIndex[slug(id)], a = prod && arenaById[prod.arena] || {};
        return prod ? '<a class="exp-rel" href="#p-' + esc(slug(id)) + '"' + colorVar('--arena', a.color) + '>' + esc(prod.name) + '</a>' : '';
      }).filter(Boolean);
      return '<li class="tl-item tl-row' + (open ? ' open' : '') + '" id="role-' + k + '" data-domains="' + esc(arr(r.domains).join(' ')) + '"' + colorVar('--track', t.color) + '>' +
        '<div class="tl-row-main">' +
          '<span class="tl-period">' + esc(r.period) + (r.duration ? '<span class="tl-dur">' + esc(r.duration) + '</span>' : '') + '</span>' +
          '<span class="tl-role">' +
            (t.label ? '<span class="tl-track">' + esc(t.label) + '</span> ' : '') +
            '<strong class="exp-title">' + esc(r.title) + '</strong>' + (r.company ? ' <span class="tl-at">@ ' + esc(r.company) + '</span>' : '') +
            (r.dates ? ' <span class="pill-date">' + esc(r.dates) + '</span>' : '') +
          '</span>' +
          (arr(r.metrics).length ? '<ul class="exp-metrics" aria-label="Key metrics">' + arr(r.metrics).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') +
          (rel.length ? '<span class="exp-rels">' + rel.join('') + '</span>' : '') +
          (bullets.length ? '<button class="tl-toggle" type="button" aria-expanded="false" aria-controls="tb-' + k + '" data-n="' + bullets.length + '">' +
            '<span class="tl-label">Achievements ▾</span></button>' : '') +
        '</div>' +
        (bullets.length ? '<div class="tl-body" id="tb-' + k + '" inert><div class="tl-inner"><ul class="exp-list">' +
          bullets.map(function (b) { return '<li>' + md(b) + '</li>'; }).join('') + '</ul></div></div>' : '') +
      '</li>';
    }).join(''));
  }

  function renderRest(p) {
    var s = p.skills || {}, links = p.links || {};
    set('skills-title', esc(s.title));
    // One compact row of ~10 chips; full groups behind All skills.
    var flat = [];
    arr(s.groups).forEach(function (g) {
      arr(g.items).forEach(function (t) {
        flat.push({ label: typeof t === 'object' && t ? (t.label || '') : t, href: typeof t === 'object' && t ? t.href : '', group: g.name });
      });
    });
    var TOP = 10;
    var topHtml = '<ul class="pills skills-top" id="sk-top">' + flat.slice(0, TOP).map(function (t) {
      var inner = t.href ? '<a href="' + esc(safeUrl(t.href)) + '">' + esc(t.label) + '</a>' : esc(t.label);
      return '<li class="pill">' + inner + '</li>';
    }).join('') + '</ul>';
    var fullHtml = '<div class="skills-full" id="sk-full" hidden>' + arr(s.groups).map(function (g, gi) {
      return '<div class="skill-card"><h3>' + esc(g.name) + '</h3><ul class="pills">' + arr(g.items).map(function (t) {
        var label = typeof t === 'object' && t ? (t.label || '') : t;
        var href = typeof t === 'object' && t && t.href ? t.href : '';
        var inner = href ? '<a href="' + esc(safeUrl(href)) + '">' + esc(label) + '</a>' : esc(label);
        return '<li class="pill">' + inner + '</li>';
      }).join('') + '</ul></div>';
    }).join('') + '</div>';
    var moreBtn = flat.length > TOP
      ? '<button type="button" class="pill-more skills-all" aria-expanded="false" aria-controls="sk-full" data-more="All skills ▾">All skills ▾</button>'
      : '';
    set('skills', topHtml + moreBtn + fullHtml);

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
    if (links.resume) cl += docLink(links.resume, 'btn btn-doc', 'Resume (PDF)');
    if (links.portfolio) cl += docLink(links.portfolio, 'btn btn-doc-ghost', 'Portfolio (PDF)');
    set('contact-links', cl);
    set('foot-name', esc((p.person || {}).name) + ((p.person || {}).location ? ' · ' + esc(p.person.location) : ''));

    var m = p.meta || {};
    if (m.title) document.title = m.title;
    var desc = document.querySelector('meta[name="description"]');
    if (desc && m.description) desc.setAttribute('content', m.description);
  }

  function renderPillars(p, productIndex) {
    var x = p.pillars || {}, items = arr(x.items);
    var sec = document.getElementById('pillars');
    if (sec) sec.hidden = !items.length;
    var eye = set('pillars-eyebrow', esc(x.eyebrow || ''));
    if (eye) eye.hidden = !x.eyebrow;
    set('pillars-title', esc(x.title || ''));
    set('pillars-sub', esc(x.subtitle || ''));
    var moat = slot('moat');
    if (moat) {
      moat.hidden = !x.spine && !items.length;
      moat.innerHTML = '<div class="moat-visual">' +
        '<div class="moat-ring" aria-hidden="true"><div class="ring-outer"></div><div class="ring-mid"></div><div class="ring-core"><span>Model<small>Commodity</small></span></div></div>' +
        '<ul class="moat-key"><li><i class="k-outer" aria-hidden="true"></i>Trust-first architecture</li><li><i class="k-mid" aria-hidden="true"></i>Multi-model orchestration</li><li><i class="k-core" aria-hidden="true"></i>Raw model capability</li></ul>' +
        '</div>' +
        (x.spine ? '<p class="moat-spine">' + md(x.spine) + '</p>' : '');
    }
    set('pillar-grid', items.map(function (item) {
      var links = arr(item.products).map(function (id) {
        var prod = productIndex[slug(id)];
        return prod ? '<a href="#p-' + esc(slug(id)) + '">' + esc(prod.name) + '</a>' : '';
      }).filter(Boolean).join('');
      var cta = item.cta && item.cta.href
        ? '<p class="tp-cta"><a href="' + esc(safeUrl(item.cta.href)) + '">' + esc(item.cta.label || 'Learn more') + '</a></p>'
        : '';
      return '<article class="trust-pillar"><p class="tp-org">' + esc(item.org || '') + '</p><h3>' + esc(item.name) + '</h3><p>' + md(item.proof || '') + '</p>' +
        (links ? '<p class="tp-links">' + links + '</p>' : '') + cta + '</article>';
    }).join(''));
  }

  function panelBody(panel) {
    if (arr(panel.kpis).length) {
      return '<ul class="kpi-list">' + arr(panel.kpis).map(function (k) {
        return '<li><span class="kpi-target">' + esc(k.target) + '</span><span class="kpi-name">' + esc(k.name) + '</span><span class="kpi-note">' + esc(k.note) + '</span></li>';
      }).join('') + '</ul>';
    }
    if (arr(panel.zones).length) {
      return '<div class="quad">' + arr(panel.zones).map(function (z) {
        var tone = z.tone === 'p0' || z.tone === 'backlog' ? z.tone : 'backlog';
        return '<div class="zone zone-' + tone + '"><p class="zone-meta"><span>' + esc(z.volume) + '</span><span>' + esc(z.severity) + '</span></p><h4>' + esc(z.title) + '</h4><p>' + esc(z.text) + '</p></div>';
      }).join('') + '</div>';
    }
    if (arr(panel.stages).length) {
      return '<ol class="pipe">' + arr(panel.stages).map(function (s, i) {
        return '<li><span class="pipe-n">' + (i + 1) + '</span><h4>' + esc(s.name) + '</h4><p>' + esc(s.text) + '</p></li>';
      }).join('') + '</ol>';
    }
    if (arr(panel.paths).length) {
      return '<div class="loop"><p class="loop-core">Safety gate runs first. Rules decide the page. Models only add evidence.</p>' +
        arr(panel.paths).map(function (path) {
          var tone = path.tone === 'safety' ? 'safety' : 'else';
          return '<div class="loop-path loop-' + tone + '"><h4>' + esc(path.name) + '</h4><p>' + esc(path.text) + '</p></div>';
        }).join('') + '</div>';
    }
    if (panel.id === 'simulator') {
      return '<div class="sim">' +
        '<form id="sim-form">' +
          '<label for="sim-input">Synthetic verbatim</label>' +
          '<textarea id="sim-input" rows="4" placeholder="Paste a synthetic sentence. Nothing leaves this browser."></textarea>' +
          '<div class="sim-actions">' +
            '<button class="btn" type="submit">Run the gate</button>' +
            '<button class="btn btn-ghost" type="button" id="sim-sample">Load a safety sample</button>' +
            '<button class="btn btn-ghost" type="button" id="sim-benign">Load a UI complaint</button>' +
          '</div>' +
        '</form>' +
        '<div class="sim-log" id="sim-log" role="log" aria-live="polite" aria-relevant="additions"><p class="sim-empty">The gate has not run yet.</p></div>' +
        '<p class="sim-note">Local harness only. Redaction and the P0 check run in this page. This is the sequence, not the production system.</p>' +
      '</div>';
    }
    return '';
  }

  function flagshipTeardownHtml(f) {
    var panels = arr(f.panels);
    if (!panels.length) return '';
    var tabs = panels.map(function (panel, i) {
      var selected = i === 0;
      return '<button type="button" class="tear-tab" role="tab" id="tab-' + esc(panel.id) + '" aria-controls="panel-' + esc(panel.id) + '" aria-selected="' + selected + '" tabindex="' + (selected ? '0' : '-1') + '">' + esc(panel.label) + '</button>';
    }).join('');
    var bodies = panels.map(function (panel, i) {
      return '<div class="tear-panel" role="tabpanel" id="panel-' + esc(panel.id) + '" aria-labelledby="tab-' + esc(panel.id) + '"' + (i === 0 ? '' : ' hidden') + '>' +
        (panel.kicker ? '<p class="tear-kicker">' + esc(panel.kicker) + '</p>' : '') +
        (panel.text ? '<p>' + md(panel.text) + '</p>' : '') +
        panelBody(panel) +
      '</div>';
    }).join('');
    return '<div class="case-teardown">' +
      '<h3 class="tear-in-case">Architecture teardown</h3>' +
      (f.thesis ? '<p class="flag-thesis">' + md(f.thesis) + '</p>' : '') +
      '<div class="teardown"><div class="tear-tabs" role="tablist" aria-label="Ellyra Pulse architecture">' + tabs + '</div>' + bodies + '</div>' +
    '</div>';
  }
  function renderFlagship() {
    // Standalone #ellyra / flagship slot removed — teardown lives inside the Ellyra Pulse case.
  }

  function render(c) {
    var productIndex = {}, arenaById = {};
    arr(c.products.products).forEach(function (p) { productIndex[slug(p.id || p.name)] = p; });
    arr(c.products.arenas).forEach(function (a) { arenaById[a.id] = a; });
    indexMetrics(c.metrics);
    indexWalkthroughs(c.walkthroughs);
    renderHero(c.profile, arr(c.products.products).length);
    renderFit(c.profile);
    renderPillars(c.profile, productIndex);
    renderSnapshot(c.profile);
    renderFlagship();
    renderAbout(c.profile);
    renderApproach(c.profile);
    renderGlance(c.products);
    renderProducts(c.products);
    renderEcosystem(c.products);
    renderMetrics(c.metrics, c.products);
    renderExperience(c.profile, productIndex, arenaById);
    renderRest(c.profile);
    // Reveal-on-scroll targets
    document.querySelectorAll('.s-title, .s-sub, .glance, .about-body, .about-side, .step, .principle, .acc, .pillar, .eco-col, .metric, .sn-card, .legend, .tl-item, .skill-card, .card, .contact h2, .contact-row, .moat, .trust-pillar, .teardown, .flag-thesis, .paradigm, .m-tile, .method-flow, .metrics-disclaimer')
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
      // One open product at a time so the expanded walkthrough/case can use the full grid width.
      if (open) {
        document.querySelectorAll('.acc.open').forEach(function (other) {
          if (other !== acc) setAcc(other, false);
        });
      }
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
        card.hidden = !(f === 'all' || card.dataset.domain === f);
      });
      document.querySelectorAll('.tl-item').forEach(function (item) {
        var domains = (item.dataset.domains || '').split(/\s+/).filter(Boolean);
        item.hidden = !(f === 'all' || domains.indexOf(f) !== -1);
      });
    }
    chips.forEach(function (c) { c.addEventListener('click', function () { applyFilter(c.dataset.f); }); });

    function selectCaseTab(card, which) {
      var tabs = [].slice.call(card.querySelectorAll('.case-tab'));
      if (!tabs.length) return;
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-tab') === which;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
    }
    function openProduct(id, tab) {
      var card = document.getElementById(id);
      if (!card || !card.classList.contains('acc')) return false;
      if (card.hidden) applyFilter('all');
      card.classList.add('in');
      setAcc(card, true);
      var which = tab || 'case';
      if (which === 'walkthrough' && !card.querySelector('.case-tab[data-tab="walkthrough"]')) which = 'case';
      if (which === 'metrics' && !card.querySelector('.case-tab[data-tab="metrics"]')) which = 'case';
      if (card.querySelector('.case-tab')) selectCaseTab(card, which);
      var y = 0, el = card;
      while (el) { y += el.offsetTop; el = el.offsetParent; }
      window.scrollTo({ top: Math.max(0, y - nav.offsetHeight - 16) });
      var focusEl = card.querySelector('.case-tab[data-tab="' + which + '"]') || card.querySelector('.acc-toggle');
      if (focusEl) focusEl.focus({ preventScroll: true });
      return true;
    }
    function openFromHash() {
      var raw = decodeURIComponent(location.hash.slice(1));
      var wt = raw.match(/^(p-[\w-]+)-walkthrough$/);
      if (wt) { openProduct(wt[1], 'walkthrough'); return; }
      var m = raw.match(/^(p-[\w-]+)(?:\/(metrics))?$/);
      if (m) openProduct(m[1], m[2] || null);
    }

    /* Case / Metrics tabs */
    document.querySelectorAll('.acc').forEach(function (card) {
      var tabs = [].slice.call(card.querySelectorAll('.case-tab'));
      tabs.forEach(function (tab, i) {
        tab.addEventListener('click', function (e) {
          e.stopPropagation();
          selectCaseTab(card, tab.getAttribute('data-tab'));
          tab.focus();
        });
        tab.addEventListener('keydown', function (e) {
          var next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length]
            : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length]
            : e.key === 'Home' ? tabs[0]
            : e.key === 'End' ? tabs[tabs.length - 1]
            : null;
          if (!next) return;
          e.preventDefault();
          selectCaseTab(card, next.getAttribute('data-tab'));
          next.focus();
        });
      });
    });
    document.querySelectorAll('[data-open-metrics]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = 'p-' + btn.getAttribute('data-open-metrics');
        openProduct(id, 'metrics');
        if (location.hash !== '#' + id + '/metrics') history.pushState(null, '', '#' + id + '/metrics');
      });
    });
    document.querySelectorAll('[data-open-walkthrough]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = 'p-' + btn.getAttribute('data-open-walkthrough');
        openProduct(id, 'walkthrough');
        if (location.hash !== '#' + id + '-walkthrough') history.pushState(null, '', '#' + id + '-walkthrough');
      });
    });
    document.querySelectorAll('.m-open[data-product]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pid = btn.getAttribute('data-product');
        if (!pid) return;
        openProduct('p-' + slug(pid), 'metrics');
        history.pushState(null, '', '#p-' + slug(pid) + '/metrics');
      });
    });

    /* Tile hover/focus teasers — never on load, touch, or reduced motion */
    var canHoverTeaser = window.matchMedia('(hover: hover)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('.acc.tile').forEach(function (tile) {
      var teaser = tile.querySelector('.tile-teaser');
      if (!teaser) return;
      function playTeaser() {
        if (!canHoverTeaser) return;
        var p = teaser.play();
        if (p && p.catch) p.catch(function () { /* autoplay policy */ });
      }
      function pauseTeaser() {
        teaser.pause();
        try { teaser.currentTime = 0; } catch (e) { /* ignore */ }
      }
      tile.addEventListener('mouseenter', playTeaser);
      tile.addEventListener('mouseleave', pauseTeaser);
      tile.addEventListener('focusin', playTeaser);
      tile.addEventListener('focusout', function (e) {
        if (!tile.contains(e.relatedTarget)) pauseTeaser();
      });
    });

    /* Walkthrough chapters + Now showing */
    document.querySelectorAll('.wt-panel').forEach(function (panel) {
      var video = panel.querySelector('.wt-video');
      var chapters = [].slice.call(panel.querySelectorAll('.wt-chapter'));
      var nowN = panel.querySelector('.wt-now-n');
      var nowLabel = panel.querySelector('.wt-now-label');
      var nowDecision = panel.querySelector('.wt-now-decision span');
      var nowMetric = panel.querySelector('.wt-now-metric span');
      if (!video || !chapters.length) return;
      function paintChapter(i) {
        var ch = chapters[i];
        if (!ch) return;
        chapters.forEach(function (c, j) {
          if (j === i) c.setAttribute('aria-current', 'step');
          else c.removeAttribute('aria-current');
        });
        if (nowN) nowN.textContent = String(i + 1);
        if (nowLabel) nowLabel.textContent = ch.getAttribute('data-label') || '';
        if (nowDecision) nowDecision.textContent = ch.getAttribute('data-decision') || '';
        if (nowMetric) nowMetric.textContent = ch.getAttribute('data-metric') || '';
      }
      function chapterIndexAt(t) {
        var idx = 0;
        for (var i = 0; i < chapters.length; i++) {
          if (t + 0.05 >= parseFloat(chapters[i].getAttribute('data-start'))) idx = i;
        }
        return idx;
      }
      chapters.forEach(function (btn, i) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var start = parseFloat(btn.getAttribute('data-start')) || 0;
          video.currentTime = start;
          paintChapter(i);
          var p = video.play();
          if (p && p.catch) p.catch(function () { /* ignore */ });
        });
      });
      video.addEventListener('timeupdate', function () {
        paintChapter(chapterIndexAt(video.currentTime));
      });
    });

    /* Umbrella metrics drawer */
    var umb = document.getElementById('umbrella-drawer');
    var umbPanel = umb && umb.querySelector('.umbrella-panel');
    function openUmbrella(appId) {
      if (!METRICS || !umb) return;
      var app = arr(METRICS.apps).filter(function (a) { return a.id === appId; })[0];
      if (!app) return;
      document.getElementById('umbrella-title').textContent = app.name;
      document.getElementById('umbrella-body').innerHTML = metricsDetailHtml(app);
      umb.hidden = false;
      umbPanel.focus();
    }
    function closeUmbrella() {
      if (!umb) return;
      umb.hidden = true;
    }
    document.querySelectorAll('.m-open[data-umbrella]').forEach(function (btn) {
      btn.addEventListener('click', function () { openUmbrella(btn.getAttribute('data-umbrella')); });
    });
    if (umb) {
      umb.addEventListener('click', function (e) {
        if (e.target === umb || e.target.closest('[data-close-umbrella]')) closeUmbrella();
      });
    }

    /* Lightbox */
    var lb = document.getElementById('lightbox');
    var lbImg = document.getElementById('lightbox-img');
    var lbCap = document.getElementById('lightbox-cap');
    var lbState = { appId: null, i: 0, lastFocus: null };
    function lbImages() {
      if (!METRICS) return [];
      var app = arr(METRICS.apps).filter(function (a) { return a.id === lbState.appId; })[0];
      return app ? arr(app.images) : [];
    }
    function paintLb() {
      var imgs = lbImages();
      if (!imgs.length) return;
      var img = imgs[lbState.i];
      lbImg.src = safeUrl(img.file);
      lbImg.alt = img.alt || '';
      lbCap.textContent = (METRICS && METRICS.disclaimer) || '';
    }
    function trapLb(e) {
      if (!lb || lb.hidden || e.key !== 'Tab') return;
      var focusables = lb.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      focusables = [].slice.call(focusables).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
      if (!focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    function openLb(appId, i) {
      lbState.appId = appId;
      lbState.i = i || 0;
      lbState.lastFocus = document.activeElement;
      paintLb();
      lb.hidden = false;
      lb.querySelector('.lightbox-close').focus();
    }
    function closeLb() {
      if (!lb || lb.hidden) return;
      lb.hidden = true;
      if (lbState.lastFocus) lbState.lastFocus.focus();
    }
    document.querySelectorAll('.mx-shot').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openLb(btn.getAttribute('data-app'), parseInt(btn.getAttribute('data-i'), 10) || 0);
      });
    });
    if (lb) {
      lb.querySelector('.lightbox-close').addEventListener('click', closeLb);
      lb.querySelector('.lightbox-prev').addEventListener('click', function () {
        var imgs = lbImages(); if (!imgs.length) return;
        lbState.i = (lbState.i - 1 + imgs.length) % imgs.length; paintLb();
      });
      lb.querySelector('.lightbox-next').addEventListener('click', function () {
        var imgs = lbImages(); if (!imgs.length) return;
        lbState.i = (lbState.i + 1) % imgs.length; paintLb();
      });
      lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (lb && !lb.hidden) { closeLb(); return; }
        if (umb && !umb.hidden) { closeUmbrella(); return; }
      }
      if (lb && !lb.hidden) {
        if (e.key === 'ArrowLeft') { lb.querySelector('.lightbox-prev').click(); }
        if (e.key === 'ArrowRight') { lb.querySelector('.lightbox-next').click(); }
        trapLb(e);
      }
    });
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
    document.querySelectorAll('.tp-links a, .tp-cta a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var raw = (a.getAttribute('href') || '').slice(1);
        var wt = raw.match(/^(p-[\w-]+)-walkthrough$/);
        if (wt) {
          e.preventDefault();
          openProduct(wt[1], 'walkthrough');
          if (location.hash !== '#' + raw) history.pushState(null, '', '#' + raw);
          return;
        }
        var m = raw.match(/^(p-[\w-]+)(?:\/(metrics))?$/);
        if (m && openProduct(m[1], m[2] || null)) {
          e.preventDefault();
          if (location.hash !== '#' + raw) history.pushState(null, '', '#' + raw);
        }
      });
    });

    var tearTabs = [].slice.call(document.querySelectorAll('.tear-tab'));
    function selectTear(tab) {
      tearTabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
    }
    tearTabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { selectTear(tab); tab.focus(); });
      tab.addEventListener('keydown', function (e) {
        var next = e.key === 'ArrowRight' ? tearTabs[(i + 1) % tearTabs.length]
          : e.key === 'ArrowLeft' ? tearTabs[(i - 1 + tearTabs.length) % tearTabs.length]
          : e.key === 'Home' ? tearTabs[0]
          : e.key === 'End' ? tearTabs[tearTabs.length - 1]
          : null;
        if (!next) return;
        e.preventDefault();
        selectTear(next);
        next.focus();
      });
    });

    var simForm = document.getElementById('sim-form');
    var simInput = document.getElementById('sim-input');
    var simLog = document.getElementById('sim-log');
    var SAFETY = /chest pain|difficulty breathing|can'?t breathe|blood (glucose|panel)|decimal misread|overdose|suicid/i;
    function redactSim(text) {
      return String(text)
        .replace(/\bPatient\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}/g, '[REDACTED_NAME]')
        .replace(/\bDOB\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi, '[REDACTED_DOB]')
        .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]');
    }
    function runSim(text) {
      if (!simLog) return;
      var raw = String(text || '').trim();
      if (!raw) {
        simLog.innerHTML = '<p class="sim-empty">Add a synthetic sentence first.</p>';
        return;
      }
      var redacted = redactSim(raw);
      var safety = SAFETY.test(raw);
      var lines = [{ lvl: 'info', msg: (redacted === raw ? 'No identifier pattern matched. ' : 'Redaction applied before storage or any model call. ') + redacted }];
      if (safety) {
        lines.push({ lvl: 'warn', msg: 'P0_SAFETY_FLAG — interception complete before the classifier.' });
        lines.push({ lvl: 'debug', msg: 'Routing to the clinical on-call path. 15-minute SLA. A model does not make this decision.' });
      } else {
        lines.push({ lvl: 'debug', msg: 'No P0 pattern. This stays on the 24-hour path. Aspect sentiment may add evidence. It does not gate safety.' });
      }
      simLog.innerHTML = lines.map(function (line) {
        return '<p class="sim-' + line.lvl + '"><span>' + line.lvl.toUpperCase() + '</span> ' + esc(line.msg) + '</p>';
      }).join('');
    }
    if (simForm && simInput) {
      simForm.addEventListener('submit', function (e) { e.preventDefault(); runSim(simInput.value); });
      var sample = document.getElementById('sim-sample');
      var benign = document.getElementById('sim-benign');
      if (sample) sample.addEventListener('click', function () {
        simInput.value = 'Patient Alex Rivera is experiencing severe chest pain and difficulty breathing. DOB 03/14/1982.';
        runSim(simInput.value);
      });
      if (benign) benign.addEventListener('click', function () {
        simInput.value = 'The submit button is too small and the green is hard to see on my phone.';
        runSim(simInput.value);
      });
    }

    // Experience timeline: each role's achievements expand in place (height animates in CSS).
    document.querySelectorAll('.tl-toggle').forEach(function (btn) {
      var item = btn.closest('.tl-item'), body = document.getElementById(btn.getAttribute('aria-controls'));
      btn.addEventListener('click', function () {
        var open = !item.classList.contains('open');
        item.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.querySelector('.tl-label').textContent = open ? 'Achievements ▴' : 'Achievements ▾';
        if (open) body.removeAttribute('inert'); else body.setAttribute('inert', '');
      });
    });

    // Skills: All skills ▾ reveals the full groups.
    document.querySelectorAll('.pill-more').forEach(function (btn) {
      var target = document.getElementById(btn.getAttribute('aria-controls'));
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (target) {
          if (btn.classList.contains('skills-all')) target.hidden = !open;
          else target.querySelectorAll('.pill-extra').forEach(function (p) { p.hidden = !open; });
        }
        btn.textContent = open ? 'Show fewer' : (btn.dataset.more || 'All skills ▾');
      });
    });

    var links = [].slice.call(document.querySelectorAll('.nav-links a[href^="#"]:not(.nav-cta)'));
    var secs = [].slice.call(document.querySelectorAll('main > section[id]:not([hidden]), main > header[id]'));
    var navMap = { top: 'products', snapshot: 'products', ecosystem: 'products', education: 'how', pillars: 'how', ellyra: 'products', metrics: 'metrics', how: 'how' };
    var crumbs = document.querySelector('.section-crumbs');
    var railMq = window.matchMedia('(min-width:1100px)');
    function placeSectionRail() {
      if (!crumbs || !railMq.matches) {
        document.documentElement.style.removeProperty('--rail-top');
        return;
      }
      var photo = document.querySelector('.portrait-wrap:not([hidden])');
      if (!photo) return;
      // Document Y of the portrait top == fixed top when the page is at scroll 0.
      var top = Math.max(Math.round(photo.getBoundingClientRect().top + window.scrollY), nav.offsetHeight + 12);
      document.documentElement.style.setProperty('--rail-top', top + 'px');
    }
    function onScroll() {
      nav.classList.toggle('scrolled', window.scrollY > 12);
      var pos = window.scrollY + Math.max(nav.offsetHeight, 120) + 8, cur = '';
      secs.forEach(function (s) { if (s.offsetTop <= pos) cur = s.id; });
      cur = navMap[cur] || cur;
      links.forEach(function (l) {
        var on = l.getAttribute('href') === '#' + cur;
        l.classList.toggle('active', on);
        if (on) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', placeSectionRail, { passive: true });
    if (railMq.addEventListener) railMq.addEventListener('change', placeSectionRail);
    function scheduleRail() {
      placeSectionRail();
      requestAnimationFrame(function () { requestAnimationFrame(placeSectionRail); });
      setTimeout(placeSectionRail, 50);
      setTimeout(placeSectionRail, 250);
    }
    scheduleRail();
    var portraitImg = document.querySelector('.portrait-wrap img');
    if (portraitImg) {
      if (!portraitImg.complete) portraitImg.addEventListener('load', scheduleRail);
    }
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(placeSectionRail);
      ro.observe(nav);
      var photoEl = document.querySelector('.portrait-wrap');
      if (photoEl) ro.observe(photoEl);
    }
    onScroll();

    var rv = document.querySelectorAll('.rv');
    var staticMode = /[?&]static=1\b/.test(location.search) || navigator.webdriver || window.matchMedia('print').matches;
    if (staticMode) {
      rv.forEach(function (el) { el.classList.add('in'); });
      document.documentElement.classList.add('static-reveal');
    } else if ('IntersectionObserver' in window) {
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
      var t = document.getElementById(location.hash.slice(1).split('/')[0]);
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
