# DRAFT: Modifiers in Attributes

**Status**: Draft / Discussion  
**Date**: 2025-11-17  
**Related Issues**: #13 (Column modifier behaviors)  
**Extends**: ADR-0005 (Column Definition Syntax)

---

## Problem

Currently, XTOON only allows **plain text** in attributes:

```xml
<images xmlns:xt="urn:xtoon" xt:table="{@src, @alt}" xt:row="img">
plaintext-only,plaintext-only
</images>
```

This makes it impossible to:
- Generate Data-URIs for `src` attributes from base64-encoded binary data
- Format dates/timestamps for attribute values
- Normalize numbers in attributes
- Apply any transformation to attribute values

**Use Case**: Embedding images as Data-URIs
```xml
<img src="data:image/png;base64,iVBORw0KG..." alt="Icon"/>
```

We need a way to construct the Data-URI from CSV cell content.

---

## Proposed Solution

Allow **modifiers to target attributes** using the syntax: `modifier(@attrName, ...params)`

### Syntax Extension

**Current (ADR-0005)**:
```ebnf
column ::= attribute | element
attribute ::= "@" name
element ::= name | modifier "(" name ("," param)* ")" "..."?
```

**Proposed**:
```ebnf
column ::= attribute | element
attribute ::= "@" name | modifier "(" "@" name ("," param)* ")"
element ::= name | modifier "(" name ("," param)* ")" "..."?
modifier ::= identifier
```

**Key rule**: The first argument to a modifier determines the target type:
- `modifier(elementName, ...)` → Creates child element
- `modifier(@attrName, ...)` → Creates attribute on row element

---

## Examples

### 1. Data-URI Generation with `fileurl()`

```xml
<images xmlns:xt="urn:xtoon" 
        xt:table="{fileurl(@src, media=image/png, codec=base64), @alt}" 
        xt:row="img">
iVBORw0KGgoAAAANSUhEUgAAAAUA...,Apple icon
/9j/4AAQSkZJRgABAQAAAQABAAD...,Orange photo
</images>
```

**Output**:
```xml
<images>
  <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA..." alt="Apple icon"/>
  <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..." alt="Orange photo"/>
</images>
```

### 2. Date Formatting in Attributes

```xml
<events xmlns:xt="urn:xtoon" 
        xt:table="{@id, date(@created, fmt=YYYY-MM-DD), text(description)}" 
        xt:row="event">
ev1,2025-11-17,Annual conference
ev2,2025-12-25,Holiday party
</events>
```

**Output**:
```xml
<events>
  <event id="ev1" created="2025-11-17">
    <description>Annual conference</description>
  </event>
  <event id="ev2" created="2025-12-25">
    <description>Holiday party</description>
  </event>
</events>
```

### 3. Integer Normalization in Attributes

```xml
<items xmlns:xt="urn:xtoon" 
       xt:table="{@id, int(@quantity), text(name)}" 
       xt:row="item">
i1,007,Widget
i2,042,Gadget
</items>
```

**Output**:
```xml
<items>
  <item id="i1" quantity="7">
    <name>Widget</name>
  </item>
  <item id="i2" quantity="42">
    <name>Gadget</name>
  </item>
</items>
```

### 4. Mixed Attribute and Element Modifiers

```xml
<gallery xmlns:xt="urn:xtoon" 
         xt:table="{fileurl(@src, media=image/png, codec=base64), @alt, int(width), int(height)}" 
         xt:row="img" 
         xt:sep="|">
iVBORw0KG...|Icon|32|32
/9j/4AAQ...|Photo|800|600
</gallery>
```

**Output**:
```xml
<gallery>
  <img src="data:image/png;base64,iVBORw0KG..." alt="Icon">
    <width>32</width>
    <height>32</height>
  </img>
  <img src="data:image/jpeg;base64,/9j/4AAQ..." alt="Photo">
    <width>800</width>
    <height>600</height>
  </img>
</gallery>
```

---

## New Modifier: `fileurl()`

### Specification

```
fileurl(@attrName | elementName, media=MIME_TYPE, codec=base64|hex)
```

**Purpose**: Convert encoded binary data to Data-URI format (RFC 2397).

**Parameters**:
- Target (required): `@attrName` or `elementName` - where to write the Data-URI
- `media` (required): MIME type (e.g., `image/png`, `audio/mp3`, `application/pdf`)
- `codec` (required): Encoding scheme (`base64` | `hex`)

