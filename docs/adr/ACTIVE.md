# Active Architecture Decisions

Generated at 2025-11-17T11:12:32.266Z

| ID | Title | Status | Summary |
| --- | --- | --- | --- |
| ADR-0001 | ADR-0001: Automated NPM Releases with Semantic Release | Accepted | Implement Semantic Release for automated NPM publishing with version management and changelog generation. |
| ADR-0002 | ADR-0002: English as Primary Language for Documentation and Comments | Accepted | Establish English as the mandatory language for all project documentation, comments, and textual content. |
| ADR-0003 | ADR-0003: No CLI Parameter Overrides - Document-Centric Design | Accepted | Establish that XTOON documents are self-describing and portable. All processing parameters must be specified in XML attributes, not CLI flags. CLI is for input/output paths and process control only. |
| ADR-0004 | ADR-0004: RFC 4180 CSV Quoting and Escaping | Accepted | Adopt RFC 4180 as the authoritative CSV quoting and escaping specification for XTOON row parsing, with clarifications for tail capture and error handling. |
| ADR-0005 | ADR-0005: Column Definition Syntax and Formal Grammar | Accepted | Defines the formal EBNF grammar for xt:table column definitions, including attribute/element syntax, modifier arguments, tail capture placement, whitespace handling, and validation rules for duplicate column names. |
| ADR-0006 | ADR-0006: QName Resolution and Namespace Handling | Accepted | Defines when and how XML QNames and namespaces are resolved in XTOON templates, establishing a two-phase approach (parse-time syntax validation, expansion-time URI resolution) and confirming standard XML namespace inheritance rules apply. |
| ADR-0007 | ADR-0007: xml() Modifier Parsing Mode and Behavior | Accepted | Defines the xml() modifier as a strict fragment parser with self-contained namespace handling, preservation of all valid XML node types, fail-fast error handling for document-level constructs, and an internal wrapper mechanism that never appears in output. |
| ADR-0008 | ADR-0008: JSON Modifier Mapping Rules | Accepted | Defines the complete JSON-to-XML conversion rules for the json() modifier, including type mapping, invalid key handling, nested structure support, and security constraints to prevent prototype pollution and resource exhaustion. |
