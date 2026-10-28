# Entwicklung – laufende Arbeit

Hier steht, woran gerade gearbeitet wird. Wer am Laptop weitermacht: offene Punkte von oben nach unten abarbeiten,
erledigte abhaken, danach committen und pushen (siehe `CLAUDE.md`).

## Auftrag vom 23.10.2026 (Niklas)

- [x] **U23/U19-Statistiken komplett entfernen** (Spiele, Tore, Vorlagen): aus `docs/data/stats.json` und aus der App
      (Statistik-Seite nur Profis, Kader-Karten/Profile von U23/U19 ohne Zahlen, Talente-Radar nur Profi-Zahlen).
- [x] **Prognosen verbessern** (Niklas: „Wie kann Bayern CL-Favorit sein, wenn PSG zweimal in Folge gewonnen hat,
      Erster ist und 4:2 gegen Barcelona gewann?“). Ursache: PSG & Co. wurden nur aus CL-Spielen bewertet, Bayern
      zusätzlich aus allen Bundesliga-Spielen. Lösung: Tabellen der heimischen Ligen aller CL-Teams (ESPN-Standings,
      aktuelle + Vorsaison) ins Modell; realistischere Unsicherheit (`SIGMA`). Danach Ergebnisse prüfen.
      Recherche erledigt – ESPN-Tabellen (`https://site.api.espn.com/apis/v2/sports/soccer/<liga>/standings`,
      Vorsaison mit `?season=JJJJ`) gibt es für: eng.1, esp.1, ita.1, fra.1, por.1, ned.1, bel.1, tur.1, gre.1,
      sco.1, aut.1, nor.1, den.1, swe.1. Nicht verfügbar: cze.1, ukr.1, svk.1, aze.1, sui.1, srb.1, cro.1, pol.1.
      Plan: je Team eine zusammengefasste Beobachtung „Team gegen Liga-Durchschnitt“ (virtuelles Team `L:<liga>`,
      Tore/Gegentore, Gewicht = Spiele, neutral) in `build_model` (update.py) an `fit_ratings` übergeben.
      Team-Zuordnung über ESPN-Team-IDs (gleich wie in den CL-Spielen).
      **Erledigt (28.10.):** Nur CL-Teams reichte nicht – die Liga-Stärken waren kaum verankert (Belgien vor Italien).
      Jetzt: alle Teams der 14 Ligen gegen `L:<liga>` (laufende Saison voll, Vorsaison `W_LEAGUE_PREV` = 0,25) plus
      alle Europa- und Conference-League-Spiele (laufend voll, Vorsaison `W_PREV`) als Brücke zwischen den Ligen.
      Ergebnis: Ligen England > Spanien > Italien > Frankreich > …; CL-Titel Arsenal 16 %, Barcelona 16 %,
      Bayern 12 % (vorher 23 %), Man City 10 %, Real 9 %, PSG 6 % (PSG ist in der Ligue 1 nur Erster mit 16:9 Toren
      nach 8 Spielen). `SIGMA` bleibt 0,12 – der Favorit liegt jetzt bei realistischen ~16 %.
- [x] **CL-Ring „Nächste Runde“** statt „Viertelfinale“: in der Ligaphase **k. A.**; in den Playoffs Chance aufs
      Achtelfinale, im Achtelfinale aufs Viertelfinale usw. (Halbfinale, Finale, Titel). Nach dem Hinspiel sofort neu
      (die kurzen Läufe nach Spielende rechnen neu). Beispiel: Viertelfinale gegen PSG 10 % → nach 4:0 im Hinspiel ~90 %.
- [x] Testen (alle Seiten ohne Fehler, Prognose-Werte plausibel, K.-o.-Ring mit simuliertem 4:0-Hinspiel geprüft).
- [x] Committen, pushen (28.10.2026, zusammen mit dem Auftrag unten).

## Auftrag vom 28.10.2026 (Niklas, am Laptop)

- [x] **Saison-Prognose überarbeitet** („BVB punktgleich mit Bayern, trotzdem 5 % zu 91 %?“, „PSG hinter Bayern?“):
      Modell nutzt jetzt jedes Spiel aus 12 Ligen von football-data.co.uk (Tore + xG + Wettquoten). Ergebnis bleibt
      ähnlich, weil der Wettmarkt Bayern wirklich viel stärker sieht (Ø 79 % Siegchance in BL-Spielen, BVB 60 %).
      `SIGMA` an Saison 25/26 nachgemessen (Markt-Stärke schwankt nur ~0,07) – nicht erhöht. Dafür erklärt die App jetzt:
      Titelrennen mit „Punkte pro Spiel ab jetzt“, „Was wäre wenn“ fürs nächste BL-Spiel, nächste Spiele mit Chancen,
      komplette Prognose-Tabelle, alle CL-Favoriten, „So rechnet die Prognose“.
- [x] **DFB-Pokal-Prognose** (jede Runde bis zum Pokalsieg) + kurze Läufe auch nach Pokalspielen.
- [x] **Champions League unter „Spiele“:** alle Spiele je Spieltag/Runde (live über ESPN), Tabelle, K.-o.-Runde
      (Hin-/Rückspiel, Gesamtstand, Weiterkommen-Chance; in der Ligaphase „Stand jetzt“ nach Setzliste).
      K.-o.-Ansicht mit den echten Daten von 25/26 getestet.
- [x] **FotMob** (Verletzungen mit Rückkehr, Ø-Noten, Vertragsende, U19-Kader) und **kicker-Newsfeed** für Gemini.
      kicker-Kader/Statistik: gesperrt (403 + robots.txt) – nicht umgangen. BVB II: keine FotMob-Seite gefunden.
- [x] **Meine Elf:** eigene Formation (Reihen eingeben, z. B. 3-2-4-1) + Positionen frei verschieben.
- [x] Committen, pushen. Git ist jetzt auf dem Laptop installiert, das Repository liegt unter `Dokumente\bvb09`.
- Offen zur Entscheidung (Niklas): U19-Statistiken wären mit FotMob jetzt aktuell möglich – bisher bewusst ausgeblendet.

## Danach

- GitHub Pages einschalten (Niklas) und prüfen, dass die Seite online ist.
- Ersatz-KI-Schlüssel (Niklas).
- Zuletzt gemeinsam: Push-Benachrichtigungen über ntfy.
