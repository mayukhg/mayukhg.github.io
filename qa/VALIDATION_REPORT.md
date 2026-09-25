# Validation Report — Portfolio Site & Editor

**Run:** 2026-09-25 06:08 UTC · **Mode:** full · **Browser:** Chromium (Playwright 1.56.1) · **Accessibility engine:** axe-core 4.11.0

## Summary

| Result | Count |
|---|---|
| ✅ Passed | **89** |
| ❌ Failed | **0** |
| Total test cases | 89 |
| Screenshots captured | 31 |

**Overall status: PASS** — every test case passed.

| Area | Passed | Failed |
|---|---|---|
| A. Static integrity | 6 | 0 |
| B. Rendering | 5 | 0 |
| C. Interactions | 9 | 0 |
| D. Responsive | 7 | 0 |
| E. Accessibility | 6 | 0 |
| F. Resilience & security | 5 | 0 |
| G. Admin editor | 13 | 0 |
| R. Auto-discovered regression | 38 | 0 |

## Regression coverage (self-updating)

The suite discovers features from the code on every run (`qa/lib/discover.mjs`) and generates the **R.** test cases from them. The checked-in `qa/coverage-manifest.json` records the last baseline.

| | Count |
|---|---|
| Features tracked | 173 |
| Added since last baseline | 0 |
| Removed since last baseline | 0 |
| Auto-generated test cases this run | 38 |

## Test cases

### A. Static integrity

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| A1 | All required files exist | ✅ Pass | 0.0s | 15 files checked |
| A2 | Content JSON is valid and internally consistent | ✅ Pass | 0.0s | 7 products, 3 arenas, 7 roles |
| A3 | Phone number is not published in any site text file | ✅ Pass | 0.0s | 12 text files scanned; résumé PDF text layer additionally verified with pdfminer (see report) |
| A4 | Every local URL referenced by pages and content resolves (HTTP 200) | ✅ Pass | 0.0s | 9 local references checked |
| A5 | SEO & social metadata (title, description, canonical, Open Graph, JSON-LD) | ✅ Pass | 0.0s |  |
| A6 | Crawl rules: robots.txt blocks /admin, admin + 404 are noindex, sitemap valid | ✅ Pass | 0.0s |  |

### B. Rendering

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| B1 | Home page loads with zero console errors, page errors or failed requests | ✅ Pass | 1.8s | DOMContentLoaded 29 ms (local server); web fonts loaded<br>[01-desktop-1440-full-page.jpg](screenshots/01-desktop-1440-full-page.jpg) |
| B2 | Hero renders name, title, badge, intro (with bold), CTAs, photo and 4 stats | ✅ Pass | 0.9s | [02-hero-desktop.png](screenshots/02-hero-desktop.png) |
| B3 | Every section renders the expected number of items from content JSON | ✅ Pass | 0.7s | facts=6, steps=6, principles=3, products=7, glance=7, pillars=3, metrics=4, roles=7, panels=7, skills=4, edu=3, contact=4 |
| B4 | Content fidelity: every product, role, skill and education entry appears on the page | ✅ Pass | 0.7s |  |
| B5 | Section headings and sub-headings render exactly as written in the content files | ✅ Pass | 0.8s | [03-products-heading.png](screenshots/03-products-heading.png) |

### C. Interactions

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| C1 | Product card accordion expands and collapses (aria-expanded + height) | ✅ Pass | 2.0s | [04-product-card-expanded.png](screenshots/04-product-card-expanded.png) |
| C9 | Product card affordance: “Explore case study” button, content preview, whole-card click, animations, one-time hint | ✅ Pass | 13.0s | [05-product-card-closed-hover.png](screenshots/05-product-card-closed-hover.png)<br>[06-product-card-open.png](screenshots/06-product-card-open.png) |
| C2 | Arena filter chips show the right products and counts | ✅ Pass | 1.1s | [07-filter-agentic.png](screenshots/07-filter-agentic.png) |
| C3 | Experience tabs: clicking each tab shows exactly its panel | ✅ Pass | 3.5s | 7 tabs exercised<br>[08-experience-bp-tab.png](screenshots/08-experience-bp-tab.png) |
| C4 | Experience tabs support keyboard (Arrow keys, Home, End) with roving tabindex | ✅ Pass | 0.7s |  |
| C5 | Deep links open products (URL hash, filtered state, experience “related product” links) | ✅ Pass | 4.3s |  |
| C8 | Summary (“at a glance”) cards: one per product, in order, each opens its product case | ✅ Pass | 9.0s | [09-summary-cards-desktop.png](screenshots/09-summary-cards-desktop.png) |
| C6 | Nav links scroll to sections; active link and scrolled state update | ✅ Pass | 6.3s |  |
| C7 | Links: external open safely in new tab, mailto correct, résumé PDF served | ✅ Pass | 0.7s | 12 external links, 7 product GitHub links |

