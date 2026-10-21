# Validation Report — Portfolio Site & Editor

**Run:** 2026-10-21 11:19 UTC · **Mode:** full (selective: C5, C6, D-320, D-390, D-1024, D-menu, R-code, R-product-cropguard, G6, G7, G8 — 93 other tests not run) · **Browser:** Chromium (Playwright 1.56.1) · **Accessibility engine:** axe-core 4.11.0

## Summary

| Result | Count |
|---|---|
| ✅ Passed | **11** |
| ❌ Failed | **0** |
| Total test cases | 11 |
| Screenshots captured | 6 |

**Overall status: PASS** — every test case passed.

| Area | Passed | Failed |
|---|---|---|
| C. Interactions | 2 | 0 |
| D. Responsive | 4 | 0 |
| G. Admin editor | 3 | 0 |
| R. Auto-discovered regression | 2 | 0 |

## Regression coverage (self-updating)

The suite discovers features from the code on every run (`qa/lib/discover.mjs`) and generates the **R.** test cases from them. The checked-in `qa/coverage-manifest.json` records the last baseline.

| | Count |
|---|---|
| Features tracked | 245 |
| Added since last baseline | 1 — `admin-field:demo:path` |
| Removed since last baseline | 2 — `slot:metrics-section`, `admin-field:demo:url` |
| Auto-generated test cases this run | 2 |

## Test cases

### C. Interactions

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| C5 | Deep links open products (URL hash, filtered state, experience “related product” links) | ✅ Pass | 2.5s |  |
| C6 | Nav links scroll to sections; active link and scrolled state update | ✅ Pass | 5.4s |  |

### D. Responsive

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| D-1024 | No horizontal overflow and correct layout at 1024px (laptop) | ✅ Pass | 1.5s | [01-laptop-1024-full-page.jpg](screenshots/01-laptop-1024-full-page.jpg) |
| D-390 | No horizontal overflow and correct layout at 390px (mobile) | ✅ Pass | 1.4s | [02-mobile-390-full-page.jpg](screenshots/02-mobile-390-full-page.jpg) |
| D-320 | No horizontal overflow and correct layout at 320px (small-mobile) | ✅ Pass | 1.4s | [03-small-mobile-320-full-page.jpg](screenshots/03-small-mobile-320-full-page.jpg) |
| D-menu | Section crumb pills are visible and clickable on mobile | ✅ Pass | 1.6s | [04-mobile-menu-open.png](screenshots/04-mobile-menu-open.png) |

### G. Admin editor

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| G6 | Connect flow: bad token shows a friendly error; valid token connects | ✅ Pass | 1.0s | [05-admin-connected.png](screenshots/05-admin-connected.png) |
| G7 | Publish commits correct JSON to the right repo/branch with SHAs, clears dirty state | ✅ Pass | 0.9s | [06-admin-published.png](screenshots/06-admin-published.png) |
| G8 | Publish detects a remote change and asks before overwriting (cancel = no commit) | ✅ Pass | 1.3s |  |

### R. Auto-discovered regression

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| R-code | Code consistency: every slot rendered by script.js exists in index.html (and vice versa); icons match editor options | ✅ Pass | 0.0s | 49 slots, 16 icons, 14 editor icon options |
| R-product-cropguard | Product “CropGuard”: the case opens with the right content and links | ✅ Pass | 2.0s |  |

## Screenshots

All screenshots are in [`qa/screenshots/`](screenshots/).

- [01-laptop-1024-full-page.jpg](screenshots/01-laptop-1024-full-page.jpg) — D-1024: No horizontal overflow and correct layout at 1024px (laptop)
- [02-mobile-390-full-page.jpg](screenshots/02-mobile-390-full-page.jpg) — D-390: No horizontal overflow and correct layout at 390px (mobile)
- [03-small-mobile-320-full-page.jpg](screenshots/03-small-mobile-320-full-page.jpg) — D-320: No horizontal overflow and correct layout at 320px (small-mobile)
- [04-mobile-menu-open.png](screenshots/04-mobile-menu-open.png) — D-menu: Section crumb pills are visible and clickable on mobile
- [05-admin-connected.png](screenshots/05-admin-connected.png) — G6: Connect flow: bad token shows a friendly error; valid token connects
- [06-admin-published.png](screenshots/06-admin-published.png) — G7: Publish commits correct JSON to the right repo/branch with SHAs, clears dirty state

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
