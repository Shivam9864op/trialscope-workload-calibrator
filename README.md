# TrialScope — set the next scope from the work you actually did

**A two-week trial is evidence, not a forecast.** TrialScope helps a freelancer compare a client's brief and hour allowance with measured work, separate recurring delivery from one-off setup, and prepare a calm scope-alignment note.

**Personal open-source project · Fictional sample client · Synthetic data · Not client work**

## Watch the walkthrough

[Watch the 49-second product walkthrough](media/trialscope-walkthrough.mp4) · [Read the captions](media/trialscope-walkthrough.srt)

The video is the project's only promotional media. There are no generated covers, screenshots, or image assets. The walkthrough is recorded from the running app with the synthetic café sample.

## Try the live demo

**[Open TrialScope on GitHub Pages](https://shivam9864op.github.io/trialscope-workload-calibrator/)**

The app opens with fictional sample data. Change a value, visit the other steps, and see the calculations update. Data stays in your browser. The app has no account, analytics call, external AI model, or platform connection. Use Export backup if you want a portable project file.

## The workflow

1. **Review the brief.** Paste the role note or client brief and use the local phrase checker to surface possible deliverables. Every match shows its original line; the tool does not decide contract meaning.
2. **Log the trial.** Record recurring and one-off work separately across weeks. Include planning, research, copy, content preparation, scheduling, community replies, revisions, meetings, and reporting.
3. **Compare the evidence.** See the median recurring hours, observed range, one-off setup total, sample post completion, weekly allowance, and effective hourly rate from the fee you entered.
4. **Prepare a handoff.** Edit a neutral scope-alignment note, choose discussion items, then copy or download it. Nothing is sent to a client.

## Why this specific problem

Freelancers describe a gap between advertised or expected hours and the ongoing workload that appears during a trial. One recent social-media freelancer described a two-week trial ending with fewer expected hours than anticipated; a separate workload discussion listed research, planning, calls, community management, event work, and coordination beyond post creation. Those posts are signals about a problem, not representative research or proof of market size. See [the trial-to-retainer discussion](https://www.reddit.com/r/SocialMediaMarketing/comments/1wnidwx/some_advice_needed_for_first_time_freelance/) and [a workload-versus-hours discussion](https://www.reddit.com/r/SocialMediaMarketing/comments/1tdrxi6/am_i_crazy_or_is_this_workload_impossible_in_25/).

Generic scope trackers and pricing calculators already exist. TrialScope focuses on a narrower moment: comparing work observed during a trial with the discussed weekly capacity and fee, while keeping one-off setup out of the recurring estimate. It does not claim to be the first such tool. See [research notes](docs/problem-and-design.md).

## Calculations and limitations

- Recurring weekly workload is the **median of logged recurring hours in each trial week**. The observed minimum and maximum are displayed beside it.
- One-off hours (such as onboarding) are totaled separately; they do not increase the recurring estimate.
- Effective hourly rate is `entered monthly fee / (median recurring weekly hours × 4.33)`. It uses the user's own entered fee and is not a pricing recommendation.
- The brief checker is a deterministic local phrase matcher, **not AI**. It surfaces candidate lines for a human to check.
- A two-week sample is labelled **Early signal**. Four or more populated weeks are labelled **More stable sample**, not statistically predictive.
- Post counts do not measure reach, engagement, sales, attribution, or quality. A gap does not establish why an item was delayed.
- Browser storage is convenient but is not an authenticated workspace or a secure document vault. Do not paste secrets or sensitive client information.
- The exported discussion note is not a contract and is not legal, tax, accounting, employment, or pricing advice.

## Run locally

Requires Node.js 20 or later. Runtime has no package dependencies.

```powershell
node --test
node scripts/serve.mjs
```

Open the printed local address. To record the walkthrough on Windows, use an installed Microsoft Edge and FFmpeg:

```powershell
node scripts/record-walkthrough.mjs
```

The recording script opens an isolated browser profile and temporary frame directory, captures the actual app workflow, encodes an MP4 with readable captions, and removes the temporary frames afterward. It never accesses a signed-in browser session.

## Privacy and safety

- No social-platform logins, scraping, API keys, customer uploads, or networked AI.
- No data leaves the browser during ordinary use. A project backup is written only after the user chooses Export.
- JSON import is size-limited and validated before it replaces the active project.
- The local development server is bound to `127.0.0.1`, only serves GET/HEAD, and denies image loading.
- No automatic messages, client emails, or contract clauses are generated or sent.

## Project layout

```text
src/core.mjs          analysis and brief-matching rules
src/app.mjs           browser interface and local data handling
test/core.test.mjs    deterministic calculation tests
scripts/serve.mjs     local static server
scripts/record-walkthrough.mjs
docs/problem-and-design.md
media/trialscope-walkthrough.mp4
```

## Feedback

The product hypothesis needs validation. If you freelance or hire social-media support, feedback on these three questions would be useful:

1. Does separating recurring work from trial setup make the next-scope conversation clearer?
2. Which kinds of work are easy to forget when comparing a brief with actual hours?
3. Would you trust the median and observed range from a short trial? What would you need to see?

Open an issue or discuss the demo with a real freelancer. No users, clients, or business outcomes are claimed here.

## License

MIT. See [LICENSE](LICENSE).
