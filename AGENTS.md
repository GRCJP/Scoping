# Agent notes

## Company marks

Company name and logo packs live in `org-logos/<id>/` (`brand.json` + `logo.png` or `.svg`). `brands/<id>/` is a fallback only.

- Never commit logos, wordmarks, or other binaries under `org-logos/` or `brands/` (except the committed README and `.gitkeep`).
- When asked to use a company logo, read that folder (example: `Use the Acme logo from org-logos/acme.`).
- Select the pack with `BRAND=<id>` in `.env.local`. GitHub stays Scoping if the pack is missing.
