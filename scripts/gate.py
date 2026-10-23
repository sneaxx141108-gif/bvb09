#!/usr/bin/env python3
"""Entscheidet, ob ein geplanter Lauf arbeiten soll.

* 3x taeglich um 8:17, 14:17 und 20:17 Uhr deutscher Zeit (GitHub rechnet in UTC,
  deshalb gibt es je zwei Zeiten fuer Sommer- und Winterzeit - nur die passende laeuft).
* An Spieltagen zusaetzlich stuendlich, von 7 Stunden vor bis 4 Stunden nach dem Anpfiff.
Ausgabe fuer GitHub Actions: run=true oder run=false
"""
import json
import sys
from datetime import datetime, timedelta, timezone


def berlin_offset(now):
    def last_sunday(year, month):
        d = datetime(year, month + 1, 1, tzinfo=timezone.utc) - timedelta(days=1)
        return d - timedelta(days=(d.weekday() + 1) % 7)
    start = last_sunday(now.year, 3).replace(hour=1)
    end = last_sunday(now.year, 10).replace(hour=1)
    return 2 if start <= now < end else 1


def matchday(now, path='docs/data/matches.json'):
    try:
        with open(path, encoding='utf-8') as f:
            matches = json.load(f).get('profis') or []
    except (OSError, ValueError):
        return False
    for m in matches:
        try:
            ko = datetime.fromisoformat((m.get('date') or '').replace('Z', '+00:00'))
        except ValueError:
            continue
        if ko.tzinfo is None:
            ko = ko.replace(tzinfo=timezone.utc)
        if ko - timedelta(hours=7) <= now <= ko + timedelta(hours=4):
            return True
    return False


def should_run(event, schedule, now):
    if event != 'schedule':
        return True
    parts = schedule.split()
    if len(parts) < 2:
        return False
    if parts[1] == '*':
        return matchday(now)
    return (int(parts[1]) + berlin_offset(now)) % 24 in (8, 14, 20)


if __name__ == '__main__':
    ev = sys.argv[1] if len(sys.argv) > 1 else ''
    sched = sys.argv[2] if len(sys.argv) > 2 else ''
    now = datetime.now(timezone.utc)
    run = should_run(ev, sched, now)
    sys.stderr.write('Ereignis %s, Zeitplan "%s" -> %s\n' % (ev, sched, 'Lauf' if run else 'kein Lauf'))
    print('run=%s' % ('true' if run else 'false'))
