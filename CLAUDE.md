# BVB 09 – Projektwissen für Claude

Diese Datei liest Claude in jeder neuen Sitzung automatisch. Wer hier weitermacht (z. B. am Laptop):
Repository klonen, in Claude Code öffnen, loslegen – alles Wichtige steht unten.

## Was das ist

- Inoffizielle BVB-Fan-App fürs iPhone (PWA), läuft auf GitHub Pages: https://sneaxx141108-gif.github.io/bvb09/
  (unter *Settings → Pages* muss die Quelle **„GitHub Actions“** sein, sonst 404).
- Besitzer: **Niklas** – Fan, kein Entwickler. Antworten auf **Deutsch**, locker, verständlich, ohne Fachchinesisch.
- **Jede Antwort endet mit einer kurzen Erinnerung an die Push-Benachrichtigungen über ntfy** – die richten wir als
  allerletzten Schritt gemeinsam ein.

## Regeln von Niklas (nicht ändern ohne Rückfrage)

- Alles läuft **automatisch und kostenlos auf GitHub Actions**, ohne PC. Im Betrieb wird **kein Claude** genutzt.
  KI = **Gemini** (Secret `GEMINI_API_KEY`), Ersatz-KIs der Reihe nach: Groq, Cerebras, OpenRouter, Mistral
  (`GROQ_API_KEY`, `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`).
- Unbekanntes wird als **„k. A.“** angezeigt – nie raten oder erfinden.
- **Keine Marktwerte** (nur drei Links zu Transfermarkt: Profis, U23, U19).
- **Keine U23-/U19-Spielpläne, -Tabellen oder -Statistiken** (Transfermarkt sperrt GitHub, die Daten würden veralten).
  `stats.json` hat nur `profis`; in der App liefert `statsOf()` für U23/U19 nichts, Kader-Karten zeigen dort den Vertrag.
- CL-Ring **„Nächste Runde“**: in der Ligaphase „k. A.“, danach die Chance, die laufende K.-o.-Runde zu überstehen.
- **Tabellen ohne Zonen-Markierungen** (kein Farbbalken für CL/Relegation/Abstieg).
- Design: dunkles „Flutlicht“-/Glas-Design in BVB-Gelb, Tageszeit-Stimmungen (Morgen/Tag/Abend/Nacht deutlich
  verschieden). **Keine Stadionlicht-Optik** (fand Niklas cringe).
- Prognosen und Wahrscheinlichkeiten rechnet **`scripts/forecast.py` ohne KI** – nach jedem BL- und CL-Spiel neu,
  in der K.-o.-Phase inklusive Hinspiel-Ergebnis.
- Alles mit Saisonbezug setzt sich **jede Saison automatisch zurück** (Bilanz, Prognosen, Tabellen, Tippspiel, Rückblicke).
- Begrüßung mit Namen (Standard „Niklas“, in den Einstellungen änderbar).
- Transfermarkt-Bot-Schutz **nicht umgehen**. **Keine Passwörter, X-Logins oder API-Schlüssel im Chat** –
  Schlüssel trägt Niklas selbst als GitHub-Secret ein.

## Aufbau

| Datei | Zweck |
|---|---|
| `docs/index.html`, `docs/app.js`, `docs/app.css` | die App (eine Seite, Hash-Routen wie `#/spiele/profis/saison`) |
| `docs/sw.js` | Service Worker – bei jeder App-Änderung `SHELL = 'bvb09-shell-vNN'` hochzählen |
| `docs/data/*.json` | Daten, schreibt der Server (nicht von Hand ändern) |
| `scripts/update.py` | Daten-Update. Server-Module: `matches`, `season`, `stats_espn`, `fotmob`, `news`, `matchcenter`; nur vom PC: `squads`, `stats`, `transfers` (Transfermarkt) |
| `scripts/forecast.py` | Prognose-Rechner: Spielstärken (Ergebnisse, xG, Wettquoten), Bundesliga-, CL- und DFB-Pokal-Simulation, KI-Tipp |
| `docs/data/cl.json` | alle CL-Spiele der Saison (Ligaphase mit Spieltag, K.-o. mit Hin-/Rückspiel) + Weiterkommen-Chancen; schreibt `season` |
| `scripts/gate.py` | entscheidet, ob/was ein geplanter Lauf macht |
| `.github/workflows/update.yml` | 3× täglich (8:17/14:17/20:17 Uhr), an BVB-Spieltagen stündlich, nach jedem BL/CL-Spiel ein kurzer Lauf |

### Datenquellen
- OpenLigaDB: Spiele, Bundesliga-Tabelle, Torjäger (frei, CORS offen – die App holt Live-Tore auch direkt).
- ESPN (frei): Ergebnisse aller Wettbewerbe, CL-Tabelle, Profi-Statistiken je Wettbewerb, Kader-Abgleich,
  Live-Ticker/Aufstellung in der App, **Wettquoten (DraftKings)** – nur vor dem Spiel sichtbar, deshalb archiviert
  `update.py` sie in `docs/data/model.json`.
