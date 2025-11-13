# XTOON Specification Questions & Clarifications

**Purpose**: This document captures ambiguities, contradictions, and unanswered questions from the README that must be resolved before implementation.

**Document Status**: Draft — requires maintainer review and decision  
**Created**: 2025-01-13  
**Last Updated**: 2025-01-13  
**Requires Review**: Yes

---

## 1. Core Grammar & Parsing Concerns

### 1.1 Delimiter Handling

**Questions**:
- Q1.1.1: What is the exact precedence for delimiter resolution?
  - README states: element-level `xt:sep` overrides global/CLI `--sep` (XTOON-06)
  - But what about default? Is it: CLI flag → `xt:sep` → default `,`?
  - Or: `xt:sep` → CLI flag → default `,`?
  
- Q1.1.2: Does `xt:sep` apply to `xt:repeat` as well, or only `xt:table`?
  - Grammar section says `xt:repeat` uses "delimiter rules (see `xt:sep`)"
  - But expansion rules say `xt:repeat` splits by `xt:sep` (default `,`)
  - Should `xt:repeat` have its own `sep` parameter, or inherit from parent/global?

- Q1.1.3: Can `xt:sep` be set on a parent element and inherited by child tables?
  - Example: `<root xt:sep="|"><items xt:table="...">` — does items use `|`?

- Q1.1.4: What are the allowed `xt:sep` values?
  - README shows `"," | "|" | "\t"` in three places
  - Are these the **only** allowed values, or can users provide arbitrary single-character delimiters?
  - What about multi-character delimiters (e.g., `||`, `::`)?
  - What about escape sequences (`\n`, `\r\n`)?

### 1.2 CSV Quoting & Escaping

**Questions**:
- Q1.2.1: What is the **complete** quoting/escaping spec?
  - README says: "accepts classic CSV quoting (`"…"`, `""` escape)"
  - Does this mean RFC 4180 compliance, or a subset?
  - Are single quotes (`'...'`) supported?
  - Can quotes be escaped with backslash (`\"`)?

- Q1.2.2: How do quotes interact with tail capture (`...`)?
  - If the last column is `xml(desc)...`, can it contain unescaped quotes?
  - Example: `i1,Alice,<p>"Hello" she said</p>` — does this parse correctly?

- Q1.2.3: How are leading/trailing spaces handled for quoted vs unquoted cells?
  - README: "Leading/trailing spaces on unfenced, unquoted scalar cells are trimmed"
  - What is "unfenced"? Is it the same as "unquoted"?
  - Example: ` "Alice" ` vs ` Alice ` — which spaces are kept?

- Q1.2.4: Are there escape sequences for special characters in scalar cells?
  - Example: How to include a literal comma in a `,`-delimited field without quotes?
  - Example: How to include a literal newline in a cell?

### 1.3 Column Definition Syntax

**Questions**:
- Q1.3.1: What is the exact syntax for the column list in `xt:table="{...}"`?
  - Are spaces required around commas? `{@id, name}` vs `{@id,name}`
  - Are newlines allowed? `{@id,\n  name,\n  desc}`
  - Can column definitions span multiple lines with continuation?

- Q1.3.2: How are column names validated?
  - Must they be valid XML QNames?
  - Are there reserved names (e.g., `row`, `table`, `xtoon`)?
  - Can column names contain special characters (e.g., `my-name`, `my_name`, `my:name`)?

- Q1.3.3: What happens if column names collide?
  - Example: `{@id, id}` — attribute and element with same name?
  - Example: `{name, name}` — duplicate element names?
  - Is this an error, or does the second one overwrite/append?

- Q1.3.4: Can modifier arguments contain commas?
  - Example: `json(data, item=my,child)` — is `item=my,child` or `item=my` + orphan `child`?
  - Should modifier args use a different separator (`;`, `:`)?

- Q1.3.5: What is the syntax for tail capture?
  - README shows `xml(desc)...` — is the `...` part of the modifier or separate?
  - Can it be written as `xml(desc, ...)` or `xml(desc) ...`?
  - Can it be applied to non-modifier columns? `name...`

### 1.4 Namespace Resolution

