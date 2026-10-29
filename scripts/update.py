#!/usr/bin/env python3
"""BVB 09 Fan-App - automatisches Daten-Update.

Laeuft 3x taeglich auf GitHub Actions (kostenlos), zusaetzlich nach jedem Bundesliga-
und Champions-League-Spiel, und braucht nur die Python-Standardbibliothek. Holt:
  * Spiele, Live-Ergebnisse und Tabellen von OpenLigaDB und ESPN
  * Statistiken, Kader und Wettquoten von ESPN
  * Transfer-Schlagzeilen ueber Google News
Die Prognosen (Saison, Champions League, KI-Tipp) rechnet forecast.py - ganz ohne KI.
Die Schlagzeilen wertet die kostenlose Gemini-KI aus (Here we go / Geruecht / Abloese /
Verletzungen); antwortet Gemini nicht, springen kostenlose Ersatz-KIs ein.
Kader/Transfers von Transfermarkt gehen nur von einem normalen PC aus (Bot-Schutz).

Faellt eine Quelle aus, bleiben die alten Daten stehen und die App zeigt
den Fehler in der Update-Zentrale an.
"""
import csv
import difflib
import email.utils
import html
import io
import json
import math
import os
import random
import re
import sys
import time
import traceback
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import forecast as fcst  # noqa: E402  (Prognose-Rechner im selben Ordner)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'docs', 'data')
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/129.0 Safari/537.36')
TM = 'https://www.transfermarkt.de'
OLDB = 'https://api.openligadb.de'
GEMINI = 'https://generativelanguage.googleapis.com/v1beta'

NOW = datetime.now(timezone.utc)
TODAY = NOW.strftime('%Y-%m-%d')
SEASON = NOW.year if NOW.month >= 7 else NOW.year - 1
TRANSFER_SEASON = NOW.year if NOW.month >= 6 else NOW.year - 1
# Update-Zeiten in deutscher Zeit (der Workflow gleicht Sommer-/Winterzeit aus)
SCHEDULE_LOCAL = ['08:17', '14:17', '20:17']

TEAMS = [
    {'key': 'profis', 'name': 'Profis', 'tmId': 16},
    {'key': 'u23', 'name': 'BVB II', 'tmId': 17},
    {'key': 'u19', 'name': 'U19', 'tmId': 1464},
]

# Vertrauenswuerdige Quellen (Geruechte-Ampel)
TIER1 = ['Fabrizio Romano', 'David Ornstein', 'Florian Plettenberg', 'Patrick Berger',
         'Sky Sport', 'Sky', 'kicker', 'Ruhr Nachrichten', 'The Athletic', 'Matteo Moretto',
         'Gianluca Di Marzio', 'Borussia Dortmund (offiziell)', 'bvb.de', 'WAZ']
TIER2 = ['Bild', 'Sport Bild', 'Christian Falk', 'Sport1', 'Transfermarkt', 'ESPN', 'Goal',
         'RevierSport', 'Ben Jacobs', 'Sky Sports', "L'Equipe", 'Marca', 'AS', 'Mundo Deportivo',
         'Gazzetta dello Sport', 'Corriere dello Sport', 'Relevo', 'BBC', 'The Telegraph',
         'The Times', 'Foot Mercato', 'RMC Sport', 'Nicolo Schira']
# Medien, deren Schlagzeilen direkt in der App erscheinen duerfen
HEADLINE_OUTLETS = {
    'kicker': 1, 'sky.de': 1, 'sky sport': 1, 'ruhr nachrichten': 1, 'waz': 1, 'the athletic': 1,
    'bvb.de': 1, 'borussia dortmund': 1, 'sport1': 2, 'bild': 2, 'sport bild': 2,
    'transfermarkt': 2, 'reviersport': 2, 'espn': 2, 'goal.com': 2, 'goal': 2, 'sportschau': 1,
    'wdr': 1, 'westfälische rundschau': 2, 'ruhr24': 2, 'sky sports': 2, 'bbc': 2,
}

STATUS_RANK = {'denied': 0, 'interest': 1, 'talks': 2, 'advanced': 3, 'herewego': 4,
               'official': 5, 'extension': 5}
STATUS_LABEL = {'denied': 'Dementi', 'interest': 'Interesse', 'talks': 'Gespräche',
                'advanced': 'Fortgeschritten', 'herewego': 'HERE WE GO', 'official': 'Offiziell',
                'extension': 'Verlängert'}


# --------------------------------------------------------------------------- Hilfen
def log(*a):
    print(*a, flush=True)


def iso(dt):
    return dt.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


LAST_FETCH = {}
DEBUG = []


def http_get(url, headers=None, timeout=40, retries=2):
    h = {'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
         'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
         'Cache-Control': 'no-cache', 'Upgrade-Insecure-Requests': '1'}
    if headers:
        h.update(headers)
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=h)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read().decode('utf-8', errors='replace')
                LAST_FETCH.update({'url': url, 'final': r.geturl(), 'status': r.status})
                return body
        except urllib.error.HTTPError as e:
            last = 'HTTP %s' % e.code
            if e.code == 404:
                break
        except Exception as e:  # Netzwerkfehler, Timeout ...
            last = str(e)
        time.sleep(2 + attempt * 4)
    raise RuntimeError('%s nicht erreichbar (%s)' % (url.split('?')[0], last))


