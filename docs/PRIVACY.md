# Privacy policy

**Last updated: 27 November 2026**

This policy explains what personal data we collect when you use the PixiFormUI website
(pixiformui.lets.gen.in), join the Pro & Cloud waitlist, or use PixiForm Cloud (cloud.pixiformui.lets.gen.in), why we
collect it, and the choices you have.

PixiFormUI and PixiForm Cloud are run by **Ravindrakumar Suthar** ("we", "us"). Contact:
[ravindra.suthar@me.com](mailto:ravindra.suthar@me.com).

## The short version

- The website uses **no cookies and no trackers**, and the demo and playground send nothing anywhere.
- If you join the waitlist, we keep the details you give us to tell you about paid plans, and nothing else.
- In PixiForm Cloud, **form submissions are end-to-end encrypted**: they're encrypted to a key that only the form
  owner holds, so we can't read them.
- We don't sell personal data, and we don't use it for advertising.
- You can delete your PixiForm Cloud account yourself at any time (Account → Delete account), or ask us to see,
  correct or delete your data.

## 1. The website

**What we collect.** Our hosting provider, Cloudflare, processes the technical data every website receives (your IP
address, browser type and the pages you request) to deliver pages and protect the site from abuse. Cloudflare may
also record basic, cookieless traffic statistics. The website itself sets **no cookies** and stores **nothing** in
your browser.

**Demo and playground.** Forms you fill in on the home page demo and in the playground stay in your browser.
Password fields are encrypted with a key generated in your browser, and nothing is sent to us.