**Questions**:
- Q1.4.1: When are QNames resolved — parse time or expansion time?
  - README says "resolve QNames in current namespace context" and "Namespace resolution at expansion time"
  - But also "Validate function-style modifiers during parse, not expansion" (XTOON-04)
  - If we validate at parse time, how do we handle unresolved prefixes?

- Q1.4.2: How are default namespaces handled?
  - Example: `<items xmlns="http://example.org" xt:table="{name}">`
  - Does `name` resolve to `http://example.org:name` or no-namespace `name`?

- Q1.4.3: What if a prefix is declared on the table element itself?
  - Example: `<items xmlns:s="http://schema.org" xt:table="{s:name}">`
  - Should this work, or must prefixes be on ancestors only?

- Q1.4.4: How are namespace prefixes preserved in output?
  - If input has `s:Person`, does output use `s:Person` or `Person` (with xmlns)?
  - README: "Preserve namespaces and QName resolution exactly as written" — does this mean prefixes too?

- Q1.4.5: What happens if an `xml()` fragment uses undefined prefixes?
  - Example: `xml(desc)` with cell value `<s:tag/>` but no `xmlns:s` in scope?
  - Error immediately, or defer to XML parser and report with row/col context?

### 1.5 Row Parsing Rules

**Questions**:
- Q1.5.1: What constitutes a "non-blank line"?
  - Is ` ` (spaces only) blank?
  - Is `,,,` (only delimiters) blank?
  - Is a line with only whitespace and comments blank (if comments exist)?

- Q1.5.2: How are empty cells handled?
  - Example: `i1,,<p>Desc</p>` — what is the value of the second column?
  - Is it an empty string, `null`, or omitted entirely?
  - Does it depend on the modifier (e.g., `int()` on empty cell)?

- Q1.5.3: What is the cell count validation rule?
  - README: "Too few/many cells for non-tail rows"
  - If tail capture is used, how many cells are required? N-1 (since tail is greedy)?
  - If no tail capture, must cell count exactly match column count?

- Q1.5.4: How are multi-line rows handled?
  - README doesn't mention them — are they supported?
  - Example: A CSV-quoted field with literal `\n` inside?
  - Or is each line always exactly one row?

- Q1.5.5: What is the behavior for Windows vs Unix line endings?
  - Should `\r\n`, `\n`, and `\r` all be treated as row separators?
  - Or only `\n`?
  - How does this interact with tail capture?

---

## 2. Column Modifier Concerns

### 2.1 `xml(name)` Modifier

**Questions**:
- Q2.1.1: What is the exact XML parsing mode?
  - Fragment parsing (no single root required)?
  - Document parsing (single root required)?
  - README says "parse cell as an XML fragment; splice its nodes" — so fragment mode?

- Q2.1.2: How are XML declarations and DOCTYPE handled?
  - Can a cell contain `<?xml version="1.0"?>`?
  - Can it contain `<!DOCTYPE>`?
  - Should these be stripped or cause errors?

- Q2.1.3: What is the whitespace handling?
  - Are text nodes with only whitespace preserved?
  - Example: `<p> </p>` vs `<p></p>` — are they equivalent?

- Q2.1.4: How are CDATA sections handled?
  - Example: `<desc><![CDATA[<html>]]></desc>`
  - Are they preserved, or converted to text nodes?

- Q2.1.5: What if the cell contains multiple root elements?
  - Example: `<p>A</p><p>B</p>` — both spliced as children of `<name>`?
  - Or is this an error?

- Q2.1.6: How are XML comments and processing instructions handled?
  - Example: `<!-- comment -->` or `<?pi target?>`
  - Preserved, stripped, or error?

- Q2.1.7: What is the "small temporary wrapper" mentioned in Performance section?
  - Is it `<wrapper>...</wrapper>`?
  - Does it use the XTOON namespace or no namespace?
  - Can this leak into output if parsing fails?

### 2.2 `json(name [, item=childName])` Modifier

**Questions**:
- Q2.2.1: What is the exact JSON-to-XML mapping?
  - Objects: each key becomes a child element?
  - Arrays: repeated `<item>` elements?
  - Primitives: text node?
  - `null`: empty element, omitted, or error?

