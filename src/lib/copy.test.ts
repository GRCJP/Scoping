import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "..");

function src(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

/** Built at runtime so a repo-wide grep for the ghost CTA stays clean. */
const GHOST_CONTINUE = ["Continue to", "questions"].join(" ");
const FLOATING_TIME = ["About 15 to 20 minutes.", "You can leave and return in the same browser."].join(" ");
const ORPHAN_HEADER_TIME = ["8 sections", "About 15 to 20 minutes"].join(" · ");

const BANNED = [
  GHOST_CONTINUE,
  "Begin the questionnaire",
  "This is not a test",
  "You already saw this",
  ORPHAN_HEADER_TIME,
];

const PUBLIC_UI_ROOTS = [
  join(root, "app"),
  join(root, "components"),
  join(repo, "docs", "powerpages"),
  join(repo, "docs", "design"),
];

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      walkFiles(full, acc);
      continue;
    }
    if (/\.(tsx|ts|jsx|js|html|css)$/.test(name)) acc.push(full);
  }
  return acc;
}

describe("public intake copy", () => {
  it("WelcomeIntro is the three-card welcome with a single Start", () => {
    const welcome = src("components/form/WelcomeIntro.tsx");
    assert.ok(welcome.includes("Map the CUI boundary before the assessment."));
    assert.ok(
      welcome.includes(
        "This questionnaire describes the environment that will be assessed. Complete it to get the process started.",
      ),
    );
    assert.ok(welcome.includes("Scope, not a score"));
    assert.ok(welcome.includes("High-level only"));
    assert.ok(welcome.includes("Gets the process started"));
    assert.ok(
      welcome.includes(
        "Leave and come back. Your answers kick off the engagement with the shape of the enclave already clear.",
      ),
    );
    assert.equal(welcome.includes("scoping call"), false);
    assert.equal(welcome.includes("Feeds the scoping"), false);
    assert.ok(welcome.includes("#12366C"));
    assert.equal(welcome.includes("A few things about your environment."), false);
    assert.equal(welcome.includes(FLOATING_TIME), false);
    assert.equal(welcome.includes("About 15 to 20 minutes."), false);
    assert.equal(welcome.includes("About 15 to 20 minutes"), false);
    assert.equal(welcome.includes("About 15 minutes."), false);
    assert.equal(welcome.includes("OSC Discovery"), false);
    assert.equal(welcome.includes("onSkip"), false);
    assert.match(welcome, /max-w-3xl text-center/);
    const title = welcome.slice(welcome.indexOf("<h1"), welcome.indexOf("</h1>"));
    const lead = welcome.slice(welcome.indexOf("<p "), welcome.indexOf("Complete it to get the process started."));
    assert.match(title, /text-center/);
    assert.match(title, /textAlign:\s*"center"/);
    assert.ok(title.includes("Map the CUI boundary before the assessment."));
    assert.match(lead, /text-center/);
    assert.match(lead, /textAlign:\s*"center"/);
    assert.match(welcome, /px-6 py-7 text-left/);
    assert.match(welcome, /flex justify-center/);
    const form = src("components/form/IntakeForm.tsx");
    const mapCuiWell = form.slice(form.indexOf("{welcome ?"), form.indexOf("<WelcomeIntro"));
    assert.match(mapCuiWell, /text-center/);
    for (const phrase of BANNED) assert.equal(welcome.includes(phrase), false);
    assert.match(welcome, />\s*Start\s*</);
    assert.match(welcome, /fontSize:\s*16/);
    assert.equal(welcome.includes("text-sm"), false);
  });

  it("public UI never uses Prescope as the product name", () => {
    const allowedTech = [
      "X-Prescope-Handling",
      "X-Prescope-Fill-Key",
      "x-prescope-assessor-key",
    ];
    const hits: string[] = [];
    for (const dir of PUBLIC_UI_ROOTS) {
      for (const file of walkFiles(dir)) {
        let text = readFileSync(file, "utf8");
        for (const token of allowedTech) text = text.split(token).join("");
        if (/\bPrescope\b/.test(text)) hits.push(relative(repo, file));
      }
    }
    assert.deepEqual(hits, []);

    const brand = src("lib/brand.ts");
    const mark = readFileSync(join(repo, "public", "brand", "mark.svg"), "utf8");
    const envExample = readFileSync(join(repo, ".env.example"), "utf8");
    const pages = readFileSync(join(repo, "docs", "powerpages", "osc-discovery.html"), "utf8");
    assert.ok(brand.includes('displayName: "Scoping"'));
    assert.ok(brand.includes('shortName: "Scoping"'));
    assert.equal(/\bPrescope\b/.test(brand), false);
    assert.ok(mark.includes(">Scoping</text>"));
    assert.ok(mark.includes('aria-label="Scoping"'));
    assert.match(envExample, /^NEXT_PUBLIC_BRAND_NAME=Scoping$/m);
    assert.ok(pages.includes('name: "Scoping"'));
    assert.equal(/\bPrescope\b/.test(pages), false);
  });

  it("public form, landing, and Power Pages have no Continue-to-questions or onSkip", () => {
    const hits: string[] = [];
    for (const dir of PUBLIC_UI_ROOTS) {
      for (const file of walkFiles(dir)) {
        const text = readFileSync(file, "utf8");
        if (text.includes(GHOST_CONTINUE) || text.includes("onSkip")) {
          hits.push(relative(repo, file));
        }
      }
    }
    assert.deepEqual(hits, []);
  });

  it("banner is centered ALL CAPS DO NOT INCLUDE CUI at equal type size", () => {
    const banner = src("components/form/ScopeWarningBanner.tsx");
    assert.ok(banner.includes("DO NOT INCLUDE CUI."));
    assert.ok(banner.includes("High-level only. No server names, machine names, file paths, or IPs."));
    assert.ok(banner.includes("text-center"));
    assert.ok(banner.includes("#12366C"));
    assert.ok(banner.includes("#FBBF24"));
    assert.ok(banner.includes("fontSize: 17"));
    assert.equal(banner.includes("WARNING."), false);
  });

  it("BrandMark has no navy chip or center-only treatment", () => {
    const mark = src("components/layout/BrandMark.tsx");
    assert.equal(mark.includes("bg-navy"), false);
    assert.ok(mark.includes("bg-transparent"));
    assert.equal(mark.includes("justify-center"), false);
    assert.equal(mark.includes("-mt-"), false);
    assert.equal(mark.includes("-ml-"), false);
  });

  it("IntakeForm has no leftover welcome, orphan time, or Continue-to-questions", () => {
    const form = src("components/form/IntakeForm.tsx");
    const rail = src("components/form/StepRail.tsx");
    assert.equal(form.includes("OSC Discovery"), false);
    for (const phrase of BANNED) assert.equal(form.includes(phrase), false);
    assert.ok(form.includes("ScopeWarningBanner"));
    assert.ok(form.includes("Required consents"));
    assert.ok(form.includes("noValidate"));
    assert.ok(form.includes("firstIncompleteGap"));
    assert.ok(form.includes("remainingCopy"));
    assert.ok(form.includes("of {steps.length}"));
    assert.ok(form.includes("Back to Review") || form.includes("Return to submit"));
    assert.ok(rail.includes("cursor-pointer"));
    assert.ok(rail.includes("disabled={!started}"));
    assert.equal(rail.includes("disabled={i"), false);
    assert.match(rail, /const on = started && i === current/);
    assert.match(rail, /on && "bg-gold text-navy border-gold"/);
    assert.ok(rail.includes("remainingCopy"));
    assert.ok(src("lib/beats.ts").includes("export function remainingCopy"));
    const pages = readFileSync(join(repo, "docs", "powerpages", "osc-discovery.html"), "utf8");
    const welcomeRail = pages.match(/if \(!started\)\{[\s\S]*?return;\s*\}/)?.[0] ?? "";
    assert.ok(welcomeRail.includes("psc-step"));
    assert.equal(welcomeRail.includes("aria-current"), false);
    assert.ok(pages.includes("Back to Review"));
    assert.ok(pages.includes("cursor: pointer"));
    assert.ok(pages.includes("of ") && pages.includes("STEPS.length"));
    assert.equal(pages.includes("Continue to questions"), false);
    assert.match(pages, />Next</);
    assert.equal(form.includes("questionHeaderCopy"), false);
    assert.equal(rail.includes("questionHeaderCopy"), false);
    assert.match(form, />\s*Next\s*</);
    assert.equal(/\bContinue\b/.test(form), false);
    assert.equal(form.includes('borderLeft: "4px solid #FBBF24"'), false);
    assert.equal(form.includes("pl-4 space-y-10"), false);
    assert.ok(form.includes("Where CUI lives today"));
    assert.ok(form.includes("MultiSelectField"));
    const headerMark = form.match(/function IntakeHeaderMark\(\)[\s\S]*?\n\}/)?.[0] ?? "";
    assert.ok(headerMark.includes("pt-6"));
    assert.ok(headerMark.includes("px-6") || headerMark.includes("pl-6"));
    assert.ok(headerMark.includes("pb-4") || headerMark.includes("pb-3"));
    assert.ok(headerMark.includes("justify-center"));
    assert.equal(headerMark.includes("justify-start"), false);
    assert.equal(form.includes("py-3 flex items-center"), false);
    const stepG = form.slice(form.indexOf("function StepG"));
    assert.ok(stepG.includes("Required consents"));
    assert.equal(stepG.includes("SSP exists?"), false);
    assert.equal(stepG.includes("Any POA&M"), false);
    assert.ok(form.includes('beatId === "readiness"'));
    assert.equal(form.includes("scoping call"), false);
    assert.equal(pages.includes("scoping call"), false);
    assert.equal(form.includes("A fact about the environment. Yes does not fail this intake."), true);
    assert.equal(pages.includes("A fact about the environment. Yes does not fail this intake."), true);
  });

  it("CUI location well is white with navy values", () => {
    const field = src("components/form/Field.tsx");
    assert.ok(field.includes('backgroundColor: "#FFFFFF"'));
    assert.ok(field.includes('color: "#021E47"'));
    assert.equal(field.includes("border-paper-300 bg-white text-navy overflow-hidden"), false);
  });

  it("LCCA punch list: providers rebuilt, Monitoring stripped, type scale, no CUID field", () => {
    const form = src("components/form/IntakeForm.tsx");
    const field = src("components/form/Field.tsx");
    const welcome = src("components/form/WelcomeIntro.tsx");
    assert.ok(form.includes("What does this provider do here?"));
    assert.ok(form.includes("Marketplace service offering name"));
    assert.ok(form.includes("Written CRM that names inherited vs OSC-owned"));
    assert.ok(form.includes("Do you have systems that could touch CUI but you keep off CUI"));
    assert.ok(form.includes("Is there physical CUI we would need to observe"));
    assert.ok(form.includes("Is a freeze planned during the assessment window?"));
    assert.ok(form.includes("Is a migration planned during the assessment window?"));
    assert.ok(form.includes("Name the types that exist today"));
    assert.equal(form.includes("ESPs in this environment"), false);
    assert.equal(form.includes("Does a CSP hold CUI?"), false);
    assert.ok(form.includes("You listed"));
    assert.ok(form.includes("Sector (CISA)"));
    assert.ok(form.includes("How many users will access CUI?"));
    assert.equal(form.includes("Number of employees"), false);
    assert.equal(form.includes("Headcount for this OSC"), false);
    const address = src("components/form/AddressIntake.tsx");
    assert.ok(address.includes("Address line 1"));
    assert.ok(address.includes("Paste address"));
    assert.ok(address.includes("Paste or type the full mailing address"));
    assert.ok(form.includes("AddressIntake"));
    assert.equal(form.includes("Device classes"), false);
    assert.equal(form.includes("Users who touch CUI"), false);
    assert.equal(form.includes("How CUI enters and leaves"), false);
    assert.equal(form.includes("Specialized assets"), false);
    assert.equal(form.includes("Who reviews"), false);
    assert.equal(form.includes("Asset inventory exists"), false);
    assert.equal(form.includes("POA&M notes"), false);
    assert.equal(form.includes("SSP last updated"), false);
    assert.ok(form.includes("Continuous monitoring tool (optional)"));
    const pages = readFileSync(join(repo, "docs", "powerpages", "osc-discovery.html"), "utf8");
    assert.ok(pages.includes("shell.getTokenDeferred"));
    assert.ok(pages.includes("function withToken(cb)"));
    assert.ok(pages.includes("__RequestVerificationToken\": tok"));
    assert.ok(pages.includes("justify-content: center"));
    assert.ok(pages.includes("padding: 1.5rem 1.5rem 1rem"));
    assert.equal(pages.includes("justify-content: flex-start"), false);
    assert.ok(pages.includes("Option values must match the maker kit"));
    assert.ok(pages.includes("100000000 + index"));
    assert.ok(pages.includes("var CHOICE_SETS"));
    assert.ok(pages.includes("Financial Services"));
    assert.ok(pages.includes('ints.join(",")'));
    assert.equal(pages.includes('v.join(";")'), false);
    assert.equal(pages.includes("psc_sector:1"), false);
    assert.ok(pages.includes('k:"psc_address1"') || pages.includes('k:"psc_address1"') || pages.includes("psc_address1"));
    assert.ok(pages.includes("psc_spcmmcstatus"));
    assert.ok(pages.includes("function encodeProvider"));
    assert.ok(pages.includes("body[f.k] = !!v"));
    assert.ok(pages.includes('inputmode="email"'));
    assert.ok(pages.includes('autocomplete="email"'));
    assert.ok(pages.includes('function looksLikeEmail'));
    assert.ok(pages.includes('function looksLikeCage'));
    assert.ok(pages.includes('function looksLikeCageList'));
    assert.ok(pages.includes("CAGE must be 5 letters or digits."));
    assert.ok(form.includes("companyCageErrors"));
    assert.ok(form.includes("onCageBlur"));
    assert.ok(form.includes("normalizeCageTyping"));
    const goNext = form.match(/const goNext = \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? "";
    assert.ok(goNext.includes("companyCageErrors"));
    assert.ok(goNext.includes('current.id === "P1"'));
    assert.equal(goNext.includes("validateStep"), false);
    assert.equal(goNext.includes("has_sps"), false);
    assert.ok(field.includes("onBlur={onBlur}"));
    assert.ok(pages.includes('psc:osc-draft'));
    assert.ok(pages.includes("Entire answer object + provider rows"));
    assert.ok(pages.includes("function firstIncompleteGap"));
    assert.ok(pages.includes("function focusFirstErr"));
    assert.ok(pages.includes("id=\"pscReturnReview\""));
    assert.ok(pages.includes("function returnReviewHtml"));
    assert.ok(pages.includes("function reviewRailBeat"));
    assert.ok(pages.includes("function refreshGapNote"));
    assert.ok(pages.includes("elNext.blur"));
    assert.ok(form.includes("reviewRailBeatIdx"));
    assert.ok(form.includes("gapSummary.length > 0"));
    assert.ok(form.includes("RECAP_JUMPS"));
    assert.ok(pages.includes("psc-recap-jump"));
    assert.ok(form.includes("applyHasSpsChange"));
    assert.ok(form.includes("applyHqNameChange"));
    assert.ok(form.includes("patchHqName"));
    assert.equal(form.includes('onChange={(v) => patch("hqname", v)}'), false);
    assert.ok(form.includes("consentsAccepted"));
    assert.ok(form.includes("nativeEvent.isTrusted"));
    assert.ok(form.includes("successPathForId"));
    assert.equal(form.includes('json.redirect || "/success"'), false);
    assert.equal(form.includes('patch("sps", [])'), false);
    assert.ok(form.includes("setGapSummary(gap ? gap.summary : [])"));
    assert.ok(form.includes('document.getElementById("pscSubmit")?.blur()'));
    assert.ok(form.includes('id="pscSubmit"'));
    assert.ok(form.includes("function focusGapControl"));
    assert.ok(form.includes("[aria-invalid='true']"));
    assert.ok(form.includes('type="checkbox"'));
    assert.ok(form.includes("aria-invalid={!!error}"));
    assert.ok(form.includes("gapSummary.length && !onReviewConsents"));
    assert.ok(form.includes("intakeSessionFromLoad"));
    assert.equal(form.includes("restored ? false"), false);
    assert.ok(form.includes("setAnswers((prev)"));
    assert.ok(form.includes("applyCuiLocationChange"));
    assert.ok(form.includes("patchCuiLocations"));
    assert.ok(form.includes("focusGapControl(wellRef.current, keys)"));
    assert.ok(form.includes('document.getElementById("pscSubmit")?.blur()'));
    assert.ok(form.includes('fieldKey="consent_notassessment"'));
    assert.ok(form.includes("id={`field-${fieldKey}`}"));
    assert.ok(pages.includes('aria-invalid="true"'));
    assert.ok(pages.includes("if (!gapNote || onReviewConsents()) return \"\""));
    assert.ok(pages.includes("body[f.k] = String(v)"));
    assert.ok(pages.includes("psc_cui_backup_where"));
    assert.ok(pages.includes("return=representation"));
    assert.ok(pages.includes("function encodeProvider"));
    assert.ok(pages.includes("psc_OSCDiscovery@odata.bind"));
    assert.ok(pages.includes("Provider row was not created"));
    assert.ok(pages.includes("Providers were not saved"));
    assert.ok(pages.includes("Do not flatten onto the parent"));
    const pagesDoc = readFileSync(join(repo, "docs", "maker", "02-power-pages.md"), "utf8");
    assert.ok(pagesDoc.includes("Webapi/psc_oscdiscovery_sp/enabled"));
    assert.ok(pagesDoc.includes("Prefer: return=representation"));
    assert.ok(pagesDoc.includes("Append To"));
    assert.ok(pages.includes("A recap of answers already given"));
    assert.equal(pages.includes('window.location.href = "/thank-you"'), false);
    assert.ok(pages.includes("We received your submission."));
    assert.ok(pages.includes("function showSuccess"));
    assert.ok(pages.includes("clearDraft();"));
    assert.ok(pages.includes(".psc-intake.is-done #pscIntro"));
    const showSuccess = pages.slice(pages.indexOf("function showSuccess"), pages.indexOf("function render"));
    assert.ok(showSuccess.includes('elIntro.style.display = "none"'));
    assert.ok(showSuccess.includes("start.disabled = true"));
    assert.match(pages, /\.psc-intake\.is-done #pscDone[\s\S]*text-align:\s*center/);
    assert.equal(pages.includes("SSP, named artifacts, POA&M open, and two confirmations."), false);
    const dataverse = readFileSync(join(repo, "docs", "maker", "01-dataverse.md"), "utf8");
    assert.match(dataverse, /`psc_cui_backup_where` \| Where do CUI backups live\? \| text 100 \| yes/);
    assert.ok(dataverse.includes("Maker click list"));
    assert.ok(dataverse.includes("`psc_job`"));
    assert.ok(dataverse.includes("`psc_cui_or_spd`"));
    assert.ok(dataverse.includes("`psc_own_cmmc`"));
    assert.ok(dataverse.includes("`psc_admin_access`"));
    assert.ok(dataverse.includes("`psc_crm_inherited`"));
    assert.ok(dataverse.includes("`psc_vendor_srm`"));
    assert.ok(dataverse.includes("`psc_poc_last`"));
    assert.ok(dataverse.includes("`psc_spcmmcstatus`"));
    assert.ok(dataverse.includes("`psc_service_desc`"));
    assert.ok(dataverse.includes("`psc_spsector`"));
    assert.ok(dataverse.includes("psc_OSCDiscovery@odata.bind"));
    assert.ok(dataverse.includes("Webapi/psc_oscdiscovery_sp/enabled"));
    assert.equal(dataverse.includes("| `psc_poc` | POC |"), false);
    assert.equal(dataverse.includes("| `psc_cmmcstatus` |"), false);
    assert.ok(dataverse.includes("Review is a recap of answers already given"));
    assert.equal(pages.includes("/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/"), false);
    assert.match(pages, /type="text" inputmode="email"/);
    assert.ok(pages.includes("function withToken(cb)"));
    assert.ok(pages.includes("var CHOICE_SETS"));
    assert.ok(pages.includes("Sector (CISA)"));
    assert.ok(pages.includes("How many users will access CUI?"));
    assert.equal(pages.includes("Number of employees"), false);
    assert.equal(pages.includes("Headcount for this OSC"), false);
    assert.ok(pages.includes("Address line 1"));
    assert.ok(pages.includes("POC last name"));
    assert.ok(pages.includes("CMMC Status"));
    assert.equal(pages.includes("Device classes"), false);
    assert.equal(pages.includes("How CUI enters and leaves"), false);
    assert.ok(src("components/form/InfoTip.tsx").includes("text-base"));
    assert.equal(form.includes("GCC High is treated as FedRAMP High equivalent"), false);
    assert.equal(form.includes("optional CMMC status"), false);
    assert.equal(/label=["']CUID["']/.test(form), false);
    assert.equal(form.includes("CMMC UID field"), false);
    assert.equal(form.includes("go/no-go"), false);
    assert.equal(form.includes("Begin the questionnaire"), false);
    assert.match(form, />\s*Next\s*</);
    assert.match(form, /Submit\s*</);
    assert.match(welcome, />\s*Start\s*</);
    assert.ok(field.includes("fontSize: 18"));
    assert.ok(field.includes("text-base"));
    assert.equal(/\bContinue\b/.test(form), false);
  });

  it("root redirects to /intake; thank-you is not a second public site", () => {
    const home = src("app/page.tsx");
    const thanks = src("app/success/page.tsx");
    const thanksById = src("app/success/[id]/page.tsx");
    const thankYou = src("components/form/ThankYouView.tsx");
    const submit = src("app/api/submit/route.ts");
    const makerHome = readFileSync(join(repo, "docs", "maker", "pages-look", "home.html"), "utf8");
    assert.match(home, /redirect\(\s*["']\/intake["']\s*\)/);
    assert.equal(home.includes("Scoping before the call"), false);
    assert.equal(home.includes("ScopeWarningBanner"), false);
    assert.equal(home.includes("assessor"), false);
    assert.ok(makerHome.includes("location.replace('/intake')"));
    assert.ok(makerHome.includes('url=/intake'));
    assert.equal(makerHome.includes("Scoping before the call"), false);
    assert.equal(home.includes("OSC Discovery"), false);
    assert.equal(thanks.includes("OSC Discovery"), false);
    assert.equal(thankYou.includes("OSC Discovery"), false);
    for (const phrase of BANNED) {
      assert.equal(home.includes(phrase), false);
      assert.equal(thanks.includes(phrase), false);
      assert.equal(thankYou.includes(phrase), false);
    }
    assert.equal(thankYou.includes("ScopeWarningBanner"), false);
    assert.equal(thankYou.includes("scoping call"), false);
    assert.equal(thankYou.includes("Map the CUI boundary"), false);
    assert.ok(thankYou.includes("We received your submission."));
    assert.ok(thankYou.includes("You are here"));
    assert.ok(thankYou.includes("assessors@example.com"));
    assert.equal(thanksById.includes("getSubmission"), false);
    assert.equal(thankYou.includes("getSubmission"), false);
    assert.ok(submit.includes("successPathForId"));
    assert.equal(submit.includes('redirect: "/success"'), false);
    assert.ok(src("lib/path.ts").includes('nav: "Interview roles"'));
    assert.equal(src("lib/path.ts").includes("People and devices"), false);
    assert.equal(src("components/form/IntakeForm.tsx").includes("People and devices"), false);
  });

  it("thank-you is a dedicated workflow, not the welcome home", () => {
    const pages = readFileSync(join(repo, "docs", "powerpages", "osc-discovery.html"), "utf8");
    const thankYou = src("components/form/ThankYouView.tsx");
    const doneAt = pages.indexOf('id="pscDone"');
    const introAt = pages.indexOf('id="pscIntro"');
    const formAt = pages.indexOf('id="pscForm"');
    assert.ok(doneAt > 0 && introAt > doneAt && formAt > introAt);
    const doneBlock = pages.slice(doneAt, introAt);
    const introBlock = pages.slice(introAt, formAt);
    const showSuccess = pages.slice(pages.indexOf("function showSuccess"), pages.indexOf("function render"));

    assert.ok(introBlock.includes("Map the CUI boundary before the assessment."));
    assert.ok(
      introBlock.includes(
        "This questionnaire describes the environment that will be assessed. Complete it to get the process started.",
      ),
    );
    assert.ok(introBlock.includes("Gets the process started"));
    assert.ok(
      introBlock.includes(
        "Leave and come back. Your answers kick off the engagement with the shape of the enclave already clear.",
      ),
    );
    assert.equal(introBlock.includes("scoping call"), false);
    assert.equal(introBlock.includes("Feeds the scoping"), false);
    assert.equal(introBlock.includes("About 15 to 20 minutes."), false);
    assert.equal(introBlock.includes("About 15 minutes."), false);
    assert.match(pages, /\.psc-intro\s*\{[^}]*text-align:\s*center/);
    assert.match(pages, /\.psc-intro h1\s*\{[^}]*text-align:\s*center/);
    assert.match(pages, /\.psc-welcome-lead\s*\{[^}]*text-align:\s*center/);
    assert.match(pages, /\.psc-welcome-cards li\s*\{[^}]*text-align:\s*left/);
    assert.match(pages, /\.psc-intro-actions\s*\{[^}]*justify-content:\s*center/);
    assert.ok(introBlock.includes("Scope, not a score"));
    assert.equal(introBlock.includes('id="pscDone"'), false);
    assert.equal(doneBlock.includes("Map the CUI boundary"), false);
    assert.equal(doneBlock.includes("Scope, not a score"), false);
    assert.equal(doneBlock.includes("High-level only"), false);
    assert.equal(doneBlock.includes("Feeds the scoping call"), false);
    assert.ok(pages.includes(".psc-intake.is-done #pscIntro"));
    assert.ok(showSuccess.includes('elIntro.style.display = "none"'));
    assert.ok(showSuccess.includes('elSteps.style.display = "none"'));
    assert.ok(pages.includes("clearDraft();"));
    assert.equal(pages.includes('window.location.href = "/thank-you"'), false);

    for (const copy of [
      "Thank you.",
      "We received your submission.",
      "Submission received",
      "You are here",
      "Box link — upload evidence",
      "Mock or certification assessment scheduled",
      "Evidence uploaded ~2 weeks before the assessment",
      "We notify the assessment team when you submit.",
      "assessors@example.com",
    ]) {
      assert.ok(doneBlock.includes(copy), copy);
      assert.ok(thankYou.includes(copy), copy);
    }
    assert.ok(doneBlock.includes("mailto:assessors@example.com"));
    assert.ok(thankYou.includes("mailto:${contact}"));

    assert.equal(doneBlock.includes("box.com"), false);
    assert.equal(doneBlock.includes("customerLink"), false);
    assert.equal(doneBlock.includes("CUID"), false);
    assert.equal(doneBlock.includes("go/no-go"), false);
    assert.equal(thankYou.includes("box.com"), false);
    assert.equal(thankYou.includes("customerLink"), false);
    assert.equal(thankYou.includes("CUID"), false);
    assert.equal(thankYou.includes("go/no-go"), false);
    assert.equal(thankYou.includes("Scope, not a score"), false);

    assert.ok(pages.includes("function withToken(cb)"));
    assert.ok(pages.includes('get("demo") === "1"'));
    assert.ok(pages.includes("function encodeChoice"));
    assert.ok(pages.includes("var mapErrors"));
  });

  it("Next submit may call the Worker server-side only; OSC thank-you stays public", () => {
    const submit = src("app/api/submit/route.ts");
    const form = src("components/form/IntakeForm.tsx");
    const thankYou = src("components/form/ThankYouView.tsx");
    const envExample = readFileSync(join(repo, ".env.example"), "utf8");
    const worker = src("lib/prescope-submit-worker.ts");

    assert.ok(submit.includes("forwardAnswersToSubmitWorker"));
    assert.ok(submit.includes("payload(recorded)"));
    assert.equal(submit.includes("drop.folderId"), false);
    assert.equal(submit.includes("PRESCOPE_SUBMIT_SECRET"), false);
    assert.ok(form.includes('fetch("/api/submit"'));
    assert.equal(form.includes("PRESCOPE_SUBMIT"), false);
    assert.equal(form.includes("workers.dev"), false);
    assert.equal(thankYou.includes("workers.dev"), false);
    assert.equal(thankYou.includes("folderId"), false);
    assert.equal(thankYou.includes("PRESCOPE_SUBMIT"), false);
    assert.match(envExample, /^PRESCOPE_SUBMIT_WORKER_URL=\s*$/m);
    assert.ok(envExample.includes("prescope-submit.<account>.workers.dev"));
    assert.ok(envExample.includes("PRESCOPE_SUBMIT_SECRET="));
    assert.equal(envExample.includes("NEXT_PUBLIC_PRESCOPE_SUBMIT"), false);
    assert.match(envExample, /^PRESCOPE_SUBMIT_SECRET=\s*$/m);
    assert.ok(worker.includes("Authorization"));
    assert.ok(worker.includes("Bearer"));
    assert.equal(worker.includes("NEXT_PUBLIC_"), false);
  });
});
