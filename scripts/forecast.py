#!/usr/bin/env python3
"""Prognose-Rechner der BVB-App: Spielstaerken, Bundesliga-Saison, Champions League und KI-Tipp.

Spielstaerken: Poisson-Modell (Angriff und Abwehr je Team, Heimvorteil) aus
  * den Ergebnissen dieser Saison (volles Gewicht) und der Vorsaison (abgeschwaecht),
  * Wettquoten (DraftKings ueber ESPN) als Markteinschaetzung - die genaueste freie Quelle.
Simulation: Monte-Carlo mit Dixon-Coles-Korrektur (realistischere Remis-Quote als reines Poisson).
Champions League nach den Regeln seit 2024/25: Ligaphase (36 Teams, je 8 Spiele) mit UEFA-Tiebreakern,
Playoffs der Plaetze 9-24, Achtelfinale gegen die Top 8, fester Turnierbaum, Hin- und Rueckspiel
(Rueckspiel beim Gesetzten) mit Verlaengerung und Elfmeterschiessen, Finale auf neutralem Platz.
Bereits gespielte Hinspiele zaehlen voll: ein 4:0 im Hinspiel macht das Weiterkommen fast sicher.
Nur Standardbibliothek.
"""
import bisect
import math
import random

MAXG = 10               # Tore je Team, die das Modell betrachtet (mehr kommt praktisch nie vor)
DC_RHO = -0.07          # Dixon-Coles: etwas mehr 0:0/1:1, etwas weniger 1:0/0:1 als reines Poisson
HALF_LIFE = 180.0       # Tage: so schnell verliert ein Ergebnis an Gewicht
W_PREV = 0.5            # Vorsaison zaehlt halb
W_MARKET = 2.0          # eine Quote zaehlt wie zwei Ergebnisse (sie fasst viel mehr Wissen zusammen)
TAU = 4.0               # Zug zur Mitte: verhindert Ausreisser bei wenigen Spielen
SIGMA = 0.12            # Unsicherheit der Staerke je Team (Form, Verletzungen, Trainerwechsel) - gegen zu sichere Prognosen
SCENARIOS = 40          # so viele Staerke-Szenarien, in jedem viele Saisonverlaeufe
CL_ROUNDS = ['knockout-round-playoffs', 'round-of-16', 'quarterfinals', 'semifinals', 'final']
PO_PAIRS = [((9, 10), (23, 24)), ((11, 12), (21, 22)), ((13, 14), (19, 20)), ((15, 16), (17, 18))]
R16_PAIRS = [((1, 2), (15, 16)), ((3, 4), (13, 14)), ((5, 6), (11, 12)), ((7, 8), (9, 10))]


# ---------------------------------------------------------------- Wettquoten
def american_to_prob(s):
    """'+250' / '-120' -> Wahrscheinlichkeit inklusive Buchmacher-Marge."""
    try:
        v = float(str(s).replace('+', ''))
    except (TypeError, ValueError):
        return None
    if v == 0:
        return None
    return 100.0 / (v + 100.0) if v > 0 else -v / (-v + 100.0)


def parse_odds(comp):
    """ESPN-Quoten eines Spiels -> {'ph','pd','pa'(,'line','pover')} ohne Marge, sonst None."""
    o = (comp.get('odds') or [None])[0]
    if not o:
        return None
    ml = o.get('moneyline') or {}

    def price(side):
        x = ml.get(side) or {}
        return (x.get('close') or {}).get('odds') or (x.get('open') or {}).get('odds')
    ph, pd, pa = (american_to_prob(price(k)) for k in ('home', 'draw', 'away'))
    if not (ph and pd and pa):
        return None
    s = ph + pd + pa
    out = {'ph': ph / s, 'pd': pd / s, 'pa': pa / s}
    tot = o.get('total') or {}
    ov = american_to_prob(((tot.get('over') or {}).get('close') or {}).get('odds'))
    un = american_to_prob(((tot.get('under') or {}).get('close') or {}).get('odds'))
    try:
        line = float(o.get('overUnder'))
    except (TypeError, ValueError):
        line = None
    if line and ov and un:
        out['line'] = line
        out['pover'] = ov / (ov + un)
    return out


# ---------------------------------------------------------------- Tormodell
def pois_vec(lam):
    p = [math.exp(-lam)]
    for k in range(1, MAXG + 1):
        p.append(p[-1] * lam / k)
    return p