- Q2.2.2: How are JSON keys with special characters handled?
  - Example: `{"my-key": "value"}` — becomes `<my-key>value</my-key>`?
  - What if the key is not a valid XML name (e.g., `"123"`, `"@"`, `"foo bar"`)?

- Q2.2.3: How are nested objects/arrays handled?
  - Example: `{"person": {"name": "Alice"}}` — becomes `<person><name>Alice</name></person>`?
  - Example: `[["a", "b"]]` — nested arrays?

- Q2.2.4: What is the default `item` name if not provided?
  - README says "arrays → repeated `<item>` unless overridden"
  - Is `item` the default? Or error if not provided?

- Q2.2.5: How are JSON types preserved?
  - Example: `{"age": 31}` — is `31` stored as text "31" or with type annotation?
  - Should we emit `<age type="number">31</age>` or just `<age>31</age>`?

- Q2.2.6: Can `json()` be combined with tail capture?
  - Example: `json(data)...` — consume rest of line as JSON?

### 2.3 `list(name [, sep="," ][, trim=true])` Modifier

**Questions**:
- Q2.3.1: What is the default `sep` if not provided?
  - Inherit from `xt:sep`?
  - Always `,` regardless of `xt:sep`?

- Q2.3.2: What does `trim=true` trim?
  - Leading/trailing whitespace on each list item?
  - Or leading/trailing whitespace on the entire cell value before splitting?

- Q2.3.3: How are empty list items handled?
  - Example with `sep=","`: `"a,,c"` — is middle item empty string or omitted?
  - If omitted, result is `<name>a</name><name>c</name>`?
  - If kept, result is `<name>a</name><name></name><name>c</name>`?

- Q2.3.4: Can `list()` be nested or combined with other modifiers?
  - Example: `list(int(numbers), sep="|")` — split then coerce each?
  - Or is this syntax invalid?

- Q2.3.5: Can `list()` use multi-character separators?
  - Example: `list(tags, sep="::")`?

### 2.4 `binary(name [, media=... ][, codec=... ][, filename=...])` Modifier

**Questions**:
- Q2.4.1: What are the allowed `codec` values?
  - README mentions `base64` and `hex` — are these the only two?
  - What about `base32`, `base64url`, `percent-encoding`?

- Q2.4.2: What is the validation behavior?
  - Is the cell value validated as legal base64/hex?
  - Are padding characters (`=` for base64) required or optional?
  - Are line breaks allowed in base64 (MIME encoding)?

- Q2.4.3: What is the default `codec` if not provided?
  - Error, or assume `base64`?

- Q2.4.4: How are the optional attributes represented in output?
  - Example: `binary(data, media=image/png, codec=base64, filename=pic.png)`
  - Output: `<data media="image/png" codec="base64" filename="pic.png">...</data>`?
  - Or are these stored as child elements?

- Q2.4.5: Is the decoded binary stored, or the encoded text?
  - README: "value remains encoded text" — so always encoded?
  - Then what is the "validation" checking?

- Q2.4.6: What if `filename` contains characters illegal in XML attributes?
  - Example: `filename=my"file.png` — XML escaping applied?

### 2.5 `image(name [, media=... ][, codec=... ][, w=... ][, h=...])` Modifier

**Questions**:
- Q2.5.1: Is `image()` just sugar for `binary()`, or does it have additional validation?
  - Does it actually decode and check image dimensions?
  - Or just store metadata (`w`, `h`) without validation?

- Q2.5.2: What is the default `media` if not provided?
  - README shows `media=image/png` — is this the default?
  - Or must it be provided?

- Q2.5.3: What are the allowed `media` values?
  - Any `image/*` MIME type?
  - Specific whitelist (png, jpeg, gif, svg, webp)?

- Q2.5.4: Are `w` and `h` validated against actual image dimensions?
  - Or are they just metadata annotations?

### 2.6 Scalar Coercion Modifiers (`int`, `float`, `bool`)

**Questions**:
- Q2.6.1: What are the exact parsing rules for `int(name)`?
  - Decimal only, or hex (`0x...`), octal (`0o...`), binary (`0b...`)?
  - Leading `+` or `-` allowed?
  - Underscores for readability (`1_000_000`)?
  - Scientific notation (`1e6`)?

