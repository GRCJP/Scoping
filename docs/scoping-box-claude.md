# Scoping OSC Discovery — evidence folder structure

Folder structure only for the C3PAO's evidence drop. This app does **not** connect to real Box. Use this as the contract if the C3PAO later wires a FedRAMP-authorized (or equivalent) share-out. Not a CMMC assessment. Not a CUI library. Never collect a CMMC UID/CUID.

## 0. Config (change these, then run)

```
ACCOUNT=DEV
PARENT_NAME=Scoping
DROPS_NAME=OSC Discovery Drops
TEMPLATE_NAME=TEMPLATE - OSC Discovery
TEST_DROP_NAME=TEST - OSC Discovery - 2026-08-28
SERVICE_ACCOUNT_EMAIL=   # leave blank unless the C3PAO pasted one
ASSESSOR_EMAIL=          # leave blank unless the C3PAO pasted one
OSC_TEST_EMAIL=          # leave blank unless the C3PAO pasted a dummy OSC
```

If ACCOUNT=DEV and a folder already named Scoping exists at root with children that are NOT exactly `OSC Discovery Drops` + `TEMPLATE - OSC Discovery`, do not reuse it. Create `Scoping-DEV` instead and say so.

If ACCOUNT=PROD, never create `Scoping-DEV`. Use `Scoping` only after confirming the root is empty of a conflicting Scoping.

## 1. Hard safety — do not mess up the current structure

You may create, write, share, and list ONLY under the parent you create in this run (`Scoping` or `Scoping-DEV`).

Do NOT:
- Open, search inside, rename, move, share, or upload into any existing client assessment folder, evidence library, or folder whose name includes CUI, assessment, eMASS, SPRS, or a client matter name you did not create in this run
- Invite the Scoping service account (or anyone) onto those existing folders
- Put Scoping under an existing assessment parent
- Connect this evidence parent to an assessment / CUI library
- Delete anything you did not create in this run
- Create real customer drops (live OSCs) in the template

If a search or list returns folders outside the new parent, ignore them. Do not recurse into them.

## 2. Idempotent procedure

1. Auth to the evidence store (when the C3PAO connects one). If auth is needed, stop and ask the C3PAO operator to sign in once.
2. List All Files root (one level only). Do not walk the whole tenant.
3. Decide parent name using section 0.
4. If the parent already has the exact children below and the four template subfolders with the three README files, verify contents, print folder IDs + URLs, and stop. Do not duplicate.
5. Otherwise create only what is missing.
6. Write or replace the three README files so the text matches section 4 exactly.
7. Create the TEST drop only if it does not exist.
8. Collaborations: only if emails in the config are non-blank. If blank, skip invites and still build folders.
9. Report back (section 8). Do not start Power Automate. Do not email anyone.

## 3. Target tree

All Files
  {PARENT_NAME}/
    OSC Discovery Drops/          # F1 will create empty customer drops here later. Keep empty except TEST.
      TEST - OSC Discovery - 2026-08-28/
        00 Internal/
          README-internal.txt
        01 Answers/
        02 Uploads/
          README-uploads.txt
        03 Scoping call/
          README-call.txt
    TEMPLATE - OSC Discovery/     # F2 copies these four children into each new drop
      00 Internal/
        README-internal.txt
      01 Answers/
      02 Uploads/
        README-uploads.txt
      03 Scoping call/
        README-call.txt

Do not add extra folders (no 04, no Certificate, no eMASS stubs in the template). The four eMASS files are written at submit time into 00 Internal of a real drop, not into the template.

Folder name F1 will use later (do not create these now):
`{Customer} - OSC Discovery - {yyyy-mm-dd}`
Sanitize `\\/:*?"<>|` out of the customer name. Cap at 80 characters.
Example: `Alder Precision - OSC Discovery - 2026-08-28`

## 4. README file contents (exact)

### 00 Internal / README-internal.txt

