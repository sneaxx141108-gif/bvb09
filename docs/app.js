/* BVB 09 – inoffizielle Fan-App
 * Daten kommen aus data/*.json (3x taeglich von GitHub Actions + Gemini aktualisiert),
 * Live-Ergebnisse direkt von OpenLigaDB. */
'use strict';
(() => {
  const REPO = 'sneaxx141108-gif/bvb09';
  const FILES = ['status', 'status-pc', 'squads', 'stats', 'history', 'transfers', 'rumors', 'news', 'matches', 'tables', 'u23'];
  const TZ = 'Europe/Berlin';
  const BVB = { name: 'Borussia Dortmund', crest: 'https://tmssl.akamaized.net/images/wappen/head/16.png' };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D = { loaded: false };
  const S = { live: {}, route: null, scroll: {}, lastLoad: 0, tab: 'home' };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const store = {
    get(k, d) { try { const v = localStorage.getItem('bvb09.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('bvb09.' + k, JSON.stringify(v)); } catch (e) { /* privat */ } },
  };
  const UI = Object.assign({ kaderTeam: 'profis', werteTeam: 'profis', spieleTeam: 'profis', vertTeam: 'profis',
    statsTeam: 'profis', newsFilter: 'alle', kaderFilter: 'alle', kaderSearch: '' }, store.get('ui', {}));
  UI.kaderSearch = '';
  const saveUI = () => store.set('ui', UI);

  // ------------------------------------------------------------------ Icons
  const sv = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
  const I = {
    back: sv('<path d="M15 5l-7 7 7 7"/>', 'stroke-width="2.4"'),
    chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    arrow: '<svg class="flow-arrow" viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    check: sv('<path d="M5 12.5 10 17 19 7"/>', 'stroke-width="3"'),
    cal: sv('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
    ai: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c.5 4.9 2.6 7 7.5 7.5v1C14.6 11 12.5 13.1 12 18h-1c-.5-4.9-2.6-7-7.5-7.5v-1C8.4 9 10.5 6.9 11 2z"/><path d="M19 15c.2 2 1 2.8 3 3v.6c-2 .2-2.8 1-3 3h-.6c-.2-2-1-2.8-3-3V18c2-.2 2.8-1 3-3z"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    plus: sv('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.6"'),
    injury: sv('<path d="M12 3v18M3 12h18"/>', 'stroke="#F05252" stroke-width="3"'),
    warn: sv('<path d="M12 3 2 20h20zM12 10v4M12 17h.01"/>', 'stroke="#FFA41B"'),
    ok: sv('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>', 'stroke="#22C55E"'),
    bad: sv('<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>', 'stroke="#F05252"'),
    info: sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    refresh: sv('<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/>'),
    trophy: sv('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>'),
    chart: sv('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    shirt: sv('<path d="M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z"/>'),
    sprout: sv('<path d="M12 21v-9M12 12C12 7 8 5 4 5c0 5 3 7 8 7zM12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/>'),
    cross: sv('<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>'),
    phone: sv('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>'),
    share: sv('<path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
    bolt: sv('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
    gift: sv('<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1s4 1 6 1zM12 8c2-4 6-4 6-1s-4 1-6 1z"/>'),
    clock: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    github: sv('<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.8 2.8 5.8 3.1 5.8 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>'),
  };
  const SIL = '<svg class="tvis-ph" viewBox="0 0 120 140" aria-hidden="true"><circle cx="60" cy="46" r="27" fill="#0A0A0A"/><path d="M6 140c5-36 27-54 54-54s49 18 54 54z" fill="#0A0A0A"/></svg>';
  const SIL_SOFT = SIL.replace(/#0A0A0A/g, '#2A2A2A');

  // ------------------------------------------------------------------ Helfer
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const pad = (n) => String(n).padStart(2, '0');
  const nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
  const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

  function money(v, o = {}) {
    if (v == null || isNaN(v)) return '–';
    const a = Math.abs(v);
    const sign = v < 0 ? '−' : (o.plus && v > 0 ? '+' : '');
    const eur = o.noEur ? '' : ' €';
    if (a >= 1e9) return sign + (o.short ? nf1 : nf2).format(a / 1e9) + ' Mrd.' + eur;
    if (a >= 1e6) return sign + (o.short ? nf1 : nf2).format(a / 1e6) + ' Mio.' + eur;
    if (a >= 1e3) return sign + nf0.format(a / 1e3) + ' Tsd.' + eur;
    return sign + nf0.format(a) + eur;
  }
  const dtf = (o) => new Intl.DateTimeFormat('de-DE', Object.assign({ timeZone: TZ }, o));
  const F = {
    day: dtf({ weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }),
    dayShort: dtf({ weekday: 'short', day: '2-digit', month: '2-digit' }),
    time: dtf({ hour: '2-digit', minute: '2-digit' }),
    date: dtf({ day: '2-digit', month: '2-digit', year: 'numeric' }),
    dm: dtf({ day: '2-digit', month: '2-digit' }),
    ymd: new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }),
  };
  const toDate = (s) => (s && s.length === 10 ? new Date(s + 'T12:00:00Z') : new Date(s));
  const berlinYMD = (d) => F.ymd.format(d instanceof Date ? d : toDate(d));
  function dayLabel(iso) {
    const d = berlinYMD(iso);
    const t = berlinYMD(new Date());
    const tm = berlinYMD(new Date(Date.now() + 864e5));
    const y = berlinYMD(new Date(Date.now() - 864e5));
    if (d === t) return 'Heute';
    if (d === tm) return 'Morgen';
    if (d === y) return 'Gestern';
    return F.day.format(toDate(iso));
  }
  function rel(iso) {
    const t = Date.parse(iso);
    if (isNaN(t)) return '';
    const d = (Date.now() - t) / 1000;
    if (d < 60) return 'gerade eben';
    if (d < 3600) return `vor ${Math.floor(d / 60)} Min.`;
    if (d < 86400) return `vor ${Math.floor(d / 3600)} Std.`;
    const days = Math.floor(d / 86400);
    if (days === 1) return 'gestern';
    if (days < 30) return `vor ${days} Tagen`;
    return F.date.format(new Date(t));
  }
  const fmtDate = (s) => (s ? F.date.format(toDate(s)) : '–');
  const initials = (n) => String(n || '?').split(/[\s-]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const isBVBName = (n) => /Borussia Dortmund$|^BVB$|^Dortmund$/.test(String(n || '').trim());
  function abbr(name) {
    if (!name) return '?';
    if (/Dortmund II/.test(name)) return 'BVB2';
    if (/Dortmund/.test(name)) return 'BVB';
    const skip = /^(FC|SV|VfL|VfB|TSG|SC|AC|AS|CF|FK|SK|RB|BSC|SSV|TSV|FSV|KRC|AFC|CD|SL|OGC|RC|1\.|1|SG|SpVgg|Real|Sporting|Olympique|Club|Borussia|Bor\.)$/;
    const w = name.replace(/[^\p{L}\p{N} .]/gu, ' ').split(/\s+/).filter((x) => x && !skip.test(x));
    return ((w[0] || name).replace(/\./g, '')).slice(0, 3).toUpperCase();
  }
  const pimg = (u, size) => (u ? u.replace(/\/portrait\/(small|medium|header|big)\//, `/portrait/${size}/`) : '');
  function img(src, cls, alt, fb, extra = '') {
    if (!src) return `<span class="fb ${cls}" aria-hidden="true">${esc(fb || '')}</span>`;
    return `<img src="${esc(src)}" class="${cls}" alt="${esc(alt || '')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fb="${esc(fb || '')}" ${extra}>`;
  }
  function crest(club, cls = 'crest') {
    if (!club || !club.name) return `<span class="fb ${cls}" aria-hidden="true">?</span>`;
    let src = club.crest || club.icon;
    if (isBVBName(club.name)) src = BVB.crest;
    if (!src) return `<span class="fb ${cls} ${isBVBName(club.name) ? 'bvb' : ''}" aria-hidden="true">${esc(abbr(club.name))}</span>`;
    return img(src, cls, club.name, abbr(club.name));
  }
  const tname = (t) => (!t ? '?' : isBVBName(t.name) ? 'BVB' : /Dortmund II/.test(t.name) ? 'BVB II' : (t.short || t.name));
  const compShort = (c) => ({ 'Champions League': 'CL', 'DFB-Pokal': 'Pokal', 'Bundesliga': 'BL', 'Europa League': 'EL', 'Conference League': 'ECL', 'Supercup': 'Supercup' }[c] || c || '');
  const flagImgs = (flags) => (flags || []).map((f) => `<img class="flag" src="${esc(f.img)}" alt="${esc(f.name)}" title="${esc(f.name)}" loading="lazy" referrerpolicy="no-referrer">`).join(' ');

  // Fallbacks fuer kaputte Bilder
  document.addEventListener('error', (e) => {
    const el = e.target;
    if (!el || el.tagName !== 'IMG' || !('fb' in el.dataset)) return;
    if (el.classList.contains('tvis-img') || el.classList.contains('phero-img')) {
      const wrap = document.createElement('span');
      wrap.innerHTML = el.closest('.soft') ? SIL_SOFT : SIL;
      el.replaceWith(wrap.firstChild);
      return;
    }
    const span = document.createElement('span');
    span.className = 'fb ' + el.className;
    span.textContent = el.dataset.fb || '';
    span.setAttribute('aria-hidden', 'true');
    el.replaceWith(span);
  }, true);

  // ------------------------------------------------------------------ Datenzugriff
  const teams = () => (D.squads && D.squads.teams) || {};
  const team = (k) => teams()[k] || { players: [] };
  function allPlayers() {
    const out = [];
    for (const [k, t] of Object.entries(teams())) for (const p of t.players || []) out.push(Object.assign({ team: k }, p));
    return out;
  }
  const findPlayer = (k, id) => (team(k).players || []).find((p) => p.id === id);
  function playerByName(name) {
    const s = slug(name);
    return allPlayers().find((p) => slug(p.name) === s) || null;
  }
  const TEAMNAME = { profis: 'Profis', u23: 'BVB II', u19: 'U19' };

  // Tore live aus den Spielberichten (OpenLigaDB) – laufen weiter, auch wenn Transfermarkt nicht erreichbar ist
  function liveGoals() {
    if (S._lg && S._lgKey === S.lastLoad + Object.keys(S.live).length) return S._lg;
    const by = {};
    for (const m of matchList('profis')) {
      if (!m.goals) continue;
      const mine = m.isHome ? 'home' : 'away';
      for (const g of m.goals) {
        if (g.ownGoal || g.team !== mine || !g.scorer) continue;
        const last = slug(g.scorer).split('-').pop();
        by[last] = (by[last] || 0) + 1;
      }
    }
    S._lg = by;
    S._lgKey = S.lastLoad + Object.keys(S.live).length;
    return by;
  }
  function statsOf(k, id) {
    const st = (((D.stats || {}).teams || {})[k] || {})[id];
    if (k !== 'profis') return st;
    const p = findPlayer(k, id);
    if (!p) return st;
    const last = slug(p.name).split('-').pop();
    const same = (team('profis').players || []).filter((x) => slug(x.name).split('-').pop() === last).length;
    const g = same === 1 ? liveGoals()[last] || 0 : 0;
    if (!st) return g ? { goals: g, apps: 0, assists: 0, minutes: 0 } : st;
    return g > (st.goals || 0) ? Object.assign({}, st, { goals: g }) : st;
  }
  // Ausfaelle: Transfermarkt-Stand + neuere Gemini-Verletzungsnews ("wieder fit" / neue Verletzung)
  function absencesOf(p) {
    const base = (p.absences || []).slice();
    const tmDate = (((D['status-pc'] || {}).lastRun) || (D.squads || {}).updatedAt || '').slice(0, 10);
    const news = ((D.news || {}).injuryNews || []).filter((n) => slug(n.player) === slug(p.name)).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    if (!news || String(news.date) < tmDate) return base;
    if (news.status === 'fit' || news.status === 'back') return base.filter((a) => a.type === 'ineligible');
    if (news.status === 'injured' && !base.some((a) => a.type === 'injury')) base.push({ type: 'injury', text: (news.text || 'verletzt') + (news.source ? ` (laut ${news.source})` : ''), ai: true });
    return base;
  }
  const isOut = (p) => absencesOf(p).some((a) => a.type !== 'ineligible');

  const matchList = (k) => (k === 'u23' ? ((D.u23 || {}).matches || (D.matches || {}).u23 || []) : ((D.matches || {}).profis || [])).map(withLive);
  function withLive(m) {
    const l = S.live[m.id];
    return l ? Object.assign({}, m, l) : m;
  }
  function isLive(m) {
    if (m.finished) return false;
    const t = Date.parse(m.date);
    return t <= Date.now() && Date.now() - t < 150 * 60e3 && (m.oldbId || m.live);
  }
  function nextMatch(k) {
    return matchList(k).find((m) => !m.finished && Date.parse(m.date) > Date.now() - 150 * 60e3);
  }
  function lastMatch(k) {
    const f = matchList(k).filter((m) => m.finished && m.score);
    return f[f.length - 1];
  }
  const formOf = (k, n = 5) => matchList(k).filter((m) => m.finished && m.outcome).slice(-n).map((m) => m.outcome);
  const FORM_L = { W: 'S', D: 'U', L: 'N' };
  const FORM_T = { W: 'Sieg', D: 'Unentschieden', L: 'Niederlage' };
  const formHtml = (f, lg) => `<span class="form ${lg ? 'lg' : ''}" role="img" aria-label="Form: ${f.map((x) => FORM_T[x]).join(', ') || 'keine Spiele'}">${f.map((x) => `<i class="${x}">${FORM_L[x]}</i>`).join('')}</span>`;

  function scorers(m) {
    const mine = m.isHome ? 'home' : 'away';
    const c = {};
    for (const g of m.goals || []) {
      if (g.ownGoal ? g.team === mine : g.team !== mine) continue;
      const n = (g.scorer || '').split(' ').slice(-1)[0] || '?';
      c[n] = (c[n] || 0) + 1;
    }
    return Object.entries(c).map(([n, k]) => (k > 1 ? `${n} (${k})` : n)).join(', ');
  }

  // ------------------------------------------------------------------ Transfer-Feed
  const STATUS = {
    official: { label: 'OFFIZIELL', big: true, stamp: 'HERE<br>WE GO!' },
    herewego: { label: 'HERE WE GO', big: true, stamp: 'HERE<br>WE GO!' },
    extension: { label: 'VERLÄNGERT', big: true, stamp: 'VERLÄN-<br>GERT!' },
    loanEnd: { label: 'RÜCKKEHR', big: false },
    advanced: { label: 'FORTGESCHRITTEN', big: false },
    talks: { label: 'GESPRÄCHE', big: false },
    interest: { label: 'INTERESSE', big: false },
    denied: { label: 'DEMENTI', big: false },
    rumor: { label: 'GERÜCHT', big: false },
  };
  function transferFeed() {
    const out = [];
    const seen = new Set();
    const players = allPlayers();
    const byId = new Map(players.map((p) => [p.id, p]));
    const news = D.news || {};
    for (const s of news.stories || []) {
      const info = s.playerInfo || {};
      const sp = (info.id && byId.get(info.id)) || playerByName(s.player);
      const dir = s.direction || 'in';
      const other = s.otherClub && s.otherClub.name ? s.otherClub : null;
      out.push({
        key: slug(s.player) + '|' + dir, kind: 'story', status: s.status || 'interest', dir, name: s.player, role: s.role,
        img: pimg(info.img || (sp && sp.img), 'big'), number: sp && sp.number, age: info.age || (sp && sp.age),
        position: info.position || (sp && sp.position) || (s.role && s.role !== 'Spieler' ? s.role : ''),
        from: dir === 'in' ? other : BVB, to: dir === 'out' ? other : BVB,
        fee: s.fee, feeValue: s.feeValue, bonus: s.bonus, contract: s.contractUntil, loan: s.loan,
        value: info.value || (sp && sp.value), source: s.source, tier: s.tier, date: s.date || s.updatedAt,
        summary: s.summary, updates: s.updates || [], links: s.links || [], playerId: info.id || (sp && sp.id), team: sp && sp.team,
      });
      seen.add(slug(s.player) + '|' + (dir === 'extension' ? 'in' : dir));
    }
    const tr = D.transfers || {};
    for (const [dir, list] of [['in', tr.in || []], ['out', tr.out || []]]) {
      for (const t of list) {
        const key = slug(t.name) + '|' + dir;
        if (seen.has(key)) {
          const st = out.find((o) => o.key === key);
          if (st && !st.fee && t.fee) { st.fee = t.fee; st.feeValue = t.feeValue; }
          continue;
        }
        seen.add(key);
        const sp = byId.get(t.id);
        const date = (sp && sp.newSigning && sp.newSigning.date) || null;
        out.push({
          key, kind: 'official', status: t.loanEnd ? 'loanEnd' : 'official', dir, name: t.name, img: pimg(t.img, 'big'),
          age: t.age, position: t.position, flags: t.flags, from: dir === 'in' ? t.club : BVB, to: dir === 'in' ? BVB : t.club,
          fee: t.fee, feeValue: t.feeValue, loan: t.loan, contract: sp && sp.contract ? sp.contract.slice(0, 4) : null,
          value: sp && sp.value, source: 'Transfermarkt', tier: 1, date, playerId: t.id, team: sp && sp.team, number: sp && sp.number,
        });
      }
    }
    for (const r of (D.rumors || {}).items || []) {
      const key = slug(r.name) + '|in';
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key, kind: 'rumor', status: 'rumor', dir: 'in', name: r.name, img: pimg(r.img, 'big'), age: r.age, position: r.position,
        flags: r.flags, from: r.club, to: BVB, value: r.value, probability: r.probability, trend: r.trend,
        source: 'TM-Gerüchteküche', tier: 2, date: r.lastSource, url: r.url, playerId: r.id,
      });
    }
    out.sort((a, b) => String(b.date || '0').localeCompare(String(a.date || '0')));
    return out;
  }

  function ampel(it) {
    let t = it.tier === 1 ? 1 : 2;
    let txt = `Stufe ${t} · ${it.source || 'Quelle'}`;
    if (it.kind === 'official') { t = 1; txt = 'Offiziell bestätigt · Transfermarkt'; }
    if (it.kind === 'rumor') txt = 'Stufe 2 · TM-Gerüchteküche';
    if (it.status === 'denied') t = 3;
    return `<span class="ampel t${t}"><i aria-hidden="true"><b></b><b></b><b></b></i>${esc(txt)}</span>`;
  }

  function statusBadge(it) {
    const st = STATUS[it.status] || STATUS.interest;
    if (it.status === 'official') return `<span class="badge dark" style="color:var(--green)">${I.check}OFFIZIELL</span>`;
    if (it.status === 'herewego') return `<span class="badge dark">FIX LAUT ${esc((it.source || 'QUELLE').toUpperCase())}</span>`;
    if (it.status === 'extension') return `<span class="badge dark" style="color:var(--green)">${I.check}VERTRAG VERLÄNGERT</span>`;
    if (it.status === 'denied') return '<span class="badge red">DEMENTI</span>';
    if (it.status === 'rumor') return `<span class="badge amber">GERÜCHT${it.probability != null ? ' · ' + it.probability + ' %' : ''}</span>`;
    if (it.status === 'loanEnd') return '<span class="badge amber">RÜCKKEHR · LEIH-ENDE</span>';
    return `<span class="badge amber">${st.label}</span>`;
  }

  function tCard(it, idx) {
    const st = STATUS[it.status] || STATUS.interest;
    const big = st.big;
    const cls = ['tcard', big ? 'hwg' : 'soft', it.status === 'denied' ? 'denied' : ''].join(' ');
    const ph = big ? SIL : SIL_SOFT;
    const imgHtml = it.img ? img(it.img, 'tvis-img', it.name, 'sil') : ph;
    let stats;
    if (it.kind === 'rumor') {
      stats = `<div><span>Marktwert</span><b>${money(it.value, { short: 1 })}</b></div>
        <div><span>Chance</span><b class="amber">${it.probability != null ? it.probability + ' %' : '–'}</b>${it.probability != null ? `<span class="bar amber" style="margin-top:3px"><span style="width:${Math.min(100, it.probability)}%"></span></span>` : ''}</div>
        <div><span>Quelle</span><b>${it.date ? F.dm.format(toDate(it.date)) : '–'}</b></div>`;
    } else {
      const feeLabel = it.loan ? 'Leihgebühr' : 'Ablöse';
      const fee = it.feeValue ? money(it.feeValue, { short: 1 }) : (it.fee && it.fee !== '-' && it.fee !== '?' ? String(it.fee).replace(/^Leihgebühr:\s*/, '') : 'k. A.');
      const third = it.contract ? `<div><span>Vertrag</span><b>bis ${esc(String(it.contract).slice(0, 4))}</b></div>`
        : `<div><span>Marktwert</span><b>${money(it.value, { short: 1 })}</b></div>`;
      stats = `<div><span>${feeLabel}</span><b class="${big ? 'yellow' : ''}">${esc(fee)}</b></div>
        <div><span>Boni</span><b>${esc(it.bonus || 'k. A.')}</b></div>${third}`;
    }
    const meta = [it.age ? it.age + ' Jahre' : '', it.position, it.flags && it.flags[0] ? it.flags[0].name : ''].filter(Boolean).join(' · ');
    const more = (it.updates && it.updates.length > 1) || (it.links && it.links.length) || it.url;
    return `<article class="${cls}" data-k="${esc(it.key)}">
      <div class="tvis">
        ${big ? '<div class="tvis-band"></div>' : '<div class="tvis-frame"></div>'}
        <div class="tvis-num">${esc(it.number || '')}</div>
        ${imgHtml}
        ${st.stamp ? `<div class="stamp">${st.stamp}</div>` : ''}
        <span class="tbadge">${statusBadge(it)}</span>
        <div class="flow">${crest(it.from)}<span class="flow-line"></span>${I.arrow}${crest(it.to)}</div>
      </div>
      <div class="tbody">
        <div>
          ${it.playerId && it.team ? `<a href="#/spieler/${it.team}/${it.playerId}" class="tname" style="color:inherit;display:block">${esc(it.name)}</a>` : `<h3 class="tname">${esc(it.name)}</h3>`}
          <div class="tmeta">${esc(meta || (it.from ? (it.dir === 'in' ? 'von ' : 'zu ') + (it.dir === 'in' ? it.from.name : (it.to && it.to.name) || '') : ''))}</div>
        </div>
        <div class="tstats">${stats}</div>
        ${it.summary ? `<p class="tsum">${esc(it.summary)}</p>` : ''}
        <div class="tfoot">${ampel(it)}<span>${it.date ? esc(fmtDate(it.date)) : ''}</span></div>
        ${more ? `<button type="button" class="btn ghost" data-action="tmore" aria-expanded="false" style="min-height:38px;font-size:12px">Quellen &amp; Verlauf</button>
        <div class="tmore" hidden>
          ${(it.updates || []).map((u) => `<div class="tl"><time>${esc(u.date ? F.dm.format(toDate(u.date)) : '')}</time><span><b>${esc((STATUS[u.status] || {}).label || '')}</b> ${esc(u.text || '')}${u.source ? ` <span class="faint">(${esc(u.source)})</span>` : ''}</span></div>`).join('')}
          ${(it.links || []).map((l) => `<a class="src-link" href="${esc(l.url)}" target="_blank" rel="noopener"><span class="ellipsis">${esc(l.title)}</span><span class="faint" style="flex:none">${esc(l.outlet || '')}</span>${I.ext}</a>`).join('')}
          ${it.url ? `<a class="src-link" href="${esc(it.url)}" target="_blank" rel="noopener"><span>Zur Diskussion auf Transfermarkt</span>${I.ext}</a>` : ''}
        </div>` : ''}
      </div>
    </article>`;
  }

  function tRow(it) {
    const b = it.status === 'official' || it.status === 'herewego' ? '<span class="badge green">' + (it.status === 'official' ? 'OFFIZIELL' : 'HERE WE GO') + '</span>'
      : it.status === 'extension' ? '<span class="badge green">VERLÄNGERT</span>'
        : it.status === 'denied' ? '<span class="badge red">DEMENTI</span>'
          : `<span class="badge amber">${it.status === 'rumor' && it.probability != null ? it.probability + ' %' : 'GERÜCHT'}</span>`;
    const arrow = it.dir === 'out' ? `BVB → ${esc((it.to && it.to.name) || '?')}` : it.dir === 'extension' ? 'verlängert beim BVB' : `${esc((it.from && it.from.name) || '?')} → BVB`;
    const extra = it.fee && it.kind !== 'rumor' ? ' · ' + esc(String(it.fee).replace(/^Leihgebühr:\s*/, '')) : '';
    return `<a href="#/transfers/news" class="card tight card-link ticker-row row">
      ${img(pimg(it.img, 'medium'), 'avatar', it.name, initials(it.name))}
      <span class="grow-1" style="display:flex;flex-direction:column;gap:2px;min-width:0"><b class="ellipsis" style="font-size:14px">${esc(it.name)}</b><span class="muted ellipsis" style="font-size:12px">${arrow}${extra}</span></span>
      ${b}</a>`;
  }

  // ------------------------------------------------------------------ gemeinsame Bausteine
  function brand() {
    const st = D.status || {};
    const age = st.lastRun ? (Date.now() - Date.parse(st.lastRun)) / 36e5 : 99;
    const dc = age < 9 ? 'pulse' : age < 24 ? 'amber' : 'red';
    return `<header class="brand">
      <div class="brand-l">
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#FDE100"/><circle cx="20" cy="20" r="16" fill="none" stroke="#0A0A0A" stroke-width="2"/><text x="20" y="21" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="12" fill="#0A0A0A">BVB</text><text x="20" y="30" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="8" fill="#0A0A0A">09</text></svg>
        <div><div class="brand-name">BVB 09</div><div class="brand-sub">Inoffizielle Fan-App</div></div>
      </div>
      <a class="upd press" href="#/mehr/update" aria-label="Update-Zentrale öffnen">
        <span class="dot ${dc}"></span>
        <span class="upd-t"><b data-rel="${esc(st.lastRun || '')}">${st.lastRun ? rel(st.lastRun) : 'kein Update'}</b><span>${st.changes ? st.changes.total + ' Änderungen' : 'Update-Zentrale'}</span></span>
      </a>
    </header>`;
  }
  function pageHead(title, sub, right = '', back = '') {
    return `<header class="page-h">
      ${back ? `<button type="button" class="back" data-action="back" data-fallback="${esc(back)}">${I.back}<span>Zurück</span></button>` : ''}
      <div class="page-h-row"><h1>${esc(title)}</h1>${right}</div>
      ${sub ? `<div class="sub">${sub}</div>` : ''}
    </header>`;
  }
  function seg(items, active) {
    return `<nav class="seg" aria-label="Bereiche">${items.map(([k, label, href]) => `<a href="${href}" class="${k === active ? 'on' : ''}" ${k === active ? 'aria-current="page"' : ''}>${esc(label)}</a>`).join('')}</nav>`;
  }
  function teamSwitch(key, opts) {
    return `<div class="teams" role="group" aria-label="Mannschaft">${opts.map(([k, label, sub]) => `<button type="button" class="${UI[key] === k ? 'on' : ''}" aria-pressed="${UI[key] === k}" data-action="team" data-key="${key}" data-val="${k}"><b>${esc(label)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</button>`).join('')}</div>`;
  }
  const countEl = (v, fmt, cls = '') => `<span class="${cls}" data-count="${v}" data-fmt="${fmt}">${fmt === 'money' ? money(v) : nf0.format(v)}</span>`;
  function countdownHtml(iso) {
    let s = Math.max(0, Math.floor((Date.parse(iso) - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const mi = Math.floor(s / 60);
    const se = s % 60;
    return `<div><b>${pad(d)}</b><span>Tage</span></div><div><b>${pad(h)}</b><span>Std.</span></div><div><b>${pad(mi)}</b><span>Min.</span></div><div><b>${pad(se)}</b><span>Sek.</span></div>`;
  }
  function spark(series, w = 326, h = 100) {
    const pts = (series || []).filter((p) => p && p[1] != null).map((p) => [Date.parse(p[0] + 'T12:00:00Z'), p[1]]);
    if (pts.length < 2) return '';
    const x0 = pts[0][0];
    const x1 = pts[pts.length - 1][0];
    const vmax = Math.max(...pts.map((p) => p[1])) || 1;
    const base = h - 18;
    const X = (t) => 2 + ((t - x0) / ((x1 - x0) || 1)) * (w - 8);
    const Y = (v) => base - (v / vmax) * (base - 10);
    const line = pts.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1];
    const y0 = new Date(x0).getFullYear();
    const y1 = new Date(x1).getFullYear();
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="Marktwert-Verlauf von ${esc(money(pts[0][1]))} (${y0}) bis ${esc(money(last[1]))} (${y1})">
      <line x1="0" y1="${base}" x2="${w}" y2="${base}" stroke="#2A2A2A"/>
      <polygon points="${line} ${X(x1).toFixed(1)},${base} ${X(x0).toFixed(1)},${base}" fill="rgba(253,225,0,0.10)"/>
      <polyline class="ln" points="${line}" fill="none" stroke="#FDE100" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle class="ping" cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="4" fill="#FDE100"/>
      <circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="4" fill="#FDE100"/>
      <text x="0" y="${h - 3}" font-size="10" fill="#8C8C8C" font-family="Inter, sans-serif">${y0}</text>
      <text x="${w}" y="${h - 3}" font-size="10" fill="#8C8C8C" font-family="Inter, sans-serif" text-anchor="end">${y1}</text>
      <text x="0" y="9" font-size="10" fill="#8C8C8C" font-family="Inter, sans-serif">max. ${esc(money(vmax, { short: 1 }))}</text>
    </svg>`;
  }

  // ------------------------------------------------------------------ Home
  const HISTORY = [
    ['12-19', 1909, 'Gründung des BV Borussia 09 Dortmund'],
    ['05-22', 1965, 'Erster DFB-Pokalsieg: 2:0 gegen Alemannia Aachen'],
    ['05-05', 1966, 'Europapokal der Pokalsieger: 2:1 n. V. gegen den FC Liverpool in Glasgow'],
    ['04-02', 1974, 'Eröffnung des Westfalenstadions – heute Signal Iduna Park'],
    ['06-24', 1989, 'DFB-Pokalsieg: 4:1 gegen Werder Bremen in Berlin'],
    ['05-28', 1997, 'Champions-League-Sieg: 3:1 gegen Juventus Turin in München'],
    ['12-02', 1997, 'Weltpokalsieg: 2:0 gegen Cruzeiro Belo Horizonte in Tokio'],
    ['05-04', 2002, 'Deutscher Meister nach 2:1 gegen Werder Bremen am letzten Spieltag'],
    ['04-30', 2011, 'Meisterschaft perfekt: 2:0 gegen den 1. FC Nürnberg'],
    ['04-21', 2012, 'Meisterschaft perfekt: 2:0 gegen Borussia Mönchengladbach'],
    ['05-12', 2012, 'Das Double: 5:2 gegen den FC Bayern im DFB-Pokalfinale'],
    ['05-25', 2013, 'Champions-League-Finale in Wembley gegen den FC Bayern (1:2)'],
    ['05-27', 2017, 'DFB-Pokalsieg: 2:1 gegen Eintracht Frankfurt'],
    ['05-13', 2021, 'DFB-Pokalsieg: 4:1 gegen RB Leipzig'],
    ['06-01', 2024, 'Champions-League-Finale in Wembley gegen Real Madrid (0:2)'],
  ];
  function historyItem() {
    const today = berlinYMD(new Date());
    const y = +today.slice(0, 4);
    const md = today.slice(5);
    const hit = HISTORY.find((h) => h[0] === md);
    if (hit) return { today: true, years: y - hit[1], h: hit };
    let best = null;
    for (const h of HISTORY) {
      let d = new Date(`${y}-${h[0]}T12:00:00Z`);
      if (berlinYMD(d) < today) d = new Date(`${y + 1}-${h[0]}T12:00:00Z`);
      const days = Math.round((d - toDate(today)) / 864e5);
      if (!best || days < best.days) best = { days, h, years: d.getUTCFullYear() - h[1] };
    }
    return best;
  }
  function windowInfo() {
    const now = Date.now();
    const y = new Date().getFullYear();
    const wins = [[y - 1, '07-01', '09-01', 'Sommer'], [y, '01-01', '02-02', 'Winter'], [y, '07-01', '09-01', 'Sommer'], [y + 1, '01-01', '02-02', 'Winter']];
    for (const [yy, a, b, n] of wins) {
      const A = Date.parse(`${yy}-${a}T00:00:00+01:00`);
      const B = Date.parse(`${yy}-${b}T23:59:00+01:00`);
      if (now >= A && now <= B) return { open: true, name: n, days: Math.ceil((B - now) / 864e5), date: `${b.slice(3)}.${b.slice(0, 2)}.` };
      if (now < A) return { open: false, name: n, days: Math.ceil((A - now) / 864e5), date: `${a.slice(3)}.${a.slice(0, 2)}.` };
    }
    return null;
  }
  function birthdays() {
    const today = berlinYMD(new Date()).slice(5);
    const soon = [];
    const seen = new Set();
    for (const p of allPlayers()) {
      if (!p.birth || seen.has(p.id)) continue;
      seen.add(p.id);
      for (let i = 0; i < 7; i++) {
        const md = berlinYMD(new Date(Date.now() + i * 864e5)).slice(5);
        if (p.birth.slice(5) === md) { soon.push({ p, days: i, age: (p.age || 0) + (i === 0 && p.birth.slice(5) === today ? 0 : 1) }); break; }
      }
    }
    return soon.sort((a, b) => a.days - b.days);
  }

  function vHome() {
    const nm = nextMatch('profis');
    const lm = lastMatch('profis');
    const bl = ((D.tables || {}).bl1 || {}).rows || [];
    const me = bl.find((r) => r.isBVB);
    const fm = formOf('profis');
    const brief = (D.news || {}).briefing;
    const pro = team('profis');
    const feed = transferFeed().slice(0, 3);
    const missing = allPlayers().filter((p) => p.team === 'profis' && isOut(p));
    const up = pro.players.filter((p) => p.prevValue && p.value > p.prevValue).length;
    const down = pro.players.filter((p) => p.prevValue && p.value < p.prevValue).length;
    const win = windowInfo();
    const hist = historyItem();
    const bdays = birthdays();
    let out = brand();
    if (brief && brief.text) {
      out += `<section class="card briefing" style="margin-bottom:12px">
        <div class="row" style="margin-bottom:8px"><span class="ai-ico">${I.ai}</span><span class="grow-1"><b style="font-size:14px">KI-Briefing</b><div class="faint" style="font-size:11px">Gemini · ${esc(rel(brief.at))}</div></span></div>
        <p>${esc(brief.text)}</p></section>`;
    }
    out += nm ? heroMatch(nm) : `<section class="hero"><div class="hero-deco"></div><span class="label">Spielplan</span><b class="big">Keine Spiele geplant</b></section>`;
    out += `<div class="grid2" style="margin-top:12px">${lastCard(lm)}${tableCard(me, fm)}</div>`;
    out += `<section class="section"><div class="section-h"><h2>Transfer-Ticker</h2><a href="#/transfers/news">Alle anzeigen</a></div>
      ${feed.length ? feed.map(tRow).join('') : '<div class="empty">Noch keine Transfer-News – das nächste Update kommt bald.</div>'}</section>`;
    out += `<div class="grid2" style="margin-top:12px">
      <a class="card card-link" href="#/transfers/werte" style="display:flex;flex-direction:column;gap:4px">
        <span class="label">Kaderwert</span>${countEl(pro.totalValue || 0, 'money', 'display" style="font-size:24px;line-height:1.05')}
        <span style="font-size:11px" class="muted"><span class="green" style="font-weight:600">▲ ${up}</span> gestiegen · <span class="red" style="font-weight:600">▼ ${down}</span> gefallen</span>
      </a>
      <a class="card card-link" href="#/mehr/lazarett" style="display:flex;flex-direction:column;gap:6px">
        <span class="label">Lazarett</span>
        <span class="stack-av">${missing.slice(0, 5).map((p) => img(pimg(p.img, 'medium'), 'avatar xs', p.name, initials(p.name))).join('') || '<span class="green" style="font-weight:700">Alle fit</span>'}</span>
        <span style="font-size:11px" class="muted">${missing.length ? `${missing.filter((p) => absencesOf(p).some((a) => a.type === 'injury')).length} verletzt · ${missing.filter((p) => absencesOf(p).some((a) => a.type === 'suspension' || a.type === 'out')).length} gesperrt/fehlt` : 'Keine Ausfälle gemeldet'}</span>
      </a></div>`;
    if (bdays.length) {
      const b = bdays[0];
      out += `<a class="card card-link row" href="#/spieler/${b.p.team}/${b.p.id}" style="margin-top:12px">
        <span class="ai-ico" style="animation:none">${I.gift}</span>
        <span class="grow-1"><b style="font-size:14px">${b.days === 0 ? 'Heute Geburtstag!' : `In ${b.days} ${b.days === 1 ? 'Tag' : 'Tagen'} Geburtstag`}</b>
        <div class="muted" style="font-size:12px">${esc(b.p.name)} (${esc(TEAMNAME[b.p.team])}) wird ${b.days === 0 ? b.p.age : (b.p.age || 0) + 1}</div></span>${I.chev}</a>`;
    }
    if (win) {
      out += `<section class="card row" style="margin-top:12px">
        <span class="ai-ico" style="animation:none">${I.cal}</span>
        <span class="grow-1"><b style="font-size:14px">${win.open ? `${win.name}-Transferfenster ist offen` : `${win.name}-Transferfenster öffnet`}</b>
        <div class="muted" style="font-size:12px">${win.open ? `schließt in ${win.days} Tagen (ca. ${win.date})` : `in ${win.days} Tagen (ca. ${win.date})`}</div></span>
        <b class="display yellow" style="font-size:28px">${win.days}</b></section>`;
    }
    if (hist) {
      out += `<a class="card card-link" href="#/mehr/erfolge" style="margin-top:12px;display:flex;flex-direction:column;gap:4px">
        <span class="label">${hist.today ? `Heute vor ${hist.years} Jahren` : `In ${hist.days} ${hist.days === 1 ? 'Tag' : 'Tagen'}: ${hist.years} Jahre`}</span>
        <b style="font-size:14px">${esc(hist.h[2])}</b><span class="faint" style="font-size:12px">${esc(hist.h[0].slice(3))}.${esc(hist.h[0].slice(0, 2))}.${hist.h[1]}</span></a>`;
    }
    out += `<p class="faint" style="font-size:11px;text-align:center;margin-top:20px">Daten: Transfermarkt · OpenLigaDB · Google News · Gemini-KI<br>Inoffizielle Fan-App – nicht verbunden mit Borussia Dortmund</p>`;
    return out;
  }

  function heroMatch(m) {
    const live = isLive(m);
    const lbl = `${m.comp || ''}${m.round ? ' · ' + m.round : ''}`.toUpperCase();
    const today = berlinYMD(m.date) === berlinYMD(new Date());
    const score = m.score ? `${m.score[0]}:${m.score[1]}` : '0:0';
    const goals = (m.goals || []).slice(-4).map((g) => `<div class="goal ${g.team === 'away' ? 'away' : ''}"><time>${g.minute != null ? g.minute + "'" : ''}</time><span>${esc(g.scorer || 'Tor')}</span><b>${esc(g.score || '')}</b></div>`).join('');
    return `<a class="hero card-link ${live ? 'live' : ''}" href="#/spiele/profis/kommend">
      <div class="hero-deco"></div><div class="hero-deco2"></div>
      <div class="row" style="justify-content:space-between">${live ? '<span class="live-badge">LIVE</span>' : `<span class="badge y">${esc(lbl)}</span>`}<span class="label">${live ? esc(m.comp) : today ? 'Heute' : 'Nächstes Spiel'}</span></div>
      <div class="vs-row">
        <div class="vs-team">${crest(m.home, 'crest lg')}<span>${esc(tname(m.home))}</span></div>
        <div class="vs-mid">${live ? `<span class="score">${score}</span><span class="label">läuft</span>` : `<span class="vs">VS</span><span class="label">${m.isHome ? 'Heimspiel' : 'Auswärts'}</span>`}</div>
        <div class="vs-team">${crest(m.away, 'crest lg')}<span>${esc(tname(m.away))}</span></div>
      </div>
      <div class="muted" style="text-align:center;font-size:12px">${esc(dayLabel(m.date))} · ${m.timeKnown === false ? 'Uhrzeit offen' : esc(F.time.format(new Date(m.date))) + ' Uhr'}${m.location ? ' · ' + esc(m.location) : ''}</div>
      ${live ? (goals ? `<div class="goals">${goals}</div>` : '<div class="muted" style="text-align:center;font-size:12px">Noch keine Tore</div>') : `<div class="countdown" data-countdown="${esc(m.date)}">${countdownHtml(m.date)}</div>`}
    </a>`;
  }
  function lastCard(m) {
    if (!m) return '<div class="card"><span class="label">Letztes Spiel</span><p class="muted" style="margin-top:6px">–</p></div>';
    const o = { W: '<span class="badge green">SIEG</span>', D: '<span class="badge">REMIS</span>', L: '<span class="badge red">NIEDERLAGE</span>' }[m.outcome] || '';
    const sc = scorers(m);
    return `<a class="card card-link" href="#/spiele/profis/ergebnisse" style="display:flex;flex-direction:column;gap:6px">
      <span class="label">Letztes Spiel · ${esc(compShort(m.comp))}</span>
      <span class="display" style="font-size:22px;line-height:1">${esc(tname(m.home))} <span class="yellow">${m.score[0]}:${m.score[1]}</span> ${esc(tname(m.away))}</span>
      <span class="row" style="gap:6px;font-size:11px">${o}<span class="muted ellipsis">${esc(sc || F.dm.format(new Date(m.date)))}</span></span></a>`;
  }
  function tableCard(me, fm) {
    if (!me) return '<div class="card"><span class="label">Bundesliga</span><p class="muted" style="margin-top:6px">–</p></div>';
    return `<a class="card card-link" href="#/spiele/profis/tabelle" style="display:flex;flex-direction:column;gap:6px">
      <span class="label">Bundesliga</span>
      <span class="row" style="gap:6px;align-items:baseline"><b class="display yellow" style="font-size:30px;line-height:1">${me.pos}.</b><span class="muted" style="font-size:12px">${me.points} Pkt. · ${me.goals}:${me.against}</span></span>
      ${formHtml(fm)}</a>`;
  }

  // ------------------------------------------------------------------ Transfers
  function vTransfers(sub) {
    const win = windowInfo();
    const right = win ? `<span class="pill">${I.cal}${win.open ? `Fenster offen · ${win.days} T.` : `Fenster in ${win.days} T.`}</span>` : '';
    let out = pageHead('Transfers', '', right);
    out += seg([['news', 'News', '#/transfers/news'], ['werte', 'Marktwerte', '#/transfers/werte'], ['bilanz', 'Bilanz', '#/transfers/bilanz'], ['vertraege', 'Verträge', '#/transfers/vertraege']], sub);
    if (sub === 'werte') out += vWerte();
    else if (sub === 'bilanz') out += vBilanz();
    else if (sub === 'vertraege') out += vVertraege();
    else out += vNews();
    return out;
  }

  function vNews() {
    const all = transferFeed();
    const f = UI.newsFilter;
    const FIL = [['alle', 'Alle'], ['in', 'Zugänge'], ['out', 'Abgänge'], ['hwg', 'Here we go'], ['geruechte', 'Gerüchte'], ['verl', 'Verlängerungen']];
    const pick = (it) => f === 'alle' || (f === 'in' && it.dir === 'in') || (f === 'out' && it.dir === 'out')
      || (f === 'hwg' && (it.status === 'official' || it.status === 'herewego'))
      || (f === 'geruechte' && ['rumor', 'interest', 'talks', 'advanced'].includes(it.status))
      || (f === 'verl' && it.status === 'extension');
    const items = all.filter(pick);
    const gem = (D.news || {}).gemini || {};
    const heads = (D.news || {}).headlines || [];
    let out = `<div class="chips" style="margin-top:12px" role="group" aria-label="Filter">${FIL.map(([k, l]) => `<button type="button" class="${f === k ? 'on' : ''}" aria-pressed="${f === k}" data-action="filter" data-val="${k}">${l}</button>`).join('')}</div>`;
    out += `<div class="row faint" style="font-size:11px;margin:10px 0 2px;gap:6px"><span class="ai-ico" style="width:20px;height:20px;border-radius:6px;animation:none">${I.ai}</span>${gem.lastSuccess ? `Gemini hat ${esc(rel(gem.lastSuccess))} ${gem.headlinesAnalyzed || gem.headlines || ''} Meldungen ausgewertet` : 'Gemini startet beim nächsten Update bei GitHub'}</div>`;
    out += `<div class="stack" style="margin-top:10px">${items.length ? items.slice(0, 40).map(tCard).join('') : '<div class="empty">Keine Einträge für diesen Filter.</div>'}</div>`;
    if (heads.length) {
      out += `<section class="section"><div class="section-h"><h2>Schlagzeilen</h2><span class="faint" style="font-size:11px">nur vertrauenswürdige Medien</span></div>
        <div class="card" style="padding:4px 14px">${heads.slice(0, 25).map((h) => `<a class="headline" href="${esc(h.url)}" target="_blank" rel="noopener">
          <span class="ampel t${h.tier === 1 ? 1 : 2}" style="margin-top:4px"><i aria-hidden="true"><b></b><b></b><b></b></i></span>
          <span class="grow-1"><div class="h-t">${esc(h.title)}</div><div class="h-m">${esc(h.outlet)} · ${esc(rel(h.date))}</div></span></a>`).join('')}</div></section>`;
    }
    return out;
  }

  function vWerte() {
    const k = UI.werteTeam;
    const t = team(k);
    const ps = [...(t.players || [])].sort((a, b) => (b.value || 0) - (a.value || 0));
    const movers = ps.filter((p) => p.prevValue && p.value !== p.prevValue).sort((a, b) => Math.abs(b.value - b.prevValue) - Math.abs(a.value - a.prevValue));
    const up = movers.filter((p) => p.value > p.prevValue).length;
    const max = (ps[0] && ps[0].value) || 1;
    const hist = (((D.history || {}).totals || {})[k]) || [];
    const avgVal = t.count ? (t.totalValue || 0) / t.count : 0;
    let out = `<div style="margin-top:12px">${teamSwitch('werteTeam', [['profis', 'Profis', money(team('profis').totalValue, { short: 1 })], ['u23', 'BVB II', money(team('u23').totalValue, { short: 1 })], ['u19', 'U19', money(team('u19').totalValue, { short: 1 })]])}</div>`;
    out += `<section class="card-y" style="margin-top:12px;display:flex;flex-direction:column;gap:6px">
      <div class="hero-deco" style="background:#0A0A0A;opacity:.08"></div>
      <span class="label">Gesamtmarktwert · ${esc(TEAMNAME[k])}</span>
      ${countEl(t.totalValue || 0, 'money', 'display" style="font-size:46px;line-height:1')}
      <span style="font-size:12px;font-weight:500">${t.count || 0} Spieler · Ø ${t.avgAge ? String(t.avgAge).replace('.', ',') : '–'} Jahre · Ø ${money(avgVal)} pro Spieler</span>
      <span class="row" style="gap:6px;margin-top:4px"><span class="badge dark">▲ ${up} gestiegen</span><span class="badge" style="background:rgba(10,10,10,.12);color:var(--ink)">▼ ${movers.length - up} gefallen</span></span>
    </section>`;
    if (hist.length >= 2) out += `<section class="card" style="margin-top:12px"><span class="label">Verlauf Kaderwert</span>${spark(hist)}</section>`;
    if (movers.length) {
      out += `<section class="card" style="margin-top:12px;padding:12px 14px"><div class="section-h" style="min-height:0;margin-bottom:4px"><h2 style="font-size:20px;text-transform:none">Gewinner &amp; Verlierer</h2><span class="faint" style="font-size:11px">letzte Bewertung</span></div><div class="list">
        ${movers.slice(0, 8).map((p) => { const d = p.value - p.prevValue; return `<a class="li" href="#/spieler/${k}/${p.id}">${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}<span class="grow-1"><div class="t">${esc(p.name)}</div><div class="s">${money(p.prevValue)} → ${money(p.value)}</div></span><span class="v ${d > 0 ? 'green' : 'red'}">${d > 0 ? '▲' : '▼'} ${money(d, { plus: 1, short: 1 })}</span></a>`; }).join('')}
      </div></section>`;
    }
    out += `<section class="section"><div class="section-h"><h2>Alle Spieler</h2><span class="faint" style="font-size:11px">nach Marktwert</span></div><div class="card" style="padding:6px 14px"><div class="list">
      ${ps.map((p, i) => `<a class="li" href="#/spieler/${k}/${p.id}"><span class="rank">${i + 1}</span>${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}
        <span class="grow-1" style="display:flex;flex-direction:column;gap:5px"><span class="row" style="justify-content:space-between;gap:8px"><span class="t ellipsis">${esc(p.name)}</span><span class="v">${money(p.value, { short: 1 })}</span></span>
        <span class="bar"><span style="width:${Math.max(2, ((p.value || 0) / max) * 100).toFixed(1)}%;animation-delay:${Math.min(i, 12) * 0.04}s"></span></span></span></a>`).join('')}
    </div></div></section>`;
    return out;
  }

  function vBilanz() {
    const tr0 = D.transfers || {};
    if (!tr0.in && !tr0.out) return '<div class="empty" style="margin-top:12px">Noch keine Transferdaten.</div>';
    const ins = [...(tr0.in || [])];
    const outs = [...(tr0.out || [])];
    // Offizielle Wechsel, die Gemini seit dem letzten Transfermarkt-Stand in den News gefunden hat
    const known = new Set([...ins, ...outs].map((x) => slug(x.name)));
    let addIn = 0;
    let addOut = 0;
    for (const s of (D.news || {}).stories || []) {
      if (s.status !== 'official' || !['in', 'out'].includes(s.direction) || known.has(slug(s.player))) continue;
      const item = { name: s.player, img: (s.playerInfo || {}).img, club: s.otherClub, fee: s.fee || 'k. A.', feeValue: s.feeValue, news: s.source };
      if (s.direction === 'in') { ins.unshift(item); addIn += s.feeValue || 0; } else { outs.unshift(item); addOut += s.feeValue || 0; }
    }
    const tr = Object.assign({}, tr0, { income: (tr0.income || 0) + addOut, expense: (tr0.expense || 0) + addIn });
    tr.balance = tr.income - tr.expense;
    tr.incomeCount = outs.length;
    tr.expenseCount = ins.length;
    const topIn = [...ins].sort((a, b) => (b.feeValue || 0) - (a.feeValue || 0))[0];
    const topOut = [...outs].sort((a, b) => (b.feeValue || 0) - (a.feeValue || 0))[0];
    const loans = outs.filter((x) => x.loan);
    const maxV = Math.max(tr.income || 0, tr.expense || 0) || 1;
    const row = (x, dir) => `<a class="li" ${x.id && findPlayer('profis', x.id) ? `href="#/spieler/profis/${x.id}"` : ''}>${img(pimg(x.img, 'medium'), 'avatar sm', x.name, initials(x.name))}
      <span class="grow-1"><div class="t ellipsis">${esc(x.name)}${x.news ? ' <span class="badge green" style="padding:2px 5px">NEU</span>' : ''}</div><div class="s row" style="gap:6px">${crest(x.club, 'crest xs')}<span class="ellipsis">${dir === 'in' ? 'von' : 'zu'} ${esc((x.club || {}).name || '?')}${x.news ? ' · laut ' + esc(x.news) : ''}</span></div></span>
      <span class="v ${x.feeValue ? '' : 'faint'}" style="font-weight:${x.feeValue ? 700 : 500}">${esc(String(x.fee || '–').replace(/^Leihgebühr:\s*/, 'Leihe '))}</span></a>`;
    let out = `<p class="muted" style="font-size:12px;margin-top:12px">Saison ${esc(tr.seasonLabel || '')} · Quelle: Transfermarkt${addIn || addOut || ins.some((x) => x.news) || outs.some((x) => x.news) ? ' + neue offizielle Wechsel aus den News' : ''}</p>`;
    out += `<section class="card" style="margin-top:8px;display:flex;flex-direction:column;gap:12px">
      <div class="row" style="justify-content:space-between"><span><span class="label">Einnahmen</span><div class="display green" style="font-size:26px">${countEl(tr.income || 0, 'money')}</div><span class="faint" style="font-size:11px">${tr.incomeCount || outs.length} Abgänge</span></span>
      <span style="text-align:right"><span class="label">Ausgaben</span><div class="display red" style="font-size:26px">${countEl(tr.expense || 0, 'money')}</div><span class="faint" style="font-size:11px">${tr.expenseCount || ins.length} Zugänge</span></span></div>
      <div style="display:flex;flex-direction:column;gap:6px"><span class="bar green"><span style="width:${((tr.income || 0) / maxV * 100).toFixed(1)}%"></span></span><span class="bar red"><span style="width:${((tr.expense || 0) / maxV * 100).toFixed(1)}%;animation-delay:.1s"></span></span></div>
      <div class="row" style="justify-content:space-between;border-top:1px solid var(--line2);padding-top:10px"><span class="label">Transfersaldo</span><b class="display ${tr.balance >= 0 ? 'green' : 'red'}" style="font-size:30px">${money(tr.balance, { plus: 1 })}</b></div>
    </section>`;
    out += `<div class="grid2" style="margin-top:12px">
      <div class="card" style="display:flex;flex-direction:column;gap:6px"><span class="label">Teuerster Zugang</span>${topIn ? `<b style="font-size:14px">${esc(topIn.name)}</b><span class="display yellow" style="font-size:22px">${money(topIn.feeValue)}</span>` : '–'}</div>
      <div class="card" style="display:flex;flex-direction:column;gap:6px"><span class="label">Teuerster Abgang</span>${topOut && topOut.feeValue ? `<b style="font-size:14px">${esc(topOut.name)}</b><span class="display yellow" style="font-size:22px">${money(topOut.feeValue)}</span>` : '–'}</div></div>`;
    out += `<section class="section"><div class="section-h"><h2>Zugänge (${ins.length})</h2></div><div class="card" style="padding:4px 14px"><div class="list">${ins.map((x) => row(x, 'in')).join('') || '<p class="muted" style="padding:10px 0">Keine</p>'}</div></div></section>`;
    out += `<section class="section"><div class="section-h"><h2>Abgänge (${outs.length})</h2></div><div class="card" style="padding:4px 14px"><div class="list">${outs.map((x) => row(x, 'out')).join('') || '<p class="muted" style="padding:10px 0">Keine</p>'}</div></div></section>`;
    if (loans.length) out += `<section class="section"><div class="section-h"><h2>Verliehen</h2></div><div class="card" style="padding:4px 14px"><div class="list">${loans.map((x) => row(x, 'out')).join('')}</div></div></section>`;
    return out;
  }

  function vVertraege() {
    const k = UI.vertTeam === 'u23' ? 'u23' : 'profis';
    const ps = (team(k).players || []).filter((p) => p.contract).sort((a, b) => a.contract.localeCompare(b.contract));
    const groups = {};
    for (const p of ps) (groups[p.contract.slice(0, 4)] = groups[p.contract.slice(0, 4)] || []).push(p);
    const years = Object.keys(groups).sort();
    const first = years[0];
    const firstVal = first ? groups[first].reduce((s, p) => s + (p.value || 0), 0) : 0;
    let out = `<div style="margin-top:12px">${teamSwitch('vertTeam', [['profis', 'Profis', ''], ['u23', 'BVB II', '']])}</div>`;
    if (first) {
      out += `<section class="card-y" style="margin-top:12px"><span class="label">Verträge enden ${first}</span>
        <div class="display" style="font-size:44px;line-height:1">${groups[first].length}</div>
        <span style="font-size:12px;font-weight:500">Spieler · zusammen ${money(firstVal)} Marktwert – mögliche ablösefreie Abgänge</span></section>`;
    }
    for (const y of years) {
      const soon = y === first;
      out += `<section class="section"><div class="section-h"><h2>${y}</h2><span class="badge ${soon ? 'red' : ''}">${groups[y].length} ${soon ? '· läuft aus' : ''}</span></div>
        <div class="card" style="padding:4px 14px"><div class="list">${groups[y].map((p) => `<a class="li" href="#/spieler/${k}/${p.id}">${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}
          <span class="grow-1"><div class="t ellipsis">${esc(p.name)}</div><div class="s">${esc(p.position || '')} · ${p.age || '–'} J. · ${fmtDate(p.contract)}</div></span><span class="v">${money(p.value, { short: 1 })}</span></a>`).join('')}</div></div></section>`;
    }
    if (!years.length) out += '<div class="empty" style="margin-top:12px">Keine Vertragsdaten.</div>';
    return out;
  }

  // ------------------------------------------------------------------ Spiele
  function vSpiele(k, tab) {
    UI.spieleTeam = k;
    const ms = matchList(k);
    const fm = formOf(k);
    const toggle = `<div class="seg" style="width:170px" role="group" aria-label="Mannschaft"><a href="#/spiele/profis/${tab}" class="${k === 'profis' ? 'on' : ''}">Profis</a><a href="#/spiele/u23/${tab}" class="${k === 'u23' ? 'on' : ''}">BVB II</a></div>`;
    let out = pageHead('Spiele', '', toggle);
    out += `<nav class="tabs" aria-label="Ansicht">${[['kommend', 'Kommende'], ['ergebnisse', 'Ergebnisse'], ['tabelle', 'Tabelle'], ['torschuetzen', 'Torschützen']].map(([t, l]) => `<a href="#/spiele/${k}/${t}" class="${t === tab ? 'on' : ''}">${l}</a>`).join('')}</nav>`;
    if (tab === 'kommend' || tab === 'ergebnisse') {
      const w = fm.filter((x) => x === 'W').length;
      const d = fm.filter((x) => x === 'D').length;
      out += `<section class="card tight row" style="margin-top:12px;justify-content:space-between"><span><span class="label">Form · letzte ${fm.length}</span><div class="muted" style="font-size:12px">${w} Siege · ${d} Remis · ${fm.length - w - d} Niederl.</div></span>${formHtml(fm, true)}</section>`;
    }
    if (tab === 'kommend') {
      const up = ms.filter((m) => !m.finished);
      out += `<div class="stack" style="margin-top:10px">${up.length ? up.slice(0, 20).map((m, i) => matchCard(m, i === 0, k)).join('') : '<div class="empty">Keine kommenden Spiele.</div>'}</div>`;
    } else if (tab === 'ergebnisse') {
      const fin = ms.filter((m) => m.finished && m.score).reverse();
      out += `<div class="stack" style="margin-top:10px">${fin.length ? fin.map((m) => resultCard(m, k)).join('') : '<div class="empty">Noch keine Ergebnisse.</div>'}</div>`;
    } else if (tab === 'tabelle') {
      out += tableView(k === 'u23' ? 'u23' : 'bl1');
    } else {
      out += scorerView(k);
    }
    return out;
  }
  function matchCard(m, isNext, k) {
    const live = isLive(m);
    const days = Math.round((toDate(berlinYMD(m.date)) - toDate(berlinYMD(new Date()))) / 864e5);
    const inD = live ? '' : days === 0 ? '<b class="yellow" style="font-size:11px">HEUTE</b>' : days === 1 ? '<b class="yellow" style="font-size:11px">MORGEN</b>' : days > 0 && days < 8 ? `<b class="yellow" style="font-size:11px">in ${days} Tagen</b>` : '';
    return `<button type="button" class="card match press ${isNext ? 'next' : ''} ${live ? 'live' : ''}" data-action="match" data-id="${esc(m.id)}" data-team="${k}" style="text-align:left;width:100%">
      <span class="match-top">${live ? '<span class="live-badge">LIVE</span>' : `<span class="badge y">${esc(m.round || compShort(m.comp))}</span>`}<span class="grow-1 ellipsis">${esc(m.comp || '')}</span>${inD}</span>
      <span class="match-mid"><span class="match-date"><b>${esc(dayLabel(m.date))}</b><span>${m.timeKnown === false ? 'Uhrzeit offen' : esc(F.time.format(new Date(m.date))) + ' Uhr'} · ${m.isHome ? 'Heim' : 'Auswärts'}</span></span>
      <span class="match-teams">${crest(m.home, 'crest')}<span class="vs">${live && m.score ? `<span class="display" style="color:var(--text);font-size:22px;font-style:normal">${m.score[0]}:${m.score[1]}</span>` : 'VS'}</span>${crest(m.away, 'crest')}</span></span>
      <span class="sr">${esc(tname(m.home))} gegen ${esc(tname(m.away))}</span>
    </button>`;
  }
  function resultCard(m, k) {
    return `<button type="button" class="card match press" data-action="match" data-id="${esc(m.id)}" data-team="${k}" style="text-align:left;width:100%">
      <span class="match-top"><span class="badge">${esc(m.round || compShort(m.comp))}</span><span class="grow-1 ellipsis">${esc(m.comp || '')}</span><span>${esc(F.dayShort.format(new Date(m.date)))}</span></span>
      <span class="res"><span class="res-team">${crest(m.home, 'crest sm')}<span class="ellipsis">${esc(tname(m.home))}</span></span>
      <span class="res-score ${m.outcome || ''}">${m.score[0]}:${m.score[1]}</span>
      <span class="res-team r">${crest(m.away, 'crest sm')}<span class="ellipsis">${esc(tname(m.away))}</span></span></span>
    </button>`;
  }
  function tableView(key) {
    const t = key === 'u23' ? ((D.u23 || {}).table || (D.tables || {}).u23) : (D.tables || {})[key];
    if (!t || !t.rows || !t.rows.length) return '<div class="empty" style="margin-top:12px">Tabelle noch nicht verfügbar.</div>';
    const n = t.rows.length;
    const zone = (p) => key !== 'bl1' ? '' : p <= 4 ? 'z-cl' : p === 5 ? 'z-el' : p === 6 ? 'z-ecl' : p === n - 2 ? 'z-rel' : p > n - 2 ? 'z-ab' : '';
    return `<p class="muted" style="font-size:12px;margin:12px 0 6px">${esc(t.name || '')}${t.updatedAt ? ' · Stand ' + esc(rel(t.updatedAt)) : ''}</p>
      <div class="card" style="padding:6px 8px"><table class="table"><thead><tr><th>#</th><th>Verein</th><th>Sp</th><th>TD</th><th>Pkt</th></tr></thead><tbody>
      ${t.rows.map((r) => `<tr class="${r.isBVB ? 'me' : ''}"><td>${zone(r.pos) ? `<span class="zone ${zone(r.pos)}" style="margin-right:4px"></span>` : ''}${r.pos}</td><td><span class="tm">${crest({ name: r.team, icon: r.icon }, 'crest xs')}<span>${esc(r.short || r.team)}</span></span></td><td>${r.played}</td><td>${r.diff > 0 ? '+' : ''}${r.diff}</td><td><b>${r.points}</b></td></tr>`).join('')}
      </tbody></table></div>
      ${key === 'bl1' ? '<p class="faint" style="font-size:11px;margin-top:8px"><span class="zone z-cl"></span> Champions League &nbsp; <span class="zone z-el"></span> Europa League &nbsp; <span class="zone z-ecl"></span> Conference League &nbsp; <span class="zone z-rel"></span> Relegation &nbsp; <span class="zone z-ab"></span> Abstieg</p>' : ''}`;
  }
  function scorerView(k) {
    const ps = (team(k).players || []).map((p) => Object.assign({ s: statsOf(k, p.id) || {} }, p)).filter((p) => (p.s.goals || 0) + (p.s.assists || 0) > 0)
      .sort((a, b) => ((b.s.goals || 0) - (a.s.goals || 0)) || ((b.s.assists || 0) - (a.s.assists || 0)));
    if (!ps.length) return '<div class="empty" style="margin-top:12px">Noch keine Torschützen.</div>';
    return `<p class="muted" style="font-size:12px;margin:12px 0 6px">Alle Wettbewerbe · Saison ${esc(String((D.stats || {}).season || ''))}/${esc(String(((D.stats || {}).season || 0) + 1).slice(2))}${k === 'profis' ? ' · Tore live aus den Spielberichten' : ''}</p>
      <div class="card" style="padding:4px 14px"><div class="list">${ps.map((p, i) => `<a class="li" href="#/spieler/${k}/${p.id}"><span class="rank">${i + 1}</span>${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}
      <span class="grow-1"><div class="t ellipsis">${esc(p.name)}</div><div class="s">${p.s.apps || 0} Spiele · ${p.s.minutes || 0}'</div></span>
      <span class="v"><span class="display yellow" style="font-size:22px">${p.s.goals || 0}</span> <span class="faint" style="font-weight:500">Tore</span><div class="faint" style="font-size:11px;font-weight:500">${p.s.assists || 0} Vorlagen</div></span></a>`).join('')}</div></div>`;
  }

  // ------------------------------------------------------------------ Kader & Spieler
  const GROUPS = [['Torwart', 'Tor'], ['Abwehr', 'Abwehr'], ['Mittelfeld', 'Mittelfeld'], ['Sturm', 'Sturm']];
  function vKader(k) {
    UI.kaderTeam = k;
    const t = team(k);
    let out = pageHead('Kader', `${t.count || 0} Spieler · Ø ${t.avgAge ? String(t.avgAge).replace('.', ',') : '–'} Jahre · ${money(t.totalValue)}`);
    out += `<div class="seg" role="group" aria-label="Mannschaft">${[['profis', 'Profis'], ['u23', 'BVB II'], ['u19', 'U19']].map(([kk, l]) => `<a href="#/kader/${kk}" class="${kk === k ? 'on' : ''}">${l}</a>`).join('')}</div>`;
    out += `<div style="margin-top:12px"><label class="sr" for="ksearch">Spieler suchen</label><input id="ksearch" class="search" type="search" placeholder="Spieler suchen …" autocomplete="off" value="${esc(UI.kaderSearch)}" data-action="search"></div>`;
    out += `<div class="chips" style="margin-top:10px" role="group" aria-label="Filter">${[['alle', 'Alle'], ...GROUPS.map(([g, l]) => [g, l]), ['fehlt', 'Fehlt']].map(([kk, l]) => `<button type="button" class="${UI.kaderFilter === kk ? 'on' : ''}" aria-pressed="${UI.kaderFilter === kk}" data-action="kfilter" data-val="${kk}">${l}</button>`).join('')}</div>`;
    out += `<div id="kgrid">${kaderGrid(k)}</div>`;
    return out;
  }
  function kaderGrid(k) {
    const q = slug(UI.kaderSearch);
    const f = UI.kaderFilter;
    const ps = (team(k).players || []).filter((p) => (!q || slug(p.name).includes(q))
      && (f === 'alle' || p.group === f || (f === 'fehlt' && isOut(p))));
    if (!ps.length) return '<div class="empty" style="margin-top:12px">Kein Spieler gefunden.</div>';
    let out = '';
    for (const [g, l] of GROUPS) {
      const gp = ps.filter((p) => p.group === g);
      if (!gp.length) continue;
      out += `<h2 class="group-h" style="margin-top:16px">${l} <span class="faint" style="font-size:14px">${gp.length}</span></h2><div class="pgrid" style="margin-top:8px">${gp.map((p) => pCard(p, k)).join('')}</div>`;
    }
    const rest = ps.filter((p) => !GROUPS.some(([g]) => g === p.group));
    if (rest.length) out += `<h2 class="group-h" style="margin-top:16px">Weitere</h2><div class="pgrid" style="margin-top:8px">${rest.map((p) => pCard(p, k)).join('')}</div>`;
    return out;
  }
  function pCard(p, k) {
    const ab = absencesOf(p).filter((a) => a.type !== 'ineligible');
    const trend = p.prevValue && p.value !== p.prevValue ? `<small class="${p.value > p.prevValue ? 'green' : 'red'}">${p.value > p.prevValue ? '▲' : '▼'}</small>` : '';
    return `<a class="pcard" href="#/spieler/${k}/${p.id}">
      <span class="pcard-img">${img(pimg(p.img, 'big'), '', p.name, initials(p.name))}${p.number ? `<span class="pcard-num">${esc(p.number)}</span>` : ''}${ab.length ? `<span class="pcard-abs badge ${ab[0].type === 'injury' ? 'red' : 'amber'}">${ab[0].type === 'injury' ? 'VERLETZT' : 'FEHLT'}</span>` : ''}</span>
      <span class="pcard-b"><span class="n">${esc(p.name)}${p.captain ? ' <span class="yellow">(C)</span>' : ''}</span><span class="p ellipsis">${esc(p.position || '')}${p.age ? ' · ' + p.age + ' J.' : ''}</span><span class="v">${money(p.value, { short: 1 })}${trend}</span></span>
    </a>`;
  }

  function vSpieler(k, id) {
    const p = findPlayer(k, id);
    if (!p) return pageHead('Spieler', '', '', '#/kader/' + k) + '<div class="empty">Spieler nicht gefunden.</div>';
    const st = statsOf(k, id) || {};
    const hist = ((D.history || {}).players || {})[id] || [];
    const d = p.prevValue ? p.value - p.prevValue : 0;
    const abs = absencesOf(p);
    const injNews = ((D.news || {}).injuryNews || []).filter((n) => slug(n.player) === slug(p.name));
    const stories = transferFeed().filter((it) => it.playerId === id || slug(it.name) === slug(p.name));
    let contract = '';
    if (p.contract) {
      const a = Date.parse((p.joined || p.contract) + 'T00:00:00Z');
      const b = Date.parse(p.contract + 'T00:00:00Z');
      const frac = Math.max(0, Math.min(1, (Date.now() - a) / ((b - a) || 1)));
      const months = Math.max(0, Math.round((b - Date.now()) / (30.44 * 864e5)));
      contract = `<div style="display:flex;flex-direction:column;gap:6px;padding-bottom:10px;border-bottom:1px solid var(--line2)">
        <span class="kv" style="border:0;padding:0"><span>Vertrag bis</span><span>${fmtDate(p.contract)}</span></span>
        <span class="bar"><span style="width:${(frac * 100).toFixed(0)}%"></span></span>
        ${p.contractNote ? `<span class="green" style="font-size:11px;font-weight:600">${esc(p.contractNote)}</span>` : ''}
        <span class="faint" style="font-size:11px">${months >= 12 ? `Noch ${Math.floor(months / 12)} ${Math.floor(months / 12) === 1 ? 'Jahr' : 'Jahre'}${months % 12 ? ` und ${months % 12} ${months % 12 === 1 ? 'Monat' : 'Monate'}` : ''}` : `Noch ${months} ${months === 1 ? 'Monat' : 'Monate'}`}</span></div>`;
    }
    let out = `<section class="phero">
      <div class="phero-num" aria-hidden="true">${esc(p.number || '')}</div>
      <div class="phero-band"></div>
      ${p.img ? img(pimg(p.img, 'big'), 'phero-img', p.name, 'sil') : ''}
      <button type="button" class="phero-back" data-action="back" data-fallback="#/kader/${k}" aria-label="Zurück">${I.back}</button>
      <span class="phero-team">KADER · ${esc(TEAMNAME[k].toUpperCase())}</span>
      <div class="phero-n">${p.number ? `<b>#${esc(p.number)}</b>` : ''}<span class="badge dark" style="align-self:flex-start">${esc((p.group || '').toUpperCase())}</span>${p.captain ? '<span class="badge dark" style="align-self:flex-start">KAPITÄN</span>' : ''}</div>
      <div class="phero-name"><h1>${esc(p.name)}</h1><span>${esc([p.position, p.age ? p.age + ' Jahre' : '', (p.flags || []).map((f) => f.name).join(' / ')].filter(Boolean).join(' · '))}</span></div>
    </section>`;
    out += `<section class="card" style="margin-top:14px;display:flex;flex-direction:column;gap:8px">
      <div class="row" style="justify-content:space-between;align-items:flex-end">
        <span><span class="label">Marktwert</span><div class="display yellow" style="font-size:34px;line-height:1">${countEl(p.value || 0, 'money')}</div></span>
        ${d ? `<span class="badge" style="background:${d > 0 ? 'rgba(34,197,94,.14)' : 'rgba(240,82,82,.14)'};color:${d > 0 ? 'var(--green)' : 'var(--red)'};font-size:12px">${d > 0 ? '▲' : '▼'} ${money(d, { plus: 1, short: 1 })}</span>` : ''}
      </div>
      ${p.valueNote ? `<span class="row faint" style="font-size:11px;gap:6px"><span class="ai-ico" style="width:18px;height:18px;border-radius:5px;animation:none">${I.ai}</span>Neuer Wert ${esc(p.valueNote)} · per Gemini</span>` : ''}
      ${hist.length >= 2 ? spark(hist) : '<span class="faint" style="font-size:12px">Der Marktwert-Verlauf wird beim nächsten Update geladen.</span>'}
    </section>`;
    out += `<section class="grid4" style="margin-top:12px">
      <div class="stat-box"><b>${st.apps || 0}</b><span>Einsätze</span></div>
      <div class="stat-box"><b class="yellow">${st.goals || 0}</b><span>Tore</span></div>
      <div class="stat-box"><b>${st.assists || 0}</b><span>Vorlagen</span></div>
      <div class="stat-box"><b>${st.minutes || 0}'</b><span>Minuten</span></div>
      <div class="stat-box"><b>${st.yellow || 0}</b><span>Gelb</span></div>
      <div class="stat-box"><b>${(st.yellowRed || 0) + (st.red || 0)}</b><span>Rot/Gelb-Rot</span></div>
      <div class="stat-box"><b>${st.subIn || 0}</b><span>Eingewechs.</span></div>
      <div class="stat-box"><b>${st.apps ? ((st.goals + st.assists) / st.apps).toFixed(2).replace('.', ',') : '0'}</b><span>Scorer/Spiel</span></div>
    </section>`;
    if (abs.length || injNews.length) {
      out += `<section class="section"><div class="section-h"><h2>Status</h2></div>
        ${abs.map((a) => `<div class="abs ${a.type === 'ineligible' ? 'info' : ''}">${a.type === 'ineligible' ? I.info : I.injury}<span>${esc(a.text)}</span></div>`).join('')}
        ${injNews.map((n) => `<div class="abs info">${I.ai.replace('<svg', '<svg style="color:var(--y)"')}<span><b>${esc(INJ[n.status] || '')}</b> ${esc(n.text || '')}${n.expectedReturn ? ` · Rückkehr: ${esc(n.expectedReturn)}` : ''}<div class="faint" style="font-size:11px;margin-top:2px">${esc(n.source || '')} · ${esc(fmtDate(n.date))} · via Gemini</div></span></div>`).join('')}
      </section>`;
    }
    if (stories.length) out += `<section class="section"><div class="section-h"><h2>Transfer-News</h2></div>${stories.slice(0, 3).map(tRow).join('')}</section>`;
    out += `<section class="card" style="margin-top:18px">${contract}
      ${p.joined ? `<div class="kv"><span>Im Team seit</span><span>${fmtDate(p.joined)}${p.from ? ` · von ${esc(p.from.name)}${p.from.fee && p.from.fee !== '-' ? ` (${esc(p.from.fee)})` : ''}` : ''}</span></div>` : ''}
      ${p.birth ? `<div class="kv"><span>Geburtstag</span><span>${fmtDate(p.birth)}</span></div>` : ''}
      ${p.height ? `<div class="kv"><span>Größe</span><span>${esc(p.height)}</span></div>` : ''}
      ${p.foot ? `<div class="kv"><span>Fuß</span><span>${esc(p.foot)}</span></div>` : ''}
      ${p.flags && p.flags.length ? `<div class="kv"><span>Nation</span><span>${flagImgs(p.flags)} ${esc(p.flags.map((f) => f.name).join(' / '))}</span></div>` : ''}
    </section>
    <a class="btn ghost" style="width:100%;margin-top:12px" href="https://www.transfermarkt.de/x/profil/spieler/${esc(id)}" target="_blank" rel="noopener">Profil auf Transfermarkt ${I.ext.replace('<svg', '<svg style="stroke:currentColor;width:16px;height:16px"')}</a>`;
    return out;
  }
  const INJ = { injured: 'Fällt aus:', doubtful: 'Fraglich:', back: 'Zurück im Training:', fit: 'Wieder fit:' };

  // ------------------------------------------------------------------ Mehr
  function vMehr() {
    const st = D.status || {};
    const items = [
      ['#/mehr/update', I.ai, 'KI-Update-Zentrale', st.lastRun ? `Letztes Update ${rel(st.lastRun)} · ${st.changes ? st.changes.total : 0} Änderungen` : 'Wann Gemini zuletzt aktualisiert hat'],
      ['#/mehr/stats', I.chart, 'Statistiken', 'Tore, Vorlagen, Einsätze, Minuten, Karten'],
      ['#/mehr/elf', I.shirt, 'Meine Elf', 'Stell deine Traum-Aufstellung zusammen'],
      ['#/mehr/lazarett', I.cross, 'Lazarett', 'Verletzte, Gesperrte & Rückkehrer'],
      ['#/mehr/talente', I.sprout, 'Talente-Radar', 'Die wertvollsten Talente aus U19 & BVB II'],
      ['#/mehr/erfolge', I.trophy, 'Erfolge & Geschichte', 'Titel und große Momente'],
      ['#/mehr/install', I.phone, 'Als App installieren', 'So kommt BVB 09 auf deinen Home-Bildschirm'],
      ['#/mehr/info', I.info, 'Über die App', 'Datenquellen & Hinweise'],
    ];
    return pageHead('Mehr') + `<nav class="card menu" style="padding:2px 14px" aria-label="Weitere Bereiche">${items.map(([h, ic, t, s]) => `<a href="${h}"><span class="mi">${ic}</span><span class="grow-1"><div class="mt">${t}</div><div class="ms">${esc(s)}</div></span>${I.chev}</a>`).join('')}</nav>`;
  }

  const CAT = { values: 'Marktwerte', transfers: 'Transfers', stories: 'Here we go', rumors: 'Gerüchte', news: 'News', injuries: 'Verletzungen', matches: 'Spiele', table: 'Tabelle', stats: 'Statistik', squad: 'Kader' };
  const CAT_COLOR = { values: '#FDE100', transfers: '#22C55E', stories: '#22C55E', rumors: '#FFA41B', news: '#4EA8FF', injuries: '#F05252', matches: '#FFFFFF', table: '#FFFFFF', stats: '#A8A8A8', squad: '#FDE100' };
  function berlinToDate(ymd, hm) {
    const [y, mo, d] = ymd.split('-').map(Number);
    const [h, mi] = hm.split(':').map(Number);
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess));
    const g = (t) => +parts.find((x) => x.type === t).value;
    const asBerlin = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'));
    return new Date(guess - (asBerlin - guess));
  }
  function nextRuns(st) {
    const sched = st.schedule || ['08:17', '14:17', '20:17'];
    const out = [];
    for (let i = 0; i < 3 && out.length < 3; i++) {
      const ymd = berlinYMD(new Date(Date.now() + i * 864e5));
      for (const hm of sched) { const t = berlinToDate(ymd, hm); if (t > Date.now()) out.push(t); }
    }
    return out.slice(0, 3);
  }
  function vUpdate() {
    const st = D.status;
    let out = pageHead('Update-Zentrale', 'Automatisch 3× täglich · GitHub + Gemini-KI · läuft auch ohne Claude', '', '#/mehr');
    if (!st) return out + '<div class="empty">Noch kein Update gelaufen. Sobald GitHub das erste Mal aktualisiert, siehst du hier alles.</div>';
    const last = Date.parse(st.lastRun);
    const nr = nextRuns(st);
    const next = nr[0];
    const total = next ? next - last : 1;
    const frac = Math.max(0.02, Math.min(1, (Date.now() - last) / (total || 1)));
    const minsLeft = next ? Math.max(0, Math.round((next - Date.now()) / 60000)) : 0;
    const ch = st.changes || { total: 0, byCategory: {}, items: [] };
    const mods = Object.entries(st.modules || {});
    const bad = mods.filter(([, m]) => m.ok === false);
    const warn = mods.filter(([, m]) => m.ok && m.warning);
    const gem = st.gemini || (D.news || {}).gemini || {};
    const overdue = Date.now() - last > 9 * 36e5;
    const C = 2 * Math.PI * 40;
    out += `<section class="card ring-wrap" style="border-color:${overdue ? 'var(--amber)' : 'var(--y)'};border-radius:22px;padding:16px">
      <svg width="92" height="92" viewBox="0 0 92 92" role="img" aria-label="Nächstes Update in ${minsLeft} Minuten" style="flex:none">
        <circle cx="46" cy="46" r="40" fill="none" stroke="#2A2A2A" stroke-width="8"/>
        <circle cx="46" cy="46" r="40" fill="none" stroke="#FDE100" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(1)}" transform="rotate(-90 46 46)" style="transition:stroke-dashoffset 1s"/>
        <text x="46" y="45" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="${minsLeft > 99 ? 20 : 24}" fill="#FFFFFF">${minsLeft > 99 ? Math.round(minsLeft / 60) + ' h' : minsLeft}</text>
        <text x="46" y="60" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" fill="#A8A8A8">${minsLeft > 99 ? 'bis Update' : 'Min. bis Update'}</text>
      </svg>
      <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
        <span class="label">Letztes Update</span>
        <b style="font-size:16px">${esc(dayLabel(st.lastRun))}, ${esc(F.time.format(new Date(last)))} Uhr</b>
        <span class="row" style="gap:6px;align-items:baseline"><span class="display yellow" style="font-size:42px;line-height:1">${countEl(ch.total || 0, 'num')}</span><span style="font-size:13px;font-weight:600">Änderungen</span></span>
        <span class="row" style="gap:6px;font-size:11px;font-weight:600"><span class="dot ${bad.length ? 'red' : warn.length ? 'amber' : 'pulse'}"></span><span class="${bad.length ? 'red' : warn.length ? 'amber' : 'green'}">${bad.length ? `${bad.length} Quelle(n) mit Fehler` : warn.length ? 'Teilweise Warnungen' : `Alle ${mods.length} Quellen OK`}</span></span>
      </div></section>`;
    if (overdue) {
      out += `<div class="abs" style="margin-top:12px;background:rgba(255,164,27,.1);border-color:rgba(255,164,27,.4)">${I.warn}<span>Das letzte Update ist schon ${esc(rel(st.lastRun).replace('vor ', ''))} her. GitHub startet manchmal verspätet. Du kannst das Update auch selbst starten.</span></div>`;
    }
    out += `<div class="row" style="margin-top:12px;gap:8px"><span class="muted grow-1" style="font-size:12px">Nächste Updates</span>${nr.map((t, i) => `<span class="badge ${i === 0 ? 'y' : ''}" style="font-size:12px;padding:5px 9px">${esc(F.time.format(t))}</span>`).join('')}</div>`;
    out += `<section class="cat-grid" style="margin-top:12px">${Object.entries(CAT).map(([k, l]) => { const n = (ch.byCategory || {})[k] || 0; return `<div class="cat ${n ? 'on' : ''}"><b>${n}</b><span>${l}</span></div>`; }).join('')}</section>`;
    out += `<section class="card" style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
      <div class="row"><span class="ai-ico">${I.ai}</span><span class="grow-1"><b style="font-size:15px">Gemini-KI</b><div class="muted" style="font-size:11px">Kostenlos · läuft auf GitHub</div></span>
      <span class="badge ${gem.used ? 'green' : gem.error ? 'amber' : 'outline'}">${gem.used ? 'AKTIV' : gem.error ? 'PAUSE' : 'STARTKLAR'}</span></div>
      ${gem.used ? `<div class="kv"><span>Zuletzt ausgewertet</span><span>${esc(rel(gem.at))}</span></div>
        <div class="kv"><span>Gelesene Meldungen</span><span>${gem.headlinesAnalyzed || gem.headlines || 0}</span></div>
        <div class="kv"><span>Transfer-Storys</span><span>${gem.stories || 0}</span></div>
        <div class="kv"><span>Verletzungs-News</span><span>${gem.injuries || 0}</span></div>
        <div class="kv"><span>Modell</span><span>${esc(gem.model || '')}${gem.grounded ? ' · mit Google-Suche' : ''}</span></div>`
        : `<p class="muted" style="font-size:12px;line-height:1.5">${gem.error ? `Gemini konnte zuletzt nicht antworten (${esc(gem.error)}). Die App läuft trotzdem weiter: Marktwerte, Spiele, Statistiken und Gerüchte kommen direkt von den Quellen.` : 'Liest Meldungen von Romano, Sky, kicker &amp; Co. und macht daraus Here-we-go-Karten, Verletzungs-News und das tägliche KI-Briefing.'}</p>
          ${gem.lastSuccess ? `<div class="kv"><span>Letzter Erfolg</span><span>${esc(rel(gem.lastSuccess))}</span></div>` : ''}`}
    </section>`;
    const modRow = (m) => `<div class="mod">${m.ok === false ? I.bad : m.warning ? I.warn : I.ok}<span class="grow-1"><b>${esc(m.label)}</b>${m.ok === false ? `<div class="red" style="font-size:12px">${esc(m.error || 'Fehler')}</div>` : m.warning ? `<div class="amber" style="font-size:12px">${esc(m.warning)}</div>` : ''}<div class="faint" style="font-size:11px">${m.at ? 'aktualisiert ' + esc(rel(m.at)) : 'noch nie'}${m.seconds != null ? ' · ' + m.seconds + ' s' : ''}</div></span></div>`;
    out += `<section class="section"><div class="section-h"><h2>Automatisch (GitHub)</h2><span class="faint" style="font-size:11px">3× täglich</span></div><div class="card" style="padding:2px 14px">
      ${mods.map(([, m]) => modRow(m)).join('')}
    </div></section>`;
    const pc = D['status-pc'] || {};
    const pcMods = Object.values(pc.modules || {});
    const tmInfo = st.transfermarkt || {};
    const aiAt = (D.squads || {}).aiUpdatedAt || tmInfo.aiUpdatedAt;
    out += `<section class="section"><div class="section-h"><h2>Transfermarkt</h2><span class="faint" style="font-size:11px">Stand ${esc(pc.lastRun ? fmtDate(pc.lastRun) : '–')}</span></div>
      <div class="abs info" style="margin-bottom:2px">${I.info}<span>Transfermarkt sperrt Server wie GitHub mit einem Bot-Schutz. Deshalb übernimmt <b>Gemini</b> neue Marktwerte, Vertragsverlängerungen und Verletzungen aus den Transfermarkt-, kicker- und Sky-News.${aiAt ? ` Letzte KI-Änderung am Kader: ${esc(rel(aiAt))}.` : ''} Tore zählt die App live aus den Spielberichten.</span></div>
      ${pcMods.length ? `<div class="card" style="padding:2px 14px">${pcMods.map(modRow).join('')}</div>` : ''}
    </section>`;
    const runs = (st.runs || []).slice(0, 30).reverse();
    if (runs.length) {
      const mx = Math.max(1, ...runs.map((r) => r.changes || 0));
      out += `<section class="section"><div class="section-h"><h2>Letzte Läufe</h2><span class="faint" style="font-size:11px">${st.totalChanges7d || 0} Änderungen in 7 Tagen</span></div>
        <div class="card"><div class="runbars" role="img" aria-label="Änderungen pro Update">${runs.map((r, i) => `<i class="${r.ok === false ? 'err' : r.changes ? '' : 'zero'}" title="${esc(F.dayShort.format(new Date(r.at)))} ${esc(F.time.format(new Date(r.at)))}: ${r.changes} Änderungen" style="height:${Math.max(6, (r.changes || 0) / mx * 100)}%;animation-delay:${i * 0.02}s"></i>`).join('')}</div>
        <div class="row faint" style="justify-content:space-between;font-size:10px;margin-top:6px"><span>${esc(F.dayShort.format(new Date(runs[0].at)))}</span><span>jetzt</span></div></div></section>`;
    }
    const items = ch.items || [];
    out += `<section class="section"><div class="section-h"><h2>Änderungsprotokoll</h2></div><div class="card">
      ${items.length ? items.map((it) => `<div class="log"><i style="background:${CAT_COLOR[it.cat] || '#FDE100'}"></i><span>${esc(it.text)}</span></div>`).join('') : `<p class="muted" style="font-size:13px">${st.firstRun ? 'Erstes Update – alle Daten wurden neu geladen.' : 'Beim letzten Update gab es keine Änderungen.'}</p>`}
    </div></section>`;
    out += `<div class="stack" style="margin-top:16px">
      <button type="button" class="btn" data-action="reload">${I.refresh} Daten in der App neu laden</button>
      <a class="btn ghost" href="https://github.com/${REPO}/actions/workflows/update.yml" target="_blank" rel="noopener">${I.github} Update bei GitHub selbst starten</a>
      <p class="faint" style="font-size:11px;text-align:center">Auf GitHub: „Run workflow“ antippen (du musst eingeloggt sein).</p></div>`;
    return out;
  }

  function vStats() {
    const k = UI.statsTeam;
    const ps = (team(k).players || []).map((p) => Object.assign({ s: statsOf(k, p.id) || {} }, p));
    const boards = [['goals', 'Tore'], ['assists', 'Vorlagen'], ['scorer', 'Scorerpunkte'], ['apps', 'Einsätze'], ['minutes', 'Spielminuten'], ['yellow', 'Gelbe Karten']];
    const val = (p, key) => (key === 'scorer' ? (p.s.goals || 0) + (p.s.assists || 0) : p.s[key] || 0);
    let out = pageHead('Statistiken', 'Saison ' + ((D.stats || {}).season || '') + ' · alle Wettbewerbe', '', '#/mehr');
    out += teamSwitch('statsTeam', [['profis', 'Profis', ''], ['u23', 'BVB II', ''], ['u19', 'U19', '']]);
    const tg = ps.reduce((s, p) => s + (p.s.goals || 0), 0);
    out += `<div class="grid3" style="margin-top:12px"><div class="stat-box"><b class="yellow">${tg}</b><span>Tore gesamt</span></div><div class="stat-box"><b>${ps.reduce((s, p) => s + (p.s.assists || 0), 0)}</b><span>Vorlagen</span></div><div class="stat-box"><b>${ps.filter((p) => p.s.apps).length}</b><span>Eingesetzt</span></div></div>`;
    for (const [key, label] of boards) {
      const top = ps.filter((p) => val(p, key) > 0).sort((a, b) => val(b, key) - val(a, key)).slice(0, 5);
      const mx = top.length ? val(top[0], key) : 1;
      out += `<section class="section"><div class="section-h"><h2>${label}</h2></div><div class="card" style="padding:6px 14px"><div class="list">
        ${top.length ? top.map((p, i) => `<a class="li" href="#/spieler/${k}/${p.id}"><span class="rank">${i + 1}</span>${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}
          <span class="grow-1" style="display:flex;flex-direction:column;gap:5px"><span class="row" style="justify-content:space-between"><span class="t ellipsis">${esc(p.name)}</span><span class="v">${nf0.format(val(p, key))}${key === 'minutes' ? "'" : ''}</span></span><span class="bar"><span style="width:${(val(p, key) / mx * 100).toFixed(0)}%;animation-delay:${i * 0.05}s"></span></span></span></a>`).join('') : '<p class="muted" style="padding:10px 0;font-size:13px">Noch keine Werte.</p>'}
      </div></div></section>`;
    }
    return out;
  }

  const FORMATIONS = {
    '4-3-3': [['TW', 50, 89, 'Torwart'], ['LV', 14, 69, 'Abwehr'], ['IV', 37, 74, 'Abwehr'], ['IV', 63, 74, 'Abwehr'], ['RV', 86, 69, 'Abwehr'], ['ZM', 26, 49, 'Mittelfeld'], ['ZM', 50, 54, 'Mittelfeld'], ['ZM', 74, 49, 'Mittelfeld'], ['LA', 17, 23, 'Sturm'], ['ST', 50, 16, 'Sturm'], ['RA', 83, 23, 'Sturm']],
    '4-2-3-1': [['TW', 50, 89, 'Torwart'], ['LV', 14, 70, 'Abwehr'], ['IV', 37, 75, 'Abwehr'], ['IV', 63, 75, 'Abwehr'], ['RV', 86, 70, 'Abwehr'], ['DM', 36, 55, 'Mittelfeld'], ['DM', 64, 55, 'Mittelfeld'], ['LA', 16, 34, 'Sturm'], ['ZOM', 50, 37, 'Mittelfeld'], ['RA', 84, 34, 'Sturm'], ['ST', 50, 15, 'Sturm']],
    '3-4-3': [['TW', 50, 89, 'Torwart'], ['IV', 25, 73, 'Abwehr'], ['IV', 50, 76, 'Abwehr'], ['IV', 75, 73, 'Abwehr'], ['LM', 12, 49, 'Mittelfeld'], ['ZM', 37, 53, 'Mittelfeld'], ['ZM', 63, 53, 'Mittelfeld'], ['RM', 88, 49, 'Mittelfeld'], ['LA', 20, 23, 'Sturm'], ['ST', 50, 16, 'Sturm'], ['RA', 80, 23, 'Sturm']],
    '4-4-2': [['TW', 50, 89, 'Torwart'], ['LV', 14, 70, 'Abwehr'], ['IV', 37, 75, 'Abwehr'], ['IV', 63, 75, 'Abwehr'], ['RV', 86, 70, 'Abwehr'], ['LM', 14, 46, 'Mittelfeld'], ['ZM', 38, 50, 'Mittelfeld'], ['ZM', 62, 50, 'Mittelfeld'], ['RM', 86, 46, 'Mittelfeld'], ['ST', 36, 18, 'Sturm'], ['ST', 64, 18, 'Sturm']],
  };
  const elf = () => store.get('elf', { f: '4-3-3', s: {} });
  function vElf() {
    const e = elf();
    const slots = FORMATIONS[e.f] || FORMATIONS['4-3-3'];
    const pros = team('profis').players || [];
    const chosen = Object.values(e.s).map((id) => pros.find((p) => p.id === id)).filter(Boolean);
    const val = chosen.reduce((s, p) => s + (p.value || 0), 0);
    const age = chosen.length ? (chosen.reduce((s, p) => s + (p.age || 0), 0) / chosen.length).toFixed(1).replace('.', ',') : '–';
    let out = pageHead('Meine Elf', 'Tippe auf eine Position und wähle einen Spieler', '', '#/mehr');
    out += `<div class="chips" role="group" aria-label="Formation">${Object.keys(FORMATIONS).map((f) => `<button type="button" class="${f === e.f ? 'on' : ''}" aria-pressed="${f === e.f}" data-action="formation" data-val="${f}">${f}</button>`).join('')}</div>`;
    out += `<div class="pitch" style="margin-top:12px">
      <svg class="pitch-lines" viewBox="0 0 68 92" preserveAspectRatio="none" aria-hidden="true" fill="none" stroke="rgba(253,225,0,.32)" stroke-width=".4">
        <rect x="2" y="2" width="64" height="88"/><path d="M2 46h64"/><circle cx="34" cy="46" r="8"/><rect x="16" y="2" width="36" height="14"/><rect x="25" y="2" width="18" height="5"/><rect x="16" y="76" width="36" height="14"/><rect x="25" y="85" width="18" height="5"/>
      </svg>
      ${slots.map(([pos, x, y], i) => { const p = pros.find((pp) => pp.id === e.s[i]); return `<button type="button" class="slot ${p ? 'filled' : ''}" style="left:${x}%;top:${y}%" data-action="slot" data-i="${i}" aria-label="${p ? esc(p.name) + ' als ' : 'Position '}${pos}">
        <span class="sl-c">${p ? img(pimg(p.img, 'medium'), '', p.name, initials(p.name)) : I.plus}</span><span class="sl-n">${p ? esc(p.name.split(' ').slice(-1)[0]) : pos}</span></button>`; }).join('')}
    </div>`;
    out += `<div class="grid3" style="margin-top:12px"><div class="stat-box"><b>${chosen.length}/11</b><span>Spieler</span></div><div class="stat-box"><b class="yellow" style="font-size:20px">${money(val, { short: 1 })}</b><span>Marktwert</span></div><div class="stat-box"><b>${age}</b><span>Ø Alter</span></div></div>`;
    out += `<button type="button" class="btn ghost" style="width:100%;margin-top:12px" data-action="elf-reset">Aufstellung leeren</button>`;
    return out;
  }
  function openSlot(i) {
    const e = elf();
    const slots = FORMATIONS[e.f] || FORMATIONS['4-3-3'];
    const [pos, , , grp] = slots[i];
    const taken = new Set(Object.entries(e.s).filter(([k]) => +k !== i).map(([, v]) => v));
    const pros = [...(team('profis').players || [])].sort((a, b) => ((b.group === grp) - (a.group === grp)) || ((b.value || 0) - (a.value || 0)));
    openSheet(`<h2 class="display" style="font-size:26px;margin-bottom:4px">${pos} wählen</h2><p class="muted" style="font-size:12px;margin-bottom:8px">Passende Spieler zuerst</p>
      <div class="list">${e.s[i] ? `<button type="button" class="li" data-action="pick" data-i="${i}" data-id="" style="background:none;border:0;width:100%;text-align:left"><span class="fb avatar sm">×</span><span class="grow-1 t">Position leeren</span></button>` : ''}
      ${pros.map((p) => `<button type="button" class="li" data-action="pick" data-i="${i}" data-id="${p.id}" ${taken.has(p.id) ? 'disabled style="opacity:.35;background:none;border:0;width:100%;text-align:left"' : 'style="background:none;border:0;width:100%;text-align:left;color:var(--text)"'}>
        ${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}<span class="grow-1"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.position || '')}${p.group === grp ? ' · <span class="yellow">passt</span>' : ''}</div></span><span class="v">${money(p.value, { short: 1 })}</span></button>`).join('')}</div>`);
  }

  function vTalente() {
    const seen = new Set();
    const list = [];
    for (const k of ['u19', 'u23', 'profis']) {
      for (const p of team(k).players || []) {
        if (seen.has(p.id) || !p.age || p.age > 21) continue;
        seen.add(p.id);
        list.push(Object.assign({ team: k }, p));
      }
    }
    list.sort((a, b) => (b.value || 0) - (a.value || 0));
    const mx = (list[0] && list[0].value) || 1;
    let out = pageHead('Talente-Radar', 'Alle Spieler bis 21 Jahre – Profis, BVB II und U19', '', '#/mehr');
    out += `<div class="card" style="padding:6px 14px"><div class="list">${list.slice(0, 30).map((p, i) => `<a class="li" href="#/spieler/${p.team}/${p.id}"><span class="rank">${i + 1}</span>${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}
      <span class="grow-1" style="display:flex;flex-direction:column;gap:4px"><span class="row" style="justify-content:space-between;gap:8px"><span class="t ellipsis">${esc(p.name)}</span><span class="v">${money(p.value, { short: 1 })}${p.prevValue && p.value > p.prevValue ? ' <span class="green">▲</span>' : ''}</span></span>
      <span class="s">${p.age} J. · ${esc(p.position || '')} · <span class="badge" style="padding:2px 5px">${esc(TEAMNAME[p.team])}</span></span><span class="bar"><span style="width:${((p.value || 0) / mx * 100).toFixed(0)}%;animation-delay:${Math.min(i, 12) * 0.04}s"></span></span></span></a>`).join('') || '<p class="muted" style="padding:10px 0">Keine Daten.</p>'}</div></div>`;
    return out;
  }

  function vLazarett() {
    const rows = [];
    const seen = new Set();
    for (const p of allPlayers()) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      for (const a of absencesOf(p)) rows.push({ p, a });
    }
    const inj = rows.filter((r) => r.a.type === 'injury');
    const sus = rows.filter((r) => r.a.type === 'suspension' || r.a.type === 'out');
    const inel = rows.filter((r) => r.a.type === 'ineligible');
    const news = (D.news || {}).injuryNews || [];
    const row = (r) => `<a class="li" href="#/spieler/${r.p.team}/${r.p.id}">${img(pimg(r.p.img, 'medium'), 'avatar sm', r.p.name, initials(r.p.name))}<span class="grow-1"><div class="t ellipsis">${esc(r.p.name)} <span class="faint" style="font-size:11px;font-weight:500">${esc(TEAMNAME[r.p.team])}</span></div><div class="s">${esc(r.a.text)}</div></span></a>`;
    let out = pageHead('Lazarett', 'Laut Transfermarkt, ergänzt durch Gemini-News', '', '#/mehr');
    out += `<div class="grid3"><div class="stat-box"><b class="red">${inj.length}</b><span>Verletzt</span></div><div class="stat-box"><b class="amber">${sus.length}</b><span>Gesperrt</span></div><div class="stat-box"><b>${news.filter((n) => n.status === 'back' || n.status === 'fit').length}</b><span>Rückkehrer</span></div></div>`;
    if (news.length) {
      out += `<section class="section"><div class="section-h"><h2>KI-News</h2><span class="faint" style="font-size:11px">via Gemini</span></div>${news.slice(0, 12).map((n) => `<div class="abs info"><span class="badge ${n.status === 'fit' || n.status === 'back' ? 'green' : n.status === 'doubtful' ? 'amber' : 'red'}">${esc({ injured: 'FÄLLT AUS', doubtful: 'FRAGLICH', back: 'TRAINING', fit: 'FIT' }[n.status] || '')}</span><span><b>${esc(n.player)}</b> ${esc(n.text || '')}${n.expectedReturn ? ` · Rückkehr: ${esc(n.expectedReturn)}` : ''}<div class="faint" style="font-size:11px;margin-top:2px">${esc(n.source || '')} · ${esc(fmtDate(n.date))}</div></span></div>`).join('')}</section>`;
    }
    out += `<section class="section"><div class="section-h"><h2>Verletzt</h2></div><div class="card" style="padding:4px 14px"><div class="list">${inj.map(row).join('') || '<p class="green" style="padding:10px 0;font-size:13px">Keine Verletzten gemeldet.</p>'}</div></div></section>`;
    out += `<section class="section"><div class="section-h"><h2>Gesperrt / fehlt</h2></div><div class="card" style="padding:4px 14px"><div class="list">${sus.map(row).join('') || '<p class="muted" style="padding:10px 0;font-size:13px">Niemand gesperrt.</p>'}</div></div></section>`;
    if (inel.length) out += `<section class="section"><div class="section-h"><h2>Nicht spielberechtigt</h2></div><div class="card" style="padding:4px 14px"><div class="list">${inel.map(row).join('')}</div></div></section>`;
    return out;
  }

  function vErfolge() {
    const titles = (D.squads || {}).titles || [];
    const totalT = titles.reduce((s, t) => s + (t.count || 0), 0);
    const hist = historyItem();
    const y = new Date().getFullYear();
    let out = pageHead('Erfolge', totalT ? `${totalT} große Titel laut Transfermarkt` : 'Titel & große Momente', '', '#/mehr');
    if (titles.length) {
      out += `<div class="grid2">${titles.map((t) => `<div class="card title-tile">${img(t.img, '', t.title, '🏆')}<span><b>${t.count}×</b><div class="muted" style="font-size:12px;line-height:1.3">${esc(t.title)}</div></span></div>`).join('')}</div>`;
    }
    if (hist && hist.today) out += `<section class="card-y" style="margin-top:12px"><span class="label">Heute vor ${hist.years} Jahren</span><b style="font-size:16px;display:block;margin-top:4px">${esc(hist.h[2])}</b></section>`;
    out += `<section class="section"><div class="section-h"><h2>Große Momente</h2></div><div class="card" style="padding:4px 14px"><div class="list">
      ${[...HISTORY].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0])).map((h) => `<div class="li"><span class="display yellow" style="font-size:20px;width:46px;flex:none">${h[1]}</span><span class="grow-1"><div class="t" style="font-size:13px">${esc(h[2])}</div><div class="s">${h[0].slice(3)}.${h[0].slice(0, 2)}.${h[1]} · vor ${y - h[1]} Jahren</div></span></div>`).join('')}
    </div></div></section>`;
    return out;
  }

  function vInstall() {
    const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    let out = pageHead('Als App installieren', '', '', '#/mehr');
    if (standalone) out += `<div class="abs info" style="margin-bottom:12px">${I.ok}<span><b>Läuft bereits als App.</b> Du hast BVB 09 schon auf dem Home-Bildschirm.</span></div>`;
    out += `<section class="card"><div class="steps">
      <div class="step"><span>Öffne diese Seite in <b>Safari</b> auf deinem iPhone.</span></div>
      <div class="step"><span>Tippe unten auf <b>Teilen</b> ${I.share.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px;stroke:var(--y)"')}</span></div>
      <div class="step"><span>Wähle <b>„Zum Home-Bildschirm“</b>. Eventuell musst du dafür etwas nach unten scrollen.</span></div>
      <div class="step"><span>Tippe auf <b>„Hinzufügen“</b>. Fertig, das BVB-09-Icon ist jetzt auf deinem Home-Bildschirm.</span></div>
    </div></section>
    <p class="muted" style="font-size:12px;margin-top:12px;line-height:1.5">Die App öffnet sich dann im Vollbild wie eine normale App, ganz ohne App Store und komplett kostenlos.</p>`;
    return out;
  }

  function vInfo() {
    return pageHead('Über die App', '', '', '#/mehr') + `<section class="card" style="display:flex;flex-direction:column;gap:10px;font-size:13px;line-height:1.55">
      <p><b>BVB 09</b> ist eine inoffizielle Fan-App. Sie ist nicht mit Borussia Dortmund verbunden. Namen, Wappen und Fotos gehören den jeweiligen Rechteinhabern.</p>
      <p><b>So bleibt alles aktuell:</b> 3× täglich (8:17, 14:17 und 20:17 Uhr) läuft ein Programm auf GitHub. Es holt Spiele und Tabellen von OpenLigaDB und Schlagzeilen über Google News. Die kostenlose <b>Gemini-KI</b> wertet die Meldungen aus und macht daraus Here-we-go-Karten, Verletzungs-News, neue Marktwerte, Vertragsverlängerungen und das KI-Briefing. Tore zählt die App live aus den Spielberichten.</p>
      <p><b>Transfermarkt</b> sperrt Server wie GitHub mit einem Bot-Schutz. Kader, Verträge und Statistiken stammen deshalb vom letzten direkten Abruf und werden über die KI-News ergänzt. Fotos und Wappen kommen von Transfermarkt und TheSportsDB.</p>
      <p><b>Gerüchte-Ampel:</b> Stufe 1 (grün) = sehr verlässlich (z. B. Fabrizio Romano, Sky, kicker, Ruhr Nachrichten, offizielle Meldungen). Stufe 2 (gelb) = meist verlässlich (z. B. Bild, Sport1, Transfermarkt-Gerüchteküche). Alles andere wird nicht angezeigt.</p>
      <p><b>Live-Ergebnisse</b> holt die App während der Spiele jede halbe Minute direkt von OpenLigaDB.</p>
      <p class="faint">Alle Angaben ohne Gewähr. KI-Zusammenfassungen können Fehler enthalten. Bei den Quellen kannst du jede Meldung nachlesen.</p>
    </section>
    <a class="btn ghost" style="width:100%;margin-top:12px" href="https://github.com/${REPO}" target="_blank" rel="noopener">${I.github} Projekt auf GitHub</a>`;
  }

  // ------------------------------------------------------------------ Sheet (Spieldetails)
  function openSheet(html) {
    const sh = $('#sheet');
    $('.sheet-body', sh).innerHTML = html;
    sh.hidden = false;
    sh.classList.remove('closing');
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    const sh = $('#sheet');
    if (sh.hidden) return;
    sh.classList.add('closing');
    setTimeout(() => { sh.hidden = true; sh.classList.remove('closing'); document.body.style.overflow = ''; }, reduce ? 0 : 240);
  }
  function icsFor(m) {
    const t = new Date(m.date);
    const e = new Date(t.getTime() + 2 * 36e5);
    const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BVB09 Fan-App//DE', 'BEGIN:VEVENT', `UID:${m.id}@bvb09`, `DTSTAMP:${f(new Date())}`,
      `DTSTART:${f(t)}`, `DTEND:${f(e)}`, `SUMMARY:${tname(m.home)} – ${tname(m.away)} (${m.comp || ''})`, `LOCATION:${m.location || ''}`,
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Anpfiff in 1 Stunde', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(txt);
  }
  function openMatch(id, k) {
    const m = matchList(k).find((x) => x.id === id);
    if (!m) return;
    const live = isLive(m);
    const fin = m.finished && m.score;
    const goals = (m.goals || []).map((g) => `<div class="goal ${g.team === 'away' ? 'away' : ''}"><time>${g.minute != null ? g.minute + "'" : ''}</time><span>${esc(g.scorer || 'Tor')}${g.penalty ? ' (E)' : ''}${g.ownGoal ? ' (ET)' : ''}</span><b>${esc(g.score || '')}</b></div>`).join('');
    openSheet(`<div style="display:flex;flex-direction:column;gap:14px;padding-top:4px">
      <div class="row" style="justify-content:center;gap:8px">${live ? '<span class="live-badge">LIVE</span>' : ''}<span class="badge y">${esc(m.comp || '')}${m.round ? ' · ' + esc(m.round) : ''}</span></div>
      <div class="vs-row"><div class="vs-team">${crest(m.home, 'crest lg')}<span>${esc(m.home.name)}</span></div>
        <div class="vs-mid">${fin || live ? `<span class="score">${m.score ? m.score[0] + ':' + m.score[1] : '0:0'}</span>${m.half ? `<span class="label">HZ ${m.half[0]}:${m.half[1]}</span>` : ''}` : '<span class="vs">VS</span>'}</div>
        <div class="vs-team">${crest(m.away, 'crest lg')}<span>${esc(m.away.name)}</span></div></div>
      <p class="muted" style="text-align:center;font-size:13px">${esc(dayLabel(m.date))} · ${m.timeKnown === false ? 'Uhrzeit offen' : esc(F.time.format(new Date(m.date))) + ' Uhr'}${m.location ? ' · ' + esc(m.location) : ''}</p>
      ${!fin && !live ? `<div class="countdown" data-countdown="${esc(m.date)}">${countdownHtml(m.date)}</div><a class="btn ghost" href="${icsFor(m)}" download="bvb-spiel.ics">${I.cal} In den Kalender eintragen</a>` : ''}
      ${goals ? `<section><h3 class="label" style="margin-bottom:8px">Tore</h3><div class="goals">${goals}</div></section>` : fin ? '<p class="muted" style="text-align:center;font-size:13px">Keine Torschützen-Daten.</p>' : ''}
      <button type="button" class="btn" data-close>Schließen</button>
    </div>`);
  }

  // ------------------------------------------------------------------ Router
  const ROUTES = [
    [/^\/home$/, 'home', () => vHome()],
    [/^\/transfers(?:\/(news|werte|bilanz|vertraege))?$/, 'transfers', (m) => vTransfers(m[1] || 'news')],
    [/^\/spiele(?:\/(profis|u23))?(?:\/(kommend|ergebnisse|tabelle|torschuetzen))?$/, 'spiele', (m) => vSpiele(m[1] || UI.spieleTeam || 'profis', m[2] || 'kommend')],
    [/^\/kader(?:\/(profis|u23|u19))?$/, 'kader', (m) => vKader(m[1] || UI.kaderTeam || 'profis')],
    [/^\/spieler\/(profis|u23|u19)\/(\d+)$/, 'kader', (m) => vSpieler(m[1], m[2])],
    [/^\/mehr$/, 'mehr', () => vMehr()],
    [/^\/mehr\/update$/, 'mehr', () => vUpdate()],
    [/^\/mehr\/stats$/, 'mehr', () => vStats()],
    [/^\/mehr\/elf$/, 'mehr', () => vElf()],
    [/^\/mehr\/talente$/, 'mehr', () => vTalente()],
    [/^\/mehr\/lazarett$/, 'mehr', () => vLazarett()],
    [/^\/mehr\/erfolge$/, 'mehr', () => vErfolge()],
    [/^\/mehr\/install$/, 'mehr', () => vInstall()],
    [/^\/mehr\/info$/, 'mehr', () => vInfo()],
  ];
  const TABS = ['home', 'transfers', 'spiele', 'kader', 'mehr'];
  function skeleton() {
    return '<div class="skel" style="height:56px;margin-bottom:14px"></div><div class="skel" style="height:240px"></div><div class="grid2" style="margin-top:12px"><div class="skel" style="height:110px"></div><div class="skel" style="height:110px"></div></div><div class="skel" style="height:150px;margin-top:12px"></div>';
  }
  function render(opts = {}) {
    const path = (location.hash || '#/home').slice(1) || '/home';
    const r = ROUTES.find(([re]) => re.test(path)) || ROUTES[0];
    const m = path.match(r[0]) || [];
    const same = S.route === path;
    if (!same && S.route) S.scroll[S.route] = window.scrollY;
    let html;
    try {
      html = D.loaded ? r[2](m) : skeleton();
    } catch (err) {
      console.error(err);
      html = pageHead('Hoppla') + `<div class="empty">Diese Ansicht konnte nicht geladen werden.<br><span class="faint">${esc(err.message)}</span></div>`;
    }
    const v = $('#view');
    v.innerHTML = html;
    v.classList.remove('view-in');
    if (opts.animate !== false && !reduce && (!same || opts.forceAnim)) { void v.offsetWidth; v.classList.add('view-in'); }
    setTab(r[1]);
    if (!same) window.scrollTo(0, opts.restore ? (S.scroll[path] || 0) : 0);
    S.route = path;
    if (opts.animate !== false) countUps(v);
    saveUI();
  }
  function setTab(t) {
    S.tab = t;
    const i = TABS.indexOf(t);
    $$('#tabbar .tab').forEach((a) => {
      const on = a.dataset.tab === t;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const ind = $('#tabbar .tab-ind');
    if (ind) ind.style.transform = `translateX(${i * 100}%)`;
  }
  function countUps(root) {
    if (reduce) return;
    root.querySelectorAll('[data-count]').forEach((el) => {
      const to = +el.dataset.count;
      const fmt = el.dataset.fmt;
      if (!to) return;
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 900);
        const e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt === 'money' ? money(Math.round((to * e) / 10000) * 10000) : nf0.format(Math.round(to * e));
        if (k < 1) requestAnimationFrame(step); else el.textContent = fmt === 'money' ? money(to) : nf0.format(to);
      };
      requestAnimationFrame(step);
    });
  }

  // ------------------------------------------------------------------ Events
  document.addEventListener('click', (e) => {
    const close = e.target.closest('[data-close]');
    if (close) { closeSheet(); return; }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action;
    if (act === 'team') { UI[a.dataset.key] = a.dataset.val; render({ forceAnim: true }); }
    else if (act === 'filter') { UI.newsFilter = a.dataset.val; render({ forceAnim: true }); }
    else if (act === 'kfilter') { UI.kaderFilter = a.dataset.val; $$('[data-action="kfilter"]').forEach((b) => { b.classList.toggle('on', b === a); b.setAttribute('aria-pressed', b === a); }); $('#kgrid').innerHTML = kaderGrid(UI.kaderTeam); saveUI(); }
    else if (act === 'tmore') { const box = a.nextElementSibling; const open = box.hidden; box.hidden = !open; a.setAttribute('aria-expanded', open); a.textContent = open ? 'Weniger anzeigen' : 'Quellen & Verlauf'; }
    else if (act === 'match') openMatch(a.dataset.id, a.dataset.team);
    else if (act === 'back') { if (history.length > 1 && S.prev) history.back(); else location.hash = a.dataset.fallback || '#/home'; }
    else if (act === 'reload') { a.disabled = true; refresh(true).then(() => { a.disabled = false; }); }
    else if (act === 'formation') { const el = elf(); el.f = a.dataset.val; el.s = {}; store.set('elf', el); render({ animate: false }); }
    else if (act === 'slot') openSlot(+a.dataset.i);
    else if (act === 'pick') { const el = elf(); if (a.dataset.id) el.s[a.dataset.i] = a.dataset.id; else delete el.s[a.dataset.i]; store.set('elf', el); closeSheet(); render({ animate: false }); }
    else if (act === 'elf-reset') { store.set('elf', { f: elf().f, s: {} }); render({ animate: false }); }
  });
  document.addEventListener('input', (e) => {
    if (e.target && e.target.dataset && e.target.dataset.action === 'search') {
      UI.kaderSearch = e.target.value;
      $('#kgrid').innerHTML = kaderGrid(UI.kaderTeam);
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  window.addEventListener('hashchange', () => { S.prev = true; closeSheet(); render(); });

  // Ziehen zum Aktualisieren
  (() => {
    let y0 = null;
    let dy = 0;
    const ptr = $('#ptr');
    window.addEventListener('touchstart', (e) => { y0 = window.scrollY <= 0 && $('#sheet').hidden ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      if (dy > 0 && window.scrollY <= 0) {
        const k = Math.min(1, dy / 90);
        ptr.style.opacity = k;
        ptr.style.transform = `translateY(${Math.min(dy, 110) - 60}px) scale(${0.6 + k * 0.4}) rotate(${dy * 3}deg)`;
      }
    }, { passive: true });
    window.addEventListener('touchend', () => {
      if (y0 == null) return;
      y0 = null;
      if (dy > 90) {
        ptr.classList.add('spin');
        ptr.style.transform = 'translateY(20px) scale(1)';
        refresh(true).finally(() => { ptr.classList.remove('spin'); ptr.style.opacity = 0; ptr.style.transform = ''; });
      } else { ptr.style.opacity = 0; ptr.style.transform = ''; }
      dy = 0;
    });
  })();

  // ------------------------------------------------------------------ Laden, Live, Timer
  async function loadData(force) {
    const bust = force ? Date.now() : Math.floor(Date.now() / 300000);
    const res = await Promise.all(FILES.map((f) => fetch(`data/${f}.json?v=${bust}`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)));
    let any = false;
    FILES.forEach((f, i) => { if (res[i]) { D[f] = res[i]; any = true; } });
    if (any) D.loaded = true;
    S.lastLoad = Date.now();
    return any;
  }
  async function refresh(force) {
    const before = (D.status || {}).lastRun;
    const ok = await loadData(force);
    await pollLive(true);
    render({ animate: false });
    const after = (D.status || {}).lastRun;
    toast(!ok ? 'Keine Verbindung – zeige gespeicherte Daten' : after && after !== before ? 'Neue Daten geladen' : `Aktuell · Stand ${after ? F.time.format(new Date(after)) + ' Uhr' : '–'}`);
  }
  let toastT = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), 2400);
  }
  function normLive(j, m) {
    const goals = [];
    let last = [0, 0];
    for (const g of [...(j.goals || [])].sort((a, b) => (a.matchMinute || 0) - (b.matchMinute || 0) || (a.goalID || 0) - (b.goalID || 0))) {
      const s = [g.scoreTeam1 || 0, g.scoreTeam2 || 0];
      goals.push({ minute: g.matchMinute, scorer: g.goalGetterName, score: `${s[0]}:${s[1]}`, team: s[0] > last[0] ? 'home' : 'away', penalty: !!g.isPenalty, ownGoal: !!g.isOwnGoal });
      last = s;
    }
    let score = last;
    for (const r of j.matchResults || []) if (r.resultTypeID === 2) score = [r.pointsTeam1, r.pointsTeam2];
    const finished = !!j.matchIsFinished;
    let outcome = null;
    if (finished) {
      const mine = m.isHome ? score[0] : score[1];
      const other = m.isHome ? score[1] : score[0];
      outcome = mine > other ? 'W' : mine < other ? 'L' : 'D';
    }
    return { score, goals, finished, outcome, live: !finished };
  }
  async function pollLive(once) {
    const now = Date.now();
    const cands = ((D.matches || {}).profis || []).filter((m) => m.oldbId && !(S.live[m.id] && S.live[m.id].finished) && !m.finished
      && Date.parse(m.date) - now < 10 * 60e3 && now - Date.parse(m.date) < 4 * 36e5);
    if (!cands.length) return false;
    let changed = false;
    for (const m of cands) {
      try {
        const j = await (await fetch(`https://api.openligadb.de/getmatchdata/${m.oldbId}`, { cache: 'no-store' })).json();
        const l = normLive(j, m);
        if (JSON.stringify(S.live[m.id]) !== JSON.stringify(l)) {
          const prev = S.live[m.id];
          S.live[m.id] = l;
          changed = true;
          if (prev && l.goals.length > prev.goals.length) {
            const g = l.goals[l.goals.length - 1];
            toast(`TOR! ${g.scorer || ''} ${g.score}`);
          }
        }
      } catch (e) { /* offline */ }
    }
    if (changed && !once && (S.tab === 'home' || S.tab === 'spiele')) render({ animate: false });
    return changed;
  }
  function tick() {
    $$('[data-countdown]').forEach((el) => {
      const iso = el.dataset.countdown;
      if (Date.parse(iso) <= Date.now()) { if (!el.dataset.done) { el.dataset.done = 1; pollLive(); } return; }
      el.innerHTML = countdownHtml(iso);
    });
  }
  function relTick() { $$('[data-rel]').forEach((el) => { if (el.dataset.rel) el.textContent = rel(el.dataset.rel); }); }

  async function init() {
    if ('serviceWorker' in navigator && location.hostname !== 'localhost') navigator.serviceWorker.register('sw.js').catch(() => {});
    const t0 = Date.now();
    render();
    await loadData(false);
    await pollLive(true);
    const wait = Math.max(0, 650 - (Date.now() - t0));
    setTimeout(() => {
      render({ forceAnim: true });
      const sp = $('#splash');
      sp.classList.add('out');
      setTimeout(() => sp.remove(), 700);
    }, wait);
    setInterval(tick, 1000);
    setInterval(relTick, 30000);
    setInterval(() => pollLive(false), 30000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - S.lastLoad > 10 * 60e3) loadData(false).then(() => render({ animate: false }));
    });
  }
  init();
})();
