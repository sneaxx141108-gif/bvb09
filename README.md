# BVB 09 – inoffizielle Fan-App

Web-App fürs iPhone (in Safari öffnen → Teilen → „Zum Home-Bildschirm“).

**App-Link:** https://sneaxx141108-gif.github.io/bvb09/

## Was die App kann

- **Transfers:** Here-we-go-Karten mit Spielerfoto, beiden Wappen, Ablöse, Boni und Vertrag; Gerüchte mit Wechselwahrscheinlichkeit und Gerüchte-Ampel; Transferbilanz; Vertragsübersicht; Links zu den Transfermarkt-Seiten von Profis, U23 und U19
- **Spiele (Profis):** kommende Spiele mit Countdown, Ergebnisse mit Torschützen, Tabellen (Bundesliga und Champions League), Torschützenliste, Live-Ergebnisse während der Spiele
- **Bundesliga-Konferenz:** alle Spiele des Spieltags live mit Live-Tabelle
- **Saison:** Fieberkurve (Platz nach jedem Spieltag, mit Vorsaison), Saison-Prognose (Meister, Champions League, Abstieg), Liga-Torjäger
- **Spieltag-Zentrale:** KI-Vorbericht mit KI-Tipp, Wetter zum Anpfiff, offizielle Aufstellung, Live-Ticker und Live-Statistik (ESPN), KI-Spielbericht mit Spieler des Spiels, Highlights und Pressekonferenzen, Gegner-Check (Tabelle, Form, direkter Vergleich), Tor-Feier mit Torhorn und Live-Leiste
- **Tippspiel:** Du gegen die KI (3/2/1 Punkte, nur auf dem Handy gespeichert)
- **Kader:** alle Spieler mit Foto, Vertrag, Verletzungen und Sperren; Spielerprofil mit Statistiken je Wettbewerb (Bundesliga, Pokal, Champions League) und Formkurve; Lieblingsspieler; Spielervergleich
- **Mehr:** KI-Update-Zentrale, Einstellungen, Statistiken, Vergleich, Meine Elf, Tippspiel, Rückblick als Story (Monat und Saison), Lazarett, Talente-Radar, Erfolge
- **Home:** persönliche Begrüßung, Storys (verschwinden nach 30 Stunden), Spieltags-Story, „Seit deinem letzten Besuch“, deine Spieler, Stimmungsbarometer (Gemini); Reihenfolge und Blöcke frei einstellbar
- **Design:** Startbildschirm mit Flutlicht, Tageszeit-Design (Morgen, Tag, Abend, Nacht, Spieltag), weiche Seitenwechsel

## So bleibt alles aktuell

`.github/workflows/update.yml` startet `scripts/update.py` 3× täglich (8:17, 14:17 und 20:17 Uhr deutscher Zeit) und an Spieltagen zusätzlich stündlich (`scripts/gate.py`):

| Was | Woher |
|---|---|
| Spiele, Ergebnisse, Torschützen, Tabelle Bundesliga | OpenLigaDB |
| Statistiken der Profis (Spiele, Tore, Vorlagen, Karten, Minuten), Champions-League-Tabelle, offizieller Kader (Rückennummern, Zu- und Abgänge) | ESPN |
| Vor- und Spielberichte, KI-Tipp, Monatsfazit, Stimmungsbarometer | Gemini aus Spieldaten und Google-News-Schlagzeilen |
| Transfer-Storys, Verletzungen, Vertragsverlängerungen, KI-Briefing | Google News (u. a. kicker-, Sky-, Transfermarkt-News), ausgewertet von der kostenlosen **Gemini-KI** – nur vertrauenswürdige Quellen |
| Fieberkurve, Saison-Prognose (4000 Simulationen), Liga-Torjäger, Basis für die Konferenz | berechnet aus OpenLigaDB |
| Wetter zum Anpfiff | Open-Meteo (Stadion über TheSportsDB und OpenStreetMap) |
| Highlights und Pressekonferenzen | YouTube-Kanal des BVB (RSS) |
| Fotos und Wappen für neue Spieler/Vereine | TheSportsDB |

**Transfermarkt** sperrt Server (also auch GitHub) mit einem Bot-Schutz. Positionen, Verträge, Kader und Statistiken von BVB II und U19 sowie die Transferbilanz bis zum letzten Fenster stammen deshalb vom letzten direkten Abruf (`python scripts/update.py` auf einem normalen PC) und werden laufend über die KI-News ergänzt.

Dafür muss unter *Settings → Secrets and variables → Actions* ein Secret namens `GEMINI_API_KEY` eingetragen sein. Ohne Gemini läuft alles weiter, nur die KI-Karten und das KI-Briefing fehlen dann.

Optional springt **Groq** (ebenfalls kostenlos, Schlüssel unter console.groq.com) ein, wenn Gemini überlastet ist. Dafür ein zweites Secret `GROQ_API_KEY` anlegen.

**Update von Hand starten:** *Actions → Daten-Update → Run workflow*

**Falls die Updates mal stoppen:** Unter *Actions* nachsehen, ob der Workflow deaktiviert wurde, und ihn mit „Enable workflow“ wieder einschalten.

---
Inoffizielle Fan-App, nicht mit Borussia Dortmund verbunden. Alle Angaben ohne Gewähr.
