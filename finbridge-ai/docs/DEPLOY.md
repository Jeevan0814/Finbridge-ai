# Deploy runbook — Jeevan

Everything here was verified against the shipped CLI and the official docs on
2026-07-26. **Nothing in this file was generated from a model's memory of other
MCP SDKs.** Where the docs and the actual CLI disagree, that disagreement is
recorded rather than smoothed over.

---

## ⚠ Read this first: the documented deploy command does not exist

`docs.nitrostack.ai/deployment/cloud` tells you to run:

```bash
npm install -g @nitrostack/cli
nitrostack login      # ← does not exist
nitrostack deploy     # ← does not exist
```

**Verified against `@nitrostack/cli` 1.0.15, which is the latest published
version on npm:**

```
Commands:
  init      dev       build     start     generate
  upgrade   install   cursor    pack      help
```

`login` and `deploy` are not in the command list, and the strings `'login'` and
`'deploy'` do not appear anywhere in `node_modules/@nitrostack/cli/dist/`. The
docs page is ahead of the shipped tool.

Two further details worth knowing before you type anything:

- The product is **NitroCloud** (`nitrocloud.ai`). "NitroStack Cloud" is not a
  thing — searching for that name will waste your time.
- The installed binaries are `nitrostack-cli`, `@nitrostack/cli` and
  `nitrostack-pack`. There is no bare `nitrostack` binary, even though the CLI's
  own help text prints `Usage: nitrostack`.

**So do not budget the +3:00 gate around `nitrostack deploy`.** Budget it around
the two paths below.

---

## Path A — NitroCloud dashboard upload (try this first)

The CLI's `pack` command exists and is almost certainly the intended input to
the dashboard:

```
Usage: nitrostack pack [options]
  Create an optimized zip of the project (excludes build artifacts)

  -o, --output <path>     Zip filename (always written to the project root)
  --dry-run               Show excluded/included summary without creating zip
  --include-env           Include .env files in the zip
  --no-sync-gitignore     Skip merging canonical rules into local .gitignore
```

```bash
npm run build
npx nitrostack-cli pack --dry-run    # confirm data/ is IN and .env is OUT
npx nitrostack-cli pack -o finbridge-ai.zip
```

Then sign in at <https://nitrocloud.ai> and upload.

**Two things to check on the dry run:**

1. `data/` must be included. The knowledge resources read `schemes.json` and
   `glossary.json` from disk at request time — if `data/` isn't in the zip, both
   resources fail in production while everything else looks fine.
2. `.env` must be excluded. It is by default; `--include-env` is the only way to
   pull it in, so never pass that flag.

Note `pack` merges "canonical rules" into your local `.gitignore` unless you
pass `--no-sync-gitignore`. It edits a tracked file. Run `git diff .gitignore`
afterwards so it doesn't ride along in an unrelated commit.

---

## Path B — Docker (the escape hatch)

If the dashboard path stalls, `Dockerfile` in the repo root runs anywhere that
takes a container — Cloud Run, Render, Fly, Railway, ECS.

```bash
docker build -t finbridge-ai .
docker run -p 3000:3000 finbridge-ai
```

It is a two-stage build: compile with `tsc` only (skipping the widget bundler,
which is the flakiest part of `nitrostack-cli build`), then copy `dist/` and
`data/` into a slim runtime image.

**`COPY data ./data` is load-bearing.** `knowledge.resources.ts` resolves the
data directory relative to its own module file (`../../../data`), not from
`process.cwd()`. Keep `dist/` and `data/` as siblings or the resources break.

Fastest managed target if you go this way:

```bash
gcloud run deploy finbridge-ai --source . \
  --platform managed --region asia-south1 \
  --allow-unauthenticated --port 3000
```

---

## Transport

From `.env.example`, `MCP_TRANSPORT_TYPE` takes `stdio | http | dual`, defaulting
to `stdio` in development and `dual` when `NODE_ENV=production`. Anything
hosted needs HTTP reachable, so leave it at `dual` (the Dockerfile sets this
explicitly) and confirm the deployed URL answers before you call the gate green.

