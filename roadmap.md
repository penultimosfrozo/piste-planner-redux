# Piste Planner — Roadmap

## Completed
- Copia progetto da GitHub (file sorgente, dipendenze, dati, migrazioni)
- Aggiunte dipendenze mancanti (`@supabase/supabase-js`, `@lovable.dev/cloud-auth-js`)
- Lovable Cloud abilitato + migrazione tabelle itineraries/resort_cache applicata
- Login Google configurato (provider abilitato)
- Google Maps connector collegato (gateway, credenziali gestite da Lovable)
- Build TypeScript pulita, dev server sano, preview verificata

## Note
- Progetto originale: https://github.com/temstorm789-lang/piste-planner-plus.git
- App PeakFinder: confronto stazioni sciistiche (tempo pista, code, viaggio, costo)

## Refactor PeakFinder
- Rebranding completo, rimosso badge "new" su Crea itinerario
- Profilo reale su database (livello, comprensori visitati, onboarding)
- Onboarding obbligatorio in 2 passaggi al primo accesso
- Skeleton loader per notizie, meteo, webcam, hotel/noleggi, efficienza
- Mappa Google in /esplora con skeleton, impianti 10 + mostra resto/meno
