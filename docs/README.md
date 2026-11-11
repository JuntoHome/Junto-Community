# Junto Community Alliance website: documentation

The website for **Junto Community Alliance (JCA)** at [juntocommunity.org](https://www.juntocommunity.org). JCA helps small-business owners in the Phoenix area find and use community resources, with the public library at the centre. Every program is free.

The site is one Next.js application with two faces:

- **A public site:** homepage, About, the Business Insights 101 workshop page (`/BI101`), Library Intelligence research notes, a book review, the "Join the Junto" mailing list, and the "Who Can Help?" directory of organization profiles.
- **A private admin area (`/admin`):** a small custom CMS where the JCA team writes, previews, publishes and orders those profiles.

Supabase provides the database, admin logins and file storage. Vercel hosts the site. There is no separate backend service.

The current project is the **Data Axle Translator**: an admin tool that ranks a business contacts spreadsheet entirely in the browser. See [translator/README.md](translator/README.md).

## Major features

| Feature | Status | More |
|---|---|---|
| Public pages, workshop page, mailing list | Built | [FEATURES.md](FEATURES.md) |
| "Who Can Help?" profiles and the admin CMS | Built | [FEATURES.md](FEATURES.md) |
| Admin login, invite, password reset | Built | [AUTHENTICATION.md](AUTHENTICATION.md) |
| Data Axle Translator Phase 1 | In progress (TR-01 to TR-35) | [translator/README.md](translator/README.md), [TASKS.md](TASKS.md) |
| Events, Library Intelligence, Library Profiles, Meeting Space Concierge admin modules | Planned | [FEATURES.md](FEATURES.md#planned) |

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

Read [DEVELOPMENT-SETUP.md](DEVELOPMENT-SETUP.md) before filling in `.env.local`: with the shared Supabase keys, your local site writes to the live database.

## Documentation map

### Understand the project

| Document | Read it for |
|---|---|
| [PROJECT-OVERVIEW.md](PROJECT-OVERVIEW.md) | Purpose, users, roles, the main workflows, how the project got here |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Functional and non-functional requirements, business rules, open decisions |
| [FEATURES.md](FEATURES.md) | What is built, partly built and planned, and how each feature works |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, stack, folder structure, request flows, how to extend it |
| [DATABASE.md](DATABASE.md) | Tables, constraints, access rules, storage |
| [API-DOCUMENTATION.md](API-DOCUMENTATION.md) | The cron endpoint and every Server Action: inputs, outputs, errors |
| [AUTHENTICATION.md](AUTHENTICATION.md) | Admin login, sessions, invite and reset emails, authorization layers |

### Build and ship

| Document | Read it for |
|---|---|
| [DEVELOPMENT-SETUP.md](DEVELOPMENT-SETUP.md) | Installing, configuring and running the project locally |
| [WAY-OF-WORKING.md](WAY-OF-WORKING.md) | Branches, tickets, commits, pull requests, testing, rules |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel, environments, release steps, verification, rollback |
| [guides/CODING-STANDARDS.md](guides/CODING-STANDARDS.md) | Code conventions and patterns to follow |
| [guides/ENVIRONMENT-CONFIGURATION.md](guides/ENVIRONMENT-CONFIGURATION.md) | Every environment variable and dashboard setting |
| [guides/DATABASE-MIGRATIONS.md](guides/DATABASE-MIGRATIONS.md) | Writing and applying schema changes |

### Operate and track

| Document | Read it for |
|---|---|
| [guides/ADMIN-OPERATIONS.md](guides/ADMIN-OPERATIONS.md) | Manual tasks: adding admins, restoring a profile, email templates, subscriber data |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Symptoms, causes and fixes |
| [KNOWN-ISSUES.md](KNOWN-ISSUES.md) | Bugs, limitations, security concerns, technical debt |
| [TASKS.md](TASKS.md) | Ticket status: completed, in progress, pending, blocked |
| [CHANGELOG.md](CHANGELOG.md) | History of significant changes, from git |

## Reading order for a new developer

1. [PROJECT-OVERVIEW.md](PROJECT-OVERVIEW.md)
2. [ARCHITECTURE.md](ARCHITECTURE.md)
3. [DEVELOPMENT-SETUP.md](DEVELOPMENT-SETUP.md), then run the site
4. [WAY-OF-WORKING.md](WAY-OF-WORKING.md) and [guides/CODING-STANDARDS.md](guides/CODING-STANDARDS.md)
5. [../CLAUDE.md](../CLAUDE.md) and [translator/README.md](translator/README.md) if you are working on the Translator
6. [TASKS.md](TASKS.md) to pick up work

## Other documents in this folder

| Path | What it is | Status |
|---|---|---|
| [translator/](translator/) | Translator spec (`.docx`), synthetic test workbooks, field mapping and expected results | Current |
| [JCA_CMS_Plan.md](JCA_CMS_Plan.md) | Requirements, workflows and tickets CMS-01 to CMS-30 for the admin area (Oct 27, 2026) | Source record. Profile fields have since changed; see [REQUIREMENTS.md](REQUIREMENTS.md) |
| [BUILD_SPEC.md](BUILD_SPEC.md) | The original Phase 1 site spec (Sept 2026) | Historical. Predates the admin area and the homepage redesign |
| [design/](design/) | Approved Phase 1 mockups, desktop and mobile | Historical |
| [qr/](qr/) | The `/BI101` QR code printed on flyers | Current |

## Keeping these documents current

Each fact lives in one file. When you change something, update the file that owns it:

| You changed | Update |
|---|---|
| A table, constraint or policy | [DATABASE.md](DATABASE.md) |
| A Server Action or endpoint | [API-DOCUMENTATION.md](API-DOCUMENTATION.md) |
| An environment variable | [guides/ENVIRONMENT-CONFIGURATION.md](guides/ENVIRONMENT-CONFIGURATION.md) and `.env.example` |
| A feature's status | [FEATURES.md](FEATURES.md) and [TASKS.md](TASKS.md) |
| Anything worth recording after a merge | [CHANGELOG.md](CHANGELOG.md) |
| A fixed or newly found problem | [KNOWN-ISSUES.md](KNOWN-ISSUES.md) |

Statements that could not be checked from the repository are marked **Unverified**.
