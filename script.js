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

    var cta = '<a class="btn btn-light" href="#products">Explore ' + (prodCount ? prodCount + ' ' : '') + 'AI products ' + icon('i-arrow') + '</a>';
    if (links.resume) cta += '<a class="btn btn-ghost" href="' + esc(safeUrl(links.resume)) + '" target="_blank" rel="noopener">View résumé ' + icon('i-doc') + '</a>';
    if (links.portfolio) cta += '<a class="btn btn-ghost" href="' + esc(safeUrl(links.portfolio)) + '" target="_blank" rel="noopener">Portfolio PDF ' + icon('i-doc') + '</a>';
    if (links.github) cta += '<a class="btn btn-ghost" href="' + esc(safeUrl(links.github)) + '" target="_blank" rel="noopener">GitHub ' + icon('i-gh') + '</a>';
    set('hero-cta', cta);

    var portrait = slot('portrait');
    if (person.photo) {
      portrait.hidden = false;
      portrait.innerHTML = '<img class="portrait" src="' + esc(safeUrl(person.photo)) + '" width="640" height="640" alt="' + esc(person.photoAlt || name) + '" fetchpriority="high">' +
        (person.location || person.portraitCaption ? '<div class="portrait-tag"><span class="dot" aria-hidden="true"></span><span>' + esc(person.location) + '<small>' + esc(person.portraitCaption) + '</small></span></div>' : '');
    } else { portrait.hidden = true; }

    var stats = arr(p.stats);
    var st = set('stats', stats.map(function (s) {
      return '<div class="stat"><dt class="sr-only">' + esc(s.label) + '</dt><dd><span class="n">' + esc(s.value) + '</span><span class="l">' + esc(s.label) + '</span></dd></div>';
    }).join(''));
    st.hidden = !stats.length;
    st.style.setProperty('--cols', Math.min(stats.length || 1, 4));
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
        used.map(function (a) { return '<button type="button" class="chipbtn" data-f="' + esc(a.id) + '" aria-pressed="false">' + esc(a.label) + ' <span class="ct">' + counts[a.id] + '</span></button>'; }).join('')
      : '');

    set('products', products.map(function (p, i) {
      var id = slug(p.id || p.name), a = arenaById[p.arena] || {};
      var color = /^#[0-9a-f]{3,8}$/i.test(a.color || '') ? ' style="--arena:' + a.color + '"' : '';
      var tags = (p.client ? '<span class="client"><i>Implemented for</i> ' + esc(p.client) + '</span>' : '') +
        arr(p.stack).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
      var links = '';
      if (p.github) links += '<a class="acc-link" href="' + esc(safeUrl(p.github)) + '"' + ext(p.github) + '>' + icon('i-gh') + 'View on GitHub</a>';
      if (p.demo) links += '<a class="acc-link" href="' + esc(safeUrl(p.demo)) + '"' + ext(p.demo) + '>' + icon('i-arrow') + 'Live demo</a>';
      var snaps = [['Customer pain', p.pain], ['The product bet', p.bet], [p.whyLabel || 'Why AI is the right call', p.why]]
        .filter(function (x) { return x[1]; })
        .map(function (x) { return '<div class="snap"><h3>' + esc(x[0]) + '</h3><p>' + md(x[1]) + '</p></div>'; }).join('');
      var decide = '';
      if (p.tradeoff) decide += '<div><h3>Key trade-off</h3><p>' + md(p.tradeoff) + '</p></div>';
      if (p.validated) decide += '<div><h3>Validated with</h3><p>' + md(p.validated) + '</p></div>';
      if (arr(p.outcomes).length) decide += '<div><h3>Value &amp; outcomes</h3><ul>' + arr(p.outcomes).map(function (o) { return '<li>' + md(o) + '</li>'; }).join('') + '</ul></div>';
      return '<article class="acc" data-arena="' + esc(p.arena) + '" id="p-' + esc(id) + '"' + color + '>' +
        '<button class="acc-head" type="button" aria-expanded="false" aria-controls="b-' + esc(id) + '">' +
          '<span class="acc-main">' +
            '<span class="kicker">' + esc(p.kicker || a.label || '') + '</span>' +
            '<span class="acc-title">' + esc(p.name) + '</span>' +
            '<span class="acc-sum">' + md(p.summary) + '</span>' +
            (tags ? '<span class="acc-meta">' + tags + '</span>' : '') +
          '</span>' +
          '<span class="chev" aria-hidden="true"><svg><use href="#i-chev"/></svg></span>' +
        '</button>' +
        (links ? '<div class="acc-links">' + links + '</div>' : '') +
        '<div class="acc-body" id="b-' + esc(id) + '" role="region" aria-label="' + esc(p.name) + ' details"><div class="acc-inner">' +
          (snaps ? '<div class="snapshot">' + snaps + '</div>' : '') +
          (decide ? '<div class="decide">' + decide + '</div>' : '') +
          (p.note ? '<p class="note">' + md(p.note) + '</p>' : '') +
        '</div></div>' +
      '</article>';
    }).join(''));
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
      '<div class="metrics">' + arr(e.metrics).map(function (m) {
        return '<div class="metric"><span class="n">' + esc(m.value) + '</span><span class="l">' + esc(m.label) + '</span><span class="c">' + esc(m.caption) + '</span></div>';
      }).join('') + '</div>' +
      (e.note ? '<p class="note">' + md(e.note) + '</p>' : '') +
      '</div>';
  }

  function renderExperience(p, productIndex) {
    var x = p.experience || {}, roles = arr(x.roles);
    set('exp-title', esc(x.title));
    set('exp-sub', esc(x.subtitle));
    set('exp-tabs', roles.map(function (r, i) {
      var k = slug(r.tab || r.company, i);
      return '<button class="exp-tab" type="button" role="tab" id="t-' + k + '" aria-controls="x-' + k + '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '"><b>' + esc(r.tab || r.company) + '</b><span>' + esc(r.period) + '</span></button>';
    }).join(''));
    set('exp-panels', roles.map(function (r, i) {
      var k = slug(r.tab || r.company, i);
      var rel = arr(r.related).map(function (id) {
        var prod = productIndex[slug(id)];
        return prod ? '<a href="#p-' + esc(slug(id)) + '">' + esc(prod.name) + '</a>' : '';
      }).filter(Boolean);
      return '<div class="exp-panel" role="tabpanel" id="x-' + k + '" aria-labelledby="t-' + k + '" tabindex="0"' + (i ? ' hidden' : '') + '>' +
        '<div class="exp-head"><div><h3>' + esc(r.title) + (r.company ? ' <span>@ ' + esc(r.company) + '</span>' : '') + '</h3>' +
        (r.org ? '<p class="exp-org">' + esc(r.org) + '</p>' : '') + '</div>' +
        (r.dates ? '<span class="pill-date">' + esc(r.dates) + '</span>' : '') + '</div>' +
        (r.summary ? '<p class="exp-summary">' + md(r.summary) + '</p>' : '') +
        (arr(r.metrics).length ? '<ul class="exp-metrics" aria-label="Key metrics">' + arr(r.metrics).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') +
        (arr(r.bullets).length ? '<ul class="exp-list">' + arr(r.bullets).map(function (b) { return '<li>' + md(b) + '</li>'; }).join('') + '</ul>' : '') +
        (rel.length ? '<p class="stackline"><b>Related product' + (rel.length > 1 ? 's' : '') + ':</b> ' + rel.join(' · ') + '</p>' : '') +
        '</div>';
    }).join(''));
  }

  function renderRest(p) {
    var s = p.skills || {}, links = p.links || {};
    set('skills-title', esc(s.title));
    set('skills', arr(s.groups).map(function (g) {
      return '<div class="skill-card"><h3>' + esc(g.name) + '</h3><ul class="pills">' + arr(g.items).map(function (t) { return '<li class="pill">' + esc(t) + '</li>'; }).join('') + '</ul></div>';
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
    if (links.resume) cl += '<a class="btn btn-ghost" href="' + esc(safeUrl(links.resume)) + '" target="_blank" rel="noopener">' + icon('i-doc') + 'Résumé (PDF)</a>';
    if (links.portfolio) cl += '<a class="btn btn-ghost" href="' + esc(safeUrl(links.portfolio)) + '" target="_blank" rel="noopener">' + icon('i-doc') + 'Portfolio (PDF)</a>';
    set('contact-links', cl);
    set('foot-name', esc((p.person || {}).name) + ((p.person || {}).location ? ' · ' + esc(p.person.location) : ''));

    var m = p.meta || {};
    if (m.title) document.title = m.title;
    var desc = document.querySelector('meta[name="description"]');
    if (desc && m.description) desc.setAttribute('content', m.description);
  }

  function render(c) {
    var productIndex = {};
    arr(c.products.products).forEach(function (p) { productIndex[slug(p.id || p.name)] = p; });
    renderHero(c.profile, arr(c.products.products).length);
    renderAbout(c.profile);
    renderApproach(c.profile);
    renderProducts(c.products);
    renderEcosystem(c.products);
    renderExperience(c.profile, productIndex);
    renderRest(c.profile);
    // Reveal-on-scroll targets
    document.querySelectorAll('.s-title, .s-sub, .about-body, .about-side, .step, .principle, .acc, .pillar, .eco-col, .metric, .exp-shell, .skill-card, .card, .contact h2, .contact-row')
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
    function setAcc(acc, open) {
      var head = acc.querySelector('.acc-head'), body = acc.querySelector('.acc-body');
      acc.classList.toggle('open', open);
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      body.style.maxHeight = open ? body.scrollHeight + 'px' : '0px';
    }
    document.querySelectorAll('.acc-head').forEach(function (head) {
      head.addEventListener('click', function () {
        var acc = head.closest('.acc');
        setAcc(acc, !acc.classList.contains('open'));
      });
    });
    window.addEventListener('resize', function () {
      document.querySelectorAll('.acc.open .acc-body').forEach(function (b) { b.style.maxHeight = b.scrollHeight + 'px'; });
    });

    var chips = document.querySelectorAll('.chipbtn');
    function applyFilter(f) {
      chips.forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.f === f ? 'true' : 'false'); });
      document.querySelectorAll('#product-list .acc').forEach(function (card) {
        card.hidden = !(f === 'all' || card.dataset.arena === f);
      });
    }
    chips.forEach(function (c) { c.addEventListener('click', function () { applyFilter(c.dataset.f); }); });

    function openFromHash() {
      var id = decodeURIComponent(location.hash.slice(1));
      if (!/^p-/.test(id)) return;
      var card = document.getElementById(id);
      if (!card || !card.classList.contains('acc')) return;
      if (card.hidden) applyFilter('all');
      card.classList.add('in');
      setAcc(card, true);
      card.scrollIntoView({ block: 'start' });
    }
    window.addEventListener('hashchange', openFromHash);

    var tabs = [].slice.call(document.querySelectorAll('.exp-tab'));
    function activate(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { activate(tab, false); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); activate(next, true); }
      });
    });

    var nav = document.getElementById('nav');
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
