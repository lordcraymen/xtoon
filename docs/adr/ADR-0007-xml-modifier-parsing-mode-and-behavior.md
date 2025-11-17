---
title: "ADR-0007: xml() Modifier Parsing Mode and Behavior"
date: "2025-11-17"
status: Accepted
tags:
  - column-modifiers
  - xml-parsing
  - specification
modules:
  - src/
summary: >-
  Defines the xml() modifier as a strict fragment parser with self-contained namespace handling, preservation of all valid XML node types, fail-fast error handling for document-level constructs, and an internal wrapper mechanism that never appears in output.
---

# Context

The `xml()` column modifier (introduced in README) parses cell content as XML and splices the resulting nodes as children of the row's parent element. This is critical for XTOON's core use case: embedding structured markup in tabular data.

However, the exact parsing mode and behavior was underspecified, leading to ambiguities documented in issue #10:

- **Q2.1.1:** Fragment vs document parsing mode?
- **Q2.1.2:** How to handle XML declarations and DOCTYPEs?
- **Q2.1.3:** Whitespace handling rules?
- **Q2.1.4:** CDATA section handling?
- **Q2.1.5:** Multiple root elements allowed?
- **Q2.1.6:** Comments and processing instructions?
- **Q2.1.7:** Internal wrapper mechanism details?
- **Q2.1.8 (implicit):** Namespace context inheritance from XTOON template?

These ambiguities block implementation and testing. We need a clear, robust specification that aligns with XTOON's design philosophy: deterministic, predictable, no magic.

# Decision

The `xml()` modifier performs **strict fragment parsing** with the following characteristics:

## 1. Fragment Parsing Mode

**Decision:** Parse as XML fragment (multiple root elements allowed).

**Rationale:** 
- Enables natural representation of sibling elements: `<FirstName>John</FirstName><LastName>Doe</LastName>`
- Aligns with "splice nodes as children" language in README
- Supports text-element mixing: `Some text <b>bold</b> more text`

## 2. Self-Contained Fragments (No Namespace Inheritance)

**Decision:** Namespace declarations from the XTOON template do NOT propagate into fragment parsing context.

**Example that MUST error:**
```xml
<root xmlns:xt="urn:xtoon" xmlns:s="http://schema.org">
  <xt:table sep=",">
name,xml(content)
Item,"<s:Value>Test</s:Value>"  <!-- ERROR: undeclared prefix 's' -->
  </xt:table>
</root>
```

**Correct version (fragment declares its own namespace):**
```xml
<root xmlns:xt="urn:xtoon">
  <xt:table sep=",">
name,xml(content)
Item,"<s:Value xmlns:s=""http://schema.org"">Test</s:Value>"
  </xt:table>
</root>
```

**Rationale:**
- **Portability:** Fragments can be extracted and validated independently
- **Simplicity:** No hidden dependencies on template context
- **Robustness:** Avoids brittle coupling between data and template namespaces

## 3. Node Type Handling

| Node Type | Behavior | Rationale |
|-----------|----------|-----------|
| Element nodes | ✅ Preserve | Core use case |
| Text nodes | ✅ Preserve (including whitespace-only) | Significant in XML |
| Comments | ✅ Preserve | Valid XML nodes, might be useful (e.g., license comments) |
| Processing instructions | ✅ Preserve | Valid XML nodes (except `<?xml?>` declaration) |
| CDATA sections | ✅ Convert to text nodes | Standard XML parser behavior (normalize to text) |
| Standard entity refs | ✅ Support (`&lt;` `&gt;` `&amp;` `&apos;` `&quot;`) | Standard XML |
| Custom entity refs | ❌ Error | Require DTD (not supported) |

## 4. Strict Error Handling (Fail Fast)

**Decision:** Error immediately on:
- XML declarations (`<?xml version="1.0"?>`)
- DOCTYPEs (`<!DOCTYPE ...>`)
- Malformed XML (unclosed tags, invalid syntax)
- Undeclared namespace prefixes
- Undeclared entity references

**Error format (XTOON-03):**
```
Parse error at row 2, column 2 (content): XML declarations not allowed in fragments
Parse error at row 3, column 2 (content): Unclosed element 'item'
Parse error at row 4, column 2 (content): Undeclared namespace prefix 's'
```

**Rationale:**
- **Data quality:** Forces users to fix problematic input
- **Predictability:** No silent stripping or guessing
- **Security:** Aligns with SEC-04 (XXE prevention)
- **SOLID:** Fail fast principle

## 5. Empty String Handling

**Decision:** Parse empty string as empty fragment (0 child nodes).

**Example:**
```xml
<root xmlns:xt="urn:xtoon">
  <xt:table sep=",">
name,xml(content)
Empty,""
  </xt:table>
</root>
```

**Output:**
```xml
<root>
  <Empty/>
</root>
```

**Rationale:** Consistency - always parse through `xml()` modifier.

## 6. Internal Wrapper Mechanism (Implementation Detail)

**Decision:** Use internal wrapper element with unique namespace for parsing.

**Implementation (conceptual):**
```javascript
// Wrap fragment to enable parsing
const wrapped = `<xtoon-fragment xmlns="urn:xtoon:internal">${cellContent}</xtoon-fragment>`;

// Parse as document
const doc = parseXML(wrapped);

// Extract child nodes ONLY
const children = doc.documentElement.childNodes;

// Splice children into parent element (row element)
parentElement.append(...children);
```

**Contract:**
- Wrapper namespace: `urn:xtoon:internal` (prevents collisions)
- Wrapper element name: `xtoon-fragment` (implementation detail, may change)
- **Wrapper NEVER appears in output XML**
- Only child nodes are extracted and spliced

**Rationale:**
- Enables parsing of fragments with multiple root elements
- Internal namespace prevents collisions with user data
- Pure implementation detail (invisible to users)

# Consequences

## Positive

1. **Clear specification:** All edge cases documented and decided
2. **Robust behavior:** Fail-fast approach ensures data quality
3. **Portable fragments:** Self-contained XML works independently of template
4. **Predictable:** No magic namespace inheritance or silent transformations
5. **Testable:** Each decision maps to specific test cases
6. **Secure:** Aligns with SEC-04 (XXE prevention through strict parsing)

## Negative

1. **Verbosity:** Fragments must declare their own namespaces (can't inherit from template)
   - *Mitigation:* This is actually a feature (portability) rather than a bug
2. **Strict errors:** Users must fix malformed XML (no lenient fallback)
   - *Mitigation:* Clear error messages with row/column info (XTOON-03)
3. **Implementation complexity:** Wrapper mechanism requires careful node extraction
   - *Mitigation:* Well-defined contract and test cases

## Implementation Checklist

- [ ] Implement fragment parser with internal wrapper
- [ ] Error on XML declarations and DOCTYPEs
- [ ] Preserve comments and processing instructions
- [ ] Handle CDATA normalization
- [ ] Test all node types (elements, text, comments, PIs)
- [ ] Test multiple root elements
- [ ] Test namespace error cases (undeclared prefixes)
- [ ] Test empty string handling
- [ ] Verify wrapper never leaks into output
- [ ] Add row/column info to all parse errors (XTOON-03)
- [ ] Security review for XXE prevention (SEC-04)

# References

- Issue #10: [P0] Define xml() modifier parsing mode and behavior
- Edge case analysis: `docs/todo/xml-modifier-edge-cases.md`
- ADR-0006: QName Resolution and Namespace Handling
- README.md: Built-in column modifiers section
- AGENTS.md: XTOON-03 (error reporting), SEC-04 (XXE prevention)
