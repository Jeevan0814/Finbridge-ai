# FinBridge AI

Verifiable financial ground truth for India's public schemes and mutual funds.

A NitroStack MCP server that answers eligibility and projection questions from a
codified rulebook and live NAV data, instead of from a language model's memory.

> **Assembly note (Jeevan):** this file is a skeleton. Sections 2–4 are written by
> their owners and handed to you by 06:00. Drop them in, don't rewrite them.

---

## 1. What it does — *Jeevan*

<!-- Overview, the problem, why ground truth matters, install/run instructions,
     deployed URL, and how to point an MCP client at it. -->

### Tools

| Tool | Owner | What it returns |
|---|---|---|
| `check_scheme_eligibility` | Deepak | Every one of 7 schemes sorted into eligible / ineligible, each with a named reason or `failedCondition` |
| `project_investment_growth` | Praneeth | A low–high range with stated assumptions, never a single confident number |
| `calculate_financial_health` | Praneeth | Score, three sub-scores, and suggestions |
| `explain_financial_concept` | Jayaram | Plain-language definition and worked example, read from the glossary |

### Resources

- `finbridge://schemes` — the codified rulebook, all 7 schemes
- `finbridge://glossary` — 10–15 financial terms

### Prompts

- `beginner_investor_advisor`
- `scheme_navigator`

Every tool output carries a `risk_note` and `educational_only: true`. This is an
educational tool, not financial advice.

---

## 2. How eligibility is computed — *Deepak, due 06:00*

<!-- How the evaluator reads data/schemes.json, how each condition is checked,
     why ineligible results name the specific failed condition, boundary behaviour
     (exact income ceiling, exact age band edges, girl-child check for SSY). -->

---

## 3. Projection assumptions — *Praneeth, due 06:00*

<!-- Where NAV comes from (mfapi.in), the cached fallback and when it kicks in,
     what the low and high estimates assume, and what the range explicitly does
     not account for (inflation, exit load, tax, sequence risk). -->

---

## 4. Hallucination table — *Jayaram, due 06:00*

<!-- 10 edge-case eligibility questions. Bare model steelmanned with the full
     scheme documents in context. 3 runs each, both sides. Two counts: wrong
     verdicts, and run-to-run inconsistency on identical inputs. Table plus a
     short written framing. This is the Innovation argument. -->

---

## Running locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` first. `.env` is gitignored and must never be
committed.

```bash
npm run build     # production bundle
npm start
```

## Ownership

See [CONTRIBUTING.md](./CONTRIBUTING.md). File ownership is strict and
`src/shared/contracts.ts` is frozen.

## Links

- Docs: <https://docs.nitrostack.ai>
- Discord: <https://discord.gg/uVWey6UhuD>
