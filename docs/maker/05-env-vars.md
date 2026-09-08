# Environment variables — fill after Box folders exist

Solution → **Environment variables**. Do not invent IDs. Copy them from Box (folder Details) after you create the tree by hand.

Do **not** copy commercial IDs into GCC High later. Recapture on that tenant.

| Name | What you paste | Where you get it |
|------|----------------|------------------|
| `psc_BoxDropsParentId` | Folder id of **OSC Discovery Drops** | Box → that folder → Details → Folder ID. F1 creates empty drops here. |
| `psc_BoxTemplateFolderId` | Folder id of **TEMPLATE - OSC Discovery** | Same. F2 copies its four children. |
| `psc_BoxServiceAccount` | `prescope-automate@…` (or whatever you created) | Dedicated Box user. Co-owner/Editor on the Scoping parent **only**. Automate Box connection = this account. Never invite it onto CUI assessment folders. |
| `psc_CustomerLinkItems` | `01 Answers,02 Uploads` | Constant. Never include `00 Internal`. |
| `psc_AssessorMailbox` | Internal To: | Distribution list for email 2. |
| `psc_ServiceMailbox` | From: | Both emails. |
| `psc_DataverseAppUrl` | Model-driven app form URL prefix | For the assessor email record link. |
| `psc_Tz` | `America/New_York` | Folder and file dates. Not UTC. |

Optional to store (not required for v1 flows if you look up children by name after copy):

| Name | What |
|------|------|
| Template `00 Internal` folder id | Only if you prefer IDs over name lookup |
| Template `01 Answers` folder id | |
| Template `02 Uploads` folder id | |
| Template `03 Scoping call` folder id | |

## After you create the tree

1. Write down: parent name (`Scoping` vs `Scoping-DEV`), ACCOUNT (DEV/PROD).
2. Folder IDs + Box URLs for: parent, Drops, Template, four template children, TEST (or deleted).
3. Paste Drops + Template IDs into the two required vars above.
4. Permission-test TEST before turning F2 on.

## Report when done

Parent name and ACCOUNT. Folder IDs + URLs. Service-account collab or skipped. Permission test PASS / FAIL / SKIPPED. Dataverse table + environment. **Power Pages form URL** (the only customer URL). Flow names F1 / F2. Anything you refused to touch (root folder names only).
