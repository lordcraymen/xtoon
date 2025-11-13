---
title: "ADR-0004: RFC 4180 CSV Quoting and Escaping"
date: "2025-11-13"
status: Accepted
tags:
  - specification
  - parsing
  - security
modules:
  - src/parser/
  - src/
summary: >-
  Adopt RFC 4180 as the authoritative CSV quoting and escaping specification for XTOON row parsing, with clarifications for tail capture and error handling.
---

# Context

GitHub Issue #7 identified that the README mentions "classic CSV quoting (`"…"`, `""` escape)" but lacks a complete specification. This creates ambiguity around:

1. **Quoting rules**: When are quotes required? What characters trigger quoting?
2. **Escaping**: How to include literal quotes, delimiters, or newlines?
3. **Whitespace handling**: Are spaces inside/outside quotes treated differently?
4. **Multi-line rows**: Can a quoted field span multiple lines?
5. **Tail capture interaction**: How does `...` on the last column interact with CSV quoting?
6. **Security**: What injection attacks must we prevent?

Without a formal specification, implementation is blocked (P0) and security vulnerabilities (P1) may be introduced.

## Relevant Questions from Issue #7

- **Q1.2.1**: What is the complete quoting/escaping spec?
- **Q1.2.2**: How do quotes interact with tail capture (`...`)?
- **Q1.2.3**: How are leading/trailing spaces handled for quoted vs unquoted cells?
- **Q1.2.4**: Are there escape sequences for special characters in scalar cells?
- **Q1.5.4**: How are multi-line rows handled?

## Current State

README line 109 states:
> The agent accepts classic CSV quoting (`"…"`, `""` escape) but does **not** require it; `xml(desc)...` is usually enough to avoid quoting entirely.

This is incomplete and ambiguous.

# Decision

**Adopt RFC 4180 as the authoritative CSV quoting and escaping specification** with the following clarifications for XTOON-specific features.

## RFC 4180 Summary (Normative Reference)

From [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180.html):

1. **Optional Quoting**: Fields may be enclosed in double-quotes (`"`)
2. **Required Quoting**: Fields MUST be quoted if they contain:
   - The delimiter character (e.g., `,`)
   - Double-quote character (`"`)
   - Line breaks (CR, LF, or CRLF)
3. **Quote Escaping**: Literal double-quote inside quoted field → doubled (`""`)
4. **No Other Escapes**: Backslash has no special meaning; `\"` is literal backslash + quote
5. **Multi-line Fields**: Quoted fields may contain line breaks (part of field value)
6. **Whitespace**: Spaces inside quotes are preserved; outside quotes are trimmed (implementation-defined)

## XTOON-Specific Clarifications

### 1. Tail Capture Override (Q1.2.2)

When the last column uses tail capture (`...`), it consumes the remainder of the line **verbatim** without CSV quote processing.

**Rationale**: Tail capture is designed for complex content like XML fragments where quotes are content, not delimiters.

**Example**:
```xml
<items xt:sep="," xt:table="{@id, name, xml(content)...}">
  1,Alice,<p>"Hello" she said</p>
</items>
```

- Columns 1-2 (`id`, `name`): CSV parsing with quote processing
- Column 3 (`content...`): Raw text from first `<` to EOL (no quote processing)

**Rule**: The delimiter before the tail capture column is the last delimiter processed; everything after is raw.

### 2. Whitespace Handling (Q1.2.3)

Following common CSV implementations:

| Context | Spaces | Trimmed? | Example | Result |
|---------|--------|----------|---------|--------|
| Outside quotes | Leading/trailing | ✅ Yes | `  Alice  ` | `Alice` |
| Inside quotes | Any position | ❌ No | `"  Alice  "` | `  Alice  ` |
| Quote boundary | Before/after quotes | ✅ Yes | `  "Alice"  ` | `Alice` |

**Rule**: Trim spaces outside quote boundaries; preserve spaces inside quotes.

### 3. Escape Sequences (Q1.2.4)

**Only one escape mechanism**: Double-quote (`""`) for literal quote inside quoted field.

