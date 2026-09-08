# Company brand packs (fallback)

**Canonical packs live in `org-logos/<id>/`.** See `org-logos/README.md` and prompt: `Use logo <id> located in the project org-logos section.`

This folder is a fallback if `org-logos/<id>/` is missing or incomplete. Nothing under `brands/<id>/` is committed — GitHub, CI, and a fresh clone always show generic Scoping (`src/lib/brand.ts` + `public/brand/mark.svg`).

Customer logos, including any real C3PAO wordmark, must stay on disk in a gitignored pack. Do not add them to this repo.

## Add a company (prefer org-logos)

1. Create a folder whose name is the pack id (letters, numbers, hyphen, underscore):

   ```
   org-logos/acme/
     brand.json
     logo.svg
     icon.png    # optional square tab icon
   ```

   `brands/acme/` still works if `org-logos/acme/` is not present.

2. `brand.json` (theme and color overrides are not supported — navy/gold chrome stays the product):

   ```json
   {
     "id": "acme",
     "name": "Acme Assessments",
     "shortName": "Acme",
     "logo": "logo.svg",
     "icon": "icon.png"
   }
   ```

   `logo` is a filename in this same folder (`.svg` or `.png`). Not a URL or a path. Optional `icon` is a square tab / favicon in the same folder (`icon.png`, `icon.svg`, or `favicon.png`). Wide wordmarks are not used as the favicon.

3. Copy `.env.local.example` to `.env.local` (gitignored) and set:

   ```
   BRAND=acme
   ```

   `NEXT_PUBLIC_BRAND` works the same way. Restart the dev server after changing the env var.

4. Open the intake. The header, document title, and brand helper use that company's name and logo.

## Switch to a different company

Drop a second folder (`brands/other/`) and change `BRAND=other` in `.env.local`, or point `BRAND` at another existing pack. If the env var is unset, or the folder / `brand.json` / logo file is missing, the app keeps Scoping. It does not throw.

## Placeholder mark

A tiny generic SVG is enough for local checks:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 64" width="240" height="64">
  <rect width="240" height="64" fill="#021E47"/>
  <text x="24" y="42" fill="#FBBF24" font-family="system-ui,sans-serif" font-size="28">Acme</text>
</svg>
```

Save it as `org-logos/acme/logo.svg` (or `brands/acme/logo.svg` as fallback). Do not commit it.

Cloudflare `prescope-intake` cannot read this folder at runtime. See `docs/cloudflare/intake.md` § Company branding (deploy-only `NEXT_PUBLIC_*` demo vs runtime `BRAND` + R2/ASSETS).
