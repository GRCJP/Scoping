# Lock the Grok look on Power Pages (no Copilot)

Google Sites worked because you pasted HTML. Power Pages Copilot will not. Do this instead: **two pastes**.

Files in this folder:

- `prescope.css` — theme
- `home.html` — Home page body (redirect to `/intake` only)

## 1. Custom CSS

Studio → **Styling** (paintbrush) → **Enable custom CSS** / CSS editor at the bottom.

Paste the entire contents of `prescope.css`. Save. Sync / Preview.

If fonts do not load, **Set up → Header** (or Site details → Head) and paste:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,600;0,700;1,600&family=Public+Sans:wght@400;600&display=swap" rel="stylesheet" />
```

## 2. Home is a redirect, not a product page — unless Home already *is* the form

**Pages** → **Home** → **Edit code** (`</>`), not Copilot.

**Live Power Pages:** if the questionnaire already lives on Home (Intake page deleted), keep it there. Do **not** paste `home.html` bounce-to-/intake — that 404s when `/intake` is gone.

**GitHub / studio preview:** if Intake exists at `/intake`, delete the starter hero / search / filler sections and paste `home.html`. That file is a tiny bounce to `/intake` (meta refresh + `location.replace('/intake')` + a noscript link). Do not leave a slogan, second questionnaire, or assessor console on Home. Paste `docs/powerpages/osc-discovery.html` on Intake.

Hide header/footer nav so Home, About, and Profile are not linked. If the maker UI allows, set the website **Home Page** to **Intake** so `/` serves the questionnaire without a bounce.

Upload `public/brand/logo.png` (Web files or Header logo) if the header still shows the default portal mark.

## 3. Intake

`/intake` is the public product. The CSS restyles buttons, labels, and fields to navy/gold. It will not become the exact Grok step-rail until you replace that form with custom HTML (later).

## Do not

- Use Copilot
- Recreate tables
- Touch production Acme Assessments
- Leave Home as a second marketing or questionnaire site
