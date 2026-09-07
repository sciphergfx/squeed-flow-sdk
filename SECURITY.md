# Security Policy

## Reporting A Vulnerability

Do not post exploit details, credentials, private documents, or sensitive logs
in public issues or pull requests.

If GitHub private vulnerability reporting is enabled for this repository,
use https://github.com/sciphergfx/squeed-flow-sdk/security/advisories/new.

If that option is unavailable, open an issue at
https://github.com/sciphergfx/squeed-flow-sdk/issues requesting a private security
contact, without including technical details. Wait for a private reporting
channel before sharing the vulnerability.

In a private report, include:

- Affected SDK and peer dependency versions, browser, and operating system.
- A minimal reproduction using synthetic data.
- Expected and actual behavior, impact, and any required preconditions.
- Suggested mitigation, if known.

Coordinate public disclosure with the maintainer. No response-time or fix-time
guarantee is currently offered.

## Version Scope

Please reproduce against the latest published version where practical and
identify reports that concern unreleased code on `main`. Older versions are
not guaranteed security backports; upgrade guidance or a supported fix will
be discussed during triage.

## Consumer Responsibilities

Keep the SDK and its peer dependencies up to date. The Markdown renderer is
provided by the consuming application. The built-in content view disables raw
HTML parsing and uses the renderer's URL filtering; custom views and callbacks
remain the application's responsibility.

Validate untrusted diagram data and apply appropriate size/depth limits before
rendering it. The diagram component is not a sandbox. Avoid putting secrets
in documents, labels, links, or content that will be delivered to a browser.
