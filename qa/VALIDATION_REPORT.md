# Validation Report — Portfolio Site & Editor

**Run:** 2026-10-22 06:08 UTC · **Mode:** full (selective: S1, S2, S3, S4, S5, B3, B5, C4, C10, D-390 — 107 other tests not run) · **Browser:** Chromium (Playwright 1.56.1) · **Accessibility engine:** axe-core 4.11.0

## Summary

| Result | Count |
|---|---|
| ✅ Passed | **10** |
| ❌ Failed | **0** |
| Total test cases | 10 |
| Screenshots captured | 7 |

**Overall status: PASS** — every test case passed.

| Area | Passed | Failed |
|---|---|---|
| B. Rendering | 2 | 0 |
| C. Interactions | 2 | 0 |
| D. Responsive | 1 | 0 |
| S. Snapshot fit | 5 | 0 |

## Regression coverage (self-updating)

The suite discovers features from the code on every run (`qa/lib/discover.mjs`) and generates the **R.** test cases from them. The checked-in `qa/coverage-manifest.json` records the last baseline.

| | Count |
|---|---|
| Features tracked | 262 |
| Added since last baseline | 10 — `admin-field:chips:array`, `admin-field:columns:lines`, `admin-field:rows:array`, `admin-field:need:string`, `admin-field:unit:string`, `admin-field:proof:object`, `admin-field:href:string`, `admin-field:footnote:string`, `admin-field:docs:array`, `admin-field:style:select` |
| Removed since last baseline | 1 — `slot:snapshot-title` |
| Auto-generated test cases this run | 0 |

## Test cases

### B. Rendering

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| B3 | Every section renders the expected number of items from content JSON | ✅ Pass | 0.8s | facts=8, steps=6, principles=0, products=9, glance=0, pillars=3, metrics=4, roles=7, legend=3, snapshot=6, snapItems=6, skills=10, edu=3, contact=5 |
| B5 | Section headings and sub-headings render exactly as written in the content files | ✅ Pass | 0.8s | [01-products-heading.png](screenshots/01-products-heading.png) |

### C. Interactions

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| C4 | Colour coding: career tracks, product arenas, snapshot groups and documents each use their own labelled colour | ✅ Pass | 1.0s | [02-colour-coded-portfolio.png](screenshots/02-colour-coded-portfolio.png) |
| C10 | Recruiter essentials: View Resume in hero; 60-second snapshot; skills “+N more” | ✅ Pass | 2.9s | [03-mobile-nav-resume.png](screenshots/03-mobile-nav-resume.png)<br>[04-snapshot-panel.png](screenshots/04-snapshot-panel.png) |

### D. Responsive

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| D-390 | No horizontal overflow and correct layout at 390px (mobile) | ✅ Pass | 1.4s | [05-mobile-390-full-page.jpg](screenshots/05-mobile-390-full-page.jpg) |

### S. Snapshot fit

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| S1 | #snapshot table.sn-match has 6 body rows with values and resolving proof links | ✅ Pass | 0.8s | [06-snapshot-fit-desktop.png](screenshots/06-snapshot-fit-desktop.png) |
| S2 | Clicking the “MCP Server case” proof opens #p-mcp | ✅ Pass | 2.3s |  |
| S3 | At 390px the snapshot has no horizontal overflow | ✅ Pass | 0.9s | [07-snapshot-fit-mobile.png](screenshots/07-snapshot-fit-mobile.png) |
| S4 | Page contains no 94% and no phone-number pattern | ✅ Pass | 0.7s |  |
| S5 | axe shows no serious or critical issues in #snapshot | ✅ Pass | 0.9s |  |

## Screenshots

All screenshots are in [`qa/screenshots/`](screenshots/).

- [01-products-heading.png](screenshots/01-products-heading.png) — B5: Section headings and sub-headings render exactly as written in the content files
- [02-colour-coded-portfolio.png](screenshots/02-colour-coded-portfolio.png) — C4: Colour coding: career tracks, product arenas, snapshot groups and documents each use their own labelled colour
- [03-mobile-nav-resume.png](screenshots/03-mobile-nav-resume.png) — C10: Recruiter essentials: View Resume in hero; 60-second snapshot; skills “+N more”
- [04-snapshot-panel.png](screenshots/04-snapshot-panel.png) — C10: Recruiter essentials: View Resume in hero; 60-second snapshot; skills “+N more”
- [05-mobile-390-full-page.jpg](screenshots/05-mobile-390-full-page.jpg) — D-390: No horizontal overflow and correct layout at 390px (mobile)
- [06-snapshot-fit-desktop.png](screenshots/06-snapshot-fit-desktop.png) — S1: #snapshot table.sn-match has 6 body rows with values and resolving proof links
- [07-snapshot-fit-mobile.png](screenshots/07-snapshot-fit-mobile.png) — S3: At 390px the snapshot has no horizontal overflow

## Scope & method

- **Environment:** the repository is served by a local static server built into the test runner, and tested in headless Chromium.
- **Viewports:** 1440, 1024, 768, 390 and 320 px wide; mobile runs emulate touch.
- **GitHub API:** editor tests use an in-memory mock of the GitHub REST API, so no real commits are made. The mock checks auth headers, SHAs (it rejects stale SHAs with a 409, the same way GitHub does), branch and payload encoding.
- **Accessibility:** the axe-core WCAG 2.0/2.1 A + AA rule sets plus best practices, and manual keyboard, heading, landmark and reduced-motion checks.
- **Security:** XSS attempts through content fields, the admin Content-Security-Policy, token storage and phone-number leakage in site pages.

## One-time checks done at initial build (24 Sep 2026)

These were done by hand once, outside this automated suite:

- **Résumé PDF contact details:** the downloadable résumé intentionally includes the phone number (owner's decision, Sep 2026). Test A3 keeps the number out of the site's pages and text files only.
- **Visual review:** every screenshot in this report was inspected at desktop and mobile sizes. That inspection found and fixed a wrapping logo mark, a stretched portrait, and a heading-level and contrast issue that axe also caught.

## Known limitations

- Only Chromium is automated here. Firefox and Safari use the same standard APIs, but aren't covered by this run.
- Real GitHub publishing and the ~1-minute GitHub Pages deploy can't be exercised offline. Do one manual publish after merging to confirm.
- Search engines and social previews read the static meta tags in `index.html`, so the SEO title and description edited in the editor affect only the browser tab. Regenerate the share image if your title changes a lot.

## Re-running

```bash
cd qa
npm install        # installs Playwright + axe-core (uses your local Chromium)
npx playwright install chromium   # only if no Chromium is installed yet
npm test           # rewrites screenshots/, results.json and VALIDATION_REPORT.md
```
