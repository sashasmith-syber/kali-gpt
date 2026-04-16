# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

### Private Disclosure (preferred)

This repository has **Private Vulnerability Reporting** enabled.  
Use the **"Report a vulnerability"** button on the [Security tab](../../security/advisories/new) or email:

> security@[your-domain].com  *(replace with your actual contact)*

Please include:
- Description of the vulnerability and affected component
- Steps to reproduce / proof-of-concept (without exploiting live systems)
- Impact assessment (CVSS score if available)
- Any suggested remediation

We will acknowledge receipt within **48 hours** and aim to provide a fix timeline within **7 days** for Critical/High issues.

### Scope

In-scope:
- `backend/` — FastAPI server, authentication, JWT handling
- `desktop-defender/` — Electron app, IPC channels, renderer isolation
- `Net-Reaper-Claude Integration Architecture/` — network agent
- Docker/container configuration
- CI/CD pipeline and supply-chain

Out-of-scope:
- Third-party dependencies (report directly to upstream; we track via Dependabot)
- Social engineering attacks against contributors
- Physical security

## Security Controls

| Control | Status |
|---------|--------|
| Dependabot (daily, all ecosystems) | ✅ Enabled |
| CodeQL SAST (Python + JS/TS) | ✅ Enabled |
| pip-audit (OSV/PyPA) | ✅ CI pipeline |
| npm audit (high+) | ✅ CI pipeline |
| Secret scanning (gitleaks) | ✅ CI pipeline |
| SBOM (CycloneDX) | ✅ Generated on release |
| Branch protection (main) | ⚠️ Configure in repo Settings |
| CODEOWNERS | ⚠️ Add .github/CODEOWNERS |
| Signed commits | ⚠️ Recommended |

## Dependency Update Policy

- **Critical/High CVEs**: patched within 7 days of Dependabot alert
- **Moderate CVEs**: patched within 30 days
- **Low CVEs**: addressed in next scheduled sprint
- **python-jose**: replace with `PyJWT` or `authlib` (tracked in TODO.md)

## Disclosure Policy

We follow **coordinated disclosure**:
1. Researcher reports privately
2. We confirm and investigate (≤ 48 h)
3. We develop and test a fix
4. We release the fix and publish a GitHub Security Advisory (GHSA)
5. Credit given to the researcher (unless they prefer anonymity)

## Hall of Fame

| Researcher | Vulnerability | CVE / GHSA |
|------------|---------------|------------|
| *(none yet)* | — | — |
