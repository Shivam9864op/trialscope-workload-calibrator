import { CATEGORIES, DEFAULT_PROJECT, analyzeProject, makeHandoff, makeId, scanBrief, validateProject } from "./core.mjs";

const STORAGE_KEY = "trialscope.project.v1";
const viewRoot = document.querySelector("#view-root");
const notice = document.querySelector("#notice");
const views = ["overview", "brief", "trial", "compare", "handoff"];
const clone = (value) => structuredClone(value);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const num = (value, places = 1) => Number(Number(value ?? 0).toFixed(places));
const fmt = (value, currency = "INR", digits = 0) => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(value || 0));
const hours = (value) => `${Number(value ?? 0).toFixed(1)} h`;
const categoryName = (id) => CATEGORIES.find(([value]) => value === id)?.[1] ?? "Other agreed work";

function initialState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && validateProject(saved.project).length === 0) return { project: saved.project, view: "overview", findings: scanBrief(saved.project.briefText), includeCategories: saved.includeCategories ?? CATEGORIES.map(([id]) => id), handoffText: saved.handoffText ?? "" };
  } catch { /* A corrupt local draft never prevents the sample from opening. */ }
  const project = clone(DEFAULT_PROJECT);
  return { project, view: "overview", findings: scanBrief(project.briefText), includeCategories: CATEGORIES.map(([id]) => id), handoffText: "" };
}