**No support for**:
- Backslash escapes (`\n`, `\t`, `\"`)
- Unicode escapes (`\uXXXX`)
- Hex escapes (`\xXX`)

**Rationale**: RFC 4180 compliance; predictable behavior; use tail capture or `xml()` for complex content.

**Examples**:
```csv
id,description
1,"He said ""Hello"""       → He said "Hello"
2,"Backslash: \"            → Backslash: \
3,"Newline inside
quote is preserved"         → Multi-line value
```

### 4. Multi-line Rows (Q1.5.4)

**Supported** per RFC 4180: Quoted fields may contain literal newlines (CR/LF/CRLF).

**Parsing behavior**:
- Open quote starts multi-line mode
- Continue reading lines until closing quote found
- Newlines become part of field value

**Example**:
```xml
<items xt:sep="," xt:table="{@id, text(description)}">
  1,"Line 1
Line 2
Line 3"
  2,Single line
</items>
```

**Row 1 value**: `Line 1\nLine 2\nLine 3` (literal newlines)

**Error location reporting**: Multi-line fields complicate row/column reporting. Solution: Report **field start location** (row/col where quote opened) in error messages.

### 5. Error Handling

#### Expand Mode (Production)
**Fail-fast**: Unmatched quotes or malformed CSV → immediate error, exit code 1.

```csv
id,name
1,"Alice    ← ERROR: Unclosed quote
2,Bob
```

Error: `Parse error at row 2, col 6: Unclosed quoted field (started at row 2, col 3)`

#### Lint Mode (Validation)
**Warn and continue**: Report all issues, attempt recovery using heuristics.

**Recovery strategies**:
1. **Unclosed quote at EOL**: Treat as if quote closed at EOL; warn
2. **Unmatched quote mid-field**: Treat quote as literal; warn
3. **Quote in unquoted field**: Treat as literal character; warn

**Rationale**: Lint mode shows all problems at once for batch fixing; expand mode ensures correctness.

## Security Considerations (Q1.2.1 partial)

### XXE (XML External Entity) - High Priority

**Risk**: `xml()` modifier parses user-provided XML fragments. If external entities are enabled, attacker can read files or perform SSRF.

**Example attack**:
```csv
id,content
1,"<?xml version='1.0'?><!DOCTYPE foo [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><data>&xxe;</data>"
```

**Mitigation** (SEC-04 requirement):
- **Disable external entities** in XML parser configuration
- Reject DOCTYPE declarations in `xml()` fragments
- Validate before parsing; error on suspicious patterns

**Test cases required**:
- External entity references → error
- System entity references → error
- Parameter entities → error
- DOCTYPE with SYSTEM → error

### CSV Injection (Formula Injection) - Out of Scope

**Risk**: Fields starting with `=`, `+`, `@`, or `-` may execute as formulas in Excel.

**Example**:
```csv
id,formula
1,=cmd|'/c calc'!A1
```

**Decision**: **Not mitigated** by XTOON. This is a spreadsheet application concern, not an XML processing concern.

**Recommendation**: Document in README that XTOON output is for XML processing, not direct import to spreadsheets.

### Newline Injection - Correct Behavior

**Risk**: Multi-line quoted fields could inject fake rows in naive parsers.

**Decision**: This is **correct RFC 4180 behavior**. Downstream consumers must handle multi-line fields properly.

## Validation Rules

### Parse-Time Validation (Expand Mode)

1. **Unclosed quote at EOF** → Error
2. **Quote inside unquoted field** → Error (ambiguous intent)
3. **Wrong number of columns** → Error (unless last has `...`)
4. **Delimiter in unquoted field** → Error (should be quoted)

### Lint-Time Validation

1. All parse-time errors → Warnings (with recovery)
2. **Inconsistent column counts** → Warning across rows
3. **Suspicious patterns** → Warning (e.g., `="...`)

## Examples

### Basic Quoting
```csv
id,name,note
1,Alice,No quotes needed
2,Bob,"Has, comma"
3,Charlie,"Has ""quote"""
```

