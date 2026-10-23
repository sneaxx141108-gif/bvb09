#!/usr/bin/env python3
"""BVB 09 Fan-App - automatisches Daten-Update.

Laeuft 3x taeglich auf GitHub Actions (kostenlos) und braucht nur die
Python-Standardbibliothek. Holt:
  * Kader, Vertraege, Verletzungen, Statistiken,
    Transfers und Geruechtekueche von Transfermarkt
  * Spiele, Live-Ergebnisse und Tabellen von OpenLigaDB (Champions-League-Tabelle von ESPN)
  * Transfer-Schlagzeilen ueber Google News
und laesst die Schlagzeilen von der kostenlosen Gemini-KI auswerten
(Here we go / Geruecht / Abloese / Boni / Quelle).

Faellt eine Quelle aus, bleiben die alten Daten stehen und die App zeigt
den Fehler in der Update-Zentrale an.
"""
import email.utils
import html
import json
import os
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
    for team in TEAMS:
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
        rows.append({'pos': n('rank') or len(rows) + 1, 'team': name, 'short': t.get('shortDisplayName') or t.get('abbreviation'),
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
        time.sleep(0.5)
    if not agg:
        raise RuntimeError('; '.join(errors) or 'ESPN lieferte keine Daten')
    # Minuten: einmal am Tag je Spieler und Wettbewerb abfragen
    mins = prev.get('espnMinutes') or {}
    if mins.get('date') != TODAY:
        by = {}
        for eid, d in agg.items():
            total = 0
            for lg in d['leagues']:
                try:
                    j = http_json('%s/%s/seasons/%d/types/1/athletes/%s/statistics' % (ESPN_CORE, lg, SEASON, eid), timeout=30)
                    total += int(espn_stat((j.get('splits') or {}).get('categories'), 'minutes'))
                except Exception:
                    pass
                time.sleep(0.25)
            by[eid] = total
        mins = {'date': TODAY, 'byId': by}
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
    teams_stats = prev.get('teams') or {}
    old = teams_stats.get('profis') or {}
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
                'source': {'profis': 'ESPN', 'u23': 'Transfermarkt', 'u19': 'Transfermarkt'}})
    save('stats.json', out)
    if changed:
        state['changes'].add('stats', 'Statistiken aktualisiert bei %d Spielern (ESPN)' % changed, count=changed)
    return {'ok': True, 'count': matched, 'warning': '; '.join(errors) or None}


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


def mc_gemini(state, prompt):
    key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not key:
        raise RuntimeError('Kein GEMINI_API_KEY gesetzt')
    models = state.get('gemini_models') or gemini_models(key)
    state['gemini_models'] = models
    data, model, _ = gemini_call(key, models, prompt, False, state.setdefault('mc_attempts', []))
    return data, model


def make_preview(state, m, entry, squads, news):
    opp = m['away'] if m['isHome'] else m['home']
    o = entry.get('opponent') or {}
    heads = gnews('BVB %s' % match_word(opp), days=4)[:25]
    ko = parse_dt(m['date'])
    prompt = (
        'Du schreibst den Vorbericht für eine Borussia-Dortmund-Fan-App. Heute ist %s.\n'
        'SPIEL: %s – %s, %s%s, Anstoß %s Uhr (deutsche Zeit), BVB spielt %s.\n'
        'BVB-FORM: %s\nGEGNER-FORM: %s\nTABELLE: BVB %s, Gegner %s\nDIREKTER VERGLEICH (aus BVB-Sicht): %s\n'
        'BVB-AUSFÄLLE: %s\n\nSCHLAGZEILEN ZUM SPIEL (neueste zuerst):\n%s\n\n'
        'AUFGABE: Antworte NUR mit JSON: {"text":"4-5 sachliche Sätze auf Deutsch","keyPoints":["kurzer Fakt","kurzer Fakt",'
        '"kurzer Fakt"],"tip":{"bvb":2,"opp":1},"tipReason":"ein kurzer Satz"}\n'
        'Regeln: Nur Fakten aus den Angaben oben, nichts erfinden, keine Aufstellung erfinden. '
        'Was du nicht sicher weißt, lässt du weg. tip = deine realistische Ergebnis-Prognose (Tore BVB, Tore Gegner).'
        % (TODAY, m['home']['name'], m['away']['name'], m.get('comp') or '', (' · ' + m['round']) if m.get('round') else '',
           to_berlin(ko).strftime('%d.%m. %H:%M') if ko else 'k. A.', 'zu Hause' if m['isHome'] else 'auswärts',
           form_line(o.get('bvbForm') or []), form_line(o.get('form') or []),
           ('Platz %s (%s Pkt.)' % (o['bvbTable']['pos'], o['bvbTable']['points'])) if o.get('bvbTable') else 'k. A.',
           ('Platz %s (%s Pkt.)' % (o['table']['pos'], o['table']['points'])) if o.get('table') else 'k. A.',
           ('%d Siege, %d Remis, %d Niederlagen' % (o['h2h']['w'], o['h2h']['d'], o['h2h']['l'])) if o.get('h2h') else 'k. A.',
           '; '.join(absences_text(squads, news)) or 'keine bekannt',
           '\n'.join('- %s | %s | %s' % (h['date'][:10], h['outlet'], h['title']) for h in heads) or 'keine'))
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


