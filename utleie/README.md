# Utleie (Isaks nettside)

Utleiesiden fra `index - nettside isak.html`, gjort om til en ekte nettside:
alle data (utstyr, ordre, kunder, ansatte, innstillinger) ligger i Supabase,
innlogging går gjennom Supabase Auth, og siden publiseres på Vercel.

Dette er et eget prosjekt med eget repo, eget Supabase-prosjekt og eget Vercel-prosjekt.

## Hva som ligger her

| Fil | Hva den gjør |
| --- | --- |
| `index.html` | Selve siden (samme utseende og funksjoner som før) |
| `backend.js` | Laster og lagrer data i Supabase, innlogging og sanntid |
| `api/config.js` | Gir nettleseren Supabase-adressen og den offentlige nøkkelen |
| `api/admin-user.js` | Oppretter ansatte og bedriftsansatte med passord, og midlertidige passord |
| `supabase/schema.sql` | Tabell og tilgangsregler. Kjøres én gang i Supabase |
| `supabase/forste-admin.sql` | Gjør den første personen til administrator |
| `vendor/supabase.js` | Supabase-biblioteket for nettleseren |

## Oppsett (ca. 15 minutter)

1. **Supabase:** Lag et nytt prosjekt på supabase.com. Åpne **SQL Editor**, lim inn hele
   `supabase/schema.sql` og trykk **Run**.
2. **Vercel:** **Add New → Project**, velg repoet `nettside-isak-` og sett **Framework Preset**
   til **Other**. Trykk **Deploy**.
3. **Koble sammen:** I Vercel-prosjektet, gå til **Settings → Environment Variables** og legg inn
   - `SUPABASE_URL` (Supabase → Project Settings → API → Project URL)
   - `SUPABASE_ANON_KEY` (anon / publishable key)
   - `SUPABASE_SERVICE_ROLE_KEY` (service_role / secret key, holdes hemmelig)

   Supabase-integrasjonen i Vercel legger inn disse automatisk, og de navnene fungerer også.
   Ta en ny **Redeploy** etterpå.
4. **E-postlenker:** I Supabase → **Authentication → URL Configuration**, sett **Site URL** til
   Vercel-adressen (f.eks. `https://utleie-isak.vercel.app`) og legg den til under **Redirect URLs**.
5. **Første administrator:** Supabase → **Authentication → Users → Add user** med Isaks e-post og
   passord (huk av «Auto Confirm User»). Kjør så `supabase/forste-admin.sql` med samme e-post.
   Logg inn på siden, og legg til flere ansatte under **Brukere**.

## Hvem ser hva

- **Alle besøkende** ser produktkatalogen, nettsideinnstillingene, når utstyr er opptatt
  (uten kundenavn) og navn, bilde og offentlig kontaktinfo for aktive ansatte.
- **Kunder** ser sin egen kundeprofil og sine egne forespørsler. En bedriftseier ser også
  bedriftens ansatte og forespørslene deres. Kunder kan bare sende forespørsler (status
  «Forespørsel») og endre navn, telefon og adresse. Rabatter, status og faktura kan de ikke endre.
- **Ansatte** ser og endrer alt. Bare **administratorer** kan endre listen over ansatte.

Reglene håndheves i databasen (`schema.sql`), ikke bare i siden.

## Forskjeller fra filversjonen

- Demo-dataene og demo-innloggingene (`demo123`) er fjernet. Siden starter tom.
- Nye kunder får en e-post for å bekrefte adressen før de kan logge inn.
- «Glemt passord?» på innloggingen sender en lenke for å lage nytt passord.
- Grafen «Utleieaktivitet» viser nå ekte tall fra ordrene i stedet for faste eksempeltall.
- Bare handlekurv-utkastet lagres fortsatt i nettleseren.
- Flere ansatte kan jobbe samtidig: endringer fra andre dukker opp uten å laste siden på nytt.
- Rabatt på en kundeforespørsel regnes ut i nettleseren. Sjekk prisen når dere godkjenner
  forespørselen, slik dere gjør i dag.

## Teste lokalt

```bash
npm install
npx vercel dev   # trenger miljøvariablene over i .env.local
```
