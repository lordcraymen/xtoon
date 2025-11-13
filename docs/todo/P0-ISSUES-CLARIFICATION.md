# P0 Issues Clarification Discussion

**Created**: 2025-11-13  
**Purpose**: Clarify and resolve all P0 specification issues before implementation

---

## Overview

There are **7 P0 issues** that are blocking implementation. These are all specification issues that require decisions before we can implement the core XTOON parser and expander.

## Issue Summary

| # | Title | Core Question |
|---|-------|---------------|
| #6 | Delimiter precedence | CLI flag vs `xt:sep` attribute - which wins? |
| #7 | CSV quoting/escaping | RFC 4180 compliance? Multi-line rows? |
| #8 | Column definition syntax | Formal grammar for `xt:table="{...}"` |
| #9 | QName resolution timing | Parse-time or expansion-time? |
| #10 | `xml()` modifier behavior | Fragment vs document mode? |
| #11 | `json()` modifier mapping | How to convert JSON → XML? |
| #12 | Validation timing | Parse-time vs expansion-time? |

---

## Issue #6: Delimiter Precedence Rules

**Current contradiction**:
- XTOON-06 policy: "`xt:sep` overrides CLI `--sep`"
- CLI docs: "`--sep` overrides `xt:sep`"

**DECISION**: **Remove CLI `--sep` entirely - use only `xt:sep` attribute**

**Rationale**:
1. **Single source of truth**: Delimiter specification belongs in the document, not CLI
2. **Document portability**: Documents are self-describing and work independently of CLI flags
3. **Mixed delimiters**: Different tables in same document can use different delimiters
4. **Explicit over implicit**: Forces users to declare delimiter intentions clearly
5. **Simpler implementation**: No precedence rules, no config passing, less to test

**Design Principle**: **No global CLI overrides for parameters - use XML features instead**

If users need "global" defaults, they can use XML mechanisms:
- Entity references: `<!ENTITY sep ",">` then `xt:sep="&sep;"`
- XSLT preprocessing for bulk transformation
- Simple repetition (one attribute per table is minimal overhead)

**Proposed answers**:

| Question | Answer |
|----------|--------|
| Q1.1.1: Precedence order? | N/A - no CLI flag exists |
| Q1.1.2: Is `xt:sep` required? | **Yes** - must be explicit on every `xt:table` element |
| Q1.1.3: Does `xt:repeat` use `xt:sep`? | No, `xt:repeat` has its own `sep` parameter |
| Q1.1.4: Inheritance from parent? | No, each table specifies its own delimiter |
| Q1.1.5: Allowed values? | Single-char: `,` `|` `;` TAB. Escape sequences: `\t` `\n` |
| Q1.1.6: Default if omitted? | **Error** - "xt:sep attribute required" |

**Examples**:
```xml
<!-- ✅ Valid: explicit delimiter -->
<data>
  <items xt:sep="," xt:table="{id,name}">
    1,Alice
    2,Bob
  </items>
</data>

<!-- ✅ Valid: mixed delimiters -->
<data>
  <customers xt:sep="," xt:table="{id,name}">
    1,Alice
  </customers>
  <orders xt:sep="|" xt:table="{id,product}">
    100|Widget
  </orders>
</data>

<!-- ✅ Valid: using XML entity for "global" default -->
<!DOCTYPE data [
  <!ENTITY sep ",">
]>
<data>
  <items xt:sep="&sep;" xt:table="{id,name}">
    1,Alice
  </items>
  <orders xt:sep="&sep;" xt:table="{id,product}">
    100,Widget
  </orders>
</data>

<!-- ❌ Invalid: missing xt:sep -->
<items xt:table="{id,name}">
  1,Alice
</items>
<!-- Error: "xt:sep attribute required on xt:table elements" -->
```

---

## Issue #7: CSV Quoting and Escaping

**Core question**: Should we follow RFC 4180 or define custom rules?

**My recommendation**: **Full RFC 4180 compliance**

**Rationale**:
1. **Interoperability**: Standard CSV behavior expected by users
2. **Security**: Well-tested against injection attacks
3. **Less to document**: "RFC 4180 compliant" is clearer than custom rules

**Proposed answers**:

