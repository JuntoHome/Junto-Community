# AI privacy note: Data Axle Translator

Status: draft for review. Reviewed by: ______ Date: ______

## What the tool does with your file

Your file is read, ranked and exported in your web browser, by ordinary code with no AI. The file never leaves your computer.

## When you chat with the AI

We send a short summary: the number of businesses, the cities, states, industries and job titles with a count for each, the range of company sizes and how many have one, the file's layout, and whether a list was cut short. **No business names, people's names, phone numbers, emails, websites, addresses, ZIP codes or record IDs from your file are sent.** Values that look like emails, phone numbers or websites are left out.

We also send what you type, as typed, the AI's replies and your criteria once there are some: don't type personal details you don't want sent.

## When you draft an intro

For the one business you choose: its company name, industry, city, state, contact name and contact title, whether you want customers or partners, or employers, and your note if you write one. Nothing else from any row. Emails, phone numbers and websites in the draft become "[contact details]". You copy it; the tool never sends emails.

## Where it goes

Through JCA's own server to the AI provider, OpenAI. Only signed-in JCA admins can use it; JCA's key for OpenAI never reaches your browser.

## What JCA keeps

Nothing: no database, nothing saved in your browser, no record of what was sent; errors are recorded as a short code, never content. Start over or closing the page clears everything. Your Excel download holds your intro drafts and, if you used the AI's criteria, your first request (up to 300 characters).

## The AI provider

OpenAI handles what it receives under its own terms; each request asks it not to store the response. **Open item:** before real (non-synthetic) records are used, review OpenAI's terms on how it uses and keeps what is sent, and record the decision here.

## Today's limits

Only JCA's two synthetic demo files can be loaded; real exports wait until the open items are closed.

## Open items

- OpenAI: data use and retention terms (above); approval as a paid service (**Unverified**).
- Sending contact names, acceptable only while the data is synthetic.
- What JCA's hosting service records about each request (**Unverified**).
- Other languages, such as Spanish (written and tested in English only).

## For developers

The tests behind each promise: [Promise to test](README.md#promise-to-test) in the Translator developer guide.
