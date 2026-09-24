# Mayukh Ghosh — Product Portfolio

A fast, accessible, single-page portfolio for **Mayukh Ghosh**, Director of Product Management (Agentic AI & Cybersecurity). It covers:

- seven AI product case studies
- the AI Defence Ecosystem platform story
- two decades of experience

All content is editable **without touching code** through a built-in editor at **`/admin`**.

Hosted on [GitHub Pages](https://pages.github.com/) → `https://mayukhg.github.io/`

---

## ✏️ Updating your résumé & portfolio (no code)

1. Open **`https://mayukhg.github.io/admin/`**.
2. **Connect to GitHub** (one-time setup): create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with these settings:
   - *Repository access:* only `mayukhg.github.io`
   - *Permissions:* **Contents → Read and write**

   Paste it into the Connect tab. The token stays in your browser and is sent only to `api.github.com`.
3. **Edit** any section: profile, headline numbers, experience, skills, education, products, arenas, spotlight. You can add, reorder, duplicate or delete items with the buttons on each row. Drafts save automatically in your browser.
4. Click **Preview draft** to see the real site with your unpublished changes.
5. Click **Publish changes**. Each publish is a normal Git commit, and the live site updates in about a minute.
6. **Files tab:** upload a new résumé PDF, a portfolio PDF or a headshot. PDFs are public, so remove private details such as your phone number first.

Text fields marked **rich** support `**bold**` and `[link text](https://…)`. List boxes take one item per line. The **Help** tab in the editor has more detail. **Download backup** saves your draft to a file.

> The editor publishes to the branch set on its Connect tab (default `main`, the branch GitHub Pages serves).

---

## 📁 Repository structure

```text
├── index.html              # Page shell: layout, meta/SEO tags, section slots
├── styles.css              # Design tokens, layout, responsive rules (self-hosted fonts)
├── script.js               # Renders content/*.json into the page + interactions
├── content/
│   ├── profile.json        # Hero, about, approach, experience, skills, education, contact
│   └── products.json       # Arenas, product case studies, ecosystem spotlight
├── admin/                  # No-code editor (GitHub API, strict CSP, noindex)
│   ├── index.html
│   ├── admin.js
│   └── admin.css
├── assets/                 # Headshot, social share card, self-hosted fonts, uploaded PDFs
├── resume.pdf              # Downloadable résumé (phone number removed)
├── 404.html · robots.txt · sitemap.xml · .nojekyll
├── .githooks/pre-commit     # Runs the regression suite before every commit
├── .github/workflows/       # Same suite in CI on every push / PR
└── qa/                     # Regression suite, discovery, coverage manifest, report, screenshots
```

## 🛠️ Tech & design principles

- **No build step, no framework:** semantic HTML5, modern CSS and vanilla JS. The content is plain JSON.
- **Fast:** self-hosted variable fonts (latin subset, ~50 KB) and no third-party runtime requests.
- **Accessible:** WCAG 2.1 AA, audited with axe-core. Tabs follow the WAI-ARIA pattern with arrow-key support, and there's a skip link, visible focus and reduced-motion support.
- **Safe rendering:** content is HTML-escaped. Only `**bold**` and `http(s)` / relative links are turned into markup.
- **Editor security:** strict Content-Security-Policy, least-privilege fine-grained token, `noindex`, and blocked in `robots.txt`.

## 💻 Local preview

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

The page loads its content with `fetch`, so open it through a local server rather than as a `file://` URL.

## ✅ Regression suite (runs automatically)

`qa/` contains a self-updating, end-to-end regression suite that runs in headless Chromium. It uses Playwright plus the axe-core accessibility checker. It covers:

- static integrity and privacy (for example, no phone number published)
- rendering and content accuracy
- every interaction: summary cards, accordions, filters, tabs, deep links and nav
- five viewport sizes
- WCAG 2.1 AA accessibility
- resilience and XSS safety
- the whole `/admin` editor, against a mocked GitHub API

**When it runs**

| Trigger | How |
|---|---|
| Before every local `git commit` | `.githooks/pre-commit` tests the **staged snapshot**, and a failure blocks the commit. It's enabled automatically by `cd qa && npm install`, which sets `core.hooksPath`. Commits that only change docs or reports skip it. To run only the tests relevant to a change, use `QA_ONLY="A2,B4,R-section-*" git commit …` (test IDs, `*` as a prefix wildcard). CI still runs everything. For an emergency bypass, use `SKIP_REGRESSION=1 git commit …`. |
| Every push to `main` and every PR | `.github/workflows/regression.yml` runs the same suite, which also covers edits published from `/admin`. The report appears in the run summary, with screenshots as a downloadable artifact. |
| Manually | `cd qa && npm test` refreshes the checked-in report and screenshots. |

**How it updates itself when the code changes.** `qa/lib/discover.mjs` scans the code on every run and finds:

- page sections, content slots, nav links and icons
- editor tabs, form fields (read from the editor's form definitions) and uploads
- every product, arena and role

The suite then **generates test cases for each item** (group **R**). Adding a section, editor field or product therefore adds tests with no edits to the suite. Consistency checks fail when the code and the page disagree, for example when a slot is rendered but missing from `index.html`, or an icon is offered but not defined. The discovered list is saved to `qa/coverage-manifest.json`. The pre-commit hook re-stages it with each commit, so the diff shows exactly how coverage changed. The report lists the features added or removed since the last baseline.

Report: [`qa/VALIDATION_REPORT.md`](qa/VALIDATION_REPORT.md) · Screenshots: [`qa/screenshots/`](qa/screenshots/)

## 🚢 Deployment

GitHub Pages → **Settings → Pages → Deploy from a branch → `main` / root**. Every push, including every **Publish** from the editor, redeploys automatically.

## 📄 License

Code and layout: MIT. Content, career metrics, photo and personal branding belong to Mayukh Ghosh.