- Q2.6.2: What is the range for `int()`?
  - Signed 32-bit? 64-bit? Arbitrary precision?
  - Overflow error, or silently wrap/truncate?

- Q2.6.3: What are the parsing rules for `float(name)`?
  - Decimal point required (`1.0` vs `1`)?
  - Scientific notation (`1.5e-10`)?
  - Special values (`Infinity`, `-Infinity`, `NaN`)?

- Q2.6.4: What are the parsing rules for `bool(name)`?
  - Case-sensitive or insensitive?
  - Allowed values: `true/false`? `1/0`? `yes/no`? `t/f`? `on/off`?

- Q2.6.5: How are whitespace and empty cells handled?
  - Example: ` 42 ` (spaces around number) — trimmed before coercion?
  - Example: empty cell for `int(age)` — error, or omit element?

- Q2.6.6: What is the output format?
  - Are values normalized? Example: `1.0` → `1` for int?
  - Preserved as-is from input?

### 2.7 Date/Time Modifiers (`date`, `datetime`)

**Questions**:
- Q2.7.1: What is the default format if `fmt` is not provided?
  - README shows `fmt=YYYY-MM-DD` for `date()` — is this the default?
  - What about `datetime()`? ISO 8601 (`YYYY-MM-DDTHH:mm:ss`)?

- Q2.7.2: What format syntax is supported for `fmt`?
  - Strftime (`%Y-%m-%d`)?
  - Moment.js / Unicode CLDR (`YYYY-MM-DD`)?
  - ISO 8601 patterns?
  - Custom XTOON syntax?

- Q2.7.3: How are timezones handled in `datetime()`?
  - UTC only?
  - Preserve timezone offset in input?
  - Convert to UTC and store normalized?

- Q2.7.4: What does "store normalized text" mean?
  - Always output in ISO 8601 format regardless of input format?
  - Or preserve input format?

- Q2.7.5: Are partial dates/times supported?
  - Example: `2025-01` (year-month only)?
  - Example: `14:30` (time only, no date)?

### 2.8 `text(name [, format=...])` Modifier

**Questions**:
- Q2.8.1: What does `format=plain` do?
  - Store as-is with no processing?
  - Escape XML special characters (`<`, `>`, `&`)?

- Q2.8.2: What does `format=markdown` do?
  - Store markdown source as-is?
  - Convert to HTML?
  - Add a `format="markdown"` attribute?

- Q2.8.3: What does `format=html-escaped` do?
  - Escape all HTML/XML special characters?
  - Preserve as text (not parsed as XML)?

- Q2.8.4: Is the `format` attribute stored in the output element?
  - Example: `<desc format="markdown">...</desc>`?

---

## 3. Row Element Generation Concerns

### 3.1 Row Element Naming

**Questions**:
- Q3.1.1: What is the exact singularization algorithm?
  - README: "singularized from the container name"
  - Examples: `items` → `item`, `people` → `person`
  - What about edge cases: `data` → `datum`? `octopi` → `octopus`? `children` → `child`?
  - Is there a whitelist of irregular plurals, or a library used (e.g., `pluralize`)?

- Q3.1.2: What if the container name cannot be singularized?
  - Example: `<list>` → `list` or `li`?
  - Example: `<row>` → `row` or error?

- Q3.1.3: What if the container has a namespace prefix?
  - Example: `<s:people>` → `<s:person>` or `<person>`?

- Q3.1.4: What if `xt:row` and natural singularization conflict?
  - Example: `<items xt:row="entry">` — clear, uses `entry`
  - But validation: should we warn if `xt:row` doesn't match singularization?

### 3.2 `xt:with-attrs` Behavior

**Questions**:
- Q3.2.1: What is the exact syntax for `xt:with-attrs`?
  - README shows `@k=v @k2=v2 …`
  - Are quotes required around values with spaces? `@name="foo bar"`?
  - Can values contain `@` or `=` characters?

- Q3.2.2: How are QNames resolved in `xt:with-attrs`?
  - Example: `xt:with-attrs="@s:type=Person"` — does `s:` resolve?

- Q3.2.3: What if `xt:with-attrs` conflicts with column-defined attributes?
  - Example: `xt:with-attrs="@id=default"` and column `@id` — which wins?
  - Overwrite, merge, or error?

