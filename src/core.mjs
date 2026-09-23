export const CATEGORIES = [
  ["planning", "Planning & strategy"],
  ["research", "Research & ideas"],
  ["writing", "Captions & copy"],
  ["content_prep", "Content preparation"],
  ["scheduling", "Scheduling & publishing"],
  ["community", "Community replies"],
  ["approvals", "Review & revisions"],
  ["meetings", "Calls & coordination"],
  ["reporting", "Reporting & analysis"],
  ["other", "Other agreed work"]
];

export const DEFAULT_PROJECT = {
  version: 1,
  title: "Northstar Café — launch support",
  client: "Northstar Café (fictional sample)",
  currency: "INR",
  allocatedHoursPerWeek: 6,
  proposedMonthlyFee: 15000,
  targetHourlyRate: 850,
  trialWeeks: [
    { id: "week-1", label: "Trial week 1", date: "2026-09-07", plannedPosts: 4, deliveredPosts: 3, recorded: true },
    { id: "week-2", label: "Trial week 2", date: "2026-09-14", plannedPosts: 4, deliveredPosts: 4, recorded: true }
  ],
  entries: [
    { id: "e-01", weekId: "week-1", category: "planning", kind: "recurring", hours: 0.9, note: "Weekly content plan" },
    { id: "e-02", weekId: "week-1", category: "research", kind: "recurring", hours: 1.2, note: "Local offer and topic research" },
    { id: "e-03", weekId: "week-1", category: "writing", kind: "recurring", hours: 1.8, note: "Caption drafts and hooks" },
    { id: "e-04", weekId: "week-1", category: "content_prep", kind: "recurring", hours: 1.4, note: "Prepare supplied photos for posts" },
    { id: "e-05", weekId: "week-1", category: "scheduling", kind: "recurring", hours: 0.7, note: "Schedule approved posts" },
    { id: "e-06", weekId: "week-1", category: "community", kind: "recurring", hours: 0.6, note: "Reply to comments" },
    { id: "e-07", weekId: "week-1", category: "approvals", kind: "recurring", hours: 0.7, note: "One revision round and approval follow-up" },
    { id: "e-08", weekId: "week-1", category: "meetings", kind: "recurring", hours: 0.4, note: "Weekly check-in" },
    { id: "e-09", weekId: "week-1", category: "other", kind: "one_off", hours: 1.8, note: "Account and brand onboarding" },
    { id: "e-10", weekId: "week-2", category: "planning", kind: "recurring", hours: 0.8, note: "Weekly content plan" },
    { id: "e-11", weekId: "week-2", category: "research", kind: "recurring", hours: 1.0, note: "Local event and offer research" },
    { id: "e-12", weekId: "week-2", category: "writing", kind: "recurring", hours: 2.0, note: "Caption drafts and hooks" },
    { id: "e-13", weekId: "week-2", category: "content_prep", kind: "recurring", hours: 1.5, note: "Prepare supplied photos for posts" },
    { id: "e-14", weekId: "week-2", category: "scheduling", kind: "recurring", hours: 0.8, note: "Schedule approved posts" },
    { id: "e-15", weekId: "week-2", category: "community", kind: "recurring", hours: 0.8, note: "Reply to comments" },
    { id: "e-16", weekId: "week-2", category: "approvals", kind: "recurring", hours: 0.8, note: "Revision and approval follow-up" },
    { id: "e-17", weekId: "week-2", category: "meetings", kind: "recurring", hours: 0.5, note: "Weekly check-in" },
    { id: "e-18", weekId: "week-2", category: "reporting", kind: "one_off", hours: 0.8, note: "Set up launch reporting sheet" }
  ],
  briefText: "4 posts per week across Instagram\nResearch reels and local topics\nWeekly client check-in\nReply to comments during business hours\nOne revision round per post\nMonthly performance summary",
  goals: ["Keep social support at a predictable weekly capacity", "Confirm who supplies final photos and offer details"],
  exclusions: ["Paid ads and ad budget management", "Filming or advanced video editing", "Same-day urgent requests"]
};

const finiteNonNegative = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
const sum = (values) => values.reduce((total, value) => total + value, 0);
const round = (value, places = 1) => Number(Number(value).toFixed(places));

