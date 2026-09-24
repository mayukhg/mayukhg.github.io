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
└── qa/                     # End-to-end test suite, screenshots, validation report
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

## ✅ Quality assurance

A full end-to-end suite (48 test cases) covers static integrity, rendering, interactions, five viewport sizes, accessibility, resilience and security, and the editor, using a mocked GitHub API.

```bash
cd qa && npm install && npm test
```

Results: [`qa/VALIDATION_REPORT.md`](qa/VALIDATION_REPORT.md) · Screenshots: [`qa/screenshots/`](qa/screenshots/)

## 🚢 Deployment

GitHub Pages → **Settings → Pages → Deploy from a branch → `main` / root**. Every push, including every **Publish** from the editor, redeploys automatically.

## 📄 License

Code and layout: MIT. Content, career metrics, photo and personal branding belong to Mayukh Ghosh.
