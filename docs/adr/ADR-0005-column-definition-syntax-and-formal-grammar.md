---
title: "ADR-0005: Column Definition Syntax and Formal Grammar"
date: "2025-11-13"
status: Accepted
tags:
  - grammar
  - parser
  - specification
modules:
  - src/parser
  - src/validator
summary: >-
  Defines the formal EBNF grammar for xt:table column definitions, including attribute/element syntax, modifier arguments, tail capture placement, whitespace handling, and validation rules for duplicate column names.
---

# Context

GitHub issue #8 identified ambiguities in the column definition syntax for `xt:table="{...}"` that are blocking parser implementation. Specific questions included:

1. **Whitespace handling**: Are spaces required around commas? Are newlines allowed?
2. **Column name validation**: Must names be valid XML QNames? Any reserved names?
3. **Duplicate columns**: What happens with `{@id, id}` or `{name, name}`?
4. **Commas in modifier arguments**: How to handle `json(data, item=my,child)`?
5. **Tail capture syntax**: Is `...` part of the modifier or separate? Can it be on non-modifier columns?

The README provided examples but lacked a formal grammar, leading to implementation uncertainty around edge cases.

# Decision

We adopt the following **formal EBNF grammar** for column definitions:

```ebnf
ColumnList     ::= "{" Whitespace? Column (Comma Column)* Whitespace? "}"
Column         ::= AttributeCol | ElementCol
AttributeCol   ::= "@" QName
ElementCol     ::= Modifier? QName TailCapture?
Modifier       ::= ModifierName "(" Arguments? ")"
ModifierName   ::= "xml" | "json" | "binary" | "image" | "list" 
                 | "int" | "float" | "bool" | "date" | "datetime" | "text"
Arguments      ::= Argument (Comma Argument)*
Argument       ::= Name "=" Value | Value
TailCapture    ::= "..."
Comma          ::= Whitespace? "," Whitespace?
Whitespace     ::= (" " | "\t" | "\n" | "\r")+
QName          ::= (Prefix ":")? LocalName
Prefix         ::= NCName
LocalName      ::= NCName
Name           ::= [a-zA-Z_][a-zA-Z0-9_-]*
Value          ::= [^,(){}]+
NCName         ::= (as per XML Namespaces specification)
```

## Specific Answers to Issue #8 Questions

### Q1.3.1: Whitespace handling
- **Spaces around commas**: Optional (both `{@id, name}` and `{@id,name}` are valid)
- **Newlines**: Allowed for multi-line readability
- **Example**:
  ```xml
  xt:table="{
    @id,
    name,
    xml(desc)...
  }"
  ```

### Q1.3.2: Column name validation
- **Must be valid XML QNames**: Yes (follows `NCName` rules with optional prefix)
- **Reserved names**: None (no keywords reserved by XTOON)
- **Special characters**: Only valid QName characters (letters, digits, hyphen, underscore, colon for prefix)
- **Examples**:
  - ✅ Valid: `name`, `my-name`, `my_name`, `s:Person`, `xml:lang`
  - ❌ Invalid: `123name` (starts with digit), `my name` (contains space), `my.name` (dot not allowed)

### Q1.3.3: Duplicate column names
- **Behavior**: **Error** (parse-time validation failure)
- **Examples**:
  - ❌ `{@id, id}` → Error: "Duplicate column name 'id' (attribute and element)"
  - ❌ `{name, name}` → Error: "Duplicate column name 'name'"
  - ✅ `{@id, name}` → OK (different names)
  - ✅ `{s:name, t:name}` → OK (different prefixes = different QNames)

### Q1.3.4: Commas in modifier arguments
- **Not supported** in v0.1 (commas are argument separators)
- **Workaround**: Use XML entity references if needed: `fmt="&comma;"`
- **Rationale**: Keeps parser simple; no escaping/quoting rules needed
- **Future**: Could add quoted string support in v0.2 if use cases emerge

