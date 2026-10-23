# BVB 09 – inoffizielle Fan-App

Web-App fürs iPhone (in Safari öffnen → Teilen → „Zum Home-Bildschirm“).

**App-Link:** https://sneaxx141108-gif.github.io/bvb09/

## Was die App kann

- **Transfers:** Here-we-go-Karten mit Spielerfoto, beiden Wappen, Ablöse, Boni und Vertrag; Gerüchte mit Wechselwahrscheinlichkeit und Gerüchte-Ampel; Transferbilanz; Vertragsübersicht; Links zu den Transfermarkt-Seiten von Profis, U23 und U19
- **Spiele (Profis):** kommende Spiele mit Countdown, Ergebnisse mit Torschützen, Tabellen (Bundesliga und Champions League), Torschützenliste, Live-Ergebnisse während der Spiele
- **Kader:** alle Spieler mit Foto, Vertrag, Verletzungen und Sperren; Spielerprofil mit Statistiken
- **Mehr:** KI-Update-Zentrale, Statistiken, Meine Elf, Lazarett, Talente-Radar, Erfolge

## So bleibt alles aktuell

`.github/workflows/update.yml` startet `scripts/update.py` 3× täglich (8:17, 14:17 und 20:17 Uhr deutscher Zeit):

| Was | Woher |
|---|---|
| Spiele, Ergebnisse, Torschützen, Tabelle Bundesliga | OpenLigaDB |
| Statistiken der Profis (Spiele, Tore, Vorlagen, Karten, Minuten), Champions-League-Tabelle, offizieller Kader (Rückennummern, Zu- und Abgänge) | ESPN |
| Transfer-Storys, Verletzungen, Vertragsverlängerungen, KI-Briefing | Google News (u. a. kicker-, Sky-, Transfermarkt-News), ausgewertet von der kostenlosen **Gemini-KI** – nur vertrauenswürdige Quellen |
| Fotos und Wappen für neue Spieler/Vereine | TheSportsDB |

**Transfermarkt** sperrt Server (also auch GitHub) mit einem Bot-Schutz. Positionen, Verträge, Kader und Statistiken von BVB II und U19 sowie die Transferbilanz bis zum letzten Fenster stammen deshalb vom letzten direkten Abruf (`python scripts/update.py` auf einem normalen PC) und werden laufend über die KI-News ergänzt.

Dafür muss unter *Settings → Secrets and variables → Actions* ein Secret namens `GEMINI_API_KEY` eingetragen sein. Ohne Gemini läuft alles weiter, nur die KI-Karten und das KI-Briefing fehlen dann.

**Update von Hand starten:** *Actions → Daten-Update → Run workflow*

**Falls die Updates mal stoppen:** Unter *Actions* nachsehen, ob der Workflow deaktiviert wurde, und ihn mit „Enable workflow“ wieder einschalten.

---
Inoffizielle Fan-App, nicht mit Borussia Dortmund verbunden. Alle Angaben ohne Gewähr.
