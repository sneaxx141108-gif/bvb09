#!/usr/bin/env python3
"""Entscheidet, ob ein geplanter Lauf arbeiten soll - und wie viel.

* 3x taeglich um 8:17, 14:17 und 20:17 Uhr deutscher Zeit: alles (GitHub rechnet in UTC,
  deshalb gibt es je zwei Zeiten fuer Sommer- und Winterzeit - nur die passende laeuft).
* An BVB-Spieltagen zusaetzlich stuendlich, von 7 Stunden vor bis 4 Stunden nach dem Anpfiff: alles.
* Nach jedem anderen Bundesliga- oder Champions-League-Spiel (bis gut 2 Stunden nach Spielende):
  nur Spiele, Prognosen, Statistiken und Spieltag-Zentrale - so aendern sich die Wahrscheinlichkeiten nach jedem Spiel.
Ausgabe fuer GitHub Actions: run=true|false und modules=... (leer = alles)
"""
import json
import sys
from datetime import datetime, timedelta, timezone

LIGHT = 'matches season stats_espn matchcenter'


def berlin_offset(now):
    def last_sunday(year, month):
        d = datetime(year, month + 1, 1, tzinfo=timezone.utc) - timedelta(days=1)
        return d - timedelta(days=(d.weekday() + 1) % 7)
    start = last_sunday(now.year, 3).replace(hour=1)
    end = last_sunday(now.year, 10).replace(hour=1)
    return 2 if start <= now < end else 1


def parse(s):
    try:
        t = datetime.fromisoformat((s or '').replace('Z', '+00:00'))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=timezone.utc)


def matchday(now, path='docs/data/matches.json'):
    try:
        with open(path, encoding='utf-8') as f:
            matches = json.load(f).get('profis') or []
    except (OSError, ValueError):
        return False
    for m in matches:
        ko = parse(m.get('date'))
        if ko and ko - timedelta(hours=7) <= now <= ko + timedelta(hours=4):
            return True
    return False


def match_ended(now, path='docs/data/season.json'):
    """Ist in den letzten gut 2 Stunden ein Bundesliga- oder CL-Spiel zu Ende gegangen?"""
    try:
        with open(path, encoding='utf-8') as f:
            ends = json.load(f).get('nextEnds') or []
    except (OSError, ValueError):
        return False
    for s in ends:
        t = parse(s)
        if t and t <= now <= t + timedelta(minutes=130):
            return True
    return False


def should_run(event, schedule, now):
    """-> (laufen?, Module) - Module leer = alles."""
    if event != 'schedule':
        return True, ''
    parts = schedule.split()
    if len(parts) < 2:
        return False, ''
    if parts[1] == '*':
        if matchday(now):
            return True, ''
        if match_ended(now):
            return True, LIGHT
        return False, ''
    return (int(parts[1]) + berlin_offset(now)) % 24 in (8, 14, 20), ''


if __name__ == '__main__':
    ev = sys.argv[1] if len(sys.argv) > 1 else ''
    sched = sys.argv[2] if len(sys.argv) > 2 else ''
    now = datetime.now(timezone.utc)
    run, modules = should_run(ev, sched, now)
    sys.stderr.write('Ereignis %s, Zeitplan "%s" -> %s\n' % (ev, sched, ('Lauf (%s)' % (modules or 'alles')) if run else 'kein Lauf'))
    print('run=%s' % ('true' if run else 'false'))
    print('modules=%s' % modules)
