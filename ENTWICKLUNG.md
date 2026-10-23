# Entwicklung – laufende Arbeit

Hier steht, woran gerade gearbeitet wird. Wer am Laptop weitermacht: offene Punkte von oben nach unten abarbeiten,
erledigte abhaken, danach committen und pushen (siehe `CLAUDE.md`).

## Auftrag vom 23.10.2026 (Niklas)

- [ ] **U23/U19-Statistiken komplett entfernen** (Spiele, Tore, Vorlagen): aus `docs/data/stats.json` und aus der App
      (Statistik-Seite nur Profis, Kader-Karten/Profile von U23/U19 ohne Zahlen, Talente-Radar nur Profi-Zahlen).
- [ ] **Prognosen verbessern** (Niklas: „Wie kann Bayern CL-Favorit sein, wenn PSG zweimal in Folge gewonnen hat,
      Erster ist und 4:2 gegen Barcelona gewann?“). Ursache: PSG & Co. wurden nur aus CL-Spielen bewertet, Bayern
      zusätzlich aus allen Bundesliga-Spielen. Lösung: Tabellen der heimischen Ligen aller CL-Teams (ESPN-Standings,
      aktuelle + Vorsaison) ins Modell; realistischere Unsicherheit (`SIGMA`). Danach Ergebnisse prüfen.
- [ ] **CL-Ring „Nächste Runde“** statt „Viertelfinale“: in der Ligaphase **k. A.**; in den Playoffs Chance aufs
      Achtelfinale, im Achtelfinale aufs Viertelfinale usw. (Halbfinale, Finale, Titel). Nach dem Hinspiel sofort neu
      (die kurzen Läufe nach Spielende rechnen neu). Beispiel: Viertelfinale gegen PSG 10 % → nach 4:0 im Hinspiel ~90 %.
- [ ] Testen (alle Seiten, Prognose-Werte plausibel), committen, pushen.

## Danach

- GitHub Pages einschalten (Niklas) und prüfen, dass die Seite online ist.
- Ersatz-KI-Schlüssel (Niklas).
- Zuletzt gemeinsam: Push-Benachrichtigungen über ntfy.