```
ASSESSOR ONLY. Do not share this folder with the OSC.

This folder receives:
- Go / no-go (GOOD TO GO | NEEDS REVIEW) — never shown to the customer
- Internal scope brief
- Four separate eMASS files written at submit (do not merge):
  Scoping-Guide-{org}.md
  Pre-Assessment-{org}.md
  Data-Template-{org}.md
  Assessment-Results-stub-{org}.md

Do not put scores, hashes, CPNs, or a CMMC UID/CUID in those files.
Certificate of CMMC Status is preview-only. Not a fifth file here.
Filled identity in eMASS files is CUI-when-filled. Keep this folder off the customer share.
```

### 02 Uploads / README-uploads.txt

```
Upload non-CUI artifacts only (redacted architecture, unlabeled diagrams).
Do not upload CUI, CMMC UIDs, SPRS scores, server names, machine names, file paths, or credentials.
High-level environment evidence only.
A short confirmation call comes later. Discovery was collected on the public form.
```

### 03 Scoping call / README-call.txt

```
Scoping call notes land here later.
The call is a quick reference confirmation — not a discovery interview.
Discovery was collected on the public OSC form.
Do not store CUI in this folder.
```

## 5. Permissions (least privilege)

Default owner of the new parent: the signed-in C3PAO operator for this run.

If SERVICE_ACCOUNT_EMAIL is set: invite as Co-owner on {PARENT_NAME} only. Never on any folder outside this parent.

If OSC_TEST_EMAIL is set: invite as Editor on TEST drop `01 Answers` and `02 Uploads` only. Do not invite them to 00 Internal, 03 Scoping call, the template, or the parent.

If ASSESSOR_EMAIL is set: invite as Editor on TEST drop `00 Internal` only (Viewer on `03 Scoping call` is OK).

Customer must never see 00 Internal or 03 Scoping call.
If a test OSC can see 00 Internal, stop, remove that collaboration, and report FAIL. Do not treat the tree as ready for Automate.

Do not create open shared links on 00 Internal.

## 6. What this run does NOT do

- Power Automate F1 / F2 (document only, section 7)
- Real customer email
- Writing the four eMASS files (those land on submit)
- Collecting CUID
- Changing any existing assessment library
- Connecting this parent to an assessment / CUI library
- Connecting real Box from this Next.js app (the intake simulates the drop)

## 7. Automate contract (do not build Automate in this run)

F1 on form submit: create an EMPTY folder under OSC Discovery Drops named `{Customer} - OSC Discovery - {yyyy-mm-dd}`. Stop. Do not copy the template in F1.

F2 on folder-created in OSC Discovery Drops: copy the four children of TEMPLATE - OSC Discovery into the new drop. Write the customer answers markdown into 01. Write scope brief + four eMASS files into 00 Internal. Share 01+02 with the OSC (Editor). Share 00 Internal with assessors. Never share 00 with the OSC.

Customer email subject: `OSC Discovery received — {org}`
Body: thanks; this is environment information, not an assessment; link to 01+02; do not upload CUI/UIDs/SPRS; confirmation call later.

Assessor email subject: `INTAKE {org} — GOOD TO GO|NEEDS REVIEW`
Body: outcome, three assessment lines, red flags, 00 Internal link. Call is confirmation.

## 8. Report back to the C3PAO

Print:
- ACCOUNT and parent name used
- Created vs already existed (each folder)
- Folder IDs and URLs for parent, Drops, Template, TEST, and the four template children
- Collaborations added (or skipped because emails were blank)
- Permission test: PASS / FAIL / SKIPPED
- Anything you refused to touch (existing folders you saw at root — names only, no contents)

## 9. Repeat in production

Set ACCOUNT=PROD, confirm PARENT_NAME=Scoping will not collide, and build the same tree in the C3PAO's production evidence store. Do not copy DEV test drops into production. Build the template + empty Drops folder only. Create a new TEST drop there if you want a permission proof. Dedicated service account on that parent only. Never invite it onto the CUI assessment library.