def mod_matchcenter(state):
    """Spieltag-Zentrale: ESPN-Zuordnung, Gegner-Check, Spielerwerte je Spiel, KI-Vorbericht, KI-Spielbericht, Monatsfazit."""
    prev = load('matchcenter.json', {}) or {}
    mc = prev.get('matches') or {}
    months = prev.get('months') or {}
    ms = (load('matches.json', {}) or {}).get('profis') or []
    squads = load('squads.json', {}) or {}
    news = load('news.json', {}) or {}
    tables = load('tables.json', {}) or {}
    pro = ((squads.get('teams') or {}).get('profis') or {}).get('players') or []
    if not ms:
        raise RuntimeError('keine Spiele')
    errors, made = [], []
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
           'months': months, 'attempts': (state.get('mc_attempts') or [])[-6:]}
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


def gemini_call(key, models, prompt, grounded, attempts=None):
    last = None
    for model in models:
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
    lines = ['%d | %s | %s | %s' % (i, h['date'][:10], h['outlet'], h['title']) for i, h in enumerate(headlines[:120])]
    task = (
        'Du bist der Transfer-Redakteur einer Borussia-Dortmund-Fan-App. Heute ist %s.\n\n'
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
        % (TODAY, ', '.join(TIER1), ', '.join(TIER2)))
    if grounded:
        task += ('Nutze die Google-Suche, um die neuesten Meldungen zu prüfen, besonders Posts auf X von '
                 'Fabrizio Romano (@FabrizioRomano), Florian Plettenberg (@Plettigoal), Patrick Berger '
                 '(@altobelli13) und Berichte von Sky Sport, kicker und Ruhr Nachrichten. Prüfe Ablöse und Boni.\n\n')
    task += (
        'STATUS-Werte: "official" (vom Verein bestätigt), "herewego" (Romanos "Here we go" oder Einigung aller '
        'Parteien laut Stufe-1-Quelle), "advanced" (fortgeschrittene Verhandlungen), "talks" (Gespräche/Angebot), '
        '"interest" (Interesse/Kandidat), "denied" (dementiert/geplatzt), "extension" (Vertragsverlängerung).\n'
        'direction: "in" = kommt zum BVB, "out" = verlässt den BVB, "extension" = verlängert beim BVB.\n'
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
        '{"stories":[{"key":"spieler-name|in","player":"Vorname Nachname","role":"Spieler|Trainer|Funktionär",'
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
        if tier and bvb_re.search(h['title']):
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
    if not key:
        gem['error'] = 'Kein GEMINI_API_KEY gesetzt'
    else:
        models = gemini_models(key)
        state['gemini_models'] = models
        candidates = ([h for h in headlines_all if bvb_re.search(h['title'])] or headlines_all)[:120]
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
    limit = (NOW - timedelta(days=45)).strftime('%Y-%m-%d')
    stories = [s for s in stories if (s.get('updatedAt') or s.get('createdAt') or TODAY) >= limit][:60]
    ilimit = (NOW - timedelta(days=21)).strftime('%Y-%m-%d')
    injury_news = [i for i in injury_news if (i.get('date') or TODAY) >= ilimit][:40]
    enrich_stories(stories, state)
    save('news.json', {'updatedAt': iso(NOW), 'stories': stories, 'headlines': shown[:60],
                       'injuryNews': injury_news, 'briefing': briefing, 'gemini': gem,
                       'mood': mood, 'moodHistory': mood_hist[-90:]})
    state['gemini'] = gem
    return {'ok': True, 'count': len(stories), 'warning': gem['error'] if not gem['used'] else None}


def merge_stories(stories, found, headlines, state):
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
        if not s:
            s = {'key': key, 'player': player, 'role': f.get('role') or 'Spieler', 'direction': direction,
                 'otherClub': {'name': club, 'en': club_en} if club else None, 'status': status, 'fee': f.get('fee'),
                 'feeValue': f.get('feeValue') if isinstance(f.get('feeValue'), (int, float)) else None,
                 'bonus': f.get('bonus'), 'contractUntil': f.get('contractUntil'), 'loan': bool(f.get('loan')),
                 'source': f.get('source'), 'tier': tier, 'probability': prob, 'summary': entry['text'], 'date': entry['date'],
                 'createdAt': TODAY, 'updatedAt': TODAY, 'updates': [entry], 'links': urls[:4]}
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
    pro = (squads.get('teams') or {}).get('profis')
    for s in stories:
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
    ('stats_espn', 'Statistiken & Kader (ESPN)', mod_stats_espn, 'server'),
    ('news', 'Transfer-News, Verletzungen & Verträge (Gemini)', mod_news, 'server'),
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
        kind = 'server' if all(k in ('matches', 'stats_espn', 'news', 'matchcenter', 'all') for k in args) else 'pc'
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
        'kind': kind,
        'debug': DEBUG[:8],
    }
    if kind == 'server':
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