def score_matrix(lh, la, rho=DC_RHO):
    """Wahrscheinlichkeit jedes Ergebnisses x:y (Poisson mit Dixon-Coles-Korrektur)."""
    ph, pa = pois_vec(lh), pois_vec(la)
    m = [[ph[x] * pa[y] for y in range(MAXG + 1)] for x in range(MAXG + 1)]
    m[0][0] *= max(0.0, 1 - lh * la * rho)
    m[0][1] *= max(0.0, 1 + lh * rho)
    m[1][0] *= max(0.0, 1 + la * rho)
    m[1][1] *= max(0.0, 1 - rho)
    s = sum(map(sum, m))
    return [[v / s for v in row] for row in m]


def outcome_probs(m):
    w = d = l = 0.0
    for x, row in enumerate(m):
        for y, v in enumerate(row):
            if x > y:
                w += v
            elif x == y:
                d += v
            else:
                l += v
    return w, d, l


def p_over(m, line):
    return sum(v for x, row in enumerate(m) for y, v in enumerate(row) if x + y > line)


def market_lambdas(od):
    """Wettquoten -> erwartete Tore (Heim, Gast) im selben Tormodell."""
    target = od['ph'] - od['pa']

    def sup_for(total):
        lo, hi = -total + 0.02, total - 0.02
        for _ in range(26):
            mid = (lo + hi) / 2
            w, _, l = outcome_probs(score_matrix((total + mid) / 2, (total - mid) / 2))
            if w - l < target:
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2
    total = 2.75
    if od.get('line') and od.get('pover'):
        lo, hi = 1.0, 6.0
        for _ in range(18):
            mid = (lo + hi) / 2
            s = sup_for(mid)
            if p_over(score_matrix((mid + s) / 2, (mid - s) / 2), od['line']) < od['pover']:
                lo = mid
            else:
                hi = mid
        total = (lo + hi) / 2
    s = sup_for(total)
    return max(0.05, (total + s) / 2), max(0.05, (total - s) / 2)


def cum_matrix(lh, la):
    flat, acc = [], 0.0
    for row in score_matrix(lh, la):
        for v in row:
            acc += v
            flat.append(acc)
    flat[-1] = 1.0 + 1e-9
    return flat


def pois_sample(rng, lam):
    lim, k, p = math.exp(-lam), 0, rng.random()
    while p > lim:
        k += 1
        p *= rng.random()
    return k


def best_tip(lh, la):
    """Tipp mit den meisten erwarteten Punkten (3 exakt, 2 Tordifferenz, 1 Tendenz) - nicht einfach das wahrscheinlichste Ergebnis."""
    m = score_matrix(lh, la)
    best = None
    for tx in range(6):
        for ty in range(6):
            sgn = (tx > ty) - (tx < ty)
            e = 0.0
            for x, row in enumerate(m):
                for y, p in enumerate(row):
                    if x == tx and y == ty:
                        e += 3 * p
                    elif x - y == tx - ty:
                        e += 2 * p
                    elif (x > y) - (x < y) == sgn:
                        e += p
            if best is None or e > best[0] + 1e-12:
                best = (e, tx, ty)
    w, d, l = outcome_probs(m)
    return {'home': best[1], 'away': best[2], 'exp': round(best[0], 3), 'pw': w, 'pd': d, 'pl': l}


# ---------------------------------------------------------------- Spielstaerken
def decay(days):
    return 0.5 ** (max(0.0, days) / HALF_LIFE)


class Model:
    """Angriff/Abwehr je Team; unbekannte Teams bekommen einen vorsichtigen Standardwert."""

    def __init__(self, fit, default=(-0.15, -0.15)):
        self.mu, self.h = fit['mu'], fit['h']
        self.att, self.dfn = fit['att'], fit['def']
        self.default = default

    def known(self, t):
        return t in self.att

    def lam(self, i, j, neutral=False, default=None):
        dflt = default or self.default
        ai, di = self.att.get(i, dflt[0]), self.dfn.get(i, dflt[1])
        aj, dj = self.att.get(j, dflt[0]), self.dfn.get(j, dflt[1])
        hv = 0.0 if neutral else self.h
        return math.exp(self.mu + hv + ai - dj), math.exp(self.mu + aj - di)

    def strength(self, t):
        return self.att.get(t, self.default[0]) + self.dfn.get(t, self.default[1])


