---
title: "ADR-0006: QName Resolution and Namespace Handling"
date: "2025-11-14"
status: Accepted
tags:
  - specification
  - parser
  - namespaces
modules:
  - src/parser/
  - src/expander/
summary: >-
  Defines when and how XML QNames and namespaces are resolved in XTOON templates, establishing a two-phase approach (parse-time syntax validation, expansion-time URI resolution) and confirming standard XML namespace inheritance rules apply.
---

# Context

Issue [#9](https://github.com/lordcraymen/xtoon/issues/9) identified critical ambiguities in how XTOON handles XML qualified names (QNames) and namespace resolution:

**Contradictions in existing documentation**:
- README states both "resolve QNames in current namespace context" and "Namespace resolution at expansion time"
- XTOON-04 requires "Validate function-style modifiers during parse, not expansion"
- XTOON-02 requires "Preserve namespaces and QName resolution exactly as written"

**Unresolved questions**:
1. When are QNames resolved — parse time or expansion time?
2. How are default namespaces (`xmlns="..."`) handled?
3. Can prefixes be declared on the `xt:table` element itself?
4. Are namespace prefixes preserved in output?
5. What happens if an `xml()` fragment uses undefined prefixes?

**Impact**: This is a P0 blocking issue. Without clear namespace handling rules, the parser and expander cannot be implemented correctly, and XTOON documents may produce invalid XML output.

# Decision

## Core Principle: XML Standards Compatibility

**XTOON follows standard XML rules for namespace handling.** XTOON-specific rules may be stricter than XML but never contradict XML specifications.

- **Input**: XTOON templates must be valid XML (well-formed, namespaces declared)
- **Output**: Expanded XTOON must be valid XML (well-formed, namespaces resolved)
- **Validation**: A valid XTOON document should pass standard XML linters

## Two-Phase QName Resolution

| Phase | What Happens | Purpose |
|-------|-------------|---------|
| **Parse Time** | Validate QName syntax (`prefix:localName`)<br>Check if namespace prefixes are declared in scope | Fail fast on structural errors (XTOON-04) |
| **Expansion Time** | Resolve prefix to namespace URI using in-scope `xmlns:*`<br>Generate output elements with correct namespace bindings | Apply namespaces to actual row data |

**Rationale**: This aligns with XTOON-04 (validate structure early) while deferring URI resolution until row data is available.

## Specific Resolutions

### Q1.4.1: Resolution Timing
**Decision**: Two-phase approach as described above.

### Q1.4.2: Default Namespace Handling
**Decision**: **Standard XML rules apply** — unprefixed elements inherit the default namespace from their parent; can be overridden with explicit `xmlns` declarations.

**Example**:
```xml
<items xmlns="http://example.org" xt:table="{@id, name}">
  1,Alice
</items>
<!-- Output: -->
<items xmlns="http://example.org">
  <item id="1">
    <name>Alice</name>  <!-- 'name' inherits http://example.org -->
  </item>
</items>
```

**Rationale**: This is simpler and more correct than defining custom rules. Users familiar with XML will have intuitive behavior.

### Q1.4.3: Prefix Declaration Scope
**Decision**: **Yes**, namespace prefixes declared on the `xt:table` element (or any ancestor) are in scope for column definitions and generated output.

**Example**:
```xml
<items xmlns:s="http://schema.org" xt:table="{@id, s:name}">
  1,Alice
</items>
```

**Rationale**: Standard XML namespace scoping rules apply.

### Q1.4.4: Prefix Preservation
**Decision**: **Yes**, preserve namespace prefixes exactly as written in column definitions (XTOON-02).

**Example**:
```xml
<items xmlns:s="http://schema.org" xt:table="{s:name}">
Alice
</items>
<!-- Output uses 's:' prefix, not expanded form: -->
<items xmlns:s="http://schema.org">
  <item>
    <s:name>Alice</s:name>  <!-- Prefix 's:' preserved -->
  </item>
</items>
```

**Rationale**: Preserves author intent and maintains readability. Alternative (expanding to full URIs) would make output verbose and unreadable.

### Q1.4.5: Undefined Prefixes in `xml()` Fragments
**Decision**: **Parse and validate XML fragments at expansion time; fail fast on errors.**

**Validation requirements**:
- Check well-formedness (balanced tags, proper XML syntax)
- Verify all namespace prefixes are declared (either in template or within the fragment itself)
- Report errors immediately with CSV row/column context (XTOON-03)
- Stop processing on first error (fail fast), unless `--stop-at N` flag is used

**Self-contained namespace declarations**: Fragments may declare their own namespaces using `xmlns:*` attributes. This is valid per standard XML rules.

**Example (valid - self-contained)**:
```xml
<items xt:table="{@id, xml(desc)}">
  1,<s:tag xmlns:s="http://schema.org">Valid</s:tag>
</items>
```

**Example (invalid - undefined prefix)**:
```xml
<items xmlns:s="http://schema.org" xt:table="{@id, xml(desc)}">
  1,<p:tag>Invalid</p:tag>
</items>
<!-- Error at row 1, column 2: Undefined namespace prefix 'p:' in XML fragment -->
```

**Rationale**: Fail fast prevents cascading errors and provides clear, actionable error messages pointing to the exact CSV row/column where the problem originated.

# Consequences

## Positive

1. **Clear implementation path**: Developers know exactly when and how to validate/resolve QNames
2. **Standard XML behavior**: Users familiar with XML will have intuitive, predictable behavior
3. **Better error messages**: Expansion-time validation provides CSV row/column context (XTOON-03)
4. **Fail fast**: Structural errors caught at parse time; data errors caught at expansion with context
5. **Simpler documentation**: "Follow XML standards" is clearer than custom rules

## Negative

1. **Two-phase complexity**: Implementation must track namespace context from parse through expansion
2. **Fragment validation overhead**: Each `xml()` fragment must be parsed and validated at expansion time
3. **Error location tracking**: Must maintain mapping between CSV positions and XML parse errors

## Implementation Notes

### Parse-Time Validation
- Validate QName syntax matches `(Prefix ":")? LocalName`
- Check that all prefixes used in column definitions are declared in scope
- Build namespace context map for use during expansion

### Expansion-Time Processing
- Resolve prefixes to URIs using namespace context
- For `xml()` modifiers:
  - Parse fragment using XML parser
  - Validate well-formedness
  - Check namespace prefix declarations
  - Splice nodes into output tree
- Preserve namespace prefixes as written (XTOON-02)

### Error Reporting
All errors must include (per XTOON-03):
- CSV row number
- CSV column number
- Context snippet showing the problematic content
- Clear description of what's wrong and how to fix it

# References

- Issue [#9: QName resolution timing and namespace handling](https://github.com/lordcraymen/xtoon/issues/9)
- [XTOON-02] Namespace preservation rule in `AGENTS.md`
- [XTOON-03] Error reporting requirements in `AGENTS.md`
- [XTOON-04] Column modifier validation timing in `AGENTS.md`
- [W3C XML Namespaces Recommendation](https://www.w3.org/TR/xml-names/)
- ADR-0004: RFC 4180 CSV Quoting and Escaping (for CSV row/column tracking)
- ADR-0005: Column Definition Syntax and Formal Grammar (for QName syntax)