---

## Pre-deploy checklist

Condensed from `docs.nitrostack.ai/deployment/checklist`, keeping only what
applies to us:

- [ ] `npx tsc --noEmit` clean
- [ ] `npm run sweep` green — 4 tools, 2 resources, 2 prompts
- [ ] `npm run audit:secrets` green
- [ ] No `console.log` in server code (`ctx.logger` only)
- [ ] Input validation on every tool — already enforced by the contract schemas
- [ ] `NITRO_LOG_LEVEL` at `info` or `warn`, not `debug`
- [ ] `.env` not in the zip / image / repo

## Post-deploy — this is what makes the gate green

- [ ] Deployed URL responds
- [ ] `tools/list` returns all **4** tools
- [ ] `resources/list` returns both `finbridge://` URIs
- [ ] `prompts/list` returns both prompts
- [ ] `finbridge://schemes` returns 7 schemes — **the check that catches a
      missing `data/` directory**
- [ ] One real tool call end to end from an MCP client, not just a listing

---

## Hourly sweep, from +4:00

```bash
npm run sweep          # rebuild server, then sweep
npm run sweep:fast     # sweep the existing dist/
```

Spawns the built server over stdio, speaks raw MCP JSON-RPC, and checks:

- all 4 tools, 2 resources, 2 prompts are discoverable
- every tool output carries a non-empty `risk_note` and `educational_only: true`
- every `ineligible` entry names a `failedCondition`
- `highEstimate >= lowEstimate`, `assumptions` non-empty, `navSource` present
- both resources parse as non-empty JSON arrays
- both prompts return messages

It counts errors per tool and prints a **cut from the video** warning at two or
more, per the rule in `CONTRIBUTING.md`. Each run writes JSON to `sweeps/`
(gitignored), so you have the history at 06:00 instead of a memory of it.

Exit codes: `0` all green, `1` at least one check failed, `2` could not run.

### If the sweep can't connect

`npm run sweep` needs the server to answer MCP JSON-RPC over stdio. That path
could **not** be validated before handover — when `dist/index.js` is spawned as a
child process with piped stdio it produced no output and did not answer
`initialize`, though the same code initializes correctly when imported in-process
(`✅ Application initialized with 4 tools, 2 resources, 2 prompts`). This may be
environment-specific. Treat your first sweep as the real test.

If it times out, don't debug it during the gate — run the in-process verifier
instead, which checks the same logic without the transport:

```bash
npm run verify:tools
```

14 checks: rulebook size, contract conformance of every scheme, no placeholder
links, three eligibility boundary cases, CAGR bands for all four fund
categories, graceful degradation when mfapi.in is unreachable, financial-health
sub-scores, glossary size, and that no module resolves `data/` from
`process.cwd()`. Green there means the tools are sound and any remaining problem
is transport or deployment, which narrows the search a lot.

> The eligibility call in the sweep uses a 10-year-old girl child on purpose —
> the SSY boundary. When Deepak's real evaluator lands it should return all 7
> schemes sorted; the stub returns 2 + 2. The sweep reports the count rather
> than asserting 7, so it stays green across the handover. **Tighten it to
> require 7 once Deepak merges.**

---

## Still unverified — do not guess these

Three submission requirements could not be confirmed from any public source,
and the hackathon isn't named anywhere in the repo:

1. Exact **demo video length limit**
2. **Sample Apps PR format** — there is no `sample-apps` directory or repo under
   the `nitrocloudofficial` org, so this is likely a hackathon-specific process,
   not a NitroStack one
3. **Discord post tag requirements** — the community server is
   <https://discord.gg/uVWey6UhuD>; tag rules will be in its rules or
   announcements channel

Get these from the organiser's brief in hour one. Guessing a video length is how
you record twice.