### D. Responsive

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| D-1440 | No horizontal overflow and correct layout at 1440px (desktop) | ✅ Pass | 2.0s | [10-desktop-1440-full-page.jpg](screenshots/10-desktop-1440-full-page.jpg) |
| D-1024 | No horizontal overflow and correct layout at 1024px (laptop) | ✅ Pass | 1.7s | [11-laptop-1024-full-page.jpg](screenshots/11-laptop-1024-full-page.jpg) |
| D-768 | No horizontal overflow and correct layout at 768px (tablet) | ✅ Pass | 1.8s | [12-tablet-768-full-page.jpg](screenshots/12-tablet-768-full-page.jpg) |
| D-390 | No horizontal overflow and correct layout at 390px (mobile) | ✅ Pass | 1.6s | [13-mobile-390-full-page.jpg](screenshots/13-mobile-390-full-page.jpg) |
| D-320 | No horizontal overflow and correct layout at 320px (small-mobile) | ✅ Pass | 1.5s | [14-small-mobile-320-full-page.jpg](screenshots/14-small-mobile-320-full-page.jpg) |
| D-menu | Mobile menu opens/closes (button, link tap, Escape) with correct ARIA | ✅ Pass | 0.8s | [15-mobile-menu-open.png](screenshots/15-mobile-menu-open.png) |
| D-touch | Touch targets are at least 44×44px on mobile | ✅ Pass | 0.7s |  |

### E. Accessibility

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| E1 | axe-core WCAG 2.1 AA audit — home page (desktop, with an expanded card) | ✅ Pass | 2.3s | Desktop: 45 axe rules passed, 0 violations |
| E2 | axe-core WCAG 2.1 AA audit — home page (mobile, menu open) | ✅ Pass | 1.5s | Mobile: 45 axe rules passed, 0 violations |
| E3 | Semantics: one H1, no skipped heading levels, landmarks, named controls, image alts | ✅ Pass | 0.7s |  |
| E4 | Keyboard: skip link is first tab stop and moves focus to main content; focus is visible | ✅ Pass | 0.7s | [16-keyboard-skip-link.png](screenshots/16-keyboard-skip-link.png) |
| E5 | Reduced motion: content is visible immediately without animations | ✅ Pass | 0.7s |  |
| E6 | No-JavaScript fallback shows a message with résumé + email links | ✅ Pass | 0.6s |  |

### F. Resilience & security

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| F1 | If content JSON fails to load, a friendly error is shown (no crash, no blank page) | ✅ Pass | 0.7s | [17-content-load-error.png](screenshots/17-content-load-error.png) |
| F2 | Preview mode renders the local draft only when ?preview=1 is present | ✅ Pass | 1.8s |  |
| F3 | XSS-safe rendering: HTML/script and javascript: links in content are neutralised | ✅ Pass | 1.3s |  |
| F4 | 404 page renders on unknown URLs with a way back | ✅ Pass | 0.7s | [18-404-page.png](screenshots/18-404-page.png) |
| F5 | Admin page ships a strict Content-Security-Policy and never leaks the token in URLs | ✅ Pass | 0.0s |  |

