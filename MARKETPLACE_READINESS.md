# Logistics marketplace readiness and recommendations

## Current repository baseline

The GitHub Pages site and optional Supabase pilot are a useful starting point, but they are not yet a transport booking marketplace.

The current Supabase schema supports profiles, supplier products, transporter profile listings, and private enquiries. The current transporter form captures business name, vehicle type, payload, phone, and service area. It does not collect vehicle-use evidence, insurance details, permit information, or verification review history. A profile marked active is therefore a listing approval, not proof of safety or legal eligibility.

There are no live transport job records, offers, route calculations, configurable fare rules, booking status transitions, commission ledger, card checkout, split settlement, refund workflow, or transporter payout records. The pilot uses email magic-link sign-in; username/password sign-in is a separate authentication change. None of these gaps should be concealed by labels or success messages.

## 1. Provider and vehicle verification

Treat verification as a set of checks with clear scope, owner, date, expiry, and outcome. Ownership is one check, not a safety certificate.

Before a provider can accept a real job, the backend should verify:

1. The person's or business's identity and account status.
2. Ownership or authorised commercial use of each registered vehicle. Accept appropriate registration/ownership records, lease or rental agreements, or written owner permission.
3. Vehicle information, including registration, body type, actual payload and usable dimensions.
4. Insurance and roadworthiness evidence relevant to the vehicle and work.
5. Driver and operating credentials, permits, and route/load restrictions where the job requires them.

Use statuses such as not submitted, pending review, more information needed, approved, rejected, suspended, and expired. Record the reviewer and timestamp. Job acceptance must check the account, the specific vehicle, the job's load and route requirements, availability, and current documents on the server. A disabled button by itself is not access control.

Store sensitive evidence in a private bucket with row-level access, short-lived signed download links, restricted reviewer access, and a retention/deletion schedule. Do not put document URLs or identity details in public transporter reads. Add a provider appeal or correction path and clear reasons for a rejection.

## 2. Useful, explainable price guidance

Do not publish a flat route amount until the inputs and operating rates are real. For the first version, use administrator-configurable, explainable rules; show the recommendation only to eligible transporters and label it an estimate.

A starting model to validate with local operators:

`suggested fare = dispatch minimum + (loaded km + reposition km + agreed return km) × vehicle rate/km + booked days × day rate + operating hours × time rate + load/handling/waiting/stops/tolls/other configured costs`

Avoid counting the same trip leg in both kilometre and time charges without an explicit reason. Use road-route distance, not straight-line distance. Capture vehicle category, payload and dimensions, load type, multi-day duration, additional stops, waiting/loading needs, operating hours, and return-travel assumptions. Show the transporter the assumptions and estimated 15% commission / 85% share before they submit an offer.

The customer should see the transporter's actual offer, not the internal recommendation. Keep the recommendation advisory; calibrate it later from consented, reliable route costs and completed-job outcomes. Do not claim market-wide pricing data when none is available.

## 3. Payment model and 15% commission

Keep authentication and money movement separate. Supabase Auth controls who can use the application. A payment provider controls card authorisation, settlement, refunds, disputes, and transfers.

The intended split is 15% to Silent Frame Logistics and 85% to the transporter on the agreed transport fare. For a R1,000 fare, that is R150 and R850 before payment fees, refunds, disputes, taxes, and other contractually agreed adjustments. Before checkout, decide and publish:

- Whether the 15% is calculated on the gross agreed fare and how cancelled or partially refunded jobs reverse it.
- Which party bears payment processing fees and chargeback costs.
- What completion evidence and dispute window release a transporter payout.
- How failed, delayed, reversed, and duplicate provider notifications reconcile to the ledger.
- Whether a provider can split settlement to transporter accounts or whether a separate payout product is needed.

**Provider discovery lead, not a selection:** Paystack's official docs describe subaccounts and percentage/flat transaction splits, configurable fee-bearer options, refunds, and signed webhooks. The docs reviewed do not establish that Silent Frame's account is eligible for the exact South African marketplace model, or that a split can be held until a delivery is completed. Ask Paystack for written confirmation on independent transporter onboarding, South African settlement, payout timing/holds, fee bearer, refunds after split, disputes/chargebacks, and any compliance requirements before building checkout. Compare another provider only if those answers fail the business requirements.

- [Paystack split payments](https://paystack.com/docs/payments/split-payments/)
- [Paystack webhook verification](https://paystack.com/docs/payments/webhooks/)
- [Paystack refunds](https://paystack.com/docs/payments/refunds/)
- [Paystack manual payouts](https://support.paystack.com/en/articles/2131074)

Use a server-side payment ledger with unique provider references and idempotent webhook processing. Never mark an order paid from a browser redirect alone. Never store card numbers or security codes. Show the customer the agreed fare and cancellation terms before hosted checkout. Keep payment received, refund status, commission earned, and transporter payout as separate records and statuses.

## Recommended implementation order

1. Confirm identity and username/password requirements, while keeping the payment-provider decision independent.
2. Add private vehicle-evidence storage, scoped checks, reviewer audit history, and backend job eligibility.
3. Add customer transport requests with collection/delivery, load, vehicle, route, duration, and availability fields.
4. Add atomic job matching and transporter offers, preventing duplicate acceptance.
5. Add route estimates and configurable price guidance with visible assumptions for providers.
6. Confirm the settlement, fee, refund and dispute model with a provider.
7. Only then build hosted card checkout, webhook reconciliation, the commission ledger and payout workflow.
8. Test the customer, transporter, admin, mobile, accessibility, refund, duplicate-event, and recovery paths before calling the service operational.

The public site should continue to say that live bookings, verification, pricing, and payments are being prepared until the corresponding backend work is deployed and exercised end to end.
