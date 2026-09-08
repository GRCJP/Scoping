# Maker walkthrough — paste order

Sit in the **Acme Assessments Power Platform environment** (commercial dry-run first). These files are the paste kit. The Next.js repo is the **IA spec only** — do not host it as the customer form.

Designer Bot / Grok **cannot** deploy Dataverse, Power Pages, or Automate from Cursor. If you want an in-tenant agent to click for you, paste `scoping-share-out.md` into Claude **signed into that tenant**. Otherwise walk the studios yourself in this order.

**Do not use** `scoping-field-map.md` for columns or branching. That file is the older A–G / FCI-fork schema. **Share-out + this demo 8-step form win.**

## Click order

| # | Where you sit | What you do | Paste from |
|---|---------------|-------------|------------|
| 1 | **Box** (browser) | Create the parent + TEMPLATE + empty Drops + optional TEST. **You** create folders. Do not ask an agent to create them unless you open Box yourself. | Target tree only: `scoping-box-claude.md` §3–4. Do not invite the service account onto CUI assessment folders. |
| 2 | **Power Apps** → Tables | Create choice sets, then table `psc_oscdiscovery` (display **OSC Discovery**), then related providers table. Follow the click list at the top of `01-dataverse.md` §3. GitHub cannot create the tenant table. | `01-dataverse.md` |
| 3 | **Power Pages** | New site (or existing Acme Assessments site). Multistep form, 8 steps. Anonymous **Create** on the parent; **Create** on `psc_oscdiscovery_sp` + **Append To** parent. Enable Web API for both tables (`fields=*`). Thank-you = Open evidence folder. | `02-power-pages.md` |
| 4 | **Power Automate** | Flow **F1** only. Prove it creates an **empty** drop. | `03-automate-f1.md` |
| 5 | **Box** | Permission-test the TEST drop (dummy OSC sees 01+02 only). If they can see 00, **stop**. | `scoping-box-claude.md` §5 |
| 6 | **Power Automate** | Flow **F2**. Template copy, SCOPE (no LLM), files, shares, two emails. | `04-automate-f2.md` |
| 7 | **Solutions** | Environment variables. Paste Box folder IDs you copied in step 1. | `05-env-vars.md` |

## First screen to open

1. **Box first** — All Files → create `Scoping` or `Scoping-DEV` (see box-claude collision rule). Not Power Pages yet.
2. After the Box tree exists, open **make.powerapps.com** → the Acme Assessments environment → **Tables** → New table. That is the first Power Platform screen.
3. **Power Pages** studio is *after* the table exists (the form binds to `psc_oscdiscovery`). First Pages screen: **Set up** → **Multistep forms** → New.
4. **Automate** is *after* the form can create a row. First Automate screen: **Create** → **Automated cloud flow** → Dataverse *When a row is added* → table OSC Discovery. That is **F1 only**. Do not start F2 until the TEST permission check passes.

## Share-out (last)

Send OSCs the **Power Pages form URL only**. Do not send `/assessor`, Dataverse row URLs, or 00 Internal.

## Hard rules (every studio)

- No CUID / UID / SPRS score fields. No CUI content. No file upload on the form.
- `evidence_share` is always Box. System default. **Not a form question.**
- OSC never sees GOOD TO GO / NEEDS REVIEW.
- Four eMASS files stay separate. Certificate is preview-only, not a fifth file.
- Never connect assessment Box to Grok / Designer Bot.
- GCC High port is later: new env vars, new folder IDs. Do not copy commercial IDs.