### G. Admin editor

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| G1 | Editor loads with no errors, populates every form from content, all tabs work | ✅ Pass | 1.0s | [19-admin-profile-tab.png](screenshots/19-admin-profile-tab.png) |
| G2 | Editing a field marks the draft dirty, autosaves, and “Preview draft” shows it on the real site | ✅ Pass | 2.0s | [20-admin-preview-draft.png](screenshots/20-admin-preview-draft.png) |
| G3 | Add a new product through the form; it appears on the site with correct arena filter counts | ✅ Pass | 2.2s | [21-admin-new-product-form.png](screenshots/21-admin-new-product-form.png)<br>[22-preview-new-summary-card.png](screenshots/22-preview-new-summary-card.png)<br>[23-preview-new-product.png](screenshots/23-preview-new-product.png) |
| G4 | Reorder, duplicate and delete list items (with confirmation) | ✅ Pass | 1.4s |  |
| G5 | Validation blocks publishing and points to each problem (required, email, URL, duplicate ID, unknown link) | ✅ Pass | 1.1s | [24-admin-validation-errors.png](screenshots/24-admin-validation-errors.png) |
| G6 | Connect flow: bad token shows a friendly error; valid token connects | ✅ Pass | 1.1s | [25-admin-connected.png](screenshots/25-admin-connected.png) |
| G7 | Publish commits correct JSON to the right repo/branch with SHAs, clears dirty state | ✅ Pass | 1.1s | [26-admin-published.png](screenshots/26-admin-published.png) |
| G8 | Publish detects a remote change and asks before overwriting (cancel = no commit) | ✅ Pass | 1.5s |  |
| G9 | File uploads: résumé PDF committed; wrong type and fake PDF rejected; portfolio + photo wire into content | ✅ Pass | 1.4s | [27-admin-files-uploaded.png](screenshots/27-admin-files-uploaded.png) |
| G10 | Backup download + restore, and “Discard draft” reverts to live content | ✅ Pass | 1.1s |  |
| G11 | “Remember on this device” stores token in localStorage; Disconnect removes it everywhere | ✅ Pass | 1.6s | Reopening the editor reconnects automatically |
| G12 | Editor is usable on mobile (390px): no horizontal overflow, axe audit clean | ✅ Pass | 1.3s | Admin axe: 0 violations<br>[28-admin-mobile-390.png](screenshots/28-admin-mobile-390.png) |
| G13 | Products tab and Files tab render correctly (visual check) | ✅ Pass | 1.0s | [29-admin-products-tab.png](screenshots/29-admin-products-tab.png)<br>[30-admin-files-tab.png](screenshots/30-admin-files-tab.png)<br>[31-admin-connect-tab.png](screenshots/31-admin-connect-tab.png) |

### R. Auto-discovered regression

