---
title: "ADR-0001: Automated NPM Releases with Semantic Release"
date: "2025-11-12"
status: "Accepted"
tags:
  - automation
  - npm
  - ci-cd
modules:
  - .github/
summary: >-
  Implement Semantic Release for automated NPM publishing with version management and changelog generation.
---

# ADR-0001: Automated NPM Releases with Semantic Release

## Status

Accepted

## Context

The XTOON Agent project needed an automated way to publish releases to NPM without manual intervention. Manual releases are prone to human error, inconsistent versioning, and require manual changelog maintenance. We wanted to implement a CI/CD pipeline that automatically:

- Determines version bumps based on commit messages
- Generates changelogs automatically  
- Publishes to NPM registry
- Creates GitHub releases
- Tags git commits appropriately

## Decision

We decided to implement **Semantic Release** with the following configuration:

- **@semantic-release/commit-analyzer**: Analyzes commit messages following conventional commits
- **@semantic-release/release-notes-generator**: Generates release notes and changelogs
- **@semantic-release/changelog**: Maintains CHANGELOG.md file
- **@semantic-release/npm**: Publishes to NPM registry with public access
- **@semantic-release/github**: Creates GitHub releases
- **@semantic-release/git**: Commits changelog and version updates back to repository

The pipeline runs on GitHub Actions when code is pushed to the main branch, after all tests pass.

## Consequences

### Positive
- **Fully automated releases**: No manual intervention required for publishing
- **Consistent versioning**: Semantic versioning based on conventional commits
- **Automatic changelog generation**: CHANGELOG.md is maintained automatically
- **Enforced commit standards**: Developers must use conventional commit format
- **Reduced human error**: No manual version bumping or publishing mistakes
- **GitHub integration**: Releases are created with proper release notes

### Negative
- **Dependency on conventional commits**: Team must adopt and follow conventional commit format
- **Learning curve**: Developers need to understand semantic versioning rules
- **NPM token management**: Requires secure handling of NPM automation tokens
- **2FA considerations**: NPM 2FA must be set to "auth-only" for automation tokens

### Implementation Details
- Added Commitizen for interactive conventional commits (`npm run commit`)
- Configured GitHub Actions with NPM_TOKEN secret
- Set up semantic-release configuration in `.releaserc.json`
- NPM 2FA configured as "auth-only" to allow automation token usage
- Package published as `xtoon` with public access

## Alternative Considered

**Manual releases**: Continue with manual `npm publish` commands
- Rejected due to inconsistency and human error potential

**GitHub Releases only**: Use GitHub releases without NPM automation  
- Rejected as NPM is the primary distribution channel for Node.js packages

## Links

- [Semantic Release Documentation](https://semantic-release.gitbook.io/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Actions CI Pipeline](.github/workflows/ci.yml)
- [NPM Package](https://www.npmjs.com/package/xtoon)