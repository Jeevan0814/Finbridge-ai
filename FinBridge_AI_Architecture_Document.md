# FinBridge AI — Complete Software Architecture Document

> **Version:** 1.0.0 — Hackathon Edition  
> **Authors:** Jeevan (infra/core), Deepak (eligibility), Praneeth (growth/health), Jayaram (data/explain)  
> **Status:** Living document — update as the system evolves  
> **Purpose:** Definitive reference for the entire team and every AI assistant working on this project

---

## Table of Contents

1. [Project Vision and Core Principle](#1-project-vision-and-core-principle)
2. [Repository Map](#2-repository-map)
3. [High-Level Design (HLD)](#3-high-level-design-hld)
4. [NitroStack Internals](#4-nitrostack-internals)
5. [MCP Protocol Architecture](#5-mcp-protocol-architecture)
6. [Low-Level Design (LLD) — Module by Module](#6-low-level-design-lld--module-by-module)
7. [Sequence Diagrams](#7-sequence-diagrams)
8. [Component Diagram](#8-component-diagram)
9. [Class Diagram](#9-class-diagram)
10. [Data Flow Diagram](#10-data-flow-diagram)
11. [Ownership Matrix](#11-ownership-matrix)
12. [Integration Contracts (contracts.ts)](#12-integration-contracts-contractsts)
13. [JSON Schema Specification — schemes.json](#13-json-schema-specification--schemesjson)
14. [JSON Schema Specification — glossary.json](#14-json-schema-specification--glossaryjson)
15. [Environment and Configuration](#15-environment-and-configuration)
16. [Testing Strategy](#16-testing-strategy)
17. [Deployment Strategy](#17-deployment-strategy)
18. [Security Considerations](#18-security-considerations)
19. [Scalability Plan](#19-scalability-plan)
20. [Hallucination Benchmark Methodology](#20-hallucination-benchmark-methodology)
21. [Judge Q&A Reference](#21-judge-qa-reference)
22. [Coding Standards](#22-coding-standards)
23. [AI Behaviour Rules](#23-ai-behaviour-rules)
24. [Future Roadmap](#24-future-roadmap)
25. [Glossary of Terms](#25-glossary-of-terms)

---

## 1. Project Vision and Core Principle

### 1.1 The Problem

Large Language Models (LLMs) are probabilistic. When asked financial questions such as "Am I eligible for APY?" or "What will my SIP return in 10 years?", the LLM:

- May return different answers on different runs
- Cannot guarantee it has applied every eligibility rule correctly
- Cannot perform compound interest calculations reliably
- Has no access to the latest government scheme rules
- May hallucinate eligibility criteria that do not exist

For financial decisions — especially those affecting low-income or first-time investors — wrong answers carry real consequences.

### 1.2 The FinBridge Solution

> **"The model explains. The code computes."**

FinBridge AI is a **Model Context Protocol (MCP) server** built on the **NitroStack framework**. It intercepts financial questions from the LLM and redirects computation to deterministic code.

The LLM's role is reduced to:
1. Parsing natural language into structured tool inputs
2. Presenting structured tool outputs in natural language

The MCP server's role is:
1. Receiving structured inputs
2. Applying verified rules from JSON rulebooks
3. Returning deterministic, consistent answers

### 1.3 System Identity

| Property | Value |
|---|---|
| Server name | `finbridge-ai` |
| Server version | `1.0.0` |
| Framework | NitroStack v1.x |
| Runtime | Node.js (ES2022 modules) |
| Language | TypeScript 5.x (strict mode) |
| Validation | Zod v3.x |
| Transport | STDIO (dev) / STDIO + HTTP SSE (prod) |

---

## 2. Repository Map

```
Finbridge-ai/
├── FinBridge_AI_Master_Engineering_Prompt.md   ← Master prompt / project charter
│
└── finbridge-ai/                               ← Main application root
    ├── .env.example                            ← Environment variable template
    ├── .gitignore
    ├── package.json                            ← npm config, NitroStack scripts
    ├── tsconfig.json                           ← TypeScript compiler config
    │
    ├── data/                                   ← JSON rulebooks (Jayaram owns)
    │   ├── schemes.json                        ← 7 government scheme definitions
    │   ├── glossary.json                       ← 13 financial term definitions
    │   └── hallucination_benchmark.md          ← Benchmark results document
    │
    └── src/                                    ← TypeScript source
        ├── index.ts                            ← Bootstrap entry (Jeevan owns)
        ├── app.module.ts                       ← Root module (Jeevan owns)
        │
        ├── shared/
        │   └── contracts.ts                    ← Frozen Zod schemas (FROZEN)
        │
        ├── health/
        │   └── system.health.ts               ← System uptime/memory check
        │
        ├── clients/
        │   └── mfapi.ts                       ← mfapi.in HTTP client (Praneeth)
        │
        └── modules/
            ├── eligibility/                   ← Deepak's module
            │   ├── eligibility.module.ts
            │   └── eligibility.tools.ts       ← JSON-driven engine
            │
            ├── explain/                       ← Jayaram's module
            │   ├── explain.module.ts
            │   └── explain.tools.ts           ← Glossary lookup engine
            │
            ├── growth/                        ← Praneeth's module
            │   ├── growth.module.ts
            │   └── growth.tools.ts            ← SIP compound formula
            │
            ├── financial-health/              ← Praneeth's module
            │   ├── financial-health.module.ts
            │   └── financial-health.tools.ts  ← Health scoring engine
            │
            └── knowledge/                     ← Jeevan's module
                ├── knowledge.module.ts
                ├── knowledge.prompts.ts        ← MCP Prompt templates
                └── knowledge.resources.ts     ← MCP Resource endpoints
```

---

## 3. High-Level Design (HLD)

### 3.1 System Context Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                          USER                                     │
│  "Am I eligible for APY? I am 35, salaried, non-taxpayer."       │
└──────────────────────────────┬────────────────────────────────────┘
                               │ Natural language query
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│                    LLM / AI ASSISTANT                             │
│  (Claude, Gemini, ChatGPT, or any MCP-compatible client)         │
│                                                                   │
│  1. Parses natural language into structured tool call             │
│  2. Calls MCP tool: check_scheme_eligibility({age:35, ...})       │
│  3. Receives structured JSON result                               │
│  4. Formats result in natural language for the user               │
└──────────────────────────────┬────────────────────────────────────┘
                               │ MCP Tool Call (JSON-RPC 2.0)
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│               FINBRIDGE AI MCP SERVER (NitroStack)                │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────────┐ │
│  │ Eligibility │  │   Growth    │  │   Financial Health        │ │
│  │   Engine    │  │   Engine    │  │       Engine              │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬──────────────┘ │
│         │                │                       │                │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌────────────▼──────────────┐ │
│  │ schemes.json│  │  SIP Formula│  │   Scoring Algorithm       │ │
│  │  (rulebook) │  │  + mfapi.in │  │   + Dynamic Suggestions   │ │
│  └─────────────┘  └─────────────┘  └───────────────────────────┘ │
│                                                                   │
│  ┌─────────────┐  ┌────────────────────────────────────────────┐  │
│  │   Explain   │  │              Knowledge                     │  │
│  │   Engine    │  │      (Resources + Prompts)                 │  │
│  └──────┬──────┘  └────────────────────────────────────────────┘  │
│         │                                                          │
│  ┌──────▼──────┐                                                   │
│  │glossary.json│                                                   │
│  └─────────────┘                                                   │
└───────────────────────────────────────────────────────────────────┘
                               │ JSON Response
                               ▼
                         Back to LLM → User
```

### 3.2 Core Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Computation layer | Deterministic TypeScript | Eliminates LLM hallucination for financial decisions |
| Rule storage | JSON files | Human-readable, git-trackable, easy to update without code changes |
| Schema validation | Zod (compile-time + runtime) | Catches malformed inputs before they reach business logic |
| Transport | STDIO (dev) + HTTP SSE (prod) | STDIO for local testing; SSE for remote MCP clients |
| Module isolation | NitroStack @Module | Each feature owner works in an isolated folder without conflicts |
| Contract freeze | Frozen contracts.ts | Prevents breaking changes from propagating across modules |

---

## 4. NitroStack Internals

### 4.1 What is NitroStack?

NitroStack is an opinionated MCP framework for TypeScript that follows a **decorator-based, NestJS-inspired architecture**. It provides:

- `@McpApp` — top-level server bootstrap decorator
- `@Module` — groups controllers (tools, resources, prompts)
- `@Tool` — exposes a method as an MCP tool
- `@Resource` — exposes data as an MCP resource
- `@Prompt` — exposes a prompt template
- `@HealthCheck` — registers a health monitor
- `ExecutionContext` — dependency injection context, provides `logger`
- `z` re-exported from Zod for schema building

### 4.2 Bootstrap Flow

```
npm run dev
    │
    ▼
index.ts
    │
    └── McpApplicationFactory.create(AppModule)
            │
            ▼
        app.module.ts  (@McpApp + @Module)
            │
            ├── ConfigModule.forRoot()        ← loads .env
            ├── EligibilityModule             ← registers EligibilityTools
            ├── ExplainModule                 ← registers ExplainTools
            ├── GrowthModule                  ← registers GrowthTools
            ├── FinancialHealthModule         ← registers FinancialHealthTools
            └── KnowledgeModule              ← registers KnowledgeResources + KnowledgePrompts
                        │
                        ▼
            server.start()
                │
                ├── (dev) STDIO transport only
                └── (prod) STDIO + HTTP SSE transport
```

### 4.3 Module Anatomy

Every NitroStack module consists of exactly two files:

```typescript
// *.module.ts
@Module({
  name: 'module-name',
  description: 'description',
  controllers: [ToolClass, ResourceClass, PromptClass]
})
export class MyModule {}

// *.tools.ts
export class MyTools {
  @Tool({ name: 'tool_name', description: '...', inputSchema: ZodSchema })
  async myTool(input: any, ctx: ExecutionContext) {
    ctx.logger.info('tool called', { input });
    return result;
  }
}
```

### 4.4 Execution Context

| Property | Type | Purpose |
|---|---|---|
| `ctx.logger` | Logger | Structured logging (info, warn, error) |
| `ctx.request` | Request metadata | Tool call metadata from the MCP client |

### 4.5 NitroStack Script Reference

| Command | What It Does |
|---|---|
| `npm run dev` | Start dev server with STDIO transport |
| `npm run build` | Compile TypeScript to `dist/`; bundle widgets |
| `npm start` | Build then start production server |
| `npm run start:prod` | Start already-built production server |
| `npm run upgrade` | Upgrade NitroStack CLI and core |
| `npm run install:all` | Install all dependencies including widget deps |

---

## 5. MCP Protocol Architecture

### 5.1 What is MCP?

The **Model Context Protocol (MCP)** is an open standard (JSON-RPC 2.0 based) that allows AI assistants to call external tools, access resources, and use prompt templates in a structured, safe, and discoverable way.

### 5.2 MCP Message Types Used by FinBridge

| MCP Type | FinBridge Usage | File |
|---|---|---|
| Tool | Computations (eligibility, growth, health, explain) | `*.tools.ts` |
| Resource | Static data access (schemes list, glossary) | `knowledge.resources.ts` |
| Prompt | Pre-built conversation starters | `knowledge.prompts.ts` |

### 5.3 MCP Tool Call Flow

```
LLM Client                          FinBridge MCP Server
     │                                       │
     │─── tools/list ──────────────────────→│
     │←── [check_scheme_eligibility, ...] ───│
     │                                       │
     │─── tools/call ──────────────────────→│
     │    {                                  │
     │      "name": "check_scheme_eligibility"│
     │      "arguments": {                   │
     │        "age": 35,                     │
     │        "gender": "male",              │
     │        "monthlyIncome": 50000,        │
     │        "occupation": "salaried",      │
     │        "hasBankAccount": true,        │
     │        "isTaxPayer": false            │
     │      }                                │
     │    }                                  │
     │                                       │─── Zod validation
     │                                       │─── Load schemes.json (cached)
     │                                       │─── Evaluate 7 schemes × 6 rules
     │←── { eligible:[...], ineligible:[...] }
```

### 5.4 MCP Transport Configuration

| Environment | Transport | Config |
|---|---|---|
| Development | STDIO only | `NODE_ENV=development` |
| Production | STDIO + HTTP SSE | `NODE_ENV=production` |
| Custom | Any | `MCP_TRANSPORT_TYPE=stdio|http|dual` |

### 5.5 Registered MCP Tools

| Tool Name | Handler Class | File |
|---|---|---|
| `check_scheme_eligibility` | `EligibilityTools` | `eligibility.tools.ts` |
| `explain_financial_concept` | `ExplainTools` | `explain.tools.ts` |
| `project_investment_growth` | `GrowthTools` | `growth.tools.ts` |
| `calculate_financial_health` | `FinancialHealthTools` | `financial-health.tools.ts` |

### 5.6 Registered MCP Resources

| Resource URI | Handler Class | File |
|---|---|---|
| `finbridge://schemes` | `KnowledgeResources` | `knowledge.resources.ts` |
| `finbridge://glossary` | `KnowledgeResources` | `knowledge.resources.ts` |

### 5.7 Registered MCP Prompts

| Prompt Name | Handler Class | File |
|---|---|---|
| `beginner_investor_advisor` | `KnowledgePrompts` | `knowledge.prompts.ts` |
| `scheme_navigator` | `KnowledgePrompts` | `knowledge.prompts.ts` |

---

## 6. Low-Level Design (LLD) — Module by Module

### 6.1 Eligibility Module (Owner: Deepak)

**Purpose:** Deterministically evaluate a user's eligibility across all 7 government schemes.

**File:** `src/modules/eligibility/eligibility.tools.ts`

**Algorithm:**

```
FOR EACH scheme IN schemes.json:
  failedReasons = []

  IF input.age < scheme.eligibility.minimumAge:
    failedReasons.push("Minimum age ...")

  IF scheme.eligibility.maximumAge IS NOT NULL
     AND input.age > scheme.eligibility.maximumAge:
    failedReasons.push("Maximum age ...")

  IF scheme.eligibility.gender != "any"
     AND scheme.eligibility.gender != input.gender:
    failedReasons.push("Gender restriction ...")

  IF scheme.eligibility.requiresExistingBankAccount = true
     AND input.hasBankAccount = false:
    failedReasons.push("Bank account required ...")

  IF scheme.eligibility.incomeCeiling IS NOT NULL
     AND input.monthlyIncome > scheme.eligibility.incomeCeiling:
    failedReasons.push("Income ceiling exceeded ...")

  IF scheme.eligibility.taxpayerExcluded = true
     AND input.isTaxPayer = true:
    failedReasons.push("Taxpayers excluded ...")

  IF scheme.eligibility.occupationEligibility.length > 0
     AND input.occupation NOT IN scheme.eligibility.occupationEligibility:
    failedReasons.push("Occupation mismatch ...")

  IF failedReasons.length == 0:
    eligible.push({ schemeId, schemeName, reason })
  ELSE:
    ineligible.push({ schemeId, schemeName, failedCondition })

RETURN { eligible, ineligible, risk_note, educational_only: true }
```

**Performance:** `schemes.json` is loaded once at module init (cached in `_schemes`). Subsequent calls use the in-memory cache — no disk I/O per request.

**Input Schema:** `CheckSchemeEligibilityInput`

```typescript
{
  age:            z.number().int()
  monthlyIncome:  z.number()
  gender:         z.enum(['male','female','other'])
  occupation:     z.enum(['salaried','self_employed','student','homemaker','retired','unemployed'])
  hasBankAccount: z.boolean()
  isTaxPayer:     z.boolean()
}
```

**Output Shape:** `EligibilityResult`

```typescript
{
  eligible:   Array<{ schemeId, schemeName, reason }>
  ineligible: Array<{ schemeId, schemeName, failedCondition }>
  risk_note:  string
  educational_only: true
}
```

---

### 6.2 Explain Module (Owner: Jayaram)

**Purpose:** Look up a financial term in `glossary.json` and return a structured, hallucination-free explanation.

**File:** `src/modules/explain/explain.tools.ts`

**Algorithm:**

```
LOAD glossary.json (module-level cache)
NORMALIZE input.term → lowercase

ATTEMPT exact case-insensitive match
IF NOT FOUND, attempt partial match (contains)
IF STILL NOT FOUND:
  RETURN structured error object (NOT a thrown exception)
  { term, explanation: "not found", example: "available terms: ...", ... }
ELSE:
  RETURN full glossary entry:
  { term, definition, explanation, example, relatedTerms, category, risk_note, educational_only }
```

**Input Schema:** `ExplainConceptInput`

```typescript
{ term: z.string() }
```

**Output Shape:** `ExplainConceptOutput` (plus bonus fields: `definition`, `relatedTerms`, `category`)

> [!NOTE]
> The output includes `definition`, `relatedTerms`, and `category` beyond the frozen contract. These are additive and do not break the contract.

---

### 6.3 Growth Module (Owner: Praneeth)

**Purpose:** Project future value of a monthly SIP using the compound interest formula.

**File:** `src/modules/growth/growth.tools.ts`

**Core Formula — SIP Future Value:**

```
FV = P × [((1 + r)^n - 1) / r] × (1 + r)

Where:
  P = monthly investment amount
  r = monthly rate = annualRate / 12
  n = total months = years × 12
```

**Rate Ranges by Fund Category:**

| Category | Low (p.a.) | High (p.a.) | Basis |
|---|---|---|---|
| `equity` | 10% | 14% | Long-term large-cap historical |
| `debt` | 6% | 8% | Bond fund historical |
| `hybrid` | 8% | 11% | Balanced fund historical |
| `index` | 10% | 12% | Nifty 50 long-term CAGR |

**Output Fields:**

```typescript
{
  lowEstimate:   number  // FV at low annual rate
  highEstimate:  number  // FV at high annual rate
  totalInvested: number  // P × n
  lowGain:       number  // lowEstimate - totalInvested
  highGain:      number  // highEstimate - totalInvested
  assumptions:   string[]
  navSource:     'mfapi-illustrative'
  risk_note:     string
  educational_only: true
}
```

**Pending (Praneeth):** `src/clients/mfapi.ts` is currently a stub. When live mfapi.in integration is complete, the growth tool can be enhanced to use real NAV-based returns.

---

### 6.4 Financial Health Module (Owner: Praneeth)

**Purpose:** Score financial health across three dimensions; provide personalised, data-driven suggestions.

**File:** `src/modules/financial-health/financial-health.tools.ts`

**Three Dimensions:**

| Dimension | Weight | Target | Full-Score Threshold |
|---|---|---|---|
| Savings Rate | 50% | savings / income | 30% savings rate |
| Emergency Fund | 30% | savings / (months × expenses) | Ratio ≥ 1.0 |
| Debt Control | 20% | 1 - debtRatio/0.50 | 0% debt ratio |

**Score Formula:**

```
score = round(100 × (
  0.50 × min(1, savingsRate / 0.30) +
  0.30 × min(1, emergencyFundRatio) +
  0.20 × max(0, 1 - debtRatio / 0.50)
))
```

**Score Bands:**

| Range | Band |
|---|---|
| 0–40 | Poor |
| 41–60 | Fair |
| 61–80 | Good |
| 81–100 | Excellent |

**Dynamic Suggestions Logic:**

- Savings < 10%: "Very low savings — start saving at least 10% (₹X/month)"
- Savings 10–20%: "Aim for 20% savings rate — try to increase"
- Savings ≥ 20%: "Great savings rate! Invest surplus in diversified funds"
- No emergency fund: "Build ₹{6 months × expenses} in a liquid account"
- Debt > 50%: "Critical — use avalanche method to repay high-interest loans"
- Debt 40–50%: "Stay below 40% debt-to-income ratio"
- Debt > 0%: "Debt ratio is manageable — keep paying on time"
- Debt = 0%: "Debt-free — excellent financial flexibility"

---

### 6.5 Knowledge Module (Owner: Jeevan)

**Purpose:** Expose raw JSON data as MCP Resources and provide guided prompt templates.

**Resources:**

| URI | Returns | Read Mode |
|---|---|---|
| `finbridge://schemes` | Full `schemes.json` text | Per-request disk read |
| `finbridge://glossary` | Full `glossary.json` text | Per-request disk read |

**Prompts:**

| Name | Role |
|---|---|
| `beginner_investor_advisor` | System persona for guiding beginner investors |
| `scheme_navigator` | System persona for helping users find applicable schemes |

---

### 6.6 Health Module (Owner: Jeevan)

**File:** `src/health/system.health.ts`

Polls every 30 seconds:
- Heap memory usage (marks `degraded` if > 90%)
- Process uptime in seconds
- PID and Node.js version

---

## 7. Sequence Diagrams

### 7.1 Eligibility Check — Full Flow

```
User         LLM          MCP Client     FinBridge       schemes.json
 │            │                │              │                │
 │─query─────→│                │              │                │
 │            │─tools/call────→│              │                │
 │            │  check_scheme_ │              │                │
 │            │  eligibility   │              │                │
 │            │  {age,gender..}│              │                │
 │            │                │─────────────→│                │
 │            │                │              │─read (cached)─→│
 │            │                │              │←─ JSON array ──│
 │            │                │              │─evaluate 7×6   │
 │            │                │←─ result ────│                │
 │            │←─ tool result ─│              │                │
 │←─ response─│                │              │                │
```

### 7.2 Explain Term — Glossary Lookup

```
User         LLM          FinBridge        glossary.json
 │            │                │                 │
 │─"What is SIP?"              │                 │
 │            │─tools/call────→│                 │
 │            │  explain       │                 │
 │            │  {term:"SIP"}  │                 │
 │            │                │─read (cached)──→│
 │            │                │←─ JSON array ───│
 │            │                │─find "SIP"      │
 │            │←─ full entry ──│                 │
 │←─ "SIP stands for..."───────│                 │
```

### 7.3 Growth Projection

```
User           LLM           FinBridge
 │              │                 │
 │─"₹5k/mo,    │                 │
 │  equity,     │                 │
 │  10 yrs?"    │                 │
 │              │─tools/call─────→│
 │              │  project_growth │
 │              │  {5000, 10, eq} │
 │              │                 │─r_low = 0.10/12
 │              │                 │─r_high = 0.14/12
 │              │                 │─n = 120 months
 │              │                 │─SIP FV formula
 │              │←─ {low, high, ..│
 │←─ "Low ₹10.3L High ₹15.9L"────│
```

---

## 8. Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    FinBridge AI MCP Server                       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Transport Layer                                            │ │
│  │  ┌─────────────────────┐  ┌──────────────────────────────┐  │ │
│  │  │   STDIO Transport   │  │  HTTP SSE Transport (prod)   │  │ │
│  │  └──────────┬──────────┘  └────────────┬─────────────────┘  │ │
│  └─────────────┼──────────────────────────┼───────────────────┘ │
│                └──────────────┬───────────┘                      │
│                               ▼                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  MCP Protocol Handler — JSON-RPC 2.0 Router               │  │
│  │  tools/list | tools/call | resources/read | prompts/get   │  │
│  └────────┬────────────────┬──────────────┬──────────────────┘  │
│           │                │              │                       │
│           ▼                ▼              ▼                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Tool Router  │  │Resource Router│  │   Prompt Router        │ │
│  └──┬──┬──┬──┬─┘  └──────┬───────┘  └────────┬───────────────┘ │
│     │  │  │  │             │                   │                  │
│     ▼  ▼  ▼  ▼             ▼                   ▼                  │
│    E1  E2  E3  E4    KnowledgeResources   KnowledgePrompts        │
│                        finbridge://         beginner_advisor       │
│                        schemes              scheme_navigator       │
│                        glossary                                    │
│                              │                                     │
│  ┌───────────────────────────┴────────────────────────────────┐   │
│  │                     Data Layer                             │   │
│  │  ┌─────────────────────┐    ┌─────────────────────────┐   │   │
│  │  │    schemes.json     │    │      glossary.json       │   │   │
│  │  │    (7 schemes)      │    │      (13 terms)          │   │   │
│  │  └─────────────────────┘    └─────────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  E1=check_scheme_eligibility  E2=explain_financial_concept        │
│  E3=project_investment_growth  E4=calculate_financial_health      │
└────────────────────────────────────────────────────────────────────┘
```

---

## 9. Class Diagram

```
AppModule
  @McpApp({name:'finbridge-ai', version:'1.0.0'})
  @Module({imports:[Config,Eligib,Explain,Growth,FinHealth,Knowledge]})
  providers: [SystemHealthCheck]
    │
    ├── EligibilityModule → EligibilityTools
    │     +checkSchemeEligibility(input, ctx): EligibilityResult
    │     -getSchemes(): Scheme[]          [cached]
    │
    ├── ExplainModule → ExplainTools
    │     +explainFinancialConcept(input, ctx): ExplainConceptOutput
    │     -getGlossary(): GlossaryEntry[]  [cached]
    │
    ├── GrowthModule → GrowthTools
    │     +projectInvestmentGrowth(input, ctx): ProjectGrowthOutput
    │     -sipFutureValue(P, r, n): number [pure function]
    │     -RATE_RANGES: Record<FundCategory, {low,high,label}>
    │
    ├── FinancialHealthModule → FinancialHealthTools
    │     +calculateFinancialHealth(input, ctx): FinancialHealthOutput
    │     -getScoreBand(score): string     [pure function]
    │     -generateSuggestions(...): string[] [dynamic]
    │
    └── KnowledgeModule
          ├── KnowledgeResources
          │     +getSchemes(uri, ctx): ResourceContent
          │     +getGlossary(uri, ctx): ResourceContent
          └── KnowledgePrompts
                +beginnerAdvisor(args, ctx): Message[]
                +schemeNavigator(args, ctx): Message[]

Shared:
  contracts.ts (frozen)
    SchemeId | Gender | FundCategory | Occupation | BaseOutput
    CheckSchemeEligibilityInput | EligibilityResult
    ProjectGrowthInput | ProjectGrowthOutput
    FinancialHealthInput | FinancialHealthOutput
    ExplainConceptInput | ExplainConceptOutput
```

---

## 10. Data Flow Diagram

### 10.1 Eligibility Data Flow

```
User Input (age, income, gender, occupation, bankAcct, isTaxPayer)
    │
    ▼
Zod Schema Validation (CheckSchemeEligibilityInput)
    │                          │
  VALID                    INVALID → MCP Error Response
    │
    ▼
Load schemes.json (module-level cache, read once)
    │
    ▼
For each of 7 schemes — evaluate 6 rules:
  1. age >= minimumAge?
  2. age <= maximumAge (if not null)?
  3. gender matches (if not "any")?
  4. hasBankAccount (if requiresExistingBankAccount=true)?
  5. monthlyIncome <= incomeCeiling (if not null)?
  6. !isTaxPayer (if taxpayerExcluded=true)?
  7. occupation in occupationEligibility (if list non-empty)?
    │
    ├── ALL PASS → eligible[]
    └── ANY FAIL → ineligible[]
    │
    ▼
EligibilityResult { eligible, ineligible, risk_note, educational_only }
    │
    ▼
MCP Response → LLM → User
```

### 10.2 Growth Data Flow

```
Input: monthlyAmount, years, fundCategory
    │
    ▼
Zod Validation
    │
    ▼
RATE_RANGES[fundCategory] → { low, high }
    │
    ▼
r_low  = low  / 12
r_high = high / 12
n      = years × 12
    │
    ▼
FV_low  = P × [((1+r_low)^n  - 1) / r_low]  × (1+r_low)
FV_high = P × [((1+r_high)^n - 1) / r_high] × (1+r_high)
    │
    ▼
totalInvested = P × n
lowGain  = FV_low  - totalInvested
highGain = FV_high - totalInvested
    │
    ▼
ProjectGrowthOutput → MCP Response → LLM → User
```

### 10.3 Explain Data Flow

```
Input: term (string)
    │
    ▼
Normalize → lowercase
    │
    ▼
Load glossary.json (module-level cache)
    │
    ▼
Exact match (case-insensitive)?
    │
    ├── FOUND → return full entry
    │
    └── NOT FOUND → partial match?
              │
              ├── FOUND → return full entry
              │
              └── NOT FOUND → return structured error
                              { term, "not found", available terms list }
```

---

## 11. Ownership Matrix

| File/Directory | Owner | Can Others Edit? |
|---|---|---|
| `src/index.ts` | Jeevan | No |
| `src/app.module.ts` | Jeevan | No |
| `src/shared/contracts.ts` | All (frozen) | Never — read-only |
| `src/health/system.health.ts` | Jeevan | No |
| `src/clients/mfapi.ts` | Praneeth | No |
| `src/modules/eligibility/*` | Deepak | No |
| `src/modules/explain/*` | Jayaram | No |
| `src/modules/growth/*` | Praneeth | No |
| `src/modules/financial-health/*` | Praneeth | No |
| `src/modules/knowledge/*` | Jeevan | No |
| `data/schemes.json` | Jayaram | No |
| `data/glossary.json` | Jayaram | No |
| `data/hallucination_benchmark.md` | Jayaram | No |
| `package.json`, `tsconfig.json` | Jeevan | Consensus only |
| `README.md` | Jeevan (assembly) | Input from all |

### 11.1 Integration Rules

- **DO** read another owner's output (e.g., Deepak reads `schemes.json`)
- **DO NOT** write to another owner's file
- **DO NOT** rename another owner's exports, modules, or class names
- **DO NOT** change another owner's module, function, or class signatures
- **DO** open a team discussion if a contract change is required
- **DO** add new files only to your own module directory

---

## 12. Integration Contracts (contracts.ts)

> **This file is FROZEN. It defines the interface between all modules.**
> **Do NOT change any schema, type name, or type shape without full team consensus.**

### 12.1 Primitive Types

```typescript
SchemeId   = 'PMJDY' | 'APY' | 'PMJJBY' | 'PMSBY' | 'SSY' | 'SCSS' | 'NPS'
Gender     = 'male' | 'female' | 'other'
FundCategory = 'equity' | 'debt' | 'hybrid' | 'index'
Occupation = 'salaried' | 'self_employed' | 'student' | 'homemaker' | 'retired' | 'unemployed'
```

### 12.2 BaseOutput (inherited by ALL tool outputs)

```typescript
BaseOutput = {
  risk_note:       string
  educational_only: true   // Zod literal — architecturally enforced
}
```

> [!IMPORTANT]
> `educational_only: true` as a Zod literal means it is **impossible** to return a tool response without a disclaimer. The compiler will reject any attempt to omit it.

### 12.3 Tool Contracts

#### check_scheme_eligibility

```typescript
// Input
{ age: int, monthlyIncome: number, gender: Gender,
  occupation: Occupation, hasBankAccount: bool, isTaxPayer: bool }

// Output
{ eligible:   [{schemeId, schemeName, reason}]
  ineligible: [{schemeId, schemeName, failedCondition}]
  ...BaseOutput }
```

#### project_investment_growth

```typescript
// Input
{ monthlyAmount: number, years: int, fundCategory: FundCategory }

// Output
{ lowEstimate: number, highEstimate: number,
  assumptions: string[], navSource: string, ...BaseOutput }
```

#### calculate_financial_health

```typescript
// Input
{ monthlyIncome: number, monthlyExpenses: number, savings: number,
  monthlyDebtPayment: number, emergencyFundMonths: int }

// Output
{ score: int, subScores: {savingsRate, emergencyFund, debtRatio},
  suggestions: string[], ...BaseOutput }
```

#### explain_financial_concept

```typescript
// Input
{ term: string }

// Output
{ term: string, explanation: string, example: string, ...BaseOutput }
```

---

## 13. JSON Schema Specification — schemes.json

### 13.1 Top-Level Structure

A JSON **array** of exactly **7** scheme objects. Order is non-deterministic; the engine must not rely on array position.

### 13.2 Scheme Object Schema

```json
{
  "schemeId":    "string — one of 7 SchemeId values",
  "schemeName":  "string — short common name",
  "officialName":"string — full official government name",

  "eligibility": {
    "minimumAge":                  "integer | null",
    "maximumAge":                  "integer | null",
    "gender":                      "\"any\" | \"female\"",
    "incomeCeiling":               "number | null",
    "occupationEligibility":       "string[] — empty = no restriction",
    "requiresExistingBankAccount": "boolean",
    "taxpayerExcluded":            "boolean",
    "residentIndianRequired":      "boolean"
  },

  "benefits":          "string[]",
  "documents":         "string[]",
  "officialApplyLink": "string — official govt URL",
  "officialSource":    "string — official source URL",
  "notes":             "string — engine-relevant caveats"
}
```

### 13.3 Type Consistency Rules

| Field | Always | Never |
|---|---|---|
| `eligibility.gender` | `"any"` or `"female"` | `null` |
| `eligibility.occupationEligibility` | `string[]` (empty OK) | `null` |
| `eligibility.requiresExistingBankAccount` | `boolean` | `null` |
| `eligibility.taxpayerExcluded` | `boolean` | `null` |
| `benefits` | `string[]` | `null` |
| `documents` | `string[]` | `null` |

### 13.4 Eligibility Engine Field Mapping

| Field | Engine Rule |
|---|---|
| `minimumAge` | `input.age < minimumAge → fail` |
| `maximumAge` | `maximumAge !== null && input.age > maximumAge → fail` |
| `gender` | `gender !== 'any' && gender !== input.gender → fail` |
| `incomeCeiling` | `incomeCeiling !== null && income > incomeCeiling → fail` |
| `occupationEligibility` | `length > 0 && !includes(input.occupation) → fail` |
| `requiresExistingBankAccount` | `true && !hasBankAccount → fail` |
| `taxpayerExcluded` | `true && isTaxPayer → fail` |

### 13.5 Current Scheme Summary

| Scheme | minAge | maxAge | gender | bankAcct | taxpayerExcl | residentReq |
|---|---|---|---|---|---|---|
| PMJDY | 18 | null | any | false | false | true |
| APY | 18 | 40 | any | true | **true** | true |
| PMJJBY | 18 | 50 | any | true | false | true |
| PMSBY | 18 | 70 | any | true | false | true |
| SSY | 0 | 10 | **female** | false | false | true |
| SCSS | 60 | null | any | false | false | true |
| NPS | 18 | 70 | any | true | false | **false** |

---

## 14. JSON Schema Specification — glossary.json

### 14.1 Top-Level Structure

A JSON **array** of term objects. Currently 13 terms.

### 14.2 Term Object Schema

```json
{
  "term":        "string — title-case financial term",
  "definition":  "string — one-sentence precise definition",
  "explanation": "string — beginner-friendly multi-sentence explanation",
  "example":     "string — real-world Indian example with INR amounts",
  "relatedTerms":"string[] — related terms",
  "category":    "Investing | Personal Finance | Concepts | Tax & Investing"
}
```

### 14.3 Current Term List

| Term | Category |
|---|---|
| SIP | Investing |
| NAV | Investing |
| Emergency Fund | Personal Finance |
| Compound Interest | Concepts |
| ELSS | Tax & Investing |
| Mutual Fund | Investing |
| Inflation | Concepts |
| Diversification | Investing |
| Liquidity | Concepts |
| Portfolio | Investing |
| Debt Fund | Investing |
| Equity Fund | Investing |
| CAGR | Concepts |

### 14.4 Explain Engine Lookup Priority

1. Normalize input to lowercase
2. Exact match: `e.term.toLowerCase() === searchTerm`
3. If no exact match: partial/contains match
4. If still not found: structured error (no exception, no crash)

---

## 15. Environment and Configuration

### 15.1 .env Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` = STDIO only; `production` = STDIO + SSE |
| `PORT` | `3000` | HTTP port for SSE transport |
| `HOST` | `localhost` | HTTP host |
| `NITRO_LOG_LEVEL` | `info` | debug / info / warn / error |
| `NITROSTACK_APP_MODE` | `universal` | NitroStack internal mode |
| `MCP_TRANSPORT_TYPE` | (auto) | Override: `stdio`, `http`, or `dual` |
| `NITROSTACK_API_KEY` | (empty) | NitroStack cloud key (optional) |
| `ENABLE_CORS` | `true` | CORS for HTTP transport |

### 15.2 TypeScript Compiler Options

| Option | Value | Rationale |
|---|---|---|
| `target` | `ES2022` | Modern Node.js — top-level await support |
| `module` | `ES2022` | ESM modules (`.js` import extensions required) |
| `strict` | `true` | Maximum type safety |
| `experimentalDecorators` | `true` | Required for NitroStack decorators |
| `emitDecoratorMetadata` | `true` | Required for NitroStack DI |
| `resolveJsonModule` | `true` | Direct JSON import |
| `declaration` | `true` | Generate `.d.ts` type declarations |
| `sourceMap` | `true` | Debugging support |

---

## 16. Testing Strategy

### 16.1 Testing Pyramid

```
         ▲
        / \
       / E2E\   Manual demo with NitroStudio
      /───────\
     /Integration\  Tool input → tool output validation
    /─────────────\
   /  Unit Tests   \  Pure functions (SIP formula, scoring, JSON parsing)
  /─────────────────\
```

### 16.2 Unit Test Cases — Eligibility Engine

| Test | Input | Expected |
|---|---|---|
| PMJDY — 25yo male, no bank | age=25, male, hasBankAccount=false | PMJDY eligible, 4 ineligible (no bank) |
| SSY — 5yo boy | age=5, male | SSY ineligible (gender) |
| SSY — 9yo girl | age=9, female | SSY eligible |
| SSY — 10yo girl (boundary) | age=10, female | SSY eligible (inclusive) |
| SSY — 11yo girl | age=11, female | SSY ineligible (over max) |
| APY — 40yo non-taxpayer | age=40, isTaxPayer=false | APY eligible |
| APY — 40yo taxpayer | age=40, isTaxPayer=true | APY ineligible |
| APY — 41yo | age=41 | APY ineligible (over max) |
| SCSS — 60yo (boundary) | age=60 | SCSS eligible |
| SCSS — 59yo | age=59 | SCSS ineligible |
| PMSBY — 70yo (boundary) | age=70 | PMSBY eligible |
| PMSBY — 71yo | age=71 | PMSBY ineligible |
| NPS — non-resident | residentIndian=false | NPS eligible |

### 16.3 Unit Test Cases — SIP Formula

| Test | Input | Expected |
|---|---|---|
| Compound > simple | P=1000, equity, 1yr | FV > 1000×12 |
| Zero rate edge | r=0 | Returns P×n (no divide-by-zero) |
| Equity range | P=5000, equity, 10yr | low ≈ ₹10.3L, high ≈ ₹15.9L |
| Debt range | P=5000, debt, 10yr | low ≈ ₹8.2L, high ≈ ₹9.2L |

### 16.4 Unit Test Cases — Financial Health

| Test | Input | Expected Band |
|---|---|---|
| Perfect | income=100k, savings=35k, expenses=20k, debt=0 | Excellent |
| Zero savings | savings=0 | Poor |
| High debt | income=50k, debt=30k | Poor |
| Good EF only | savings=6×expenses, low income savings | Fair |

### 16.5 Unit Test Cases — Explain Engine

| Test | Input | Expected |
|---|---|---|
| Exact match | term="SIP" | Returns SIP entry |
| Case insensitive | term="sip" | Returns SIP entry |
| Partial match | term="compound" | Returns Compound Interest |
| Unknown term | term="xyz123" | Structured error with available terms |

### 16.6 Integration Test Checklist

- [ ] Server starts cleanly (`npm run dev`)
- [ ] `tools/list` returns all 4 tools
- [ ] `resources/list` returns both resources
- [ ] `prompts/list` returns both prompts
- [ ] `finbridge://schemes` returns valid JSON with 7 schemes
- [ ] `finbridge://glossary` returns valid JSON with 13 terms
- [ ] Valid tool call returns correct shape
- [ ] Invalid input returns MCP error (not a server crash)
- [ ] Health check reports correct uptime and memory

---

## 17. Deployment Strategy

### 17.1 Local Development

```bash
cd finbridge-ai
cp .env.example .env
npm install
npm run dev
```

### 17.2 Production Build

```bash
npm run build    # TypeScript → dist/
npm start        # builds then starts with STDIO + HTTP SSE
```

### 17.3 Demo Order (for Judges)

```
Step 1: Eligibility Check
  Input: 35yo salaried female, non-taxpayer, has bank account
  Show: eligible schemes with reasons, ineligible with exact conditions

Step 2: Growth Projection
  Input: ₹5,000/month, equity, 10 years
  Show: compound formula output, low ₹10.3L / high ₹15.9L, assumptions

Step 3: Financial Health
  Input: income ₹60k, expenses ₹35k, savings ₹18k, debt ₹8k, EF=6 months
  Show: score, band, personalised suggestions with actual ₹ amounts

Step 4: Explain Concept
  Input: "ELSS"
  Show: structured definition, real example, related terms

Step 5: Hallucination Benchmark
  Show the benchmark table
  Highlight: 14/30 LLM errors vs 0/30 FinBridge errors
  Live demo: APY taxpayer exclusion (LLM gets it wrong; FinBridge correct)
```

### 17.4 Pre-Demo Checklist

- [ ] `.env` has `NODE_ENV=development`
- [ ] `data/schemes.json` passes `node -e "JSON.parse(require('fs').readFileSync('data/schemes.json','utf-8'))"`
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] NitroStudio connects successfully
- [ ] All 4 tools visible in NitroStudio
- [ ] At least one tool call tested manually in NitroStudio before live demo

---

## 18. Security Considerations

### 18.1 Input Validation

All tool inputs pass through **Zod schema validation** before reaching business logic. This prevents type confusion, unexpected enum values, missing required fields, and out-of-range numbers. Rejection returns a structured MCP error — no server crash.

### 18.2 No Sensitive Data

FinBridge AI does not:
- Store user data (fully stateless per request)
- Persist PII to disk
- Log raw user inputs (only `{input}` metadata at info level)
- Require user authentication

### 18.3 File Path Safety

Data file paths are constructed using `path.join(process.cwd(), 'data', 'filename.json')`. No user-controlled segments are used in any file path.

### 18.4 Disclaimer Enforcement

`educational_only: true` is a **Zod literal** in `BaseOutput`. It is architecturally impossible to return any tool response without it. No developer can forget — the compiler rejects non-compliant code.

### 18.5 External API Safety (Future — mfapi.in)

When Praneeth integrates live mfapi.in:
- Add 3-second timeout with `AbortController`
- Add stale-while-revalidate in-memory cache
- Log API errors without exposing internal error bodies to MCP response
- Return cached data + staleness warning in `assumptions` if API is down

---

## 19. Scalability Plan

### 19.1 Current Performance Estimates

| Operation | Time | Notes |
|---|---|---|
| Server startup | ~1–2s | JSON files cached on first call |
| Eligibility check | <1ms | 7×6 in-memory rule evaluations |
| Explain lookup | <1ms | Linear scan of 13 items |
| Growth projection | <1ms | Pure math, no I/O |
| Health calculation | <1ms | Pure math, no I/O |
| mfapi.in call (future) | ~200–500ms | Network I/O; cache recommended |

### 19.2 Scaling the Scheme Rulebook

No code changes required when adding new schemes. The engine iterates over the JSON array dynamically. Add a new scheme object to `schemes.json` following the exact schema — it is automatically evaluated.

### 19.3 Scaling the Glossary

For 100+ terms, replace the linear scan with a Map for O(1) lookup:

```typescript
const glossaryMap = new Map(glossary.map(e => [e.term.toLowerCase(), e]));
```

### 19.4 Horizontal Scaling

The server is fully stateless (no shared session state). Multiple instances can run behind a load balancer. JSON file caches are per-instance (in-memory). For multi-instance consistency, JSON files can be stored on a shared volume or served from an object store.

---

## 20. Hallucination Benchmark Methodology

### 20.1 Objective

Demonstrate quantitatively that FinBridge AI's deterministic MCP approach is superior to asking an LLM directly for financial eligibility decisions.

### 20.2 Test Design

- **10 edge-case questions** covering boundary ages, gender rules, taxpayer exclusions, compound interest, and financial health severity
- **3 independent runs** per question per system (LLM vs FinBridge)
- **30 total data points** per system

### 20.3 Metrics

| Metric | Definition |
|---|---|
| Wrong verdict | Answer contradicts official government rules |
| Inconsistency | Different answer on different runs for the same question |
| False positive | Declared eligible when actually ineligible |
| False negative | Declared ineligible when actually eligible |

### 20.4 Results

| Metric | Plain LLM | FinBridge AI |
|---|---|---|
| Wrong verdicts | **14/30 (47%)** | **0/30 (0%)** |
| Inconsistent runs | 5 cases | 0 cases |
| False positives | 3 | 0 |
| False negatives | 4 | 0 |
| Math errors | 2 | 0 |

### 20.5 Most Impactful LLM Failures

1. **Q3 — APY taxpayer exclusion:** LLM wrong in 2/3 runs. Told income taxpayers they are eligible for APY when explicitly excluded since Oct 2022. Critical false positive.
2. **Q6 — SSY age-10 boundary:** LLM wrong in all 3 runs. Told parents that a 10-year-old girl is ineligible — age 10 is the inclusive maximum. Critical false negative.
3. **Q5 — PMJDY no bank account:** LLM said a bank account is required. PMJDY is precisely the scheme that creates one — no prior account needed.

---

## 21. Judge Q&A Reference

### Q: Why MCP instead of RAG?

**A:** RAG retrieves documents and the LLM makes a probabilistic guess from retrieved context. It cannot guarantee it has applied every eligibility rule from a complex document. Our MCP server evaluates each of 6 eligibility rules in sequence against the exact scheme data — the answer is identical every time. RAG excels for open-ended questions. For binary eligibility decisions with correct answers, deterministic code is the only appropriate approach.

### Q: Why not fine-tune the LLM?

**A:** Government scheme rules change frequently — APY's taxpayer exclusion was added October 2022, SCSS limits changed April 2023, SSY interest rates change quarterly. Our JSON rulebook updates in minutes by editing a file. Fine-tuning requires retraining. Our architecture separates "what the rules are" (data layer) from "how to apply them" (code layer). This separation is the correct engineering decision.

### Q: Why is `educational_only: true` enforced architecturally?

**A:** SEBI regulations require that automated systems not provide personalised investment advice. By making `educational_only: true` a Zod literal in `BaseOutput`, it is impossible for any tool to return a response without this field. No developer can forget to add a disclaimer — the TypeScript compiler rejects the code. This is making the correct behaviour the only possible behaviour.

### Q: How do you handle new government schemes?

**A:** Add a new JSON object to `schemes.json` following the exact schema. The eligibility engine iterates the array dynamically — zero code changes required. The data layer is completely decoupled from the logic layer.

### Q: What is your fallback when mfapi.in is unavailable?

**A:** Currently `mfapi.ts` is a stub using historical rate ranges. When live integration is added, the architecture supports stale-while-revalidate — if the API is down, the last cached NAV is used with a staleness note in `assumptions`. The tool never crashes; it degrades gracefully.

### Q: What makes this different from a chatbot?

**A:** A chatbot IS the LLM. FinBridge AI is a computation layer the LLM calls. The LLM remains the conversational interface; our MCP server removes financial computation from the model entirely. The result: any LLM — Claude, Gemini, GPT-4 — gives identical eligibility answers because they come from our deterministic engine, not from model weights.

### Q: How do you ensure compliance?

**A:** Every tool response contains `educational_only: true` and a `risk_note` string. These are enforced at the schema level (Zod literal), not by convention. Additionally, all official apply links point to actual government portals, and all scheme rules are sourced from official government publications.

---

## 22. Coding Standards

### 22.1 TypeScript Rules

- **Strict mode ON.** No `any` in production code except tool handler parameters (where NitroStack injects untyped input — cast immediately inside the function)
- **ES Modules.** All imports use `.js` extension — mandatory for TypeScript ESM
- **Async/await only.** No raw Promise chains
- **No magic numbers.** All constants must be named (`RATE_RANGES`, not `0.12`)
- **Module-level JSON cache.** JSON files loaded once, stored in module-level variable

### 22.2 File Naming Conventions

| Type | Pattern | Example |
|---|---|---|
| Module | `kebab-case.module.ts` | `eligibility.module.ts` |
| Tools | `kebab-case.tools.ts` | `eligibility.tools.ts` |
| Resources | `kebab-case.resources.ts` | `knowledge.resources.ts` |
| Prompts | `kebab-case.prompts.ts` | `knowledge.prompts.ts` |
| Shared types | `kebab-case.ts` | `contracts.ts` |
| Client/helper | `kebab-case.ts` | `mfapi.ts` |

### 22.3 Logging Standards

```typescript
// Entry to every tool handler:
ctx.logger.info('tool_name called', { input });

// Significant internal steps:
ctx.logger.info('schemes loaded from disk', { count: schemes.length });

// Error conditions:
ctx.logger.error('Failed to load schemes.json', { error: e.message });
```

**NEVER log:** Raw file contents, full stack traces to production, or sensitive user data.

### 22.4 Error Handling Rules

| Scenario | Handling |
|---|---|
| Term not found in glossary | Structured error object returned (not thrown) |
| JSON file missing at startup | Allow exception — crash on startup is correct |
| Invalid tool input | Zod handles; NitroStack returns MCP error |
| External API down (future) | Catch, log, return cache + staleness warning |

### 22.5 JSON Data Standards

- All URLs must be real, reachable official government URLs
- No `example.gov.in`, `localhost`, or placeholder values
- `null` for unknown values — never empty string or 0 as placeholder
- No trailing commas (RFC 8259 JSON)
- No comments in JSON files

### 22.6 Git Commit Format

```
<module>: <change summary>

eligibility: wire JSON-driven engine replacing hardcoded stub
data: enrich schemes.json with official APY taxpayer exclusion rule
explain: add partial match fallback for glossary lookup
```

---

## 23. AI Behaviour Rules

> These rules apply to every AI assistant (Antigravity, Claude, ChatGPT, Gemini) working on this project.

### 23.1 Absolute Rules — Never Violate

1. **Never redesign the architecture.** The NitroStack module structure is final.
2. **Never modify `contracts.ts`.** It is frozen. Treat as a production API surface.
3. **Never modify another owner's files.** See Ownership Matrix (Section 11).
4. **Never change module names, folder names, or export names.**
5. **Never replace deterministic computation with LLM inference.**
6. **Never add `example.gov.in` or placeholder URLs to data files.**
7. **Never invent government scheme rules.** If uncertain, use `null` + explain in `notes`.
8. **Never add `any` types without an immediate cast.**
9. **Never break the build.** Run `npm run build` before declaring completion.
10. **Never claim completion without verifying the build passes.**

### 23.2 Required Behaviours

1. **Read existing code before writing new code.**
2. **Cite uncertainty.** If a rule cannot be confirmed from official sources, say so.
3. **Extend, never replace.** Add to existing implementations; never rewrite stubs wholesale unless they are the clear target.
4. **Preserve docstrings and comments** unrelated to your changes.
5. **Use exact schema** from `contracts.ts` for all tool I/O.
6. **Cache JSON reads** at module level, not per-request.
7. **Log at entry** to every tool handler.
8. **Return `educational_only: true`** and `risk_note` in every tool response.

### 23.3 Before Making Any Change

Ask:
1. Which owner does this file belong to? → If not mine, stop.
2. Does this break any contract? → If yes, stop and discuss.
3. Does this require modifying another owner's file? → If yes, stop.
4. Will the build still pass? → Run `npm run build` to verify.
5. Have I read the full file I am about to edit?

### 23.4 When Asked to Add a New Feature

1. Identify which module it belongs to by domain
2. Check if it needs a new tool, resource, or prompt
3. New tool: add it to the appropriate `*.tools.ts` file
4. New contract type: raise with team (contracts.ts is frozen)
5. Do not create new modules — all features fit in the existing 5

---

## 24. Future Roadmap

### 24.1 Short-Term (Post-Hackathon MVP)

| Feature | Owner | Description |
|---|---|---|
| Live mfapi.in integration | Praneeth | Real NAV data for growth projections |
| mfapi cache layer | Praneeth | In-memory TTL cache for NAV responses |
| Additional glossary terms | Jayaram | Expand to 25+ terms (PPF, FD, SWP, etc.) |
| More government schemes | Jayaram | PM Kisan, PLI, PM Mudra Yojana |
| Jest unit tests | All | Full test suite with coverage reporting |

### 24.2 Medium-Term

| Feature | Description |
|---|---|
| Tax optimisation tool | Suggest optimal 80C/80D allocation for given income |
| Loan eligibility tool | Home loan / education loan eligibility |
| Retirement corpus calculator | Target corpus calculation from current age and lifestyle |
| Multi-language support | Hindi, Tamil, Telugu scheme explanations |
| PDF report export | Eligibility + growth + health report as downloadable PDF |

### 24.3 Long-Term

| Feature | Description |
|---|---|
| Live government data sync | Auto-sync scheme rule changes from official notification feeds |
| Goal-based SIP calculator | Backward SIP calculation from target corpus |
| Bank API integration | Pull actual income/expense data with user consent |
| SEBI compliance module | Validate all outputs against SEBI LODR guidelines |
| Personalised portfolio builder | Risk-profile-based fund allocation recommendations |

---

## 25. Glossary of Terms

| Term | Definition in FinBridge Context |
|---|---|
| MCP | Model Context Protocol — open standard for LLMs to call external tools |
| NitroStack | TypeScript MCP server framework used by FinBridge |
| Tool | MCP primitive — a function the LLM calls with structured inputs |
| Resource | MCP primitive — a data endpoint the LLM can read |
| Prompt | MCP primitive — a pre-built conversation template |
| Zod | TypeScript schema validation library used for all tool I/O |
| contracts.ts | Frozen file containing all shared Zod schemas |
| schemes.json | JSON rulebook with eligibility rules for all 7 government schemes |
| glossary.json | JSON dictionary of 13 financial terms |
| BFSI | Banking, Financial Services and Insurance |
| PMJDY | Pradhan Mantri Jan-Dhan Yojana |
| APY | Atal Pension Yojana |
| PMJJBY | Pradhan Mantri Jeevan Jyoti Bima Yojana |
| PMSBY | Pradhan Mantri Suraksha Bima Yojana |
| SSY | Sukanya Samriddhi Yojana |
| SCSS | Senior Citizens Savings Scheme |
| NPS | National Pension System |
| SIP | Systematic Investment Plan |
| NAV | Net Asset Value |
| CAGR | Compound Annual Growth Rate |
| SEBI | Securities and Exchange Board of India |
| PFRDA | Pension Fund Regulatory and Development Authority |
| mfapi.in | Open-source Indian mutual fund API |
| SSE | Server-Sent Events — HTTP transport for MCP in production |
| STDIO | Standard Input/Output — MCP transport for local development |
| HLD | High-Level Design |
| LLD | Low-Level Design |
| DBT | Direct Benefit Transfer |
| ITR | Income Tax Return |
| EF | Emergency Fund |

---

*End of Document*

> **This document reflects the state of the codebase as of 2026-07-26.**
> **Update it whenever: (1) a new module is added, (2) contracts.ts changes, (3) data schema changes, (4) team ownership changes.**