- Google News (RSS) + kicker-Newsfeed (`newsfeed.kicker.de/team/borussia-dortmund`) → Gemini: Transfer-Storys, Here we go,
  Verletzungen/Sperren, Verlängerungen, Briefing, Stimmung, Vor-/Spielberichte. Nur verlässliche Quellen (Stufe 1/2).
  kicker-Kader-/Statistikseiten sperren Server (403) und robots.txt verbietet sie – nicht umgehen.
- FotMob (Seiten erlaubt, nur `/api` gesperrt; Daten aus `__NEXT_DATA__`): Profis – Verletzungen mit Rückkehr-Prognose
  (`fmInjury`), Ø-Note (`fmRating`), Vertragsende (je Lauf 8 Spielerseiten, `fmChecked`), fehlende Grunddaten;
  U19 – Kader abgleichen (neu rein, nach 3 Tagen ohne FotMob-Eintrag raus), **ohne Statistiken**. BVB II: keine FotMob-Seite gefunden.
- football-data.co.uk (12 Ligen inkl. 2. Bundesliga): Ergebnisse, xG und Wettquoten (Marktdurchschnitt, Schlussquoten)
  fürs Prognosemodell; Team-Zuordnung zu ESPN über Namen + Bilanz (`fd_map_teams`).
- Open-Meteo (Wetter), YouTube-RSS des BVB (Highlights/PK), TheSportsDB (Fotos/Wappen).

### Prognose-Modell (`forecast.py`)
- Poisson-Modell (Angriff/Abwehr je Team, Heimvorteil), Dixon-Coles-Korrektur, Zug zur Mitte (`TAU`).
- Daten: jedes Spiel aus 12 Ligen von football-data (Tore mit xG gemischt, Wettquoten doppelt), BL/CL-Ergebnisse von ESPN,
  Vorsaison halb, ESPN-Quoten der CL; Tabellen der Ligen ohne football-data (AUT, NOR, DEN, SWE) und Vorsaison-Tabellen
  als „Team gegen Liga-Durchschnitt“ (`L:<liga>`); alle Europa-/Conference-League-Spiele als Brücke zwischen den Ligen.
- Unsicherheit der Stärken über Szenarien (`SIGMA` = 0,12), 15.000 Simulationen. Nachgemessen (28.10.2026, Saison 25/26,
  11 Ligen): die Markt-Stärke eines Teams schwankt Okt.→Mai nur um ~0,07 je Team – 0,12 ist also eher vorsichtig.
  Nicht künstlich erhöhen, um „schönere“ Zahlen zu bekommen.
- Saison-Tab erklärt die Zahlen: Titelrennen (BVB gegen stärksten Rivalen, Punkte pro Spiel ab jetzt), „Was wäre wenn“
  für das nächste BL-Spiel (`whatIf`), nächste Spiele mit Sieg/Remis/Niederlage, Prognose-Tabelle, CL- und Pokal-Favoriten.
- DFB-Pokal (`dfb_forecast`): Runden aus ESPN-Slugs, ein Spiel je Runde, freie Auslosung, Amateure (dem Modell unbekannt)
  mit Heimrecht, Finale neutral. Nach jedem BL-, CL- und Pokalspiel neu (`nextEnds` → `gate.py`).
- CL nach UEFA-Regeln seit 2024/25: Ligaphase (Tiebreaker), Playoffs 9/10–23/24 usw., Achtelfinale gegen Top 8,
  Turnierbaum, Hin-/Rückspiel (Rückspiel beim Gesetzten), Verlängerung, Elfmeterschießen, Finale neutral.
- KI-Tipp = Ergebnis mit den meisten erwarteten Tipp-Punkten (3 exakt / 2 Tordifferenz / 1 Tendenz).

## Lokal testen

```bash
# Kopie anlegen, dann z. B. nur Spiele + Prognosen + Spieltag-Zentrale rechnen
python scripts/update.py matches season matchcenter
# App ansehen
python -m http.server 8090 --directory docs
```
Ohne `GEMINI_API_KEY` laufen alle Module außer den KI-Texten. Python nur mit Standardbibliothek.

## Arbeitsweise

- Commit-Nachrichten enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Reihenfolge: erst committen, dann `git pull --rebase -X theirs`, dann `git push`
  (der Daten-Bot committet parallel nach `docs/data`).
- Nach App-Änderungen: alle Seiten im Browser durchklicken (keine Fehler, kein seitliches Überlaufen).

## Stand und offene Punkte

- Fertig: Mega-Update (Spieltag-Zentrale, Tippspiel, Konferenz, Saison-Tab mit BL- und CL-Prognose, Lieblingsspieler,
  Einstellungen, Spielervergleich, Ranglisten Tore/Vorlagen/Scorer, 13 Formationen, Design mit Glas, Tageszeit,
  TV-Intro-Startbildschirm, Haptik, Seitenwechsel ohne Überlappung).
- **Offen bei Niklas:** GitHub Pages auf „GitHub Actions“ stellen; Ersatz-KI-Schlüssel anlegen.
- **Offen (zuletzt, gemeinsam):** Push-Benachrichtigungen über ntfy (Tore, Aufstellung, Here we go, Verletzungen).
- Aktuelle Arbeit und Details: siehe `ENTWICKLUNG.md`.