let state = initialState();
let noticeTimer;
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ project: state.project, includeCategories: state.includeCategories, handoffText: state.handoffText }));
    document.querySelector(".local-pill")?.setAttribute("aria-label", "Private project saved in this browser");
  } catch { showNotice("Browser storage is full. Export a backup before continuing.", true); }
}
function showNotice(message, isError = false) {
  notice.textContent = message;
  notice.hidden = false;
  notice.classList.toggle("error", isError);
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 3600);
}
function setView(view) {
  if (!views.includes(view)) return;
  state.view = view;
  render();
  viewRoot.focus({ preventScroll: true });
}
function render() {
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  const content = {
    overview: renderOverview,
    brief: renderBrief,
    trial: renderTrial,
    compare: renderCompare,
    handoff: renderHandoff
  }[state.view]();
  viewRoot.innerHTML = content;
  if (state.view === "handoff") syncHandoff();
}
function heading(kicker, title, sub, chip = "Synthetic sample") {
  return `<div class="view-header"><div><div class="view-kicker">${esc(kicker)}</div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div><span class="header-chip">${esc(chip)}</span></div>`;
}
function metric(label, value, sub, tone = "") {
  return `<article class="metric-card ${tone}"><i class="metric-accent"></i><div class="metric-label">${esc(label)}</div><div class="metric-value">${esc(value)}</div><div class="metric-sub">${esc(sub)}</div></article>`;
}
function categoryRows(items) {
  const max = Math.max(1, ...items.map((item) => item.hours));
  return items.length ? `<div class="category-list">${items.map((item) => `<div class="category-row"><div class="category-name" title="${esc(item.label)}">${esc(item.label)}</div><div class="bar-track" aria-label="${esc(item.label)}: ${item.hours.toFixed(1)} hours per week"><div class="bar-fill" style="width:${Math.max(4, item.hours / max * 100)}%"></div></div><div class="category-hours">${item.hours.toFixed(1)}h</div></div>`).join("")}</div>` : `<div class="empty-state">No recurring time is logged yet. Add trial entries to see a breakdown.</div>`;
}
function overviewInsights(a, p) {
  const lines = [];
  if (a.sampleWeeks === 0) lines.push("Mark a completed trial week as recorded to begin the calculation. Unmarked weeks are excluded.");
  if (a.sampleWeeks < 2) lines.push("Log a second full trial week before treating this as a recurring workload pattern.");
  if (a.oneOffHours > 0) lines.push(`${a.oneOffHours.toFixed(1)} one-off hours are kept out of the recurring weekly estimate.`);
  if (a.deliveryRate !== null && a.deliveryRate < 100) lines.push(`${a.plannedPosts - a.deliveredPosts} planned posts were not delivered in this sample. Record whether the cause was approval, missing material, or capacity before drawing a conclusion.`);
  if (a.effectiveRate !== null && a.effectiveRate < a.targetRate) lines.push(`At the entered fee, the observed effective rate is ${fmt(a.effectiveRate, p.currency)}/h, below the target you entered (${fmt(a.targetRate, p.currency)}/h). This is a calculation, not a market-rate judgement.`);
  if (!lines.length) lines.push("The logged recurring work currently fits within the entered weekly allowance. Keep reviewing the scope as more weeks are recorded.");
  return lines.map((line) => `<li>${esc(line)}</li>`).join("");
}
function renderOverview() {
  const p = state.project;
  const a = analyzeProject(p);
  const warning = a.status === "Needs scope alignment" ? "warn" : "good";
  return `<section class="view">${heading("Your project", p.title, "A quick read of the trial notes and the working arrangement. Nothing here predicts results; it shows what has been logged so far.", `${a.sampleWeeks} recorded / ${p.trialWeeks.length} trial weeks`)}
    <div class="metric-grid">${metric("Recurring work / week", a.sampleWeeks ? hours(a.medianRecurringHoursPerWeek) : "Not logged", a.sampleWeeks ? `Observed range ${hours(a.minObservedHoursPerWeek)}–${hours(a.maxObservedHoursPerWeek)}` : "Mark a completed week as recorded")}${metric("Weekly allowance", hours(p.allocatedHoursPerWeek), a.sampleWeeks ? `${a.utilization ?? "—"}% of allowance at median` : "No recorded sample yet", warning)}${metric("One-off setup", hours(a.oneOffHours), "Kept separate from recurring work")}${metric("Effective rate in sample", a.effectiveRate === null ? "Unavailable" : fmt(a.effectiveRate, p.currency), `Entered target: ${fmt(p.targetHourlyRate, p.currency)}/h`, a.effectiveRate !== null && a.effectiveRate < a.targetRate ? "warn" : "")}</div>
    <div class="panel-grid"><article class="card status-card"><div class="status-top"><span>Current read</span><span class="status-badge">${esc(a.status)}</span></div><h3>${a.workloadGap === "Needs alignment" ? "The trial took more recurring time than the weekly allowance." : "Review the hours, fee, and evidence together."}</h3><p>${a.sampleWeeks} trial weeks are included. Recurring work uses the median weekly hours; one-off onboarding and setup are excluded. The sample is too small to call this a long-term forecast.</p><button class="status-action" type="button" data-view="compare">Open the comparison <span aria-hidden="true">→</span></button></article>
    <article class="card"><h3>Where the recurring time went</h3><p class="card-intro">Average weekly time from the entries you logged. This is a record, not a recommended task mix.</p>${categoryRows(a.categoryHours)}</article></div>
    <div class="panel-grid"><article class="card"><div class="split-label"><div><h3>What this sample says</h3><p class="card-intro">Use the facts to start a conversation, not to assign blame.</p></div><span class="rule-badge"><b>Rule-based</b> · transparent math</span></div><ul class="plain-list">${overviewInsights(a, p)}</ul></article><article class="card"><h3>Next, make it useful</h3><p class="card-intro">Move through the evidence in order. You can edit the draft before sharing it.</p><ol class="plain-list"><li>Check which responsibilities appeared in the brief.</li><li>Log recurring and one-off time from the trial.</li><li>Compare observed work with hours, fee, and delivery.</li><li>Prepare a neutral scope-alignment note.</li></ol><div class="callout info">Sample numbers are fictional. Replace them with verified records before using the export with a client.</div></article></div>
  </section>`;
}
function renderBrief() {
  const p = state.project;
  const findings = state.findings ?? [];
  const findingsHtml = findings.length ? findings.map((item) => `<div class="finding"><div class="finding-icon" aria-hidden="true">✓</div><div><strong>${esc(item.label)}</strong><q>${esc(item.quote)}</q></div></div>`).join("") : `<div class="empty-state">No matches yet. Try the sample brief or add clearer deliverables, calls, reporting, community work, revisions or scheduling terms.</div>`;
  return `<section class="view">${heading("Step 02 · Brief check", "What did the client ask for?", "Paste the role note or trial brief and check the wording before you compare it with the work. The scanner uses simple local phrase rules; verify every match yourself.", "No upload · Browser only")}
    <div class="brief-layout"><article class="card"><h3>Project basics</h3><p class="card-intro">These values are the reference point for the trial review.</p><div class="form-grid"><div class="field full"><label for="project-title">Project name</label><input id="project-title" data-project-field="title" value="${esc(p.title)}" maxlength="90"></div><div class="field full"><label for="client-name">Client label</label><input id="client-name" data-project-field="client" value="${esc(p.client)}" maxlength="90"></div><div class="field"><label for="allocated-hours">Hours discussed per week</label><input id="allocated-hours" type="number" min="0" step="0.25" data-project-field="allocatedHoursPerWeek" value="${esc(p.allocatedHoursPerWeek)}"></div><div class="field"><label for="monthly-fee">Proposed monthly fee</label><input id="monthly-fee" type="number" min="0" step="100" data-project-field="proposedMonthlyFee" value="${esc(p.proposedMonthlyFee)}"></div><div class="field"><label for="target-rate">Your target hourly floor</label><input id="target-rate" type="number" min="0" step="10" data-project-field="targetHourlyRate" value="${esc(p.targetHourlyRate)}"><small>Enter your own target; this tool does not recommend a market rate.</small></div><div class="field"><label for="currency">Currency</label><select id="currency" data-project-field="currency"><option value="INR" ${p.currency === "INR" ? "selected" : ""}>INR · ₹</option><option value="USD" ${p.currency === "USD" ? "selected" : ""}>USD · $</option><option value="GBP" ${p.currency === "GBP" ? "selected" : ""}>GBP · £</option><option value="EUR" ${p.currency === "EUR" ? "selected" : ""}>EUR · €</option></select></div></div></article>
    <article class="card"><div class="split-label"><div><h3>Brief, role post, or email</h3><p class="card-intro">Keep only information you are allowed to use. Avoid secrets and private client data.</p></div><span class="rule-badge">Local text matching</span></div><textarea class="plain-textarea" id="brief-text" maxlength="12000" aria-label="Paste client brief">${esc(p.briefText)}</textarea><div class="handoff-actions"><button class="button button-primary" type="button" data-action="scan-brief">Check the wording</button><span class="field-hint">Nothing is sent to a server or model.</span></div><div class="scan-findings" id="scan-findings" style="margin-top:13px">${findingsHtml}</div></article></div>
    <div class="panel-grid"><article class="card"><h3>Success needs you can verify</h3><p class="card-intro">One goal per line. Keep it observable and under your control.</p><textarea class="plain-textarea" id="goals-text" aria-label="Project goals">${esc((p.goals ?? []).join("\n"))}</textarea></article><article class="card"><h3>Out of scope or not yet agreed</h3><p class="card-intro">Write exclusions to clarify, not as legal terms.</p><textarea class="plain-textarea" id="exclusions-text" aria-label="Items to clarify">${esc((p.exclusions ?? []).join("\n"))}</textarea></article></div>
    <div class="callout info"><strong>How the brief check works:</strong> it highlights exact lines matching a short set of terms. It does not understand intent, determine contract meaning, or decide whether a task is included.</div>
  </section>`;
}
function renderTrial() {
  const p = state.project;
  const a = analyzeProject(p);
  const entries = [...p.entries].sort((left, right) => p.trialWeeks.findIndex((w) => w.id === right.weekId) - p.trialWeeks.findIndex((w) => w.id === left.weekId));
  const weekCards = p.trialWeeks.map((week, index) => `<div class="week-card"><div class="week-name"><strong>${esc(week.label || `Trial week ${index + 1}`)}</strong><small>${esc(week.date)}</small><label class="week-record-toggle"><input type="checkbox" data-week-field="recorded" data-week-id="${esc(week.id)}" ${week.recorded !== false ? "checked" : ""}> Count in analysis</label></div><div class="field"><label for="planned-${esc(week.id)}">Posts planned</label><input id="planned-${esc(week.id)}" type="number" min="0" step="1" data-week-field="plannedPosts" data-week-id="${esc(week.id)}" value="${week.plannedPosts}"></div><div class="field"><label for="delivered-${esc(week.id)}">Posts delivered</label><input id="delivered-${esc(week.id)}" type="number" min="0" step="1" data-week-field="deliveredPosts" data-week-id="${esc(week.id)}" value="${week.deliveredPosts}"></div><div class="field"><label for="date-${esc(week.id)}">Week starting</label><input id="date-${esc(week.id)}" type="date" data-week-field="date" data-week-id="${esc(week.id)}" value="${esc(week.date)}"></div></div>`).join("");
  const list = entries.length ? entries.map((entry) => `<div class="entry-row"><div class="entry-work"><strong>${esc(categoryName(entry.category))}</strong><small>${esc(entry.note || "No note")}</small></div><div class="entry-kind">${entry.kind === "one_off" ? "One-off" : "Recurring"}</div><div class="entry-week">${esc(p.trialWeeks.find((week) => week.id === entry.weekId)?.label ?? "Unknown week")}</div><div class="entry-hours">${Number(entry.hours).toFixed(1)} h</div><button type="button" class="icon-button" data-action="delete-entry" data-id="${esc(entry.id)}" aria-label="Delete ${esc(categoryName(entry.category))} entry">×</button></div>`).join("") : `<div class="empty-state">No time entries yet. Add what the trial actually took.</div>`;
  return `<section class="view">${heading("Step 03 · Trial log", "Record the work, not just the deliverables", "Track the less-visible work too: research, revisions, calls, replies, and one-time setup. Use your actual notes; avoid rounding everything down to fit a limit.", `${p.trialWeeks.length} trial week${p.trialWeeks.length === 1 ? "" : "s"}`)}
    <article class="card"><div class="split-label"><div><h3>Trial weeks and output</h3><p class="card-intro">Posts are just one sample measure. Add another paid trial week if the sample is too small.</p></div><button type="button" class="button button-quiet" data-action="add-week">+ Add week</button></div><div class="week-list">${weekCards}</div></article>
    <article class="card" style="margin-top:14px"><h3>Log a work block</h3><p class="card-intro">Choose recurring if you expect it to continue each week. Choose one-off for onboarding, setup, or an isolated launch task.</p><form class="entry-form" id="entry-form"><div class="field"><label for="entry-category">Work type</label><select id="entry-category" name="category">${CATEGORIES.map(([id, label]) => `<option value="${id}">${esc(label)}</option>`).join("")}</select></div><div class="field"><label for="entry-note">What happened?</label><input id="entry-note" name="note" maxlength="120" placeholder="e.g. revision after feedback"></div><div class="field"><label for="entry-week">Trial week</label><select id="entry-week" name="weekId">${p.trialWeeks.map((week) => `<option value="${esc(week.id)}">${esc(week.label)}</option>`).join("")}</select></div><div class="field"><label for="entry-hours">Hours</label><input id="entry-hours" name="hours" type="number" min="0.05" max="100" step="0.05" value="0.5" required></div><div class="field"><label for="entry-kind">Type</label><select id="entry-kind" name="kind"><option value="recurring">Recurring</option><option value="one_off">One-off</option></select></div><button class="button button-primary" type="submit">Add entry</button></form><div class="entry-list" id="entry-list">${list}</div></article>
    <div class="callout"><strong>Current observation:</strong> ${a.sampleWeeks ? `${hours(a.medianRecurringHoursPerWeek)} median recurring work/week, with ${hours(a.oneOffHours)} of one-off setup across recorded weeks.` : "No weeks are marked as recorded yet. Unmarked weeks do not affect the calculation."} Median is used to reduce the influence of one unusually busy week; a short sample is still only an early signal.</div>
  </section>`;
}
function renderCompare() {
  const p = state.project;
  const a = analyzeProject(p);
  const max = Math.max(1, a.maxObservedHoursPerWeek, Number(p.allocatedHoursPerWeek));
  const bars = a.weeks.filter((week) => week.recorded).map((week) => `<div class="week-bar-row"><span>${esc(week.label)}</span><div class="week-bar-rail" aria-label="${esc(week.label)} recurring ${week.recurringHours} hours, one-off ${week.oneOffHours} hours"><i style="width:${Math.min(100, week.recurringHours / max * 100)}%"></i></div><strong>${week.recurringHours.toFixed(1)}h</strong></div><div class="week-bar-row oneoff-rail"><span class="field-hint">+ one-off</span><div class="week-bar-rail"><i style="width:${Math.min(100, week.oneOffHours / max * 100)}%"></i></div><strong>${week.oneOffHours.toFixed(1)}h</strong></div>`).join("");
  const volumeRows = a.weeks.filter((week) => week.recorded).map((week) => `<div class="week-bar-row"><span>${esc(week.label)}</span><div class="week-bar-rail"><i style="width:${week.plannedPosts ? Math.min(100, week.deliveredPosts / week.plannedPosts * 100) : 0}%"></i></div><strong>${week.deliveredPosts}/${week.plannedPosts}</strong></div>`).join("");
  const badgeClass = a.workloadGap === "Within allowance" ? "green" : "";
  return `<section class="view">${heading("Step 04 · Compare", "Hours, fee, and output in one view", "This screen uses logged work only. A missed post is not automatically a capacity issue: confirm if it was waiting on assets, feedback, or another dependency.", a.status)}
    <div class="compare-cols"><article class="card"><h3>Workload against the weekly allowance</h3><p class="card-intro">Each bar shows recurring logged work. Amber rows show one-off tasks and are not added to the ongoing estimate.</p><div class="week-bars">${bars || `<div class="empty-state">Log work in at least one trial week to compare.</div>`}</div><div class="legend"><span><i></i>Recurring work</span><span><i class="oneoff-key"></i>One-off work</span></div><div class="gap-marker ${badgeClass}"><strong>${esc(a.workloadGap)} · ${a.utilization ?? "—"}% used</strong><span>Median ${hours(a.medianRecurringHoursPerWeek)} observed versus ${hours(p.allocatedHoursPerWeek)} discussed. Compare the task mix and agree what changes.</span></div></article>
    <article class="card"><h3>Sample delivery</h3><p class="card-intro">Planned vs completed posts in the logged trial. This does not measure reach, engagement, or business impact.</p><div class="week-bars">${volumeRows || `<div class="empty-state">Add trial weeks and sample output counts.</div>`}</div><div class="stat-pair" style="margin-top:15px"><div class="stat-mini"><small>Delivered in sample</small><strong>${a.deliveredPosts} / ${a.plannedPosts}</strong></div><div class="stat-mini"><small>Completion count</small><strong>${a.deliveryRate === null ? "Unavailable" : `${a.deliveryRate}%`}</strong></div></div><div class="callout info">No attribution is inferred. Posts alone do not show what caused results for the account.</div></article></div>
    <div class="panel-grid"><article class="card"><h3>Effective rate from the entered fee</h3><p class="card-intro">Monthly fee ÷ (median recurring weekly hours × 4.33). One-off setup is not included.</p><div class="stat-pair"><div class="stat-mini"><small>At entered fee</small><strong>${a.effectiveRate === null ? "Unavailable" : `${fmt(a.effectiveRate, p.currency)}/h`}</strong></div><div class="stat-mini"><small>Your entered target</small><strong>${fmt(p.targetHourlyRate, p.currency)}/h</strong></div></div><div class="callout ${a.effectiveRate !== null && a.effectiveRate < a.targetRate ? "danger" : "info"}">At the entered target, the median observed workload corresponds to ${fmt(a.fairMonthlyAtTarget, p.currency)}/month. This is arithmetic based on your input, not a rate recommendation or promise.</div></article><article class="card"><h3>Work by category</h3><p class="card-intro">Average recurring hours per week, sorted largest first.</p>${categoryRows(a.categoryHours)}</article></div>
  </section>`;
}
function renderHandoff() {
  const p = state.project;
  return `<section class="view">${heading("Step 05 · Client handoff", "Turn the review into a calm conversation", "Choose which work to discuss, then edit the note. TrialScope does not send anything to your client.", "Editable · not legal advice")}
    <div class="two-col"><article class="card"><h3>Work to include in the discussion</h3><p class="card-intro">These are talking points from the trial log. Selecting a category does not decide it belongs in a contract.</p><div class="check-list">${CATEGORIES.map(([id, label]) => `<label class="check-item"><input type="checkbox" data-include-category="${id}" ${state.includeCategories.includes(id) ? "checked" : ""}><span>${esc(label)}</span></label>`).join("")}</div><div class="callout info">Confirm responsibilities, revision limits, response times, supplied materials, and payment terms with the client. This tool is not a contract generator.</div></article>
    <article class="card"><h3>Your discussion notes</h3><p class="card-intro">These goals and exclusions appear in the draft. Edit them in Brief check if needed.</p><div class="field"><label for="handoff-goals">Goals</label><textarea id="handoff-goals" class="plain-textarea">${esc((p.goals ?? []).join("\n"))}</textarea></div><div class="field" style="margin-top:11px"><label for="handoff-exclusions">Exclusions / items to confirm</label><textarea id="handoff-exclusions" class="plain-textarea">${esc((p.exclusions ?? []).join("\n"))}</textarea></div></article></div>
    <article class="card" style="margin-top:15px"><div class="split-label"><div><h3>Scope alignment note</h3><p class="card-intro">Edit for accuracy and tone before you copy or export. Replace the synthetic sample with verified information first.</p></div><span class="rule-badge"><b>Private</b> · no auto-send</span></div><textarea class="handoff-preview" id="handoff-preview" aria-label="Editable scope alignment note"></textarea><div class="handoff-actions"><button type="button" class="button button-primary" data-action="copy-handoff">Copy note</button><button type="button" class="button button-quiet" data-action="download-handoff">Download Markdown</button><button type="button" class="button button-quiet" data-action="print-handoff">Print / save as PDF</button></div></article>
  </section>`;
}
function syncHandoff() {
  const textarea = document.querySelector("#handoff-preview");
  if (!textarea) return;
  const p = state.project;
  const included = state.includeCategories.map(categoryName);
  if (!state.handoffText) state.handoffText = makeHandoff(p, analyzeProject(p), included);
  textarea.value = state.handoffText;
}
function lineList(text) { return String(text ?? "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 40); }
function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function updateProjectField(element) {
  const key = element.dataset.projectField;
  let value = element.value;
  if (["allocatedHoursPerWeek", "proposedMonthlyFee", "targetHourlyRate"].includes(key)) value = Math.max(0, Number(value || 0));
  state.project[key] = value;
  state.handoffText = "";
  persist();
}
function updateWeekField(element) {
  const week = state.project.trialWeeks.find((item) => item.id === element.dataset.weekId);
  if (!week) return;
  const key = element.dataset.weekField;
  week[key] = key === "recorded" ? element.checked : ["plannedPosts", "deliveredPosts"].includes(key) ? Math.max(0, Math.floor(Number(element.value || 0))) : element.value;
  state.handoffText = "";
  persist();
}
function resetSample() {
  state = { project: clone(DEFAULT_PROJECT), view: "overview", findings: scanBrief(DEFAULT_PROJECT.briefText), includeCategories: CATEGORIES.map(([id]) => id), handoffText: "" };
  persist(); render(); showNotice("The synthetic café sample has been restored.");
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) { event.preventDefault(); setView(viewButton.dataset.view); return; }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  switch (button.dataset.action) {
    case "scan-brief":
      state.findings = scanBrief(state.project.briefText);
      persist(); render(); showNotice(`${state.findings.length} possible requirement${state.findings.length === 1 ? "" : "s"} found. Check each highlighted line yourself.`); break;
    case "add-week": {
      const number = state.project.trialWeeks.length + 1;
      const date = new Date(); date.setDate(date.getDate() - date.getDay() + 1 + (number - 1) * 7);
      state.project.trialWeeks.push({ id: makeId("week"), label: `Trial week ${number}`, date: date.toISOString().slice(0, 10), plannedPosts: 0, deliveredPosts: 0 });
      state.handoffText = ""; persist(); render(); showNotice("A blank trial week was added."); break;
    }
    case "delete-entry":
      state.project.entries = state.project.entries.filter((entry) => entry.id !== button.dataset.id);
      state.handoffText = ""; persist(); render(); showNotice("Trial entry removed."); break;
    case "export-project":
      download("trialscope-project.json", JSON.stringify({ project: state.project, includeCategories: state.includeCategories, handoffText: state.handoffText }, null, 2), "application/json");
      showNotice("Project backup downloaded. It contains only the data in this browser."); break;
    case "copy-handoff":
      navigator.clipboard?.writeText(document.querySelector("#handoff-preview")?.value ?? "").then(() => showNotice("Handoff note copied to the clipboard.")).catch(() => showNotice("Copy was blocked by the browser. Select the text and copy it manually.", true)); break;
    case "download-handoff":
      download("trialscope-scope-alignment.md", document.querySelector("#handoff-preview")?.value ?? "", "text/markdown;charset=utf-8"); showNotice("Editable Markdown note downloaded."); break;
    case "print-handoff":
      window.print(); break;
    case "reset-demo": {
      const dialog = document.querySelector("#confirm-dialog");
      if (dialog?.showModal) {
        dialog.showModal();
        dialog.addEventListener("close", () => { if (dialog.returnValue === "confirm") resetSample(); }, { once: true });
      } else if (confirm("Restore the synthetic sample and replace the current local project?")) resetSample();
      break;
    }
  }
});

