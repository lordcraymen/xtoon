---
title: "ADR-0009: Two-Phase Validation Strategy"
date: "2025-11-17"
status: Accepted
tags:
  - specification
  - validation
  - parser
  - expander
modules:
  - src/parser/
  - src/expander/
summary: >-
  Establishes a two-phase validation model (parse-time structural validation, expansion-time content validation) that applies to all column modifiers, ensuring fail-fast error detection while deferring content-specific validation to expansion.
---

# Context

Issue [#12](https://github.com/lordcraymen/xtoon/issues/12) identified a critical contradiction in the README about when validation occurs:

**Apparent contradiction**:
- XTOON-04 states: "Validate function-style modifiers during parse, not expansion"
- README "Expand" section states: "Validate rows and cells against column modifiers"

This ambiguity blocks correct implementation of the parser and expander. Without clear validation boundaries, it's unclear:
1. What should be validated at parse time vs expansion time?
2. When do we check modifier syntax vs cell content?
3. How do we balance fail-fast error detection with deferred content validation?

**Existing patterns** (implicit two-phase approach):
- **ADR-0006** (QName Resolution): Parse-time syntax validation, expansion-time URI resolution
- **ADR-0007** (`xml()` modifier): Parse-time syntax validation, expansion-time fragment parsing
- **ADR-0008** (`json()` modifier): Parse-time parameter validation, expansion-time JSON parsing

However, this two-phase pattern was never explicitly documented as a general principle, leading to confusion.

**Impact**: P0 blocking issue. Parser and expander need clear validation boundaries to implement correctly and consistently across all modifiers.

# Decision

XTOON implements a **two-phase validation strategy** that applies uniformly to all column modifiers and tabular constructs.

## Phase 1: Parse-Time Validation (Structural)

**Purpose**: Fail fast on structural errors before processing any row data.

**Timing**: During initial XML parsing and column definition analysis.

**What is validated**:

### 1.1 Modifier Syntax
- Modifier name is recognized (exists in built-in set or extensions)
- Function-style syntax is correct: `name(arg1, arg2, ...)`
- Parentheses are balanced
- Arguments are properly separated by commas

**Example errors**:
```
Unknown modifier name 'xm' at row 0, column 2
Syntax error: unclosed parenthesis in 'json(data' at row 0, column 3
```

### 1.2 Parameter Structure
- Required parameters are present
- Parameter syntax follows `key=value` pattern (where applicable)
- No duplicate parameter names
- Parameter positions are valid (e.g., first argument is always the column/element name)

**Example errors**:
```
Missing required parameter 'name' in 'json()' at row 0, column 2
Duplicate parameter 'item' in 'json(data, item=foo, item=bar)' at row 0, column 3
```

### 1.3 QName Validity
- All QNames (element names, parameter values) follow valid XML name syntax
- QNames using prefixes have those prefixes declared in scope (per ADR-0006)
- No reserved names (e.g., `xml`, `xmlns`)

**Example errors**:
```
Invalid QName '123name' (must start with letter or underscore) at row 0, column 1
Undeclared namespace prefix 's' in 's:Person' at row 0, column 2
```

### 1.4 Structural Constraints
- Tail capture (`...`) only on the last column
- Only one tail capture per row
- `xt:sep` attribute present on all `xt:table` elements (per ADR-0003)

**Example errors**:
```
Tail capture '...' not allowed on column 2 (must be last column) at row 0
Multiple tail capture columns at row 0
Missing required 'xt:sep' attribute on xt:table element
```

### 1.5 Parameter Type Validation
- Numeric parameters (e.g., `w`, `h` in `image()`) are valid numbers
- Enum parameters (e.g., `codec` in `binary()`) use valid values
- Boolean parameters are `true` or `false`

**Example errors**:
```
Invalid codec 'base32' in 'binary(data, codec=base32)' (expected: base64|hex) at row 0, column 2
Invalid number 'abc' for parameter 'w' in 'image(photo, w=abc)' at row 0, column 1
```

**What is NOT validated at parse time**:
- Cell content (CSV values)
- JSON syntax in cells
- XML well-formedness in cells
- Scalar type coercion (int/float/bool/date values)
- Security constraints on cell content

## Phase 2: Expansion-Time Validation (Content)

**Purpose**: Validate actual cell content against modifier requirements.

**Timing**: During row-by-row expansion, after CSV parsing, for each cell.

**What is validated**:

### 2.1 Content Syntax
- JSON cells contain valid JSON (per ADR-0008)
- XML cells are well-formed fragments (per ADR-0007)
- Binary cells use valid encoding alphabet (base64/hex)

**Example errors**:
```
Invalid JSON syntax in cell: unexpected token '}' at row 3, column 2
XML fragment not well-formed: unclosed tag '<name>' at row 5, column 4
Invalid base64 character '!' at row 2, column 3
```

### 2.2 Scalar Coercion
- `int()` cells contain valid integers
- `float()` cells contain valid floating-point numbers
- `bool()` cells contain valid boolean representations
- `date()`/`datetime()` cells match specified format

**Example errors**:
```
Cannot coerce 'abc' to integer at row 4, column 1
Invalid date format 'not-a-date' (expected YYYY-MM-DD) at row 6, column 3
```

### 2.3 Security Constraints
- Prototype pollution prevention (forbidden JSON keys per ADR-0008)
- XXE attack prevention (disable external entities in XML per SEC-04)
- Size limits (max nesting depth, element count per ADR-0008)
- Content length limits

**Example errors**:
```
Forbidden JSON key '__proto__' (prototype pollution risk) at row 2, column 3
JSON nesting depth exceeds 32 levels at row 8, column 2
XML content exceeds 1 MB limit at row 10, column 1
```

### 2.4 Semantic Validation
- Namespace resolution to URI (per ADR-0006)
- Media type validation for `binary()`/`image()`
- List separator validation for `list()`

**Example errors**:
```
Cannot resolve namespace prefix 's' to URI at row 3, column 2
Invalid media type 'imagepng' (expected format: type/subtype) at row 5, column 1
```

## Validation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Parse Time (Before Processing Any Rows)                    │
├─────────────────────────────────────────────────────────────┤
│ 1. Parse XML document structure                             │
│ 2. Locate xt:table elements                                 │
│ 3. Parse column definitions                                 │
│ 4. Validate modifier syntax & parameters (Phase 1)          │
│ 5. Check structural constraints                             │
│ 6. Build column metadata                                    │
│                                                              │
│ IF ERRORS → Exit with code 1 (fail fast)                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Expansion Time (For Each Row)                              │
├─────────────────────────────────────────────────────────────┤
│ 1. Parse CSV row into cells                                 │
│ 2. For each cell:                                           │
│    a. Apply modifier (parse JSON/XML, coerce scalar, etc.)  │
│    b. Validate content syntax (Phase 2)                     │
│    c. Apply security checks                                 │
│    d. Generate output elements                              │
│                                                              │
│ IF ERRORS → Record error, continue or stop per --stop-at    │
└─────────────────────────────────────────────────────────────┘
```

## Rationale

**Why two phases?**

1. **Fail Fast**: Catch structural errors before processing thousands of rows
2. **Performance**: Syntax validation once vs per-row content validation
3. **Separation of Concerns**: Parser validates structure, expander validates content
4. **Clear Boundaries**: Developers know exactly where to implement each check
5. **Consistent Error Reporting**: Parse errors reference column definitions, expansion errors reference specific cells

**Why not validate everything at parse time?**

- Cell content is not available until expansion
- Content validation may be expensive (parsing JSON/XML)
- Allows modular expander design (content validators are pluggable)

**Why not defer all validation to expansion time?**

- Wastes resources processing rows with invalid column definitions
- Errors are harder to understand (user sees row-level errors for structural problems)
- Violates fail-fast principle

## Alignment with Existing ADRs

This ADR **codifies** the pattern already established in:

| ADR | Parse-Time Validation | Expansion-Time Validation |
|-----|----------------------|--------------------------|
| **ADR-0006** | QName syntax, prefix declared | Resolve prefix to URI |
| **ADR-0007** | `xml()` syntax, parameter QNames | Parse XML fragment, check well-formedness |
| **ADR-0008** | `json()` syntax, parameter QNames | Parse JSON, check depth/size, prototype pollution |

This ADR extends the pattern to **all modifiers** and makes it an explicit design principle.

# Consequences

## Positive

1. **Clarity**: No ambiguity about when/where validation occurs
2. **Consistency**: All modifiers follow the same two-phase pattern
3. **Fail Fast**: Structural errors caught before expensive row processing
4. **Performance**: One-time syntax validation vs per-cell content validation
5. **Maintainability**: Clear boundaries for parser and expander implementations
6. **Extensibility**: Pattern applies to future custom modifiers

## Negative

1. **Complexity**: Developers must understand two validation phases
   - **Mitigation**: This ADR documents the pattern clearly with examples
2. **Error Message Design**: Must distinguish parse-time vs expansion-time errors
   - **Mitigation**: Error messages include context (row/column for expansion errors, column definition for parse errors)

## Implementation Requirements

### Parser Module

**Responsibilities**:
- Validate all Phase 1 constraints
- Build validated column metadata
- Return errors with column definition context

**Test requirements**:
- Unit tests for each parse-time validation rule
- Test error messages include proper context
- Test that parser does NOT validate cell content

### Expander Module

**Responsibilities**:
- Validate all Phase 2 constraints
- Apply modifier-specific content validation
- Generate proper XML output

**Test requirements**:
- Unit tests for each expansion-time validation rule
- Test error messages include row/column context
- Test that expander does NOT re-validate parse-time constraints

### Error Reporting

All errors must include:
- **Phase indicator**: "Parse error" vs "Expansion error"
- **Location**: Line/column in source, row/column index
- **Context**: Snippet of problematic content
- **Specific error type**: `ParseError`, `ValidationError`, `JsonParseError`, etc.

**Example parse-time error**:
```
Parse error at line 5, column 12 (column definition 3):
Unknown modifier name 'jsn' (did you mean 'json'?)
Context: {..., jsn(data), ...}
```

**Example expansion-time error**:
```
Expansion error at row 4, column 2:
Invalid JSON syntax: unexpected token '}'
Context: ...,"{"key": "value"}},"...
```

# References

- Issue [#12](https://github.com/lordcraymen/xtoon/issues/12): Resolve validation timing contradiction
- ADR-0006: QName Resolution and Namespace Handling
- ADR-0007: xml() Modifier Parsing Mode and Behavior
- ADR-0008: json() Modifier Mapping Rules
- XTOON-04 rule in `AGENTS.MD`
