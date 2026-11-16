---
name: Kali-GPT issue
about: Describe this issue templReport a bug, request an improvement, or troubleshoot
  Kali-GPT and its local security-review workflow.ate's purpose here.
title: ''
labels: ''
assignees: sashasmith-syber

---

## Summary

Describe the problem or proposed improvement clearly and concisely.

## Issue category

- [ ] Bug / regression
- [ ] Feature / enhancement
- [ ] Installation / configuration
- [ ] Documentation
- [ ] Local security-review tooling
- [ ] Other

## Affected component

- [ ] Kali-GPT application
- [ ] AI model / provider integration
- [ ] Agent configuration / resolution
- [ ] PowerShell local-review script
- [ ] Git diff / snapshot / review-bundle generation
- [ ] Security scanners / dependency audits
- [ ] Ollama local review
- [ ] Logging / report output
- [ ] Other: <!-- Specify -->

## Expected behavior or desired outcome

What should happen? For enhancements, explain the use case and desired result.

## Actual behavior

What happened instead? Include the exact error message when applicable.

## Steps to reproduce

1.
2.
3.

Reproduction frequency:
<!-- Always / intermittently / once / not applicable -->

Minimal reproduction or sanitized command:
```text
Paste the smallest relevant example here.
```

## Environment

- Kali-GPT version / commit:
- Branch:
- Operating system / version:
- Execution environment: <!-- Native / WSL / Docker / VM -->
- Python version, if applicable:
- Node.js / npm version, if applicable:
- PowerShell version, if applicable:
- AI provider / model, if applicable:
- Ollama version / model tag, if applicable:
- Relevant scanner names / versions, if applicable:

## Logs and supporting evidence

Include only the relevant, manually reviewed excerpts.

```text
Paste sanitized logs, error messages, or stack traces here.
```

For local-review issues, include whichever items apply:
- Sanitized invocation and enabled options.
- Exit code.
- Relevant sections of summary.md or summary.json.
- Relevant findings.json entries.
- Relevant run.log or scanner stdout/stderr excerpts.
- Whether the issue occurs before, during, or after the Ollama review.

Do not upload a complete review bundle without inspecting its contents.

## Impact

Who or what is affected? Does this block development, review, or normal use?

- Scope:
- Frequency:
- Workaround, if any:

## Proposed solution or acceptance criteria

Optional implementation idea:
<!-- Describe an approach, or leave blank. -->

This issue can be considered resolved when:
- [ ]
- [ ]

## Related context

Link related issues, pull requests, commits, or documentation.

## Submission checklist

- [ ] I searched existing issues for duplicates.
- [ ] I included reproduction steps, or explained why they are not applicable.
- [ ] I removed credentials, tokens, private keys, personal data, and confidential source content.
- [ ] I manually reviewed any attached logs, screenshots, diffs, and reports.
- [ ] This public issue does not disclose a suspected unpatched vulnerability or working exploit.

<!--
SECURITY:
Do not disclose vulnerabilities or exposed credentials in a public issue.
Follow SECURITY.md if present. Otherwise, arrange a private reporting
channel with the repository maintainer before sharing sensitive details.

For security-tool testing, use only systems and repositories you own
or are explicitly authorized to assess.
-->
