# Personal Product & Engineering Portfolio

A responsive, high-performance, single-page product portfolio showcasing zero-to-one product initiatives, cloud security posture systems, and agentic AI architectures. 

Hosted statically on [GitHub Pages](https://pages.github.com/).

---

## 🚀 Live Site

- **Production URL:** `https://<your-username>.github.io/` (or `https://<your-username>.github.io/portfolio/`)
- **Target Audience:** Engineering & Product Leadership, Recruiters, Founders, Design Partners

---

## 📁 Repository Structure

```text
├── index.html        # Semantic HTML5 single-page application scaffold
├── styles.css        # Responsive CSS tokens, layout grid, dark-theme system
├── script.js         # Tab switching & accessible smooth navigation logic
├── resume.pdf        # Downloadable résumé
├── assets/           # Media, headshot/avatar, diagrams, project assets
└── README.md         # Repository documentation
```

---

## 🛠️ Tech Stack & Design Principles

- **Zero Build Tooling:** Pure vanilla semantic HTML5, modern CSS3 (Custom Properties, CSS Grid, Flexbox), and lightweight vanilla JavaScript. No framework overhead or node module bloat.
- **Fast First Paint:** Instant load times, no third-party runtime bundles, optimized for mobile and desktop screens.
- **Accessible & Semantic:** Structured with accessible tab roles (`role="tablist"`, `role="tabpanel"`), descriptive meta tags, and high-contrast typography (`Plus Jakarta Sans` & `Space Grotesk`).
- **Narrative Architecture:** Structured into modular sections:
  1. **Hero & Value Proposition:** Role alignment, headline, and direct CTAs.
  2. **About:** Philosophy, strategic focus, and quick bio metadata.
  3. **Case Studies (`#work`):** Deep dives using Problem $\rightarrow$ Product Decision $\rightarrow$ Production Impact framing.
  4. **Experience (`#experience`):** Tabbed chronological career track record with key quantitative metrics.
  5. **Skills:** Categorized domain pills covering Product Strategy, AI Systems, Cloud Security, and Data Architecture.

---

## 💻 Local Development

No package manager (`npm` / `yarn` / `pnpm`) is required. You can preview the site using any static local server:

### Option 1: VS Code Live Server
1. Install the **Live Server** extension in VS Code.
2. Right-click `index.html` and select **Open with Live Server**.

### Option 2: Python HTTP Server
Run from the root directory:

```bash
# Python 3.x
python3 -m http.server 8000
```
Then visit `http://localhost:8000` in your browser.

---

## 🚢 Deployment (GitHub Pages)

This repository deploys automatically to GitHub Pages from the `main` branch.

1. Commit and push changes:
   ```bash
   git add .
   git commit -m "feat: update case studies and metrics"
   git push origin main
   ```
2. Navigate to **Settings** $\rightarrow$ **Pages** in this GitHub repository.
3. Under **Build and deployment**:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` / `/ (root)`
4. The deployment pipeline will trigger automatically, updating the live URL in 1–2 minutes.

---

## 📄 License & Attribution

The code and layout styling in this repository are available under the [MIT License](LICENSE). Content, career metrics, and personal branding copy belong to the author.