- Q3.2.4: Can `xt:with-attrs` reference dynamic values?
  - Example: `@timestamp={current-dateTime()}` — XPath evaluation?
  - Or only static literals?

---

## 4. Special Features Concerns

### 4.1 Tail Capture (`...`)

**Questions**:
- Q4.1.1: What is the exact syntax for tail capture?
  - Is it `xml(desc)...` (no space)?
  - Can it be `xml(desc) ...` (with space)?
  - Can it be `xml(desc, ...)` (inside modifier args)?

- Q4.1.2: How does tail capture interact with row delimiters?
  - Example with `xt:sep="|"`: `i1|Alice|<p>Text with | pipe</p>`
  - Does tail column consume literally to EOL (including `|`)?
  - Or does it respect delimiter for all columns and only tail is greedy?

- Q4.1.3: Can tail capture be used with non-modifier columns?
  - Example: `{@id, name, description...}` — is `description...` valid?
  - Does it capture as plain text, or error?

- Q4.1.4: What if tail capture column is empty?
  - Example: `i1,Alice,` — tail column is empty string?
  - Or omit the element entirely?

- Q4.1.5: Does tail capture preserve leading/trailing whitespace?
  - Example: `i1,Alice,  <p>Text</p>  ` — are leading/trailing spaces kept?

### 4.2 `xt:repeat` Semantics

**Questions**:
- Q4.2.1: How does `xt:repeat` interact with `xt:table` on the same element?
  - Can they coexist?
  - If yes, what is the order of operations?

- Q4.2.2: Where does the repeated content come from?
  - README: "Split element text by `xt:sep`"
  - Does "element text" mean direct text children only?
  - Or concatenation of all descendant text nodes?

- Q4.2.3: Can `xt:repeat` have modifiers?
  - Example: `xt:repeat="int(item)"` — split and coerce each?
  - Or is it always plain text?

- Q4.2.4: How are empty items in `xt:repeat` handled?
  - Example with `,` separator: `a,,c` — middle item empty or omitted?

- Q4.2.5: What if `xt:repeat` QName has a namespace prefix?
  - Example: `xt:repeat="s:tag"` — is `s:` resolved?

---

## 5. Error Handling & Reporting Concerns

### 5.1 Error Structure

**Questions**:
- Q5.1.1: What is the exact `XtError` interface?
  - README API sketch shows: `message`, `row`, `col`, `char`, `xpath`, `code`
  - Are `row`/`col` 0-indexed or 1-indexed?
  - Is `char` the character offset in the file, or in the current line?
  - What is `xpath` when the element hasn't been created yet (parse error)?

- Q5.1.2: What are the stable error `code` values?
  - Should these be documented (e.g., `UNKNOWN_MODIFIER`, `TAIL_NOT_LAST`, `XML_PARSE_ERROR`)?
  - Or dynamically generated?

- Q5.1.3: How is "context snippet" represented?
  - README: "Include row number, column number, and context snippet in all parse/validation errors" (XTOON-03)
  - Is the snippet in the error message string, or a separate field?
  - How many characters/lines of context?

### 5.2 Error Recovery & Stopping

**Questions**:
- Q5.2.1: What is the default `--stop-at` value?
  - README says "default 20"
  - Should this be configurable via environment variable or config file?

- Q5.2.2: What happens after hitting `--stop-at` limit?
  - Immediate exit, or finish the current table/row?
  - Is a summary "X more errors suppressed" message shown?

- Q5.2.3: How are errors counted?
  - One error per cell, per row, or per table?
  - Example: If a row has 3 columns with errors, is that 1 error or 3?

- Q5.2.4: Can users disable error stopping (`--stop-at Infinity`)?
  - Or is there a `--no-stop` flag?

### 5.3 Error Categories

**Questions**:
- Q5.3.1: Are warnings supported, or only errors?
  - Example: Column name shadows a built-in modifier name — warning or error?

- Q5.3.2: Are there severity levels (info, warning, error, fatal)?
  - Or just binary (error / no error)?

- Q5.3.3: Can errors be filtered by code or category?
  - Example: `--ignore=UNKNOWN_MODIFIER` to suppress specific errors?

