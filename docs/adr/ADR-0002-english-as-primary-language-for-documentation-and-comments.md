---
title: "ADR-0002: English as Primary Language for Documentation and Comments"
date: "2025-11-12"
status: "Accepted"
tags:
  - documentation
  - internationalization
  - standards
modules:
  - docs/
  - src/
summary: >-
  Establish English as the mandatory language for all project documentation, comments, and textual content.
---

# ADR-0002: English as Primary Language for Documentation and Comments

## Status

Accepted

## Context

The XTOON Agent is an open-source project intended for international use by software development teams working with XML and tabular data notation. Consistent language usage in documentation, comments, commit messages, and ADRs is crucial for:

- **Developer Experience (DX)**: International contributors and users expect English documentation
- **Maintainability**: Mixed languages in documentation create cognitive overhead for contributors
- **Professional Standards**: English is the de facto standard for international software projects
- **Collaboration**: Teams from different countries can collaborate more effectively
- **Knowledge Transfer**: Documentation remains accessible to future team members regardless of their native language

The project currently has mixed language usage:
- Source code comments: English ✅
- README and main documentation: English ✅
- Architecture Decision Records: English ✅
- Feature files and test descriptions: English ✅

## Decision

We decide to establish **English as the mandatory language** for all project documentation, comments, and textual content, with the following guidelines:

### Scope of English-Only Policy

**Required in English:**
- All source code comments and documentation strings
- README files and technical documentation
- Architecture Decision Records (ADRs)
- Pull request templates and GitHub issue templates
- Commit messages (following conventional commits in English)
- API documentation and user-facing help text
- Error messages and user-facing output
- Test descriptions and BDD feature files
- Configuration files with comments

**Exceptions (where native language may be acceptable):**
- Internal team discussions in GitHub issues/PRs (if all team members share the language)
- Local deployment guides specific to regional teams
- User-facing content for localized markets (when explicitly required)

### Implementation Guidelines

1. **New Content**: All new documentation must be written in English
2. **Existing Content**: Gradually translate existing non-English content during regular maintenance
3. **Code Reviews**: Language consistency should be part of the review process
4. **Templates**: All templates and scaffolding must use English
5. **Commit Messages**: Use English with conventional commit format

## Consequences

### Positive
- **Improved International Accessibility**: Global developer community can contribute and use the toolkit
- **Consistent Developer Experience**: Uniform language reduces cognitive load
- **Professional Standards**: Aligns with industry best practices for open-source projects
- **Better Collaboration**: Enables seamless collaboration across international teams
- **Future-Proof**: Reduces technical debt from mixed-language documentation
- **SEO and Discoverability**: English documentation is more discoverable globally

### Negative
- **Translation Effort**: Existing German content needs to be translated
- **Learning Curve**: Native German speakers may need to write documentation in their second language
- **Initial Time Investment**: Requires updating existing documentation

### Implementation Plan
1. **Phase 1**: Ensure all documentation follows English-only policy
2. **Phase 2**: Update development guidelines and templates (AGENTS.md, ADR templates)
3. **Phase 3**: Establish language checks in CI/CD process
4. **Phase 4**: Create contribution guidelines emphasizing English-only policy

## Alternative Considered

**Multilingual Documentation**: Maintain both German and English versions
- Rejected due to maintenance overhead and potential for inconsistency
- Would require dual maintenance of all documentation
- Could lead to version drift between languages

**German as Primary Language**: Continue with German for internal documentation
- Rejected as it limits international adoption and contribution
- Contradicts open-source best practices
- Creates barriers for non-German-speaking contributors

## Links

- [Microsoft Writing Style Guide](https://docs.microsoft.com/en-us/style-guide/)
- [Google Developer Documentation Style Guide](https://developers.google.com/style)
- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Open Source Guide - Building Welcoming Communities](https://opensource.guide/building-community/)