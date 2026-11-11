# Junto Community Alliance website

The website for Junto Community Alliance (JCA) at [juntocommunity.org](https://www.juntocommunity.org). It has two parts: a public site that helps small-business owners in the Phoenix area find free community resources, and a private admin area where the JCA team publishes "Who Can Help?" organization profiles. The Data Axle Translator, a browser-only tool for ranking business contacts, is being built on the `translator` branch.

**Stack:** Next.js 16 (App Router, TypeScript), React 19, Tailwind CSS 4, Supabase, Vercel.

## Documentation

All documentation is in [`docs/`](docs/README.md). Start with [docs/README.md](docs/README.md).

```bash
npm install
cp .env.example .env.local   # fill in values: see docs/DEVELOPMENT-SETUP.md first
npm run dev                  # http://localhost:3000
```

## Before you change anything

- `main` is the live site. Branch from `translator` and open pull requests against it. See [docs/WAY-OF-WORKING.md](docs/WAY-OF-WORKING.md).
- There is one Supabase project. Local and preview environments read and write production data.
- `/BI101` is printed on flyers as a QR code. Never rename or remove that route.