export function median(values) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function validateProject(project) {
  const errors = [];
  if (!project || typeof project !== "object") return ["Project must be an object."];
  if (!Array.isArray(project.trialWeeks) || !project.trialWeeks.length) errors.push("Add at least one trial week.");
  if (!Array.isArray(project.entries)) errors.push("Work entries must be a list.");
  if (!Array.isArray(project.goals) || !Array.isArray(project.exclusions)) errors.push("Goals and exclusions must be lists of text.");
  if (!Array.isArray(project.goals) || project.goals.some((item) => typeof item !== "string" || item.length > 500)) errors.push("Each goal must be text no longer than 500 characters.");
  if (!Array.isArray(project.exclusions) || project.exclusions.some((item) => typeof item !== "string" || item.length > 500)) errors.push("Each exclusion must be text no longer than 500 characters.");
  if (typeof project.title !== "string" || project.title.length > 90 || typeof project.client !== "string" || project.client.length > 90) errors.push("Project and client labels must be text under 90 characters.");
  if (typeof project.briefText !== "string" || project.briefText.length > 12000) errors.push("Brief text must be text under 12,000 characters.");
  if (!["INR", "USD", "GBP", "EUR"].includes(project.currency)) errors.push("Choose a supported currency.");
  if (!finiteNonNegative(project.allocatedHoursPerWeek)) errors.push("Weekly hour allowance must be zero or more.");
  if (!finiteNonNegative(project.proposedMonthlyFee)) errors.push("Monthly fee must be zero or more.");
  const allWeekIds = (project.trialWeeks ?? []).map((week) => week.id);
  const weekIds = new Set(allWeekIds);
  if (weekIds.size !== allWeekIds.length) errors.push("Trial week IDs must be unique.");
  for (const entry of project.entries ?? []) {
    if (!weekIds.has(entry.weekId)) errors.push(`Entry ${entry.id ?? "(unnamed)"} refers to a missing trial week.`);
    if (!CATEGORIES.some(([id]) => id === entry.category)) errors.push(`Entry ${entry.id ?? "(unnamed)"} has an unknown work category.`);
    if (!["recurring", "one_off"].includes(entry.kind)) errors.push(`Entry ${entry.id ?? "(unnamed)"} has an unknown work type.`);
    if (!finiteNonNegative(entry.hours)) errors.push(`Entry ${entry.id ?? "(unnamed)"} needs a valid non-negative duration.`);
  }
  for (const week of project.trialWeeks ?? []) {
    if (!week.id || !Number.isFinite(Date.parse(week.date))) errors.push("Each trial week needs an ID and valid date.");
    if (!Number.isInteger(week.plannedPosts) || week.plannedPosts < 0 || !Number.isInteger(week.deliveredPosts) || week.deliveredPosts < 0) errors.push(`Post counts for ${week.label ?? week.id} must be whole numbers of zero or more.`);
  }
  return errors;
}

export function analyzeProject(project) {
  const errors = validateProject(project);
  if (errors.length) return { valid: false, errors };
  const weeks = project.trialWeeks.map((week) => {
    const entries = project.entries.filter((entry) => entry.weekId === week.id);
    return {
      ...week,
      recorded: week.recorded !== false,
      recurringHours: round(sum(entries.filter((entry) => entry.kind === "recurring").map((entry) => Number(entry.hours))), 2),
      oneOffHours: round(sum(entries.filter((entry) => entry.kind === "one_off").map((entry) => Number(entry.hours))), 2),
      loggedHours: round(sum(entries.map((entry) => Number(entry.hours))), 2)
    };
  });
  const recordedWeeks = weeks.filter((week) => week.recorded);
  const observed = recordedWeeks.map((week) => week.recurringHours);
  const medianHours = median(observed) ?? 0;
  const oneOffHours = round(sum(recordedWeeks.map((week) => week.oneOffHours)), 2);
  const delivered = sum(recordedWeeks.map((week) => week.deliveredPosts));
  const planned = sum(recordedWeeks.map((week) => week.plannedPosts));
  const allocated = Number(project.allocatedHoursPerWeek);
  const utilization = allocated > 0 ? round((medianHours / allocated) * 100, 0) : null;
  const monthlyObservedHours = medianHours * 4.33;
  const effectiveRate = monthlyObservedHours > 0 ? round(Number(project.proposedMonthlyFee) / monthlyObservedHours, 0) : null;
  const sampleWeeks = recordedWeeks.length;
  let evidence = "Early signal";
  if (sampleWeeks >= 4 && recordedWeeks.every((week) => project.entries.some((entry) => entry.weekId === week.id && entry.kind === "recurring"))) evidence = "More stable sample";
  else if (sampleWeeks >= 3) evidence = "Developing sample";
  const workloadGap = allocated === 0 ? "No hours agreed" : medianHours > allocated * 1.1 ? "Needs alignment" : medianHours > allocated ? "Close to limit" : "Within allowance";
  const status = sampleWeeks < 2 ? "Need more evidence" : workloadGap === "Needs alignment" ? "Needs scope alignment" : "Review the rate and scope";
  const categoryHours = CATEGORIES.map(([id, label]) => ({
    id,
    label,
    hours: sampleWeeks ? round(sum(project.entries.filter((entry) => entry.kind === "recurring" && entry.category === id && recordedWeeks.some((week) => week.id === entry.weekId)).map((entry) => Number(entry.hours))) / sampleWeeks, 2) : 0
  })).filter((item) => item.hours > 0).sort((a, b) => b.hours - a.hours);
  return {
    valid: true,
    weeks,
    sampleWeeks,
    evidence,
    medianRecurringHoursPerWeek: round(medianHours, 2),
    minObservedHoursPerWeek: observed.length ? Math.min(...observed) : null,
    maxObservedHoursPerWeek: observed.length ? Math.max(...observed) : null,
    oneOffHours,
    deliveredPosts: delivered,
    plannedPosts: planned,
    deliveryRate: planned > 0 ? round((delivered / planned) * 100, 0) : null,
    utilization,
    effectiveRate,
    targetRate: Number(project.targetHourlyRate),
    workloadGap,
    status,
    categoryHours,
    monthlyObservedHours: round(monthlyObservedHours, 1),
    fairMonthlyAtTarget: round(monthlyObservedHours * Number(project.targetHourlyRate), 0),
    allocatedMonthlyAtTarget: round(allocated * 4.33 * Number(project.targetHourlyRate), 0)
  };
}