| ID | Test case | Result | Time | Details / evidence |
|---|---|---|---|---|
| R-code | Code consistency: every slot rendered by script.js exists in index.html (and vice versa); icons match editor options | ✅ Pass | 0.0s | 33 slots, 12 icons, 12 editor icon options |
| R-section-top | Section #top renders with content | ✅ Pass | 0.0s |  |
| R-section-about | Section #about renders with content | ✅ Pass | 0.0s |  |
| R-section-approach | Section #approach renders with content | ✅ Pass | 0.0s |  |
| R-section-products | Section #products renders with content | ✅ Pass | 0.0s |  |
| R-section-ecosystem | Section #ecosystem renders with content | ✅ Pass | 0.0s |  |
| R-section-experience | Section #experience renders with content | ✅ Pass | 0.0s |  |
| R-section-skills | Section #skills renders with content | ✅ Pass | 0.0s |  |
| R-section-education | Section #education renders with content | ✅ Pass | 0.0s |  |
| R-section-contact | Section #contact renders with content | ✅ Pass | 0.0s |  |
| R-slots | All 33 content slots are populated (or intentionally hidden) | ✅ Pass | 0.0s |  |
| R-product-policy-foundry | Product “AI Policy Foundry”: summary card opens its full case with the right content and links | ✅ Pass | 2.2s |  |
| R-product-soc-portal | Product “AI SOC Portal”: summary card opens its full case with the right content and links | ✅ Pass | 2.7s |  |
| R-product-ai-spm | Product “AI Security Posture Management (AI-SPM)”: summary card opens its full case with the right content and links | ✅ Pass | 2.7s |  |
| R-product-mcp | Product “Exploit Validation & Remediation MCP Server”: summary card opens its full case with the right content and links | ✅ Pass | 2.7s |  |
| R-product-copilot | Product “Unified Risk Copilot”: summary card opens its full case with the right content and links | ✅ Pass | 2.7s |  |
| R-product-hscode | Product “HS Code Prediction API”: summary card opens its full case with the right content and links | ✅ Pass | 2.7s |  |
| R-product-kyc | Product “KYC-as-a-Service”: summary card opens its full case with the right content and links | ✅ Pass | 2.7s |  |
| R-arena-defence | Arena “AI Defence Ecosystem” filter shows exactly its 3 product(s) | ✅ Pass | 0.7s |  |
| R-arena-agentic | Arena “Agentic Platform” filter shows exactly its 2 product(s) | ✅ Pass | 0.7s |  |
| R-arena-applied | Arena “Applied AI” filter shows exactly its 2 product(s) | ✅ Pass | 0.7s |  |
| R-role-1 | Experience “Qualys”: tab shows title, dates, metrics and all 6 achievements | ✅ Pass | 6.0s |  |
| R-role-2 | Experience “Fractional CPO”: tab shows title, dates, metrics and all 5 achievements | ✅ Pass | 0.9s |  |
| R-role-3 | Experience “BP”: tab shows title, dates, metrics and all 6 achievements | ✅ Pass | 8.4s |  |
| R-role-4 | Experience “Amdocs”: tab shows title, dates, metrics and all 4 achievements | ✅ Pass | 0.4s |  |
| R-role-5 | Experience “Western Union”: tab shows title, dates, metrics and all 3 achievements | ✅ Pass | 2.5s |  |
| R-role-6 | Experience “Pitney Bowes”: tab shows title, dates, metrics and all 2 achievements | ✅ Pass | 3.8s |  |
| R-role-7 | Experience “Early career”: tab shows title, dates, metrics and all 2 achievements | ✅ Pass | 0.9s |  |
| R-admin-tab-profile | Editor tab “profile” opens its panel | ✅ Pass | 0.1s |  |
| R-admin-tab-products | Editor tab “products” opens its panel | ✅ Pass | 0.1s |  |
| R-admin-tab-files | Editor tab “files” opens its panel | ✅ Pass | 0.0s |  |
| R-admin-tab-connect | Editor tab “connect” opens its panel | ✅ Pass | 0.1s |  |
| R-admin-tab-help | Editor tab “help” opens its panel | ✅ Pass | 0.1s |  |
| R-admin-upload-resume | Editor upload “resume” has a file picker restricted to the right file types | ✅ Pass | 0.0s |  |
| R-admin-upload-portfolio | Editor upload “portfolio” has a file picker restricted to the right file types | ✅ Pass | 0.0s |  |
| R-admin-upload-photo | Editor upload “photo” has a file picker restricted to the right file types | ✅ Pass | 0.0s |  |
| R-admin-fields | Every editor form field (83 kinds, discovered from the schema) round-trips into the draft, and the edited draft renders | ✅ Pass | 3.7s | 92 distinct fields edited through the UI — string: 47, lines: 5, md: 17, path: 3, email: 1, url: 4, paras: 1, text: 5, mdlines: 4, bool: 2, color: 1, select: 2 |
| R-manifest | Regression suite is in sync with the code (coverage manifest updated) | ✅ Pass | 0.0s | 173 features tracked · 0 added, 0 removed since the last baseline |

## Screenshots

All screenshots are in [`qa/screenshots/`](screenshots/).