def fit_ratings(obs, prior=None, iters=60):
    """obs: (heim, gast, tore_heim, tore_gast, gewicht, neutral). Poisson-Maximum-Likelihood mit Zug zum Vorwert:
    log(Tore Heim) = mu + Heimvorteil + Angriff[heim] - Abwehr[gast]. Die Teile werden nacheinander geschaetzt,
    damit sich Niveau und Heimvorteil nicht gegenseitig aufschaukeln."""
    teams = sorted({o[0] for o in obs} | {o[1] for o in obs})
    prior = prior or {}
    att = {t: (prior.get(t) or (0.0, 0.0))[0] for t in teams}
    dfn = {t: (prior.get(t) or (0.0, 0.0))[1] for t in teams}
    tw = sum(o[4] for o in obs) or 1.0
    mu = math.log(max(0.4, sum(o[4] * (o[2] + o[3]) for o in obs) / (2 * tw)))
    h = 0.2

    def lams():
        return [(math.exp(mu + (0.0 if nt else h) + att[i] - dfn[j]), math.exp(mu + att[j] - dfn[i])) for i, j, _, _, _, nt in obs]
    for _ in range(iters):
        ga = dict.fromkeys(teams, 0.0)
        ha = dict.fromkeys(teams, TAU)
        gd = dict.fromkeys(teams, 0.0)
        hd = dict.fromkeys(teams, TAU)
        for (i, j, x, y, w, _), (lh, la) in zip(obs, lams()):
            ga[i] += w * (x - lh)
            ha[i] += w * lh
            ga[j] += w * (y - la)
            ha[j] += w * la
            gd[j] -= w * (x - lh)
            hd[j] += w * lh
            gd[i] -= w * (y - la)
            hd[i] += w * la
        for t in teams:
            pa, pdv = prior.get(t) or (0.0, 0.0)
            att[t] += 0.9 * (ga[t] - TAU * (att[t] - pa)) / ha[t]
            dfn[t] += 0.9 * (gd[t] - TAU * (dfn[t] - pdv)) / hd[t]
        ma = sum(att.values()) / len(att)
        md = sum(dfn.values()) / len(dfn)
        for t in teams:
            att[t] -= ma
            dfn[t] -= md
        mu += ma - md
        g = hh = 0.0
        for (i, j, x, y, w, _), (lh, la) in zip(obs, lams()):
            g += w * (x - lh + y - la)
            hh += w * (lh + la)
        mu += g / max(hh, 1e-9)
        g = hh = 0.0
        for (i, j, x, y, w, nt), (lh, la) in zip(obs, lams()):
            if not nt:
                g += w * (x - lh)
                hh += w * lh
        if hh > 0:
            h = min(0.6, max(-0.1, h + g / hh))
    return {'mu': mu, 'h': h, 'att': att, 'def': dfn}


# ---------------------------------------------------------------- ESPN-Spiele
def norm_event(e):
    """ESPN-Spiel -> kompaktes dict (Teams, Ergebnis, Status, Runde, Hin-/Rueckspiel, Sieger, Quoten)."""
    c = (e.get('competitions') or [{}])[0]
    comp = {x.get('homeAway'): x for x in c.get('competitors') or []}
    h, a = comp.get('home'), comp.get('away')
    if not h or not a:
        return None
    st = ((c.get('status') or e.get('status') or {}).get('type')) or {}

    def team(x):
        t = x.get('team') or {}
        return {'id': str(t.get('id')), 'name': t.get('displayName') or t.get('name') or '?',
                'short': t.get('shortDisplayName') or t.get('abbreviation'), 'abbr': t.get('abbreviation'),
                'logo': t.get('logo') or ((t.get('logos') or [{}])[0]).get('href')}

    def score(x):
        try:
            return int(float(x.get('score')))
        except (TypeError, ValueError):
            return None
    done = bool(st.get('completed'))
    hs, as_ = (score(h), score(a)) if done else (None, None)
    if done and (hs is None or as_ is None):
        done = False
    return {'id': str(e.get('id')), 'date': e.get('date'), 'home': team(h), 'away': team(a), 'hs': hs, 'as': as_,
            'done': done, 'state': st.get('state'), 'slug': (e.get('season') or {}).get('slug') or '',
            'season': (e.get('season') or {}).get('year'), 'leg': (c.get('leg') or {}).get('value'),
            'neutral': bool(c.get('neutralSite')),
            'winner': team(h)['id'] if h.get('winner') else team(a)['id'] if a.get('winner') else None,
            'odds': None if done else parse_odds(c)}