const requirementPatterns = [
  ["posts", /\b(\d+)\s*(?:posts?|feed posts?)\b/gi, "posts"],
  ["reels_research", /\b(?:research|ideate|plan)\w*\s+(?:reels|trends|topics)\b/gi, "research / ideation"],
  ["meetings", /\b(?:weekly|daily|monthly)?\s*(?:calls?|meetings?|check-ins?)\b/gi, "calls / coordination"],
  ["community", /\b(?:reply|respond|manage|monitor)\w*\s+(?:to\s+)?(?:comments?|messages?|community|inbox)\b/gi, "community work"],
  ["revisions", /\b(?:\d+\s+)?revision\s+rounds?\b/gi, "revision rounds"],
  ["reporting", /\b(?:monthly|weekly)?\s*(?:performance\s+)?(?:reports?|analytics|reporting|analysis)\b/gi, "reporting / analysis"],
  ["event_work", /\b(?:event attendance|attend events?|on-site coverage|content capture)\b/gi, "event / on-site work"],
  ["scheduling", /\b(?:schedule|publish|posting calendar)\w*\b/gi, "scheduling / publishing"],
  ["ads", /\b(?:paid ads?|ad budget|campaign spend|boost(?:ed)? posts?)\b/gi, "paid advertising"]
];

export function scanBrief(text) {
  const source = String(text ?? "").slice(0, 12000);
  const findings = [];
  for (const [id, pattern, label] of requirementPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source))) {
      const start = source.lastIndexOf("\n", match.index) + 1;
      let end = source.indexOf("\n", match.index);
      if (end < 0) end = source.length;
      const quote = source.slice(start, end).trim();
      if (!findings.some((item) => item.quote === quote && item.type === id)) findings.push({ id: `${id}-${findings.length + 1}`, type: id, label, quote });
      if (!match[0].length) pattern.lastIndex++;
    }
  }
  return findings.sort((a, b) => a.quote.localeCompare(b.quote) || a.type.localeCompare(b.type));
}

export function makeHandoff(project, analysis, include) {
  const list = (items) => items.map((item) => `- ${item}`).join("\n") || "- None listed";
  const statusLine = analysis.status;
  const range = analysis.sampleWeeks ? `${analysis.minObservedHoursPerWeek.toFixed(1)}–${analysis.maxObservedHoursPerWeek.toFixed(1)} hours/week; median ${analysis.medianRecurringHoursPerWeek.toFixed(1)} hours/week` : "not available yet; mark completed trial weeks as recorded";
  const targetFeeNote = analysis.sampleWeeks ? `At the entered target rate, the observed median implies about ${project.currency} ${analysis.fairMonthlyAtTarget.toLocaleString("en-IN")}/month; this is a planning calculation, not a market-rate recommendation.` : "The sample is insufficient to calculate a monthly fee from observed hours; record more trial work first.";
  return `# Scope alignment — ${project.title}\n\n**Client:** ${project.client}\n**Review status:** ${statusLine}\n**Evidence:** ${analysis.evidence} from ${analysis.sampleWeeks} recorded trial weeks. These are observed work logs, not a promise about future workload.\n\n## Trial snapshot\n\n- Recurring work observed: ${range}.\n- Weekly allowance discussed: ${Number(project.allocatedHoursPerWeek).toFixed(1)} hours/week.\n- One-off setup recorded (excluded from recurring estimate): ${analysis.oneOffHours.toFixed(1)} hours across the recorded weeks.\n- Planned posts in sample: ${analysis.deliveredPosts} of ${analysis.plannedPosts} delivered (${analysis.deliveryRate ?? "not available"}%). This is a sample completion count, not a performance claim.\n- Proposed fee: ${project.currency} ${Number(project.proposedMonthlyFee).toLocaleString("en-IN")}/month.\n- Effective rate at observed median: ${analysis.effectiveRate === null ? "Unavailable" : `${project.currency} ${analysis.effectiveRate.toLocaleString("en-IN")}/hour`}.\n\n## Work included for discussion\n\n${list(include)}\n\n## Current exclusions / clarification needed\n\n${list(project.exclusions)}\n\n## Alignment options\n\n1. Keep the current weekly hour limit and agree which deliverables take priority.\n2. Keep the current deliverables and revise the reserved hours or fee together. ${targetFeeNote}\n3. If the sample is still early, agree to another paid measurement period before locking a recurring package.\n\n## Notes\n\n${list(project.goals)}\n\nPrepared locally by TrialScope. This is an editable conversation aid, not legal, tax, employment, pricing, or accounting advice. The sample project is fictional; use verified records and discuss any changes with the client.\n`;
}

export function makeId(prefix = "item") {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`}`;
}