**Parse-Time Validation**:
- `media` must be valid MIME type format: `type/subtype`
- `codec` must be `base64` or `hex`
- Target must be specified

**Expansion-Time Validation**:
- Cell content must be valid encoded data (per `codec`)
- Apply same validation rules as `binary()` modifier
- Strip whitespace (allow line breaks in base64)

**Output Format**:
```
data:{media};{codec},{encodedContent}
```

**Examples**:
```
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...
data:audio/mp3;base64,SUQzBAAAAAA...
data:application/pdf;base64,JVBERi0xLjcK...
data:application/octet-stream;hex,deadbeef0123456789
```

### Relationship to `binary()`

| Feature | `binary()` | `fileurl()` |
|---------|-----------|-------------|
| **Purpose** | Transport with metadata | Generate Data-URI |
| **Output** | Element with attributes | String (Data-URI) |
| **Use in attributes** | ❌ No (creates structure) | ✅ Yes (returns string) |
| **Use in elements** | ✅ Yes | ✅ Yes |
| **Metadata attributes** | Yes (`media`, `codec`, `filename`) | No (baked into URI) |
| **Validation** | Same | Same |

**When to use which**:
- **`binary()`**: When you want structured metadata and reusable content
  ```xml
  <data media="image/png" codec="base64" filename="icon.png">iVBORw0KG...</data>
  ```
- **`fileurl()`**: When you need a Data-URI (e.g., for `<img src="">` or embedding in other formats)
  ```xml
  <img src="data:image/png;base64,iVBORw0KG..."/>
  ```

---

## Attribute-Compatible Modifiers

**Rule**: Only modifiers that return a **single string value** can be used with attributes.

| Modifier | Element | Attribute | Return Type | Notes |
|----------|---------|-----------|-------------|-------|
| `text(name [, format=...])` | ✅ | ✅ | String | Plain text (default behavior) |
| `int(name)` | ✅ | ✅ | String | Normalized integer as string (e.g., `"42"`) |
| `float(name)` | ✅ | ✅ | String | Normalized float as string (e.g., `"3.14"`) |
| `bool(name)` | ✅ | ✅ | String | `"true"` or `"false"` |
| `date(name [, fmt=...])` | ✅ | ✅ | String | ISO-formatted date string |
| `datetime(name [, fmt=...])` | ✅ | ✅ | String | ISO-formatted timestamp |
| `fileurl(@name, media=..., codec=...)` | ✅ | ✅ | String | Data-URI string |
| `binary(name, ...)` | ✅ | ❌ | Structure | Creates child element with metadata attributes |
| `json(name, ...)` | ✅ | ❌ | Structure | Creates child elements from JSON |
| `xml(name)` | ✅ | ❌ | Nodes | Splices XML nodes as children |
| `list(name, ...)` | ✅ | ❌ | Multiple elements | Creates repeated child elements |

**Parse-Time Error**: If a structure-producing modifier targets an attribute:
```
Error at row 0, column 2: Modifier 'json()' cannot produce attribute value (produces child elements)
Valid attribute modifiers: text, int, float, bool, date, datetime, fileurl
```

---

## Implementation Notes

### Parser Changes
1. Extend column definition parser to recognize `modifier(@name, ...)` syntax
2. Validate that first argument is either `@name` (attribute) or `name` (element)
3. Store target type (attribute vs element) in column metadata

### Validator Changes (Parse-Time)
1. Check if modifier is compatible with target type
2. Error if structure-producing modifier targets an attribute
3. Validate all modifier parameters as usual (per ADR-0009)

### Expander Changes (Expansion-Time)
1. Execute modifier function on cell content
2. If target is attribute:
   - Verify return type is string
   - Set attribute on row element
3. If target is element:
   - Create child element(s) as usual

### Error Messages
```
# Parse-time
Error at row 0, column 2: Modifier 'json()' cannot produce attribute value
Valid attribute modifiers: text, int, float, bool, date, datetime, fileurl

# Expansion-time  
Error at row 3, column 1: Invalid base64 character '!' in fileurl() modifier
Context: "SGVsbG8h@#$%,Icon"
```

---

## Open Questions

### Q1: What if MIME type is wrong for the actual data?