---

## 6. API & Integration Concerns

### 6.1 Input/Output

**Questions**:
- Q6.1.1: What XML parser is used?
  - DOM (in-memory tree)?
  - SAX/streaming?
  - Is it configurable?

- Q6.1.2: What is the `XMLDocument` type in the API sketch?
  - DOM `Document` from WHATWG?
  - `libxmljs` `Document`?
  - Custom type?

- Q6.1.3: How are input encodings handled?
  - UTF-8 only?
  - Auto-detect from XML declaration?
  - Configurable?

- Q6.1.4: How are output encodings handled?
  - Always UTF-8?
  - Preserve input encoding?
  - Configurable?

- Q6.1.5: How is output formatting controlled?
  - Indentation (spaces, tabs, none)?
  - Line width?
  - Preserve input whitespace?

### 6.2 Options & Configuration

**Questions**:
- Q6.2.1: Can options be loaded from a config file?
  - Example: `.xtoonrc`, `xtoon.config.js`?
  - What format (JSON, YAML, JS)?

- Q6.2.2: Can options be set via environment variables?
  - Example: `XTOON_SEP="|"`, `XTOON_STOP_AT=50`?

- Q6.2.3: What is the precedence for options?
  - CLI flags → config file → env vars → defaults?

- Q6.2.4: Are there "profiles" or "presets"?
  - Example: `--strict` mentioned in CLI example — what does it do?
  - Are there `--lenient`, `--pedantic` modes?

### 6.3 Extension Points

**Questions**:
- Q6.3.1: Can users register custom column modifiers?
  - Example: `mymodifier(name, arg1, arg2)` — how to implement?
  - Is there a plugin API?

- Q6.3.2: Can users override singularization logic?
  - Example: Provide a custom dictionary or function?

- Q6.3.3: Can users customize error formatting?
  - Example: JSON output instead of human-readable text?

- Q6.3.4: Are there hooks for pre/post processing?
  - Example: Transform input before expansion, or output after expansion?

---

## 7. Performance & Scalability Concerns

### 7.1 Memory Usage

**Questions**:
- Q7.1.1: What is the memory footprint for large files?
  - README: "Memory bounded by largest fenced/tail cell encountered"
  - But is the entire input file loaded into memory first (DOM parsing)?
  - Or is it streaming line-by-line?

- Q7.1.2: Can XTOON handle files larger than available RAM?
  - Example: 10 GB XML file with embedded base64 images?

- Q7.1.3: Are there limits on cell size?
  - Example: Maximum cell value length (e.g., 1 MB, 10 MB)?

### 7.2 Streaming & Incremental Processing

**Questions**:
- Q7.2.1: Is streaming expansion supported?
  - Can output be written before entire input is parsed?
  - Or does the entire DOM need to be built first?

- Q7.2.2: Can multiple `xt:table` blocks be processed in parallel?
  - Or is processing strictly sequential?

- Q7.2.3: How are large `xml()` fragments handled?
  - Are they parsed lazily, or all upfront?

---

## 8. Testing & Validation Concerns

### 8.1 Test Strategy

**Questions**:
- Q8.1.1: What is the expected test coverage?
  - README mentions "Golden tests", "Property tests", "Fuzz tests", "Namespace matrix"
  - Are all of these required for v0.1?
  - What is the priority order?

- Q8.1.2: Are there official test fixtures?
  - Example: A test suite that all conforming implementations must pass?

- Q8.1.3: How are test failures reported?
  - Diff output for golden tests?
  - Counterexamples for property tests?

### 8.2 Linting Mode

**Questions**:
- Q8.2.1: What exactly does `xtoon lint` check?
  - Only expansion errors, or also style/best-practice warnings?
  - Example: Warn if `xt:row` doesn't match singularization?
  - Example: Warn if columns are not sorted alphabetically?

- Q8.2.2: Can lint rules be customized?
  - Example: Enable/disable specific checks?

- Q8.2.3: What is the output format for `lint`?
  - Human-readable text?
  - JSON (for CI integration)?
  - JUnit XML?

---

## 9. Determinism & Round-Trip Concerns

### 9.1 Deterministic Expansion