| Question | Answer |
|----------|--------|
| Q1.2.1: Quoting spec? | RFC 4180: double-quote fields, escape quotes with `""` |
| Q1.2.2: Quotes + tail capture? | Tail capture gets remainder unprocessed (no quote parsing) |
| Q1.2.3: Spaces + quotes? | Spaces inside quotes preserved; outside quotes trimmed |
| Q1.2.4: Escape sequences? | Only `""` for literal quote; no backslash escapes |
| Q1.5.4: Multi-line rows? | Yes, if field is quoted (per RFC 4180) |

**Example**:
```csv
id,name,description
1,"Alice ""Ace"" Smith","Line 1
Line 2"
```
→ `description` contains literal newline

**Security note**: Validate against XXE when using `xml()` modifier (SEC-04)

---

## Issue #8: Column Definition Syntax

**Core question**: What is the formal grammar for `xt:table="{...}"`?

**My recommendation**: Define clear, unambiguous grammar

**Proposed grammar (EBNF)**:
```ebnf
ColumnList     ::= "{" Column ("," Column)* "}"
Column         ::= AttributeCol | ElementCol
AttributeCol   ::= "@" QName
ElementCol     ::= Modifier? QName TailCapture?
Modifier       ::= ModifierName "(" Arguments? ")"
ModifierName   ::= "xml" | "json" | "binary" | "number" | ... 
Arguments      ::= Argument ("," Argument)*
Argument       ::= Name "=" Value | Value
TailCapture    ::= "..."
QName          ::= (Prefix ":")? LocalName
```

**Proposed answers**:

| Question | Answer |
|----------|--------|
| Q1.3.1: Whitespace? | Optional around commas; newlines allowed |
| Q1.3.2: Name validation? | Must be valid XML QName; no reserved names |
| Q1.3.3: Duplicate names? | Error (e.g., `{@id, id}` or `{name, name}`) |
| Q1.3.4: Commas in args? | Not supported; use different separator if needed |
| Q1.3.5: Tail capture syntax? | `...` after column name, e.g., `xml(desc)...` |

**Examples**:
```xml
<!-- Valid -->
<items xt:table="{@id, name, xml(desc)...}"/>
<items xt:table="{
  @id,
  name,
  json(data, item=person)
}"/>

<!-- Invalid: duplicate column names -->
<items xt:table="{@id, id}"/>  <!-- Error -->

<!-- Invalid: tail capture not on last column -->
<items xt:table="{name..., age}"/>  <!-- Error -->
```

---

## Issue #9: QName Resolution Timing

**Current contradiction**:
- "Validate modifiers during parse" (XTOON-04)
- "Namespace resolution at expansion time"

**My recommendation**: **Two-phase approach**

**Proposed resolution**:

| Phase | What happens |
|-------|--------------|
| **Parse time** | Validate QName syntax (prefix + local name); check if prefix is declared |
| **Expansion time** | Resolve prefix to namespace URI using in-scope `xmlns:*` declarations |

**Rationale**: This aligns with XTOON-04 (validate structure early) while deferring resolution until we have row data.

**Proposed answers**:

| Question | Answer |
|----------|--------|
| Q1.4.1: Resolution timing? | Syntax check at parse; URI resolution at expansion |
| Q1.4.2: Default namespace? | Not applied to element names (QNames without prefix) |
| Q1.4.3: Prefix on table element? | Yes, prefixes declared on `xt:table` element are in scope |
| Q1.4.4: Prefix preservation? | Yes, preserve prefixes exactly as written (XTOON-02) |
| Q1.4.5: Undefined prefix in `xml()`? | Error at expansion time with row/col context |

**Example**:
```xml
<items xmlns:s="http://schema.org" xt:table="{@id, s:name}">
  1,Alice
</items>
<!-- Output: <item id="1"><s:name>Alice</s:name></item> -->
<!-- Prefix 's:' preserved -->
```

---

## Issue #10: `xml()` Modifier Behavior

**Core question**: Fragment or document parsing mode?

**My recommendation**: **Fragment mode (no single root required)**

**Rationale**: README says "splice its nodes" which implies fragment mode

**Proposed answers**:

| Question | Answer |
|----------|--------|
| Q2.1.1: Parsing mode? | Fragment mode (no single root required) |
| Q2.1.2: XML decl/DOCTYPE? | Stripped silently; not an error |
| Q2.1.3: Whitespace? | Text-only whitespace nodes stripped |
| Q2.1.4: CDATA sections? | Converted to text nodes |
| Q2.1.5: Multiple roots? | Allowed; all spliced as children |
| Q2.1.6: Comments/PIs? | Preserved |
| Q2.1.7: Temp wrapper? | `<xtoon:wrapper>` (internal; never in output) |

