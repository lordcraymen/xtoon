# XTOON — Expander & Linter for XML Tabular Object-Oriented Notation

A tool that **expands** XTOON authoring syntax into plain XML and **lints** authoring blocks for determinism. It implements the v0.1 surface grammar plus the agreed extensions:

* Function-style **column modifiers**: `xml(name)`, `json(name,…)`, `binary(name,…)`, `image(name,…)`, `list(name,…)`, `int/float/bool/date(name,…)`, etc.
* **Tail capture**: `...` on the final column to consume the rest of the line verbatim.
* Boring **delimiter knob**: `xt:sep="," | "|" | "\t"` (`,` default).
* Core attrs from the base spec: `xt:table`, `xt:row`, `xt:repeat`, `xt:with-attrs`.
* Deterministic, **local** expansion; no cross-insertion.

---

## What it does

* **Expand** `xt:*` authoring blocks into ordinary XML (ready for XSD/RelaxNG/Schematron/XPath/XSLT).
* **Validate** rows and cells against column modifiers (JSON/XML well-formedness, scalar coercions, codecs).
* **Preserve namespaces** and QName resolution exactly as written.
* **Report precise errors** with row/column pointers; exit non-zero on failure (CLI) or raise exceptions (API).

---

## Quick start (CLI)

```bash
xtoon expand input.xtoon.xml > output.xml
xtoon expand input.xtoon..xml -o output.xml --strict
xtoon lint input.xtoon.xml                     # check only
```

Options:

* `--sep "," | "|" | "\t"` override `xt:sep`.
* `--stop-at N` stop after N errors (default 20).
* `--no-strip` keep `xt:*` attributes in the output (debug).

---

## Example

**Authoring (XTOON)**

```xml
<items xmlns:xt="urn:xtoon"
       xt:table="{@id,name,xml(desc)...}">
  i1,Alice,<p>Lead <em>researcher</em></p>
  i2,Bob,<span>Engineer</span><note>Contract, some note</note>
</items>
```

**Expanded (XML)**

```xml
<items>
  <item id="i1">
    <name>Alice</name>
    <desc><p>Lead <em>researcher</em></p></desc>
  </item>
  <item id="i2">
    <name>Bob</name>
    <desc><span>Engineer</span><note>Contract, some note</note></desc>
  </item>
</items>
```

---

## Grammar

### Block attributes

* `xt:table="{ columns }"`
  Declares a tabular block. Column list uses the forms below.
* `xt:row="QName"`
  Row element name override. Otherwise singularized from the container name.
* `xt:repeat="QName"`
  Repeat simple items inside the element’s text using delimiter rules (see `xt:sep`).
* `xt:with-attrs="@k=v @k2=v2 …"`
  Default attributes added to each generated row.
* `xt:sep="," | "|" | "\t"`
  Row delimiter (`,` default).

### Columns (inside `{ … }`)

* **Attribute:** `@id`
* **Plain element (text):** `name`
* **Typed element (function style):** `fn(name [ , args… ])`
* **Tail capture:** append `...` to the **last** column only, e.g. `xml(desc)...`

### Built-in column modifiers

* `xml(name)` — parse cell as an XML fragment; splice its nodes as children of `<name>`.
* `json(name [, item=childName ])` — parse JSON. Objects → child elements by key; arrays → repeated `<item>` unless overridden.
* `list(name [, sep="," ][, trim=true ])` — split scalar into repeated `<name>` children.
* `binary(name [, media=type/subtype ][, codec=base64|hex ][, filename=… ])` — validate/annotate encoded bytes; value remains encoded text.
* `image(name [, media=image/png ][, codec=base64 ][, w=…, h=… ])` — sugar for `binary` with image defaults.
* `int/float/bool(name)` — coerce scalar; on failure, error.
* `date(name [, fmt=YYYY-MM-DD ])`, `datetime(name [, fmt=… ])` — parse with the given format; store normalized text.
* `text(name [, format=plain|markdown|html-escaped ])` — textual storage with optional semantics.

> All `QName` arguments (e.g., `s:Person`) resolve using in-scope `xmlns:*`.

---

## Row parsing