### Multi-line with `text()` Modifier
```xml
<items xt:sep="," xt:table="{@id, text(content)}">
  1,"Line 1
Line 2"
  2,Single
</items>
```

### Tail Capture Skips Quote Processing
```xml
<items xt:sep="," xt:table="{@id, xml(content)...}">
  1,<note type="quoted">"Not a CSV quote"</note>
</items>
```

The `"Not a CSV quote"` is XML content, not processed as CSV quotes.

# Consequences

## Positive

1. **Unambiguous Specification**: RFC 4180 is well-documented and understood
2. **Interoperability**: Standard CSV tools can generate input for XTOON
3. **Security**: Well-tested standard; known attack vectors and mitigations
4. **Multi-line Support**: Enables complex text content in cells
5. **Predictable Behavior**: Users familiar with CSV know what to expect
6. **Less Documentation**: Reference RFC 4180 instead of inventing rules

## Negative

1. **Multi-line Complexity**: Parser must track quote state across lines
2. **Error Reporting**: Multi-line fields complicate row number reporting
3. **Tail Capture Exception**: One special case to document and test
4. **No Backslash Escapes**: Users from other tools may expect `\n`

**Mitigation**: Comprehensive test suite covering all edge cases; clear error messages.

## Implementation Requirements

### Parser Changes

1. **Tokenizer**: Implement RFC 4180 compliant CSV parser
   - Track quote state
   - Handle multi-line fields
   - Respect tail capture override

2. **Error Handling**: Differentiate expand vs lint mode
   - Expand: fail-fast
   - Lint: warn and recover

3. **XML Parser Configuration**: Disable external entities
   - Set `noent: false` (libxmljs) or equivalent
   - Reject DOCTYPE declarations
   - Add security test cases

### Documentation Updates

1. **README.md**: Replace line 109 vague statement with:
   > XTOON follows [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180.html) for CSV quoting and escaping. Fields containing the delimiter, quotes, or newlines must be quoted. Literal quotes are escaped by doubling (`""`). The tail capture operator (`...`) on the last column overrides CSV quote processing for that column.

2. **Add Examples**: Show multi-line, quoting, and tail capture

3. **Security Section**: Document XXE mitigation requirement

### Test Cases Required

| Category | Test Case | Expected |
|----------|-----------|----------|
| Basic quoting | `"value"` | `value` |
| Quote escape | `"He said ""Hi"""` | `He said "Hi"` |
| Multi-line | `"Line1\nLine2"` (literal newline) | Two-line value |
| Unquoted spaces | `  value  ` | `value` (trimmed) |
| Quoted spaces | `"  value  "` | `  value  ` (preserved) |
| Tail capture | `xml(x)...,<p>"quote"</p>` | Quotes are XML content |
| Unclosed quote (expand) | `"value\n` | Error |
| Unclosed quote (lint) | `"value\n` | Warning + recovery |
| XXE attack | DOCTYPE with SYSTEM | Error |

# Alternatives Considered

## Alternative 1: Single-Line Strict CSV

Adopt RFC 4180 minus multi-line support.

**Rejected**: Multi-line is valuable for text content; parser complexity is manageable.

## Alternative 2: Custom Quoting Rules

Invent XTOON-specific quoting (e.g., support `\'` escapes).

**Rejected**: Reinventing the wheel; RFC 4180 is proven; avoid compatibility issues.

## Alternative 3: No Formal Spec

Leave quoting behavior "implementation-defined."

**Rejected**: P0 blocker; ambiguity causes bugs and security issues.

# References

- [RFC 4180: Common Format and MIME Type for CSV Files](https://www.rfc-editor.org/rfc/rfc4180.html)
- GitHub Issue #7: [P0] Define complete CSV quoting and escaping specification
- AGENTS.md SEC-04: Prevent XML external entity (XXE) attacks
- ADR-0003: No CLI Parameter Overrides (confirms `xt:sep` is document-level)

# Linked Issues

- Resolves: GitHub Issue #7
- Related: SEC-04 (XXE prevention)
- Related: XTOON-03 (error reporting with row/col)