document.addEventListener("input", (event) => {
  const element = event.target;
  if (element.matches("[data-project-field]")) { updateProjectField(element); return; }
  if (element.matches("[data-week-field]")) { updateWeekField(element); return; }
  if (element.id === "brief-text") { state.project.briefText = element.value; state.findings = scanBrief(element.value); state.handoffText = ""; persist(); return; }
  if (element.id === "goals-text") { state.project.goals = lineList(element.value); state.handoffText = ""; persist(); return; }
  if (element.id === "exclusions-text") { state.project.exclusions = lineList(element.value); state.handoffText = ""; persist(); return; }
  if (element.id === "handoff-goals") { state.project.goals = lineList(element.value); state.handoffText = ""; persist(); if (document.querySelector("#handoff-preview")) document.querySelector("#handoff-preview").value = makeHandoff(state.project, analyzeProject(state.project), state.includeCategories.map(categoryName)); return; }
  if (element.id === "handoff-exclusions") { state.project.exclusions = lineList(element.value); state.handoffText = ""; persist(); if (document.querySelector("#handoff-preview")) document.querySelector("#handoff-preview").value = makeHandoff(state.project, analyzeProject(state.project), state.includeCategories.map(categoryName)); return; }
  if (element.id === "handoff-preview") { state.handoffText = element.value; persist(); return; }
});

