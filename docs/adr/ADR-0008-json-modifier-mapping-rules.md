---
title: "ADR-0008: JSON Modifier Mapping Rules"
date: "2025-11-17"
status: Accepted
tags:
  - modifiers
  - json
  - security
modules:
  - src/modifiers/
  - src/parser/
summary: >-
  Defines the complete JSON-to-XML conversion rules for the json() modifier, including type mapping, invalid key handling, nested structure support, and security constraints to prevent prototype pollution and resource exhaustion.
---

# Context

**Related Issue**: [#11 - Define json() modifier JSON-to-XML mapping](https://github.com/lordcraymen/xtoon/issues/11)

The `json()` column modifier allows embedding JSON data in CSV cells and converting it to XML during expansion. The README documents basic behavior ("Objects → child elements by key; arrays → repeated `<item>`"), but critical details are unspecified:

1. **Type mapping**: How are primitives, `null`, booleans, numbers handled?
2. **Invalid XML names**: What happens with JSON keys like `"123"`, `"foo bar"`, `"@attr"`?
3. **Nested structures**: How deep can nesting go? How are nested arrays represented?
4. **Type preservation**: Should `{"age": 31}` include type annotations or just text?
5. **Tail capture**: Can `json(data)...` consume the rest of a CSV line?
6. **Security**: How to prevent prototype pollution, stack overflow, resource exhaustion?

Without these specifications, implementers cannot build consistent, secure parsers.

**Constraint from AGENTS.md**:
- [SEC-01] Validate all external inputs using Zod schemas
- [CLEAN-ERR-03] No bare `catch`; use specific error classes
- [XTOON-03] Error reporting must include row number, column number, and context snippet

**Design principle**: Fail fast and explicitly (no silent transformations).

# Decision

## 1. Complete JSON-to-XML Type Mapping

| JSON Type | XML Representation | Example Input | Example Output |
|-----------|-------------------|---------------|----------------|
| **Object** | Child elements (one per key) | `{"name":"Alice"}` | `<name>Alice</name>` |
| **Array** | Repeated `<item>` elements | `[1,2,3]` | `<item>1</item><item>2</item><item>3</item>` |
| **String** | Text node | `"hello"` | `hello` |
| **Number** | Text node (as-is) | `42`, `3.14` | `42`, `3.14` |
| **Boolean** | Text node (`"true"`/`"false"`) | `true`, `false` | `true`, `false` |
| **`null`** | Empty element | `null` | `` (self-closing tag) |

**Rationale**: This mapping follows standard JSON-XML conventions (similar to XML-RPC, Badgerfish simplified). No type annotations keeps output clean and parseable.

## 2. Invalid XML Name Handling

**Rule**: JSON object keys MUST be valid XML element names. Invalid names cause **immediate error**.

**Valid XML names** (per XML 1.0 spec):
- Start with letter, underscore, or colon
- Contain letters, digits, hyphens, underscores, colons, periods
- Examples: `name`, `my-key`, `_private`, `ns:item`

**Invalid examples** that cause errors:
- `"123"` (starts with digit)
- `"foo bar"` (contains space)
- `"@attr"` (starts with `@`, conflicts with XTOON attribute syntax)
- `""` (empty string)
- `"my.key"` (period allowed in XML but ambiguous in XTOON context - **reject for clarity**)

**Error message format**:
```
Error at row {N}, column {M}: Invalid XML element name in JSON key: "{key}"
Valid XML names must start with a letter or underscore and contain only letters, digits, hyphens, and underscores.
Context: {csv_line_snippet}
```

**Rationale**: Silent transformation (`"123"` → `<_123>`) hides errors and creates unpredictable output. Explicit errors enforce data quality at the source (CLEAN-ERR-03).

## 3. Nested Structure Handling

**Recursive conversion** is supported with depth and size limits:

### Example: Nested Object
```json
{"person": {"name": "Alice", "age": 31}}
```
→
```xml
<person>
  <name>Alice</name>
  <age>31</age>
</person>
```

### Example: Object with Array
```json
{"items": [1, 2, 3]}
```
→
```xml
<items>
  <item>1</item>
  <item>2</item>
  <item>3</item>
</items>
```

### Example: Nested Array
```json
[["a", "b"], ["c", "d"]]
```
→
```xml
<item>
  <item>a</item>
  <item>b</item>
</item>
<item>
  <item>c</item>
  <item>d</item>
</item>
```

### Security Limits

To prevent denial-of-service attacks:

| Limit | Value | Error Message |
|-------|-------|---------------|
| **Max nesting depth** | 32 levels | "JSON nesting depth exceeds 32 levels at row {N}, column {M}" |
| **Max total elements** | 10,000 elements | "JSON structure exceeds 10,000 element limit at row {N}, column {M}" |

**Rationale**: Prevents stack overflow and excessive memory consumption. Limits are high enough for legitimate use cases but block pathological inputs.

## 4. Default Item Name

**Rule**: The default item name for array elements is **always** `item`.

**Parameter override**: `json(data, item=person)` uses `<person>` instead of `<item>`.

### Example: Default
```xml
<items xt:sep="," xt:table="{@id, json(data)}">
1,"[10, 20, 30]"
</items>
```
→
```xml
<items>
  <item id="1">
    <item>10</item>
    <item>20</item>
    <item>30</item>
  </item>
</items>
```

### Example: Custom Item Name
```xml
<items xt:sep="," xt:table="{@id, json(data, item=value)}">
1,"[10, 20, 30]"
</items>
```
→
```xml
<items>
  <item id="1">
    <value>10</value>
    <value>20</value>
    <value>30</value>
  </item>
</items>
```

**Rationale**: Simple, predictable default. Explicit override when semantic clarity needed.

## 5. Type Preservation

**Rule**: **No type annotations** in output. All JSON values convert to text nodes.

```json
{"age": 31, "active": true, "score": 3.14}
```
→
```xml
<age>31</age>
<active>true</active>
<score>3.14</score>
```

**Not**:
```xml
<!-- ❌ We do NOT do this -->
<age type="number">31</age>
<active type="boolean">true</active>
```

**Rationale**: 
- Simpler output, easier to consume
- Avoids schema/namespace complexity
- Consumers can infer types from context or validate separately
- Consistent with `xml()` modifier (no special type handling)

## 6. Tail Capture Support

**Rule**: `json()` **supports tail capture** with `...` syntax.

### Example
```xml
<items xt:sep="," xt:table="{@id, name, json(extra)...}">
1,Alice,{"role":"admin","level":5}
2,Bob,{"role":"user","dept":"sales","manager":"Alice"}
</items>
```
→
```xml
<items>
  <item id="1">
    <name>Alice</name>
    <role>admin</role>
    <level>5</level>
  </item>
  <item id="2">
    <name>Bob</name>
    <role>user</role>
    <dept>sales</dept>
    <manager>Alice</manager>
  </item>
</items>
```

**Behavior**: 
- Tail capture consumes all remaining text on the line (no CSV quote processing per ADR-0004)
- JSON parsing still requires valid JSON syntax
- Allows commas/quotes inside JSON without CSV escaping

**Rationale**: Consistent with `xml()...` behavior. Essential for complex JSON payloads with nested structures.

## 7. Security Constraints

### 7.1 Prototype Pollution Prevention (SEC-01)

**Rule**: Reject JSON keys that could cause prototype pollution.

**Forbidden keys** (case-insensitive):
- `__proto__`
- `constructor`
- `prototype`

**Error message**:
```
Error at row {N}, column {M}: Forbidden JSON key "{key}" (prototype pollution risk)
Context: {csv_line_snippet}
```

### 7.2 Input Validation

Before parsing JSON:
1. **Validate max string length**: 1 MB per cell (configurable)
2. **Validate JSON syntax** using Zod schema
3. **Check depth/size limits** during recursive conversion

### 7.3 Error Handling

All JSON parse errors must include:
- Row number
- Column number (1-based CSV column index)
- Context snippet (±20 chars around error)
- Specific error type (`JsonParseError`, `JsonValidationError`)

**Example**:
```typescript
throw new JsonParseError(
  'Invalid JSON syntax: unexpected token',
  { row: 3, col: 2, context: '...,"invalid json}...' }
);
```

## 8. Modifier Parameter Syntax

**Full syntax**: `json(columnName [, item=customName])`

**Parameters**:
- `columnName` (required): The element name to wrap the JSON content
- `item` (optional): Custom name for array elements (default: `item`)

**Examples**:
- `json(data)` → array elements use `<item>`
- `json(data, item=person)` → array elements use `<person>`

**Validation at parse time** (XTOON-04):
- `columnName` must be valid QName
- `item` parameter must be valid QName (if provided)
- Unknown parameters → error

# Consequences

## Positive

1. **Complete specification**: All edge cases documented, no ambiguity
2. **Security**: Prototype pollution and DOS attacks prevented
3. **Predictability**: Developers know exactly what output to expect
4. **Consistency**: Aligns with `xml()` modifier behavior (ADR-0007)
5. **Fail fast**: Invalid inputs caught immediately with clear error messages
6. **Simplicity**: No type annotations simplifies output and testing

## Negative

1. **Strict validation**: Some "creative" JSON key names will be rejected
   - **Mitigation**: Users can transform keys before CSV generation
2. **No type preservation**: Consumers must infer types from text values
   - **Mitigation**: Most XML consumers expect text content anyway
3. **Depth/size limits**: Extremely large/deep JSON will be rejected
   - **Mitigation**: Limits are high (32 levels, 10K elements); pathological cases shouldn't be in CSV anyway

## Implementation Notes

1. Use `zod` for JSON schema validation (SEC-01)
2. Implement recursive converter with depth/size tracking
3. Validate XML name legality using regex: `^[a-zA-Z_][a-zA-Z0-9_-]*$`
4. Reject period (`.`) in names to avoid QName ambiguity
5. Test cases must cover all type mappings, nested structures, error conditions
6. Security tests for prototype pollution, depth limits, size limits

## Test Coverage Requirements

Per DOD-01 (80% coverage minimum):
- [ ] All JSON primitive types (string, number, boolean, null)
- [ ] Objects with valid keys
- [ ] Arrays (flat and nested)
- [ ] Nested objects
- [ ] Mixed nesting (arrays in objects, objects in arrays)
- [ ] Invalid XML names in keys (expect errors)
- [ ] Prototype pollution keys (expect errors)
- [ ] Depth limit enforcement
- [ ] Size limit enforcement
- [ ] Tail capture with JSON
- [ ] Custom `item` parameter
- [ ] Malformed JSON (expect parse errors)

# References

- [#11 - Define json() modifier JSON-to-XML mapping](https://github.com/lordcraymen/xtoon/issues/11)
- [ADR-0004: RFC 4180 CSV Quoting and Escaping](ADR-0004-rfc-4180-csv-quoting-and-escaping.md) - Tail capture bypasses CSV quote processing
- [ADR-0005: Column Definition Syntax](ADR-0005-column-definition-syntax-and-formal-grammar.md) - Modifier parameter grammar
- [ADR-0007: XML Modifier Parsing Mode](ADR-0007-xml-modifier-parsing-mode-and-behavior.md) - Consistent modifier behavior
- [AGENTS.md](../../AGENTS.md) - Security rules (SEC-01), error handling (CLEAN-ERR-03)
- [XML 1.0 Specification](https://www.w3.org/TR/xml/) - Valid element name rules
