## Feature ROI Calculator

Analytics / Feature ROI Calculator is a **data‑driven decision tool** that helps product analysts and project managers
evaluate feature impact, calculate ROI, and prioritize their roadmap based on numbers instead of gut feeling.

It is a fully **open‑source** project – you are welcome to explore the codebase, fork it, and adapt it to your own
workflow.

If you find it useful, please consider **starring the repository on GitHub** – stars and feedback help the project grow
and signal that this kind of tooling is valuable for the community.  
Repository URL: `https://github.com/Azizbek-Analyst/growth-funnel-simulator`

---

## Features

- **ROI & revenue calculator**: Model baseline metrics, expected uplift, and costs to get ROI, payback period, expected
  value (EV), and cumulative cash flow.
- **Scenario analysis**: Work with pessimistic, base, and optimistic scenarios to understand the risk/return profile of
  each feature.
- **Portfolio dashboard**: See all features in one place, with key KPIs and a sortable table for prioritization.
- **Funnel impact analysis**: Model a multi‑step funnel, simulate improvements at different steps, and see the revenue
  impact.
- **Comparison view**: Compare multiple features side‑by‑side to decide what to build next.
- **PDF & data export**: Export your analysis for stakeholders using Chart.js visualizations and html2pdf.
- **Local‑only data**: All data lives in your browser (via `localStorage`), so every person gets their own private set
  of projects by default.

---

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, and JavaScript
- **Tooling**: [Vite](https://vitejs.dev/) for development and bundling
- **Charts**: [Chart.js](https://www.chartjs.org/)
- **Export**: [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/)

---

## Getting Started

### Prerequisites

- Node.js **18+** (LTS recommended)
- npm (bundled with Node.js)

### Installation

```bash
npm install
```

### Development server

```bash
npm run dev
```

Then open the printed local URL in your browser (by default something like `http://localhost:5173`).

### Production build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

---

## Project Structure

Only the most important files are listed here:

- **Entry & layout**
  - `index.html` – Marketing/landing page for the tool.
  - `dashboard.html` – Main dashboard with KPIs and feature list.
  - `docs.html` – Documentation / “how it works” page, opened first for new users.
- **JavaScript**
  - `js/router.js` – Shared router helpers and sidebar rendering.
  - `js/store.js` – Local `localStorage` store for users, projects, features, and settings.
  - `js/dashboard.js` – Dashboard logic, KPIs, feature table, and navigation to feature detail.
  - `js/feature.js` – Feature card and calculator logic (inputs, scenarios, results).
  - `js/funnel.js` – Funnel impact calculator.
  - `js/compare.js` – Feature comparison view.
  - `js/docs.js` – In‑app documentation and onboarding helpers.
- **Styles**
  - `css/base.css` – Base styles, typography, layout.
  - `css/components.css` – Reusable UI components (buttons, cards, tables, etc.).
  - `css/pages.css` – Page‑specific layouts and tweaks.

---

## Usage & Concepts

- **Who is it for?**
  - Product managers, product analysts, and founders who want to make **data‑driven feature decisions**.
- **How do I start?**
  - Open the app, read the **Documentation** section to understand the model, then start creating and editing features in
    the **Dashboard**.
- **Data privacy model**
  - All data is stored in your browser via `localStorage`. Each person on each device gets their own isolated set of
    organizations, projects, and features by default.
  - There is no backend or authentication layer in this version; adding multi‑user/cloud storage can be a future
    extension.

Inside the UI you will also find a simple **“Like”** control – this is a lightweight way to express that you enjoy the
tool. For broader support, GitHub **stars** are the best signal and help guide further development.

---

## Contributing

Contributions, ideas, and bug reports are very welcome.

- If you have an idea for improvement or find an issue, please open an **Issue** or a **Pull Request**.
- If you adapt the calculator to your own stack or domain, feel free to share it – it helps other teams learn from your
  approach.

Before opening a PR, please:

- Keep the UI focused on clarity and decision support (not “feature for the sake of feature”).
- Add or update documentation in `docs.html` or this `README.md` where it helps others understand the change.

---

## License

This project is licensed under the **MIT License** – see the `LICENSE` file for details.