document.addEventListener("change", (event) => {
  const element = event.target;
  if (element.matches("[data-include-category]")) {
    const id = element.dataset.includeCategory;
    state.includeCategories = element.checked ? [...new Set([...state.includeCategories, id])] : state.includeCategories.filter((value) => value !== id);
    state.handoffText = ""; persist();
    const text = document.querySelector("#handoff-preview"); if (text) text.value = makeHandoff(state.project, analyzeProject(state.project), state.includeCategories.map(categoryName));
  }
  if (element.id === "project-import") importProjectFile(element.files?.[0]);
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "entry-form") return;
  event.preventDefault();
  const values = new FormData(event.target);
  const entry = { id: makeId("entry"), category: String(values.get("category")), note: String(values.get("note") ?? "").trim(), weekId: String(values.get("weekId")), hours: Number(values.get("hours")), kind: String(values.get("kind")) };
  if (!Number.isFinite(entry.hours) || entry.hours <= 0 || entry.hours > 100) { showNotice("Enter a time amount from 0.05 to 100 hours.", true); return; }
  state.project.entries.push(entry); state.handoffText = ""; persist(); render(); showNotice("Work block added and saved in this browser.");
});

async function importProjectFile(file) {
  if (!file) return;
  try {
    if (file.size > 500_000) throw new Error("Project backup is too large (maximum 500 KB).");
    const payload = JSON.parse(await file.text());
    const project = payload.project ?? payload;
    const errors = validateProject(project);
    if (errors.length) throw new Error(`Backup is not valid: ${errors.slice(0, 3).join(" ")}`);
    if (project.entries.length > 500 || project.trialWeeks.length > 52) throw new Error("Backup has too many entries or weeks.");
    state.project = project;
    state.includeCategories = Array.isArray(payload.includeCategories) ? payload.includeCategories.filter((id) => CATEGORIES.some(([category]) => category === id)) : CATEGORIES.map(([id]) => id);
    state.handoffText = typeof payload.handoffText === "string" ? payload.handoffText.slice(0, 30_000) : "";
    state.findings = scanBrief(project.briefText ?? "");
    persist(); render(); showNotice("Project backup imported. The previous draft was replaced only after validation.");
  } catch (error) { showNotice(error.message || "Could not import this file. The current project is unchanged.", true); }
  finally { document.querySelector("#project-import").value = ""; }
}

render();
