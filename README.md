# Lagerstyring

Nettside for lagerbeholdning, plassering og utlån av eventutstyr. Fungerer på mobil, så man kan søke opp en vare og kvittere ut utlån rett ved reolen.

**Funksjoner**
- Varer med bilde, kategori, beskrivelse, antall og plassering (sone, reol, hylle)
- Søk og filtrering på kategori
- Utlån av deler av beholdningen (f.eks. 10 av 150 stoler) med låntaker, firma, telefon, periode og beskrivelse. Hvem som lånte ut lagres automatisk.
- Delvis retur, oversikt over hva som er ute, forsinkede utlån og historikk
- Ledig antall regnes ut automatisk, og systemet stopper utlån av flere enn det som er ledig
- To roller: **admin** (legger inn og endrer varer og brukere) og **ansatt** (søker, låner ut og registrerer retur)

Teknologi: Next.js på Vercel, Supabase for database, innlogging og bilder. Begge har gratisnivå.

## Oppsett (ca. 15 minutter)

### 1. Supabase
1. Lag en gratis konto på [supabase.com](https://supabase.com) og et nytt prosjekt (velg region *West EU / Frankfurt* eller *Stockholm*).
2. Gå til **SQL Editor → New query**, lim inn hele innholdet i [`supabase/schema.sql`](supabase/schema.sql) og trykk **Run**.
3. Gå til **Authentication → Sign In / Providers** og slå **av** «Allow new users to sign up», så bare de du legger inn får tilgang.
4. Gå til **Authentication → Users → Add user → Create new user**, og lag din egen bruker (huk av «Auto Confirm User»).
5. Gjør deg selv til admin: i **SQL Editor**, kjør
   ```sql
   update profiles set role = 'admin' where id = (select id from auth.users where email = 'din@epost.no');
   ```
6. Gå til **Project Settings → API** og noter **Project URL** og **anon public key**.

### 2. Vercel
1. Lag en gratis konto på [vercel.com](https://vercel.com) med GitHub-innlogging.
2. **Add New → Project**, velg repoet `Lagerstyring`.
3. Under **Environment Variables**, legg inn:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL fra Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key fra Supabase
4. Trykk **Deploy**. Etter et minutt får du en adresse, f.eks. `lagerstyring.vercel.app`.

### 3. Legge til ansatte
Legg dem inn i Supabase under **Authentication → Users → Add user**. De får rollen *ansatt*. Under **Brukere** i appen kan du endre navn og gjøre noen til admin.

## Kjøre lokalt
```bash
cp .env.example .env.local   # fyll inn verdiene fra Supabase
npm install
npm run dev
```

## Tips til oppstart på lageret
- Bestem et fast system for plassering før dere begynner, f.eks. sone = område i hallen (A–F), reol = nummer, hylle = nivå fra gulvet (1 nederst).
- Ta bilde med mobilen rett i skjemaet når varen legges inn. Bildet krympes automatisk før opplasting.
- Lag én vare per variant som skal skilles fra hverandre (f.eks. «Klappstol hvit» og «Klappstol sort»).