- [01-desktop-1440-full-page.jpg](screenshots/01-desktop-1440-full-page.jpg) — B1: Home page loads with zero console errors, page errors or failed requests
- [02-hero-desktop.png](screenshots/02-hero-desktop.png) — B2: Hero renders name, title, badge, intro (with bold), CTAs, photo and 4 stats
- [03-products-heading.png](screenshots/03-products-heading.png) — B5: Section headings and sub-headings render exactly as written in the content files
- [04-product-card-expanded.png](screenshots/04-product-card-expanded.png) — C1: Product card accordion expands and collapses (aria-expanded + height)
- [05-product-card-closed-hover.png](screenshots/05-product-card-closed-hover.png) — C9: Product card affordance: “Explore case study” button, content preview, whole-card click, animations, one-time hint
- [06-product-card-open.png](screenshots/06-product-card-open.png) — C9: Product card affordance: “Explore case study” button, content preview, whole-card click, animations, one-time hint
- [07-filter-agentic.png](screenshots/07-filter-agentic.png) — C2: Arena filter chips show the right products and counts
- [08-experience-bp-tab.png](screenshots/08-experience-bp-tab.png) — C3: Experience tabs: clicking each tab shows exactly its panel
- [09-summary-cards-desktop.png](screenshots/09-summary-cards-desktop.png) — C8: Summary (“at a glance”) cards: one per product, in order, each opens its product case
- [10-desktop-1440-full-page.jpg](screenshots/10-desktop-1440-full-page.jpg) — D-1440: No horizontal overflow and correct layout at 1440px (desktop)
- [11-laptop-1024-full-page.jpg](screenshots/11-laptop-1024-full-page.jpg) — D-1024: No horizontal overflow and correct layout at 1024px (laptop)
- [12-tablet-768-full-page.jpg](screenshots/12-tablet-768-full-page.jpg) — D-768: No horizontal overflow and correct layout at 768px (tablet)
- [13-mobile-390-full-page.jpg](screenshots/13-mobile-390-full-page.jpg) — D-390: No horizontal overflow and correct layout at 390px (mobile)
- [14-small-mobile-320-full-page.jpg](screenshots/14-small-mobile-320-full-page.jpg) — D-320: No horizontal overflow and correct layout at 320px (small-mobile)
- [15-mobile-menu-open.png](screenshots/15-mobile-menu-open.png) — D-menu: Mobile menu opens/closes (button, link tap, Escape) with correct ARIA
- [16-keyboard-skip-link.png](screenshots/16-keyboard-skip-link.png) — E4: Keyboard: skip link is first tab stop and moves focus to main content; focus is visible
- [17-content-load-error.png](screenshots/17-content-load-error.png) — F1: If content JSON fails to load, a friendly error is shown (no crash, no blank page)
- [18-404-page.png](screenshots/18-404-page.png) — F4: 404 page renders on unknown URLs with a way back
- [19-admin-profile-tab.png](screenshots/19-admin-profile-tab.png) — G1: Editor loads with no errors, populates every form from content, all tabs work
- [20-admin-preview-draft.png](screenshots/20-admin-preview-draft.png) — G2: Editing a field marks the draft dirty, autosaves, and “Preview draft” shows it on the real site
- [21-admin-new-product-form.png](screenshots/21-admin-new-product-form.png) — G3: Add a new product through the form; it appears on the site with correct arena filter counts
- [22-preview-new-summary-card.png](screenshots/22-preview-new-summary-card.png) — G3: Add a new product through the form; it appears on the site with correct arena filter counts
- [23-preview-new-product.png](screenshots/23-preview-new-product.png) — G3: Add a new product through the form; it appears on the site with correct arena filter counts
- [24-admin-validation-errors.png](screenshots/24-admin-validation-errors.png) — G5: Validation blocks publishing and points to each problem (required, email, URL, duplicate ID, unknown link)
- [25-admin-connected.png](screenshots/25-admin-connected.png) — G6: Connect flow: bad token shows a friendly error; valid token connects
- [26-admin-published.png](screenshots/26-admin-published.png) — G7: Publish commits correct JSON to the right repo/branch with SHAs, clears dirty state
- [27-admin-files-uploaded.png](screenshots/27-admin-files-uploaded.png) — G9: File uploads: résumé PDF committed; wrong type and fake PDF rejected; portfolio + photo wire into content
- [28-admin-mobile-390.png](screenshots/28-admin-mobile-390.png) — G12: Editor is usable on mobile (390px): no horizontal overflow, axe audit clean
- [29-admin-products-tab.png](screenshots/29-admin-products-tab.png) — G13: Products tab and Files tab render correctly (visual check)
- [30-admin-files-tab.png](screenshots/30-admin-files-tab.png) — G13: Products tab and Files tab render correctly (visual check)
- [31-admin-connect-tab.png](screenshots/31-admin-connect-tab.png) — G13: Products tab and Files tab render correctly (visual check)

## Scope & method

- **Environment:** the repository is served by a local static server built into the test runner, and tested in headless Chromium.
- **Viewports:** 1440, 1024, 768, 390 and 320 px wide; mobile runs emulate touch.
- **GitHub API:** editor tests use an in-memory mock of the GitHub REST API, so no real commits are made. The mock checks auth headers, SHAs (it rejects stale SHAs with a 409, the same way GitHub does), branch and payload encoding.
- **Accessibility:** the axe-core WCAG 2.0/2.1 A + AA rule sets plus best practices, and manual keyboard, heading, landmark and reduced-motion checks.
- **Security:** XSS attempts through content fields, the admin Content-Security-Policy, token storage and phone-number leakage.

## One-time checks done at initial build (24 Sep 2026)

These were done by hand once, outside this automated suite:

- **Résumé PDF redaction:** the phone number was removed from the PDF's content stream, and the leftover (unreferenced) copy of the original page was purged. Text extraction with `pdfminer.six` then found no phone number, and the contact line reads `email | LinkedIn | Pune, India`. Test A3 re-checks the raw bytes on every run.
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
