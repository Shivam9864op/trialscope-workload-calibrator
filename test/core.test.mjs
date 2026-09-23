import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProject, DEFAULT_PROJECT, makeHandoff, median, scanBrief, validateProject } from "../src/core.mjs";

const copy = () => structuredClone(DEFAULT_PROJECT);

test("sample separates recurring work from one-off setup and is explicit about a small sample", () => {
  const result = analyzeProject(copy());
  assert.equal(result.valid, true);
  assert.equal(result.sampleWeeks, 2);
  assert.equal(result.evidence, "Early signal");
  assert.equal(result.oneOffHours, 2.6);
  assert.ok(result.medianRecurringHoursPerWeek > 6);
  assert.equal(result.workloadGap, "Needs alignment");
});

test("median resists a single unusually busy trial week", () => {
  assert.equal(median([5, 6, 30]), 6);
  assert.equal(median([5, 7]), 6);
});

test("missing trial weeks and invalid entries return readable errors", () => {
  const project = copy();
  project.trialWeeks = [];
  project.entries[0].hours = -1;
  const errors = validateProject(project);
  assert.ok(errors.some((error) => error.includes("at least one trial week")));
  assert.ok(errors.some((error) => error.includes("non-negative duration")));
  assert.equal(analyzeProject(project).valid, false);
});

test("not enough weeks never claims a stable workload estimate", () => {
  const project = copy();
  project.trialWeeks = project.trialWeeks.slice(0, 1);
  project.entries = project.entries.filter((entry) => entry.weekId === "week-1");
  const result = analyzeProject(project);
  assert.equal(result.status, "Need more evidence");
  assert.equal(result.evidence, "Early signal");
});

test("blank future weeks are excluded until the user marks them recorded", () => {
  const project = copy();
  project.trialWeeks.push({ id: "week-3", label: "Trial week 3", date: "2026-09-21", plannedPosts: 0, deliveredPosts: 0, recorded: false });
  const result = analyzeProject(project);
  assert.equal(result.sampleWeeks, 2);
  assert.equal(result.oneOffHours, 2.6);
  project.trialWeeks.forEach((week) => { week.recorded = false; });
  const empty = analyzeProject(project);
  assert.equal(empty.sampleWeeks, 0);
  assert.equal(empty.minObservedHoursPerWeek, null);
  assert.equal(empty.effectiveRate, null);
  assert.match(makeHandoff(project, empty, []), /not available yet/);
});

test("brief scanner keeps source phrases visible and labels results as rule matches", () => {
  const hits = scanBrief("4 posts per week\nWeekly client check-in\nReply to comments during business hours");
  assert.equal(hits.length, 3);
  assert.ok(hits.some((hit) => hit.quote === "4 posts per week" && hit.label === "posts"));
  assert.ok(hits.some((hit) => hit.quote === "Reply to comments during business hours"));
});

test("handoff uses the observed values and a clear no-guarantee note", () => {
  const project = copy();
  const report = makeHandoff(project, analyzeProject(project), ["Caption writing", "Scheduling"]);
  assert.match(report, /One-off setup recorded \(excluded from recurring estimate\)/);
  assert.match(report, /not a promise about future workload/);
  assert.match(report, /Caption writing/);
});