**Questions**:
- Q9.1.1: What guarantees determinism?
  - README: "Deterministic expansion" (XTOON-01), "No cross-insertion"
  - Does this mean same input always produces byte-identical output?
  - Or structurally identical (whitespace may vary)?

- Q9.1.2: How are insertion order and iteration order guaranteed?
  - Example: `json()` with JavaScript objects — are keys sorted, or insertion order preserved?
  - Does this depend on the JSON parser?

- Q9.1.3: Are generated element/attribute IDs stable?
  - Or does the tool generate UUIDs or timestamps that vary per run?

### 9.2 Round-Trip / Re-Surface

**Questions**:
- Q9.2.1: Is there a `xtoon collapse` or `xtoon contract` command?
  - To convert expanded XML back to XTOON authoring syntax?

- Q9.2.2: What information is lost in expansion?
  - README: "Re-surface tooling can reconstruct headers"
  - But can it reconstruct column order, modifiers, `xt:with-attrs`, etc.?

- Q9.2.3: Is round-trip lossless?
  - `expand(collapse(x)) == x` ?
  - Or only structurally equivalent?

---

## 10. CLI & User Experience Concerns

### 10.1 CLI Commands

**Questions**:
- Q10.1.1: Are there additional commands beyond `expand` and `lint`?
  - Example: `xtoon validate`, `xtoon format`, `xtoon version`?

- Q10.1.2: Can `expand` read from stdin and write to stdout?
  - Example: `cat input.xml | xtoon expand > output.xml`?

- Q10.1.3: Can multiple files be processed in one invocation?
  - Example: `xtoon expand *.xtoon.xml`?
  - Are they processed sequentially or in parallel?

- Q10.1.4: Is there a `--watch` mode for development?
  - Automatically re-expand when input files change?

### 10.2 Error Output

**Questions**:
- Q10.2.1: Where are errors printed?
  - Stderr (standard) or stdout?

- Q10.2.2: Are errors colorized?
  - Red for errors, yellow for warnings, etc.?
  - Can colors be disabled (`--no-color`, `NO_COLOR` env var)?

- Q10.2.3: Are there verbosity levels?
  - `--quiet`, `--verbose`, `--debug`?

### 10.3 Help & Documentation

**Questions**:
- Q10.3.1: Is there a `--help` flag?
  - What information does it show?

- Q10.3.2: Is there a `--version` flag?

- Q10.3.3: Are there examples in `--help` output?

- Q10.3.4: Is there man page documentation (`man xtoon`)?

---

## 11. Security Concerns

### 11.1 XML Security

**Questions**:
- Q11.1.1: Are XML bomb attacks prevented?
  - Example: Exponential entity expansion (`<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">`)?
  - README: "Prevent XML external entity (XXE) attacks; disable external entities in parser" (SEC-04)
  - But what about entity expansion bombs?

- Q11.1.2: Are there limits on recursion depth?
  - Example: Deeply nested XML fragments in cells?

- Q11.1.3: Are there limits on document size?
  - To prevent DoS via huge files?

### 11.2 Code Injection

**Questions**:
- Q11.2.1: Can `json()` be used to inject code?
  - Example: Cell contains `{"__proto__": {"isAdmin": true}}`?
  - Is prototype pollution prevented?

- Q11.2.2: Can `xml()` be used to inject scripts?
  - Example: Cell contains `<script>alert('XSS')</script>`?
  - Is sanitization needed, or is that the user's responsibility?

- Q11.2.3: Are path traversal attacks in `binary(filename=...)` prevented?
  - Example: `filename="../../../etc/passwd"`?

---

## 12. Compatibility & Standards Concerns

### 12.1 XML Standards

**Questions**:
- Q12.1.1: Which XML version is supported?
  - XML 1.0, 1.1, or both?

- Q12.1.2: Is the tool compatible with XSLT 1.0, 2.0, 3.0?
  - Since expanded output is "ready for XSLT"?

- Q12.1.3: Does expanded XML validate against XSD/RelaxNG/Schematron?
  - Are there any XTOON-specific artifacts that might cause validation failures?

### 12.2 Platform Compatibility

**Questions**:
- Q12.2.1: Which platforms are supported?
  - Linux, macOS, Windows?
  - What about BSDs, Solaris?

