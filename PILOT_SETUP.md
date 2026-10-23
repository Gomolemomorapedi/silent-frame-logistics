# Silent Frame Logistics pilot setup

## Current state

The published site is a static preview. It displays illustrative listings and the supplier preview saves only in the visitor's browser. No enquiries are currently delivered. Sample stock, prices, supplier names, and transport profiles are not verified offers.

The files in `supabase/` define a shared, moderated listings and quote enquiry backend. It is not active until the owner creates a Supabase project and provides a public project URL/key plus a real business inbox. Never commit a service-role key. The refreshed public pages describe the target transport marketplace; they do not make bookings, verification, price estimates, checkout, splits, or payouts operational.

The current transporter status controls whether a profile is shown publicly. It is not proof of vehicle ownership/authorised use, insurance, roadworthiness, driver credentials, permits, or job eligibility. The current form does not collect private evidence, and no job-acceptance route exists.

## Pilot launch steps

1. Create a Supabase project in a region suitable for South African users. Keep its database credentials private.
2. Run `supabase/schema.sql` in the project's SQL editor. This enables row-level security and keeps enquiries private.
3. Deploy `supabase/functions/submit-enquiry/index.ts` as an Edge Function. Configure `PILOT_INBOX_EMAIL`, `RESEND_API_KEY`, and a verified `RESEND_FROM_EMAIL` as function secrets. The function stores validated enquiries and forwards them to the configured inbox. Use the service-role key only as a Supabase function secret; never place it in the website.
4. Add the Supabase project URL and anon/public key to `config.js`, which sets `window.SFL_CONFIG`. Add the business's public name and privacy contact email there too. The anon key is public; row-level security is the security boundary. Never put a service-role key in the website.
5. Set Supabase Auth's site URL and allowed redirect URLs to the deployed Pages URL. The current pilot uses email magic-link sign-in. The requested username/password flow is not implemented yet; design it separately from payment settlement, including unique usernames, password reset and server-side role checks.
6. Review new product and transport rows in Supabase before setting their status to `active`. Keep public-profile approval separate from provider eligibility. Before real jobs, add private vehicle-use evidence, applicable safety/insurance/permit checks, an auditable reviewer decision, and backend enforcement. Provider phone numbers are not exposed through public profile reads.
7. Add a CAPTCHA or equivalent abuse control before promoting the enquiry form broadly. The function has only basic per-email throttling and a honeypot; those are not robust spam protection.
8. Test on a fresh phone/browser: browse approved listings, sign in as a supplier, submit a listing, verify it remains pending, submit a buyer enquiry, confirm only the configured inbox receives it, and confirm anonymous visitors cannot read personal details or transporter phone numbers.
9. Replace illustrative inventory and transport profiles with consented information before promoting them. Call a transporter verified only after the defined, job-relevant checks have been completed and recorded.

## Pilot scope

- Shared products after the backend is configured; new listings start pending moderation.
- User accounts through Supabase email sign-in.
- Quote requests stored privately and forwarded to the configured business inbox.
- Public browsing of approved listings.
- Required acceptance of the privacy notice and pilot terms on configured account and enquiry flows.

No transport job requests/offers, automatic matching, confirmed orders, route pricing, tracking, proof of delivery, in-app messaging, reviews, dispute handling, vehicle-document review, card payments, split settlement, or transporter payouts are included. Sellers and transporters must confirm availability, total cost, delivery terms, and responsibilities directly. Review the draft `terms.html` and `privacy.html`, add the correct legal/business identity, decide and publish retention practices, and have the notices reviewed before collecting customer information.

## Next marketplace decisions

See [`MARKETPLACE_READINESS.md`](./MARKETPLACE_READINESS.md) for the recommended verification workflow, explainable route-cost estimate, 15%/85% commission ledger, and payment-provider discovery checklist. Paystack is listed as a discovery lead only; confirm account and payout eligibility before integration.

## Deployment

GitHub Pages publishes the static site from `main`. The database and Edge Function deploy separately in Supabase. A successful Pages build does not mean the backend is configured; test the enquiry journey end to end before launch.