**Examples**:
```xml
<!-- Input -->
<items xt:table="{@id, xml(content)}">
1,<p>Hello</p><p>World</p>
</items>

<!-- Output -->
<items>
  <item id="1">
    <p>Hello</p>
    <p>World</p>
  </item>
</items>
```

**Security**: Disable external entities (XXE prevention per SEC-04)

---

## Issue #11: `json()` Modifier Mapping

**Core question**: How to convert JSON → XML?

**My recommendation**: Standard JSON-XML conversion pattern

**Proposed mapping**:

| JSON Type | XML Representation | Example |
|-----------|-------------------|---------|
| Object | Child elements | `{"a":1}` → `<a>1</a>` |
| Array | Repeated `<item>` | `[1,2]` → `<item>1</item><item>2</item>` |
| String | Text node | `"hello"` → `hello` |
| Number | Text node | `42` → `42` |
| Boolean | Text node | `true` → `true` |
| `null` | Empty element | `null` → `<item/>` |

**Proposed answers**:

| Question | Answer |
|----------|--------|
| Q2.2.1: Mapping rules? | See table above |
| Q2.2.2: Invalid XML names? | Error (e.g., `{"123": "x"}` → invalid element name) |
| Q2.2.3: Nested structures? | Recursive conversion |
| Q2.2.4: Default item name? | `item` (can override: `json(data, item=person)`) |
| Q2.2.5: Type preservation? | No type annotations; just text content |
| Q2.2.6: Tail capture? | Yes: `json(data)...` consumes rest of line |

**Examples**:
```xml
<!-- Input -->
<items xt:table='{@id, json(data)}'>
1,{"name":"Alice","age":31}
</items>

<!-- Output -->
<items>
  <item id="1">
    <name>Alice</name>
    <age>31</age>
  </item>
</items>
```

**Security**: Validate against prototype pollution (SEC-01)

---

## Issue #12: Validation Timing

**Current contradiction**: "Validate during parse" vs "Validate during expansion"

**My recommendation**: **Two-phase validation**

**Proposed resolution**:

| Phase | What is validated |
|-------|------------------|
| **Parse time** | Modifier syntax (e.g., `xml()` is valid name); column structure; QName syntax |
| **Expansion time** | Cell content (e.g., valid JSON, valid XML fragment); column count matches |

**Rationale**: Fail fast on structural errors (parse time); validate data correctness only when processing rows (expansion time)

**Examples**:

```xml
<!-- Parse-time error: unknown modifier -->
<items xt:table="{@id, foo(name)}">  <!-- Error: 'foo' not recognized -->

<!-- Parse-time OK; expansion-time error: invalid JSON -->
<items xt:table="{@id, json(data)}">
1,{invalid json}  <!-- Error at expansion with row/col context -->
</items>
```

---

## Next Steps

For each issue, I propose:

1. **Discuss** the recommendations above (do you agree/disagree with any?)
2. **Create ADR** for each decision (one ADR can cover multiple related issues)
3. **Update README** to remove contradictions and document decisions
4. **Write test cases** to validate the specifications
5. **Implement** parser/expander based on finalized specs

## Questions for You

1. **#6 (Delimiter)**: Do you agree `xt:sep` should override CLI `--sep`?
2. **#7 (CSV)**: Should we follow RFC 4180 or define custom rules?
3. **#8 (Syntax)**: Is the proposed grammar clear and complete?
4. **#9 (QName)**: Two-phase (parse syntax, expand resolution) makes sense?
5. **#10 (xml)**: Fragment mode correct? Should we preserve comments?
6. **#11 (json)**: Is the object-to-elements mapping intuitive?
7. **#12 (Validation)**: Two-phase validation (structure then content) acceptable?

---

## Priority Order

If we tackle these issues one at a time, I suggest:

1. **#12** (Validation timing) - affects all other decisions
2. **#8** (Column syntax) - foundation for parser
3. **#9** (QName resolution) - needed for namespace handling
4. **#6** (Delimiter precedence) - simple decision
5. **#7** (CSV quoting) - needed for row parsing
6. **#10** (xml modifier) - most complex modifier
7. **#11** (json modifier) - second complex modifier

**Estimated effort**: ~2-4 hours total for all ADRs + README updates (if we agree on most recommendations)
