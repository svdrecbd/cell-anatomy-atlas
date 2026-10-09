# Security reporting

Report suspected credential exposure, unauthorized access, or vulnerabilities privately to svdrecbd@gmail.com. Include the affected path and reproducible steps, excluding other people's personal data. Do not publish live credentials or subscriber records in an issue.

Production account credentials and D1 exports must never be committed. The public repository contains application code and public corpus metadata. Use a separate Cloudflare account configuration for deployment and keep local databases, logs, and exports ignored.

## Request protections

Signup submissions require JSON and reject foreign browser origins. Bodies are limited to 8 KiB, including streamed bodies. Atomic D1 counters enforce three submissions per email and 120 submissions overall per UTC minute. Cloudflare's permissive rate-limit bindings provide an additional allowance of thirty submissions per network address and three per email per minute, per Cloudflare location. The larger network allowance accommodates shared institutional networks. Fixed-minute windows allow a new allowance when the minute changes; Cloudflare's additional counters are eventually consistent.

The limiter receives SHA-256 identifiers. Raw email and network addresses are not written to application storage or application logs by the limiter. D1 stores only an email digest, minute window, and submission count, alongside an overall counter. Expired windows are purged during submissions and by a five-minute cleanup schedule; under normal operation counters remain for less than eight minutes. No browsing history is stored by these controls. Subscriber information remains in the private D1 database. Missing or unavailable protection bindings return a temporary signup error rather than accepting an unprotected submission.

Environment, version-control, credential, and development-server paths are rejected before application handling. Public corpus downloads and study pages remain readable. CI has read-only repository permissions and does not persist checkout credentials.

## Account access and recovery

Protect Cloudflare, GitHub, and any federated sign-in provider with an authenticator or passkey. Keep recovery codes in an owner-controlled password manager. Use account-scoped deployment tokens with only required permissions; never install administrative credentials in the Worker or commit them to this repository.

D1 Time Travel supplies point-in-time recovery. Keep a separate database export outside the repository, restrict its directory to mode 0700 and its files to mode 0600, and store it on an encrypted disk. Validate an export by restoring into a local SQLite database and running `PRAGMA integrity_check`. Do not test restoration against production. A local export is not an off-site backup; move an encrypted copy to a separately protected backup location when one has been selected.