### Q1.3.5: Tail capture syntax
- **Position**: `...` immediately follows the column name (no spaces before `...`)
- **Placement**: Only on the **last** column (parse-time error otherwise)
- **With modifiers**: `xml(desc)...` (tail capture applies to the entire column)
- **Without modifiers**: `desc...` (valid for plain text elements)
- **Examples**:
  - ✅ `{@id, xml(content)...}` → OK (last column)
  - ✅ `{@id, content...}` → OK (tail capture on plain element)
  - ❌ `{name..., age}` → Error: "Tail capture (...) must be on last column"
  - ❌ `{xml(desc) ...}` → Error: "Space not allowed before '...'"

## Validation Rules (Parse-Time)

The parser MUST validate:

1. **Syntax**: Column list matches EBNF grammar
2. **QName syntax**: All column names are syntactically valid QNames (prefix declared check deferred to expansion)
3. **Modifier names**: All modifier names are recognized (from built-in set or extensions)
4. **Duplicate columns**: No two columns share the same QName
5. **Tail capture placement**: `...` appears only on the last column
6. **Tail capture attachment**: No whitespace between column name and `...`

## Examples

**Valid column definitions**:
```xml
<!-- Simple columns -->
<items xt:table="{@id, name, age}"/>

<!-- With modifiers -->
<items xt:table="{@id, int(age), json(profile)}"/>

<!-- Multi-line -->
<items xt:table="{
  @id,
  name,
  xml(desc)...
}"/>

<!-- Namespaced columns -->
<items xmlns:s="http://schema.org" xt:table="{@id, s:name, s:email}"/>

<!-- Tail capture -->
<items xt:table="{@id, name, xml(content)...}"/>
```

**Invalid column definitions**:
```xml
<!-- Duplicate names -->
<items xt:table="{@id, id}"/>
<!-- Error: "Duplicate column name 'id'" -->

<!-- Tail capture not last -->
<items xt:table="{name..., age}"/>
<!-- Error: "Tail capture (...) must be on last column" -->

<!-- Space before ... -->
<items xt:table="{@id, desc ...}"/>
<!-- Error: "Unexpected whitespace before '...'" -->

<!-- Unknown modifier -->
<items xt:table="{@id, foo(name)}"/>
<!-- Error: "Unknown modifier 'foo'" -->

<!-- Invalid QName -->
<items xt:table="{@id, 123name}"/>
<!-- Error: "Invalid QName '123name' (must start with letter or underscore)" -->
```

# Consequences

## Positive

- **Unambiguous parsing**: EBNF grammar eliminates interpretation ambiguity
- **Early error detection**: Parse-time validation catches structural errors before expansion
- **Readable multi-line syntax**: Newline support improves readability for complex tables
- **QName compliance**: Leverages XML namespace rules (familiar to XML developers)
- **Duplicate detection**: Prevents subtle bugs from column name collisions

## Negative

- **No commas in modifier args**: Limits flexibility (e.g., can't do `fmt="YYYY-MM-DD, HH:mm"` directly)
  - Mitigation: Entity references or future quoted-string support
- **Strict tail capture placement**: Only last column can use `...`
  - Mitigation: This is by design for deterministic parsing (aligns with XTOON-05)
- **No whitespace before `...`**: Requires `xml(desc)...` not `xml(desc) ...`
  - Mitigation: Clearer syntax; less ambiguity

## Implementation Impact

- **Parser module**: Implement EBNF grammar using recursive descent or parser combinator
- **Validator module**: Add duplicate column detection and tail capture position checks
- **Error reporting**: Provide line/column pointers for all syntax errors (per XTOON-03)
- **Test coverage**: Add test cases for all valid/invalid examples above

# References

- GitHub Issue #8: https://github.com/lordcraymen/xtoon/issues/8
- P0-ISSUES-CLARIFICATION.md: Column syntax discussion
- ADR-0003: No CLI parameter overrides (delimiter specification)
- ADR-0004: RFC 4180 CSV quoting (row parsing after column parsing)
- XML Namespaces Specification: https://www.w3.org/TR/xml-names/
