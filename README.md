# BVB 09 – inoffizielle Fan-App

Web-App fürs iPhone (in Safari öffnen → Teilen → „Zum Home-Bildschirm“).

**App-Link:** https://sneaxx141108-gif.github.io/bvb09/

## Was die App kann

- **Transfers:** Here-we-go-Karten mit Spielerfoto, beiden Wappen, Ablöse, Boni und Vertrag; Gerüchte mit Wechselwahrscheinlichkeit und Gerüchte-Ampel; Marktwerte von Profis, BVB II und U19 mit Gewinnern und Verlierern; Transferbilanz; Vertragsübersicht
- **Spiele:** kommende Spiele mit Countdown, Ergebnisse mit Torschützen, Tabellen (Bundesliga und Regionalliga West), Torschützenliste, Live-Ergebnisse während der Spiele
- **Kader:** alle Spieler mit Foto, Marktwert, Vertrag, Verletzungen und Sperren; Spielerprofil mit Marktwert-Verlauf und Statistiken
- **Mehr:** KI-Update-Zentrale, Statistiken, Meine Elf, Lazarett, Talente-Radar, Erfolge

## So bleibt alles aktuell

`.github/workflows/update.yml` startet `scripts/update.py` 3× täglich (8:17, 14:17 und 20:17 Uhr deutscher Zeit). Das Programm holt:

| Was | Woher |
|---|---|
| Kader, Marktwerte, Verträge, Verletzungen, Statistiken, Transfers, Gerüchte | Transfermarkt |
| Spiele, Ergebnisse, Tabelle Bundesliga | OpenLigaDB |
| Spiele und Tabelle BVB II | Transfermarkt |
| Transfer- und Verletzungs-News | Google News, ausgewertet von der kostenlosen **Gemini-KI** |

Dafür muss unter *Settings → Secrets and variables → Actions* ein Secret namens `GEMINI_API_KEY` eingetragen sein. Ohne Gemini läuft alles weiter, nur die KI-Karten und das KI-Briefing fehlen dann.

**Update von Hand starten:** *Actions → Daten-Update → Run workflow*

**Falls die Updates mal stoppen:** Unter *Actions* nachsehen, ob der Workflow deaktiviert wurde, und ihn mit „Enable workflow“ wieder einschalten.

---
Inoffizielle Fan-App, nicht mit Borussia Dortmund verbunden. Alle Angaben ohne Gewähr.
