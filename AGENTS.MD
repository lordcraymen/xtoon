# Agent Policy (v1.0)

## Priorities
P0 Correctness > P1 Security > P2 Maintainability > P3 Performance > P4 Speed.

## Definition of Done
- [DOD-01] All new/changed code has unit tests (min 80% coverage in changed files).
- [DOD-02] Formatter + linter pass: `npm run lint` and `npm run type-check` with no errors.
- [DOD-03] No new runtime warnings in `npm test`.
- [DOD-04] Public APIs documented with JSDoc and 1 usage example.
- [DOD-05] No secrets/keys; config via env vars only.

## SOLID & Clean Code (enforced subset)
- [SOLID-SRP-01] Max 1 responsibility per module; split if >250 LOC or >2 concerns.
- [SOLID-DIP-02] Depend on interfaces/abstractions; **inject dependencies as parameters**.
- [SOLID-DIP-03] Load config **once** at app entry; pass `config` to all components.
- [CLEAN-NAM-01] Names are descriptive; abbreviations only: cfg, ctx, idx, tmp, req, res, ns (namespace), qn (QName).
- [CLEAN-FUNC-02] Functions ≤ 30 LOC; >2 branches → extract.
- [CLEAN-ERR-03] No bare `catch`; use specific error classes (XTOONError, ParseError, ValidationError).
- [CLEAN-IMM-04] Prefer pure functions; avoid global state.

## Style & Tooling
- [STYLE-01] TypeScript strict mode; no `any` without comment `// justification: REASON`.
- [STYLE-02] Use ESLint rules in `.eslintrc.cjs`; no suppressions without inline comment.
- [STYLE-03] Run `npm run lint` and `npm run type-check` before committing.

## Tests
- [TEST-01] Unit tests: Arrange-Act-Assert; one assertion per test case.
- [TEST-02] BDD: Tag with `@wip` until implemented; `@implemented` when ready.
- [TEST-03] Mock external dependencies via DI; no network calls in unit tests.
- [TEST-04] Test both valid and invalid XML/XTOON syntax; verify error messages include row/column pointers.

## Security
- [SEC-01] Validate all external inputs using Zod schemas.
- [SEC-02] Secrets from env vars only; never hardcode (see [DOD-05]).
- [SEC-03] Log errors without exposing sensitive data.
- [SEC-04] Prevent XML external entity (XXE) attacks; disable external entities in parser.

## XTOON-Specific Rules
- [XTOON-01] **Deterministic expansion**: No cross-insertion; each `xt:table` block expands independently.
- [XTOON-02] **Namespace preservation**: All QNames (e.g., `s:Person`) resolve using in-scope `xmlns:*` exactly as written.
- [XTOON-03] **Error reporting**: Include row number, column number, and context snippet in all parse/validation errors.
- [XTOON-04] **Column modifiers**: Validate function-style modifiers (`xml()`, `json()`, `binary()`, etc.) during parse, not expansion.
- [XTOON-05] **Tail capture**: Only the final column may use `...`; error on misplaced tail capture.
- [XTOON-06] **Delimiter precedence**: Element-level `xt:sep` overrides global/CLI `--sep`.

## Logging & CLI
- [LOG-01] Use structured logging: `logger.info({ row, col, file }, 'message')`.
- [LOG-02] CLI exit codes: 0 = success, 1 = parse/validation error, 2 = usage error.
- [LOG-03] `--stop-at N` limits error count; still report total error count at end.

## Output Contract
Return:
1. **PLAN**: Brief summary of changes (2-4 lines).
2. **CHANGES**: List files modified with 1-line description each.
3. **SELF-CHECK**: List DOD/SOLID/STYLE/SEC/XTOON IDs with pass/fail + brief evidence.

## Post-Feature Review (Mandatory)
After completing a feature or refactor:
1. **Document lessons** in `docs/LESSONS_LEARNED.md`
2. **Review guardrails**: Does `AGENTS.md` need updates?
3. **Update patterns**: Do `docs/ARCHITECTURE.md` or `docs/TESTING.md` need updates?
4. **Keep focused**: Remove outdated content from LESSONS_LEARNED.md

---

## Drill-Down References

**When you need more detail**, consult these docs in order:

### Architecture & Patterns
- **SOLID Principles**: See `docs/ARCHITECTURE.md` → SOLID section
- **Dependency Injection**: See `docs/ARCHITECTURE.md` → DI Pattern section
- **Error Handling**: See `docs/ARCHITECTURE.md` → Error Handling section
- **Lessons Learned**: See `docs/LESSONS_LEARNED.md` → Past decisions & rationale

### Testing
- **Unit Tests**: See `docs/TESTING.md` → Unit Tests section
- **BDD/Cucumber**: See `docs/TESTING.md` → BDD section
- **Test Structure**: See `docs/TESTING.md` → Structure section

### Development Workflow
- **Branching**: See `docs/CONTRIBUTING.md` → Branch Strategy section
- **Commits**: See `docs/CONTRIBUTING.md` → Commit Guidelines section
- **PRs**: See `docs/CONTRIBUTING.md` → Pull Request section

### Technical Guides
- **XTOON Grammar**: See `README.md` → Grammar section
- **Column Modifiers**: See `README.md` → Built-in column modifiers section
- **ADR Process**: See `docs/ADR_GUIDELINES.md`

---

## Quick Reference

### Common Patterns

**Dependency Injection**:
```typescript
// ❌ BAD - Hidden dependency
function expandTable() {
  const config = loadConfig();  // Created internally
}

// ✅ GOOD - Injected dependency
function expandTable(config: XTOONConfig) {
  // Config passed as parameter
}
```

**Error Handling**:
```typescript
// ❌ BAD - Generic error
throw new Error('Parse failed');

// ✅ GOOD - Specific error with context
throw new ParseError('Invalid column modifier', { 
  row: 3, 
  col: 2, 
  modifier: 'xml' 
});
```

**Namespace Handling**:
```typescript
// ❌ BAD - Hardcoded namespace
const XTOON_NS = 'urn:xtoon';

// ✅ GOOD - Resolve from context
const xtoonNs = element.lookupNamespaceURI('xt');
if (xtoonNs !== 'urn:xtoon') {
  throw new ValidationError('Invalid xtoon namespace');
}
```

### Pre-Commit Checklist (30 seconds)
1. [ ] Run `npm run lint` → passes
2. [ ] Run `npm run type-check` → passes
3. [ ] Run `npm test` → passes
4. [ ] Review changed files for SOLID violations
5. [ ] Test with sample XTOON files (valid & invalid)

---

## Context Hierarchy

**Level 1 (Always)**: This file (AGENTS.md)
**Level 2 (On demand)**: `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/CONTRIBUTING.md`
**Level 3 (Reference)**: `docs/ADR_GUIDELINES.md`, ADRs in `docs/adr/`

Read `README.md` for project overview and XTOON syntax reference.
