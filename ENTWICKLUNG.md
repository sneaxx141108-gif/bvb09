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
      Recherche erledigt – ESPN-Tabellen (`https://site.api.espn.com/apis/v2/sports/soccer/<liga>/standings`,
      Vorsaison mit `?season=JJJJ`) gibt es für: eng.1, esp.1, ita.1, fra.1, por.1, ned.1, bel.1, tur.1, gre.1,
      sco.1, aut.1, nor.1, den.1, swe.1. Nicht verfügbar: cze.1, ukr.1, svk.1, aze.1, sui.1, srb.1, cro.1, pol.1.
      Plan: je Team eine zusammengefasste Beobachtung „Team gegen Liga-Durchschnitt“ (virtuelles Team `L:<liga>`,
      Tore/Gegentore, Gewicht = Spiele, neutral) in `build_model` (update.py) an `fit_ratings` übergeben.
      Team-Zuordnung über ESPN-Team-IDs (gleich wie in den CL-Spielen).
- [ ] **CL-Ring „Nächste Runde“** statt „Viertelfinale“: in der Ligaphase **k. A.**; in den Playoffs Chance aufs
      Achtelfinale, im Achtelfinale aufs Viertelfinale usw. (Halbfinale, Finale, Titel). Nach dem Hinspiel sofort neu
      (die kurzen Läufe nach Spielende rechnen neu). Beispiel: Viertelfinale gegen PSG 10 % → nach 4:0 im Hinspiel ~90 %.
- [ ] Testen (alle Seiten, Prognose-Werte plausibel), committen, pushen.

## Danach

- GitHub Pages einschalten (Niklas) und prüfen, dass die Seite online ist.
- Ersatz-KI-Schlüssel (Niklas).
- Zuletzt gemeinsam: Push-Benachrichtigungen über ntfy.
