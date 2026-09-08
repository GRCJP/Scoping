# Scoping intake visual spec

This is the locked look for the public OSC questionnaire. Claude, Power Pages, and any rebuild must match **this folder**, not invent a lighter Microsoft form.

The Next.js app already implements this look (`src/app/globals.css`, `tailwind.config.ts`, `src/components/form/*`). Power Pages cannot run that app. Use `intake.css` in this folder plus the screenshots as the target.

**Logo is not the design.** Swap the mark. Do not restyle navy, gold, type, stepper, or pills to match a logo.

## Source of truth

| File | Use |
|------|-----|
| `screenshots/01-intro.png` | Intro: “Begin the questionnaire.” Full-bleed navy. Gold Start. |
| `screenshots/02-company.png` | Step 1: sticky chrome, gold stepper, white fill fields on navy. |
| `screenshots/03-cui-path.png` | Choice pills: unselected white outline, selected gold fill. |
| `screenshots/04-assets.png` | Long step, same chrome, no layout jump on reveals. |
| `screenshots/05-review.png` | Last step, gold Submit, footer disclaimer. |
| `intake.css` | Portable CSS for Power Pages / any host. Load Barlow + Public Sans. |

If a rebuild looks thinner than these shots, it is wrong. Typical failure: Segoe, default Dataverse inputs, dropdowns instead of pills, no sticky stepper, milky off-white type, light page chrome.

## Tokens

| Token | Value | Use |
|-------|--------|-----|
| Navy | `#021E47` | Full page, header, footer, stepper bar. Not a card on a light page. |
| Navy mid | `#12366C` | Landing hero only. Intake itself is `#021E47`. |
| Gold | `#FBBF24` | Primary button, selected pill, current step chip. |
| Gold hover | `#D97706` | Primary button hover (text goes white). |
| White | `#FFFFFF` | All question type, hints, stepper labels, intro body. Not `#F8FAFC`, not 80% white. |
| Ink on fill | `#021E47` | Text inside white inputs and selected gold pills. |
| Error | `#FCA5A5` | Validation only. |
| Clay | `#E97132` | Do not use on the public form. |
| Hairline | `rgba(255,255,255,0.10)` | Footer divider only. |

Solid fills only. No gradients. No maroon. No cyan glow. No circuit texture required.

## Type

Load Barlow 500/600/700 + Public Sans 400/500/600 from Google Fonts. Do not use Segoe UI, Calibri, or the Power Pages default stack.

Intro headline Barlow 48–60px / 600 / #FFFFFF. Intro body Public Sans 20px / 400 / #FFFFFF. Intro warning Public Sans 20px / 600 / #FBBF24. Step title Barlow 24px. Labels 16px. Hints 13px. Time line 18px. Pills 15px. Footer 11px at 90% white. Primary button 16px / 600 navy on gold.

## Chrome (frozen)

Full-viewport navy column. Header and footer do not scroll. Only the question well scrolls. Mark in a navy box, height 64px (48 compact), not on a white chip. Horizontal gold current-step chips. Question well max-width 40rem (42rem intro). Gold Continue/Submit min-width 9.5rem height 48px. Intro H1: Begin the questionnaire. Gold line: Do not include CUI.

## Controls

Pills not dropdowns for 2–8 choices. Off: transparent, 1px #FFFFFF, white text. On: #FBBF24 fill, navy text. Height ≥ 40px, radius 999px. White fill inputs on navy page. Reveal with visibility:hidden, not display:none.

## What not to ship

Segoe, light page with navy header only, fat sidebar, gradients, milky white type, dropdowns for Yes/No, CUID field, go/no-go on the public form, slogan.

## Power Pages

Load fonts. Attach intake.css. Full-bleed navy. Restyle fields to .psc-input / .psc-pill. Build the stepper in the header template. Pixel-check screenshots. If thinner, fix CSS; do not simplify.
