# Org logos

Canonical **local-only** company marks. Nothing under `org-logos/<id>/` is committed except this README and `.gitkeep`. GitHub, CI, and a fresh clone always show generic Scoping (`src/lib/brand.ts` + `public/brand/mark.svg`).

`brands/<id>/` is a fallback if this folder has no complete pack. Do not commit customer logos or any PNG/SVG wordmark.

## Prompt an agent

Use one of these, then set `BRAND` in `.env.local`:

```
Use the Acme logo from org-logos/acme.
```

```
Use logo <id> located in the project org-logos section.
```

The agent should read `org-logos/<id>/brand.json` and the logo file next to it. It must not `git add` those files.

## Layout

```
org-logos/<id>/
  brand.json
  logo.png     # or logo.svg — header wordmark (may be wide)
  icon.png     # optional square tab / favicon; also icon.svg, favicon.png
```

`brand.json`:

```json
{
  "id": "acme",
  "name": "Acme Assessments",
  "shortName": "Acme",
  "logo": "logo.png",
  "icon": "icon.png",
  "contactEmail": "hello@example.com"
}
```

`logo` and optional `icon` are filenames in this same folder. Not a URL or a path. Theme overrides are not supported — navy/gold chrome stays the product.

A wide wordmark is a poor favicon. Prefer a square `icon.png` (or `favicon.png`). If the pack has no square icon, intake generates a navy mark from `shortName` (e.g. **Acme**) at `/api/brand/icon`. Do not commit the icon file.

## Activate

```
# .env.local (gitignored)
BRAND=acme
```

`NEXT_PUBLIC_BRAND` works the same way. Restart the dev server. The loader tries `org-logos/<id>/` first, then `brands/<id>/`, then Scoping. Missing pack / json / logo never throws.

## Cloudflare intake (`prescope-intake`)

`prescope-intake` is the **technical Worker service name** — keep it. Workerd cannot read this gitignored folder. See [`docs/cloudflare/intake.md`](../docs/cloudflare/intake.md) § Company branding for both paths: deploy-only `NEXT_PUBLIC_BRAND_*` demo, and the runtime `BRAND` + R2/ASSETS follow-up. Do not commit the pack.