def obs_from(events, now_ts, weight, parse_ts):
    out = []
    for e in events:
        if not e.get('done'):
            continue
        ts = parse_ts(e['date'])
        if ts is None:
            continue
        w = weight * decay((now_ts - ts) / 86400.0)
        if w > 0.01:
            out.append((e['home']['id'], e['away']['id'], e['hs'], e['as'], w, e.get('neutral', False)))
    return out


def lam_for(e, model, market):
    mk = market.get(e['id'])
    if mk:
        return mk['lh'], mk['la']
    return model.lam(e['home']['id'], e['away']['id'], e.get('neutral', False))


class Scenario:
    """Ein Staerke-Szenario: Modell + Quoten, jedes Team mit zufaelliger Formabweichung."""

    def __init__(self, model, market, rng, teams, sigma=SIGMA):
        self.model, self.market = model, market
        self.delta = {t: rng.gauss(0.0, sigma) for t in teams}

    def lam(self, home, away, ev=None, neutral=False):
        mk = self.market.get(ev['id']) if ev else None
        lh, la = (mk['lh'], mk['la']) if mk else self.model.lam(home, away, neutral)
        d = self.delta.get(home, 0.0) - self.delta.get(away, 0.0)
        return lh * math.exp(d), la * math.exp(-d)


