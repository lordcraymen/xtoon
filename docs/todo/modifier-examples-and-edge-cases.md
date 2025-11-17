# Column Modifier Examples and Edge Cases

**Purpose**: Concrete examples to clarify ambiguous behaviors before writing ADRs.  
**Related Issue**: [#13 - Specify all column modifier behaviors](https://github.com/lordcraymen/xtoon/issues/13)  
**Date**: 2025-11-17

---

## 1. `list(name [, sep="," ][, trim=true])`

### Q2.3.1: Default `sep` if not provided

**Scenario 1a**: Inherit from `xt:sep`?
```xml
<items xmlns:xt="urn:xtoon" xt:table="{list(tags)}" xt:sep="|">
apple|banana|cherry
</items>
```
**Question**: Does `list(tags)` split by `|` (inherited) or `,` (hardcoded default)?

**Scenario 1b**: Always use comma?
```xml
<items xmlns:xt="urn:xtoon" xt:table="{list(tags)}" xt:sep="|">
apple,banana,cherry
</items>
```
**Question**: Does this produce 3 tags or 1 tag (entire string)?

---

### Q2.3.2: What does `trim=true` trim?

**Scenario 2a**: Trim each item
```xml
<items xmlns:xt="urn:xtoon" xt:table="{list(tags, trim=true)}" xt:sep=",">
" apple , banana , cherry "
</items>
```
**Expected output (if trim each item)**:
```xml
<items>
  <tags>apple</tags>
  <tags>banana</tags>
  <tags>cherry</tags>
</items>
```

**Scenario 2b**: Trim entire cell before splitting
```xml
<items xmlns:xt="urn:xtoon" xt:table="{list(tags, trim=true)}" xt:sep=",">
"  apple,banana,cherry  "
</items>
```
**Expected output (if trim cell first)**:
```xml
<items>
  <tags>apple</tags>
  <tags>banana</tags>
  <tags>cherry</tags>
</items>
```

**Scenario 2c**: Trim both?

---

### Q2.3.3: How are empty list items handled?

**Scenario 3a**: Consecutive separators
```xml
<items xmlns:xt="urn:xtoon" xt:table="{list(tags)}" xt:sep=",">
"a,,c"
</items>
```
**Option A** (skip empty): `<tags>a</tags><tags>c</tags>`  
**Option B** (preserve empty): `<tags>a</tags><tags/><tags>c</tags>`  
**Option C** (error): "Empty list item at position 2"

**Scenario 3b**: Leading/trailing separators
```xml
<items xmlns:xt="urn:xtoon" xt:table="{list(tags)}" xt:sep=",">
",a,b,"
</items>
```
**Question**: 2 items or 4 items (with empty start/end)?

**Scenario 3c**: Empty cell
```xml
<items xmlns:xt="urn:xtoon" xt:table="{list(tags)}" xt:sep=",">
""
</items>
```
**Option A**: `<tags/>` (empty element)  
**Option B**: No `<tags>` elements at all  
**Option C**: `<tags/>` (one empty item)

---

### Q2.3.4: Can `list()` be nested or combined?

**Scenario 4a**: Nested (probably invalid)
```xml
<items xmlns:xt="urn:xtoon" xt:table="{list(outer, sep=;), list(inner, sep=,)}" xt:sep="|">
"a;b;c|1,2,3"
</items>
```
**Question**: Is this a parse-time error or does it make sense?

**Scenario 4b**: Combined with attribute
```xml
<items xmlns:xt="urn:xtoon" xt:table="{@id, list(tags)}" xt:sep=",">
1,"a,b,c"
</items>
```
**Expected** (should work):
```xml
<items id="1">
  <tags>a</tags>
  <tags>b</tags>
  <tags>c</tags>
</items>
```

---

### Q2.3.5: Can `list()` use multi-character separators?

**Scenario 5**: Multi-char separator
```xml
<items xmlns:xt="urn:xtoon" xt:table="{list(tags, sep=::)}" xt:sep=",">
"apple::banana::cherry"
</items>
```
**Question**: Is `::` allowed, or only single-character separators?

---

## 2. `binary(name [, media=... ][, codec=... ][, filename=...])`

### Q2.4.1: Allowed `codec` values

**Scenario 1**: Unknown codec
```xml
<files xmlns:xt="urn:xtoon" xt:table="{binary(data, codec=base32)}" xt:sep=",">
JBSWY3DPEBLW64TMMQ======
</files>
```
**Question**: Parse-time error or expansion-time error? Error message?

---

### Q2.4.2: Validation behavior (padding, line breaks)

**Scenario 2a**: Missing base64 padding
```xml
<files xmlns:xt="urn:xtoon" xt:table="{binary(data, codec=base64)}" xt:sep=",">
SGVsbG8gV29ybGQ
</files>
```
**Question**: Error or auto-pad?

**Scenario 2b**: Line breaks in base64
```xml
<files xmlns:xt="urn:xtoon" xt:table="{binary(data, codec=base64)}" xt:sep=",">
"U0c5c2JHOGdWMjl5YkdRPQ==
"
</files>
```
**Question**: Allowed (strip whitespace) or error?

**Scenario 2c**: Invalid base64 character
```xml
<files xmlns:xt="urn:xtoon" xt:table="{binary(data, codec=base64)}" xt:sep=",">
SGVsbG8h@#$%
</files>
```
**Expected**: Expansion-time error with row/column pointer.

---

### Q2.4.3: Default `codec` if not provided

**Scenario 3**: No codec specified
```xml
<files xmlns:xt="urn:xtoon" xt:table="{binary(data)}" xt:sep=",">
SGVsbG8gV29ybGQ=
</files>
```
**Question**: Assume `base64`? Error (codec required)? Treat as opaque text?

---

### Q2.4.4: How are optional attributes represented in output?

**Scenario 4a**: All attributes provided
```xml
<files xmlns:xt="urn:xtoon" xt:table="{binary(data, media=image/png, codec=base64, filename=icon.png)}" xt:sep=",">
iVBORw0KG...
</files>
```
**Expected output (attributes on element?)**:
```xml
<files>
  <data media="image/png" codec="base64" filename="icon.png">iVBORw0KG...</data>
</files>
```

**Scenario 4b**: Only codec provided
```xml
<files xmlns:xt="urn:xtoon" xt:table="{binary(data, codec=hex)}" xt:sep=",">
48656c6c6f
</files>
```
**Expected output**:
```xml
<files>
  <data codec="hex">48656c6c6f</data>
</files>
```
**Question**: Are missing attributes omitted from output?

---

### Q2.4.5: Is decoded binary stored, or encoded text?

**Scenario 5**: Decoded vs encoded storage
```xml
<files xmlns:xt="urn:xtoon" xt:table="{binary(data, codec=base64)}" xt:sep=",">
SGVsbG8=
</files>
```
**Option A** (decoded, base64-encoded in XML):
```xml
<files><data codec="base64">SGVsbG8=</data></files>
```

**Option B** (raw bytes, implementation-dependent):
```xml
<files><data>Hello</data></files>
```

**Question**: Per README ("value remains encoded text"), probably Option A?

---

### Q2.4.6: `filename` XML attribute escaping

**Scenario 6**: Filename with special characters
```xml
<files xmlns:xt="urn:xtoon" xt:table="{binary(data, codec=base64, filename=my file.txt)}" xt:sep=",">
SGVsbG8=
</files>
```
**Expected output**:
```xml
<files>
  <data codec="base64" filename="my file.txt">SGVsbG8=</data>
</files>
```

**Scenario 6b**: Filename with quotes
```xml
<files xmlns:xt="urn:xtoon" xt:table="{binary(data, filename=my&quot;file&quot;.txt)}" xt:sep=",">
SGVsbG8=
</files>
```
**Question**: Do we escape filenames in output? Parse-time validation of filename characters?

---

## 3. `image(name [, media=... ][, codec=... ][, w=... ][, h=...])`

### Q2.5.1: Is `image()` just sugar for `binary()`, or additional validation?

**Scenario 1**: Image with invalid dimensions
```xml
<photos xmlns:xt="urn:xtoon" xt:table="{image(photo, w=800, h=600)}" xt:sep=",">
iVBORw0KG...
</photos>
```
**Question**: Does XTOON validate that the decoded image is actually 800x600?  
**Or**: Are `w`/`h` just metadata hints (no validation)?

---

### Q2.5.2: Default `media` if not provided

**Scenario 2**: No media type specified
```xml
<photos xmlns:xt="urn:xtoon" xt:table="{image(photo)}" xt:sep=",">
iVBORw0KG...
</photos>
```
**Question**: Default to `image/png`? Require explicit media type? Detect from magic bytes?

---

### Q2.5.3: Allowed `media` values

**Scenario 3**: Non-image media type
```xml
<photos xmlns:xt="urn:xtoon" xt:table="{image(photo, media=application/pdf)}" xt:sep=",">
JVBERi0x...
</photos>
```
**Question**: Parse-time error (must be `image/*`)? Or allowed?

---

### Q2.5.4: Are `w` and `h` validated against actual dimensions?

**Scenario 4**: Dimensions mismatch
```xml
<photos xmlns:xt="urn:xtoon" xt:table="{image(photo, w=100, h=100, codec=base64)}" xt:sep=",">
iVBORw0KGgoAAAANSUhEUgAAAAUA...
</photos>
```
(Assume the PNG is actually 200x200 pixels)

**Option A**: Expansion-time error "Image dimensions 200x200 do not match declared w=100, h=100"  
**Option B**: Just metadata (no validation)  
**Option C**: Parse-time warning, but allow

---

## 4. `int(name)`, `float(name)`, `bool(name)`

### Q2.6.1: `int()` parsing rules

**Scenario 1a**: Hexadecimal
```xml
<data xmlns:xt="urn:xtoon" xt:table="{int(value)}" xt:sep=",">
0xFF
</data>
```
**Question**: Parse as 255 or error?

**Scenario 1b**: Octal
```xml
<data xmlns:xt="urn:xtoon" xt:table="{int(value)}" xt:sep=",">
0o77
</data>
```
**Question**: Parse as 63 or error?

**Scenario 1c**: Binary
```xml
<data xmlns:xt="urn:xtoon" xt:table="{int(value)}" xt:sep=",">
0b1010
</data>
```
**Question**: Parse as 10 or error?

**Scenario 1d**: Scientific notation
```xml
<data xmlns:xt="urn:xtoon" xt:table="{int(value)}" xt:sep=",">
1e6
</data>
```
**Question**: Parse as 1000000 or error (not valid int syntax)?

---

### Q2.6.2: `int()` range

**Scenario 2a**: Large integer (64-bit)
```xml
<data xmlns:xt="urn:xtoon" xt:table="{int(value)}" xt:sep=",">
9223372036854775807
</data>
```
**Question**: Supported (int64)? Or limited to int32?

**Scenario 2b**: Overflow
```xml
<data xmlns:xt="urn:xtoon" xt:table="{int(value)}" xt:sep=",">
999999999999999999999999999
</data>
```
**Question**: Error? Arbitrary precision? Truncate?

---

### Q2.6.3: `float()` parsing rules

**Scenario 3a**: Integer without decimal point
```xml
<data xmlns:xt="urn:xtoon" xt:table="{float(value)}" xt:sep=",">
42
</data>
```
**Question**: Allowed (parse as `42.0`) or require decimal point?

**Scenario 3b**: Special values
```xml
<data xmlns:xt="urn:xtoon" xt:table="{float(value)}" xt:sep=",">
Infinity
-Infinity
NaN
</data>
```
**Question**: Supported? Error?

**Scenario 3c**: Scientific notation
```xml
<data xmlns:xt="urn:xtoon" xt:table="{float(value)}" xt:sep=",">
1.23e-4
</data>
```
**Question**: Supported?

---

### Q2.6.4: `bool()` parsing rules

**Scenario 4**: Case sensitivity and allowed values
```xml
<flags xmlns:xt="urn:xtoon" xt:table="{bool(enabled)}" xt:sep=",">
true
True
TRUE
false
False
FALSE
1
0
yes
no
</flags>
```
**Question**: Which values are valid? Case-sensitive?

---

### Q2.6.5: Whitespace and empty cell handling

**Scenario 5a**: Leading/trailing whitespace
```xml
<data xmlns:xt="urn:xtoon" xt:table="{int(value)}" xt:sep=",">
"  42  "
</data>
```
**Question**: Trim before parsing? Or error?

**Scenario 5b**: Empty cell for int
```xml
<data xmlns:xt="urn:xtoon" xt:table="{int(value)}" xt:sep=",">
""
</data>
```
**Option A**: Error "Cannot coerce empty string to integer"  
**Option B**: `<value/>` (empty element)  
**Option C**: Omit element entirely

**Scenario 5c**: Empty cell for bool
```xml
<flags xmlns:xt="urn:xtoon" xt:table="{bool(enabled)}" xt:sep=",">
""
</flags>
```
**Question**: Error, `false`, or empty element?

---

### Q2.6.6: Output format (normalized or preserved)?

**Scenario 6a**: Integer normalization
```xml
<data xmlns:xt="urn:xtoon" xt:table="{int(value)}" xt:sep=",">
007
</data>
```
**Option A** (normalized): `<value>7</value>`  
**Option B** (preserved): `<value>007</value>`

**Scenario 6b**: Float normalization
```xml
<data xmlns:xt="urn:xtoon" xt:table="{float(value)}" xt:sep=",">
3.14000
</data>
```
**Option A** (normalized): `<value>3.14</value>`  
**Option B** (preserved): `<value>3.14000</value>`

---

## 5. `date(name [, fmt=...])`, `datetime(name [, fmt=...])`

### Q2.7.1: Default format if `fmt` not provided

**Scenario 1**: No format specified
```xml
<events xmlns:xt="urn:xtoon" xt:table="{date(when)}" xt:sep=",">
2025-11-17
</events>
```
**Question**: Assume ISO 8601 (`YYYY-MM-DD`)? Or error (format required)?

---

### Q2.7.2: Format syntax supported

**Scenario 2a**: strftime-style
```xml
<events xmlns:xt="urn:xtoon" xt:table="{date(when, fmt=%Y-%m-%d)}" xt:sep=",">
2025-11-17
</events>
```

**Scenario 2b**: Moment.js-style
```xml
<events xmlns:xt="urn:xtoon" xt:table="{date(when, fmt=YYYY-MM-DD)}" xt:sep=",">
2025-11-17
</events>
```

**Scenario 2c**: Custom literal
```xml
<events xmlns:xt="urn:xtoon" xt:table="{date(when, fmt=iso8601)}" xt:sep=",">
2025-11-17
</events>
```

**Question**: Which format syntax? Or support multiple?

---

### Q2.7.3: Timezone handling in `datetime()`

**Scenario 3a**: UTC indicator
```xml
<events xmlns:xt="urn:xtoon" xt:table="{datetime(when)}" xt:sep=",">
2025-11-17T14:30:00Z
</events>
```
**Question**: Store as-is or convert to local time?

**Scenario 3b**: Timezone offset
```xml
<events xmlns:xt="urn:xtoon" xt:table="{datetime(when)}" xt:sep=",">
2025-11-17T14:30:00+01:00
</events>
```
**Question**: Preserve offset or normalize to UTC?

**Scenario 3c**: No timezone
```xml
<events xmlns:xt="urn:xtoon" xt:table="{datetime(when)}" xt:sep=",">
2025-11-17T14:30:00
</events>
```
**Question**: Assume local time? UTC? Error?

---

### Q2.7.4: What does "store normalized text" mean?

**Scenario 4**: Input vs output format
```xml
<events xmlns:xt="urn:xtoon" xt:table="{date(when, fmt=MM/DD/YYYY)}" xt:sep=",">
11/17/2025
</events>
```
**Option A** (normalized to ISO): `<when>2025-11-17</when>`  
**Option B** (preserved format): `<when>11/17/2025</when>`  
**Option C** (parsed, re-formatted): Depends on output format parameter (not specified yet)

---

### Q2.7.5: Partial dates/times supported?

**Scenario 5a**: Year-only
```xml
<events xmlns:xt="urn:xtoon" xt:table="{date(when, fmt=YYYY)}" xt:sep=",">
2025
</events>
```
**Question**: Allowed? Store as `2025-01-01` or `2025`?

**Scenario 5b**: Year-month
```xml
<events xmlns:xt="urn:xtoon" xt:table="{date(when, fmt=YYYY-MM)}" xt:sep=",">
2025-11
</events>
```
**Question**: Allowed?

---

## 6. `text(name [, format=...])`

### Q2.8.1: What does `format=plain` do?

**Scenario 1**: Plain text
```xml
<docs xmlns:xt="urn:xtoon" xt:table="{text(content, format=plain)}" xt:sep=",">
"Hello <world> & stuff"
</docs>
```
**Expected output**:
```xml
<docs>
  <content format="plain">Hello &lt;world&gt; &amp; stuff</content>
</docs>
```
**Question**: Is `format=plain` just metadata (attribute)? Or does it affect processing?

---

### Q2.8.2: What does `format=markdown` do?

**Scenario 2**: Markdown content
```xml
<docs xmlns:xt="urn:xtoon" xt:table="{text(content, format=markdown)}" xt:sep=",">
"# Title\n\nParagraph with **bold**."
</docs>
```
**Option A** (metadata only):
```xml
<docs>
  <content format="markdown"># Title

Paragraph with **bold**.</content>
</docs>
```

**Option B** (convert to HTML):
```xml
<docs>
  <content format="markdown"><h1>Title</h1><p>Paragraph with <strong>bold</strong>.</p></content>
</docs>
```

**Question**: Is markdown rendered or stored as-is with metadata?

---

### Q2.8.3: What does `format=html-escaped` do?

**Scenario 3**: HTML-escaped content
```xml
<docs xmlns:xt="urn:xtoon" xt:table="{text(content, format=html-escaped)}" xt:sep=",">
"<script>alert('xss')</script>"
</docs>
```
**Expected output**:
```xml
<docs>
  <content format="html-escaped">&lt;script&gt;alert('xss')&lt;/script&gt;</content>
</docs>
```
**Question**: Is this just metadata, or does it trigger additional escaping beyond standard XML?

---

### Q2.8.4: Is `format` attribute stored in output element?

**Scenario 4**: Format attribute in output
```xml
<docs xmlns:xt="urn:xtoon" xt:table="{text(content, format=markdown)}" xt:sep=",">
"# Title"
</docs>
```
**Option A** (store format):
```xml
<docs>
  <content format="markdown"># Title</content>
</docs>
```

**Option B** (format is parse-time only):
```xml
<docs>
  <content># Title</content>
</docs>
```

**Question**: Should downstream consumers know the format?

---

## Common Themes Across All Modifiers

### Whitespace Handling
Should all modifiers trim leading/trailing whitespace from cells before processing?

### Empty Cell Behavior
What should each modifier produce for an empty string (`""`) cell?

### Error Message Format
All errors must follow XTOON-03:
```
Error at row {N}, column {M}: {specific error}
Context: {csv_line_snippet}
```

### Parse-Time vs Expansion-Time (ADR-0009)
- **Parse-time**: Syntax, parameter types, QName validity
- **Expansion-time**: Cell content validation, coercion, security checks

---

## Next Steps

For each modifier:
1. Choose one answer for each question
2. Document rationale (align with SOLID, security, performance)
3. Write ADR following ADR-0007/ADR-0008 pattern
4. Implement with unit tests covering all edge cases
5. Update README with complete specification

**Priority Order** (suggested):
1. Scalar types (`int`, `float`, `bool`) - simplest, high impact
2. `list()` - commonly used, clarifies separator inheritance
3. Date/time - complex, needs format library decision
4. `binary()`/`image()` - related, can specify together
5. `text()` - least impactful, mostly metadata