```xml
<images xt:table="{fileurl(@src, media=image/png, codec=base64)}" xt:row="img">
/9j/4AAQ...
</images>
```
(JPEG data with PNG MIME type)

**Options**:
- A) Trust the user (no validation)
- B) Detect magic bytes and error if mismatch
- C) Detect magic bytes and auto-correct MIME type

**Recommendation**: Option A (trust the user). Rationale:
- XTOON is a transport format, not a validation framework
- Magic byte detection adds complexity and dependencies
- User might intentionally mislabel (e.g., workaround for broken consumers)
- Downstream consumers (browsers, LLMs) will handle wrong MIME types appropriately

### Q2: Should `fileurl()` work with elements?

```xml
<data xt:table="{fileurl(src, media=image/png, codec=base64)}">
iVBORw0KG...
</data>
```

**Output**:
```xml
<data>
  <src>data:image/png;base64,iVBORw0KG...</src>
</data>
```

**Recommendation**: Yes, allow it. Use cases:
- Consistent behavior (same modifier works for attributes and elements)
- Useful when Data-URI needs to be in element text (e.g., CSS `url()` values)
- No additional complexity

### Q3: Should we support `codec=reference` for external URLs?

```xml
<images xt:table="{fileurl(@src, codec=reference)}" xt:row="img">
https://example.com/icon.png
</images>
```

**Output**:
```xml
<images>
  <img src="https://example.com/icon.png"/>
</images>
```

**Options**:
- A) Add `codec=reference` (no encoding, pass through URL)
- B) Keep it simple (only `base64` and `hex`)
- C) Use plain `@src` for URLs (no modifier needed)

**Recommendation**: Option C initially (YAGNI). Rationale:
- Plain `@src` already works for URLs: `{@src, @alt}` with `https://...,Icon`
- `fileurl()` is specifically for **generating** Data-URIs from encoded data
- Can add `codec=reference` later if use case emerges (e.g., validation of URL format)

### Q4: Default `codec` if not provided?

```xml
<images xt:table="{fileurl(@src, media=image/png)}" xt:row="img">
iVBORw0KG...
</images>
```

**Options**:
- A) Default to `base64` (most common)
- B) Error (require explicit codec)

**Recommendation**: Option B (require explicit `codec`). Rationale:
- Explicit is better than implicit (SOLID principle)
- Avoids ambiguity (hex data looks like base64)
- Consistent with `binary()` modifier (if we decide `codec` is required there)

### Q5: Should `media` be required?

```xml
<files xt:table="{fileurl(@src, codec=base64)}" xt:row="file">
iVBORw0KG...
</files>
```

**Output** (if allowed):
```xml
<files>
  <file src="data:;base64,iVBORw0KG..."/>
</files>
```

**Options**:
- A) Require `media` (explicit typing)
- B) Allow omission (use `application/octet-stream` default)
- C) Allow omission (use empty MIME type per RFC 2397)

**Recommendation**: Option A (require `media`). Rationale:
- Data-URIs without MIME type are confusing for consumers
- Forces user to think about data type
- Can be relaxed later if use case emerges

---

## Impact on Existing ADRs

### ADR-0005: Column Definition Syntax
**Changes needed**:
- Extend EBNF grammar to include `modifier(@name, ...)` syntax
- Add examples of attribute-targeted modifiers
- Document target type determination rule

### ADR-0009: Two-Phase Validation Strategy
**Additions needed**:
- Parse-time: Validate modifier compatibility with target type
- Expansion-time: Validate modifier return type matches target expectation

---

## Next Steps

1. **Get feedback** on this proposal
2. **Decide on open questions** (Q1-Q5 above)
3. **Update ADR-0005** with extended grammar
4. **Create ADR for `fileurl()` modifier** following ADR-0007/ADR-0008 pattern
5. **Update `modifier-examples-and-edge-cases.md`** with attribute modifier scenarios
6. **Decide if `image()` should be removed** from spec (replaced by `fileurl()`)
7. **Update README** with attribute modifier examples

---

## Related Decisions

- Should `binary()` require `codec` parameter? (Currently optional in README)
- Should we drop `image()` entirely? (See discussion in issue #13)
- Default separator for `list()` - should it inherit from `xt:sep`?

---

## Changelog

- **2025-11-17**: Initial draft based on discussion about Data-URI generation for `<img>` tags
