---
title: "ADR-0003: No CLI Parameter Overrides - Document-Centric Design"
date: "2025-11-13"
status: Accepted
tags:
  - architecture
  - cli
  - design-principle
modules:
  - src/cli.ts
  - src/
summary: >-
  Establish that XTOON documents are self-describing and portable. All processing parameters must be specified in XML attributes, not CLI flags. CLI is for input/output paths and process control only.
---

# Context

During specification of issue #6 (delimiter precedence), we identified a fundamental architectural question: Should CLI flags be able to override document-level parameters like `xt:sep`?

## The Conflict

- **AGENTS.md** (XTOON-06): "`xt:sep` overrides CLI `--sep`"
- **README.md** (CLI docs): "`--sep` overrides `xt:sep`"

This revealed a deeper tension between two design philosophies:

1. **CLI-centric**: Command-line flags control processing behavior
2. **Document-centric**: XML documents specify their own processing requirements

## Real-World Implications

### Problem with CLI Overrides

```xml
<!-- alice.xml -->
<items xt:table="{id,name}">
  1|Alice
</items>
```

If CLI could override `xt:sep`:
- Alice runs: `xtoon --sep="|" alice.xml` → works
- Bob receives `alice.xml`, runs: `xtoon alice.xml` → fails (wrong delimiter)
- Document has hidden dependency on CLI flags
- Not portable or reproducible

### Mixed Delimiter Requirement

Real documents need multiple delimiters:

```xml
<report>
  <!-- CSV from one source -->
  <sales xt:sep="," xt:table="{date,amount}">
    2025-01-01,100.50
  </sales>
  
  <!-- Pipe-delimited from another -->
  <inventory xt:sep="|" xt:table="{sku,qty}">
    ABC|50
  </inventory>
</report>
```

A global `--sep` CLI flag **cannot** handle this use case.

# Decision

**Design Principle**: **No CLI parameter overrides - use XML features instead**

## Specific Decisions

1. **Remove `--sep` CLI flag entirely**
   - `xt:sep` attribute is **required** on every `xt:table` element
   - No default delimiter (force explicit declaration)
   - Parser error if `xt:sep` is missing

2. **CLI Scope Definition**
   - ✅ **Input/Output**: File paths, stdin/stdout control
   - ✅ **Process Control**: Logging level, error limits (`--stop-at`)
   - ✅ **Output Format**: Pretty-print, validation mode
   - ❌ **Document Parameters**: Delimiters, namespaces, data interpretation

3. **XML Features for "Global" Defaults**
   - Use XML entity references for repeated values:
     ```xml
     <!DOCTYPE data [
       <!ENTITY sep ",">
     ]>
     <data>
       <items xt:sep="&sep;" xt:table="{id,name}">...</items>
       <orders xt:sep="&sep;" xt:table="{id,product}">...</orders>
     </data>
     ```
   - Use XSLT preprocessing for bulk transformation
   - Accept minimal repetition (one attribute per table)

## Validation Rules

```xml
<!-- ✅ Valid -->
<items xt:sep="," xt:table="{id,name}">
  1,Alice
</items>

<!-- ❌ Error: missing xt:sep -->
<items xt:table="{id,name}">
  1,Alice
</items>
<!-- Parser error: "xt:sep attribute required on xt:table elements" -->
```

# Consequences

## Positive

1. **Document Portability**
   - Documents work identically regardless of who runs them
   - No "works on my machine" issues from CLI flag differences
   - Documents are self-describing and auditable

2. **Mixed Delimiters**
   - Different tables can use different delimiters naturally
   - Matches real-world data integration scenarios

3. **Simpler Implementation**
   - No precedence rules to implement or test
   - No config passing through layers
   - Less CLI surface area to document

4. **Explicit Over Implicit**
   - Forces users to declare intentions clearly
   - Reduces bugs from wrong assumptions
   - Better code review visibility

5. **Reproducibility**
   - Same XML input → same output, always
   - Critical for testing and CI/CD
   - Better for version control

## Negative

1. **More Verbose Documents**
   - Each `xt:table` must specify `xt:sep`
   - Cannot omit for "standard" case
   - **Mitigation**: Use XML entities for repetition

2. **Cannot Fix Broken Documents**
   - If document has wrong `xt:sep`, cannot override via CLI
   - **Mitigation**: This is actually desirable (fail fast vs produce garbage)
   - Users can edit XML or use XSLT transformation

3. **Migration from Other Tools**
   - Users from tools with CLI defaults may find this stricter
   - **Mitigation**: Clear error messages guide to solution

## Implementation Changes

### Remove

- `--sep` CLI flag parsing
- Delimiter config passing
- Precedence resolution logic

### Add

- Validation: `xt:table` without `xt:sep` → parse error
- Error message: "xt:sep attribute required. Specify delimiter like: xt:sep=\",\""

### Update

- README: Remove `--sep` from CLI docs
- README: Show `xt:sep` in all examples
- Tests: Remove CLI flag tests, add missing-sep validation

# References

- Issue #6: [P0] Clarify delimiter precedence rules
- XTOON-06 policy in AGENTS.md: "Element-level xt:sep overrides global/CLI --sep"
- Design philosophy: Explicit Configuration over Implicit Defaults