def http_json(url, body=None, headers=None, timeout=60):
    h = {'User-Agent': UA, 'Accept': 'application/json'}
    if headers:
        h.update(headers)
    data = None
    if body is not None:
        data = json.dumps(body).encode('utf-8')
        h['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))


_tm_last = [0.0]


def tm_get(path):
    """Transfermarkt hoeflich abfragen (max. eine Seite alle 2 Sekunden)."""
    wait = 2.0 - (time.time() - _tm_last[0])
    if wait > 0:
        time.sleep(wait)
    try:
        return http_get(TM + path)
    finally:
        _tm_last[0] = time.time()


def page_hint(page, what):
    """Merkt sich, was Transfermarkt statt der erwarteten Seite geliefert hat (fuer die Update-Zentrale)."""
    title = re.search(r'<title[^>]*>(.*?)</title>', page or '', re.S | re.I)
    body = (page or '')[page.find('<body'):] if page and '<body' in page else (page or '')
    info = {'what': what, 'url': LAST_FETCH.get('url', '').replace(TM, ''), 'final': LAST_FETCH.get('final'),
            'status': LAST_FETCH.get('status'), 'length': len(page or ''),
            'title': text(title.group(1))[:120] if title else None, 'snippet': text(body)[:300]}
    DEBUG.append(info)
    return '%s, Seite: %s' % (what, info['title'] or 'ohne Titel')


def oldb(path):
    last = None
    for attempt in range(3):
        try:
            return http_json(OLDB + path, timeout=45)
        except Exception as e:
            last = e
            time.sleep(2 + attempt * 3)
    raise RuntimeError('OpenLigaDB %s: %s' % (path, last))


TAG_RE = re.compile(r'<[^>]+>')


def text(s):
    return re.sub(r'\s+', ' ', html.unescape(TAG_RE.sub(' ', s or ''))).strip()


def slug(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def balanced(s, start, tag):
    depth = 0
    pat = re.compile(r'<(/?)%s\b[^>]*>' % tag, re.I)
    for m in pat.finditer(s, start):
        if m.group(1) == '':
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                return s[start:m.end()]
    return s[start:]


def items_tables(page):
    return [balanced(page, m.start(), 'table') for m in re.finditer(r'<table class="items">', page)]


def body_rows(table):
    b = table.find('<tbody')
    body = table[b:] if b >= 0 else table
    return re.split(r'<tr class="(?:odd|even)[^"]*"[^>]*>', body)[1:]


def cells(row):
    """Alle <td>-Zellen der obersten Ebene (verschachtelte Tabellen werden beachtet)."""
    out, depth, start, attrs = [], 0, None, ''
    for m in re.finditer(r'<(/?)td\b([^>]*)>', row, re.I):
        if m.group(1) == '':
            if depth == 0:
                start, attrs = m.end(), m.group(2)
            depth += 1
        else:
            depth -= 1
            if depth == 0 and start is not None:
                out.append((attrs, row[start:m.start()]))
                start = None
            depth = max(depth, 0)
    return out


def header_names(table):
    end = table.find('</thead>')
    head = table[:end] if end > 0 else table[:4000]
    names = []
    for attrs, inner in re.findall(r'<th\b([^>]*)>(.*?)</th>', head, re.S):
        t = text(inner)
        if not t:
            m = re.search(r'title="([^"]*)"', inner) or re.search(r'title="([^"]*)"', attrs)
            t = html.unescape(m.group(1)) if m else ''
        names.append(t)
    return names


def money(s):
    s = text(s)
    m = re.search(r'(-?\d+(?:,\d+)?)\s*(Mrd|Mio|Tsd)\.?', s)
    if not m:
        return None
    return int(round(float(m.group(1).replace(',', '.')) *
                     {'Mrd': 1e9, 'Mio': 1e6, 'Tsd': 1e3}[m.group(2)]))


def fmt_money(v):
    if v is None:
        return '-'
    a = abs(v)
    sign = '-' if v < 0 else ''
    if a >= 1e9:
        return sign + ('%.2f' % (a / 1e9)).replace('.', ',') + ' Mrd. €'
    if a >= 1e6:
        return sign + ('%.2f' % (a / 1e6)).replace('.', ',') + ' Mio. €'
    if a >= 1e3:
        return sign + '%d Tsd. €' % round(a / 1e3)
    return sign + '%d €' % a


def de_date(s):
    m = re.search(r'(\d{2})\.(\d{2})\.(\d{4})', s or '')
    return '%s-%s-%s' % (m.group(3), m.group(2), m.group(1)) if m else None


def berlin_to_utc(date_iso, hhmm):
    """Deutsche Ortszeit -> UTC (ohne zusaetzliche Pakete, MEZ/MESZ-Regel)."""
    y, mo, d = map(int, date_iso.split('-'))
    h, mi = (map(int, hhmm.split(':')) if hhmm else (15, 30))
    local = datetime(y, mo, d, h, mi)

    def last_sunday(year, month):
        dt = datetime(year, month + 1, 1) - timedelta(days=1) if month < 12 else datetime(year, 12, 31)
        return dt - timedelta(days=(dt.weekday() + 1) % 7)
    dst_start = last_sunday(y, 3).replace(hour=2)
    dst_end = last_sunday(y, 10).replace(hour=3)
    offset = 2 if dst_start <= local < dst_end else 1
    return iso((local - timedelta(hours=offset)).replace(tzinfo=timezone.utc))


def flags_of(inner):
    return [{'name': html.unescape(t), 'img': src}
            for src, t in re.findall(r'<img[^>]*src="([^"]+/flagge/[^"]+)"[^>]*title="([^"]*)"', inner)]


def player_cell(inner):
    m = re.search(r'<a([^>]*)href="/[^"/]+/profil/spieler/(\d+)"([^>]*)>(.*?)</a>', inner, re.S)
    if not m:
        return None
    name = html.unescape(m.group(4).split('<')[0]).strip()
    if not name:
        t = re.search(r'title="([^"]+)"', m.group(1) + m.group(3)) or re.search(r'alt="([^"]+)"', inner)
        name = html.unescape(t.group(1)).strip() if t else ''
    if not name:
        return None
    img = (re.search(r'data-src="([^"]+/portrait/[^"]+)"', inner) or
           re.search(r'src="([^"]+/portrait/[^"]+)"', inner))
    pos = re.search(r'</td>\s*</tr>\s*<tr>\s*<td[^>]*>\s*([^<]+?)\s*</td>', inner)
    return {'id': m.group(2), 'name': name,
            'img': img.group(1) if img else None, 'position': text(pos.group(1)) if pos else None}


def absences_of(inner):
    """Verletzungen, Sperren usw. aus den kleinen Symbolen neben dem Spielernamen."""
    out = []
    for title, cls in re.findall(r'<span title="([^"]+)" class="([^"]*)"', inner):
        t = html.unescape(title)
        if 'kapitaen' in cls or t == 'Mannschaftskapitän':
            continue
        if 'verletzt' in cls:
            kind = 'injury'
        elif 'Spielberechtigung' in t:
            kind = 'ineligible'
        elif re.search(r'sperre|gesperrt', t, re.I) or 'suspension' in cls:
            kind = 'suspension'
        elif 'ausfall' in cls or 'krank' in t.lower():
            kind = 'out'
        else:
            continue
        out.append({'type': kind, 'text': t})
    return out


def club_cell(inner):
    m = re.search(r'title="([^"]+)"[^>]*href="/[^"]+/(?:startseite|geruechte|transfers)/verein/(\d+)', inner)
    if not m:
        m2 = re.search(r'href="/[^"]+/(?:startseite|geruechte|transfers)/verein/(\d+)[^"]*"[^>]*title="([^"]+)"', inner)
        if not m2:
            return None
        cid, name = m2.group(1), m2.group(2)
    else:
        name, cid = m.group(1), m.group(2)
    league = re.search(r'/wettbewerb/[A-Z0-9]+"[^>]*>([^<]+)</a>', inner)
    return {'id': cid, 'name': html.unescape(name), 'crest': crest(cid),
            'league': text(league.group(1)) if league else None}


def crest(cid):
    return 'https://tmssl.akamaized.net/images/wappen/head/%s.png' % cid if cid else None


def load(name, default=None):
    try:
        with open(os.path.join(DATA, name), encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default


def save(name, obj):
    os.makedirs(DATA, exist_ok=True)
    tmp = os.path.join(DATA, name + '.tmp')
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, os.path.join(DATA, name))


# --------------------------------------------------------------------------- Transfermarkt
def parse_kader(page):
    tables = items_tables(page)
    if not tables:
        raise RuntimeError(page_hint(page, 'Kadertabelle nicht gefunden'))
    t = tables[0]
    names = header_names(t)
    players = []
    for row in body_rows(t):
        cs = cells(row)
        rec, pc = None, None
        for attrs, inner in cs:
            if 'profil/spieler' in inner and rec is None:
                rec, pc = player_cell(inner), inner
        if not rec:
            continue
        rec.update({'number': None, 'group': None, 'captain': 'kapitaenicon' in row,
                    'absences': absences_of(pc or '')})
        g = re.search(r'bg_(Torwart|Abwehr|Mittelfeld|Sturm)', row)
        rec['group'] = g.group(1) if g else None
        num = re.search(r'rn_nummer>\s*([^<]*?)\s*<', row)
        if num and num.group(1) not in ('', '-'):
            rec['number'] = num.group(1)
        ns = re.search(r'title="Neuzugang von: ([^;"]+); Datum: ([\d.]+); Ablöse: ([^"]+)"', pc or '')
        if ns:
            rec['newSigning'] = {'from': html.unescape(ns.group(1)), 'date': de_date(ns.group(2)),
                                 'fee': html.unescape(ns.group(3))}
        for i, (attrs, inner) in enumerate(cs):
            col = names[i] if i < len(names) else ''
            if col.startswith('Geb'):
                rec['birth'] = de_date(inner)
                a = re.search(r'\((\d+)\)', inner)
                rec['age'] = int(a.group(1)) if a else None
            elif col.startswith('Nat'):
                rec['flags'] = flags_of(inner)
            elif col.startswith('Gr'):
                rec['height'] = text(inner) or None
            elif col.startswith('Fu'):
                rec['foot'] = text(inner) or None
            elif col.startswith('Im Team'):
                rec['joined'] = de_date(inner)
            elif col.startswith('Zuvor'):
                m = re.search(r'title="([^":]+):\s*Ablöse\s*([^"]*)"', inner)
                if m:
                    rec['from'] = {'name': html.unescape(m.group(1)), 'fee': html.unescape(m.group(2))}
            elif col.startswith('Vertrag'):
                rec['contract'] = de_date(inner)
            elif col.startswith('Marktwert'):
                rec['value'] = money(re.sub(r'<span[^>]*title="[^"]*"[^>]*>', '', inner))
                pv = re.search(r'Vorheriger Marktwert:\s*([^"]+)"', inner)
                rec['prevValue'] = money(pv.group(1)) if pv else None
        players.append(rec)
    m = re.search(r'data-header__market-value-wrapper">\s*([\d,]+)\s*<span class="waehrung">\s*([^<]+)</span>', page)
    total = money(m.group(1) + ' ' + m.group(2)) if m else None
    if not total:
        total = sum(p.get('value') or 0 for p in players)
    titles = [{'title': html.unescape(t), 'img': img, 'count': int(c)} for t, img, c in re.findall(
        r'<a[^>]*title="([^"]+)"[^>]*class="data-header__success-data">\s*<img[^>]*data-src="([^"]+)"[^>]*>\s*'
        r'<span class="data-header__success-number">\s*(\d+)\s*</span>', page)]
    avg = re.search(r'Durchschnittsalter:\s*<span[^>]*>\s*([\d,]+)', page)
    return {'players': players, 'totalValue': total, 'titles': titles,
            'avgAge': float(avg.group(1).replace(',', '.')) if avg else None}


def parse_stats(page):
    tables = items_tables(page)
    if not tables:
        raise RuntimeError(page_hint(page, 'Statistik-Tabelle nicht gefunden'))
    t = tables[0]
    names = header_names(t)
    keys = {'Einsätze': 'apps', 'Tore': 'goals', 'Torvorlagen': 'assists', 'Gelbe Karten': 'yellow',
            'Gelb-Rote Karten': 'yellowRed', 'Rote Karten': 'red', 'Einwechslungen': 'subIn',
            'Auswechslungen': 'subOut', 'Eingesetzte Minuten': 'minutes', 'Im Kader': 'squad'}
    out = {}
    for row in body_rows(t):
        cs = cells(row)
        pid = None
        for a, inner in cs:
            m = re.search(r'profil/spieler/(\d+)', inner)
            if m:
                pid = m.group(1)
                break
        if not pid:
            continue
        rec = {v: 0 for v in keys.values()}
        if 'nicht eingesetzt' in row:
            for i, (a, inner) in enumerate(cs):
                if i < len(names) and names[i] == 'Im Kader':
                    rec['squad'] = int(re.sub(r'\D', '', text(inner)) or 0)
        else:
            for i, (a, inner) in enumerate(cs):
                col = names[i] if i < len(names) else ''
                if col in keys:
                    rec[keys[col]] = int(re.sub(r'\D', '', text(inner)) or 0)
        out[pid] = rec
    return out


def parse_transfers(page):
    res = {'in': [], 'out': []}
    for t in items_tables(page):
        names = header_names(t)
        hdr = ' '.join(names)
        kind = 'in' if 'Abgebender' in hdr else 'out' if 'Aufnehmender' in hdr else None
        if not kind:
            continue
        for row in body_rows(t):
            cs = cells(row)
            rec = None
            for i, (a, inner) in enumerate(cs):
                col = names[i] if i < len(names) else ''
                if 'profil/spieler' in inner and rec is None:
                    rec = player_cell(inner)
                elif rec is not None and col == 'Alter':
                    rec['age'] = int(text(inner)) if text(inner).isdigit() else None
                elif rec is not None and col.startswith('Nat'):
                    rec['flags'] = flags_of(inner)
                elif rec is not None and 'Verein' in col:
                    rec['club'] = club_cell(inner)
                elif rec is not None and col.startswith('Abl'):
                    fee = text(inner)
                    rec['fee'] = fee
                    rec['feeValue'] = money(fee)
                    rec['loan'] = 'Leih' in fee and 'Ende' not in fee
                    rec['loanEnd'] = 'Leih-Ende' in fee
            if rec:
                res[kind].append(rec)

    def total(cls):
        m = re.search(r'<tr class="transfer-record__%s">.*?<td[^>]*>\s*(\d+)\s*</td>\s*<td[^>]*>(.*?)</td>' % cls, page, re.S)
        return (int(m.group(1)), money(m.group(2))) if m else (None, None)
    res['incomeCount'], res['income'] = total('revenue')
    res['expenseCount'], res['expense'] = total('expenses')
    if res['income'] is None:
        res['income'] = sum(x.get('feeValue') or 0 for x in res['out'])
    if res['expense'] is None:
        res['expense'] = sum(x.get('feeValue') or 0 for x in res['in'])
    res['balance'] = (res['income'] or 0) - (res['expense'] or 0)
    return res


# --------------------------------------------------------------------------- Module
def mod_squads(state):
    prev = load('squads.json', {}) or {}
    out = {'season': SEASON, 'updatedAt': iso(NOW), 'teams': {}}
    errors = []
    for team in TEAMS:
        try:
            page = tm_get('/x/kader/verein/%d/saison_id/%d/plus/1' % (team['tmId'], SEASON))
            k = parse_kader(page)
            if not k['players']:
                raise RuntimeError('keine Spieler gefunden')
            ages = [p['age'] for p in k['players'] if p.get('age')]
            out['teams'][team['key']] = {
                'name': team['name'], 'tmId': team['tmId'], 'totalValue': k['totalValue'],
                'count': len(k['players']),
                'avgAge': k['avgAge'] or (round(sum(ages) / len(ages), 1) if ages else None),
                'players': k['players']}
            if team['key'] == 'profis' and k['titles']:
                out['titles'] = k['titles']
        except Exception as e:
            errors.append('%s: %s' % (team['name'], e))
            old = (prev.get('teams') or {}).get(team['key'])
            if old:
                out['teams'][team['key']] = old
    if not out['teams']:
        raise RuntimeError('; '.join(errors))
    if 'titles' not in out and prev.get('titles'):
        out['titles'] = prev['titles']
    # Aenderungen erkennen
    changes = state['changes']
    first = not prev.get('teams')
    for key, team in out['teams'].items():
        old = {p['id']: p for p in ((prev.get('teams') or {}).get(key) or {}).get('players', [])}
        if first or not old:
            continue
        new_ids = {p['id'] for p in team['players']}
        for p in team['players']:
            o = old.get(p['id'])
            if not o:
                changes.add('squad', 'Neu im Kader (%s): %s' % (team['name'], p['name']))
                continue
            if o.get('value') != p.get('value') and p.get('value') is not None:
                arrow = '▲' if (p['value'] or 0) > (o.get('value') or 0) else '▼'
                changes.add('values', '%s %s: %s → %s' % (arrow, p['name'], fmt_money(o.get('value')),
                                                          fmt_money(p['value'])))
            def miss(x):
                return ' / '.join(a['text'] for a in x.get('absences') or [] if a['type'] in ('injury', 'suspension', 'out'))
            oa, na = miss(o), miss(p)
            if na and na != oa:
                changes.add('injuries', 'Ausfall: %s – %s' % (p['name'], na))
            elif oa and not na:
                changes.add('injuries', 'Wieder verfügbar: %s' % p['name'])
            if o.get('contract') != p.get('contract') and p.get('contract') and o.get('contract'):
                changes.add('squad', 'Vertrag %s jetzt bis %s' % (p['name'], p['contract'][:4]))
        for pid, o in old.items():
            if pid not in new_ids:
                changes.add('squad', 'Nicht mehr im Kader (%s): %s' % (team['name'], o['name']))
    save('squads.json', out)
    state['squads'] = out
    if errors:
        return {'ok': True, 'warning': '; '.join(errors)}
    return {'ok': True, 'count': sum(t['count'] for t in out['teams'].values())}


def mod_stats(state):
    out = {'season': SEASON, 'updatedAt': iso(NOW), 'teams': {}}
    prev = load('stats.json', {}) or {}
    errors = []
    # Nur Profis - keine U23-/U19-Statistiken (Regel von Niklas)
    for team in [t for t in TEAMS if t['key'] == 'profis']:
        try:
            page = tm_get('/x/leistungsdaten/verein/%d/plus/1?reldata=%%26%d' % (team['tmId'], SEASON))
            out['teams'][team['key']] = parse_stats(page)
        except Exception as e:
            errors.append('%s: %s' % (team['name'], e))
            old = (prev.get('teams') or {}).get(team['key'])
            if old:
                out['teams'][team['key']] = old
    if not out['teams']:
        raise RuntimeError('; '.join(errors))
    changed = 0
    for key, players in out['teams'].items():
        old = (prev.get('teams') or {}).get(key) or {}
        if not old:
            continue
        for pid, s in players.items():
            o = old.get(pid)
            if o and (o.get('goals'), o.get('assists'), o.get('apps')) != (s.get('goals'), s.get('assists'), s.get('apps')):
                changed += 1
    if changed:
        state['changes'].add('stats', 'Statistiken aktualisiert bei %d Spielern' % changed, count=changed)
    save('stats.json', out)
    return {'ok': not errors, 'warning': '; '.join(errors) or None}


def mod_transfers(state):
    prev = load('transfers.json', {}) or {}
    page = tm_get('/x/transfers/verein/16/saison_id/%d' % TRANSFER_SEASON)
    t = parse_transfers(page)
    if not t['in'] and not t['out'] and 'transfer-record' not in page:
        raise RuntimeError(page_hint(page, 'Transferliste nicht gefunden'))
    lab = '%02d/%02d' % (TRANSFER_SEASON % 100, (TRANSFER_SEASON + 1) % 100)
    out = {'season': TRANSFER_SEASON, 'seasonLabel': lab, 'updatedAt': iso(NOW)}
    out.update(t)
    if prev.get('season') == TRANSFER_SEASON:
        for kind, label in (('in', 'Neuer Zugang'), ('out', 'Neuer Abgang')):
            old = {x['id'] for x in prev.get(kind, [])}
            for x in t[kind]:
                if x['id'] not in old:
                    club = (x.get('club') or {}).get('name', '?')
                    state['changes'].add('transfers', '%s: %s (%s, %s)' % (label, x['name'], club, x.get('fee')))
    save('transfers.json', out)
    state['transfers'] = out
    return {'ok': True, 'count': len(t['in']) + len(t['out'])}


def pick_leagues():
    """Findet automatisch die richtigen OpenLigaDB-Wettbewerbe der aktuellen Saison."""
    leagues = oldb('/getavailableleagues')
    cats = [('Bundesliga', lambda l: l['leagueShortcut'] == 'bl1'),
            ('DFB-Pokal', lambda l: re.search(r'DFB[ -]?Pokal', l['leagueName'], re.I) and 'Frauen' not in l['leagueName']),
            ('Champions League', lambda l: 'Champions League' in l['leagueName'] and not re.search(r'Frauen|Youth|Women', l['leagueName'])),
            ('Europa League', lambda l: 'Europa League' in l['leagueName']),
            ('Conference League', lambda l: 'Conference League' in l['leagueName']),
            ('Supercup', lambda l: 'Supercup' in l['leagueName'] and not re.search(r'Frauen|UEFA', l['leagueName']))]
    chosen = []
    for name, test in cats:
        best = None
        for l in leagues:
            try:
                season = int(l.get('leagueSeason') or 0)
            except ValueError:
                continue
            if season != SEASON or (l.get('sport') or {}).get('sportId') != 1:
                continue
            if 'test' in l['leagueShortcut'].lower() or not test(l):
                continue
            try:
                ms = oldb('/getmatchdata/%s/%d' % (urllib.parse.quote(l['leagueShortcut']), SEASON))
            except Exception:
                continue
            mine = [m for m in ms if is_bvb(m['team1']['teamName']) or is_bvb(m['team2']['teamName'])]
            if not mine:
                continue
            score = (len(mine), sum(1 for m in mine if m.get('matchIsFinished') and m.get('matchResults')), len(ms))
            if not best or score > best[0]:
                best = (score, l, ms)
        if best:
            chosen.append({'name': name, 'short': best[1]['leagueShortcut'], 'season': SEASON, 'matches': best[2]})
    return chosen


def is_bvb(name):
    return name == 'Borussia Dortmund' or name == 'BVB' or name == 'Bor. Dortmund'


def norm_team(t):
    return {'name': t.get('teamName'), 'short': t.get('shortName') or t.get('teamName'),
            'icon': t.get('teamIconUrl'), 'id': str(t.get('teamId'))}


def norm_match(m, comp, short):
    final = half = None
    for r in m.get('matchResults') or []:
        if r.get('resultTypeID') == 2 or r.get('resultName') == 'Endergebnis':
            final = [r['pointsTeam1'], r['pointsTeam2']]
        elif r.get('resultTypeID') == 1:
            half = [r['pointsTeam1'], r['pointsTeam2']]
    goals, last = [], (0, 0)
    for g in sorted(m.get('goals') or [], key=lambda g: (g.get('matchMinute') or 0, g.get('goalID') or 0)):
        s = (g.get('scoreTeam1') or 0, g.get('scoreTeam2') or 0)
        goals.append({'minute': g.get('matchMinute'), 'scorer': g.get('goalGetterName'),
                      'score': '%d:%d' % s, 'team': 'home' if s[0] > last[0] else 'away',
                      'penalty': bool(g.get('isPenalty')), 'ownGoal': bool(g.get('isOwnGoal'))})
        last = s
    if final is None and goals and not m.get('matchIsFinished'):
        final = list(last)
    home, away = norm_team(m['team1']), norm_team(m['team2'])
    is_home = is_bvb(home['name'])
    outcome = None
    if m.get('matchIsFinished') and final:
        mine, other = (final[0], final[1]) if is_home else (final[1], final[0])
        outcome = 'W' if mine > other else 'L' if mine < other else 'D'
    dt = m.get('matchDateTimeUTC') or m.get('matchDateTime')
    if dt and not dt.endswith('Z') and '+' not in dt[10:]:
        dt += 'Z'
    return {'id': str(m['matchID']), 'oldbId': m['matchID'], 'comp': comp, 'compShort': short,
            'round': (m.get('group') or {}).get('groupName'), 'date': dt, 'timeKnown': True,
            'home': home, 'away': away, 'isHome': is_home, 'finished': bool(m.get('matchIsFinished')),
            'score': final, 'half': half, 'outcome': outcome, 'goals': goals,
            'location': (m.get('location') or {}).get('locationCity') if m.get('location') else None}


def mod_matches(state):
    prev = load('matches.json', {}) or {}
    leagues = pick_leagues()
    if not leagues:
        raise RuntimeError('keine Wettbewerbe gefunden')
    profis = []
    for l in leagues:
        for m in l.pop('matches'):
            if is_bvb(m['team1']['teamName']) or is_bvb(m['team2']['teamName']):
                profis.append(norm_match(m, l['name'], l['short']))
    profis.sort(key=lambda x: x['date'] or '')
    out = {'season': SEASON, 'updatedAt': iso(NOW), 'leagues': leagues, 'profis': profis}
    tables = load('tables.json', {}) or {}
    tables.pop('u23', None)
    try:
        tab = oldb('/getbltable/bl1/%d' % SEASON)
        rows = []
        for i, r in enumerate(tab):
            rows.append({'pos': i + 1, 'team': r['teamName'], 'short': r.get('shortName'),
                         'icon': r.get('teamIconUrl'), 'id': str(r.get('teamInfoId')),
                         'played': r['matches'], 'won': r['won'], 'draw': r['draw'], 'lost': r['lost'],
                         'goals': r['goals'], 'against': r['opponentGoals'], 'diff': r['goalDiff'],
                         'points': r['points'], 'isBVB': is_bvb(r['teamName'])})
        old_pos = next((r['pos'] for r in (tables.get('bl1') or {}).get('rows', []) if r.get('isBVB')), None)
        new_pos = next((r['pos'] for r in rows if r['isBVB']), None)
        if old_pos and new_pos and old_pos != new_pos:
            state['changes'].add('table', 'Bundesliga: BVB jetzt auf Platz %d (vorher %d)' % (new_pos, old_pos))
        tables['bl1'] = {'name': 'Bundesliga', 'rows': rows, 'updatedAt': iso(NOW)}
    except Exception as e:
        state['warnings'].append('Tabelle Bundesliga: %s' % e)
    for key, lg, name in (('ucl', 'uefa.champions', 'Champions League · Ligaphase'), ('bl1', 'ger.1', 'Bundesliga')):
        if key == 'bl1' and (tables.get('bl1') or {}).get('updatedAt') == iso(NOW):
            continue  # OpenLigaDB hat geklappt - ESPN nur als Ersatz
        try:
            rows = espn_table(lg)
            old_pos = next((r['pos'] for r in (tables.get(key) or {}).get('rows', []) if r.get('isBVB')), None)
            new_pos = next((r['pos'] for r in rows if r['isBVB']), None)
            if old_pos and new_pos and old_pos != new_pos:
                state['changes'].add('table', '%s: BVB jetzt auf Platz %d (vorher %d)' % (name.split(' ·')[0], new_pos, old_pos))
            tables[key] = {'name': name, 'rows': rows, 'updatedAt': iso(NOW), 'source': 'ESPN'}
        except Exception as e:
            state['warnings'].append('Tabelle %s (ESPN): %s' % (name, e))
    match_changes(prev.get('profis') or [], out['profis'], state)
    save('matches.json', out)
    save('tables.json', tables)
    return {'ok': True, 'count': len(profis)}


def espn_table(lg):
    """Tabelle von ESPN (frei abrufbar, auch von GitHub aus)."""
    d = http_json('https://site.api.espn.com/apis/v2/sports/soccer/%s/standings' % lg, timeout=30)
    entries = (((d.get('children') or [{}])[0].get('standings') or {}).get('entries') or [])
    rows = []
    for e in entries:
        t = e.get('team') or {}
        st = {x.get('name'): x.get('value') for x in e.get('stats') or []}
        n = lambda k: int(st.get(k) or 0)  # noqa: E731
        name = t.get('displayName') or '?'
        rows.append({'pos': n('rank') or len(rows) + 1, 'team': cl_de(name) if lg == 'uefa.champions' else name,
                     'short': t.get('shortDisplayName') or t.get('abbreviation'),
                     'icon': (t.get('logos') or [{}])[0].get('href'), 'id': 'espn-%s' % t.get('id'),
                     'played': n('gamesPlayed'), 'won': n('wins'), 'draw': n('ties'), 'lost': n('losses'),
                     'goals': n('pointsFor'), 'against': n('pointsAgainst'), 'diff': n('pointDifferential'),
                     'points': n('points'), 'isBVB': is_bvb(name)})
    if not rows:
        raise RuntimeError('ESPN lieferte keine Tabelle')
    rows.sort(key=lambda r: r['pos'])
    return rows


def match_changes(old_list, new_list, state):
    old = {m['id']: m for m in old_list}
    if not old:
        return
    for m in new_list:
        o = old.get(m['id'])
        if m['finished'] and m['score'] and (not o or not o.get('finished')):
            state['changes'].add('matches', 'Ergebnis: %s %d:%d %s (%s)' % (
                m['home']['short'] or m['home']['name'], m['score'][0], m['score'][1],
                m['away']['short'] or m['away']['name'], m['comp']))
        elif o and not m['finished'] and o.get('date') != m.get('date') and m.get('date'):
            state['changes'].add('matches', 'Neue Anstoßzeit: %s – %s' % (
                m['home']['short'] or m['home']['name'], m['away']['short'] or m['away']['name']))


# --------------------------------------------------------------------------- Statistiken (ESPN)
ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues'
ESPN_TEAM = 124
ESPN_LEAGUES = [('ger.1', 'Bundesliga'), ('uefa.champions', 'Champions League'), ('ger.dfb_pokal', 'DFB-Pokal')]
LG_CODE = {'ger.1': 'bl1', 'uefa.champions': 'ucl', 'ger.dfb_pokal': 'dfb'}


def espn_stat(cats, name):
    for c in cats or []:
        for s in c.get('stats') or []:
            if s.get('name') == name:
                return s.get('value') or 0
    return 0


# Englische Positionsangaben (ESPN, TheSportsDB) auf Deutsch - Unbekanntes bleibt leer (App zeigt dann k. A.)
POS_DE = {'goalkeeper': 'Torwart', 'centre-back': 'Innenverteidiger', 'center back': 'Innenverteidiger',
          'centre back': 'Innenverteidiger', 'left-back': 'Linker Verteidiger', 'left back': 'Linker Verteidiger',
          'right-back': 'Rechter Verteidiger', 'right back': 'Rechter Verteidiger', 'defender': 'Abwehrspieler',
          'defensive midfield': 'Defensives Mittelfeld', 'central midfield': 'Zentrales Mittelfeld',
          'attacking midfield': 'Offensives Mittelfeld', 'midfielder': 'Mittelfeldspieler',
          'left winger': 'Linksaußen', 'left wing': 'Linksaußen', 'right winger': 'Rechtsaußen', 'right wing': 'Rechtsaußen',
          'centre-forward': 'Mittelstürmer', 'center forward': 'Mittelstürmer', 'striker': 'Mittelstürmer',
          'second striker': 'Hängende Spitze', 'forward': 'Stürmer'}


def pos_de(pos):
    p = (pos or '').strip()
    return POS_DE.get(p.lower(), p) or None


def espn_group(pos):
    p = (pos or '').lower()
    return ('Torwart' if 'keeper' in p else 'Abwehr' if 'defen' in p or 'back' in p
            else 'Sturm' if 'forward' in p or 'striker' in p or 'wing' in p else 'Mittelfeld')


def mod_stats_espn(state):
    """Einsaetze, Tore, Vorlagen, Karten und Minuten der Profis ueber die oeffentliche ESPN-Schnittstelle."""
    prev = load('stats.json', {}) or {}
    squads = load('squads.json') or {}
    pro = (squads.get('teams') or {}).get('profis')
    if not pro:
        raise RuntimeError('keine Kaderdaten')
    agg, errors = {}, []
    for lg, label in ESPN_LEAGUES:
        try:
            r = http_json('%s/%s/teams/%d/roster' % (ESPN, lg, ESPN_TEAM), timeout=40)
        except Exception as e:
            errors.append('%s: %s' % (label, e))
            continue
        for a in r.get('athletes') or []:
            cats = ((a.get('statistics') or {}).get('splits') or {}).get('categories') or []
            d = agg.setdefault(a['id'], {'name': a.get('fullName') or a.get('displayName'), 'jersey': a.get('jersey'),
                                         'pos': (a.get('position') or {}).get('name'), 'age': a.get('age'),
                                         'dob': (a.get('dateOfBirth') or '')[:10],
                                         'apps': 0, 'subIn': 0, 'goals': 0, 'assists': 0, 'yellow': 0, 'red': 0,
                                         'leagues': [], 'bl': lg == 'ger.1'})
            apps = int(espn_stat(cats, 'appearances'))
            d['apps'] += apps
            d['subIn'] += int(espn_stat(cats, 'subIns'))
            d['goals'] += int(espn_stat(cats, 'totalGoals'))
            d['assists'] += int(espn_stat(cats, 'goalAssists'))
            d['yellow'] += int(espn_stat(cats, 'yellowCards'))
            d['red'] += int(espn_stat(cats, 'redCards'))
            d['bl'] = d['bl'] or lg == 'ger.1'
            if apps:
                d['leagues'].append(lg)
                d.setdefault('comp', {})[lg] = {'apps': apps, 'subIn': int(espn_stat(cats, 'subIns')),
                                                'goals': int(espn_stat(cats, 'totalGoals')), 'assists': int(espn_stat(cats, 'goalAssists')),
                                                'yellow': int(espn_stat(cats, 'yellowCards')), 'red': int(espn_stat(cats, 'redCards'))}
        time.sleep(0.5)
    if not agg:
        raise RuntimeError('; '.join(errors) or 'ESPN lieferte keine Daten')
    # Minuten je Spieler und Wettbewerb: bei jedem regulaeren Update (alle ~6 Std.) und nach jedem BVB-Spiel neu
    mins = prev.get('espnMinutes') or {}
    fin = [m['date'] for m in ((load('matches.json', {}) or {}).get('profis') or []) if m.get('finished') and m.get('date')]
    last_end = iso(parse_dt(max(fin)) + timedelta(hours=2)) if fin and parse_dt(max(fin)) else ''
    mins_at = mins.get('at') or ((mins.get('date') or '2000-01-01') + 'T00:00:00Z')
    if not mins.get('byComp') or mins_at < iso(NOW - timedelta(hours=5)) or (last_end and mins_at < last_end <= iso(NOW)):
        by, by_comp = {}, {}
        for eid, d in agg.items():
            total, per = 0, {}
            for lg in d['leagues']:
                try:
                    j = http_json('%s/%s/seasons/%d/types/1/athletes/%s/statistics' % (ESPN_CORE, lg, SEASON, eid), timeout=30)
                    per[lg] = int(espn_stat((j.get('splits') or {}).get('categories'), 'minutes'))
                    total += per[lg]
                except Exception:
                    pass
                time.sleep(0.25)
            by[eid], by_comp[eid] = total, per
        mins = {'date': TODAY, 'at': iso(NOW), 'byId': by, 'byComp': by_comp}
    players = pro['players']
    by_slug = {slug(p['name']): p for p in players}

    def match(d):
        s = slug(d['name'] or '')
        if s in by_slug:
            return by_slug[s]
        last = s.split('-')[-1]
        cands = [p for p in players if slug(p['name']).split('-')[-1] == last]
        if len(cands) == 1:
            return cands[0]
        if d.get('jersey'):
            cands = [p for p in cands or players if p.get('number') == str(d['jersey'])]
            if len(cands) == 1:
                return cands[0]
        return None
    teams_stats = {}  # nur Profis - U23/U19-Statistiken gibt es nicht mehr
    old = (prev.get('teams') or {}).get('profis') or {}
    new = dict(old)
    changed = matched = 0
    known = {slug(p['name']) for t in (squads.get('teams') or {}).values() for p in t.get('players', [])}
    added, on_roster, squad_changed = [], set(), False
    departed = squads.setdefault('departed', {})  # Abgaenge merken, damit sie nicht gleich wieder auftauchen
    cut = (NOW - timedelta(days=60)).strftime('%Y-%m-%d')
    for k in [k for k, v in departed.items() if v < cut]:
        del departed[k]
        squad_changed = True
    for eid, d in agg.items():
        p = match(d)
        if not p:
            if d['bl'] and slug(d['name'] or '') not in known and slug(d['name'] or '') not in departed:
                added.append((eid, d))
            continue
        matched += 1
        if d['bl']:
            # Kader-Abgleich mit dem offiziellen Bundesliga-Kader: Rueckennummer und Geburtstag
            on_roster.add(p['id'])
            if d.get('jersey') and str(d['jersey']) != str(p.get('number') or ''):
                if p.get('number'):
                    state['changes'].add('squad', 'Neue Rückennummer: %s trägt jetzt die %s' % (p['name'], d['jersey']))
                p['number'] = str(d['jersey'])
                squad_changed = True
            if d.get('dob') and not p.get('birth'):
                p['birth'] = d['dob']
                squad_changed = True
        o = old.get(p['id']) or {}
        rec = dict(o)
        rec.update({'apps': d['apps'], 'subIn': d['subIn'], 'goals': d['goals'], 'assists': d['assists'],
                    'yellow': d['yellow'], 'red': d['red']})
        m = (mins.get('byId') or {}).get(eid)
        if m:
            rec['minutes'] = m
        per = (mins.get('byComp') or {}).get(eid) or {}
        rec['byComp'] = {LG_CODE[lg]: dict(v, minutes=per.get(lg, 0)) for lg, v in (d.get('comp') or {}).items() if lg in LG_CODE}
        if (o.get('apps'), o.get('goals'), o.get('assists'), o.get('minutes')) != (rec['apps'], rec['goals'], rec['assists'], rec.get('minutes')):
            changed += 1
        new[p['id']] = rec
    if not matched:
        raise RuntimeError('ESPN-Spieler konnten dem Kader nicht zugeordnet werden')
    teams_stats['profis'] = new
    # Abgaenge: wer 3 Tage hintereinander nicht mehr im offiziellen Bundesliga-Kader steht, fliegt raus.
    # Vorsichtig: nur wenn ESPN einen vollstaendigen Kader liefert und kein aehnlicher Name/keine gleiche Nummer auftaucht.
    roster = [d for d in agg.values() if d['bl']]
    if len(roster) >= 20:
        tokens = {t for d in roster for t in slug(d['name'] or '').split('-') if len(t) > 2}
        jerseys = {str(d['jersey']) for d in roster if d.get('jersey')}
        recent = (NOW - timedelta(days=30)).strftime('%Y-%m-%d')
        for p in list(players):
            if p['id'] in on_roster:
                if p.pop('espnMiss', None):
                    squad_changed = True
                continue
            if ((p.get('joined') or '') >= recent or set(slug(p['name']).split('-')) & tokens
                    or str(p.get('number') or '-') in jerseys):
                continue
            miss = p.get('espnMiss') or {'n': 0, 'd': ''}
            if miss['d'] != TODAY:
                miss = {'n': miss['n'] + 1, 'd': TODAY}
            p['espnMiss'] = miss
            squad_changed = True
            if miss['n'] >= 3:
                players.remove(p)
                departed[slug(p['name'])] = TODAY
                state['changes'].add('squad', 'Nicht mehr im Kader: %s (nicht mehr im offiziellen Bundesliga-Kader)' % p['name'])
    # Neue Spieler aus dem offiziellen Bundesliga-Kader automatisch in den App-Kader
    for eid, d in added:
        pid = 'espn-%s' % eid
        players.append({'id': pid, 'name': d['name'], 'img': 'https://a.espncdn.com/i/headshots/soccer/players/full/%s.png' % eid,
                        'position': pos_de(d['pos']), 'group': espn_group(d['pos']), 'number': str(d['jersey']) if d.get('jersey') else None,
                        'captain': False, 'absences': [], 'age': d.get('age'), 'birth': d.get('dob') or None, 'joined': TODAY,
                        'aiAdded': 'laut offiziellem Bundesliga-Kader (ESPN)'})
        new[pid] = {'apps': d['apps'], 'subIn': d['subIn'], 'goals': d['goals'], 'assists': d['assists'],
                    'yellow': d['yellow'], 'red': d['red'], 'minutes': (mins.get('byId') or {}).get(eid, 0)}
        state['changes'].add('squad', 'Neu im Kader: %s (offizieller Bundesliga-Kader)' % d['name'])
    # Alter aus dem Geburtstag immer neu berechnen (alle Teams)
    for t in (squads.get('teams') or {}).values():
        for q in t.get('players', []):
            b = re.match(r'(\d{4})-(\d{2})-(\d{2})', q.get('birth') or '')
            if b:
                y, mo, dd = int(b.group(1)), int(b.group(2)), int(b.group(3))
                age = NOW.year - y - ((NOW.month, NOW.day) < (mo, dd))
                if q.get('age') != age:
                    q['age'] = age
                    squad_changed = True
        ages = [q['age'] for q in t.get('players', []) if q.get('age')]
        if ages and t.get('avgAge') != round(sum(ages) / len(ages), 1):
            t['avgAge'] = round(sum(ages) / len(ages), 1)
            squad_changed = True
    if added or squad_changed:
        pro['count'] = len(players)
        save('squads.json', squads)
    out = dict(prev)
    out.update({'season': SEASON, 'updatedAt': iso(NOW), 'teams': teams_stats, 'espnMinutes': mins,
                'source': {'profis': 'ESPN'}})
    save('stats.json', out)
    if changed:
        state['changes'].add('stats', 'Statistiken aktualisiert bei %d Spielern (ESPN)' % changed, count=changed)
    return {'ok': True, 'count': matched, 'warning': '; '.join(errors) or None}


# --------------------------------------------------------------------------- Saison: Fieberkurve, Prognose, Torjaeger
def final_result(m):
    fr = next((r for r in m.get('matchResults') or [] if r.get('resultTypeID') == 2), None)
    return (fr['pointsTeam1'], fr['pointsTeam2']) if fr else None


def md_of(m):
    return (m.get('group') or {}).get('groupOrderID') or 0


def bl_standings(matches, upto=None, before=None):
    """Tabelle aus OpenLigaDB-Spielen: nur beendete Spiele, optional bis Spieltag `upto` oder vor Spieltag `before`."""
    tab = {}
    for m in matches:
        for t in (m['team1'], m['team2']):
            tab.setdefault(str(t['teamId']), {'id': str(t['teamId']), 'team': t.get('teamName'), 'short': t.get('shortName'),
                                              'icon': t.get('teamIconUrl'), 'played': 0, 'won': 0, 'draw': 0, 'lost': 0,
                                              'goals': 0, 'against': 0, 'points': 0})
    for m in matches:
        md = md_of(m)
        fr = final_result(m)
        if not m.get('matchIsFinished') or not fr or (upto is not None and md > upto) or (before is not None and md >= before):
            continue
        a, b = tab[str(m['team1']['teamId'])], tab[str(m['team2']['teamId'])]
        g1, g2 = fr
        for r, gf, ga in ((a, g1, g2), (b, g2, g1)):
            r['played'] += 1
            r['goals'] += gf
            r['against'] += ga
            if gf > ga:
                r['won'] += 1
                r['points'] += 3
            elif gf == ga:
                r['draw'] += 1
                r['points'] += 1
            else:
                r['lost'] += 1
    rows = sorted(tab.values(), key=lambda r: (-r['points'], -(r['goals'] - r['against']), -r['goals'], r['team'] or ''))
    for i, r in enumerate(rows):
        r['pos'] = i + 1
        r['diff'] = r['goals'] - r['against']
        r['isBVB'] = is_bvb(r['team'] or '')
    return rows


def fever_curve(matches):
    """BVB-Platz und -Punkte nach jedem Spieltag."""
    out = []
    for md in sorted({md_of(m) for m in matches if m.get('matchIsFinished')} - {0}):
        me = next((r for r in bl_standings(matches, upto=md) if r['isBVB']), None)
        if me and me['played']:
            out.append([md, me['pos'], me['points']])
    return out


def poisson(rng, lam):
    lim, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= lim:
            return k
        k += 1


def season_forecast(matches, sims=4000):
    """Monte-Carlo-Simulation der Restsaison (Poisson-Modell aus Angriffs- und Abwehrstaerke, Heimvorteil)."""
    played = [m for m in matches if m.get('matchIsFinished') and final_result(m)]
    remaining = [m for m in matches if not m.get('matchIsFinished')]
    if len(played) < 18 or not remaining:
        return None
    hg = sum(final_result(m)[0] for m in played)
    ag = sum(final_result(m)[1] for m in played)
    n = len(played)
    avg_h, avg_a, avg = hg / n, ag / n, (hg + ag) / (2 * n)
    st = {}
    for m in played:
        g1, g2 = final_result(m)
        for t, gf, ga in ((str(m['team1']['teamId']), g1, g2), (str(m['team2']['teamId']), g2, g1)):
            s = st.setdefault(t, [0, 0, 0])
            s[0] += gf
            s[1] += ga
            s[2] += 1
    k = 6  # wenige Spiele -> Staerken vorsichtig Richtung Ligaschnitt ziehen
    att = {t: ((s[0] + k * avg) / (s[2] + k)) / avg for t, s in st.items()}
    dfn = {t: ((s[1] + k * avg) / (s[2] + k)) / avg for t, s in st.items()}
    base = bl_standings(matches)
    pts0 = {r['id']: r['points'] for r in base}
    gd0 = {r['id']: r['diff'] for r in base}
    gf0 = {r['id']: r['goals'] for r in base}
    games = []
    for m in remaining:
        t1, t2 = str(m['team1']['teamId']), str(m['team2']['teamId'])
        games.append((t1, t2, avg_h * att.get(t1, 1) * dfn.get(t2, 1), avg_a * att.get(t2, 1) * dfn.get(t1, 1)))
    rng = random.Random(1000 + n)
    counts = {t: [0] * (len(base) + 1) for t in pts0}
    exp_pts = dict.fromkeys(pts0, 0.0)
    for _ in range(sims):
        pts, gd, gf = dict(pts0), dict(gd0), dict(gf0)
        for t1, t2, l1, l2 in games:
            g1, g2 = poisson(rng, l1), poisson(rng, l2)
            gd[t1] += g1 - g2
            gd[t2] += g2 - g1
            gf[t1] += g1
            gf[t2] += g2
            if g1 > g2:
                pts[t1] += 3
            elif g1 < g2:
                pts[t2] += 3
            else:
                pts[t1] += 1
                pts[t2] += 1
        for i, t in enumerate(sorted(pts, key=lambda t: (-pts[t], -gd[t], -gf[t], rng.random()))):
            counts[t][i + 1] += 1
        for t in pts:
            exp_pts[t] += pts[t]
    nt = len(base)
    pct = lambda t, lo, hi: round(100.0 * sum(counts[t][lo:hi + 1]) / sims, 1)  # noqa: E731
    teams = []
    for r in base:
        t = r['id']
        teams.append({'id': t, 'team': r['team'], 'short': r['short'], 'icon': r['icon'], 'pos': r['pos'], 'points': r['points'],
                      'isBVB': r['isBVB'], 'expPoints': round(exp_pts[t] / sims, 1), 'title': pct(t, 1, 1), 'cl': pct(t, 1, 4),
                      'el': pct(t, 5, 5), 'ecl': pct(t, 6, 6), 'rel': pct(t, nt - 2, nt - 2), 'down': pct(t, nt - 1, nt),
                      'dist': [round(100.0 * c / sims, 1) for c in counts[t][1:]]})
    teams.sort(key=lambda x: -x['expPoints'])
    return {'sims': sims, 'played': n, 'remaining': len(remaining), 'teams': teams}


def scorer_teams(matches):
    """Torschuetzen-ID -> Verein (aus den Toren der Saison, Eigentore zaehlen fuer den Gegner)."""
    out = {}
    for m in matches:
        last = (0, 0)
        for g in sorted(m.get('goals') or [], key=lambda g: (g.get('matchMinute') or 0, g.get('goalID') or 0)):
            s = (g.get('scoreTeam1') or 0, g.get('scoreTeam2') or 0)
            side = m['team1'] if s[0] > last[0] else m['team2']
            if g.get('isOwnGoal'):
                side = m['team2'] if side is m['team1'] else m['team1']
            if g.get('goalGetterID'):
                out[g['goalGetterID']] = side
            last = s
    return out


# --------------------------------------------------------------------------- Prognose-Modell: Spielstaerken aus Ergebnissen + Wettquoten
FC_LEAGUES = [('bl', 'ger.1'), ('cl', 'uefa.champions'), ('dfb', 'ger.dfb_pokal')]
ESPN_BVB = '124'
ESPN_ALIAS = {'FC Cologne': 'Köln', 'Hamburg SV': 'Hamburger SV', 'Nuremberg': 'Nürnberg', 'Bayern Munich': 'Bayern München',
              'Hertha Berlin': 'Hertha BSC', 'Fortuna Dusseldorf': 'Düsseldorf'}
CL_DE = {'Bayern Munich': 'Bayern München', 'Internazionale': 'Inter Mailand', 'AS Roma': 'AS Rom', 'Napoli': 'SSC Neapel',
         'Sporting CP': 'Sporting Lissabon', 'Slavia Prague': 'Slavia Prag', 'Sparta Prague': 'Sparta Prag',
         'Shakhtar Donetsk': 'Schachtar Donezk', 'Club Brugge': 'FC Brügge', 'Bodo/Glimt': 'Bodø/Glimt', 'AEK Athens': 'AEK Athen',
         'Fenerbahce': 'Fenerbahçe', 'Feyenoord Rotterdam': 'Feyenoord', 'Viking FK': 'Viking Stavanger', 'LASK Linz': 'LASK',
         'Juventus': 'Juventus Turin', 'AC Milan': 'AC Mailand', 'Benfica': 'Benfica Lissabon', 'Olympiacos': 'Olympiakos Piräus',
         'Red Bull Salzburg': 'RB Salzburg', 'Celtic': 'Celtic Glasgow', 'Rangers': 'Glasgow Rangers', 'FC Copenhagen': 'FC Kopenhagen',
         'FK Qarabag': 'Qarabağ Ağdam', 'Red Star Belgrade': 'Roter Stern Belgrad', 'Young Boys': 'Young Boys Bern',
         'Tottenham Hotspur': 'Tottenham', 'Newcastle United': 'Newcastle', 'Atalanta': 'Atalanta Bergamo', 'Real Betis': 'Betis Sevilla',
         'Villarreal': 'FC Villarreal', 'Como': 'Como 1907', 'Lens': 'RC Lens', 'Lille': 'OSC Lille', 'Sabah FK': 'Sabah Baku',
         'Ajax Amsterdam': 'Ajax', 'Galatasaray': 'Galatasaray', 'Sevilla': 'FC Sevilla', 'Marseille': 'Olympique Marseille',
         'Lyon': 'Olympique Lyon', 'Girona': 'FC Girona', 'Bologna': 'FC Bologna', 'Aston Villa': 'Aston Villa'}
ROUND_DE = {'league-phase': 'Ligaphase', 'knockout-round-playoffs': 'Playoffs', 'round-of-16': 'Achtelfinale',
            'quarterfinals': 'Viertelfinale', 'semifinals': 'Halbfinale', 'final': 'Finale'}
NEXT_KEY = {'knockout-round-playoffs': 'r16', 'round-of-16': 'qf', 'quarterfinals': 'sf', 'semifinals': 'final', 'final': 'win'}
# Kurznamen von ESPN (englisch) -> deutsch, fuer die Spielliste der Champions League
CL_SHORT_DE = {'Inter Milan': 'Inter', 'Man Utd': 'Man United', 'Bayern': 'Bayern', 'Napoli': 'Neapel', 'Slavia Prague': 'Slavia Prag',
               'Sparta Prague': 'Sparta Prag', 'Club Brugge': 'Brügge', 'Bodo/Glimt': 'Bodø/Glimt', 'Shakhtar': 'Schachtar',
               'Copenhagen': 'Kopenhagen', 'FC Copenhagen': 'Kopenhagen', 'AEK Athens': 'AEK Athen', 'Olympiacos': 'Olympiakos',
               'Red Star': 'Roter Stern', 'Crvena Zvezda': 'Roter Stern', 'Sporting': 'Sporting', 'Atlético': 'Atlético',
               'AS Roma': 'AS Rom', 'Roma': 'AS Rom', 'Juventus': 'Juventus', 'Villarreal': 'Villarreal', 'Real Betis': 'Betis',
               'Union St.-Gilloise': 'Union SG', 'Dinamo Zagreb': 'Dinamo Zagreb', 'Celtic': 'Celtic', 'Monaco': 'Monaco'}
DFB_DE = {'first-round': '1. Runde', 'second-round': '2. Runde', 'round-of-16': 'Achtelfinale', 'quarterfinals': 'Viertelfinale',
          'semifinals': 'Halbfinale', 'final': 'Finale'}


def cl_de(name):
    return CL_DE.get(name, name)


def espn_season(lg, season):
    """Alle Spiele eines ESPN-Wettbewerbs in einer Saison (gespielt und kommend, mit Wettquoten)."""
    out = {}
    for y in (season, season + 1):
        try:
            d = http_json('%s/%s/scoreboard?limit=1000&dates=%d' % (ESPN, lg, y), timeout=60)
        except Exception as e:
            if y == season:
                raise
            log('  ESPN %s %d: %s' % (lg, y, e))
            continue
        for e in d.get('events') or []:
            if (e.get('season') or {}).get('year') == season:
                ev = fcst.norm_event(e)
                if ev:
                    out[ev['id']] = ev
    return sorted(out.values(), key=lambda e: e['date'] or '')


# Heimische Ligen der CL-Teams (ESPN-Tabellen), damit z. B. PSG nicht nur aus seinen CL-Spielen bewertet wird.
# Die Bundesliga fehlt bewusst: sie steckt schon Spiel fuer Spiel im Modell. Ohne ESPN-Tabelle (k. A.):
# Tschechien, Ukraine, Slowakei, Aserbaidschan, Schweiz, Serbien, Kroatien, Polen.
DOMESTIC = ['eng.1', 'esp.1', 'ita.1', 'fra.1', 'por.1', 'ned.1', 'bel.1', 'tur.1', 'gre.1', 'sco.1', 'aut.1', 'nor.1',
            'den.1', 'swe.1']
# Europa League und Conference League: verbinden die Ligen untereinander (wie stark ist die Liga als Ganzes?)
EU_CUPS = ['uefa.europa', 'uefa.europa.conf']


def espn_standings(lg, season=None):
    """Alle Teams einer ESPN-Tabelle: [{'id', 'names', 'gp', 'gf', 'ga'}]; Ligen mit Meister-/Abstiegsrunde liefern
    mehrere Gruppen - jedes Team zaehlt einmal."""
    url = 'https://site.api.espn.com/apis/v2/sports/soccer/%s/standings' % lg + ('?season=%d' % season if season else '')
    d = http_json(url, timeout=30)
    rows, seen = [], set()
    for ch in d.get('children') or []:
        for e in ((ch.get('standings') or {}).get('entries') or []):
            t = e.get('team') or {}
            tid = str(t.get('id'))
            if tid in seen:
                continue
            seen.add(tid)
            st = {x.get('name'): x.get('value') for x in e.get('stats') or []}
            rows.append({'id': tid, 'names': [n for n in (t.get('displayName'), t.get('shortDisplayName'), t.get('name'),
                                                          t.get('location'), t.get('abbreviation')) if n],
                         'gp': int(st.get('gamesPlayed') or 0), 'gf': int(st.get('pointsFor') or 0), 'ga': int(st.get('pointsAgainst') or 0)})
    return rows


def domestic_tables(season=None, leagues=None):
    """{liga: {espn_team_id: [spiele, tore, gegentore]}} aller Teams; season=None = laufende Saison."""
    out = {}
    for lg in DOMESTIC if leagues is None else leagues:
        try:
            rows = {r['id']: [r['gp'], r['gf'], r['ga']] for r in espn_standings(lg, season) if r['gp']}
        except Exception as e:
            log('  Tabelle %s%s: %s' % (lg, ' %d' % season if season else '', e))
            continue
        if rows:
            out[lg] = rows
        time.sleep(0.2)
    return out


# Ergebnisse, xG und Wettquoten (Marktdurchschnitt, Schlussquoten) aus 11 Ligen von football-data.co.uk - frei,
# zweimal pro Woche aktualisiert, robots.txt erlaubt den Abruf. Die Quoten sind die beste freie Einschaetzung
# der Spielstaerke: so zaehlt fuer PSG nicht nur das Ergebnis gegen Lyon, sondern auch, wie klar PSG Favorit war.
FD = 'https://www.football-data.co.uk'
FD_LEAGUES = {'D1': 'ger.1', 'D2': 'ger.2', 'E0': 'eng.1', 'SP1': 'esp.1', 'I1': 'ita.1', 'F1': 'fra.1', 'N1': 'ned.1',
              'P1': 'por.1', 'B1': 'bel.1', 'T1': 'tur.1', 'G1': 'gre.1', 'SC0': 'sco.1'}  # 2. Liga: fuer die Pokal-Gegner
# football-data-Kurznamen, die sich nicht von selbst den ESPN-Namen zuordnen lassen
FD_ALIAS = {'Paris SG': 'Paris Saint-Germain', "Nott'm Forest": 'Nottingham Forest', 'Man United': 'Manchester United',
            'Man City': 'Manchester City', 'Ath Madrid': 'Atletico Madrid', 'Ath Bilbao': 'Athletic Club',
            'Sp Lisbon': 'Sporting CP', 'Sp Braga': 'Braga', "M'gladbach": 'Monchengladbach', 'Ein Frankfurt': 'Eintracht Frankfurt',
            'FC Koln': 'Cologne', 'Inter': 'Internazionale', 'Milan': 'AC Milan', 'Vallecano': 'Rayo Vallecano',
            'Sociedad': 'Real Sociedad', 'Betis': 'Real Betis', 'Celta': 'Celta Vigo', 'Espanol': 'Espanyol',
            'Wolves': 'Wolverhampton Wanderers', 'Olympiakos': 'Olympiacos', 'St. Gilloise': 'Union St.-Gilloise',
            'Buyuksehyr': 'Istanbul Basaksehir', 'For Sittard': 'Fortuna Sittard', 'Nijmegen': 'NEC',
            'Guimaraes': 'Vitoria Guimaraes', 'Verona': 'Hellas Verona', 'Hamburg': 'Hamburger SV'}


def fd_names(s):
    return {t for t in slug(s).split('-') if t and t not in GENERIC_TOKENS}


def fd_sim(a, b):
    ta, tb = fd_names(a), fd_names(b)
    if not ta or not tb:
        return 0.0
    over = len(ta & tb) / min(len(ta), len(tb))
    ratio = difflib.SequenceMatcher(None, ' '.join(sorted(ta)), ' '.join(sorted(tb))).ratio()
    return max(over, ratio)


def fd_map_teams(fd_stats, espn_rows):
    """football-data-Name -> ESPN-Team-ID. Namensaehnlichkeit plus Abgleich der Bilanz (Spiele, Tore, Gegentore):
    stimmt die Bilanz exakt, ist die Zuordnung praktisch sicher - auch bei Aufsteigern mit ungewohnten Kurznamen."""
    cands = []
    for name, (gp, gf, ga) in fd_stats.items():
        alias = FD_ALIAS.get(name, name)
        for r in espn_rows:
            sim = max(fd_sim(alias, n) for n in r['names'])
            same = (gp, gf, ga) == (r['gp'], r['gf'], r['ga']) and gp > 0
            near = abs(gp - r['gp']) <= 1 and abs(gf - r['gf']) + abs(ga - r['ga']) <= 3
            score = sim + (1.0 if same else 0.3 if near else 0.0)
            if sim >= 0.5 or (same and sim >= 0.2):
                cands.append((score, name, r['id']))
    out, used = {}, set()
    for score, name, tid in sorted(cands, reverse=True):
        if name not in out and tid not in used:
            out[name] = tid
            used.add(tid)
    return out


def fd_rows(path):
    raw = http_get(FD + path, timeout=40)
    return list(csv.DictReader(io.StringIO(raw.lstrip('﻿'))))


def fd_date(s):
    for fmt in ('%d/%m/%Y', '%d/%m/%y'):
        try:
            return datetime.strptime((s or '').strip(), fmt).replace(tzinfo=timezone.utc, hour=12)
        except ValueError:
            pass
    return None


def fd_num(row, key):
    try:
        return float(row.get(key) or '')
    except ValueError:
        return None


def fd_odds(row):
    """Marktdurchschnitt (Schlussquoten, sonst Eroeffnung) -> {'ph','pd','pa'(,'line','pover')} ohne Buchmacher-Marge."""
    for h, d, a in (('AvgCH', 'AvgCD', 'AvgCA'), ('B365CH', 'B365CD', 'B365CA'), ('AvgH', 'AvgD', 'AvgA'), ('B365H', 'B365D', 'B365A')):
        oh, od, oa = fd_num(row, h), fd_num(row, d), fd_num(row, a)
        if not (oh and od and oa) or min(oh, od, oa) <= 1.0:
            continue
        ph, pd, pa = 1 / oh, 1 / od, 1 / oa
        s = ph + pd + pa
        out = {'ph': ph / s, 'pd': pd / s, 'pa': pa / s}
        for o, u in (('AvgC>2.5', 'AvgC<2.5'), ('B365C>2.5', 'B365C<2.5'), ('Avg>2.5', 'Avg<2.5'), ('B365>2.5', 'B365<2.5')):
            ov, un = fd_num(row, o), fd_num(row, u)
            if ov and un and ov > 1 and un > 1:
                out.update({'line': 2.5, 'pover': (1 / ov) / (1 / ov + 1 / un)})
                break
        return out
    return None


def football_data(now_ts):
    """Beobachtungen fuers Modell aus football-data: Ergebnisse (mit xG gemischt, wo vorhanden) und Wettquoten
    gespielter und kommender Spiele. -> {'obs', 'leagues' (ESPN-Codes, die geklappt haben), 'info'}"""
    code = '%02d%02d' % (SEASON % 100, (SEASON + 1) % 100)
    obs, ok, info = [], set(), {'matches': 0, 'odds': 0, 'xg': 0, 'fixtures': 0, 'unmapped': []}
    maps = {}
    for div, lg in FD_LEAGUES.items():
        try:
            rows = fd_rows('/mmz4281/%s/%s.csv' % (code, div))
            espn = espn_standings(lg)
        except Exception as e:
            log('  football-data %s: %s' % (div, e))
            continue
        played = [r for r in rows if (r.get('FTHG') or '').strip() != '' and (r.get('FTAG') or '').strip() != '']
        stats = {}
        for r in played:
            x, y = int(float(r['FTHG'])), int(float(r['FTAG']))
            for t, gf, ga in ((r['HomeTeam'], x, y), (r['AwayTeam'], y, x)):
                s = stats.setdefault(t, [0, 0, 0])
                s[0] += 1
                s[1] += gf
                s[2] += ga
        teams = {r['HomeTeam'] for r in rows} | {r['AwayTeam'] for r in rows}
        for t in teams:
            stats.setdefault(t, [0, 0, 0])
        m = fd_map_teams({k: tuple(v) for k, v in stats.items()}, espn)
        miss = sorted(teams - set(m))
        info['unmapped'] += ['%s:%s' % (div, t) for t in miss]
        if len(m) < 0.9 * len(teams):
            log('  football-data %s: nur %d von %d Teams zugeordnet' % (div, len(m), len(teams)))
            continue
        maps[div] = m
        ok.add(lg)
        done = {id(r) for r in played}
        for r in rows:
            h, a, dt = m.get(r['HomeTeam']), m.get(r['AwayTeam']), fd_date(r.get('Date'))
            if not (h and a and dt):
                continue
            w = fcst.decay((now_ts - dt.timestamp()) / 86400.0)
            if id(r) in done:
                x, y = float(r['FTHG']), float(r['FTAG'])
                hx, ax = fd_num(r, 'HxG'), fd_num(r, 'AxG')
                if hx is not None and ax is not None:
                    x, y = (x + hx) / 2, (y + ax) / 2  # xG glaettet Zufallstore
                    info['xg'] += 1
                obs.append((h, a, x, y, w, False))
                info['matches'] += 1
            od = fd_odds(r)
            if od:
                lh, la = fcst.market_lambdas(od, quick=True)
                obs.append((h, a, lh, la, fcst.W_MARKET * w, False))
                info['odds'] += 1
        time.sleep(0.3)
    # Kommende Spiele mit Quoten (gleiche Zuordnung je Liga)
    try:
        for r in fd_rows('/fixtures.csv'):
            m = maps.get(r.get('Div'))
            h, a = (m.get(r.get('HomeTeam')), m.get(r.get('AwayTeam'))) if m else (None, None)
            od = fd_odds(r) if h and a else None
            if od:
                lh, la = fcst.market_lambdas(od, quick=True)
                obs.append((h, a, lh, la, fcst.W_MARKET, False))
                info['fixtures'] += 1
    except Exception as e:
        log('  football-data Spielplan: %s' % e)
    info['leagues'] = len(ok)
    return {'obs': obs, 'leagues': ok, 'info': info}


def league_obs(tables, weight):
    """Je Team eine zusammengefasste Beobachtung 'Team gegen Liga-Durchschnitt' (virtuelles Team L:<liga>, neutral)."""
    return [(tid, 'L:' + lg, gf / gp, ga / gp, weight * gp, True)
            for lg, rows in tables.items() for tid, (gp, gf, ga) in rows.items()]


def compact(events):
    return [[e['date'], e['home']['id'], e['away']['id'], e['hs'], e['as'], int(bool(e.get('neutral')))] for e in events if e['done']]


def uncompact(rows):
    return [{'date': r[0], 'home': {'id': r[1]}, 'away': {'id': r[2]}, 'hs': r[3], 'as': r[4], 'neutral': bool(r[5]), 'done': True}
            for r in rows]


def build_model(state):
    """Spielstaerken aller Bundesliga- und CL-Teams. Wettquoten werden gesammelt - ESPN zeigt sie nur vor dem Spiel."""
    store = load('model.json', {}) or {}
    if store.get('season') != SEASON:
        store = {'season': SEASON, 'market': {}}  # neue Saison: Quoten-Archiv und Vorsaison neu anlegen
    events = {}
    for key, lg in FC_LEAGUES:
        try:
            events[key] = espn_season(lg, SEASON)
        except Exception as e:
            if key != 'dfb':
                raise
            events[key] = []
            log('  DFB-Pokal (ESPN): %s' % e)
    if not store.get('prev'):
        store['prev'] = {'bl': compact(espn_season('ger.1', SEASON - 1)), 'cl': compact(espn_season('uefa.champions', SEASON - 1)),
                         'at': iso(NOW)}
    market = store.get('market') or {}
    for key in ('bl', 'cl', 'dfb'):
        for e in events[key]:
            od = e.get('odds')
            if e['done'] or not od:
                continue
            k = [round(od['ph'], 4), round(od['pd'], 4), od.get('line'), round(od.get('pover') or 0, 4)]
            if (market.get(e['id']) or {}).get('k') == k:
                continue
            lh, la = fcst.market_lambdas(od)
            market[e['id']] = {'lh': round(lh, 3), 'la': round(la, 3), 'd': e['date'], 'h': e['home']['id'], 'a': e['away']['id'],
                               'c': key, 'k': k, 'at': iso(NOW)}
    valid = {e['id'] for evs in events.values() for e in evs}
    market = {k: v for k, v in market.items() if k in valid}
    ts = lambda x: (parse_dt(x) or NOW).timestamp()  # noqa: E731
    now_ts = NOW.timestamp()
    prev_bl, prev_cl = uncompact(store['prev'].get('bl') or []), uncompact(store['prev'].get('cl') or [])
    # 11 Ligen von football-data (Ergebnisse + xG + Quoten). Klappt die Bundesliga dort, ersetzt sie die ESPN-Bundesliga
    # im Modell (sonst zaehlten Spiele doppelt); ESPN-Quoten bleiben fuer die CL und fuer die Simulation.
    fd = football_data(now_ts)
    bl_fd = 'ger.1' in fd['leagues']
    obs = fcst.obs_from(([] if bl_fd else events['bl']) + events['cl'], now_ts, 1.0, ts) + fcst.obs_from(prev_bl + prev_cl, now_ts, fcst.W_PREV, ts)
    obs += fd['obs']
    for mk in market.values():
        if mk['c'] == 'cl' or (mk['c'] == 'bl' and not bl_fd):
            obs.append((mk['h'], mk['a'], mk['lh'], mk['la'], fcst.W_MARKET * fcst.decay((now_ts - ts(mk['d'])) / 86400.0), False))
    # Heimische Ligen + Europa/Conference League: laufende Saison voll, Vorsaison (einmal je Saison geholt) abgeschwaecht
    if not store['prev'].get('leagues'):
        store['prev']['leagues'] = domestic_tables(SEASON - 1)
    if 'eu' not in store['prev']:
        prev_eu = []
        for lg in EU_CUPS:
            try:
                prev_eu += compact(espn_season(lg, SEASON - 1))
            except Exception as e:
                log('  %s %d: %s' % (lg, SEASON - 1, e))
        if prev_eu:
            store['prev']['eu'] = prev_eu
    eu = []
    for lg in EU_CUPS:
        try:
            eu += espn_season(lg, SEASON)
        except Exception as e:
            log('  %s: %s' % (lg, e))
    obs += fcst.obs_from(eu, now_ts, 1.0, ts) + fcst.obs_from(uncompact(store['prev'].get('eu') or []), now_ts, fcst.W_PREV, ts)
    # laufende Tabellen nur fuer Ligen ohne football-data (dort gibt es jedes Spiel einzeln)
    obs += league_obs(domestic_tables(leagues=[lg for lg in DOMESTIC if lg not in fd['leagues']]), 1.0)
    obs += league_obs(store['prev']['leagues'], fcst.W_LEAGUE_PREV)
    seen_bl = {t for e in prev_bl for t in (e['home']['id'], e['away']['id'])}
    seen_cl = {t for e in prev_cl for t in (e['home']['id'], e['away']['id'])}
    prior = {}
    for e in events['bl']:
        for t in (e['home']['id'], e['away']['id']):
            if t not in seen_bl:
                prior[t] = (-0.15, -0.15)  # Aufsteiger
    for e in events['cl']:
        for t in (e['home']['id'], e['away']['id']):
            if t not in seen_cl and t not in seen_bl:
                prior[t] = (-0.1, -0.1)  # neu in der Champions League
    if len(obs) < 30:
        raise RuntimeError('zu wenige Spiele für das Modell (%d)' % len(obs))
    fit = fcst.fit_ratings(obs, prior)
    model = fcst.Model(fit, default=(-0.35, -0.35))  # unbekannt (z. B. Pokalgegner aus unteren Ligen) = deutlich schwaecher
    names = {}
    for evs in events.values():
        for e in evs:
            names[e['home']['id']] = e['home']['name']
            names[e['away']['id']] = e['away']['name']
    store.update({'market': market, 'updatedAt': iso(NOW), 'params': {'mu': round(fit['mu'], 4), 'h': round(fit['h'], 4), 'obs': len(obs)},
                  'fd': fd['info'],
                  'ratings': {t: [round(fit['att'][t], 3), round(fit['def'][t], 3), names.get(t, t)] for t in fit['att']}})
    save('model.json', store)
    fc = {'model': model, 'market': market, 'events': events, 'byId': {e['id']: e for evs in events.values() for e in evs},
          'fd': fd['info']}
    state['fc'] = fc
    return fc


def bvb_tie(cl_events, cl):
    """Aktuelles K.-o.-Duell des BVB: Gegner, Hin- und Rueckspiel, Chance aufs Weiterkommen."""
    me = next((t for t in cl['teams'] if t.get('isBVB')), None)
    for r in reversed(fcst.CL_ROUNDS):
        legs = sorted([e for e in cl_events if e['slug'] == r and ESPN_BVB in (e['home']['id'], e['away']['id'])],
                      key=lambda e: (e.get('leg') or 0, e['date'] or ''))
        if not legs:
            continue
        opp = legs[0]['away'] if legs[0]['home']['id'] == ESPN_BVB else legs[0]['home']
        return {'round': r, 'label': ROUND_DE[r], 'opp': {'name': cl_de(opp['name']), 'logo': opp.get('logo')},
                'legs': [{'date': e['date'], 'home': e['home']['id'] == ESPN_BVB, 'leg': e.get('leg'),
                          'score': ('%d:%d' % ((e['hs'], e['as']) if e['home']['id'] == ESPN_BVB else (e['as'], e['hs']))) if e['done'] else None}
                         for e in legs],
                'p': me.get(NEXT_KEY[r]) if me else None}
    return None


def cl_games(events, cl=None):
    """Alle CL-Spiele der Saison fuer die App: Ligaphase mit Spieltag (aus den Terminen), K.-o.-Runden mit Hin-/Rueckspiel,
    dazu je K.-o.-Duell die Chance aufs Weiterkommen aus der Prognose."""
    teams, games = {}, []
    lp_days, md, last = {}, 0, None
    for e in sorted((e for e in events if e['slug'] == 'league-phase'), key=lambda e: e['date'] or ''):
        d = parse_dt(e['date'])
        if d and (last is None or (d - last).days > 3):
            md += 1
        if d:
            last = d
        lp_days[e['id']] = md
    for e in sorted(events, key=lambda e: e['date'] or ''):
        for t in (e['home'], e['away']):
            short = t.get('short') or t['name']
            teams.setdefault(t['id'], {'name': cl_de(t['name']), 'short': CL_SHORT_DE.get(short, short), 'logo': t.get('logo')})
        games.append({'id': e['id'], 'date': e['date'], 'round': e['slug'] or 'league-phase', 'md': lp_days.get(e['id']),
                      'leg': e.get('leg'), 'state': e.get('state'), 'h': e['home']['id'], 'a': e['away']['id'],
                      'hs': e['hs'], 'as': e['as'], 'winner': e.get('winner')})
    adv = {}
    if cl:
        by = {t['espnId']: t for t in cl.get('teams') or []}
        for r in fcst.CL_ROUNDS:
            for ids in (cl.get('ties') or {}).get(r) or []:
                pair = {g['h'] for g in games if g['id'] in ids} | {g['a'] for g in games if g['id'] in ids}
                for t in pair:
                    if t in by:
                        adv.setdefault(r, {})[t] = by[t].get(NEXT_KEY[r])
    return {'season': SEASON, 'updatedAt': iso(NOW), 'teams': teams, 'games': games, 'advance': adv,
            'stage': (cl or {}).get('stage') or 'league'}


def build_forecasts(state):
    """Bundesliga- und CL-Prognose (15.000 Simulationen) + Zeiten, zu denen Spiele enden (fuer die Laeufe nach jedem Spiel)."""
    fc = build_model(state)
    model, market, ev = fc['model'], fc['market'], fc['events']
    tables = load('tables.json', {}) or {}
    out = {}
    bl = fcst.bl_forecast(ev['bl'], model, market, sims=15000)
    if bl:
        rows = (tables.get('bl1') or {}).get('rows') or []
        for t in bl['teams']:
            r = best_row(rows, ESPN_ALIAS.get(t['name'], t['name']))
            t['team'] = r['team'] if r else t['name']
            t['short'] = (r.get('short') if r else None) or t['team']
            t['icon'] = (r.get('icon') if r else None) or t.get('logo')
            t['id'] = r['id'] if r else 'espn-' + t['espnId']
            t['isBVB'] = t['espnId'] == ESPN_BVB
        out['bl'] = bl
    # Die naechsten BVB-Spiele (alle Wettbewerbe): Sieg/Remis/Niederlage laut Quoten bzw. Modell
    up = sorted([e for k in ('bl', 'cl', 'dfb') for e in ev[k] if not e['done'] and ESPN_BVB in (e['home']['id'], e['away']['id'])],
                key=lambda e: e['date'] or '')[:5]
    comp = {e['id']: k for k in ('bl', 'cl', 'dfb') for e in ev[k]}
    nl = []
    for e in up:
        lh, la = fcst.lam_for(e, model, market)
        w, d, l = fcst.outcome_probs(fcst.score_matrix(lh, la))
        home = e['home']['id'] == ESPN_BVB
        opp = e['away'] if home else e['home']
        nl.append({'id': e['id'], 'date': e['date'], 'comp': comp.get(e['id']), 'home': home,
                   'opp': cl_de(ESPN_ALIAS.get(opp['name'], opp['name'])), 'logo': opp.get('logo'),
                   'win': round(100 * (w if home else l), 1), 'draw': round(100 * d, 1), 'loss': round(100 * (l if home else w), 1),
                   'odds': e['id'] in market})
    out['next'] = nl
    ucl = (tables.get('ucl') or {}).get('rows') or []
    order = [str(r['id']).replace('espn-', '') for r in sorted(ucl, key=lambda r: r['pos'])] if ucl else None
    cl = fcst.cl_forecast(ev['cl'], model, market, official_order=order, sims=15000)
    if cl:
        cur = {str(r['id']).replace('espn-', ''): r['pos'] for r in ucl}
        for t in cl['teams']:
            t['team'] = cl_de(t['name'])
            t['icon'] = t.get('logo')
            t['pos'] = cur.get(t['espnId'])
            t['isBVB'] = t['espnId'] == ESPN_BVB
        cl['tie'] = bvb_tie(ev['cl'], cl)
        out['cl'] = cl
    try:
        save('cl.json', cl_games(ev['cl'], cl))
    except Exception as e:
        log('  cl.json: %s' % e)
    # DFB-Pokal: alle Runden bis zum Finale, nach jedem Pokalspiel neu
    dfb = fcst.dfb_forecast(ev.get('dfb') or [], model, market, sims=15000)
    if dfb:
        for t in dfb['teams']:
            t['team'] = cl_de(ESPN_ALIAS.get(t['name'], t['name']))
            t['icon'] = t.get('logo')
            t['isBVB'] = t['espnId'] == ESPN_BVB
        mine = [e for e in ev['dfb'] if e['slug'] == dfb['round'] and ESPN_BVB in (e['home']['id'], e['away']['id'])]
        if mine:
            e = mine[0]
            home = e['home']['id'] == ESPN_BVB
            opp = e['away'] if home else e['home']
            score = None
            if e['done']:
                score = '%d:%d' % ((e['hs'], e['as']) if home else (e['as'], e['hs']))
            dfb['tie'] = {'round': dfb['round'], 'label': DFB_DE.get(dfb['round'], dfb['round']), 'date': e['date'], 'home': home,
                          'opp': {'name': cl_de(ESPN_ALIAS.get(opp['name'], opp['name'])), 'logo': opp.get('logo')},
                          'score': score, 'won': (e.get('winner') == ESPN_BVB) if e['done'] else None}
        out['dfb'] = dfb
    ends = set()
    for key in ('bl', 'cl', 'dfb'):  # nach jedem Spiel in allen drei Wettbewerben rechnet ein kurzer Lauf neu
        for e in ev[key]:
            ko = parse_dt(e['date'])
            if ko and not e['done'] and NOW - timedelta(hours=4) < ko < NOW + timedelta(days=14):
                ends.add(iso(ko + timedelta(minutes=115)))
    out['ends'] = sorted(ends)[:150]
    fdi = fc.get('fd') or {}
    out['info'] = {'odds': len(market) + fdi.get('odds', 0) + fdi.get('fixtures', 0),
                   'oddsOpen': sum(1 for e in fc['byId'].values() if not e['done'] and e['id'] in market),
                   'home': round(model.h, 3), 'teams': len(model.att), 'sims': 15000,
                   'leagues': fdi.get('leagues', 0), 'matches': fdi.get('matches', 0), 'xg': fdi.get('xg', 0)}
    return out


def mod_season(state):
    """Fieberkurve (mit Vorsaison), Saison-Prognose, Liga-Torjaeger und Basis-Tabelle fuer die Live-Konferenz."""
    cur = oldb('/getmatchdata/bl1/%d' % SEASON)
    if not cur:
        raise RuntimeError('keine Bundesliga-Spiele')
    out = {'updatedAt': iso(NOW), 'season': SEASON}
    errors = []
    out['fever'] = {'cur': fever_curve(cur)}
    try:
        out['fever']['prev'] = fever_curve(oldb('/getmatchdata/bl1/%d' % (SEASON - 1)))
    except Exception as e:
        errors.append('Vorsaison: %s' % e)
    # Prognose: Spielstaerken aus Ergebnissen + Wettquoten (forecast.py); faellt ESPN aus, rechnet das einfache Modell
    try:
        fx = build_forecasts(state)
        out['forecast'] = fx.get('bl') or season_forecast(cur)
        if fx.get('cl'):
            out['cl'] = fx['cl']
        out['next'] = fx.get('next') or []
        if fx.get('dfb'):
            out['dfb'] = fx['dfb']
        out['nextEnds'] = fx['ends']
        out['model'] = fx['info']
    except Exception as e:
        traceback.print_exc()
        errors.append('Prognose-Modell: %s' % e)
        try:
            out['forecast'] = season_forecast(cur)
        except Exception as e2:
            errors.append('Prognose: %s' % e2)
    try:
        teams = scorer_teams(cur)
        sc = []
        for g in (oldb('/getgoalgetters/bl1/%d' % SEASON) or [])[:25]:
            t = teams.get(g.get('goalGetterId')) or {}
            sc.append({'name': g.get('goalGetterName'), 'goals': g.get('goalCount') or 0, 'team': t.get('teamName'),
                       'short': t.get('shortName'), 'icon': t.get('teamIconUrl'), 'isBVB': is_bvb(t.get('teamName') or '')})
        out['scorers'] = sc
    except Exception as e:
        errors.append('Torjäger: %s' % e)
    try:
        md = int((oldb('/getcurrentgroup/bl1') or {}).get('groupOrderID') or 0)
    except Exception:
        md = 0
    if not md:
        open_mds = [md_of(m) for m in cur if not m.get('matchIsFinished')]
        md = min(open_mds) if open_mds else max(md_of(m) for m in cur)
    out['konferenz'] = {'matchday': md, 'base': [{k: r[k] for k in ('id', 'team', 'short', 'icon', 'played', 'won', 'draw', 'lost', 'goals', 'against', 'points')}
                                                 for r in bl_standings(cur, before=md)]}
    prev = load('season.json', {}) or {}
    old_title = ((next((t for t in ((prev.get('forecast') or {}).get('teams') or []) if t.get('isBVB')), None)) or {}).get('title')
    new_t = next((t for t in ((out.get('forecast') or {}).get('teams') or []) if t.get('isBVB')), None)
    if new_t and old_title is not None and abs(new_t['title'] - old_title) >= 5:
        state['changes'].add('table', 'Meister-Chance BVB: %s %% → %s %%' % (str(old_title).replace('.', ','), str(new_t['title']).replace('.', ',')))
    save('season.json', out)
    return {'ok': True, 'count': len(out['fever']['cur']), 'warning': '; '.join(errors) or None}


# --------------------------------------------------------------------------- Spieltag-Zentrale
ESPN_LG = {'bl1': 'ger.1', 'ucl': 'uefa.champions', 'dfb': 'ger.dfb_pokal'}
GENERIC_TOKENS = {'fc', 'sc', 'sv', 'cf', 'ac', 'as', 'afc', 'club', 'de', 'the', '1', 'fk', 'sk', 'bk', 'if', 'ss',
                  'calcio', 'football', 'futbol', 'borussia', 'real', 'sporting', 'olympique', 'stade', 'ssc', 'vfb', 'vfl'}


def parse_dt(s):
    """ISO-Zeit von OpenLigaDB/ESPN (mit oder ohne Sekunden, mit Z) als aware datetime."""
    try:
        d = datetime.fromisoformat((s or '').replace('Z', '+00:00'))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def to_berlin(dt):
    """UTC -> deutsche Ortszeit (MEZ/MESZ-Regel wie berlin_to_utc, ohne zusaetzliche Pakete)."""
    u = dt.astimezone(timezone.utc).replace(tzinfo=None)

    def last_sunday(year, month):
        d = datetime(year, month + 1, 1) - timedelta(days=1)
        return d - timedelta(days=(d.weekday() + 1) % 7)
    start, end = last_sunday(u.year, 3).replace(hour=1), last_sunday(u.year, 10).replace(hour=1)
    return u + timedelta(hours=2 if start <= u < end else 1)


def name_tokens(name):
    return {t for t in slug(name).split('-') if t and t not in GENERIC_TOKENS and len(t) > 1}


def best_row(rows, name):
    """Tabellenzeile zu einem Vereinsnamen aus einer anderen Quelle (gemeinsame Namensteile)."""
    want = name_tokens(name)
    scored = sorted(((len(want & name_tokens(r.get('team') or '')), r) for r in rows), key=lambda x: -x[0])
    if scored and scored[0][0] and (len(scored) == 1 or scored[0][0] > scored[1][0]):
        return scored[0][1]
    return None


def squad_matcher(players):
    """Spielername (ESPN) -> Spieler-ID im App-Kader: exakter Name, eindeutiger Nachname oder Rueckennummer."""
    by_slug = {slug(p['name']): p for p in players}

    def match(name, jersey=None):
        s = slug(name or '')
        if s in by_slug:
            return by_slug[s]['id']
        last = s.split('-')[-1] if s else ''
        cands = [p for p in players if last and slug(p['name']).split('-')[-1] == last]
        if len(cands) == 1:
            return cands[0]['id']
        if jersey:
            cands = [p for p in (cands or players) if str(p.get('number') or '') == str(jersey)]
            if len(cands) == 1:
                return cands[0]['id']
        return None
    return match


def espn_events():
    """Alle BVB-Spiele bei ESPN (gespielt und kommend): [(liga, event-id, datetime)]."""
    out = []
    for lg in sorted(set(ESPN_LG.values())):
        for q in ('', '?fixture=true'):
            try:
                d = http_json('%s/%s/teams/%d/schedule%s' % (ESPN, lg, ESPN_TEAM, q), timeout=30)
            except Exception as e:
                log('  ESPN-Spielplan %s: %s' % (lg, e))
                continue
            for e in d.get('events') or []:
                dt = parse_dt(e.get('date'))
                if dt and e.get('id'):
                    out.append((lg, str(e['id']), dt))
    return out


def espn_form(team):
    """Letzte 5 Pflichtspiele aus ESPN 'lastFiveGames' aus Sicht des Teams."""
    out = []
    evs = [e for e in team.get('events') or [] if 'friendly' not in (e.get('leagueName') or '').lower()]
    for e in sorted(evs, key=lambda e: e.get('gameDate') or '')[-5:]:
        away = e.get('atVs') == '@'
        try:
            mine, other = int(e.get('awayTeamScore' if away else 'homeTeamScore')), int(e.get('homeTeamScore' if away else 'awayTeamScore'))
        except (TypeError, ValueError):
            continue
        r = 'W' if mine > other else 'L' if mine < other else 'D'
        out.append({'r': r, 'score': '%d:%d' % (mine, other), 'opp': (e.get('opponent') or {}).get('displayName'),
                    'home': not away, 'date': (e.get('gameDate') or '')[:10], 'comp': e.get('leagueAbbreviation')})
    return out


def game_from_summary(d, match_player):
    """Spieler- und Teamwerte des BVB aus einem fertigen ESPN-Spiel (Minuten aus Wechseln/Platzverweisen)."""
    comp = ((d.get('header') or {}).get('competitions') or [{}])[0]
    stype = ((comp.get('status') or {}).get('type') or {})
    if not stype.get('completed'):
        return None
    total = 120 if re.search(r'AET|PEN|EXTRA', stype.get('name') or '', re.I) else 90
    sub_in, sub_out, red = {}, {}, {}
    for ev in d.get('keyEvents') or []:
        t = ((ev.get('type') or {}).get('text') or '').lower()
        m = re.match(r'(\d+)', ((ev.get('clock') or {}).get('displayValue') or ''))
        if not m:
            continue
        mn = min(int(m.group(1)), total)
        ids = [str((p.get('athlete') or {}).get('id')) for p in ev.get('participants') or []]
        if 'substitution' in t and len(ids) >= 2:
            sub_in[ids[0]], sub_out[ids[1]] = mn, mn
        elif 'red card' in t and ids:
            red[ids[0]] = mn
    players = {}
    for r in d.get('rosters') or []:
        if str((r.get('team') or {}).get('id')) != str(ESPN_TEAM):
            continue
        for a in r.get('roster') or []:
            ath = a.get('athlete') or {}
            st = {s.get('name'): s.get('value') or 0 for s in a.get('stats') or []}
            if not int(st.get('appearances') or 0):
                continue
            aid = str(ath.get('id'))
            on = 0 if a.get('starter') else sub_in.get(aid)
            off = min(sub_out.get(aid, total), red.get(aid, total))
            pid = match_player(ath.get('displayName') or ath.get('fullName'), a.get('jersey'))
            if not pid:
                continue
            players[pid] = {'min': max(1, off - on) if on is not None else None, 'g': int(st.get('totalGoals') or 0),
                            'a': int(st.get('goalAssists') or 0), 'y': int(st.get('yellowCards') or 0),
                            'r': int(st.get('redCards') or 0), 's': bool(a.get('starter')),
                            'sh': int(st.get('totalShots') or 0), 'sv': int(st.get('saves') or 0)}
    teams = {}
    for t in (d.get('boxscore') or {}).get('teams') or []:
        key = 'bvb' if str((t.get('team') or {}).get('id')) == str(ESPN_TEAM) else 'opp'
        s = {x.get('name'): x.get('displayValue') for x in t.get('statistics') or []}
        teams[key] = {k: s.get(k) for k in ('possessionPct', 'totalShots', 'shotsOnTarget', 'wonCorners', 'foulsCommitted',
                                           'yellowCards', 'redCards', 'accuratePasses', 'totalPasses', 'saves', 'offsides')}
    gi = d.get('gameInfo') or {}
    return {'players': players, 'teams': teams, 'venue': (gi.get('venue') or {}).get('fullName'),
            'attendance': gi.get('attendance') or None}


def gnews(q, days=3, lang='de'):
    """Eine Google-News-Suche (fuer Vor- und Spielberichte)."""
    params = {'q': '%s when:%dd' % (q, days), 'hl': 'de' if lang == 'de' else 'en-US', 'gl': 'DE' if lang == 'de' else 'US',
              'ceid': 'DE:de' if lang == 'de' else 'US:en'}
    out = []
    try:
        root = ET.fromstring(http_get('https://news.google.com/rss/search?' + urllib.parse.urlencode(params), retries=1))
    except Exception as e:
        log('  News "%s": %s' % (q, e))
        return out
    for it in root.iter('item'):
        title = (it.findtext('title') or '').strip()
        src = it.find('source')
        outlet = (src.text or '').strip() if src is not None else ''
        if outlet and title.endswith(' - ' + outlet):
            title = title[:-(len(outlet) + 3)].strip()
        try:
            dt = email.utils.parsedate_to_datetime(it.findtext('pubDate'))
        except Exception:
            dt = NOW
        out.append({'title': title, 'outlet': outlet, 'date': iso(dt)})
    out.sort(key=lambda h: h['date'], reverse=True)
    return out


def match_word(opp):
    """Kurzer Suchbegriff fuer den Gegner (z. B. 'Frankfurt')."""
    toks = [t for t in re.split(r'[\s.]+', opp.get('short') or opp.get('name') or '') if len(t) > 2 and slug(t) not in GENERIC_TOKENS]
    return toks[-1] if toks else (opp.get('short') or opp.get('name') or '')


def absences_text(squads, news):
    out = []
    pro = ((squads.get('teams') or {}).get('profis') or {}).get('players') or []
    inj = {slug(i['player']): i for i in (news.get('injuryNews') or [])}
    for p in pro:
        n = inj.get(slug(p['name']))
        if n and n.get('status') in ('fit', 'back'):
            continue
        texts = [a['text'] for a in p.get('absences') or [] if a.get('type') != 'ineligible']
        if n and n.get('status') in ('injured', 'doubtful', 'suspended'):
            texts.append('%s (%s, laut %s)' % (INJ_LABEL.get(n['status'], ''), n.get('text') or '', n.get('source') or '?'))
        if texts:
            out.append('%s: %s' % (p['name'], '; '.join(texts)))
    return out


def form_line(form):
    return ', '.join('%s %s %s' % ({'W': 'S', 'D': 'U', 'L': 'N'}[f['r']], f['score'], f.get('opp') or '') for f in form) or 'k. A.'


def model_tip(state, e):
    """KI-Tipp aus dem Prognose-Modell: das Ergebnis mit den meisten erwarteten Tipp-Punkten (aus Wettquoten, sonst aus Spielstaerken)."""
    fc = state.get('fc')
    ev = fc['byId'].get(str((e.get('espn') or {}).get('id'))) if fc else None
    if not ev:
        return None
    mk = fc['market'].get(ev['id'])
    lh, la = (mk['lh'], mk['la']) if mk else fc['model'].lam(ev['home']['id'], ev['away']['id'], ev.get('neutral'))
    t = fcst.best_tip(lh, la)
    home = ev['home']['id'] == ESPN_BVB
    w, l = (t['pw'], t['pl']) if home else (t['pl'], t['pw'])
    return {'tip': {'bvb': t['home'], 'opp': t['away']} if home else {'bvb': t['away'], 'opp': t['home']},
            'probs': {'w': round(w * 100, 1), 'd': round(t['pd'] * 100, 1), 'l': round(l * 100, 1)},
            'goals': [round(lh if home else la, 2), round(la if home else lh, 2)], 'exp': t['exp'],
            'src': 'quoten' if mk else 'modell', 'at': iso(NOW)}


def mc_gemini(state, prompt):
    key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not ai_available():
        raise RuntimeError('Kein KI-Schlüssel gesetzt (GEMINI_API_KEY oder eine Ersatz-KI)')
    models = state.get('gemini_models') or (gemini_models(key) if key else [])
    state['gemini_models'] = models
    data, model, _ = gemini_call(key, models, prompt, False, state.setdefault('mc_attempts', []))
    return data, model


def make_preview(state, m, entry, squads, news):
    opp = m['away'] if m['isHome'] else m['home']
    o = entry.get('opponent') or {}
    mt = entry.get('model')
    heads = gnews('BVB %s' % match_word(opp), days=4)[:25]
    ko = parse_dt(m['date'])
    model_line = ('PROGNOSE-MODELL (aus %s): Sieg BVB %s %%, Remis %s %%, Niederlage %s %%, KI-Tipp %d:%d (BVB:Gegner).\n' % (
        'Wettquoten' if mt['src'] == 'quoten' else 'Spielstärken', mt['probs']['w'], mt['probs']['d'], mt['probs']['l'],
        mt['tip']['bvb'], mt['tip']['opp'])) if mt else ''
    prompt = (
        'Du schreibst den Vorbericht für eine Borussia-Dortmund-Fan-App. Heute ist %s.\n'
        'SPIEL: %s – %s, %s%s, Anstoß %s Uhr (deutsche Zeit), BVB spielt %s.\n'
        'BVB-FORM: %s\nGEGNER-FORM: %s\nTABELLE: BVB %s, Gegner %s\nDIREKTER VERGLEICH (aus BVB-Sicht): %s\n'
        'BVB-AUSFÄLLE: %s\n%s\nSCHLAGZEILEN ZUM SPIEL (neueste zuerst):\n%s\n\n'
        'AUFGABE: Antworte NUR mit JSON: {"text":"4-5 sachliche Sätze auf Deutsch","keyPoints":["kurzer Fakt","kurzer Fakt",'
        '"kurzer Fakt"],"tip":{"bvb":2,"opp":1},"tipReason":"ein kurzer Satz"}\n'
        'Regeln: Nur Fakten aus den Angaben oben, nichts erfinden, keine Aufstellung erfinden. '
        'Was du nicht sicher weißt, lässt du weg. %s'
        % (TODAY, m['home']['name'], m['away']['name'], m.get('comp') or '', (' · ' + m['round']) if m.get('round') else '',
           to_berlin(ko).strftime('%d.%m. %H:%M') if ko else 'k. A.', 'zu Hause' if m['isHome'] else 'auswärts',
           form_line(o.get('bvbForm') or []), form_line(o.get('form') or []),
           ('Platz %s (%s Pkt.)' % (o['bvbTable']['pos'], o['bvbTable']['points'])) if o.get('bvbTable') else 'k. A.',
           ('Platz %s (%s Pkt.)' % (o['table']['pos'], o['table']['points'])) if o.get('table') else 'k. A.',
           ('%d Siege, %d Remis, %d Niederlagen' % (o['h2h']['w'], o['h2h']['d'], o['h2h']['l'])) if o.get('h2h') else 'k. A.',
           '; '.join(absences_text(squads, news)) or 'keine bekannt', model_line,
           '\n'.join('- %s | %s | %s' % (h['date'][:10], h['outlet'], h['title']) for h in heads) or 'keine',
           'tip = genau der KI-Tipp des Prognose-Modells oben; tipReason begründet ihn kurz mit den Zahlen.' if mt else
           'tip = deine realistische Ergebnis-Prognose (Tore BVB, Tore Gegner).'))
    data, model = mc_gemini(state, prompt)
    text = (data.get('text') or '').strip()
    if not text:
        raise RuntimeError('Gemini lieferte keinen Vorbericht')
    tip = data.get('tip') or {}
    try:
        tip = {'bvb': int(tip.get('bvb')), 'opp': int(tip.get('opp'))}
        if not (0 <= tip['bvb'] <= 9 and 0 <= tip['opp'] <= 9):
            tip = None
    except (TypeError, ValueError, AttributeError):
        tip = None
    if mt:
        tip = dict(mt['tip'])  # der Tipp kommt immer aus dem Modell - die KI schreibt nur den Text
    return {'text': text[:1200], 'keyPoints': [str(k).strip()[:140] for k in (data.get('keyPoints') or []) if str(k).strip()][:4],
            'tip': tip, 'tipReason': (data.get('tipReason') or '').strip()[:200] or None, 'at': iso(NOW), 'model': model}


def make_report(state, m, entry, squads):
    opp = m['away'] if m['isHome'] else m['home']
    game = entry.get('game') or {}
    pro = ((squads.get('teams') or {}).get('profis') or {}).get('players') or []
    names = {p['id']: p['name'] for p in pro}
    pl = sorted(((names.get(pid), v) for pid, v in (game.get('players') or {}).items() if names.get(pid)),
                key=lambda x: (-(x[1]['g'] * 3 + x[1]['a'] * 2), -(x[1]['min'] or 0)))
    goals = ', '.join('%s\' %s%s%s (%s)' % (g.get('minute') or '?', g.get('scorer') or '?', ' (E)' if g.get('penalty') else '',
                                              ' (ET)' if g.get('ownGoal') else '', g.get('score')) for g in m.get('goals') or [])
    tb, to = (game.get('teams') or {}).get('bvb') or {}, (game.get('teams') or {}).get('opp') or {}
    stats = ('Ballbesitz %s%% : %s%%, Schüsse %s : %s, aufs Tor %s : %s, Ecken %s : %s' % (
        tb.get('possessionPct'), to.get('possessionPct'), tb.get('totalShots'), to.get('totalShots'),
        tb.get('shotsOnTarget'), to.get('shotsOnTarget'), tb.get('wonCorners'), to.get('wonCorners'))) if tb else 'k. A.'
    heads = [h for h in gnews('BVB %s' % match_word(opp), days=2) if h['date'] >= m['date']][:25]
    prompt = (
        'Du schreibst den Spielbericht für eine Borussia-Dortmund-Fan-App.\n'
        'SPIEL: %s %s:%s %s (%s%s), Halbzeit %s.\nTORE: %s\nSTATISTIK (BVB : Gegner): %s\n'
        'BVB-SPIELER (Tore/Vorlagen/Minuten): %s\n\nSCHLAGZEILEN NACH DEM SPIEL:\n%s\n\n'
        'AUFGABE: Antworte NUR mit JSON: {"text":"4-6 sachliche Sätze auf Deutsch","highlights":["kurzer Satz","kurzer Satz"],'
        '"motm":"Vorname Nachname oder null"}\n'
        'Regeln: Nur Fakten aus den Angaben oben, nichts erfinden. motm = Spieler des Spiels beim BVB, nur wenn die '
        'Schlagzeilen ihn hervorheben oder er klar durch Tore/Vorlagen herausragt, sonst null.'
        % (m['home']['name'], m['score'][0], m['score'][1], m['away']['name'], m.get('comp') or '',
           (' · ' + m['round']) if m.get('round') else '', ('%s:%s' % tuple(m['half'])) if m.get('half') else 'k. A.',
           goals or 'keine', stats,
           '; '.join('%s %d/%d/%s' % (n, v['g'], v['a'], v['min'] if v['min'] is not None else '?') for n, v in pl[:14]) or 'k. A.',
           '\n'.join('- %s | %s' % (h['outlet'], h['title']) for h in heads) or 'keine'))
    data, model = mc_gemini(state, prompt)
    text = (data.get('text') or '').strip()
    if not text:
        raise RuntimeError('Gemini lieferte keinen Spielbericht')
    motm = None
    if data.get('motm'):
        pid = squad_matcher(pro)(str(data['motm']))
        motm = {'id': pid, 'name': names[pid]} if pid else None
    return {'text': text[:1400], 'highlights': [str(h).strip()[:160] for h in (data.get('highlights') or []) if str(h).strip()][:4],
            'motm': motm, 'at': iso(NOW), 'model': model, 'headlines': len(heads)}


def make_month(state, ym, games, squads):
    lines = []
    for m in games:
        lines.append('%s %s %s:%s %s (%s), Torschützen BVB: %s' % (
            m['date'][:10], m['home']['name'], m['score'][0], m['score'][1], m['away']['name'], m.get('comp') or '',
            ', '.join(g.get('scorer') or '?' for g in m.get('goals') or [] if g['team'] == ('home' if m['isHome'] else 'away') and not g.get('ownGoal')) or '-'))
    prompt = ('Fasse den Monat %s von Borussia Dortmund für eine Fan-App zusammen: 2-3 sachliche Sätze auf Deutsch, '
              'nur aus diesen Ergebnissen, nichts erfinden.\n%s\nAntworte NUR mit JSON: {"text":"..."}' % (ym, '\n'.join(lines)))
    data, model = mc_gemini(state, prompt)
    text = (data.get('text') or '').strip()
    return {'text': text[:600], 'at': iso(NOW)} if text else None


BVB_YT = 'UCK8rTVgp3-MebXkmeJcQb1Q'  # offizieller BVB-Kanal: Highlights (v. a. Champions League) und Pressekonferenzen
SIP = {'lat': 51.4926, 'lon': 7.4519, 'place': 'Signal Iduna Park'}
NOMINATIM_UA = 'bvb09-fanapp/1.0 (github.com/sneaxx141108-gif/bvb09)'


def yt_videos(channel):
    """Neueste Videos eines YouTube-Kanals ueber den oeffentlichen RSS-Feed (ohne Schluessel)."""
    out = []
    try:
        root = ET.fromstring(http_get('https://www.youtube.com/feeds/videos.xml?channel_id=' + channel, retries=1))
    except Exception as e:
        log('  YouTube: %s' % e)
        return out
    ns = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015'}
    for en in root.findall('a:entry', ns):
        vid = en.findtext('yt:videoId', namespaces=ns)
        if vid:
            out.append({'id': vid, 'title': (en.findtext('a:title', namespaces=ns) or '').strip(), 'published': en.findtext('a:published', namespaces=ns) or ''})
    return out


def opp_hit(title, opp):
    words = slug(title).split('-')
    return any(t in words for t in name_tokens(opp.get('name') or '') | name_tokens(opp.get('short') or ''))


def geocode(queries):
    """Koordinaten zu Stadion oder Stadt: OpenStreetMap (Nominatim), sonst Open-Meteo."""
    for q in [x for x in queries if x]:
        try:
            r = http_json('https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'q': q, 'format': 'json', 'limit': 1}),
                          headers={'User-Agent': NOMINATIM_UA}, timeout=20)
            time.sleep(1.1)  # Nutzungsregel: hoechstens 1 Anfrage pro Sekunde
            if r:
                return {'lat': round(float(r[0]['lat']), 4), 'lon': round(float(r[0]['lon']), 4), 'place': q.split(',')[0]}
        except Exception:
            pass
        try:
            r = http_json('https://geocoding-api.open-meteo.com/v1/search?' + urllib.parse.urlencode({'name': q.split(',')[0], 'count': 1, 'language': 'de', 'format': 'json'}), timeout=20)
            hit = (r.get('results') or [None])[0]
            if hit:
                return {'lat': round(hit['latitude'], 4), 'lon': round(hit['longitude'], 4), 'place': hit.get('name') or q}
        except Exception:
            pass
    return None


def venue_for(m, venues):
    """Spielort: Heimspiele im Signal Iduna Park, auswaerts das Stadion des Gegners (einmal gesucht, dann gemerkt)."""
    if m.get('isHome'):
        return SIP
    opp = m['home']
    key = opp.get('id') or slug(opp.get('name') or '')
    v = venues.get(key)
    if v and (v.get('lat') or (v.get('miss') or '') > (NOW - timedelta(days=7)).strftime('%Y-%m-%d')):
        return v if v.get('lat') else None
    queries = []
    try:
        t = ((tsdb('/searchteams.php?t=' + urllib.parse.quote(opp.get('name') or '')) or {}).get('teams') or [None])[0] or {}
        loc = [x.strip() for x in (t.get('strStadiumLocation') or t.get('strLocation') or '').split(',') if x.strip()]
        if t.get('strStadium'):
            queries.append(', '.join([t['strStadium']] + loc[-2:]))
        queries += [', '.join(loc[i:]) for i in range(len(loc))]
    except Exception as e:
        log('  Stadion %s: %s' % (opp.get('name'), e))
    queries.append(match_word(opp))
    v = geocode(queries)
    venues[key] = v or {'miss': TODAY}
    return v


def weather_at(v, ko):
    """Wettervorhersage zur Anstosszeit (Open-Meteo, kostenlos, ohne Schluessel)."""
    url = 'https://api.open-meteo.com/v1/forecast?' + urllib.parse.urlencode({
        'latitude': v['lat'], 'longitude': v['lon'], 'hourly': 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m',
        'timezone': 'UTC', 'forecast_days': 16})
    try:
        d = http_json(url, timeout=30)
    except Exception:
        time.sleep(3)
        d = http_json(url, timeout=30)
    h = d.get('hourly') or {}
    hour = (ko + timedelta(minutes=30)).replace(minute=0, second=0, microsecond=0)
    key = hour.strftime('%Y-%m-%dT%H:00')
    times = h.get('time') or []
    if key not in times:
        return None
    i = times.index(key)
    val = lambda k: (h.get(k) or [None] * len(times))[i]  # noqa: E731
    return {'temp': val('temperature_2m'), 'rain': val('precipitation_probability'), 'code': val('weather_code'),
            'wind': val('wind_speed_10m'), 'place': v.get('place'), 'at': iso(NOW)}


def mod_matchcenter(state):
    """Spieltag-Zentrale: ESPN-Zuordnung, Gegner-Check, Spielerwerte je Spiel, KI-Vorbericht, KI-Spielbericht, Monatsfazit."""
    prev = load('matchcenter.json', {}) or {}
    mc = prev.get('matches') or {}
    months = {k: v for k, v in (prev.get('months') or {}).items() if k >= '%d-07' % SEASON}  # neue Saison: Monats-Rueckblicke neu
    ms = (load('matches.json', {}) or {}).get('profis') or []
    squads = load('squads.json', {}) or {}
    news = load('news.json', {}) or {}
    tables = load('tables.json', {}) or {}
    pro = ((squads.get('teams') or {}).get('profis') or {}).get('players') or []
    if not ms:
        raise RuntimeError('keine Spiele')
    errors, made = [], []
    venues = prev.get('venues') or {}
    videos = yt_videos(BVB_YT)
    events = espn_events()
    match_player = squad_matcher(pro)
    nxt = next((m for m in ms if not m.get('finished') and parse_dt(m['date']) and parse_dt(m['date']) > NOW - timedelta(hours=3)), None)
    last_fin = [m for m in ms if m.get('finished') and m.get('score')]
    last = last_fin[-1] if last_fin else None
    for m in ms:
        e = mc.setdefault(m['id'], {})
        ko = parse_dt(m['date'])
        if not ko:
            continue
        lg = ESPN_LG.get(m.get('compShort'))
        if lg and not e.get('espn'):
            cands = sorted((abs((dt - ko).total_seconds()), eid) for l2, eid, dt in events if l2 == lg)
            if cands and cands[0][0] <= 6 * 3600:
                e['espn'] = {'lg': lg, 'id': cands[0][1]}
        upcoming = not m.get('finished') and ko - NOW < timedelta(days=14)
        # Gegner-Check fuer kommende Spiele (bis zum Anpfiff aktualisieren)
        if upcoming and ko > NOW:
            opp, bvb = (m['away'], m['home']) if m['isHome'] else (m['home'], m['away'])
            o = dict(e.get('opponent') or {})
            key = 'ucl' if m.get('compShort') == 'ucl' else 'bl1' if m.get('compShort') == 'bl1' else None
            rows = (tables.get(key) or {}).get('rows') or [] if key else []
            if rows:
                row = next((r for r in rows if r.get('id') == opp.get('id')), None) or best_row(rows, opp.get('name') or '')
                me = next((r for r in rows if r.get('isBVB')), None)
                o['table'] = {k: row.get(k) for k in ('pos', 'points', 'played', 'diff')} if row else None
                o['bvbTable'] = {k: me.get(k) for k in ('pos', 'points', 'played', 'diff')} if me else None
                o['tableName'] = (tables.get(key) or {}).get('name')
            try:
                h2h = oldb('/getmatchdata/%s/%s' % (bvb.get('id') or 7, opp.get('id'))) if opp.get('id') else []
                games = []
                for g in sorted(h2h, key=lambda g: g.get('matchDateTimeUTC') or ''):
                    if not g.get('matchIsFinished'):
                        continue
                    fr = next((r for r in g.get('matchResults') or [] if r.get('resultTypeID') == 2), None)
                    if not fr:
                        continue
                    home_bvb = is_bvb(g['team1']['teamName'])
                    mine, other = (fr['pointsTeam1'], fr['pointsTeam2']) if home_bvb else (fr['pointsTeam2'], fr['pointsTeam1'])
                    games.append({'date': (g.get('matchDateTimeUTC') or '')[:10], 'comp': g.get('leagueName'),
                                  'home': home_bvb, 'score': '%d:%d' % (fr['pointsTeam1'], fr['pointsTeam2']),
                                  'r': 'W' if mine > other else 'L' if mine < other else 'D'})
                o['h2h'] = {'w': sum(1 for g in games if g['r'] == 'W'), 'd': sum(1 for g in games if g['r'] == 'D'),
                            'l': sum(1 for g in games if g['r'] == 'L'), 'last': games[-5:][::-1]}
            except Exception as ex:
                errors.append('Vergleich %s: %s' % (opp.get('name'), ex))
            if e.get('espn') and (m is nxt or ko - NOW < timedelta(days=4)):
                try:
                    d = http_json('%s/%s/summary?event=%s' % (ESPN, e['espn']['lg'], e['espn']['id']), timeout=40)
                    for t in d.get('lastFiveGames') or []:
                        f = espn_form(t)
                        if str((t.get('team') or {}).get('id')) == str(ESPN_TEAM):
                            o['bvbForm'] = f
                        else:
                            o['form'] = f
                    venue = ((d.get('gameInfo') or {}).get('venue') or {}).get('fullName')
                    if venue:
                        e['venue'] = venue
                except Exception as ex:
                    errors.append('ESPN-Vorschau: %s' % ex)
            o['at'] = iso(NOW)
            e['opponent'] = o
            # KI-Tipp aus dem Modell - bis zum Anpfiff bei jedem Lauf neu (neue Quoten, neue Ergebnisse), danach eingefroren
            mt = model_tip(state, e)
            if mt:
                e['model'] = mt
        # Wetter zum Anpfiff (bis 10 Tage vorher)
        if not m.get('finished') and NOW < ko < NOW + timedelta(days=10):
            try:
                v = venue_for(m, venues)
                w = weather_at(v, ko) if v else None
                if w:
                    e['weather'] = w
            except Exception as ex:
                errors.append('Wetter: %s' % ex)
        # Videos vom offiziellen BVB-Kanal: Pressekonferenz vor/nach dem Spiel, Highlights nach dem Spiel
        opp_t = m['away'] if m['isHome'] else m['home']
        for vd in videos:
            pub = parse_dt(vd['published'])
            if not pub or not (ko - timedelta(days=3) < pub < ko + timedelta(days=4)) or not opp_hit(vd['title'], opp_t):
                continue
            item = {'id': vd['id'], 'title': vd['title'][:140], 'published': vd['published']}
            if re.search(r'highlight', vd['title'], re.I) and pub > ko:
                e['video'] = item
            elif re.search(r'(^|\W)PK(\W|$)|pressekonferenz|press conference', vd['title'], re.I):
                e['pkAfter' if pub > ko else 'pk'] = item
        # Spielerwerte je Spiel (fuer Formkurve und Spielbericht) - fertige Spiele einmal abholen
        if m.get('finished') and e.get('espn') and not (e.get('game') or {}).get('players'):
            try:
                d = http_json('%s/%s/summary?event=%s' % (ESPN, e['espn']['lg'], e['espn']['id']), timeout=40)
                g = game_from_summary(d, match_player)
                if g:
                    e['game'] = g
                time.sleep(0.4)
            except Exception as ex:
                errors.append('ESPN-Spiel %s: %s' % (m['id'], ex))
    # KI-Vorbericht fuer das naechste Spiel (ab 48 Std. vorher, am Spieltag einmal auffrischen)
    if nxt:
        e = mc[nxt['id']]
        ko = parse_dt(nxt['date'])
        pv = e.get('preview') or {}
        age = NOW - (parse_dt(pv.get('at')) or NOW - timedelta(days=9))
        if NOW < ko and ko - NOW < timedelta(hours=48) and (not pv or (ko - NOW < timedelta(hours=10) and age > timedelta(hours=10))):
            try:
                e['preview'] = make_preview(state, nxt, e, squads, news)
                made.append('Vorbericht')
                state['changes'].add('matches', 'KI-Vorbericht: %s – %s' % (nxt['home']['short'] or nxt['home']['name'], nxt['away']['short'] or nxt['away']['name']))
            except Exception as ex:
                errors.append('Vorbericht: %s' % ex)
    # KI-Spielbericht fuer das letzte Spiel (einmal sofort, ein zweites Mal mit mehr Schlagzeilen)
    if last and NOW - parse_dt(last['date']) < timedelta(days=7):
        e = mc[last['id']]
        rp = e.get('report') or {}
        ko = parse_dt(last['date'])
        redo = rp and rp.get('v', 1) < 2 and parse_dt(rp.get('at')) and parse_dt(rp['at']) - ko < timedelta(hours=5) and NOW - ko > timedelta(hours=7)
        if not rp or redo:
            try:
                r = make_report(state, last, e, squads)
                r['v'] = rp.get('v', 0) + 1
                e['report'] = r
                made.append('Spielbericht')
                if not rp:
                    state['changes'].add('matches', 'KI-Spielbericht: %s %s:%s %s' % (
                        last['home']['short'] or last['home']['name'], last['score'][0], last['score'][1], last['away']['short'] or last['away']['name']))
            except Exception as ex:
                errors.append('Spielbericht: %s' % ex)
    # Monatsfazit fuer den vergangenen Monat
    ym_prev = (NOW.replace(day=1) - timedelta(days=1)).strftime('%Y-%m')
    games = [m for m in last_fin if m['date'][:7] == ym_prev]
    if games and ym_prev not in months:
        try:
            r = make_month(state, ym_prev, games, squads)
            if r:
                months[ym_prev] = r
                made.append('Monatsfazit')
        except Exception as ex:
            errors.append('Monatsfazit: %s' % ex)
    keep = {m['id'] for m in ms}
    out = {'updatedAt': iso(NOW), 'season': SEASON, 'matches': {k: v for k, v in mc.items() if k in keep and v},
           'months': months, 'venues': venues, 'attempts': (state.get('mc_attempts') or [])[-6:]}
    save('matchcenter.json', out)
    return {'ok': True, 'count': len(out['matches']), 'made': made, 'warning': '; '.join(errors)[:300] or None}


# --------------------------------------------------------------------------- News + Gemini
NEWS_QUERIES = [
    ('BVB Transfer', 'de'), ('Borussia Dortmund Transfer', 'de'), ('BVB Wechsel', 'de'),
    ('BVB Sky Plettenberg', 'de'), ('BVB Vertrag', 'de'), ('BVB kicker Transfer', 'de'),
    ('BVB Verletzung', 'de'), ('BVB Training Rückkehr', 'de'), ('Borussia Dortmund', 'de'),
    ('Borussia Dortmund transfer', 'en'), ('Dortmund Fabrizio Romano', 'en'),
    ('Dortmund "here we go"', 'en'), ('BVB Vertragsverlängerung', 'de'),
    ('BVB Gerücht', 'de'), ('BVB Interesse', 'de'), ('BVB Angebot', 'de'), ('BVB verlängert', 'de'),
    ('BVB Neuzugang', 'de'), ('BVB Abgang', 'de'), ('Dortmund linked', 'en'), ('Dortmund contract extension', 'en'),
]


def source_tier(src):
    """Stufe 1/2 nur fuer Quellen von unserer Liste - alles andere fliegt raus (Gemini wird nicht blind vertraut)."""
    s = (src or '').lower()
    for tier, names in ((1, TIER1), (2, TIER2)):
        for name in names:
            if re.search(r'(?<![a-z])' + re.escape(name.lower()) + r'(?![a-z])', s):
                return tier
    return None


def outlet_tier(outlet):
    o = (outlet or '').lower().strip()
    for k, v in HEADLINE_OUTLETS.items():
        if o == k or o.startswith(k):
            return v
    return None


def fetch_news():
    seen, items = set(), []
    cutoff = NOW - timedelta(days=10)
    for q, lang in NEWS_QUERIES:
        params = {'q': q + ' when:7d', 'hl': 'de' if lang == 'de' else 'en-US',
                  'gl': 'DE' if lang == 'de' else 'US', 'ceid': 'DE:de' if lang == 'de' else 'US:en'}
        url = 'https://news.google.com/rss/search?' + urllib.parse.urlencode(params)
        try:
            root = ET.fromstring(http_get(url, retries=1))
        except Exception as e:
            log('  News "%s": %s' % (q, e))
            continue
        for it in root.iter('item'):
            title = (it.findtext('title') or '').strip()
            src = it.find('source')
            outlet = (src.text or '').strip() if src is not None else ''
            if outlet and title.endswith(' - ' + outlet):
                title = title[:-(len(outlet) + 3)].strip()
            key = slug(title)[:90]
            if not title or key in seen:
                continue
            try:
                dt = email.utils.parsedate_to_datetime(it.findtext('pubDate'))
            except Exception:
                dt = NOW
            if dt < cutoff:
                continue
            seen.add(key)
            items.append({'title': title, 'outlet': outlet, 'url': it.findtext('link'),
                          'date': iso(dt), 'lang': lang})
        time.sleep(1)
    # kicker-Newsfeed zum BVB (offizieller RSS-Feed von kicker; die Kader- und Statistikseiten sperrt kicker fuer Server)
    try:
        root = ET.fromstring(http_get(KICKER_FEED, retries=1))
        for it in root.iter('item'):
            title = text(it.findtext('title') or '')
            key = slug(title)[:90]
            if not title or key in seen:
                continue
            try:
                dt = email.utils.parsedate_to_datetime(it.findtext('pubDate'))
            except Exception:
                dt = NOW
            if dt < cutoff:
                continue
            seen.add(key)
            items.append({'title': title, 'outlet': 'kicker', 'url': it.findtext('link'), 'date': iso(dt), 'lang': 'de',
                          'bvb': True, 'desc': text(it.findtext('description') or '')[:280]})
    except Exception as e:
        log('  kicker-Feed: %s' % e)
    items.sort(key=lambda x: x['date'], reverse=True)
    return items


def gemini_models(key):
    """Neueste verfuegbare Flash-Modelle zuerst - so laeuft es auch, wenn Google alte Modelle abschaltet."""
    aliases = ['gemini-flash-latest', 'gemini-flash-lite-latest']
    found = []
    try:
        data = http_json(GEMINI + '/models?pageSize=200', headers={'x-goog-api-key': key}, timeout=30)
        for m in data.get('models', []):
            name = m.get('name', '').replace('models/', '')
            if 'generateContent' not in m.get('supportedGenerationMethods', []):
                continue
            if 'flash' not in name or re.search(r'image|tts|audio|live|embed|vision|thinking-exp|robotics', name):
                continue
            found.append(name)
    except Exception as e:
        log('  Gemini Modellliste: %s' % e)

    def ver(n):
        m = re.search(r'gemini-(\d+(?:\.\d+)?)', n)
        return (float(m.group(1)) if m else 0, 'lite' not in n, 'preview' not in n and 'exp' not in n)
    found = [n for n in found if not re.search(r'-latest$', n)]
    found.sort(key=ver, reverse=True)
    order = []
    for n in found[:3] + aliases + found[3:]:
        if n not in order:
            order.append(n)
    return order[:6]


# Ersatz-KIs - alle kostenlos und OpenAI-kompatibel. Antwortet Gemini nicht, versucht die App sie der Reihe nach.
# (Name, GitHub-Secret, Adresse, bevorzugte Modelle (Teil des Namens), maximale Prompt-Laenge)
AI_BACKUPS = [
    ('groq', 'GROQ_API_KEY', 'https://api.groq.com/openai/v1',
     ['gpt-oss-120b', 'llama-3.3-70b', 'qwen3-32b', 'gpt-oss-20b', 'llama-3.1-8b'], 13000),
    ('cerebras', 'CEREBRAS_API_KEY', 'https://api.cerebras.ai/v1',
     ['gpt-oss-120b', 'qwen-3-235b', 'llama-3.3-70b', 'qwen-3-32b', 'llama3.1-8b'], 30000),
    ('openrouter', 'OPENROUTER_API_KEY', 'https://openrouter.ai/api/v1',
     ['gpt-oss-120b', 'deepseek-chat', 'deepseek-v3', 'llama-3.3-70b', 'qwen3-235b', 'mistral-small', 'gemma-3-27b', ':free'], 30000),
    ('mistral', 'MISTRAL_API_KEY', 'https://api.mistral.ai/v1',
     ['mistral-medium-latest', 'mistral-small-latest', 'mistral-large-latest', 'open-mistral-nemo'], 30000),
]


def backup_models(name, base, key, prefs):
    """Verfuegbare Modelle eines Anbieters, bevorzugte zuerst (laeuft weiter, wenn Anbieter Modelle austauschen)."""
    ids = []
    try:
        data = http_json(base + '/models', headers={'Authorization': 'Bearer ' + key}, timeout=30)
        ids = [m.get('id') for m in data.get('data') or [] if m.get('id') and m.get('active', True)]
    except Exception as e:
        log('  %s Modellliste: %s' % (name, e))
    ids = [i for i in ids if not re.search(r'whisper|tts|guard|vision|embed|audio|playai|compound|safeguard|image|ocr|moderation|'
                                           r'codestral|pixtral|voxtral|devstral|transcribe', i, re.I)]
    if name == 'openrouter':
        ids = [i for i in ids if i.endswith(':free')]
    out = []
    for pref in prefs:
        for i in ids:
            if pref in i and i not in out:
                out.append(i)
    return (out or ids or [p for p in prefs if ':' not in p][:1])[:3]


def backup_call(prompt, attempts=None):
    """Ersatz-KIs der Reihe nach, bis eine gueltiges JSON liefert."""
    last = None
    for name, env, base, prefs, limit in AI_BACKUPS:
        key = os.environ.get(env, '').strip()
        if not key:
            continue
        # Gratis-Kontingente sind begrenzt: lange Prompts hinten kuerzen - dort stehen die aeltesten Schlagzeilen
        pr = prompt if len(prompt) <= limit else prompt[:limit].rsplit('\n', 1)[0]
        headers = {'Authorization': 'Bearer ' + key}
        if name == 'openrouter':
            headers.update({'HTTP-Referer': 'https://github.com/sneaxx141108-gif/bvb09', 'X-Title': 'BVB 09 Fan-App'})
        for model in backup_models(name, base, key, prefs):
            for json_mode in (True, False):
                body = {'model': model, 'temperature': 0.2, 'max_tokens': 4000,
                        'messages': [{'role': 'system', 'content': 'Du antwortest ausschließlich mit gültigem JSON.'},
                                     {'role': 'user', 'content': pr}]}
                if json_mode:
                    body['response_format'] = {'type': 'json_object'}
                try:
                    res = http_json(base + '/chat/completions', body=body, headers=headers, timeout=150)
                    txt = ((res.get('choices') or [{}])[0].get('message') or {}).get('content') or ''
                    data = extract_json(txt)
                    if data is None:
                        raise RuntimeError('Antwort war kein JSON')
                    return data, '%s:%s' % (name, model), []
                except urllib.error.HTTPError as e:
                    detail = ''
                    try:
                        detail = json.loads(e.read().decode('utf-8')).get('error', {}).get('message', '')[:160]
                    except Exception:
                        pass
                    last = '%s:%s: HTTP %s %s' % (name, model, e.code, detail)
                    if attempts is not None:
                        attempts.append(last[:200])
                    if e.code == 400 and json_mode:
                        continue  # Modell kann keinen JSON-Modus -> einmal ohne
                    break
                except Exception as e:
                    last = '%s:%s: %s' % (name, model, e)
                    if attempts is not None:
                        attempts.append(str(last)[:200])
                    break
    raise RuntimeError(last or 'keine Ersatz-KI eingerichtet')


def backups_set():
    return [name for name, env, _, _, _ in AI_BACKUPS if os.environ.get(env, '').strip()]


def backup_check(prev):
    """Testet jede eingerichtete Ersatz-KI mit einer Mini-Anfrage (klappt es, nur einmal am Tag) - so faellt ein
    kaputter Schluessel nicht erst auf, wenn Gemini wirklich ausfaellt. Ergebnis zeigt die Update-Zentrale."""
    out = {}
    for name, env, base, prefs, _ in AI_BACKUPS:
        key = os.environ.get(env, '').strip()
        if not key:
            continue
        old = (prev or {}).get(name) or {}
        if old.get('ok') and (old.get('at') or '')[:10] == TODAY:
            out[name] = old
            continue
        headers = {'Authorization': 'Bearer ' + key}
        if name == 'openrouter':
            headers.update({'HTTP-Referer': 'https://github.com/sneaxx141108-gif/bvb09', 'X-Title': 'BVB 09 Fan-App'})
        res = {'ok': False, 'at': iso(NOW), 'error': 'kein Modell gefunden'}
        for model in backup_models(name, base, key, prefs):
            try:
                http_json(base + '/chat/completions', headers=headers, timeout=60,
                          body={'model': model, 'max_tokens': 16, 'temperature': 0,
                                'messages': [{'role': 'user', 'content': 'Antworte nur mit: ok'}]})
                res = {'ok': True, 'at': iso(NOW), 'model': model}
                break
            except urllib.error.HTTPError as e:
                detail = ''
                try:
                    detail = json.loads(e.read().decode('utf-8')).get('error', {}).get('message', '')[:120]
                except Exception:
                    pass
                res['error'] = ('HTTP %s %s' % (e.code, detail)).strip()
                if e.code in (401, 403):
                    break  # Schluessel ungueltig - andere Modelle helfen nicht
            except Exception as e:
                res['error'] = str(e)[:120]
        out[name] = res
        log('  Ersatz-KI %s: %s' % (name, 'bereit (%s)' % res.get('model') if res['ok'] else res.get('error')))
    return out


def ai_available():
    return bool(os.environ.get('GEMINI_API_KEY', '').strip() or backups_set())


def gemini_call(key, models, prompt, grounded, attempts=None):
    """Gemini zuerst; antwortet kein Gemini-Modell, springen (ohne Google-Suche) die Ersatz-KIs ein."""
    last = None
    for model in (models if key else []):
        body = {'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
                'generationConfig': {'temperature': 0.2, 'maxOutputTokens': 16384}}
        if grounded:
            body['tools'] = [{'google_search': {}}]
        else:
            body['generationConfig']['responseMimeType'] = 'application/json'
        for attempt in range(2):
            try:
                res = http_json('%s/models/%s:generateContent' % (GEMINI, model), body=body,
                                headers={'x-goog-api-key': key}, timeout=180)
                cand = (res.get('candidates') or [{}])[0]
                txt = ''.join(p.get('text', '') for p in (cand.get('content') or {}).get('parts', []) if not p.get('thought'))
                data = extract_json(txt)
                if data is None:
                    raise RuntimeError('Antwort war kein JSON')
                links = []
                for ch in (cand.get('groundingMetadata') or {}).get('groundingChunks', []) or []:
                    w = ch.get('web') or {}
                    if w.get('uri'):
                        links.append({'title': w.get('title'), 'url': w.get('uri')})
                return data, model, links
            except urllib.error.HTTPError as e:
                detail = ''
                try:
                    detail = json.loads(e.read().decode('utf-8')).get('error', {}).get('message', '')[:160]
                except Exception:
                    pass
                last = '%s%s: HTTP %s %s' % (model, ' (Suche)' if grounded else '', e.code, detail)
                if attempts is not None:
                    attempts.append(last[:200])
                # kurzes Limit -> einmal warten; Ueberlastung (503) oder leeres Kontingent -> gleich naechstes Modell
                if e.code == 429 and attempt == 0 and not re.search(r'quota|exhausted|limit: 0', detail, re.I):
                    time.sleep(15)
                    continue
                break
            except Exception as e:
                last = '%s%s: %s' % (model, ' (Suche)' if grounded else '', e)
                if attempts is not None:
                    attempts.append(str(last)[:200])
                break
    if not grounded and backups_set():
        try:
            return backup_call(prompt, attempts)
        except Exception as e:
            last = ('%s | %s' % (last, e)) if last else str(e)
    raise RuntimeError(last or 'kein Modell verfügbar')


def extract_json(txt):
    if not txt:
        return None
    t = txt.strip()
    m = re.search(r'```(?:json)?\s*(.*?)```', t, re.S)
    if m:
        t = m.group(1).strip()
    for cand in (t, t[t.find('{'):t.rfind('}') + 1] if '{' in t else ''):
        try:
            return json.loads(cand)
        except Exception:
            continue
    return None


def build_prompt(headlines, squads, stories, grounded):
    names, missing = [], []
    for key in ('profis', 'u23', 'u19'):
        team = ((squads or {}).get('teams') or {}).get(key)
        if team:
            names.append('%s: %s' % (team['name'], ', '.join(p['name'] for p in team['players'])))
            for p in team['players']:
                for a in p.get('absences') or []:
                    if a['type'] in ('injury', 'suspension', 'out'):
                        missing.append('%s (%s): %s' % (p['name'], team['name'], a['text']))
    known = [{'key': s['key'], 'player': s['player'], 'direction': s['direction'],
              'status': s['status'], 'otherClub': (s.get('otherClub') or {}).get('name')}
             for s in stories[:40]]
    lines = ['%d | %s | %s | %s' % (i, h['date'][:10], h['outlet'], h['title'] + (' – ' + h['desc'] if h.get('desc') else ''))
             for i, h in enumerate(headlines[:120])]
    task = (
        'Du bist der Transfer-Redakteur einer Borussia-Dortmund-Fan-App. Heute ist %s. Laufende Saison: %s '
        '(Sommer-Transferfenster %s und Winter-Transferfenster %s). Wechsel aus früheren Saisons gehören nicht mehr dazu.\n\n'
        'AUFGABE: Finde alle aktuellen Transfer-Storys rund um Borussia Dortmund (Profis, BVB II, U19, '
        'auch Trainer/Sportdirektor) aus den letzten 14 Tagen: Zugänge, Abgänge, Leihen, '
        'Vertragsverlängerungen, Dementis.\n\n'
        'NUR VERTRAUENSWÜRDIGE QUELLEN! Eine Story darf nur rein, wenn die ursprüngliche Quelle '
        '(der Journalist/das Medium, das zuerst berichtet hat) auf dieser Liste steht:\n'
        'Stufe 1 (sehr verlässlich): %s\n'
        'Stufe 2 (meist verlässlich): %s\n'
        'Viele Schlagzeilen kommen von Sammelseiten (z. B. 90min, Tribuna, FussballTransfers, Yahoo). '
        'Übernimm sie nur, wenn klar ist, dass sie eine Quelle der Liste zitieren, und gib dann die '
        'Originalquelle an. Alles andere (Boulevard ohne Quelle, Fan-Accounts, Spekulation) weglassen.\n\n'
        % (TODAY, '%d/%02d' % (TRANSFER_SEASON, (TRANSFER_SEASON + 1) % 100), TRANSFER_SEASON, TRANSFER_SEASON + 1,
           ', '.join(TIER1), ', '.join(TIER2)))
    if grounded:
        task += ('Nutze die Google-Suche, um die neuesten Meldungen zu prüfen, besonders Posts auf X von '
                 'Fabrizio Romano (@FabrizioRomano), Florian Plettenberg (@Plettigoal), Patrick Berger '
                 '(@altobelli13) und Berichte von Sky Sport, kicker und Ruhr Nachrichten. Prüfe Ablöse und Boni.\n\n')
    task += (
        'STATUS-Werte: "official" (vom Verein bestätigt), "herewego" (Romanos "Here we go" oder Einigung aller '
        'Parteien laut Stufe-1-Quelle), "advanced" (fortgeschrittene Verhandlungen), "talks" (Gespräche/Angebot), '
        '"interest" (Interesse/Kandidat), "denied" (dementiert/geplatzt), "extension" (Vertragsverlängerung).\n'
        'direction: "in" = kommt zum BVB, "out" = verlässt den BVB, "extension" = verlängert beim BVB. '
        'team: "profis" (erste Mannschaft), "u23" (BVB II) oder "u19".\n'
        'Erfinde NIEMALS Zahlen oder Fakten. Ablöse, Boni, Vertragsende, Verein, Position und Datum nur, wenn eine Quelle '
        'sie klar nennt - bist du dir nicht sicher, gib null zurück (die App zeigt dann k. A.). Lieber null als raten.\n'
        'probability = deine Einschätzung der Wechselwahrscheinlichkeit in Prozent (0-100) für Gerüchte '
        '(interest/talks/advanced), abhängig von Status, Anzahl und Verlässlichkeit der Quellen; '
        'official/herewego/extension = 100, denied = 0.\n'
        'Wenn eine Story schon bekannt ist (Liste unten), verwende denselben key und aktualisiere sie.\n\n'
        'ZUSÄTZLICH:\n'
        '1) "injuries": Verletzungs-, Fitness- und Sperren-News zu BVB-Spielern der letzten 7 Tage aus den Quellen oben '
        '(neue Verletzung, voraussichtliche Rückkehr, zurück im Training, wieder fit, fraglich fürs nächste Spiel). '
        'status: "injured" (fällt aus), "doubtful" (fraglich), "back" (zurück im Training), "fit" (wieder voll einsatzfähig), '
        '"suspended" (gesperrt, z. B. Rot- oder Gelbsperre - im text steht wofür und für wie viele Spiele). '
        'WICHTIG: Nur Infos, die wirklich in den Schlagzeilen bzw. der Suche stehen. Die Transfermarkt-Liste unten ist nur zur '
        'Orientierung - wiederhole sie NICHT. Gibt es keine neuen Meldungen, gib eine leere Liste zurück.\n'
        '2) "briefing": 3-4 kurze, sachliche Sätze auf Deutsch mit den wichtigsten BVB-News des Tages '
        '(Ergebnisse, Verletzungen, Transfers). Nichts erfinden.\n'
        '3) "mood": Stimmung rund um den BVB laut den Schlagzeilen (Fans und Medien): score 0-100 (0 = Krise, '
        '50 = normal, 100 = Euphorie), label = 1-2 Wörter auf Deutsch, reason = ein kurzer Satz.\n\n'
        'Antworte NUR mit JSON in genau diesem Format:\n'
        '{"stories":[{"key":"spieler-name|in","player":"Vorname Nachname","role":"Spieler|Trainer|Funktionär","team":"profis|u23|u19",'
        '"direction":"in|out|extension","otherClub":"Vereinsname oder null",'
        '"otherClubEn":"englischer Vereinsname (für die Logo-Suche) oder null","status":"...",'
        '"fee":"z.B. 30 Mio. € oder null","feeValue":30000000,"bonus":"z.B. 5 Mio. € Boni oder null",'
        '"contractUntil":"2031 oder null","loan":false,"source":"Journalist oder Medium (Original)",'
        '"tier":1,"probability":40,"summary":"1-2 Sätze auf Deutsch, sachlich","date":"YYYY-MM-DD","headlines":[0,3]}],'
        '"injuries":[{"player":"Vorname Nachname","status":"injured|doubtful|back|fit|suspended",'
        '"text":"kurz auf Deutsch, z.B. Muskelfaserriss, fällt ca. 3 Wochen aus","expectedReturn":"z.B. Mitte November oder null",'
        '"source":"Medium","date":"YYYY-MM-DD"}],'
        '"briefing":"...","mood":{"score":60,"label":"Zuversicht","reason":"..."}}\n'
        'Höchstens 20 Storys, die wichtigsten und neuesten zuerst. Keine Storys ohne BVB-Bezug.\n\n')
    task += 'AKTUELLE BVB-KADER (wer hier steht und wechseln soll = direction "out"):\n' + '\n'.join(names) + '\n\n'
    task += 'ZULETZT BEKANNTE AUSFÄLLE (nur zur Orientierung, nicht wiederholen):\n' + ('\n'.join(missing) or 'niemand') + '\n\n'
    task += 'BEREITS BEKANNTE STORYS:\n' + json.dumps(known, ensure_ascii=False) + '\n\n'
    task += 'SCHLAGZEILEN (Index | Datum | Medium | Titel):\n' + '\n'.join(lines)
    return task


def mod_news(state):
    prev = load('news.json', {}) or {}
    stories = [s for s in prev.get('stories') or [] if source_tier(s.get('source'))]
    headlines_all = fetch_news()
    if not headlines_all:
        raise RuntimeError('Google News lieferte keine Schlagzeilen')
    bvb_re = re.compile(r'BVB|Dortmund|Borussia D', re.I)
    shown = []
    for h in headlines_all:
        tier = outlet_tier(h['outlet'])
        if tier and (h.get('bvb') or bvb_re.search(h['title'])):
            shown.append(dict(h, tier=tier))
    old_titles = {slug(h['title'])[:90] for h in prev.get('headlines') or []}
    new_heads = [h for h in shown if slug(h['title'])[:90] not in old_titles]
    if prev.get('headlines') and new_heads:
        state['changes'].add('news', '%d neue Schlagzeilen' % len(new_heads), count=len(new_heads))
    gem = {'used': False, 'model': None, 'grounded': False, 'at': (prev.get('gemini') or {}).get('at'),
           'lastSuccess': (prev.get('gemini') or {}).get('lastSuccess'), 'error': None,
           'headlines': len(headlines_all), 'stories': 0}
    key = os.environ.get('GEMINI_API_KEY', '').strip()
    result = None
    if not ai_available():
        gem['error'] = 'Kein KI-Schlüssel gesetzt (GEMINI_API_KEY oder eine Ersatz-KI)'
    else:
        models = gemini_models(key) if key else []
        state['gemini_models'] = models
        candidates = ([h for h in headlines_all if h.get('bvb') or bvb_re.search(h['title'])] or headlines_all)[:120]
        attempts = []
        gem['attempts'] = attempts
        pg = prev.get('gemini') or {}
        # Google-Suche ist im Gratis-Kontingent nicht immer frei -> nach "Kontingent erschoepft" 3 Tage aussetzen
        no_ground = (pg.get('noGroundingUntil') or '') > iso(NOW)
        if no_ground:
            gem['noGroundingUntil'] = pg['noGroundingUntil']
        ground_models = []
        for m in [x for x in models if 'lite' in x][:1] + models[:2]:
            if m not in ground_models:
                ground_models.append(m)
        for grounded in ((False,) if no_ground else (True, False)):
            try:
                prompt = build_prompt(candidates, state.get('squads') or load('squads.json'), stories, grounded)
                data, model, links = gemini_call(key, ground_models if grounded else models, prompt, grounded, attempts)
                result = data
                gem.update({'used': True, 'model': model, 'grounded': grounded, 'at': iso(NOW),
                            'lastSuccess': iso(NOW), 'error': None, 'links': links[:12]})
                break
            except Exception as e:
                gem['error'] = str(e)[:300]
                log('  Gemini (%s): %s' % ('mit Suche' if grounded else 'ohne Suche', e))
                if grounded and all('HTTP 429' in a for a in attempts if '(Suche)' in a) and any('(Suche)' in a for a in attempts):
                    gem['noGroundingUntil'] = iso(NOW + timedelta(days=3))
        gem['headlinesAnalyzed'] = len(candidates)
        # Ernstfall-Test: einmal im Monat (schlaegt er fehl: bei jedem Lauf) bekommt die Ersatz-KI dieselbe Aufgabe wie
        # Gemini - nur zum Vergleich, uebernommen wird ihr Ergebnis nicht
        drill = pg.get('drill') or {}
        backup_used = str(gem.get('model') or '').split(':')[0] in backups_set()
        if backups_set() and result is not None and not backup_used and (
                not drill.get('ok') or (drill.get('at') or '') < iso(NOW - timedelta(days=30))):
            drill = backup_drill(candidates, stories, result, state)
            log('  Ernstfall-Test Ersatz-KI: %s' % json.dumps(drill, ensure_ascii=False))
        if drill:
            gem['drill'] = drill
    injury_news = prev.get('injuryNews') or []
    briefing = prev.get('briefing')
    mood = prev.get('mood')
    mood_hist = prev.get('moodHistory') or []
    if result is not None:
        stories = merge_stories(stories, result.get('stories') or [], candidates, state)
        gem['dropped'] = state.get('dropped', [])[:10]
        gem['stories'] = len(result.get('stories') or []) - len(state.get('dropped', []))
        injury_news = merge_injuries(injury_news, result.get('injuries') or [], state)
        gem['injuries'] = len(result.get('injuries') or [])
        enrich_stories(stories, state)  # Fotos/Positionen vorher holen - neue Spieler kommen so mit Bild in den Kader
        gem['applied'] = apply_ai_updates(stories, state)
        b = (result.get('briefing') or '').strip()
        if b:
            briefing = {'text': b[:900], 'at': iso(NOW)}
        md = result.get('mood') or {}
        try:
            score = int(md.get('score'))
        except (TypeError, ValueError, AttributeError):
            score = None
        if score is not None and 0 <= score <= 100:
            mood = {'score': score, 'label': str(md.get('label') or '').strip()[:30] or None,
                    'reason': str(md.get('reason') or '').strip()[:220] or None, 'at': iso(NOW)}
            mood_hist = [h for h in mood_hist if h[0] != TODAY] + [[TODAY, score]]
    # Alte Storys aufraeumen (45 Tage ohne Neuigkeit), Verletzungs-News nach 21 Tagen
    # Abgeschlossenes (offiziell, Here we go, Verlaengerung, Dementi) 45 Tage, offene Geruechte bis zum Abschluss -
    # nur wenn 4 Monate lang gar nichts Neues kommt, fliegen sie raus
    lim_done = (NOW - timedelta(days=45)).strftime('%Y-%m-%d')
    lim_open = (NOW - timedelta(days=120)).strftime('%Y-%m-%d')
    stories = [s for s in stories if (s.get('updatedAt') or s.get('createdAt') or TODAY)
               >= (lim_open if s.get('status') in ('interest', 'talks', 'advanced') else lim_done)][:80]
    ilimit = (NOW - timedelta(days=21)).strftime('%Y-%m-%d')
    injury_news = [i for i in injury_news if (i.get('date') or TODAY) >= ilimit][:40]
    enrich_stories(stories, state)
    # Bilanz der laufenden Saison und Ausfaelle im Kader - laeuft auch ohne KI-Antwort (Saisonwechsel, Aufraeumen)
    try:
        gem['transfersAdded'] = sync_transfers(stories, state)
    except Exception as e:
        log('  Transferbilanz: %s' % e)
    try:
        gem['injuriesApplied'] = apply_injuries(injury_news, state)
    except Exception as e:
        log('  Ausfälle im Kader: %s' % e)
    save('news.json', {'updatedAt': iso(NOW), 'stories': stories, 'headlines': shown[:60],
                       'injuryNews': injury_news, 'briefing': briefing, 'gemini': gem,
                       'mood': mood, 'moodHistory': mood_hist[-90:]})
    state['gemini'] = gem
    return {'ok': True, 'count': len(stories), 'warning': gem['error'] if not gem['used'] else None}


def backup_drill(candidates, stories, gemini_result, state):
    """Die Ersatz-KI bekommt die komplette News-Aufgabe (ohne Google-Suche) - verglichen wird mit dem, was Gemini fand."""
    t0 = time.time()
    try:
        prompt = build_prompt(candidates, state.get('squads') or load('squads.json'), stories, False)
        data, model, _ = backup_call(prompt)
    except Exception as e:
        return {'at': iso(NOW), 'ok': False, 'error': str(e)[:200]}

    def players(res):
        return {slug(s.get('player') or '') for s in (res.get('stories') or []) if isinstance(s, dict) and s.get('player')}
    a, b = players(gemini_result), players(data)
    return {'at': iso(NOW), 'ok': isinstance(data.get('stories'), list), 'model': model, 'seconds': round(time.time() - t0),
            'stories': len(b), 'gemini': len(a), 'overlap': len(a & b), 'injuries': len(data.get('injuries') or []),
            'briefing': bool(str(data.get('briefing') or '').strip())}


def merge_stories(stories, found, headlines, state):
    for s in stories:  # aeltere Eintraege ohne Uhrzeit nachruesten (fuer die 30-Stunden-Regel der Story-Kreise)
        s.setdefault('addedAt', (s.get('createdAt') or TODAY) + 'T06:00:00Z')
        s.setdefault('statusAt', s['addedAt'])
    by_key = {s['key']: s for s in stories}
    for f in found:
        player = (f.get('player') or '').strip()
        direction = f.get('direction') if f.get('direction') in ('in', 'out', 'extension') else 'in'
        status = f.get('status') if f.get('status') in STATUS_RANK else 'interest'
        if not player:
            continue
        tier = source_tier(f.get('source'))
        if not tier:
            state.setdefault('dropped', []).append('%s (%s)' % (player, f.get('source') or 'ohne Quelle'))
            continue
        key = slug(player) + '|' + direction
        urls = []
        for i in f.get('headlines') or []:
            if isinstance(i, int) and 0 <= i < len(headlines):
                urls.append({'title': headlines[i]['title'], 'outlet': headlines[i]['outlet'], 'url': headlines[i]['url']})
        entry = {'date': f.get('date') or TODAY, 'status': status, 'source': f.get('source'),
                 'text': (f.get('summary') or '').strip()[:400]}
        prob = f.get('probability')
        prob = max(0, min(100, int(prob))) if isinstance(prob, (int, float)) else None
        s = by_key.get(key) or by_key.get(f.get('key') or '')
        club = (f.get('otherClub') or '').strip() or None
        club_en = (f.get('otherClubEn') or '').strip() or None
        team = f.get('team') if f.get('team') in ('profis', 'u23', 'u19') else None
        if s and team and not s.get('team'):
            s['team'] = team
        if not s:
            s = {'key': key, 'player': player, 'role': f.get('role') or 'Spieler', 'team': team, 'direction': direction,
                 'otherClub': {'name': club, 'en': club_en} if club else None, 'status': status, 'fee': f.get('fee'),
                 'feeValue': f.get('feeValue') if isinstance(f.get('feeValue'), (int, float)) else None,
                 'bonus': f.get('bonus'), 'contractUntil': f.get('contractUntil'), 'loan': bool(f.get('loan')),
                 'source': f.get('source'), 'tier': tier, 'probability': prob, 'summary': entry['text'], 'date': entry['date'],
                 'createdAt': TODAY, 'updatedAt': TODAY, 'addedAt': iso(NOW), 'statusAt': iso(NOW),
                 'updates': [entry], 'links': urls[:4]}
            stories.append(s)
            by_key[key] = s
            arrow = '→ BVB' if direction == 'in' else 'verlängert' if direction == 'extension' else '← weg vom BVB'
            state['changes'].add('stories', 'Neu (%s): %s %s%s' % (STATUS_LABEL[status], player, arrow,
                                                                   (' (%s)' % club) if club else ''))
            continue
        changed = False
        if status != s['status'] and (STATUS_RANK[status] >= STATUS_RANK.get(s['status'], 0) or status == 'denied'):
            state['changes'].add('stories', 'Status: %s jetzt %s' % (player, STATUS_LABEL[status]))
            s['status'] = status
            s['statusAt'] = iso(NOW)
            changed = True
        for fld in ('fee', 'bonus', 'contractUntil'):
            if f.get(fld) and f.get(fld) != s.get(fld):
                s[fld] = f[fld]
                changed = True
        if isinstance(f.get('feeValue'), (int, float)) and f['feeValue'] != s.get('feeValue'):
            s['feeValue'] = f['feeValue']
        if club and not s.get('otherClub'):
            s['otherClub'] = {'name': club, 'en': club_en}
        if prob is not None and prob != s.get('probability'):
            old_p = s.get('probability')
            s['probability'] = prob
            if old_p is not None and abs(prob - old_p) >= 15:
                state['changes'].add('rumors', 'KI-Chance %s: %d%% → %d%%' % (player, old_p, prob))
        if f.get('source') and (tier < s.get('tier', 2) or changed):
            s['source'], s['tier'] = f['source'], tier
        if entry['text'] and entry['text'] != s.get('summary'):
            s['summary'] = entry['text']
            changed = True
        if changed:
            s['updatedAt'] = TODAY
            s['date'] = entry['date']
            s.setdefault('updates', []).insert(0, entry)
            s['updates'] = s['updates'][:8]
        for u in urls:
            if u['url'] not in {x['url'] for x in s.get('links', [])}:
                s.setdefault('links', []).insert(0, u)
        s['links'] = (s.get('links') or [])[:4]
    stories.sort(key=lambda s: (s.get('updatedAt') or '', STATUS_RANK.get(s.get('status'), 0)), reverse=True)
    return stories


INJ_LABEL = {'injured': 'fällt aus', 'doubtful': 'fraglich', 'back': 'zurück im Training', 'fit': 'wieder fit',
             'suspended': 'gesperrt'}


def merge_injuries(current, found, state):
    by = {slug(i['player']): i for i in current if i.get('player')}
    for f in found:
        player = (f.get('player') or '').strip()
        if not player:
            continue
        st = f.get('status') if f.get('status') in INJ_LABEL else 'injured'
        entry = {'player': player, 'status': st, 'text': (f.get('text') or '').strip()[:240],
                 'expectedReturn': f.get('expectedReturn'), 'source': f.get('source'),
                 'date': f.get('date') or TODAY}
        old = by.get(slug(player))
        if old and (old.get('status'), old.get('text')) == (st, entry['text']):
            continue
        if old and (old.get('date') or '') > entry['date']:
            continue
        by[slug(player)] = entry
        state['changes'].add('injuries', 'Verletzungs-News: %s %s%s' % (
            player, INJ_LABEL[st], (' – ' + entry['text']) if entry['text'] else ''))
    return sorted(by.values(), key=lambda i: i.get('date') or '', reverse=True)


def apply_ai_updates(stories, state):
    """Vertragsverlaengerungen und offizielle Wechsel aus den KI-ausgewerteten News in die Kaderdaten uebernehmen."""
    squads = load('squads.json')
    if not squads:
        return 0
    index = {}
    for key, team in (squads.get('teams') or {}).items():
        for p in team.get('players', []):
            index.setdefault(slug(p['name']), []).append((key, p))

    def find(name):
        s = slug(name)
        if s in index:
            return index[s]
        last = s.split('-')[-1] if s else ''
        hits = [v for k, vs in index.items() for v in vs if last and k.split('-')[-1] == last]
        return hits if len({p['id'] for _, p in hits}) == 1 else []

    changed = 0
    for s in stories:
        if s.get('status') != 'extension' or not s.get('contractUntil'):
            continue
        y = re.search(r'(20\d\d)', str(s['contractUntil']))
        hits = find(s['player']) if y else []
        new_c = '%s-06-30' % y.group(1) if y else None
        done = False
        for key, p in hits:
            if (p.get('contract') or '') < new_c:
                p['contract'] = new_c
                p['contractNote'] = 'verlängert laut %s' % s.get('source')
                done = True
        if done:
            changed += 1
            state['changes'].add('squad', 'Vertrag verlängert: %s bis %s (laut %s)' % (s['player'], y.group(1), s.get('source')))
    # Offizielle Wechsel (nur Stufe-1-Quelle) direkt im Kader nachziehen: Neuzugaenge rein, Abgaenge raus
    for s in stories:
        pro = (squads.get('teams') or {}).get(s.get('team') or 'profis') or (squads.get('teams') or {}).get('profis')
        if not pro or s.get('status') != 'official' or s.get('tier') != 1 or (s.get('role') or 'Spieler') != 'Spieler':
            continue
        hits = find(s['player'])
        info = s.get('playerInfo') or {}
        if s.get('direction') == 'in' and not hits:
            y = re.search(r'(20\d\d)', str(s.get('contractUntil') or ''))
            pos = info.get('position') or ''
            group = ('Torwart' if re.search(r'keeper|torw', pos, re.I) else
                     'Abwehr' if re.search(r'back|defen|verteid', pos, re.I) else
                     'Sturm' if re.search(r'forward|striker|wing|stürm|sturm|außen|aussen', pos, re.I) else 'Mittelfeld')
            club = (s.get('otherClub') or {}).get('name')
            p = {'id': 'ai-' + slug(s['player']), 'name': s['player'], 'img': info.get('img'), 'position': pos_de(pos),
                 'group': group, 'number': None, 'captain': False, 'absences': [], 'age': info.get('age'),
                 'contract': ('%s-06-30' % y.group(1)) if y else None, 'joined': TODAY,
                 'from': {'name': club, 'fee': s.get('fee') or '-'} if club else None,
                 'newSigning': {'from': club, 'date': s.get('date') or TODAY, 'fee': s.get('fee') or '-'},
                 'aiAdded': 'laut %s' % s.get('source')}
            pro['players'].append(p)
            pro['count'] = len(pro['players'])
            (squads.get('departed') or {}).pop(slug(s['player']), None)
            changed += 1
            state['changes'].add('squad', 'Neu im Kader: %s (laut %s)' % (s['player'], s.get('source')))
        elif s.get('direction') == 'out':
            for key, p in hits:
                team = squads['teams'][key]
                if p in team['players']:
                    team['players'].remove(p)
                    team['count'] = len(team['players'])
                    squads.setdefault('departed', {})[slug(p['name'])] = TODAY
                    changed += 1
                    state['changes'].add('squad', 'Nicht mehr im Kader: %s (laut %s)' % (p['name'], s.get('source')))
    if changed:
        squads['aiUpdatedAt'] = iso(NOW)
        save('squads.json', squads)
    return changed


def sync_transfers(stories, state):
    """Transferbilanz der laufenden Saison: neue Saison -> bei null starten; offizielle Wechsel aus den News dauerhaft eintragen."""
    tr = load('transfers.json', {}) or {}
    lab = '%02d/%02d' % (TRANSFER_SEASON % 100, (TRANSFER_SEASON + 1) % 100)
    reset = tr.get('season') != TRANSFER_SEASON
    if reset:
        if tr.get('season'):
            state['changes'].add('transfers', 'Neue Transfersaison %s – die Bilanz startet bei null' % lab)
        tr = {'season': TRANSFER_SEASON, 'seasonLabel': lab, 'in': [], 'out': [], 'income': 0, 'expense': 0, 'balance': 0,
              'resetAt': iso(NOW)}
    start = '%d-06-01' % TRANSFER_SEASON
    known = {slug(x['name']) for k in ('in', 'out') for x in tr.get(k) or []}
    added = 0
    for s in stories:
        if s.get('status') != 'official' or s.get('direction') not in ('in', 'out') or (s.get('role') or 'Spieler') != 'Spieler':
            continue
        if (s.get('date') or TODAY) < start or slug(s['player']) in known:
            continue
        info = s.get('playerInfo') or {}
        club = s.get('otherClub') or {}
        tr[s['direction']].insert(0, {'id': info.get('id') or 'ai-' + slug(s['player']), 'name': s['player'], 'img': info.get('img'),
                                      'position': info.get('position'), 'age': info.get('age'),
                                      'club': {'name': club.get('name'), 'crest': club.get('crest')} if club.get('name') else None,
                                      'fee': s.get('fee') or 'k. A.', 'feeValue': s.get('feeValue'), 'loan': bool(s.get('loan')),
                                      'news': s.get('source'), 'date': s.get('date') or TODAY})
        known.add(slug(s['player']))
        added += 1
        state['changes'].add('transfers', '%s für die Bilanz: %s (%s)' % ('Zugang' if s['direction'] == 'in' else 'Abgang', s['player'],
                                                                       club.get('name') or 'k. A.'))
    if added or reset:
        tr['income'] = sum(x.get('feeValue') or 0 for x in tr['out'])
        tr['expense'] = sum(x.get('feeValue') or 0 for x in tr['in'])
        tr['balance'] = tr['income'] - tr['expense']
        tr['updatedAt'] = iso(NOW)
        save('transfers.json', tr)
    return added


def apply_injuries(injury_news, state):
    """Verletzungs-News in den Kader uebernehmen: Ausfaelle eintragen, Genesene austragen, Veraltetes aufraeumen."""
    squads = load('squads.json')
    if not squads:
        return 0
    index = {}
    for team in (squads.get('teams') or {}).values():
        for pl in team.get('players', []):
            index.setdefault(slug(pl['name']), []).append(pl)

    def find(name):
        sl = slug(name)
        if sl in index:
            return index[sl]
        last = sl.split('-')[-1] if sl else ''
        hits = [pl for k, ps in index.items() for pl in ps if last and k.split('-')[-1] == last]
        return hits if len({pl['id'] for pl in hits}) == 1 else []
    changed = 0
    for n in sorted(injury_news, key=lambda i: i.get('date') or ''):
        st = n.get('status')
        for pl in find(n.get('player') or ''):
            ab = pl.setdefault('absences', [])
            if st in ('injured', 'suspended'):
                typ = 'injury' if st == 'injured' else 'suspension'
                txt = ((n.get('text') or INJ_LABEL[st]) + (' · Rückkehr: %s' % n['expectedReturn'] if n.get('expectedReturn') else ''))[:200]
                cur = next((a for a in ab if a.get('type') == typ), None)
                if cur and cur.get('ai') and cur.get('text') == txt:
                    continue
                if cur and (cur.get('since') or '') > (n.get('date') or ''):
                    continue
                ab[:] = [a for a in ab if a.get('type') != typ]
                ab.append({'type': typ, 'text': txt, 'ai': True, 'since': n.get('date') or TODAY, 'source': n.get('source')})
                changed += 1
            elif st in ('fit', 'back'):
                keep = [a for a in ab if a.get('type') != 'injury' or (a.get('since') or '') > (n.get('date') or '')]
                if len(keep) != len(ab):
                    ab[:] = keep
                    changed += 1
    # Wer im letzten Spiel auf dem Platz stand, ist weder verletzt noch gesperrt (alte Eintraege raus)
    fin = [m for m in (load('matches.json', {}) or {}).get('profis') or [] if m.get('finished')]
    if fin:
        last = fin[-1]
        game = (((load('matchcenter.json', {}) or {}).get('matches') or {}).get(last['id']) or {}).get('game') or {}
        played = {pid for pid, v in (game.get('players') or {}).items() if (v.get('min') or 0) > 0}
        day = (last.get('date') or '')[:10]
        for pl in ((squads.get('teams') or {}).get('profis') or {}).get('players') or []:
            if pl['id'] in played and pl.get('absences'):
                keep = [a for a in pl['absences'] if a.get('type') not in ('injury', 'suspension', 'out') or (a.get('since') or '0000') > day]
                if len(keep) != len(pl['absences']):
                    pl['absences'] = keep
                    changed += 1
    # KI-Eintraege ohne neue Meldung nach 60 Tagen entfernen
    lim = (NOW - timedelta(days=60)).strftime('%Y-%m-%d')
    for team in (squads.get('teams') or {}).values():
        for pl in team.get('players', []):
            ab = pl.get('absences') or []
            keep = [a for a in ab if not (a.get('ai') and (a.get('since') or TODAY) < lim)]
            if len(keep) != len(ab):
                pl['absences'] = keep
                changed += 1
    if changed:
        squads['aiUpdatedAt'] = iso(NOW)
        save('squads.json', squads)
        state['changes'].add('injuries', 'Ausfälle im Kader aktualisiert (%d)' % changed, count=changed)
    return changed


# --------------------------------------------------------------------------- FotMob: Verletzungen, Vertraege, Noten, U19-Kader
# FotMob erlaubt das Lesen seiner Seiten (robots.txt sperrt nur /api) - die Daten stehen als JSON in jeder Seite.
FOTMOB = 'https://www.fotmob.com'
FM_TEAMS = {'profis': (9789, 'borussia-dortmund'), 'u19': (394130, 'borussia-dortmund-u19')}
FM_IMG = 'https://images.fotmob.com/image_resources/playerimages/%s.png'
FM_GROUP = {'keeper': 'Torwart', 'defender': 'Abwehr', 'midfielder': 'Mittelfeld', 'attacker': 'Sturm'}
FM_POS = {'GK': 'Torwart', 'CB': 'Innenverteidiger', 'LB': 'Linker Verteidiger', 'RB': 'Rechter Verteidiger',
          'LWB': 'Linker Verteidiger', 'RWB': 'Rechter Verteidiger', 'CDM': 'Defensives Mittelfeld', 'DM': 'Defensives Mittelfeld',
          'CM': 'Zentrales Mittelfeld', 'CAM': 'Offensives Mittelfeld', 'AM': 'Offensives Mittelfeld', 'LM': 'Linkes Mittelfeld',
          'RM': 'Rechtes Mittelfeld', 'LW': 'Linksaußen', 'RW': 'Rechtsaußen', 'ST': 'Mittelstürmer', 'CF': 'Mittelstürmer',
          'SS': 'Hängende Spitze'}
FM_MONTHS = {'January': 'Januar', 'February': 'Februar', 'March': 'März', 'May': 'Mai', 'June': 'Juni', 'July': 'Juli',
             'October': 'Oktober', 'December': 'Dezember'}
KICKER_FEED = 'https://newsfeed.kicker.de/team/borussia-dortmund'


def fm_page(path):
    page = http_get(FOTMOB + path, timeout=40)
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', page, re.S)
    if not m:
        raise RuntimeError('FotMob: keine Daten in %s' % path)
    return json.loads(m.group(1))['props']['pageProps']


def fm_team_data(tid, name):
    fb = fm_page('/teams/%d/squad/%s' % (tid, name)).get('fallback') or {}
    return fb.get('team-%d' % tid) or next((v for k, v in fb.items() if k.startswith('team-')), {})


def fm_members(t):
    return [p for g in ((t.get('squad') or {}).get('squad') or []) if g.get('title') != 'coach' for p in g.get('members') or []]


def fm_team(tid, name):
    return fm_members(fm_team_data(tid, name))


FM_CLUB_IMG = 'https://images.fotmob.com/image_resources/logo/teamlogo/%s.png'
FM_OWN = {9789, 8395, 394130}  # BVB, BVB II, U19 - interne Wechsel zaehlen nicht


def fm_sync_transfers(tdata, notes):
    """Zu- und Abgaenge der Profis laut FotMob in die Transferbilanz der laufenden Saison - ergaenzt Transfermarkt
    (nur vom PC) und die KI-News, damit die Bilanz auch in kuenftigen Saisons vollstaendig wird."""
    data = (tdata or {}).get('data') or {}
    if not data:
        return 0
    tr = load('transfers.json', {}) or {}
    lab = '%02d/%02d' % (TRANSFER_SEASON % 100, (TRANSFER_SEASON + 1) % 100)
    changed = 0
    if tr.get('season') != TRANSFER_SEASON:
        tr = {'season': TRANSFER_SEASON, 'seasonLabel': lab, 'in': [], 'out': [], 'income': 0, 'expense': 0, 'balance': 0,
              'resetAt': iso(NOW)}
        notes.append('Neue Transfersaison %s – die Bilanz startet bei null' % lab)
        changed += 1
    # FotMob datiert nach Bekanntgabe: Sommer-Wechsel werden oft schon im Fruehjahr fix gemacht -> ab 1. Maerz zaehlt ein
    # Wechsel zur kommenden Saison, Winterwechsel (Januar/Februar) noch zur alten
    start, end = '%d-03-01' % TRANSFER_SEASON, '%d-03-01' % (TRANSFER_SEASON + 1)
    known = {slug(x['name']): x for k in ('in', 'out') for x in tr.get(k) or []}
    for key, direction in (('Players in', 'in'), ('Players out', 'out')):
        for x in data.get(key) or []:
            date = (x.get('transferDate') or '')[:10]
            other = x.get('fromClubId') if direction == 'in' else x.get('toClubId')
            if not x.get('name') or not (start <= date < end) or other in FM_OWN:
                continue
            fee = x.get('fee') or {}
            ftxt = str(fee.get('feeText') or '').lower()
            loan = 'loan' in ftxt or 'loan' in str((x.get('transferType') or {}).get('text') or '').lower()
            value = fee['value'] if isinstance(fee.get('value'), (int, float)) and fee['value'] > 0 else None
            text = (fmt_money(value) if value else 'Leihe') if loan else fmt_money(value) if value else 'ablösefrei' if 'free' in ftxt else 'k. A.'
            old = known.get(slug(x['name']))
            if old:
                if value and not old.get('feeValue'):
                    old.update({'feeValue': value, 'fee': text})
                    changed += 1
                continue
            club = x.get('fromClubFullName' if direction == 'in' else 'toClubFullName') or x.get('fromClub' if direction == 'in' else 'toClub')
            entry = {'id': 'fm-%s' % x.get('playerId'), 'name': x['name'], 'img': FM_IMG % x['playerId'] if x.get('playerId') else None,
                     'position': FM_POS.get(((x.get('position') or {}).get('label') or '').upper()),
                     'club': {'name': club, 'crest': FM_CLUB_IMG % other} if club else None,
                     'fee': text, 'feeValue': value, 'loan': loan, 'source': 'FotMob', 'date': date}
            tr.setdefault(direction, []).insert(0, entry)
            known[slug(x['name'])] = entry
            changed += 1
            notes.append('%s laut FotMob: %s (%s)' % ('Zugang' if direction == 'in' else 'Abgang', x['name'], club or 'k. A.'))
    if changed:
        tr['income'] = sum(x.get('feeValue') or 0 for x in tr.get('out') or [])
        tr['expense'] = sum(x.get('feeValue') or 0 for x in tr.get('in') or [])
        tr['balance'] = tr['income'] - tr['expense']
        tr['updatedAt'] = iso(NOW)
        save('transfers.json', tr)
    return changed


def fm_return_de(s):
    """'Mid November 2026' -> 'Mitte November 2026', 'About 1-2 weeks' -> 'ca. 1–2 Wochen'."""
    s = (s or '').strip()
    if not s:
        return None
    for a, b in ((r'^Early ', 'Anfang '), (r'^Mid ', 'Mitte '), (r'^Late ', 'Ende '), (r'^About ', 'ca. '), (r'(\d)-(\d)', r'\1–\2'),
                 (r'\b1 weeks?\b', '1 Woche'), (r'\bweeks?\b', 'Wochen'), (r'\b1 days?\b', '1 Tag'), (r'\bdays?\b', 'Tage'),
                 (r'\b1 months?\b', '1 Monat'), (r'\bmonths?\b', 'Monate'), (r'^Doubtful$', 'fraglich'), (r'^Unknown$', 'unbekannt'),
                 (r'^Out for the season$', 'Saison-Aus')):
        s = re.sub(a, b, s)
    for en, de in FM_MONTHS.items():
        s = re.sub(r'\b%s\b' % en, de, s)
    return s


def fm_matcher(players):
    """FotMob-Spieler -> Spieler im App-Kader: Name, eindeutiger Nachname, Geburtstag oder Rueckennummer."""
    by_slug = {slug(p['name']): p for p in players}

    def match(m):
        s = slug(m.get('name') or '')
        if s in by_slug:
            return by_slug[s]
        last = s.split('-')[-1] if s else ''
        cands = [p for p in players if last and slug(p['name']).split('-')[-1] == last]
        if len(cands) == 1:
            return cands[0]
        dob = (m.get('dateOfBirth') or '')[:10]
        hit = [p for p in (cands or players) if dob and p.get('birth') == dob]
        if len(hit) == 1:
            return hit[0]
        num = m.get('shirtNumber')
        hit = [p for p in cands if num and str(p.get('number') or '') == str(num)]
        return hit[0] if len(hit) == 1 else None
    return match


def fm_fill(p, m):
    """Fehlende Grunddaten aus FotMob ergaenzen (nichts ueberschreiben, was schon da ist)."""
    changed = False
    if not p.get('birth') and m.get('dateOfBirth'):
        p['birth'] = m['dateOfBirth'][:10]
        changed = True
    if not p.get('number') and m.get('shirtNumber'):
        p['number'] = str(m['shirtNumber'])
        changed = True
    if p.get('height') in (None, '', '-') and m.get('height'):
        p['height'] = '%d,%02dm' % (m['height'] // 100, m['height'] % 100)
        changed = True
    if p.get('fm') != m.get('id'):
        p['fm'] = m.get('id')
        changed = True
    return changed


def mod_fotmob(state):
    """Profis: Verletzungen mit Rueckkehr-Prognose, FotMob-Noten, Vertragsende (rotierend von den Spielerseiten).
    U19: Kader aktuell halten (Neue rein, wer 3 Tage fehlt raus) - ohne Statistiken (Regel von Niklas)."""
    squads = load('squads.json') or {}
    teams = squads.get('teams') or {}
    if not teams.get('profis'):
        raise RuntimeError('keine Kaderdaten')
    changed, notes, errors = 0, [], []
    # Profis
    t_pro = fm_team_data(*FM_TEAMS['profis'])
    members = fm_members(t_pro)
    if len(members) < 15:
        raise RuntimeError('FotMob lieferte nur %d Profis' % len(members))
    players = teams['profis']['players']
    match = fm_matcher(players)
    matched = 0
    fit_since = (NOW - timedelta(days=1)).strftime('%Y-%m-%d')
    ai_old = (NOW - timedelta(days=7)).strftime('%Y-%m-%d')
    for m in members:
        p = match(m)
        if not p:
            continue
        matched += 1
        changed += fm_fill(p, m)
        rating = m.get('rating')
        if rating and p.get('fmRating') != rating:
            p['fmRating'] = rating
            changed += 1
        inj = m.get('injury')
        if inj:
            ret = fm_return_de(inj.get('expectedReturn'))
            old = p.get('fmInjury') or {}
            if old.get('return') != ret or not old:
                p['fmInjury'] = {'return': ret, 'since': old.get('since') or TODAY}
                if not old:
                    notes.append('Verletzt laut FotMob: %s%s' % (p['name'], ' (Rückkehr: %s)' % ret if ret else ''))
                changed += 1
            p.pop('fmFit', None)
        else:
            if p.pop('fmInjury', None) is not None:
                notes.append('Wieder fit laut FotMob: %s' % p['name'])
                changed += 1
            if not p.get('fmFit'):
                p['fmFit'] = TODAY
                changed += 1
            # FotMob meldet seit mindestens einem Tag keine Verletzung: alte Transfermarkt- und KI-Eintraege raeumen
            if p['fmFit'] <= fit_since and p.get('absences'):
                keep = [a for a in p['absences'] if a.get('type') != 'injury' or (a.get('ai') and (a.get('since') or TODAY) > ai_old)]
                if len(keep) != len(p['absences']):
                    p['absences'] = keep
                    changed += 1
    if matched < 0.6 * len(players):
        errors.append('nur %d von %d Profis bei FotMob gefunden' % (matched, len(players)))
    # Vertragsende von den Spielerseiten - je Lauf hoechstens 8 Spieler, die am laengsten nicht geprueft wurden
    due = sorted([p for p in players if p.get('fm')], key=lambda p: p.get('fmChecked') or '')[:8]
    for p in due:
        try:
            pp = fm_page('/players/%s/%s' % (p['fm'], slug(p['name'])))
            data = (pp.get('fallback') or {}).get('player:%s' % p['fm']) or pp.get('data') or {}
            end = ((data.get('contractEnd') or {}).get('utcTime') or '')[:10]
            if re.match(r'\d{4}-\d{2}-\d{2}$', end) and end >= TODAY and end != p.get('contract'):
                if p.get('contract') and end > p['contract']:
                    p['contractNote'] = 'verlängert bis %s (FotMob)' % end[:4]
                notes.append('Vertrag laut FotMob: %s bis %s%s' % (p['name'], end[:4], ' (vorher %s)' % p['contract'][:4] if p.get('contract') else ''))
                p['contract'] = end
                changed += 1
            p['fmChecked'] = TODAY
        except Exception as e:
            errors.append('%s: %s' % (p['name'], str(e)[:80]))
        time.sleep(1.5)
    # Transferbilanz der laufenden Saison um die FotMob-Wechsel ergaenzen
    try:
        fm_sync_transfers(t_pro.get('transfers'), notes)
    except Exception as e:
        errors.append('Transfers: %s' % str(e)[:120])
    # U19: Kader abgleichen (keine Statistiken). Wer bei FotMob im Profi-Kader steht, zaehlt als "noch da".
    try:
        changed += fm_sync_youth(teams, 'u19', notes, {slug(m.get('name') or '') for m in members})
    except Exception as e:
        errors.append('U19: %s' % str(e)[:120])
    if changed:
        squads['fmUpdatedAt'] = iso(NOW)
        save('squads.json', squads)
    for n in notes[:20]:
        state['changes'].add('squad', n)
    return {'ok': True, 'count': matched, 'warning': '; '.join(errors) or None}


def fm_sync_youth(teams, key, notes, also=()):
    team = teams.get(key)
    if not team:
        return 0
    members = fm_team(*FM_TEAMS[key])
    if len(members) < 18:
        raise RuntimeError('FotMob-Kader unvollständig (%d Spieler)' % len(members))
    players = team['players']
    match = fm_matcher(players)
    elsewhere = {slug(p['name']) for k, t in teams.items() if k != key for p in t.get('players', [])}
    changed, seen = 0, set()
    for m in members:
        p = match(m)
        if p:
            seen.add(p['id'])
            changed += fm_fill(p, m)
            if m.get('shirtNumber') and str(m['shirtNumber']) != str(p.get('number') or ''):
                p['number'] = str(m['shirtNumber'])
                changed += 1
            if p.pop('fmMiss', None):
                changed += 1
            continue
        if slug(m.get('name') or '') in elsewhere or not m.get('name'):
            continue
        pos = FM_POS.get(((m.get('positionIdsDesc') or '').split(',') or [''])[0].strip())
        grp = FM_GROUP.get(((m.get('role') or {}).get('key') or '').replace('_long', ''))
        p = {'id': 'fm-%s' % m['id'], 'name': m['name'], 'img': FM_IMG % m['id'], 'position': pos or grp, 'group': grp,
             'number': str(m['shirtNumber']) if m.get('shirtNumber') else None, 'captain': False, 'absences': [],
             'birth': (m.get('dateOfBirth') or '')[:10] or None, 'age': m.get('age'), 'flags': [], 'joined': TODAY,
             'fm': m.get('id'), 'fmAdded': True}
        players.append(p)
        seen.add(p['id'])
        notes.append('Neu im %s-Kader (FotMob): %s' % (team.get('name') or key, m['name']))
        changed += 1
    for p in list(players):
        if p['id'] in seen or slug(p['name']) in also:
            continue
        miss = p.get('fmMiss') or {'n': 0, 'd': ''}
        if miss['d'] != TODAY:
            miss = {'n': miss['n'] + 1, 'd': TODAY}
            p['fmMiss'] = miss
            changed += 1
        if miss['n'] >= 3:
            players.remove(p)
            notes.append('Nicht mehr im %s-Kader (FotMob): %s' % (team.get('name') or key, p['name']))
    team['count'] = len(players)
    return changed


TSDB = 'https://www.thesportsdb.com/api/v1/json/123'


def tsdb(path):
    time.sleep(2.2)  # freies Kontingent von TheSportsDB: hoechstens 30 Anfragen pro Minute
    return http_json(TSDB + path, timeout=30)


def enrich_stories(stories, state):
    """Spielerfoto (freigestellt) und Vereinswappen ergaenzen - ueber TheSportsDB (frei nutzbar), mit Cache."""
    cache = load('cache.json', {}) or {}
    cache.setdefault('tsdbPlayers', {})
    cache.setdefault('tsdbClubs', {})
    squads = state.get('squads') or load('squads.json') or {}
    own = {}
    for key, team in (squads.get('teams') or {}).items():
        for p in team['players']:
            own[slug(p['name'])] = dict(p, team=key)
    budget = 10
    for s in stories:
        ps = slug(s['player'])
        if s.get('role', 'Spieler') == 'Spieler' and not (s.get('playerInfo') or {}).get('img'):
            if ps in own:
                p = own[ps]
                s['playerInfo'] = {'id': p['id'], 'img': p.get('img'), 'value': p.get('value'),
                                   'position': p.get('position'), 'age': p.get('age')}
            elif ps in cache['tsdbPlayers']:
                s['playerInfo'] = cache['tsdbPlayers'][ps]
            elif budget > 0:
                budget -= 1
                try:
                    data = tsdb('/searchplayers.php?p=' + urllib.parse.quote(s['player']))
                    info = None
                    for pl in data.get('player') or []:
                        if pl.get('strSport') == 'Soccer' and slug(pl.get('strPlayer', '')).split('-')[-1] == ps.split('-')[-1]:
                            info = {'img': pl.get('strCutout') or pl.get('strThumb'), 'cutout': bool(pl.get('strCutout')),
                                    'position': pl.get('strPosition'),
                                    'club': {'name': pl.get('strTeam')} if pl.get('strTeam') else None}
                            break
                    cache['tsdbPlayers'][ps] = info
                    s['playerInfo'] = info
                except Exception as e:
                    log('  Spielersuche %s: %s' % (s['player'], e))
        info = s.get('playerInfo') or {}
        if info.get('img') and 'transfermarkt' in info['img']:
            info['img'] = re.sub(r'/portrait/(small|medium|header)/', '/portrait/big/', info['img'])
        club = s.get('otherClub')
        if not club and s['direction'] == 'in' and info.get('club') and not is_bvb(info['club'].get('name') or ''):
            s['otherClub'] = club = dict(info['club'])
        if club and club.get('name') and not club.get('crest'):
            query = club.get('en') or club['name']
            cs = slug(query)
            if cs in cache['tsdbClubs']:
                club.update(cache['tsdbClubs'][cs] or {})
            elif budget > 0:
                budget -= 1
                try:
                    data = tsdb('/searchteams.php?t=' + urllib.parse.quote(query))
                    c = next((t for t in data.get('teams') or [] if t.get('strSport') == 'Soccer' and t.get('strBadge')), None)
                    cache['tsdbClubs'][cs] = {'crest': c['strBadge']} if c else None
                    if c:
                        club['crest'] = c['strBadge']
                except Exception as e:
                    log('  Vereinssuche %s: %s' % (query, e))
    save('cache.json', cache)


# --------------------------------------------------------------------------- Ablauf
class Changes:
    def __init__(self):
        self.items, self.counts = [], {}

    def add(self, cat, msg, count=1):
        self.counts[cat] = self.counts.get(cat, 0) + count
        self.items.append({'cat': cat, 'text': msg})

    @property
    def total(self):
        return sum(self.counts.values())


def next_runs():
    out = []
    for day in range(0, 3):
        base = (NOW + timedelta(days=day)).strftime('%Y-%m-%d')
        for hm in SCHEDULE_LOCAL:
            utc = berlin_to_utc(base, hm)
            if utc > iso(NOW):
                out.append(utc)
    return out[:3]


MODULES = [
    # Server (GitHub + Gemini) - laeuft 3x taeglich automatisch
    ('matches', 'Spiele & Tabelle (OpenLigaDB)', mod_matches, 'server'),
    ('season', 'Saison: Fieberkurve, Prognose & Torjäger (OpenLigaDB)', mod_season, 'server'),
    ('stats_espn', 'Statistiken & Kader (ESPN)', mod_stats_espn, 'server'),
    ('fotmob', 'Verletzungen, Verträge, Noten & U19-Kader (FotMob)', mod_fotmob, 'server'),
    ('news', 'Transfer-News, Verletzungen & Verträge (Gemini + kicker)', mod_news, 'server'),
    ('matchcenter', 'Spieltag-Zentrale: Vor- und Spielberichte (Gemini)', mod_matchcenter, 'server'),
    # Transfermarkt direkt - sperrt Server per Bot-Schutz, klappt nur von einem normalen Internetanschluss
    ('squads', 'Kader & Verträge (Transfermarkt)', mod_squads, 'pc'),
    ('stats', 'Statistiken (Transfermarkt)', mod_stats, 'pc'),
    ('transfers', 'Transferbilanz (Transfermarkt)', mod_transfers, 'pc'),
]


def main():
    started = time.time()
    state = {'changes': Changes(), 'warnings': []}
    args = sys.argv[1:]
    if os.environ.get('GITHUB_ACTIONS') and not args:
        kind = 'server'
    elif not args:
        kind = 'pc'
    else:
        kind = 'server' if all(k in ('matches', 'season', 'stats_espn', 'fotmob', 'news', 'matchcenter', 'all') for k in args) else 'pc'
    status_file = 'status.json' if kind == 'server' else 'status-pc.json'
    prev_status = load(status_file, {}) or {}
    modules = [m for m in MODULES if m[3] == kind or 'all' in args]
    results = {}
    only = set(a for a in args if a != 'all')
    for key, label, fn, _ in modules:
        if only and key not in only:
            results[key] = (prev_status.get('modules') or {}).get(key, {'label': label, 'ok': None})
            continue
        log('> %s' % label)
        t0 = time.time()
        try:
            r = fn(state) or {'ok': True}
        except Exception as e:
            traceback.print_exc()
            r = {'ok': False, 'error': str(e)[:300]}
        r['label'] = label
        r['seconds'] = round(time.time() - t0, 1)
        r['at'] = iso(NOW) if r.get('ok') else (prev_status.get('modules') or {}).get(key, {}).get('at')
        results[key] = r
        log('  -> %s' % json.dumps(r, ensure_ascii=False))
    ch = state['changes']
    first = not prev_status
    run = {'at': iso(NOW), 'changes': ch.total, 'ok': all(r.get('ok') is not False for r in results.values()),
           'seconds': round(time.time() - started)}
    runs = ([run] + (prev_status.get('runs') or []))[:40]
    gem = state.get('gemini') or prev_status.get('gemini') or {}
    status = {
        'lastRun': iso(NOW), 'firstRun': first, 'durationSec': run['seconds'],
        'changes': {'total': ch.total, 'byCategory': ch.counts, 'items': ch.items[:80]},
        'modules': results, 'warnings': state['warnings'], 'gemini': gem,
        'schedule': SCHEDULE_LOCAL, 'nextRuns': next_runs(), 'runs': runs,
        'totalChanges7d': sum(r['changes'] for r in runs
                              if r['at'] >= iso(NOW - timedelta(days=7))),
        'runner': 'github-actions' if os.environ.get('GITHUB_ACTIONS') else 'lokal',
        'ai': dict([('gemini', bool(os.environ.get('GEMINI_API_KEY', '').strip()))] + [(n, n in backups_set()) for n, *_ in AI_BACKUPS]),
        'kind': kind,
        'debug': DEBUG[:8],
    }
    if kind == 'server':
        try:
            status['aiCheck'] = backup_check(prev_status.get('aiCheck'))
        except Exception as e:
            log('Ersatz-KI-Test: %s' % e)
            status['aiCheck'] = prev_status.get('aiCheck') or {}
        tm = load('status-pc.json', {}) or {}
        status['transfermarkt'] = {'blocked': True, 'lastDirect': tm.get('lastRun'),
                                   'aiUpdatedAt': (load('squads.json', {}) or {}).get('aiUpdatedAt')}
    else:
        status.pop('schedule')
        status.pop('nextRuns')
    save(status_file, status)
    log('Fertig: %d Änderungen in %ds' % (ch.total, run['seconds']))


if __name__ == '__main__':
    main()
