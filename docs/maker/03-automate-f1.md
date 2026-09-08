# Automate F1 — `psc-osc-oncreate-drop`

First Automate screen: **Create** → **Automated cloud flow** → trigger **When a row is added** → table **OSC Discovery** (`psc_oscdiscovery`) → scope **Organization**.

F1 **stops** after the empty folder exists. No template copy. No files. No email. No SCOPE.

## Trigger

- Dataverse: **When a row is added**
- Table: OSC Discovery
- Filter rows (optional): `psc_orchstatus eq 'Submitted'` so retries do not loop

## Actions (in this order)

1. **Initialize** `CustomerName`
   - Expression: trim `psc_oscname` (fallback `psc_hqname`)
   - Sanitize: replace `\ / : * ? " < > |` with space, collapse spaces, take first 80 characters
2. **Convert time zone** `SubmitDay`
   - Source: `utcNow()` (or `psc_submittedon` if you stamp it on create)
   - Time zone: `psc_Tz` = `America/New_York`
   - Format: `yyyy-MM-dd`
3. **Compose** `DropFolderName`

```
@{variables('CustomerName')} - OSC Discovery - @{outputs('SubmitDay')}
```

Example: `Harborline Precision - OSC Discovery - 2026-08-28`

4. **Update row** (same OSC Discovery)
   - `psc_name` = `@{variables('CustomerName')} - @{outputs('SubmitDay')}`
   - `psc_submittedon` = utcNow() if empty
   - `psc_evidence_share` = `Box`
5. **Box — Create folder**
   - Parent folder id: environment variable **`psc_BoxDropsParentId`** (`OSC Discovery Drops`)
   - Name: `DropFolderName`
   - **Empty.** Do not copy anything.
6. **Update row**
   - `psc_boxdropfolderid` = new folder id
   - `psc_boxdropfolderurl` = new folder URL
   - `psc_orchstatus` = `DropCreated`
   - `psc_flowrunurl` = `workflow()['run']['name']` URL if you have it
7. **Terminate** Succeeded

## Must not do

- Copy `TEMPLATE - OSC Discovery`
- Write markdown / eMASS files
- Invite collaborators
- Send email
- Call SCOPE
- Create Harborline / East River / live customer drops by hand in this flow

## Failure

If Box create fails: stamp `psc_orchstatus` = `FailedBox`, notify `psc_AssessorMailbox`, do not retry blindly.

## Prove it

Submit one test row from Power Pages (or a maker create). Confirm an **empty** folder appears under Drops. Then delete that test drop if it is not named `TEST - …`. F2 must ignore names containing `TEST`.