- Q12.2.2: Which Node.js versions are supported?
  - LTS only, or also current?
  - Minimum version?

- Q12.2.3: Are there browser/Deno/Bun builds?
  - Or is it Node.js CLI only?

---

## 13. Documentation & Examples Concerns

### 13.1 Missing Examples

**Questions**:
- Q13.1.1: Where are examples for error cases?
  - README shows successful expansions, but no error examples.

- Q13.1.2: Where are examples for each column modifier?
  - README shows `xml()`, `json()`, `list()`, `binary()`, `image()`
  - But missing: `int()`, `float()`, `bool()`, `date()`, `datetime()`, `text()`

- Q13.1.3: Where are examples for `xt:repeat`?
  - Mentioned in grammar, but no example in README.

- Q13.1.4: Where are examples for `xt:with-attrs`?
  - Mentioned in grammar, but no example in README.

- Q13.1.5: Where are examples for namespace-prefixed columns?
  - Example: `{@s:id, s:name, s:Person}` with `xmlns:s="http://schema.org"`

### 13.2 Contradictions & Ambiguities

**Potential contradictions found**:
- C13.2.1: **Validation timing**
  - README: "Validate function-style modifiers during parse, not expansion" (XTOON-04)
  - But also: "Expand" section says "validate rows and cells against column modifiers"
  - **Q**: Are modifiers validated during parse (structure only) and expansion (content), or only one phase?

- C13.2.2: **Delimiter precedence**
  - README: "Element-level `xt:sep` overrides global/CLI `--sep`" (XTOON-06)
  - But CLI section says: "`--sep` override `xt:sep`"
  - **Q**: Which one is correct? Does CLI flag override element attribute, or vice versa?

- C13.2.3: **Strip behavior**
  - README: "Strip `xt:*` attributes unless `--no-strip`"
  - But expansion rules say: "Strip `xt:*` attributes unless `keepXtAttrs` option"
  - **Q**: Is the CLI flag `--no-strip` or `--keep-xt-attrs`? Are they the same?

- C13.2.4: **Row element naming**
  - Grammar: "`xt:row` = Row element name override. Otherwise singularized from the container name."
  - But expansion: "Row element: `xt:row` or singularized container name."
  - **Q**: If both are missing (no `xt:row`, can't singularize), is it an error or use container name as-is?

---

## 14. Migration & Versioning Concerns

### 14.1 Version Compatibility

**Questions**:
- Q14.1.1: Is there a version number in the XTOON namespace?
  - Example: `urn:xtoon:v1`?
  - Or always `urn:xtoon` regardless of version?

- Q14.1.2: How will breaking changes be handled in future versions?
  - Will there be a `xtoon migrate` command?

- Q14.1.3: Can v0.1 files be mixed with future v0.2/v1.0 syntax?
  - Or must the entire file use one version?

---

## 15. Prioritization

**Suggested priority for resolving questions**:

**P0 (Blocking implementation)**:
1. Q1.1.1 - Delimiter precedence (contradicts CLI vs rules)
2. Q1.2.1 - Complete quoting/escaping spec
3. Q1.3.4 - Modifier argument parsing (comma handling)
4. Q1.4.1 - QName resolution timing
5. Q2.1.1 - `xml()` parsing mode
6. Q2.2.1 - `json()` to XML mapping
7. Q13.2.1 - Validation timing contradiction
8. Q13.2.2 - Delimiter precedence contradiction

**P1 (Needed for correctness)**:
- All section 2 questions (column modifiers)
- Q3.1.1 - Singularization algorithm
- Q5.1.1 - `XtError` interface

**P2 (Needed for usability)**:
- Section 5 (error handling)
- Section 10 (CLI UX)
- Q13.1.x - Missing examples

**P3 (Can be deferred)**:
- Section 6.3 (extension points)
- Section 9.2 (round-trip)
- Section 14 (versioning)

---

## Next Steps

1. **Review this document** with project maintainers
2. **Document decisions** in new ADRs
3. **Update README** to remove ambiguities and contradictions
4. **Create test fixtures** for all resolved questions
5. **Begin implementation** once P0/P1 questions are answered