1. Determine delimiter: `xt:sep` or default `,`.
2. Tokenize a line into **N columns** where the **last** column may have `...` and captures to EOL.
3. Leading/trailing spaces on unfenced, unquoted scalar cells are trimmed.
4. Apply per-column semantics in order; if any step errors, record row/col and continue or stop per `--stop-at`.

> The agent accepts classic CSV quoting (`"…"`, `""` escape) but does **not** require it; `xml(desc)...` is usually enough to avoid quoting entirely.

---

## Expansion rules

* Scope is local: the element carrying `xt:*` transforms **its own** child content.
* `xt:table`:

  * Parse columns; resolve QNames in current namespace context.
  * Row element: `xt:row` or singularized container name.
  * Generate one row element per non-blank line.
  * Materialize attributes/elements according to columns and modifiers.
  * Apply `xt:with-attrs` to each generated row.
  * Strip `xt:*` attributes unless `--no-strip`.
* `xt:repeat`:

  * Split element text by `xt:sep` (default `,`) into items; trim unless modifier says otherwise.
  * Emit one `<QName>` child per item.
* Whitespace outside tabular semantics is preserved.

---

## Error model

All errors include **line/column**, **row index**, and **column index**:

* Unknown modifier name.
* Multiple `...` columns or `...` not on the last column.
* QName resolution failure (missing `xmlns:*`).
* `xml()` parse error (well-formedness, unbalanced tags).
* `json()` parse error.
* `binary()` codec violation (non-alphabet characters for base64/hex).
* Scalar coercion failures (`int/float/bool/date/datetime`).
* Too few/many cells for non-tail rows.

Exit codes:

* `0` success
* `1` parse/validation errors
* `2` IO/config errors

---

## API sketch

```ts
type ExpandOptions = {
  sep?: "," | "|" | "\t";
  stopAt?: number;
  keepXtAttrs?: boolean;
  onError?: (e: XtError) => void;
};

function expand(doc: XMLDocument, opts?: ExpandOptions): XMLDocument;
function lint(doc: XMLDocument, opts?: ExpandOptions): XtError[];
```

`XtError` contains: `message`, `row`, `col`, `char`, `xpath` (best-effort), `code` (stable identifier).

---

## Before/After gallery

### JSON + list + typed scalars

**XTOON**

```xml
<people xmlns:xt="urn:xtoon"
        xt:table="{@id,int(age),json(profile),list(pet,sep='|')}">
  p1,31,{"skills":["xml","xslt"]},cat|dog
</people>
```

**Expanded**

```xml
<people>
  <person id="p1">
    <age>31</age>
    <profile><skills>xml</skills><skills>xslt</skills></profile>
    <pet>cat</pet><pet>dog</pet>
  </person>
</people>
```

### Binary/image

**XTOON**

```xml
<scans xmlns:xt="urn:xtoon"
       xt:table="{@id,image(data,media=image/png,codec=base64),@filename}">
  s1,iVBORw0KGgoAAA...,scan1.png
</scans>
```

**Expanded**

```xml
<scans>
  <scan id="s1" filename="scan1.png">
    <data media="image/png" codec="base64">iVBORw0KGgoAAA...</data>
  </scan>
</scans>
```

---

## Determinism & round-trip

* Modifiers and positions fully describe the transformation.
* Tail capture pins ambiguous cells to the final column.
* Namespace resolution at expansion time ensures stable QNames.
* Re-surface tooling can reconstruct headers from expanded XML (row name, attrs vs elems, simple modifiers).

---

## Performance characteristics

* Line-by-line streaming for `xt:table` (O(total bytes)).
* Fragment parsing (`xml()`) uses a small temporary wrapper and adopts child nodes.
* Memory bounded by largest fenced/tail cell encountered (typically the markup column).

---

## Testing hints

* Golden tests: authoring → expanded XML comparisons (whitespace-normalized).
* Property tests for delimiter handling vs tail capture.
* Fuzz tests for `xml()` well-formedness and `json()` edge cases.
* Namespace matrix: in-scope prefixes on header names and inside fragments.

---

## Limitations

* Only one `...` column per table and it must be last.
* Nested fences are not part of v0.1 (reserve for later if desired).
* Heterogeneous child shapes should use multiple tables or plain XML.

---

## License

MIT for the agent implementation. The XTOON surface syntax remains an open format; implementations should document exact behaviors and any deviations.