# ---------------------------------------------------------------- Bundesliga
def bl_forecast(events, model, market, sims=15000, seed=11):
    """Saison-Prognose: Meister, Champions League (1-4), Europa League (5), Conference League (6), Relegation (16), Abstieg (17-18)."""
    teams = {}
    for e in events:
        teams[e['home']['id']] = e['home']
        teams[e['away']['id']] = e['away']
    ids = sorted(teams)
    n = len(ids)
    if n < 10:
        return None
    ix = {t: k for k, t in enumerate(ids)}
    base = [[0, 0, 0, 0, 0, 0, 0] for _ in ids]  # Punkte, Tordiff., Tore, Gegentore, S, U, N
    rem = []
    for e in events:
        i, j = ix[e['home']['id']], ix[e['away']['id']]
        if e['done']:
            x, y = e['hs'], e['as']
            for t, gf, ga in ((i, x, y), (j, y, x)):
                r = base[t]
                r[1] += gf - ga
                r[2] += gf
                r[3] += ga
                if gf > ga:
                    r[0] += 3
                    r[4] += 1
                elif gf == ga:
                    r[0] += 1
                    r[5] += 1
                else:
                    r[6] += 1
        else:
            rem.append((i, j, e))
    if not rem:
        sims = 1
    rng = random.Random(seed + len(rem))
    counts = [[0] * n for _ in ids]
    exp_pts = [0.0] * n
    width = MAXG + 1
    scen = max(1, min(SCENARIOS, sims // 200))
    per = max(1, sims // scen)
    sims = scen * per
    mats = []
    for s_ in range(sims):
        if s_ % per == 0:
            sc = Scenario(model, market, rng, ids)
            mats = [(i, j, cum_matrix(*sc.lam(e['home']['id'], e['away']['id'], e, e.get('neutral', False)))) for i, j, e in rem]
        pts = [r[0] for r in base]
        gd = [r[1] for r in base]
        gf = [r[2] for r in base]
        for i, j, cum in mats:
            k = bisect.bisect_left(cum, rng.random())
            x, y = divmod(k, width)
            gd[i] += x - y
            gd[j] += y - x
            gf[i] += x
            gf[j] += y
            if x > y:
                pts[i] += 3
            elif x < y:
                pts[j] += 3
            else:
                pts[i] += 1
                pts[j] += 1
        order = sorted(range(n), key=lambda t: (-pts[t], -gd[t], -gf[t], rng.random()))
        for p, t in enumerate(order):
            counts[t][p] += 1
            exp_pts[t] += pts[t]
    cur = sorted(range(n), key=lambda t: (-base[t][0], -base[t][1], -base[t][2], teams[ids[t]]['name']))
    cur_pos = {t: p + 1 for p, t in enumerate(cur)}
    pct = lambda t, lo, hi: round(100.0 * sum(counts[t][lo - 1:hi]) / sims, 1)  # noqa: E731
    out = []
    for t in range(n):
        tid = ids[t]
        out.append({'espnId': tid, 'name': teams[tid]['name'], 'logo': teams[tid].get('logo'), 'pos': cur_pos[t],
                    'points': base[t][0], 'played': sum(base[t][4:7]), 'diff': base[t][1],
                    'expPoints': round(exp_pts[t] / sims, 1), 'title': pct(t, 1, 1), 'cl': pct(t, 1, 4), 'el': pct(t, 5, 5),
                    'ecl': pct(t, 6, 6), 'rel': pct(t, n - 2, n - 2), 'down': pct(t, n - 1, n),
                    'dist': [round(100.0 * c / sims, 1) for c in counts[t]], 'strength': round(model.strength(tid), 3)})
    out.sort(key=lambda r: (-r['expPoints'], r['pos']))
    return {'sims': sims, 'played': sum(1 for e in events if e['done']), 'remaining': len(rem),
            'withOdds': sum(1 for e in events if not e['done'] and e['id'] in market), 'teams': out}


# ---------------------------------------------------------------- Champions League
def play_tie(rng, sc, a, b, host2, legs):
    """K.-o.-Duell ueber zwei Spiele; host2 hat das Rueckspiel zu Hause. Bekannte Spiele (legs) zaehlen mit ihrem Ergebnis."""
    ga = gb = 0
    pending = []
    if legs:
        for ev in legs:
            if ev['done']:
                if ev['home']['id'] == a:
                    ga += ev['hs']
                    gb += ev['as']
                else:
                    ga += ev['as']
                    gb += ev['hs']
            else:
                pending.append((ev['home']['id'], ev))
        if len(legs) >= 2 and not pending:
            w = legs[-1].get('winner')
            if w in (a, b):
                return w
            if ga != gb:
                return a if ga > gb else b
            return a if rng.random() < 0.5 else b
        if len(legs) == 1:
            first_home = legs[0]['home']['id']
            pending.append((b if first_home == a else a, None))
    else:
        pending = [(b if host2 == a else a, None), (host2, None)]
    last_home = host2
    for home, ev in pending:
        away = b if home == a else a
        lh, la = sc.lam(home, away, ev)
        x, y = pois_sample(rng, lh), pois_sample(rng, la)
        if home == a:
            ga += x
            gb += y
        else:
            ga += y
            gb += x
        last_home = home
    if ga != gb:
        return a if ga > gb else b
    # Verlaengerung (30 Minuten) im Rueckspiel, danach Elfmeterschiessen
    away = b if last_home == a else a
    lh, la = sc.lam(last_home, away)
    x, y = pois_sample(rng, lh / 3), pois_sample(rng, la / 3)
    if last_home == a:
        ga += x
        gb += y
    else:
        ga += y
        gb += x
    if ga != gb:
        return a if ga > gb else b
    return a if rng.random() < 0.5 else b


def play_final(rng, sc, a, b, ev=None):
    if ev and ev['done']:
        if ev.get('winner') in (a, b):
            return ev['winner']
        x, y = (ev['hs'], ev['as']) if ev['home']['id'] == a else (ev['as'], ev['hs'])
        if x != y:
            return a if x > y else b
    if ev and ev['home']['id'] == b:
        la, lh = sc.lam(b, a, ev, True)
    else:
        lh, la = sc.lam(a, b, ev, True)
    x, y = pois_sample(rng, lh), pois_sample(rng, la)
    if x == y:
        x += pois_sample(rng, lh / 3)
        y += pois_sample(rng, la / 3)
    if x != y:
        return a if x > y else b
    return a if rng.random() < 0.5 else b


def cl_forecast(events, model, market, official_order=None, sims=15000, seed=7):
    """Champions League: Ligaphase + komplette K.-o.-Phase. official_order = ESPN-Tabelle (Team-IDs), wenn die Ligaphase vorbei ist."""
    lp = [e for e in events if e['slug'] == 'league-phase']
    if len(lp) < 100:
        return None
    teams = {}
    for e in lp:
        teams[e['home']['id']] = e['home']
        teams[e['away']['id']] = e['away']
    ids = sorted(teams)
    n = len(ids)
    ix = {t: k for k, t in enumerate(ids)}
    base = [[0, 0, 0, 0, 0, 0, 0] for _ in ids]  # Punkte, Tordiff., Tore, Auswaertstore, Siege, Auswaertssiege, Spiele
    rem = []
    for e in lp:
        i, j = ix[e['home']['id']], ix[e['away']['id']]
        if e['done']:
            x, y = e['hs'], e['as']
            bi, bj = base[i], base[j]
            bi[1] += x - y
            bj[1] += y - x
            bi[2] += x
            bj[2] += y
            bj[3] += y
            bi[6] += 1
            bj[6] += 1
            if x > y:
                bi[0] += 3
                bi[4] += 1
            elif x < y:
                bj[0] += 3
                bj[4] += 1
                bj[5] += 1
            else:
                bi[0] += 1
                bj[0] += 1
        else:
            rem.append((i, j, e))
    lp_done = not rem
    fixed = None
    if lp_done and official_order and len([t for t in official_order if t in ix]) == n:
        fixed = [ix[t] for t in official_order]
    ko = {}
    for r in CL_ROUNDS:
        d = {}
        for e in events:
            if e['slug'] == r:
                d.setdefault(frozenset((e['home']['id'], e['away']['id'])), []).append(e)
        for k in d:
            d[k].sort(key=lambda e: (e.get('leg') or 0, e['date'] or ''))
        ko[r] = d
    rng = random.Random(seed + len(rem) + sum(1 for e in events if e['done']))
    counts = [[0] * n for _ in ids]
    exp_pts = [0.0] * n
    reach = {k: [0] * n for k in ('top8', 'top24', 'r16', 'qf', 'sf', 'final', 'win')}
    width = MAXG + 1
    scen = max(1, min(SCENARIOS, sims // 200))
    per = max(1, sims // scen)
    sims = scen * per
    mats = []
    for s_ in range(sims):
        if s_ % per == 0:
            sc = Scenario(model, market, rng, ids)
            mats = [(i, j, cum_matrix(*sc.lam(e['home']['id'], e['away']['id'], e, e.get('neutral', False)))) for i, j, e in rem]
        if fixed:
            order = fixed
            pts = [r[0] for r in base]
        else:
            pts = [r[0] for r in base]
            gd = [r[1] for r in base]
            gf = [r[2] for r in base]
            agf = [r[3] for r in base]
            wins = [r[4] for r in base]
            aw = [r[5] for r in base]
            for i, j, cum in mats:
                k = bisect.bisect_left(cum, rng.random())
                x, y = divmod(k, width)
                gd[i] += x - y
                gd[j] += y - x
                gf[i] += x
                gf[j] += y
                agf[j] += y
                if x > y:
                    pts[i] += 3
                    wins[i] += 1
                elif x < y:
                    pts[j] += 3
                    wins[j] += 1
                    aw[j] += 1
                else:
                    pts[i] += 1
                    pts[j] += 1
            order = sorted(range(n), key=lambda t: (-pts[t], -gd[t], -gf[t], -agf[t], -wins[t], -aw[t], rng.random()))
        for p, t in enumerate(order):
            counts[t][p] += 1
            exp_pts[t] += pts[t]
        for t in order[:8]:
            reach['top8'][t] += 1
            reach['r16'][t] += 1
        for t in order[:24]:
            reach['top24'][t] += 1
        pos = {ids[t]: p + 1 for p, t in enumerate(order)}
        at = {p + 1: ids[t] for p, t in enumerate(order)}
        # Playoffs: 9/10 gegen 23/24, 11/12 gegen 21/22, 13/14 gegen 19/20, 15/16 gegen 17/18 (Rueckspiel beim Gesetzten)
        po = {}
        for pair, legs in ko['knockout-round-playoffs'].items():
            a, b = sorted(pair, key=lambda t: pos.get(t, 99))
            po[pos.get(a, 0)] = play_tie(rng, sc, a, b, a, legs)
        for (s1, s2), (u1, u2) in PO_PAIRS:
            if s1 in po or s2 in po:
                continue
            u = [at[u1], at[u2]]
            rng.shuffle(u)
            po[s1] = play_tie(rng, sc, at[s1], u[0], at[s1], None)
            po[s2] = play_tie(rng, sc, at[s2], u[1], at[s2], None)
        for w in po.values():
            reach['r16'][ix[w]] += 1
        # Achtelfinale: Top 8 gegen die Playoff-Sieger ihres Wegs (Rueckspiel bei den Top 8)
        r16 = {}
        for pair, legs in ko['round-of-16'].items():
            a, b = sorted(pair, key=lambda t: pos.get(t, 99))
            r16[pos.get(a, 0)] = play_tie(rng, sc, a, b, a, legs)
        for (s1, s2), (p1, p2) in R16_PAIRS:
            if s1 in r16 or s2 in r16:
                continue
            opp = [po.get(p1), po.get(p2)]
            rng.shuffle(opp)
            for s, o in ((s1, opp[0]), (s2, opp[1])):
                r16[s] = play_tie(rng, sc, at[s], o, at[s], None) if o else at[s]
        for w in r16.values():
            reach['qf'][ix[w]] += 1
        # Viertelfinale: Weg 1/2 gegen Weg 7/8, Weg 3/4 gegen Weg 5/6 (Rueckspiel beim Weg 1-4)
        qf = {}
        for pair, legs in ko['quarterfinals'].items():
            slots = sorted(s for s, w in r16.items() if w in pair)
            path = slots[0] if slots else min(pos.get(t, 99) for t in pair)
            a = r16.get(path) if r16.get(path) in pair else min(pair, key=lambda t: pos.get(t, 99))
            b = next(iter(pair - {a}))
            qf[path] = play_tie(rng, sc, a, b, a, legs)
        if len(qf) < 4 and len(r16) >= 8:
            x, y = [7, 8], [5, 6]
            rng.shuffle(x)
            rng.shuffle(y)
            for path, other in ((1, x[0]), (2, x[1]), (3, y[0]), (4, y[1])):
                if path not in qf and r16.get(path) and r16.get(other):
                    qf[path] = play_tie(rng, sc, r16[path], r16[other], r16[path], None)
        for w in qf.values():
            reach['sf'][ix[w]] += 1
        # Halbfinale: Weg 1 gegen Weg 3 oder 4, Weg 2 gegen den anderen (Rueckspiel beim Weg 1 bzw. 2)
        sf = {}
        for pair, legs in ko['semifinals'].items():
            paths = sorted(p for p, w in qf.items() if w in pair)
            path = paths[0] if paths else 1
            a = qf.get(path) if qf.get(path) in pair else min(pair, key=lambda t: pos.get(t, 99))
            b = next(iter(pair - {a}))
            sf[path if path in (1, 2) else (1 if 1 not in sf else 2)] = play_tie(rng, sc, a, b, a, legs)
        if len(sf) < 2 and len(qf) >= 4:
            z = [3, 4]
            rng.shuffle(z)
            for path, other in ((1, z[0]), (2, z[1])):
                if path not in sf:
                    sf[path] = play_tie(rng, sc, qf[path], qf[other], qf[path], None)
        for w in sf.values():
            reach['final'][ix[w]] += 1
        if len(sf) == 2:
            fin_ev = next(iter(next(iter(ko['final'].values()), [])), None) if ko['final'] else None
            champ = play_final(rng, sc, sf[1], sf[2], fin_ev)
            reach['win'][ix[champ]] += 1
    out = []
    for t in range(n):
        tid = ids[t]
        p = lambda k: round(100.0 * reach[k][t] / sims, 1)  # noqa: E731
        out.append({'espnId': tid, 'name': teams[tid]['name'], 'logo': teams[tid].get('logo'),
                    'points': base[t][0], 'played': base[t][6], 'diff': base[t][1], 'goals': base[t][2],
                    'expPoints': round(exp_pts[t] / sims, 1), 'top8': p('top8'), 'top24': p('top24'), 'r16': p('r16'),
                    'qf': p('qf'), 'sf': p('sf'), 'final': p('final'), 'win': p('win'),
                    'dist': [round(100.0 * c / sims, 1) for c in counts[t]], 'strength': round(model.strength(tid), 3)})
    out.sort(key=lambda r: (-r['win'], -r['final'], -r['expPoints']))
    stage = 'league'
    for r in CL_ROUNDS:
        if ko[r]:
            stage = r
    return {'sims': sims, 'leagueDone': lp_done, 'remaining': len(rem), 'stage': stage,
            'withOdds': sum(1 for e in events if not e['done'] and e['id'] in market), 'teams': out,
            'ties': {r: [[e['id'] for e in legs] for legs in ko[r].values()] for r in CL_ROUNDS if ko[r]}}