**Describe a form (playground).** If you use the "Describe a form" box, the description you type (and, when you ask
for a change, the form's current configuration) is sent to our server and to Anthropic's Claude API, which designs
the form. We don't store the description; Anthropic processes it under its commercial terms and may keep it for a
limited time for abuse monitoring, but doesn't use it to train models. What you type into the generated form itself
is never sent. To stop overuse, a one-way hash of your IP address is kept with a counter for about two hours. Don't
put personal or confidential information in the description.

**Downloads.** The library is also available from npm, GitHub and jsDelivr. When you download from them, their own
privacy policies apply.

## 2. The Pro & Cloud waitlist

**What we collect.** Your email address and whatever else you choose to tell us: your name, company, website, team
size, the kind of form you need, your expected volume, what you use today, when you need it, which products interest
you, your message, and the page or campaign you came from.

**Why.** To send you a confirmation, to tell you when paid plans and early access open, to answer your questions,
and to decide what to build first. Our basis is your consent, which you give by ticking the box on the form.

**Abuse protection.** To stop automated sign-ups, the form uses an invisible proof-of-work check and a rate limit.
The rate limit keys on a one-way hash of your IP address (salted with a secret), which we keep for about an hour.

**How long.** Until you ask us to remove you, or until the waitlist is no longer needed. Reply "remove" to any of our
emails, or write to us.

## 3. PixiForm Cloud

### Your account

| Data | Why | Kept |
| --- | --- | --- |
| Your email address | To sign you in (by emailing you a link), and to send service emails: sign-in links, "your form is ready", new-submission alerts and limit notices | Until you delete your account |
| A session cookie (`__Host-pfc_session`) | To keep you signed in. Strictly necessary, so it doesn't need consent | Up to 30 days, or until you sign out |
| Sign-in links | One-time links, stored only as a hash | 15 minutes (cleared within a day) |
| Your plan and monthly usage count | To apply your plan's limits | While your account exists |
| API keys | So your own scripts can use the API. Stored only as a hash | Until you revoke them |
| Billing details (when paid plans open) | Stripe processes payments. We keep only your Stripe customer ID and subscription status, and never see your card details | As required for accounting |

### Your forms and their submissions

- **Form settings:** the name, the websites allowed to post, your messages and settings, and your **public** key.
- **Submissions are end-to-end encrypted.** Each submission is sealed to the form owner's public key the moment it
  arrives, and password fields are encrypted in the visitor's browser. Your private key is created in your browser,
  stays there (and in the backup file you download), and **is never sent to us**. We store ciphertext we cannot
  decrypt, plus the time it arrived, its size and the form it belongs to.
- **Retention:** submissions are deleted automatically after 30 days (Free), 90 days (Starter) or 365 days (Pro),
  when you delete them, or when you delete the form.
- **Encrypted files** (Starter and Pro) are encrypted in the visitor's browser to your key, including their names,
  and stored as ciphertext in Cloudflare R2. They are deleted with their submission, with the form, by retention, or
  after two hours if they were never attached to a submission.
- **Translated forms** (optional): if your page asks for it, your form's own texts (labels, help, options, never
  visitors' answers) are translated into each visitor's browser language by Cloudflare Workers AI and cached for 90
  days. The request reveals the visitor's preferred language; their IP is used only as a salted hash for rate limits.
- **Quizzes** (optional): the questions and answer key you write, the candidate names you enter, and each candidate's
  result (score, right or wrong per question, time taken, how often they left the page) are stored readable, so they
  can be scored and shown to you. To score, the chosen option of each multiple-choice question is read; open answers
  and everything else in a quiz submission stay end-to-end encrypted. Candidates' links are stored only as one-way
  hashes. Quiz data is deleted with the form or your account.
- **Ask your inbox** (optional): when you ask a question about submissions, your browser decrypts the submissions you
  have loaded and sends their text (never password fields or files) to Cloudflare Workers AI to answer that one
  question. Neither we nor the feature store the text or the answer, and we don't log them; only a monthly count of
  questions is kept. Only use it for data you're allowed to process this way.
- **Webhooks:** we keep the URLs you add, their signing secrets, and a delivery history for 30 days. Webhook payloads
  contain the submission still encrypted.
- **Visitors' IP addresses** are used only for rate limiting, as a salted one-way hash, kept for about two minutes.

**Your role and ours.** For the data your visitors submit through your forms, **you** decide what to collect and
why: you are the controller, and we process it on your behalf. You are responsible for telling your visitors how you
use their data and for having a lawful basis to collect it. We can provide a data processing agreement on request.

**Losing your key.** Because only you hold the private key, nobody, including us, can recover submissions if you lose
both the copy in your browser and your backup file.

## 4. Service providers

We use these providers to run the services. Each processes personal data only to provide its service to us.

| Provider | What for | Data involved |
| --- | --- | --- |
| Cloudflare, Inc. | Hosting, databases, storage, security, and AI answers (Ask your inbox) | All of the data above, in Cloudflare's global network |
| Resend (Plus Five Five, Inc.) | Sending email | Your email address and the email content |
| Anthropic, PBC | Designing forms from a description (playground) | The description you type and the form's configuration |
| Stripe, Inc. (when paid plans open) | Payments and invoices | Billing name, email, payment details (held by Stripe) |

These providers may process data in countries other than yours, including the United States, under their own
safeguards (such as the EU Standard Contractual Clauses).

## 5. Security

We use HTTPS everywhere, strict browser security policies, hashed tokens and keys, rate limiting and bot protection,
and end-to-end encryption for form submissions. No system is perfectly secure; if a breach affects your personal
data, we'll tell you and the relevant authorities as the law requires.

## 6. Your rights

Depending on where you live (for example under the GDPR, the UK GDPR or India's Digital Personal Data Protection Act),
you can ask to access, correct or delete your personal data, to receive a copy, to object to or restrict how we use
it, and to withdraw consent at any time. Write to [ravindra.suthar@me.com](mailto:ravindra.suthar@me.com) and we'll
answer within 30 days. You can also complain to your local data protection authority.

To delete your PixiForm Cloud account, open **Account → Delete account** in the dashboard and type your email address
to confirm. This immediately deletes your account, forms, submissions, webhooks and their delivery history, API keys,
sessions and usage records, and we email you a confirmation. If you have a paid subscription, cancel it in Billing
first. You can also ask us by email from the address you sign in with. Copies in our providers' backups expire within
30 days. Your private key was never sent to us; delete the backup file yourself if you no longer need it.

## 7. Children

Our services are for businesses and developers and aren't directed at children under 18. We don't knowingly collect
their personal data.

## 8. Changes

If we change this policy, we'll update the date at the top. For significant changes affecting PixiForm Cloud
accounts, we'll also email account holders before the changes take effect.
