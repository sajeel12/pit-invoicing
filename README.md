# FBR Digital Invoicing (Iris-fbr)

A small Next.js tool to create, **validate**, and **submit** sales invoices to
Pakistan's FBR Digital Invoicing system via PRAL — fill a form per sale, get back
the official FBR invoice number. Built for low sales volume (no ERP needed).

The Bearer token stays server-side: the browser only ever talks to this app's own
`/api/*` routes, which attach the token and forward to FBR (this also avoids CORS).

## Setup

```bash
npm install
cp .env.local.example .env.local   # then edit .env.local
npm run dev                         # http://localhost:3000
```

`.env.local`:

| var | meaning |
|---|---|
| `FBR_ENV` | `sandbox` (uses `*_sb` endpoints + requires scenarioId) or `production` |
| `FBR_TOKEN` | Bearer token from IRIS/PRAL. Public sandbox token is prefilled in the example. |
| `SELLER_*` | Your seller NTN/name/province/address — prefilled into the form. |

## Onboarding (the IRIS side — done in the browser, once)

1. Log in to **IRIS** → **Digital Invoicing** → **API Integration**.
2. **Proceed with PRAL as Licensed Integrator** (free).
3. Enter technical details + submit **IP whitelisting** (hosting company/country + 1–3 IPs).
4. After PRAL accepts the IPs, open the **Sandbox Environment** tab and copy your
   **sandbox token** into `.env.local`.
5. Run this tool against sandbox and submit the **scenario tests** (`SNxxx`) that apply
   to your Business Activity + Sector. All must return *Valid*.
6. Once scenarios pass, IRIS issues the **Production Token**. Put it in `.env.local`,
   set `FBR_ENV=production`, restart — `scenarioId` is then dropped automatically.

## Using it

- **New invoice**: fill seller/buyer, add one or more items. Sales tax and total are
  auto-suggested from value × rate but stay editable.
- **Validate** first (doesn't issue a number). **Submit to FBR** unlocks only after a
  valid response, so you don't burn invoice numbers on bad data.
- Successful submissions are appended to `data/invoices.json` and shown under **History**.

## API reference

Endpoints, field names, reference APIs, error codes and scenarios come from the PRAL
**"Technical Specification for DI API" v1.12**. See `lib/fbr.ts` (endpoints),
`lib/types.ts` (invoice shape), and `lib/scenarios.ts` (sandbox scenarios).
# pit-invoicing
