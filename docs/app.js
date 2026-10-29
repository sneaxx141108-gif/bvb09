/* BVB 09 – inoffizielle Fan-App · Design "Flutlicht"
 * Daten: data/*.json (3x taeglich von GitHub Actions + Gemini aktualisiert),
 * Live-Ergebnisse direkt von OpenLigaDB. */
'use strict';
(() => {
  const REPO = 'sneaxx141108-gif/bvb09';
  const FILES = ['status', 'status-pc', 'squads', 'stats', 'transfers', 'news', 'matches', 'tables', 'matchcenter', 'season', 'cl'];
  const TZ = 'Europe/Berlin';
  const BVB = { name: 'Borussia Dortmund', crest: 'https://tmssl.akamaized.net/images/wappen/head/16.png' };
  const osReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = osReduce.matches; // steuern die Einstellungen (Animationen)
  const D = { loaded: false };
  const S = { live: {}, route: null, scroll: {}, lastLoad: 0, tab: 'home', seg: {}, depth: 0, tabIdx: 0 };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const raf2 = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

  const store = {
    get(k, d) { try { const v = localStorage.getItem('bvb09.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('bvb09.' + k, JSON.stringify(v)); } catch (e) { /* privat */ } },
  };
  const UI = Object.assign({ kaderTeam: 'profis', spieleTeam: 'profis', vertTeam: 'profis',
    statsTeam: 'profis', statsComp: 'all', scorerTab: 'goals', newsFilter: 'alle', kaderFilter: 'alle' }, store.get('ui', {}));
  UI.kaderSearch = '';
  const saveUI = () => { const c = Object.assign({}, UI); delete c.kaderSearch; store.set('ui', c); };

  // Einstellungen – nur auf diesem Geraet gespeichert
  const SET = Object.assign({ name: 'Niklas', motion: 'auto', daytime: true, horn: true, home: null }, store.get('settings', {}));
  const saveSET = () => store.set('settings', SET);
  const userName = () => String(SET.name || '').trim().slice(0, 24);
  function applyMotion() {
    reduce = SET.motion === 'reduced' || (SET.motion !== 'full' && osReduce.matches);
    document.documentElement.classList.toggle('rm', SET.motion === 'reduced');
    document.documentElement.classList.toggle('fm', SET.motion === 'full');
  }
  applyMotion();
  if (osReduce.addEventListener) osReduce.addEventListener('change', applyMotion);

  // ------------------------------------------------------------------ Icons
  const sv = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
  const I = {
    back: sv('<path d="M15 5l-7 7 7 7"/>', 'stroke-width="2.4"'),
    x: sv('<path d="M6 6l12 12M18 6 6 18"/>', 'stroke-width="2.4"'),
    down: sv('<path d="M6 9l6 6 6-6"/>', 'stroke-width="2.4"'),
    check: sv('<path d="M5 12.5 10 17 19 7"/>', 'stroke-width="3"'),
    cal: sv('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
    ai: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c.5 4.9 2.6 7 7.5 7.5v1C14.6 11 12.5 13.1 12 18h-1c-.5-4.9-2.6-7-7.5-7.5v-1C8.4 9 10.5 6.9 11 2z"/><path d="M19 15c.2 2 1 2.8 3 3v.6c-2 .2-2.8 1-3 3h-.6c-.2-2-1-2.8-3-3V18c2-.2 2.8-1 3-3z"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    plus: sv('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.6"'),
    injury: sv('<path d="M12 4v16M4 12h16"/>', 'stroke="#FF5A4E" stroke-width="3"'),
    warn: sv('<path d="M12 3 2 20h20zM12 10v4M12 17h.01"/>', 'stroke="#FFB020"'),
    ok: sv('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>', 'stroke="#3BD67F"'),
    bad: sv('<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>', 'stroke="#FF5A4E"'),
    info: sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', 'stroke="#FDE100"'),
    infoC: sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    refresh: sv('<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/>'),
    trophy: sv('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>'),
    chart: sv('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    shirt: sv('<path d="M8 3.5 4 6l1.5 4.5L8 9.6V20.5h8V9.6l2.5.9L20 6l-4-2.5a4 4 0 0 1-8 0z"/>'),
    sprout: sv('<path d="M12 21v-9M12 12C12 7 8 5 4 5c0 5 3 7 8 7zM12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/>'),
    cross: sv('<rect x="3" y="3" width="18" height="18" rx="6"/><path d="M12 8v8M8 12h8"/>'),
    phone: sv('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>'),
    share: sv('<path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
    github: sv('<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.8 2.8 5.8 3.1 5.8 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>'),
    target: sv('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>'),
    star: sv('<path d="M12 3.5l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9L3.4 9.8l6-.8z"/>'),
    link: sv('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    starF: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9L3.4 9.8l6-.8z"/></svg>',
    gear: sv('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    grip: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>',
    swap: sv('<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'),
    horn: sv('<path d="M4 10v4a1 1 0 0 0 1 1h3l5 4V5L8 9H5a1 1 0 0 0-1 1zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
    bell: sv('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
    sun: sv('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    motion: sv('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
    news: sv('<path d="M5 4h11a2 2 0 0 1 2 2v13a1 1 0 0 0 2 0V9M5 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14M7 8h7M7 12h7M7 16h4"/>'),
    cake: sv('<path d="M4 21V12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9M2 21h20M4 15c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1 4 0M12 10V7M12 4.5V4"/>'),
    story: sv('<circle cx="12" cy="12" r="9" stroke-dasharray="4 3"/><circle cx="12" cy="12" r="4.5"/>'),
    mood: sv('<path d="M4 16a8 8 0 0 1 16 0M12 16l4-5"/>'),
  };
  const SIL = '<svg class="tc-sil" viewBox="0 0 120 140" aria-hidden="true"><circle cx="60" cy="46" r="27" fill="#0A0900"/><path d="M6 140c5-36 27-54 54-54s49 18 54 54z" fill="#0A0900"/></svg>';
  const SIL_SOFT = SIL.replace(/#0A0900/g, '#2B2B2B');

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
    long: dtf({ weekday: 'long', day: 'numeric', month: 'long' }),
    time: dtf({ hour: '2-digit', minute: '2-digit' }),
    date: dtf({ day: '2-digit', month: '2-digit', year: 'numeric' }),
    dm: dtf({ day: '2-digit', month: '2-digit' }),
    wd: dtf({ weekday: 'short' }),
    dd: dtf({ day: 'numeric' }),
    mon: dtf({ month: 'short' }),
    hour: dtf({ hour: 'numeric', hourCycle: 'h23' }),
    ymd: new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }),
  };
  const toDate = (s) => (s && s.length === 10 ? new Date(s + 'T12:00:00Z') : new Date(s));
  const berlinYMD = (d) => F.ymd.format(d instanceof Date ? d : toDate(d));
  const daysUntil = (iso) => Math.round((toDate(berlinYMD(iso)) - toDate(berlinYMD(new Date()))) / 864e5);
  function dayLabel(iso) {
    const n = daysUntil(iso);
    if (n === 0) return 'Heute';
    if (n === 1) return 'Morgen';
    if (n === -1) return 'Gestern';
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
  const UNK = 'k. A.'; // Angabe nicht sicher bekannt
  const initials = (n) => String(n || '?').split(/[\s-]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const lastName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0];
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
    if (!src) return `<span class="fb ${cls}" aria-hidden="true">${esc(fb === 'sil' ? '' : fb || '')}</span>`;
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
  const compShort = (c) => ({ 'Champions League': 'CL', 'DFB-Pokal': 'Pokal', Bundesliga: 'BL', 'Europa League': 'EL', 'Conference League': 'ECL', Supercup: 'Supercup' }[c] || c || '');
  const flagImgs = (flags) => (flags || []).map((f) => `<img class="flag" src="${esc(f.img)}" alt="${esc(f.name)}" title="${esc(f.name)}" loading="lazy" referrerpolicy="no-referrer">`).join(' ');

  document.addEventListener('error', (e) => {
    const el = e.target;
    if (!el || el.tagName !== 'IMG' || !('fb' in el.dataset)) return;
    if (el.dataset.fb === 'sil') {
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
  const TEAMNAME = { profis: 'Profis', u23: 'BVB II', u19: 'U19' };
  function allPlayers() {
    const out = [];
    for (const [k, t] of Object.entries(teams())) for (const p of t.players || []) out.push(Object.assign({ team: k }, p));
    return out;
  }
  const findPlayer = (k, id) => (team(k).players || []).find((p) => p.id === id);
  const playerByName = (name) => { const s = slug(name); return allPlayers().find((p) => slug(p.name) === s) || null; };
  function withLive(m) { const l = S.live[m.id]; return l ? Object.assign({}, m, l) : m; }
  const matchList = () => ((D.matches || {}).profis || []).map(withLive);
  function isLive(m) {
    if (m.finished) return false;
    const t = Date.parse(m.date);
    return t <= Date.now() && Date.now() - t < 150 * 60e3 && !!(m.oldbId || m.live);
  }
  const nextMatch = (k) => matchList(k).find((m) => !m.finished && Date.parse(m.date) > Date.now() - 150 * 60e3);
  const lastMatch = (k) => { const f = matchList(k).filter((m) => m.finished && m.score); return f[f.length - 1]; };
  const formOf = (k, n = 5) => matchList(k).filter((m) => m.finished && m.outcome).slice(-n).map((m) => m.outcome);
  const FORM_L = { W: 'S', D: 'U', L: 'N' };
  const FORM_T = { W: 'Sieg', D: 'Unentschieden', L: 'Niederlage' };
  const formHtml = (f, cls = '') => `<span class="form ${cls}" role="img" aria-label="Form: ${f.map((x) => FORM_T[x]).join(', ') || 'keine Spiele'}">${f.map((x) => `<i class="${x}">${FORM_L[x]}</i>`).join('')}</span>`;
  function scorers(m) {
    const mine = m.isHome ? 'home' : 'away';
    const c = {};
    for (const g of m.goals || []) {
      if (g.ownGoal ? g.team === mine : g.team !== mine) continue;
      const n = lastName(g.scorer) || '?';
      c[n] = (c[n] || 0) + 1;
    }
    return Object.entries(c).map(([n, k]) => (k > 1 ? `${n} (${k})` : n)).join(', ');
  }
  function liveGoals() {
    const key = S.lastLoad + ':' + Object.keys(S.live).length;
    if (S._lgKey === key) return S._lg;
    const by = {};
    for (const m of matchList('profis')) {
      const mine = m.isHome ? 'home' : 'away';
      for (const g of m.goals || []) {
        if (g.ownGoal || g.team !== mine || !g.scorer) continue;
        const l = slug(g.scorer).split('-').pop();
        by[l] = (by[l] || 0) + 1;
      }
    }
    S._lg = by;
    S._lgKey = key;
    return by;
  }
  const COMPS = [['all', 'Alle'], ['bl1', 'Bundesliga'], ['dfb', 'Pokal'], ['ucl', 'CL']];
  function statsOf(k, id, comp) {
    // Statistiken nur fuer die Profis - U23/U19-Zahlen wuerden veralten (Transfermarkt sperrt GitHub)
    if (k !== 'profis') return undefined;
    const st = (((D.stats || {}).teams || {})[k] || {})[id];
    if (comp && comp !== 'all') return ((st || {}).byComp || {})[comp] || (st ? { apps: 0, goals: 0, assists: 0, minutes: 0, yellow: 0, red: 0 } : st);
    const p = findPlayer(k, id);
    if (!p) return st;
    const l = slug(p.name).split('-').pop();
    const same = (team('profis').players || []).filter((x) => slug(x.name).split('-').pop() === l).length;
    const g = same === 1 ? liveGoals()[l] || 0 : 0;
    if (!st) return g ? { goals: g, apps: 0, assists: 0, minutes: 0 } : st;
    return g > (st.goals || 0) ? Object.assign({}, st, { goals: g }) : st;
  }
  // Verletzungen laut FotMob (täglich aktualisiert): Rückkehr-Prognose ergänzen oder eigenen Eintrag anlegen
  function absencesOf(p) {
    const list = absencesRaw(p);
    const fi = p.fmInjury;
    if (!fi) return list;
    const inj = list.find((a) => a.type === 'injury');
    if (!inj) return [...list, { type: 'injury', text: `Verletzt${fi.return ? ' · Rückkehr: ' + fi.return : ''} (laut FotMob)`, fm: true }];
    if (!fi.return || /Rückkehr:/.test(inj.text || '')) return list;
    const text = /Rückkehr unbekannt/.test(inj.text || '') ? inj.text.replace(/Rückkehr unbekannt/, `Rückkehr laut FotMob: ${fi.return}`) : `${inj.text || 'Verletzt'} · Rückkehr laut FotMob: ${fi.return}`;
    return list.map((a) => (a === inj ? Object.assign({}, a, { text }) : a));
  }
  function absencesRaw(p) {
    // Sperren und fehlende Spielberechtigungen mit "bis TT.MM.JJJJ" laufen von selbst ab
    const today = berlinYMD(new Date());
    const base = (p.absences || []).filter((a) => { const m = /bis (\d{2})\.(\d{2})\.(\d{4})/.exec(a.text || ''); return !m || `${m[3]}-${m[2]}-${m[1]}` >= today; });
    const tmDate = ((D['status-pc'] || {}).lastRun || (D.squads || {}).updatedAt || '').slice(0, 10);
    const news = ((D.news || {}).injuryNews || []).filter((n) => slug(n.player) === slug(p.name)).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    if (!news || String(news.date) < tmDate) return base;
    if (news.status === 'fit' || news.status === 'back') return base.filter((a) => a.type === 'ineligible');
    if (news.status === 'injured' && !base.some((a) => a.type === 'injury')) base.push({ type: 'injury', text: (news.text || 'verletzt') + (news.source ? ` (laut ${news.source})` : ''), ai: true });
    if (news.status === 'suspended' && !base.some((a) => a.type === 'suspension')) base.push({ type: 'suspension', text: (news.text || 'gesperrt') + (news.source ? ` (laut ${news.source})` : ''), ai: true });
    return base;
  }
  const isOut = (p) => absencesOf(p).some((a) => a.type !== 'ineligible');

  // Lieblingsspieler (Stern im Spielerprofil)
  const favKey = (k, id) => k + '/' + id;
  const favs = () => store.get('favs', []);
  const isFav = (k, id) => favs().includes(favKey(k, id));
  function toggleFav(k, id) {
    const f = favs();
    const i = f.indexOf(favKey(k, id));
    if (i >= 0) f.splice(i, 1); else f.push(favKey(k, id));
    store.set('favs', f);
    return i < 0;
  }
  const favPlayers = () => favs().map((key) => { const [k, id] = key.split('/'); const p = findPlayer(k, id); return p ? Object.assign({ team: k }, p) : null; }).filter(Boolean);
  const favMark = (k, id) => (isFav(k, id) ? `<span class="fav-mini" role="img" aria-label="Lieblingsspieler">${I.starF}</span>` : '');

  // ------------------------------------------------------------------ Transfer-Feed
  const STATUS = {
    official: { label: 'Offiziell', big: true, stamp: 'Here<br>we go!' },
    herewego: { label: 'Here we go', big: true, stamp: 'Here<br>we go!' },
    extension: { label: 'Verlängert', big: true, stamp: 'Verlän-<br>gert!' },
    loanEnd: { label: 'Rückkehr', big: false },
    advanced: { label: 'Fortgeschritten', big: false },
    talks: { label: 'Gespräche', big: false },
    interest: { label: 'Interesse', big: false },
    denied: { label: 'Dementi', big: false },
    rumor: { label: 'Gerücht', big: false },
  };
  function transferFeed() {
    if (S._feedKey === S.lastLoad && S._feed) return S._feed;
    const out = [];
    const seen = new Set();
    const byId = new Map(allPlayers().map((p) => [p.id, p]));
    for (const s of (D.news || {}).stories || []) {
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
        source: s.source, tier: s.tier, date: s.date || s.updatedAt, at: s.statusAt || s.addedAt || null,
        probability: (STATUS[s.status] || {}).big ? null : (s.probability != null ? s.probability : null), ai: true,
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
        out.push({
          key, kind: 'official', status: t.loanEnd ? 'loanEnd' : 'official', dir, name: t.name, img: pimg(t.img, 'big'),
          age: t.age, position: t.position, flags: t.flags, from: dir === 'in' ? t.club : BVB, to: dir === 'in' ? BVB : t.club,
          fee: t.fee, feeValue: t.feeValue, loan: t.loan, contract: sp && sp.contract ? sp.contract.slice(0, 4) : null,
          source: 'Transfermarkt', tier: 1, date: (sp && sp.newSigning && sp.newSigning.date) || null,
          playerId: t.id, team: sp && sp.team, number: sp && sp.number,
        });
      }
    }
    out.sort((a, b) => String(b.date || '0').localeCompare(String(a.date || '0')));
    S._feed = out;
    S._feedKey = S.lastLoad;
    return out;
  }
  // Story-Kreise oben auf Home verschwinden 30 Stunden nach dem Erscheinen
  const STORY_MS = 30 * 36e5;
  function matchStories() {
    const out = [];
    const now = Date.now();
    for (const m of matchList()) {
      const ko = Date.parse(m.date);
      if (!m.finished && berlinYMD(new Date(now)) === berlinYMD(m.date) && now < ko + 3 * 36e5) out.push({ kind: 'match', phase: 'pre', key: 'm-pre-' + m.id, status: 'pre', m, at: new Date(ko - 12 * 36e5).toISOString() });
      if (m.finished && m.score && now > ko && now - (ko + 2 * 36e5) < STORY_MS) out.push({ kind: 'match', phase: 'post', key: 'm-post-' + m.id, status: 'post', m, at: new Date(ko + 2 * 36e5).toISOString() });
    }
    return out;
  }
  function storyItems() {
    const fresh = transferFeed().filter((it) => it.at && Date.now() - Date.parse(it.at) < STORY_MS);
    return [...matchStories(), ...fresh].slice(0, 14);
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
    if (it.status === 'official') return `<span class="chip ink" style="color:var(--ok)">${I.check}Offiziell</span>`;
    if (it.status === 'herewego') return `<span class="chip ink">Fix laut ${esc(it.source || 'Quelle')}</span>`;
    if (it.status === 'extension') return `<span class="chip ink" style="color:var(--ok)">${I.check}Vertrag verlängert</span>`;
    if (it.status === 'denied') return '<span class="chip loss">Dementi</span>';
    if (it.status === 'rumor') return '<span class="chip warn">Gerücht</span>';
    if (it.status === 'loanEnd') return '<span class="chip warn">Rückkehr · Leih-Ende</span>';
    return `<span class="chip warn">${esc((STATUS[it.status] || STATUS.interest).label)}</span>`;
  }
  function ring(frac, size = 46, sw = 5, color = 'var(--y)', track = 'rgba(255,255,255,.1)') {
    const r = (size - sw) / 2;
    const C = 2 * Math.PI * r;
    const off = C * (1 - Math.max(0, Math.min(1, frac || 0)));
    return `<svg class="ring-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="trk" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${sw}"/><circle class="val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(reduce ? off : C).toFixed(1)}" data-off="${off.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  }
  function feeText(it) {
    if (it.feeValue) return money(it.feeValue, { short: 1 });
    if (it.fee && it.fee !== '-' && it.fee !== '?') return String(it.fee).replace(/^Leihgebühr:\s*/, '');
    return UNK;
  }
  function statsTriple(it) {
    if (it.kind === 'rumor') {
      return `<div><span>Alter</span><b>${it.age ? esc(it.age) + ' J.' : UNK}</b></div>
        <div><span>Chance</span><b class="amber">${it.probability != null ? it.probability + ' %' : '–'}</b></div>
        <div><span>Quelle</span><b>${it.date ? F.dm.format(toDate(it.date)) : '–'}</b></div>`;
    }
    const third = it.contract ? `<div><span>Vertrag</span><b>bis ${esc(String(it.contract).slice(0, 4))}</b></div>`
      : it.kind === 'story' ? `<div><span>Vertrag</span><b>${UNK}</b></div>` : `<div><span>Stand</span><b>${it.date ? F.dm.format(toDate(it.date)) : UNK}</b></div>`;
    const second = it.probability != null && !it.bonus ? `<div><span>KI-Chance</span><b class="amber">${it.probability} %</b></div>` : `<div><span>Boni</span><b>${esc(it.bonus || UNK)}</b></div>`;
    return `<div><span>${it.loan ? 'Leihgebühr' : 'Ablöse'}</span><b class="${STATUS[it.status] && STATUS[it.status].big ? 'yellow' : ''}">${esc(feeText(it))}</b></div>
      ${second}${third}`;
  }
  const metaOf = (it) => (it.kind === 'story'
    ? [it.age ? it.age + ' Jahre' : `Alter ${UNK}`, it.position || `Position ${UNK}`, it.flags && it.flags[0] ? it.flags[0].name : '']
    : [it.age ? it.age + ' Jahre' : '', it.position, it.flags && it.flags[0] ? it.flags[0].name : '']).filter(Boolean).join(' · ');
  const wordOf = (it, n) => {
    const st = STATUS[it.status] || STATUS.interest;
    return (st.big ? (it.status === 'extension' ? 'VERLÄNGERT · ' : 'HERE WE GO · ') : (it.status === 'rumor' ? 'GERÜCHT · ' : st.label.toUpperCase() + ' · ')).repeat(n);
  };
  function tCard(it) {
    const st = STATUS[it.status] || STATUS.interest;
    const big = st.big;
    const more = (it.updates && it.updates.length > 1) || (it.links && it.links.length) || it.url;
    const nameHtml = it.playerId && it.team ? `<a href="#/spieler/${it.team}/${it.playerId}" class="tc-name">${esc(it.name)}</a>` : `<h3 class="tc-name">${esc(it.name)}</h3>`;
    return `<article class="tc ${big ? 'hwg' : 'soft'} ${it.status === 'denied' ? 'denied' : ''}">
      <div class="tc-media">
        <div class="tc-word" aria-hidden="true">${wordOf(it, 6)}</div>
        ${it.number ? `<div class="tc-num" aria-hidden="true">${esc(it.number)}</div>` : ''}
        ${it.img ? img(it.img, 'tc-img', it.name, 'sil') : (big ? SIL : SIL_SOFT)}
        ${big ? `<div class="tc-stamp" aria-hidden="true">${st.stamp}</div>` : ''}
        <span class="tc-badge" style="${big ? '' : 'top:18px'}">${statusBadge(it)}</span>
        ${!big && it.probability != null ? `<div class="tc-prob">${ring(it.probability / 100, 44, 5, 'var(--warn)')}<div><b>${it.probability}%</b><span>${it.ai ? 'KI-Chance' : 'Chance'}</span></div></div>` : ''}
        <div class="tc-flow">${crest(it.from)}<span class="tc-arrow" aria-hidden="true"></span>${crest(it.to)}<span class="sr">${esc(it.dir === 'out' ? 'Wechsel vom BVB zu ' + ((it.to || {}).name || UNK) : 'Wechsel von ' + ((it.from || {}).name || UNK) + ' zum BVB')}</span></div>
      </div>
      <div class="tc-body">
        <div>${nameHtml}<div class="tc-meta">${esc(metaOf(it))}</div></div>
        <div class="tc-stats">${statsTriple(it)}</div>
        ${it.summary ? `<p class="tc-sum">${esc(it.summary)}</p>` : ''}
        <div class="tc-foot">${ampel(it)}<span>${it.date ? esc(fmtDate(it.date)) : ''}</span></div>
        ${more ? `<button type="button" class="tc-more-btn" data-action="tmore" aria-expanded="false">Quellen &amp; Verlauf ${I.down}</button>
        <div class="tc-more"><div>
          ${(it.updates || []).map((u) => `<div class="tl"><time>${esc(u.date ? F.dm.format(toDate(u.date)) : '')}</time><span><b>${esc((STATUS[u.status] || {}).label || '')}</b> ${esc(u.text || '')}${u.source ? ` <span class="faint">(${esc(u.source)})</span>` : ''}</span></div>`).join('')}
          ${(it.links || []).map((l) => `<a class="src-link" href="${esc(l.url)}" target="_blank" rel="noopener"><span class="grow ellipsis">${esc(l.title)}</span><span class="faint">${esc(l.outlet || '')}</span>${I.ext}</a>`).join('')}
          ${it.url ? `<a class="src-link" href="${esc(it.url)}" target="_blank" rel="noopener"><span class="grow">Zur Diskussion auf Transfermarkt</span>${I.ext}</a>` : ''}
        </div></div>` : ''}
      </div>
    </article>`;
  }

  // ------------------------------------------------------------------ gemeinsame Bausteine
  function pageHead(title, eyebrow, right = '', back = '') {
    return `<header class="ptitle"><div>${back ? `<button type="button" class="back press" data-action="back" data-fallback="${esc(back)}">${I.back}Zurück</button>` : ''}${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h1>${title}</h1></div>${right}</header>`;
  }
  function seg(group, items, active, cls = '') {
    const ai = Math.max(0, items.findIndex(([k]) => k === active));
    const prev = S.seg[group] != null && S.seg[group] < items.length ? S.seg[group] : ai;
    S.seg[group] = ai;
    return `<nav class="seg ${cls}" aria-label="Bereiche"><span class="seg-ind" style="width:calc((100% - 8px) / ${items.length});transform:translateX(${prev * 100}%)" data-to="${ai * 100}"></span>${items.map(([k, l, h]) => `<a href="${h}" class="${k === active ? 'on' : ''}" ${k === active ? 'aria-current="page"' : ''}>${esc(l)}</a>`).join('')}</nav>`;
  }
  function teamSwitch(key, opts) {
    return `<div class="teams" role="group" aria-label="Mannschaft">${opts.map(([k, label, sub]) => `<button type="button" class="${UI[key] === k ? 'on' : ''}" aria-pressed="${UI[key] === k}" data-action="team" data-key="${key}" data-val="${k}"><b>${esc(label)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</button>`).join('')}</div>`;
  }
  const countEl = (v, fmt, cls = '', style = '') => `<span class="${cls}" style="${style}" data-count="${v}" data-fmt="${fmt}">${fmt === 'money' ? money(v) : fmt === 'moneyS' ? money(v, { short: 1 }) : nf0.format(v)}</span>`;
  function cdParts(iso) {
    let s = Math.max(0, Math.floor((Date.parse(iso) - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    return [[pad(d), 'Tage'], [pad(h), 'Std.'], [pad(Math.floor(s / 60)), 'Min.'], [pad(s % 60), 'Sek.']];
  }
  const odoDigits = (v) => v.split('').map((ch) => `<span class="odo-col" data-d="${ch}" style="transform:translateY(-${(+ch) * 10}%)">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<span class="odo-d">${d}</span>`).join('')}</span>`).join('');
  const odoHtml = (iso) => `<span class="odo" data-odo="${esc(iso)}" role="timer" aria-label="Countdown bis zum Anpfiff" style="display:grid">${cdParts(iso).map(([v, l]) => `<span class="odo-cell"><span class="odo-num">${odoDigits(v)}</span><span class="odo-l">${l}</span></span>`).join('')}</span>`;
  function tickOdo(el) {
    const parts = cdParts(el.dataset.odo);
    $$('.odo-cell', el).forEach((cell, i) => {
      const v = parts[i][0];
      const cols = $$('.odo-col', cell);
      if (cols.length !== v.length) { $('.odo-num', cell).innerHTML = odoDigits(v); return; }
      v.split('').forEach((ch, j) => { if (cols[j].dataset.d !== ch) { cols[j].dataset.d = ch; cols[j].style.transform = `translateY(-${(+ch) * 10}%)`; } });
    });
  }
  function liveDotClass() {
    const st = D.status || {};
    const age = st.lastRun ? (Date.now() - Date.parse(st.lastRun)) / 36e5 : 99;
    return age < 9 ? 'pulse' : age < 24 ? 'warn' : 'loss';
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
    const hit = HISTORY.find((h) => h[0] === today.slice(5));
    if (hit) return { today: true, years: y - hit[1], h: hit, days: 0 };
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
      if (now >= A && now <= B) return { open: true, name: n, days: Math.ceil((B - now) / 864e5), total: (B - A) / 864e5 };
      if (now < A) return { open: false, name: n, days: Math.ceil((A - now) / 864e5), total: 120 };
    }
    return null;
  }
  function birthdays() {
    const out = [];
    const seen = new Set();
    for (const p of allPlayers()) {
      if (!p.birth || seen.has(p.id)) continue;
      seen.add(p.id);
      for (let i = 0; i < 7; i++) {
        if (p.birth.slice(5) === berlinYMD(new Date(Date.now() + i * 864e5)).slice(5)) { out.push({ p, days: i }); break; }
      }
    }
    return out.sort((a, b) => a.days - b.days);
  }
  function greeting() {
    if (matchList().some((m) => isLive(m))) return 'Jetzt live';
    const nm = nextMatch('profis');
    if (nm && daysUntil(nm.date) === 0) return 'Spieltag';
    const lm = lastMatch('profis');
    if (lm && lm.outcome === 'W' && Date.now() - Date.parse(lm.date) < 20 * 36e5) return 'Was ein Sieg';
    const h = parseInt(F.hour.format(new Date()), 10);
    return h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Hallo' : h < 22 ? 'Guten Abend' : 'Gute Nacht';
  }

  // Startseite: Bloecke in eigener Reihenfolge (Einstellungen -> Startseite)
  const HOME_BLOCKS = [
    ['since', 'Seit deinem letzten Besuch', 'full', 'refresh'],
    ['wrap', 'Monats-Rückblick', 'full', 'star'],
    ['stories', 'Storys', 'full', 'story'],
    ['hero', 'Nächstes Spiel', 'full', 'cal'],
    ['brief', 'KI-Briefing', 'full', 'ai'],
    ['favs', 'Deine Spieler', 'sec', 'starF'],
    ['table', 'Tabelle', 'tile', 'chart'],
    ['form', 'Form & letztes Spiel', 'tile', 'motion'],
    ['tm', 'Transfermarkt-Links', 'tile', 'link'],
    ['lazarett', 'Lazarett', 'tile', 'cross'],
    ['mood', 'Fan-Stimmung', 'tile', 'mood'],
    ['window', 'Transferfenster', 'tile', 'swap'],
    ['bday', 'Geburtstage', 'tile', 'cake'],
    ['history', 'BVB-Geschichte', 'wide', 'trophy'],
    ['heads', 'Schlagzeilen', 'sec', 'news'],
  ];
  function homeLayout() {
    const known = HOME_BLOCKS.map((b) => b[0]);
    const saved = SET.home || {};
    const order = (saved.order || []).filter((k, i, a) => known.includes(k) && a.indexOf(k) === i);
    known.forEach((k, i) => {
      // neue Bloecke an ihrer Standard-Stelle einsortieren
      if (order.includes(k)) return;
      const prev = known.slice(0, i).reverse().find((x) => order.includes(x));
      order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, k);
    });
    return { order, hidden: Object.assign({}, saved.hidden) };
  }
  function saveHome(order, hidden) {
    SET.home = { order, hidden };
    saveSET();
  }
  function storiesRow(feed) {
    if (!feed.length) return '';
    const seen = store.get('seen', {});
    return `<div class="stories" role="list" aria-label="Storys">${feed.map((it, i) => {
      if (it.kind === 'match') {
        const mm = matchById(it.m.id) || it.m;
        const ring = seen[it.key + '|' + it.status] ? 'seen' : 'match';
        const badge = it.phase === 'post' ? `<span class="story-badge ${mm.outcome === 'L' ? 'loss' : ''}">${scoreStr(mm)}</span>` : `<span class="story-badge">${isLive(mm) ? 'LIVE' : esc(F.time.format(new Date(mm.date)))}</span>`;
        return `<button type="button" class="story" role="listitem" data-action="story" data-i="${i}" aria-label="${it.phase === 'post' ? 'Ergebnis-Story' : 'Spieltags-Story'}: BVB gegen ${esc(oppOf(mm).name || '')}">
          <span class="story-ring ${ring}"><span class="in story-vs">${crest(oppOf(mm), 'crest')}</span>${badge}</span>
          <span class="story-name">${it.phase === 'post' ? 'Ergebnis' : 'Spieltag'}</span></button>`;
      }
      const big = (STATUS[it.status] || {}).big;
      const ringCls = seen[it.key + '|' + it.status] ? 'seen' : big ? '' : 'rumor';
      const badge = big ? `<span class="story-badge">${I.check}</span>` : it.probability != null ? `<span class="story-badge rumor">${it.probability}%</span>` : '<span class="story-badge rumor">?</span>';
      return `<button type="button" class="story" role="listitem" data-action="story" data-i="${i}" aria-label="${esc(it.name)}: ${esc((STATUS[it.status] || {}).label || '')}">
        <span class="story-ring ${ringCls}"><span class="in">${img(pimg(it.img, 'medium'), '', it.name, initials(it.name))}</span>${badge}</span>
        <span class="story-name">${esc(lastName(it.name))}</span></button>`;
    }).join('')}</div>`;
  }
  function favCard(p) {
    const s = statsOf(p.team, p.id) || {};
    const ab = absencesOf(p).filter((a) => a.type !== 'ineligible');
    const tr = transferFeed().find((it) => (it.playerId === p.id || slug(it.name) === slug(p.name)) && it.at && Date.now() - Date.parse(it.at) < 30 * 864e5);
    let last = '';
    if (p.team === 'profis') {
      const r = formRows(p).slice(-1)[0];
      if (r) last = r.v ? `${r.v.min != null ? r.v.min + "'" : 'Eingesetzt'} gg. ${tname(oppOf(r.m))}${r.v.g ? ` · ${r.v.g} ${r.v.g === 1 ? 'Tor' : 'Tore'}` : ''}${r.v.a ? ` · ${r.v.a} Vorl.` : ''}` : `Ohne Einsatz gg. ${tname(oppOf(r.m))}`;
    }
    const chip = ab.length ? `<span class="chip sm ${ab[0].type === 'injury' ? 'loss' : 'warn'}">${ab[0].type === 'injury' ? 'Verletzt' : 'Fehlt'}</span>`
      : tr ? `<span class="chip sm ${(STATUS[tr.status] || {}).big ? 'ok' : 'warn'}">${esc((STATUS[tr.status] || {}).label || 'News')}</span>` : '';
    return `<a class="fav" href="#/spieler/${p.team}/${esc(p.id)}">
      <span class="fav-media">${p.number ? `<span class="fav-num" aria-hidden="true">${esc(p.number)}</span>` : ''}${img(pimg(p.img, 'big'), '', p.name, initials(p.name))}${chip ? `<span class="fav-chip">${chip}</span>` : ''}</span>
      <span class="fav-body"><b class="fav-name ellipsis">${esc(lastName(p.name))}</b>
        ${p.team === 'profis' ? `<span class="fav-stats"><span><b>${s.goals || 0}</b>Tore</span><span><b>${s.assists || 0}</b>Vorl.</span><span><b>${s.apps || 0}</b>Spiele</span></span>` : ''}
        <span class="fav-last ellipsis">${esc(last || TEAMNAME[p.team])}</span></span></a>`;
  }
  function favsBlock() {
    const ps = favPlayers();
    if (!ps.length) return `<a class="fav-empty press" href="#/kader/profis"><span class="fav-empty-ic" aria-hidden="true">${I.starF}</span><span class="grow"><b>Deine Spieler</b><span>Öffne einen Spieler und tippe auf den Stern – dann siehst du hier seine Zahlen und News.</span></span></a>`;
    return `<section><div class="sec-h"><h2>Deine Spieler</h2><a class="more" href="#/mehr/einstellungen">Bearbeiten</a></div><div class="favs">${ps.map(favCard).join('')}</div></section>`;
  }
  const HB = {
    since: () => sinceCard(),
    wrap: () => wrapHomeCard(),
    stories: () => storiesRow(storyItems()),
    hero: (c) => (c.nm ? heroMatch(c.nm) : '<section class="mhero"><span class="mh-light"></span><span class="eyebrow">Spielplan</span><p class="mh-name" style="margin-top:10px">Keine Spiele geplant</p></section>'),
    brief: () => {
      const brief = (D.news || {}).briefing;
      if (!brief || !brief.text) return '';
      const fresh = store.get('briefSeen', '') !== brief.at;
      return `<section class="brief clamp">
        <div class="row" style="margin-bottom:10px"><span class="ai-badge live">${I.ai}</span><span class="grow"><b style="font-size:14px">KI-Briefing</b><div class="faint" style="font-size:11px;font-weight:600">Gemini · ${esc(rel(brief.at))}</div></span></div>
        <p ${fresh && !reduce ? `data-type="${esc(brief.at)}"` : ''}>${esc(brief.text)}</p>
        <button type="button" class="more" data-action="brief-more">Weiterlesen</button></section>`;
    },
    favs: () => favsBlock(),
    table: (c) => {
      const me = c.bl.find((r) => r.isBVB);
      if (!me) return '';
      const around = c.bl.filter((r) => Math.abs(r.pos - me.pos) <= 1 || (me.pos === 1 && r.pos <= 3)).slice(0, 3);
      return `<a class="tile y stripes" href="#/spiele/profis/tabelle"><span class="eyebrow" style="position:relative">Bundesliga</span><span class="giant" style="position:relative">${me.pos}.</span><span class="sub" style="position:relative">${me.points} Punkte · ${me.goals}:${me.against} Tore</span>
        <span class="mini-table" style="position:relative">${around.map((r) => `<span class="${r.isBVB ? 'me' : ''}" style="display:flex;justify-content:space-between;padding:4px 8px;border-radius:9px"><span class="ellipsis">${r.pos}. ${esc(r.short || r.team)}</span><span>${r.points}</span></span>`).join('')}</span></a>`;
    },
    form: (c) => {
      const fm = formOf('profis');
      const lm = c.lm;
      if (!fm.length && !lm) return '';
      return `<a class="tile" href="#/spiele/profis/ergebnisse"><span class="eyebrow">Form</span>${formHtml(fm)}
        ${lm ? `<span style="margin-top:auto"><span class="faint" style="font-size:10px;font-weight:800;letter-spacing:.1em">LETZTES SPIEL · ${esc(compShort(lm.comp).toUpperCase())}</span><span class="big" style="display:block;margin-top:4px;font-size:24px">${esc(tname(lm.home))} <span class="yellow">${lm.score[0]}:${lm.score[1]}</span> ${esc(tname(lm.away))}</span><span class="sub" style="display:block;margin-top:4px">${esc(scorers(lm) || F.dm.format(new Date(lm.date)))}</span></span>` : ''}</a>`;
    },
    tm: () => `<a class="tile tm-tile" href="#/transfers/tm"><span class="eyebrow">Transfermarkt</span>
      <span class="tm-tags" aria-hidden="true"><b>Profis</b><b>U23</b><b>U19</b></span>
      <span class="sub" style="margin-top:auto">Direkt zu transfermarkt.de</span></a>`,
    lazarett: () => {
      const missing = allPlayers().filter((p) => p.team === 'profis' && isOut(p));
      return `<a class="tile" href="#/mehr/lazarett"><span class="eyebrow">Lazarett</span>
        <span class="big ${missing.length ? '' : 'green'}">${missing.length ? missing.length + ' fehlen' : 'Alle fit'}</span>
        <span class="stack-av" style="margin-top:auto">${missing.slice(0, 5).map((p) => img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))).join('')}</span>
        <span class="sub ellipsis">${missing.length ? esc(missing.slice(0, 2).map((p) => lastName(p.name)).join(', ')) + (missing.length > 2 ? ' …' : '') : 'Keine Ausfälle'}</span></a>`;
    },
    mood: () => moodTile(),
    window: () => {
      const win = windowInfo();
      if (!win) return '';
      return `<a class="tile" href="#/transfers/news"><span class="eyebrow">${win.open ? 'Fenster offen' : 'Transferfenster'}</span>
        <span style="position:relative;width:76px;height:76px;margin:2px 0">${ring(win.open ? win.days / win.total : 1 - win.days / win.total, 76, 7)}<span class="big" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:26px">${win.days}</span></span>
        <span class="sub">${win.open ? `schließt in ${win.days} Tagen` : `${win.name} öffnet in ${win.days} Tagen`}</span></a>`;
    },
    bday: () => {
      const b = birthdays()[0];
      if (!b) return '';
      return `<a class="tile" href="#/spieler/${b.p.team}/${b.p.id}"><span class="eyebrow">${b.days === 0 ? 'Heute Geburtstag' : `In ${b.days} ${b.days === 1 ? 'Tag' : 'Tagen'}`}</span>
        ${img(pimg(b.p.img, 'medium'), 'avatar', b.p.name, initials(b.p.name), 'style="width:56px;height:56px"')}
        <span class="big" style="font-size:22px;margin-top:auto">${esc(lastName(b.p.name))}</span><span class="sub">wird ${b.days === 0 ? b.p.age : (b.p.age || 0) + 1} · ${esc(TEAMNAME[b.p.team])}</span></a>`;
    },
    history: () => {
      const hist = historyItem();
      if (!hist) return '';
      return `<a class="tile wide" href="#/mehr/erfolge"><span class="year-ghost" aria-hidden="true">${hist.h[1]}</span>
        <span class="eyebrow">${hist.today ? `Heute vor ${hist.years} Jahren` : `In ${hist.days} ${hist.days === 1 ? 'Tag' : 'Tagen'} · ${hist.years} Jahre`}</span>
        <span style="font-size:16px;font-weight:800;line-height:1.35;max-width:76%">${esc(hist.h[2])}</span><span class="sub">${esc(hist.h[0].slice(3))}.${esc(hist.h[0].slice(0, 2))}.${hist.h[1]}</span></a>`;
    },
    heads: () => {
      const heads = ((D.news || {}).headlines || []).slice(0, 4);
      if (!heads.length) return '';
      return `<section><div class="sec-h"><h2>Schlagzeilen</h2><a class="more" href="#/transfers/news">Alle</a></div>
        <div class="card flat">${heads.map((h) => `<a class="headline" href="${esc(h.url)}" target="_blank" rel="noopener"><span class="src-dot t${h.tier === 1 ? 1 : 2}" aria-hidden="true"></span><span class="grow"><div class="h-t">${esc(h.title)}</div><div class="h-m">${esc(h.outlet)} · ${esc(rel(h.date))}</div></span></a>`).join('')}</div></section>`;
    },
  };
  function bentoHtml(tiles) {
    // halbe Kacheln paarweise - bleibt vor einer breiten Kachel oder am Ende eine allein, wird sie breit
    const out = [];
    let half = [];
    const close = () => {
      if (half.length % 2) half[half.length - 1] = half[half.length - 1].replace('class="tile', 'class="tile wide');
      out.push(...half);
      half = [];
    };
    for (const t of tiles) { if (t.wide) { close(); out.push(t.html); } else half.push(t.html); }
    close();
    return `<div class="bento">${out.join('')}</div>`;
  }
  function vHome() {
    const st = D.status || {};
    const c = { nm: nextMatch('profis'), lm: lastMatch('profis'), bl: ((D.tables || {}).bl1 || {}).rows || [] };
    const L = homeLayout();
    let out = `<header class="hello">
      <div class="hello-top"><span class="eyebrow">${esc(F.long.format(new Date()))}</span>
        <span class="hello-act"><a class="live-pill press" href="#/mehr/update" aria-label="Update-Zentrale öffnen"><span class="dot ${liveDotClass()}"></span><span data-rel="${esc(st.lastRun || '')}">${st.lastRun ? esc(rel(st.lastRun)) : 'Update'}</span></a>
        <a class="gear press" href="#/mehr/einstellungen" aria-label="Einstellungen">${I.gear}</a></span></div>
      <h1>${esc(greeting())},<br><em>${esc(userName() || 'Borusse')}!</em></h1>
    </header>`;
    let tiles = [];
    const flush = () => { if (tiles.length) out += `<div class="hb hb-bento">${bentoHtml(tiles)}</div>`; tiles = []; };
    for (const k of L.order) {
      const b = HOME_BLOCKS.find((x) => x[0] === k);
      if (!b || L.hidden[k]) continue;
      let html = '';
      try { html = HB[k](c); } catch (err) { console.error(k, err); }
      if (!html) continue;
      if (b[2] === 'tile' || b[2] === 'wide') tiles.push({ html, wide: b[2] === 'wide' });
      else { flush(); out += `<div class="hb ${b[2] === 'sec' && html.startsWith('<section') ? 'hb-sec' : ''}">${html}</div>`; }
    }
    flush();
    out += `<a class="home-edit press" href="#/mehr/einstellungen">${I.gear} Startseite anpassen</a>`;
    out += '<p class="faint" style="font-size:11px;text-align:center;margin-top:18px;line-height:1.6;font-weight:600">Daten: Transfermarkt · OpenLigaDB · ESPN · Google News · Gemini-KI · Open-Meteo · YouTube<br>Inoffizielle Fan-App – nicht verbunden mit Borussia Dortmund</p>';
    return out;
  }
  function heroMatch(m) {
    const live = isLive(m);
    const word = `${tname(m.home)} · ${tname(m.away)} · `.toUpperCase().repeat(4);
    const n = daysUntil(m.date);
    const when = live ? 'Läuft' : n === 0 ? 'Heute' : n === 1 ? 'Morgen' : `in ${n} Tagen`;
    const goals = (m.goals || []).slice(-4).map((g) => `<span class="goal ${g.team === 'away' ? 'away' : ''}"><time>${g.minute != null ? g.minute + "'" : ''}</time><span>${esc(g.scorer || 'Tor')}</span><b>${esc(g.score || '')}</b></span>`).join('');
    const hrs = (Date.parse(m.date) - Date.now()) / 36e5;
    const md = !live && hrs > 0 && hrs < 24;
    return `<button type="button" class="mhero press ${live ? 'live' : ''} ${md ? 'md' : ''}" data-action="match" data-id="${esc(m.id)}" data-team="profis" style="width:100%;text-align:left;font:inherit${md ? `;--lux:${Math.max(0.15, 1 - hrs / 24).toFixed(2)}` : ''}" aria-label="${esc(tname(m.home))} gegen ${esc(tname(m.away))}, Spieltag-Zentrale öffnen">
      <span class="mh-light" aria-hidden="true"></span><span class="mh-beam l" aria-hidden="true"></span><span class="mh-beam r" aria-hidden="true"></span>
      <span class="mh-word" aria-hidden="true">${esc(word)}</span>
      <span class="mh-top">${live ? '<span class="live-tag">LIVE</span>' : `<span class="chip y">${esc(compRound(m))}</span>`}<span class="eyebrow ${md ? 'md-tag' : ''}" style="color:var(--y)">${md ? 'Spieltag · ' : ''}${esc(when)}</span></span>
      <span class="mh-teams" style="display:grid">
        <span class="mh-team">${crest(m.home, 'crest')}<span class="mh-name ellipsis">${esc(tname(m.home))}</span></span>
        ${live ? `<span class="mh-score">${m.score ? m.score[0] + ':' + m.score[1] : '0:0'}</span>` : '<span class="mh-vs">VS</span>'}
        <span class="mh-team">${crest(m.away, 'crest')}<span class="mh-name ellipsis">${esc(tname(m.away))}</span></span>
      </span>
      <span class="mh-meta" style="display:block">${esc(dayLabel(m.date))} · ${m.timeKnown === false ? 'Uhrzeit offen' : esc(F.time.format(new Date(m.date))) + ' Uhr'}${m.location ? ' · ' + esc(m.location) : ''}${!live && (mcOf(m.id).model || {}).probs ? ` · <span class="mh-prob">Siegchance ${nf0.format(mcOf(m.id).model.probs.w)} %</span>` : ''}</span>
      ${live ? (goals ? `<span class="goals" style="display:flex">${goals}</span>` : '<span class="mh-meta" style="display:block;margin-top:10px">Noch keine Tore</span>') : odoHtml(m.date)}
    </button>`;
  }

  // ------------------------------------------------------------------ Story-Ansicht
  const ST = { items: [], i: 0, down: null, held: false, holdT: null };
  function openStories(items, i, fromEl) {
    ST.items = items;
    ST.i = i;
    const el = $('#story');
    if (fromEl) { const r = fromEl.getBoundingClientRect(); el.style.transformOrigin = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`; }
    el.hidden = false;
    el.classList.remove('closing');
    if (!reduce) { el.classList.add('opening'); setTimeout(() => el.classList.remove('opening'), 520); }
    document.body.style.overflow = 'hidden';
    renderStory();
  }
  function renderStory() {
    const it = ST.items[ST.i];
    if (!it) { closeStories(); return; }
    if (it.kind === 'match') { renderMatchStory(it); return; }
    const st = STATUS[it.status] || STATUS.interest;
    const big = st.big;
    const seen = store.get('seen', {});
    const k = it.key + '|' + it.status;
    const first = !seen[k];
    seen[k] = Date.now();
    store.set('seen', seen);
    // Spieler-Story im modernen Look: randloses Foto, das nach unten ausläuft, Status als Glas-Pille,
    // Name groß, Wechsel und Zahlen als Glas-Kacheln – passt von iPhone SE bis Pro Max, mit und ohne Notch
    const tone = big ? 'hwg' : it.status === 'denied' ? 'deny' : 'soft';
    const pill = `${big ? I.check : '<i aria-hidden="true"></i>'}${esc(st.label)}${!big && tone !== 'deny' && it.probability != null ? ` · ${it.probability} %` : ''}`;
    const club = (c) => `<span class="st-club">${crest(c, 'crest')}<span class="ellipsis">${esc(c && c.name ? (isBVBName(c.name) ? 'BVB' : c.name) : UNK)}</span></span>`;
    // Ablöse direkt auf dem Transfer-Pfeil (nur wenn bekannt)
    const fee = it.feeValue ? money(it.feeValue, { short: 1 }) : it.loan ? 'Leihe' : it.fee && !['-', '?', UNK].includes(String(it.fee)) ? String(it.fee) : '';
    const clubs = it.dir === 'extension' || it.status === 'extension'
      ? `<div class="st-clubs st-glass">${club(BVB)}<span class="st-stay">bleibt</span></div>`
      : `<div class="st-clubs st-glass">${club(it.from)}<span class="st-route"><span class="tc-arrow" aria-hidden="true"></span>${fee ? `<em>${esc(fee)}</em>` : ''}</span>${club(it.to)}</div>`;
    // Kopfzeile wie bei Instagram: Quelle + wann
    const tier = it.status === 'denied' ? 3 : it.tier === 1 ? 1 : 2;
    const when = it.at ? rel(it.at) : it.date ? fmtDate(it.date) : '';
    const el = $('#story');
    el.classList.remove('hwg');
    el.innerHTML = `<div class="st-bars">${ST.items.map((_, j) => `<span class="st-bar ${j < ST.i ? 'done' : j === ST.i ? 'on' : ''}"><i></i></span>`).join('')}</div>
      <div class="st-head"><span class="st-src"><span class="st-src-av t${tier}">${esc(initials(it.source || 'Q'))}</span><span class="st-src-t"><b class="ellipsis">${esc(it.source || 'Quelle')}</b><span>${when ? esc(when) : esc(st.label)}</span></span></span>
        <button type="button" class="st-close" data-action="story-close" aria-label="Story schließen">${I.x}</button></div>
      <section class="st-slide ps ${tone}">
        ${it.img ? img(it.img, 'st-bg', '', '', 'aria-hidden="true"') : ''}
        <div class="st-glow" aria-hidden="true"></div>
        <div class="st-hero"><div class="st-pic">${it.img ? img(it.img, 'st-photo', it.name, initials(it.name)) : `<span class="st-photo st-nophoto">${SIL_SOFT}</span>`}
          ${it.number ? `<span class="st-num">${esc(it.number)}</span>` : ''}</div></div>
        <div class="st-sheet">
          <span class="st-pill">${pill}</span>
          <div><h2 class="st-title">${esc(it.name)}</h2><div class="st-meta">${esc(metaOf(it))}</div></div>
          ${clubs}
          <div class="st-tiles">${statsTriple(it)}</div>
          ${it.summary ? `<p class="st-sum">${esc(it.summary)}</p>` : ''}
          <div class="st-foot">${ampel(it)}${it.playerId && it.team ? `<a class="st-cta press" href="#/spieler/${it.team}/${it.playerId}" data-action="story-close">Profil ansehen</a>` : ''}</div>
        </div>
      </section>
      <button type="button" class="st-tap prev" data-action="story-prev" aria-label="Vorherige Story" style="background:none;border:0"></button>
      <button type="button" class="st-tap next" data-action="story-next" aria-label="Nächste Story" style="background:none;border:0"></button>`;
    const bar = $('.st-bar.on i', el);
    if (bar && !reduce) bar.addEventListener('animationend', () => storyStep(1), { once: true });
    if (big && first) setTimeout(() => confetti(), 350);
  }
  function renderMatchStory(it) {
    const m = matchById(it.m.id) || it.m;
    const e = mcOf(m.id);
    const pre = it.phase === 'pre';
    const seen = store.get('seen', {});
    const first = !seen[it.key + '|' + it.status];
    seen[it.key + '|' + it.status] = Date.now();
    store.set('seen', seen);
    const pv = e.preview || {};
    const rp = e.report || {};
    const w = e.weather;
    const mine = m.isHome ? 'home' : 'away';
    const goals = (m.goals || []).filter((g) => g.team === mine && !g.ownGoal);
    const motm = rp.motm && rp.motm.id ? findPlayer('profis', rp.motm.id) : null;
    const kt = kiTip(m);
    const mt = myTip(m.id);
    const live = isLive(m);
    const title = pre ? (live ? 'Läuft gerade!' : 'Heute ist Spieltag!') : m.outcome === 'W' ? 'Sieg!' : m.outcome === 'D' ? 'Remis' : 'Niederlage';
    const rows = pre
      ? [w ? `${weatherIcon(w.code)} ${Math.round(w.temp)}° · ${w.rain != null ? w.rain + ' % Regen' : esc(weatherText(w.code))}` : '',
        ...(pv.keyPoints || []).slice(0, 2).map((k) => esc(k)),
        mt ? `Dein Tipp ${tipStr(mt, m)}${kt ? ` · KI-Tipp ${tipStr(kt, m)}` : ''}` : 'Noch nicht getippt? Jetzt deinen Tipp abgeben!']
      : [goals.length ? `⚽ ${esc(goals.map((g) => `${lastName(g.scorer)} ${g.minute != null ? g.minute + "'" : ''}`).join(' · '))}` : '',
        motm ? `★ Spieler des Spiels: ${esc(motm.name)}` : '',
        rp.text ? esc((rp.text.match(/^[^.!?]+[.!?]/) || [rp.text])[0]) : ''];
    const el = $('#story');
    el.classList.toggle('hwg', !pre && m.outcome === 'W');
    el.innerHTML = `<div class="st-bars">${ST.items.map((_, j) => `<span class="st-bar ${j < ST.i ? 'done' : j === ST.i ? 'on' : ''}"><i></i></span>`).join('')}</div>
      <div class="st-head"><span class="chip ${!pre && m.outcome === 'W' ? 'ink' : 'y'}">${esc(m.comp || '')}${m.round ? ' · ' + esc(m.round) : ''}</span><span class="eyebrow" style="color:${!pre && m.outcome === 'W' ? 'rgba(10,9,0,.7)' : 'var(--muted)'}">${esc(dayLabel(m.date))}</span>
        <button type="button" class="st-close" data-action="story-close" aria-label="Story schließen">${I.x}</button></div>
      <section class="st-slide mst ${pre ? 'pre' : 'post ' + (m.outcome || '')}">
        <div class="mst-light" aria-hidden="true"></div>
        <div class="mst-teams">${crest(m.home, 'crest xl')}<div class="mst-mid">${pre ? `<b>${live ? scoreStr(m) : esc(F.time.format(new Date(m.date)))}</b><span>${live ? 'Live' : 'Anpfiff'}</span>` : `<b>${scoreStr(m)}</b><span>${m.half ? 'Halbzeit ' + m.half[0] + ':' + m.half[1] : 'Endstand'}</span>`}</div>${crest(m.away, 'crest xl')}</div>
        <h2 class="mst-title">${title}</h2>
        <div class="st-info mst-info">${rows.filter(Boolean).map((r) => `<div class="mst-row">${r}</div>`).join('')}
          <a class="btn" href="#/spiel/${esc(m.id)}${pre && !mt ? '/tipp' : ''}" data-action="story-close">${pre && !mt ? 'Jetzt tippen' : 'Zur Spieltag-Zentrale'}</a></div>
      </section>
      <button type="button" class="st-tap prev" data-action="story-prev" aria-label="Vorherige Story" style="background:none;border:0"></button>
      <button type="button" class="st-tap next" data-action="story-next" aria-label="Nächste Story" style="background:none;border:0"></button>`;
    const bar = $('.st-bar.on i', el);
    if (bar && !reduce) bar.addEventListener('animationend', () => storyStep(1), { once: true });
    if (!pre && m.outcome === 'W' && first) setTimeout(() => confetti(), 350);
  }
  // Wetter-Symbole (WMO-Codes von Open-Meteo)
  function weatherIcon(c) {
    if (c == null) return '🌡️';
    if (c === 0) return '☀️';
    if (c <= 2) return '🌤️';
    if (c === 3) return '☁️';
    if (c <= 48) return '🌫️';
    if (c <= 67 || (c >= 80 && c <= 82)) return '🌧️';
    if (c <= 77 || c === 85 || c === 86) return '❄️';
    return '⛈️';
  }
  function weatherText(c) {
    if (c == null) return 'k. A.';
    if (c === 0) return 'Sonnig';
    if (c <= 2) return 'Leicht bewölkt';
    if (c === 3) return 'Bewölkt';
    if (c <= 48) return 'Nebel';
    if (c <= 57) return 'Nieselregen';
    if (c <= 67 || (c >= 80 && c <= 82)) return 'Regen';
    if (c <= 77 || c === 85 || c === 86) return 'Schnee';
    return 'Gewitter';
  }
  const ytCard = (v, label) => `<button type="button" class="yt" data-action="yt" data-id="${esc(v.id)}" aria-label="${esc(label)}: ${esc(v.title)} abspielen"><img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="yt-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></span><span class="yt-t"><span class="eyebrow">${esc(label)}</span><b>${esc(v.title)}</b></span></button>`;
  function storyStep(d) {
    const n = ST.i + d;
    if (n < 0) { ST.i = 0; renderStory(); return; }
    if (n >= ST.items.length) { closeStories(); return; }
    ST.i = n;
    renderStory();
  }
  function closeStories() {
    const el = $('#story');
    if (el.hidden) return;
    el.classList.add('closing');
    setTimeout(() => {
      el.hidden = true; el.classList.remove('closing', 'paused'); el.innerHTML = ''; document.body.style.overflow = '';
      if (S.tab === 'home') render({ animate: false, keepScroll: true });
    }, reduce ? 0 : 280);
  }
  (() => {
    const el = $('#story');
    el.addEventListener('pointerdown', (e) => {
      ST.down = { x: e.clientX, y: e.clientY };
      ST.held = false;
      clearTimeout(ST.holdT);
      ST.holdT = setTimeout(() => { ST.held = true; el.classList.add('paused'); }, 220);
    });
    el.addEventListener('pointermove', (e) => {
      if (!ST.down) return;
      if (e.clientY - ST.down.y > 90) { ST.down = null; clearTimeout(ST.holdT); closeStories(); }
    });
    const up = () => { clearTimeout(ST.holdT); el.classList.remove('paused'); ST.down = null; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  })();

  // Konfetti in Schwarz-Gelb
  function confetti() {
    if (reduce) return;
    const c = $('#confetti');
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ['#FDE100', '#FFF27A', '#0A0900', '#FFFFFF', '#FDE100'];
    const parts = Array.from({ length: 140 }, (_, i) => ({
      x: W / 2 + (Math.random() - .5) * 120, y: H * .38, vx: (Math.random() - .5) * 15, vy: -Math.random() * 15 - 6,
      w: 6 + Math.random() * 6, h: 9 + Math.random() * 10, r: Math.random() * 6, vr: (Math.random() - .5) * .35, c: colors[i % colors.length],
    }));
    const t0 = performance.now();
    const frame = (now) => {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += .36; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 1.7)) + 1); ctx.restore();
      }
      if (now - t0 < 2800) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    };
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ Transfers
  function vTransfers(sub) {
    const win = windowInfo();
    const tr = D.transfers || {};
    const eyebrow = `Saison ${esc(tr.seasonLabel || '')}${win ? ` · Fenster ${win.open ? `offen, noch ${win.days} T.` : `in ${win.days} T.`}` : ''}`;
    let out = pageHead('Trans<em>fers</em>', eyebrow);
    if (sub === 'werte') sub = 'tm';
    out += seg('transfers', [['news', 'News', '#/transfers/news'], ['tm', 'TM', '#/transfers/tm'], ['bilanz', 'Bilanz', '#/transfers/bilanz'], ['vertraege', 'Verträge', '#/transfers/vertraege']], sub);
    if (sub === 'tm') out += vTM();
    else if (sub === 'bilanz') out += vBilanz();
    else if (sub === 'vertraege') out += vVertraege();
    else out += vNews();
    return out;
  }
  function vNews() {
    const all = transferFeed();
    const f = UI.newsFilter;
    const FIL = [['alle', 'Alle'], ['in', 'Zugänge'], ['out', 'Abgänge'], ['hwg', 'Here we go'], ['geruechte', 'Gerüchte'], ['verl', 'Verlängert']];
    const pick = (it) => f === 'alle' || (f === 'in' && it.dir === 'in') || (f === 'out' && it.dir === 'out')
      || (f === 'hwg' && (it.status === 'official' || it.status === 'herewego'))
      || (f === 'geruechte' && ['rumor', 'interest', 'talks', 'advanced'].includes(it.status))
      || (f === 'verl' && it.status === 'extension');
    const items = all.filter(pick);
    const gem = (D.news || {}).gemini || {};
    const heads = (D.news || {}).headlines || [];
    let out = `<div class="chips" style="margin-top:14px" role="group" aria-label="Filter">${FIL.map(([k, l]) => `<button type="button" class="${f === k ? 'on' : ''}" aria-pressed="${f === k}" data-action="filter" data-val="${k}">${l}</button>`).join('')}</div>`;
    out += `<div class="row faint" style="font-size:12px;margin:14px 2px 0;gap:8px;font-weight:600"><span class="ai-badge sm">${I.ai}</span><span>${gem.lastSuccess ? `Gemini hat ${esc(rel(gem.lastSuccess))} ${gem.headlinesAnalyzed || gem.headlines || ''} Meldungen geprüft` : 'Gemini prüft beim nächsten Update die Meldungen'}</span></div>`;
    out += `<div class="stagger" style="display:flex;flex-direction:column;gap:16px;margin-top:14px">${items.length ? items.slice(0, 40).map(tCard).join('') : '<div class="empty">Keine Einträge für diesen Filter.</div>'}</div>`;
    if (heads.length) {
      out += `<section class="sec"><div class="sec-h"><h2>Schlagzeilen</h2><span class="note">nur vertrauenswürdige Medien</span></div>
        <div class="card flat">${heads.slice(0, 25).map((h) => `<a class="headline" href="${esc(h.url)}" target="_blank" rel="noopener"><span class="src-dot t${h.tier === 1 ? 1 : 2}" aria-hidden="true"></span><span class="grow"><div class="h-t">${esc(h.title)}</div><div class="h-m">${esc(h.outlet)} · ${esc(rel(h.date))}</div></span></a>`).join('')}</div></section>`;
    }
    return out;
  }
  // Transfermarkt: nur die drei Team-Seiten als Ticket-Pässe in einer Flutlicht-Szene
  const TM_PAGES = [
    ['profis', 'Profis', 'Bundesliga', 'BVB', 'https://www.transfermarkt.de/borussia-dortmund/startseite/verein/16'],
    ['u23', 'U23', 'Regionalliga West', 'U23', 'https://www.transfermarkt.de/borussia-dortmund-ii/startseite/verein/17'],
    ['u19', 'U19', 'A-Junioren', 'U19', 'https://www.transfermarkt.de/borussia-dortmund-u19/startseite/verein/1464'],
  ];
  function vTM() {
    const cards = TM_PAGES.map(([k, name, sub, wm, url], i) => {
      const t = team(k);
      const meta = [t.count ? `${t.count} Spieler` : '', t.avgAge ? `Ø ${String(t.avgAge).replace('.', ',')} Jahre` : ''].filter(Boolean).join(' · ');
      return `<a class="tmk t${i}" href="${url}" target="_blank" rel="noopener" aria-label="${name} auf Transfermarkt öffnen">
        <span class="tmk-big" aria-hidden="true">${wm}</span>
        <span class="tmk-crest" aria-hidden="true"><img src="${BVB.crest}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>
        <span class="tmk-txt"><span class="tmk-sub">${esc(sub)}</span><b>${name}</b>${meta ? `<span class="tmk-meta">${esc(meta)}</span>` : ''}</span>
        <span class="tmk-go" aria-hidden="true">${I.ext}</span></a>`;
    }).join('');
    return `<section class="tmk-head"><span class="eyebrow">Direkt zu transfermarkt.de</span><h2>Kader &amp; <em>Marktwerte</em></h2>
        <p>Werte, Verträge und Gerüchte von Profis, U23 und U19 – ein Tipp öffnet die Seite.</p></section>
      <div class="tmk-list stagger">${cards}</div>`;
  }
  function vBilanz() {
    const tr0 = D.transfers || {};
    if (!tr0.in && !tr0.out) return '<div class="empty" style="margin-top:14px">Noch keine Transferdaten für diese Saison.</div>';
    const ins = [...(tr0.in || [])];
    const outs = [...(tr0.out || [])];
    const known = new Set([...ins, ...outs].map((x) => slug(x.name)));
    let addIn = 0;
    let addOut = 0;
    const start = tr0.season ? `${tr0.season}-06-01` : '';
    for (const s of (D.news || {}).stories || []) {
      if (s.status !== 'official' || !['in', 'out'].includes(s.direction) || known.has(slug(s.player)) || (s.date || '') < start) continue;
      const item = { name: s.player, img: (s.playerInfo || {}).img, club: s.otherClub, fee: s.fee || UNK, feeValue: s.feeValue, news: s.source };
      if (s.direction === 'in') { ins.unshift(item); addIn += s.feeValue || 0; } else { outs.unshift(item); addOut += s.feeValue || 0; }
    }
    const income = (tr0.income || 0) + addOut;
    const expense = (tr0.expense || 0) + addIn;
    const balance = income - expense;
    const sum = income + expense || 1;
    const topIn = [...ins].sort((a, b) => (b.feeValue || 0) - (a.feeValue || 0))[0];
    const topOut = [...outs].sort((a, b) => (b.feeValue || 0) - (a.feeValue || 0))[0];
    const loans = outs.filter((x) => x.loan);
    const row = (x, dir) => `<a class="li" ${x.id && findPlayer('profis', x.id) ? `href="#/spieler/profis/${x.id}"` : ''}>${img(pimg(x.img, 'medium'), 'avatar sm', x.name, initials(x.name))}
      <span class="grow"><div class="t ellipsis">${esc(x.name)}${x.news ? ' <span class="chip ok sm">Neu</span>' : ''}</div><div class="s row" style="gap:6px">${crest(x.club, 'crest xs')}<span class="ellipsis">${dir === 'in' ? 'von' : 'zu'} ${esc((x.club || {}).name || UNK)}${x.news || x.source ? ' · laut ' + esc(x.news || x.source) : ''}</span></div></span>
      <span class="v ${x.feeValue ? '' : 'faint'}" style="font-weight:${x.feeValue ? 800 : 600}">${esc(x.feeValue ? money(x.feeValue, { short: 1 }) : String(x.fee && x.fee !== '-' && x.fee !== '?' ? x.fee : UNK).replace(/^Leihgebühr:\s*/, 'Leihe '))}</span></a>`;
    let out = `<section class="card" style="margin-top:14px;display:flex;flex-direction:column;gap:14px">
      <div class="row" style="justify-content:space-between;align-items:flex-end"><span><span class="eyebrow">Einnahmen</span><div class="num green" style="font-size:30px;line-height:1.1">${countEl(income, 'moneyS')}</div><span class="faint" style="font-size:11px;font-weight:600">${outs.length} Abgänge</span></span>
      <span style="text-align:right"><span class="eyebrow">Ausgaben</span><div class="num red" style="font-size:30px;line-height:1.1">${countEl(expense, 'moneyS')}</div><span class="faint" style="font-size:11px;font-weight:600">${ins.length} Zugänge</span></span></div>
      <div class="split"><span class="inc" style="width:${(income / sum * 100).toFixed(1)}%"></span><span class="exp" style="width:${(expense / sum * 100).toFixed(1)}%"></span></div>
      <div class="row" style="justify-content:space-between;padding-top:12px;border-top:1px solid var(--hair)"><span class="eyebrow">Transfersaldo ${esc(tr0.seasonLabel || '')}</span><b class="num ${balance >= 0 ? 'green' : 'red'}" style="font-size:34px">${money(balance, { plus: 1, short: 1 })}</b></div>
    </section>`;
    out += `<div class="grid2" style="margin-top:12px">
      <div class="tile" style="min-height:0"><span class="eyebrow">Teuerster Zugang</span>${topIn ? `<span style="font-size:14px;font-weight:800">${esc(topIn.name)}</span><span class="big yellow">${money(topIn.feeValue, { short: 1 })}</span>` : '–'}</div>
      <div class="tile" style="min-height:0"><span class="eyebrow">Teuerster Abgang</span>${topOut && topOut.feeValue ? `<span style="font-size:14px;font-weight:800">${esc(topOut.name)}</span><span class="big yellow">${money(topOut.feeValue, { short: 1 })}</span>` : '–'}</div></div>`;
    out += `<section class="sec"><div class="sec-h"><h2>Zugänge</h2><span class="note">${ins.length}</span></div><div class="card flat"><div class="list">${ins.map((x) => row(x, 'in')).join('') || '<p class="muted" style="padding:12px 0">Keine</p>'}</div></div></section>`;
    out += `<section class="sec"><div class="sec-h"><h2>Abgänge</h2><span class="note">${outs.length}</span></div><div class="card flat"><div class="list">${outs.map((x) => row(x, 'out')).join('') || '<p class="muted" style="padding:12px 0">Keine</p>'}</div></div></section>`;
    if (loans.length) out += `<section class="sec"><div class="sec-h"><h2>Verliehen</h2></div><div class="card flat"><div class="list">${loans.map((x) => row(x, 'out')).join('')}</div></div></section>`;
    out += `<p class="faint" style="font-size:11px;margin-top:14px;text-align:center;font-weight:600;line-height:1.5">Saison ${esc(tr0.seasonLabel || '')} · startet jede Saison bei null<br>Quellen: Transfermarkt, FotMob + offizielle Wechsel aus den News (KI)</p>`;
    return out;
  }
  function vVertraege() {
    const k = UI.vertTeam === 'u23' ? 'u23' : 'profis';
    const ps = (team(k).players || []).filter((p) => p.contract).sort((a, b) => a.contract.localeCompare(b.contract));
    const groups = {};
    for (const p of ps) (groups[p.contract.slice(0, 4)] = groups[p.contract.slice(0, 4)] || []).push(p);
    const years = Object.keys(groups).sort();
    const first = years[0];
    const monthsLeft = (c) => Math.max(0, Math.round((Date.parse(c + 'T00:00:00Z') - Date.now()) / (30.44 * 864e5)));
    const leftTxt = (c) => { const m = monthsLeft(c); return m >= 12 ? `${Math.floor(m / 12)} J.${m % 12 ? ` ${m % 12} M.` : ''}` : `${m} Mon.`; };
    let out = `<div style="margin-top:14px">${teamSwitch('vertTeam', [['profis', 'Profis', ''], ['u23', 'BVB II', '']])}</div>`;
    if (first) {
      out += `<section class="card-y stripes" style="margin-top:12px"><span class="eyebrow">Verträge enden ${first}</span>
        <div class="row" style="align-items:flex-end;gap:12px;margin-top:6px"><span class="num" style="font-size:66px;line-height:.8">${groups[first].length}</span><span style="font-size:13px;font-weight:700;padding-bottom:6px">Spieler · noch ${esc(leftTxt(groups[first][0].contract))}</span></div>
        <div class="stack-av" style="margin-top:12px">${groups[first].slice(0, 8).map((p) => img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name), 'style="box-shadow:0 0 0 3px var(--y)"')).join('')}</div></section>`;
    }
    for (const y of years) {
      const soon = y === first;
      out += `<section class="sec"><div class="sec-h"><h2>${y}</h2>${soon ? '<span class="chip loss sm">läuft aus</span>' : `<span class="note">${groups[y].length} Spieler</span>`}</div>
        <div class="card flat"><div class="list">${groups[y].map((p) => `<a class="li" href="#/spieler/${k}/${p.id}">${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}
          <span class="grow"><div class="t ellipsis">${esc(p.name)}</div><div class="s">${esc(p.position || '')} · ${p.age || '–'} J. · ${fmtDate(p.contract)}${p.contractNote ? ' · <span class="green">' + esc(p.contractNote) + '</span>' : ''}</div></span><span class="v ${soon ? 'red' : ''}">${esc(leftTxt(p.contract))}</span></a>`).join('')}</div></div></section>`;
    }
    if (!years.length) out += '<div class="empty" style="margin-top:14px">Keine Vertragsdaten.</div>';
    return out;
  }

  // ------------------------------------------------------------------ Spiele
  function vSpiele(k, tab) {
    UI.spieleTeam = k;
    const ms = matchList(k);
    const fm = formOf(k);
    let out = pageHead('Spie<em>le</em>', 'Liga · Pokal · Europa');
    const isCl = ['cl', 'cltab', 'clko'].includes(tab);
    const tabOn = tab === 'cltabelle' ? 'tabelle' : isCl ? 'cl' : tab;
    out += `<nav class="tabs" aria-label="Ansicht">${[['kommend', 'Kommende'], ['ergebnisse', 'Ergebnisse'], ['tabelle', 'Tabelle'], ['cl', 'Champions League'], ['konferenz', 'Konferenz'], ['saison', 'Saison'], ['torschuetzen', 'Torschützen']].map(([t, l]) => `<a href="#/spiele/${k}/${t}" class="${t === tabOn ? 'on' : ''}">${l}</a>`).join('')}</nav>`;
    if (isCl) {
      out += `<div style="margin-top:14px">${seg('cl', [['cl', 'Alle Spiele', '#/spiele/profis/cl'], ['cltab', 'Tabelle', '#/spiele/profis/cltab'], ['clko', 'K.-o.-Runde', '#/spiele/profis/clko']], tab, 'sm')}</div>`;
      if (tab === 'cl') out += clGamesView();
      else if (tab === 'cltab') out += tableView('ucl');
      else out += `<div id="clko">${clKoHtml()}</div>`;
      return out;
    }
    if (tab === 'kommend' || tab === 'ergebnisse') {
      const w = fm.filter((x) => x === 'W').length;
      const d = fm.filter((x) => x === 'D').length;
      out += `<section class="form-card"><span><span class="eyebrow">Form · letzte ${fm.length}</span><div class="muted" style="font-size:12px;font-weight:600;margin-top:2px">${w} Siege · ${d} Remis · ${fm.length - w - d} Niederl.</div></span>${formHtml(fm)}</section>`;
    }
    if (tab === 'kommend') {
      const up = ms.filter((m) => !m.finished);
      out += `<div class="stagger" style="display:flex;flex-direction:column;gap:12px;margin-top:14px">${up.length ? up.slice(0, 20).map((m, i) => ticket(m, k, i === 0)).join('') : '<div class="empty">Keine kommenden Spiele.</div>'}</div>`;
    } else if (tab === 'ergebnisse') {
      const fin = ms.filter((m) => m.finished && m.score).reverse();
      out += `<div class="stagger" style="display:flex;flex-direction:column;gap:12px;margin-top:14px">${fin.length ? fin.map((m) => ticket(m, k, false)).join('') : '<div class="empty">Noch keine Ergebnisse.</div>'}</div>`;
    } else if (tab === 'konferenz') {
      out += `<div id="konf">${konfHtml(KONF.data)}</div>`;
    } else if (tab === 'saison') {
      out += vSaisonTab();
    } else if (tab === 'tabelle' || tab === 'cltabelle') {
      const key = tab === 'cltabelle' ? 'ucl' : 'bl1';
      out += `<div style="margin-top:14px">${seg('tabelle', [['bl1', 'Bundesliga', '#/spiele/profis/tabelle'], ['ucl', 'Champions League', '#/spiele/profis/cltabelle']], key, 'sm')}</div>`;
      out += tableView(key);
    } else {
      out += scorerView(k);
    }
    return out;
  }
  const TK_COMP = { Bundesliga: 'Liga', 'DFB-Pokal': 'Pokal', 'Champions League': 'CL', 'Europa League': 'EL', 'Conference League': 'ECL' };
  const compRound = (m) => [TK_COMP[m.comp] || m.comp || '', String(m.round || '').replace(/^(\d+)\.(?=\S)/, '$1. ')].filter(Boolean).join(' · ');
  function ticket(m, k, isNext) {
    const live = isLive(m);
    const fin = m.finished && m.score;
    const d = new Date(m.date);
    const n = daysUntil(m.date);
    const when = live || fin ? '' : n === 0 ? 'Heute' : n === 1 ? 'Morgen' : n > 0 && n < 8 ? `in ${n} Tagen` : '';
    const stub = fin
      ? `<span class="d1">${m.outcome === 'W' ? 'Sieg' : m.outcome === 'L' ? 'Niederl.' : 'Remis'}</span><span class="d2">${m.score[0]}:${m.score[1]}</span><span class="d4">${esc(F.dm.format(d))}</span>`
      : live ? `<span class="d1">Live</span><span class="d2">${m.score ? m.score[0] + ':' + m.score[1] : '0:0'}</span><span class="d4">läuft</span>`
        : `<span class="d1">${esc(F.wd.format(d).replace('.', ''))}</span><span class="d2">${esc(F.dd.format(d))}</span><span class="d3">${m.timeKnown === false ? '--:--' : esc(F.time.format(d))}</span><span class="d4">${esc(F.mon.format(d).replace('.', ''))}</span>`;
    const label = compRound(m);
    const teamRow = (t, side) => `<span class="tk-team ${/Dortmund/.test(t.name || '') ? 'me' : ''}">${crest(t, 'crest md')}<span>${esc(tname(t))}</span>${fin || live ? `<b>${m.score ? m.score[side] : 0}</b>` : ''}</span>`;
    return `<button type="button" class="ticket ${isNext ? 'next' : ''} ${live ? 'live' : ''} ${fin ? 'res ' + (m.outcome || '') : ''}" data-action="match" data-id="${esc(m.id)}" data-team="${k}">
      <span class="tk-main"><span class="tk-comp">${live ? '<span class="live-tag">LIVE</span>' : ''}<span class="chip ${isNext ? 'y' : ''} sm tk-label">${esc(label)}</span>${when ? `<span class="eyebrow tk-when">${esc(when)}</span>` : ''}</span>
      <span class="tk-teams">${teamRow(m.home, 0)}${teamRow(m.away, 1)}</span></span>
      <span class="tk-stub">${stub}</span>
    </button>`;
  }
  function tableView(key) {
    const t = (D.tables || {})[key];
    if (!t || !t.rows || !t.rows.length) return '<div class="empty" style="margin-top:14px">Tabelle noch nicht verfügbar.</div>';
    return `<p class="faint" style="font-size:12px;margin:14px 2px 8px;font-weight:600">${esc(t.name || '')}${t.updatedAt ? ' · Stand ' + esc(rel(t.updatedAt)) : ''}</p>
      <div class="card" style="padding:6px 8px"><table class="table"><thead><tr><th>#</th><th>Verein</th><th>Sp</th><th>TD</th><th>Pkt</th></tr></thead><tbody>
      ${t.rows.map((r) => `<tr class="${r.isBVB ? 'me' : ''}"><td>${r.pos}</td><td><span class="tm">${crest({ name: r.team, icon: r.icon }, 'crest xs')}<span>${esc(r.short || r.team)}</span></span></td><td>${r.played}</td><td>${r.diff > 0 ? '+' : ''}${r.diff}</td><td>${r.points}</td></tr>`).join('')}
      </tbody></table></div>`;
  }
  function scorerView(k) {
    const comp = k === 'profis' ? UI.statsComp : 'all';
    const tab = ['goals', 'assists', 'scorer'].includes(UI.scorerTab) ? UI.scorerTab : 'goals';
    const val = (p) => (tab === 'scorer' ? (p.s.goals || 0) + (p.s.assists || 0) : p.s[tab] || 0);
    const unit = { goals: ['Tor', 'Tore'], assists: ['Vorlage', 'Vorlagen'], scorer: ['Scorer', 'Scorer'] }[tab];
    const ps = (team(k).players || []).map((p) => Object.assign({ s: statsOf(k, p.id, comp) || {} }, p)).filter((p) => val(p) > 0)
      .sort((a, b) => (val(b) - val(a)) || ((b.s.goals || 0) - (a.s.goals || 0)) || ((b.s.assists || 0) - (a.s.assists || 0)) || ((a.s.minutes || 0) - (b.s.minutes || 0)));
    let out = `<div class="set-seg sc-seg" role="group" aria-label="Rangliste">${[['goals', 'Torschützen'], ['assists', 'Vorlagen'], ['scorer', 'Scorer']].map(([v, l]) => `<button type="button" class="${tab === v ? 'on' : ''}" aria-pressed="${tab === v}" data-action="scorertab" data-val="${v}">${l}</button>`).join('')}</div>`;
    if (k === 'profis') out += compChips();
    if (!ps.length) return out + `<div class="empty" style="margin-top:14px">Noch keine ${tab === 'goals' ? 'Torschützen' : tab === 'assists' ? 'Vorlagen' : 'Scorerpunkte'}.</div>`;
    const top = ps.slice(0, 3);
    const order = [top[1], top[0], top[2]];
    const pod = order.map((p, i) => (p ? `<a class="pod ${['p2', 'p1', 'p3'][i]}" href="#/spieler/${k}/${p.id}">${img(pimg(p.img, 'medium'), 'avatar', p.name, initials(p.name))}<span class="pod-name">${esc(lastName(p.name))}</span><span class="pod-block"><b>${val(p)}</b><span>${val(p) === 1 ? unit[0] : unit[1]}</span></span></a>` : '<span></span>')).join('');
    return out + `<p class="faint" style="font-size:12px;margin:14px 2px 0;font-weight:600">${comp === 'all' ? 'Alle Wettbewerbe' : esc((COMPS.find((c) => c[0] === comp) || [])[1] || '')}${tab === 'scorer' ? ' · Scorer = Tore + Vorlagen' : ''}</p>
      <div class="podium">${pod}</div>
      <div class="card flat" style="margin-top:14px"><div class="list">${ps.map((p, i) => `<a class="li" href="#/spieler/${k}/${p.id}"><span class="rank">${i + 1}</span>${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}
      <span class="grow"><div class="t ellipsis">${esc(p.name)}${favMark(k, p.id)}</div><div class="s">${p.s.apps || 0} Spiele · ${p.s.goals || 0} Tore · ${p.s.assists || 0} Vorlagen</div></span><span class="num yellow" style="font-size:24px">${val(p)}</span></a>`).join('')}</div></div>`;
  }

  // ------------------------------------------------------------------ Kader & Spieler
  const GROUPS = [['Torwart', 'Tor'], ['Abwehr', 'Abwehr'], ['Mittelfeld', 'Mittelfeld'], ['Sturm', 'Sturm']];
  function vKader(k) {
    UI.kaderTeam = k;
    const t = team(k);
    let out = pageHead('Ka<em>der</em>', `${t.count || 0} Spieler · Ø ${t.avgAge ? String(t.avgAge).replace('.', ',') : '–'} Jahre`);
    out += seg('kader', [['profis', 'Profis', '#/kader/profis'], ['u23', 'BVB II', '#/kader/u23'], ['u19', 'U19', '#/kader/u19']], k);
    out += `<div style="margin-top:12px"><label class="sr" for="ksearch">Spieler suchen</label><input id="ksearch" class="search" type="search" placeholder="Spieler suchen …" autocomplete="off" value="${esc(UI.kaderSearch)}" data-action="search"></div>`;
    out += `<div class="chips" style="margin-top:12px" role="group" aria-label="Filter">${[['alle', 'Alle'], ...GROUPS, ['fehlt', 'Fehlt']].map(([kk, l]) => `<button type="button" class="${UI.kaderFilter === kk ? 'on' : ''}" aria-pressed="${UI.kaderFilter === kk}" data-action="kfilter" data-val="${kk}">${l}</button>`).join('')}</div>`;
    out += `<div id="kgrid">${kaderGrid(k)}</div>`;
    return out;
  }
  function kaderGrid(k) {
    const q = slug(UI.kaderSearch);
    const f = UI.kaderFilter;
    const ps = (team(k).players || []).filter((p) => (!q || slug(p.name).includes(q)) && (f === 'alle' || p.group === f || (f === 'fehlt' && isOut(p))));
    if (!ps.length) return '<div class="empty" style="margin-top:14px">Kein Spieler gefunden.</div>';
    let out = '';
    const fk = new Set(favs());
    const top = f === 'alle' && !q ? ps.filter((p) => fk.has(favKey(k, p.id))) : [];
    if (top.length) out += `<h2 class="group-h fav-h">${I.starF} Deine Spieler <span>${top.length}</span></h2><div class="pgrid stagger">${top.map((p) => pCard(p, k)).join('')}</div>`;
    const others = ps.filter((p) => !top.includes(p));
    for (const [g, l] of GROUPS) {
      const gp = others.filter((p) => p.group === g);
      if (gp.length) out += `<h2 class="group-h">${l} <span>${gp.length}</span></h2><div class="pgrid stagger">${gp.map((p) => pCard(p, k)).join('')}</div>`;
    }
    const rest = others.filter((p) => !GROUPS.some(([g]) => g === p.group));
    if (rest.length) out += `<h2 class="group-h">Weitere</h2><div class="pgrid">${rest.map((p) => pCard(p, k)).join('')}</div>`;
    return out;
  }
  function pCard(p, k) {
    const ab = absencesOf(p).filter((a) => a.type !== 'ineligible');
    const s = statsOf(k, p.id) || {};
    const line = k === 'profis' ? `${s.apps || 0} Sp.${s.goals ? ` · ${s.goals} ${s.goals === 1 ? 'Tor' : 'Tore'}` : ''}`
      : `Vertrag bis ${p.contract ? p.contract.slice(0, 4) : UNK}`;
    return `<a class="pc ${ab.length ? 'out' : ''}" href="#/spieler/${k}/${p.id}" data-vt="player">
      <span class="pc-media">${p.number ? `<span class="pc-num" aria-hidden="true">${esc(p.number)}</span>` : ''}${img(pimg(p.img, 'big'), '', p.name, initials(p.name))}${ab.length ? `<span class="pc-abs chip sm ${ab[0].type === 'injury' ? 'loss' : 'warn'}">${ab[0].type === 'injury' ? 'Verletzt' : 'Fehlt'}</span>` : ''}</span>
      <span class="pc-body"><span class="pc-name">${esc(p.name)}${p.captain ? ' <span class="yellow">©</span>' : ''}${favMark(k, p.id)}</span><span class="pc-pos">${esc(p.position || UNK)} · ${p.age || UNK} J.</span><span class="pc-val">${esc(line)}</span></span>
    </a>`;
  }
  const INJ = { injured: 'Fällt aus:', doubtful: 'Fraglich:', back: 'Zurück im Training:', fit: 'Wieder fit:', suspended: 'Gesperrt:' };
  function vSpieler(k, id) {
    const p = findPlayer(k, id);
    if (!p) return pageHead('Spieler', '', '', '#/kader/' + k) + '<div class="empty">Spieler nicht gefunden.</div>';
    const st = statsOf(k, id, k === 'profis' ? UI.statsComp : 'all') || {};
    const abs = absencesOf(p);
    const injNews = ((D.news || {}).injuryNews || []).filter((n) => slug(n.player) === slug(p.name));
    const stories = transferFeed().filter((it) => it.playerId === id || slug(it.name) === slug(p.name));
    let contract = '';
    if (p.contract) {
      const a = Date.parse((p.joined || p.contract) + 'T00:00:00Z');
      const b = Date.parse(p.contract + 'T00:00:00Z');
      const frac = Math.max(0, Math.min(1, (Date.now() - a) / ((b - a) || 1)));
      const months = Math.max(0, Math.round((b - Date.now()) / (30.44 * 864e5)));
      const left = months >= 12 ? `${Math.floor(months / 12)} ${Math.floor(months / 12) === 1 ? 'Jahr' : 'Jahre'}${months % 12 ? ` ${months % 12} Mon.` : ''}` : `${months} ${months === 1 ? 'Monat' : 'Monate'}`;
      contract = `<section class="card row" style="margin-top:12px;gap:16px">
        <span style="position:relative;width:86px;height:86px;flex:none">${ring(frac, 86, 8)}<span style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><b class="num" style="font-size:22px;line-height:1">${p.contract.slice(0, 4)}</b><span class="faint" style="font-size:9px;font-weight:800;letter-spacing:.1em">VERTRAG</span></span></span>
        <span class="grow"><span class="eyebrow">Vertrag bis</span><div style="font-size:18px;font-weight:800;margin-top:2px">${fmtDate(p.contract)}</div><div class="muted" style="font-size:12px;font-weight:600;margin-top:2px">noch ${left}</div>${p.contractNote ? `<div class="green" style="font-size:11px;font-weight:800;margin-top:4px">${esc(p.contractNote)}</div>` : ''}</span></section>`;
    }
    let out = `<section class="phero">
      <div class="phero-num" aria-hidden="true">${esc(p.number || '')}</div>
      ${p.img ? img(pimg(p.img, 'big'), 'phero-img', p.name, 'sil', 'style="view-transition-name:player-photo"') : SIL}
      <div class="phero-fade"></div>
      <button type="button" class="phero-back press" data-action="back" data-fallback="#/kader/${k}" aria-label="Zurück">${I.back}</button>
      <button type="button" class="phero-fav press ${isFav(k, id) ? 'on' : ''}" data-action="fav" data-k="${k}" data-id="${esc(id)}" aria-pressed="${isFav(k, id)}" aria-label="Lieblingsspieler">${I.star}${I.starF}</button>
      <span class="phero-team">KADER · ${esc(TEAMNAME[k].toUpperCase())}</span>
      <div class="phero-n"><b>#${esc(p.number || UNK)}</b><span class="chip ink">${esc(p.group || '')}</span>${p.captain ? '<span class="chip ink">Kapitän</span>' : ''}</div>
      <div class="phero-name"><h1>${esc(p.name)}</h1><span>${esc([p.position || `Position ${UNK}`, p.age ? p.age + ' Jahre' : `Alter ${UNK}`, (p.flags || []).map((f) => f.name).join(' / ')].filter(Boolean).join(' · '))}</span></div>
    </section>`;
    if (k === 'profis') {
      out += compChips();
      out += `<section class="grid4" style="margin-top:10px">
        <div class="stat-box"><b>${st.apps || 0}</b><span>Spiele</span></div>
        <div class="stat-box"><b class="yellow">${st.goals || 0}</b><span>Tore</span></div>
        <div class="stat-box"><b>${st.assists || 0}</b><span>Vorlagen</span></div>
        <div class="stat-box"><b>${st.minutes || 0}'</b><span>Minuten</span></div>
      </section>`;
      out += `<button type="button" class="btn ghost cmp-cta" data-action="cmp-start" data-k="${k}" data-id="${esc(id)}">${I.swap} Mit anderem Spieler vergleichen</button>`;
      out += formCurve(p);
    }
    out += contract || `<section class="card row" style="margin-top:12px;gap:12px"><span class="eyebrow grow">Vertrag bis</span><b style="font-size:18px">${UNK}</b></section>`;
    if (abs.length || injNews.length) {
      out += `<section class="sec"><div class="sec-h"><h2>Status</h2></div><div style="display:flex;flex-direction:column;gap:8px">
        ${abs.map((a) => `<div class="note-box ${a.type === 'ineligible' ? '' : 'alert'}">${a.type === 'ineligible' ? I.info : I.injury}<span>${esc(a.text)}</span></div>`).join('')}
        ${injNews.map((n) => `<div class="note-box"><span class="ai-badge sm">${I.ai}</span><span><b>${esc(INJ[n.status] || '')}</b> ${esc(n.text || '')}${n.expectedReturn ? ` · Rückkehr: ${esc(n.expectedReturn)}` : ''}<div class="faint" style="font-size:11px;margin-top:3px;font-weight:600">${esc(n.source || '')} · ${esc(fmtDate(n.date))} · via Gemini</div></span></div>`).join('')}
      </div></section>`;
    }
    if (stories.length) out += `<section class="sec"><div class="sec-h"><h2>Transfer-News</h2></div><div style="display:flex;flex-direction:column;gap:14px">${stories.slice(0, 2).map(tCard).join('')}</div></section>`;
    out += `<section class="card flat" style="margin-top:18px">
      ${k === 'profis' && p.fmRating ? `<div class="kv"><span>Ø Note in der Bundesliga (FotMob)</span><span class="yellow">${nf2.format(p.fmRating)}</span></div>` : ''}
      ${p.joined ? `<div class="kv"><span>Im Team seit</span><span>${fmtDate(p.joined)}${p.from ? ` · von ${esc(p.from.name)}` : ''}</span></div>` : ''}
      ${p.from && p.from.fee && p.from.fee !== '-' ? `<div class="kv"><span>Ablöse damals</span><span>${esc(p.from.fee)}</span></div>` : ''}
      ${p.birth ? `<div class="kv"><span>Geburtstag</span><span>${fmtDate(p.birth)}</span></div>` : ''}
      ${p.height ? `<div class="kv"><span>Größe</span><span>${esc(p.height)}</span></div>` : ''}
      ${p.foot ? `<div class="kv"><span>Starker Fuß</span><span>${esc(p.foot)}</span></div>` : ''}
      ${p.flags && p.flags.length ? `<div class="kv"><span>Nation</span><span>${flagImgs(p.flags)} ${esc(p.flags.map((f) => f.name).join(' / '))}</span></div>` : ''}
      ${k === 'profis' ? `<div class="kv"><span>Karten</span><span>${st.yellow || 0} Gelb · ${(st.yellowRed || 0) + (st.red || 0)} Rot</span></div>` : ''}
      ${p.aiAdded ? `<div class="kv"><span>Im Kader seit</span><span>${fmtDate(p.joined)} · ${esc(p.aiAdded)}</span></div>` : ''}
    </section>
    ${/^\d+$/.test(id) ? `<a class="btn ghost" style="margin-top:12px" href="https://www.transfermarkt.de/x/profil/spieler/${esc(id)}" target="_blank" rel="noopener">Profil auf Transfermarkt ${I.ext.replace('<svg', '<svg style="stroke:currentColor"')}</a>` : ''}`;
    return out;
  }

  // ------------------------------------------------------------------ Mehr
  function vMehr() {
    const st = D.status || {};
    const items = [
      ['#/mehr/einstellungen', I.gear, 'Einstellungen', 'Name, Design & Startseite'],
      ['#/mehr/stats', I.chart, 'Statistiken', 'Tore, Vorlagen, Minuten'],
      ['#/vergleich', I.swap, 'Vergleich', 'Spieler direkt gegenüber'],
      ['#/mehr/elf', I.shirt, 'Meine Elf', 'Deine Traum-Aufstellung'],
      ['#/mehr/lazarett', I.cross, 'Lazarett', 'Verletzte & Rückkehrer'],
      ['#/mehr/tippspiel', I.target, 'Tippspiel', `${userName() || 'Du'} gegen die KI`],
      ['#/mehr/rueckblick', I.star, 'Rückblick', 'Deine BVB-Story'],
      ['#/mehr/talente', I.sprout, 'Talente', 'U19 & BVB II'],
      ['#/transfers/tm', I.link, 'Transfermarkt', 'Profis, U23 & U19'],
      ['#/mehr/erfolge', I.trophy, 'Erfolge', 'Titel & große Momente'],
      ['#/mehr/install', I.phone, 'Installieren', 'Aufs iPhone holen'],
      ['#/mehr/info', I.infoC, 'Über die App', 'Quellen & Hinweise'],
    ];
    return pageHead('Me<em>hr</em>', 'Alles rund um den BVB') + `<div class="tiles stagger">
      <a class="mtile y stripes" href="#/mehr/update"><span class="mi" style="position:relative">${I.ai}</span><b style="position:relative">KI-Update-Zentrale</b><span style="position:relative">${st.lastRun ? `Letztes Update ${esc(rel(st.lastRun))} · ${st.changes ? st.changes.total : 0} Änderungen` : 'Wann Gemini zuletzt aktualisiert hat'}</span></a>
      ${items.map(([h, ic, t, s]) => `<a class="mtile" href="${h}"><span class="mi">${ic}</span><b>${t}</b><span>${esc(s)}</span></a>`).join('')}
    </div>`;
  }
  const CAT = { values: 'Werte', transfers: 'Transfers', stories: 'Storys', rumors: 'Gerüchte', news: 'News', injuries: 'Verletz.', matches: 'Spiele', table: 'Tabelle', stats: 'Statistik', squad: 'Kader' };
  const CAT_COLOR = { values: '#FDE100', transfers: '#3BD67F', stories: '#3BD67F', rumors: '#FFB020', news: '#5AA9FF', injuries: '#FF5A4E', matches: '#F6F5EE', table: '#F6F5EE', stats: '#A3A39A', squad: '#FDE100' };
  function berlinToDate(ymd, hm) {
    const [y, mo, d] = ymd.split('-').map(Number);
    const [h, mi] = hm.split(':').map(Number);
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess));
    const g = (t) => +parts.find((x) => x.type === t).value;
    return new Date(guess - (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute')) - guess));
  }
  function nextRuns(st) {
    const sched = st.schedule || ['08:17', '14:17', '20:17'];
    const out = [];
    for (let i = 0; i < 3; i++) {
      const ymd = berlinYMD(new Date(Date.now() + i * 864e5));
      for (const hm of sched) { const t = berlinToDate(ymd, hm); if (t > Date.now()) out.push(t); }
    }
    return out.slice(0, 3);
  }
  function vUpdate() {
    const st = D.status;
    let out = pageHead('Update-<em>Zentrale</em>', 'Automatisch 3× täglich · GitHub + Gemini', '', '#/mehr');
    if (!st) return out + '<div class="empty">Noch kein Update gelaufen. Sobald GitHub das erste Mal aktualisiert, siehst du hier alles.</div>';
    const last = Date.parse(st.lastRun);
    const nr = nextRuns(st);
    const next = nr[0];
    const frac = next ? Math.max(.02, Math.min(1, (Date.now() - last) / ((next - last) || 1))) : 1;
    const minsLeft = next ? Math.max(0, Math.round((next - Date.now()) / 60000)) : 0;
    const ch = st.changes || { total: 0, byCategory: {}, items: [] };
    const mods = Object.values(st.modules || {});
    const bad = mods.filter((m) => m.ok === false);
    const warn = mods.filter((m) => m.ok && m.warning);
    const gem = st.gemini || (D.news || {}).gemini || {};
    const overdue = Date.now() - last > 9 * 36e5;
    const C = 2 * Math.PI * 76;
    out += `<section class="uz-hero">
      <div class="uz-ring"><span class="pulse-ring"></span>
        <svg viewBox="0 0 170 170" aria-hidden="true"><circle cx="85" cy="85" r="76" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="10"/><circle class="val" cx="85" cy="85" r="76" fill="none" stroke="#FDE100" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(reduce ? C * (1 - frac) : C).toFixed(1)}" data-off="${(C * (1 - frac)).toFixed(1)}" style="transition:stroke-dashoffset 1.4s var(--ease)"/></svg>
        <span class="uz-center"><b>${minsLeft > 99 ? Math.round(minsLeft / 60) : minsLeft}</b><span>${minsLeft > 99 ? 'Std. bis Update' : 'Min. bis Update'}</span></span></div>
      <span class="eyebrow" style="margin-top:6px">Letztes Update</span>
      <b style="font-size:20px">${esc(dayLabel(st.lastRun))}, ${esc(F.time.format(new Date(last)))} Uhr</b>
      <span class="row" style="gap:8px;justify-content:center;margin-top:4px"><span class="chip y">${countEl(ch.total || 0, 'num')} Änderungen</span><span class="chip ${bad.length ? 'loss' : warn.length ? 'warn' : 'ok'}">${bad.length ? `${bad.length} Fehler` : warn.length ? 'Warnung' : 'Alles OK'}</span></span>
      <span class="row" style="gap:6px;justify-content:center;margin-top:8px;flex-wrap:wrap"><span class="faint" style="font-size:12px;font-weight:700">Nächste:</span>${nr.map((t, i) => `<span class="chip sm ${i === 0 ? 'ink' : 'ghost'}">${esc(F.time.format(t))}</span>`).join('')}</span>
    </section>`;
    if (overdue) out += `<div class="note-box warn" style="margin-top:12px">${I.warn}<span>Das letzte Update ist schon ${esc(rel(st.lastRun).replace('vor ', ''))} her. GitHub startet manchmal verspätet, du kannst es aber auch selbst anstoßen.</span></div>`;
    out += `<section class="cat-grid stagger" style="margin-top:14px">${Object.entries(CAT).map(([k, l]) => { const n = (ch.byCategory || {})[k] || 0; return `<div class="cat ${n ? 'on' : ''}"><b>${n}</b><span>${l}</span></div>`; }).join('')}</section>`;
    out += `<section class="card" style="margin-top:14px;display:flex;flex-direction:column;gap:6px">
      <div class="row"><span class="ai-badge live">${I.ai}</span><span class="grow"><b style="font-size:15px">Gemini-KI</b><div class="muted" style="font-size:11px;font-weight:600">Kostenlos · läuft auf GitHub</div></span>
      <span class="chip ${gem.used ? 'ok' : gem.error ? 'warn' : 'ghost'}">${gem.used ? 'Aktiv' : gem.error ? 'Pause' : 'Startklar'}</span></div>
      ${gem.used ? `<div class="kv"><span>Zuletzt ausgewertet</span><span>${esc(rel(gem.at))}</span></div>
        <div class="kv"><span>Geprüfte Meldungen</span><span>${gem.headlinesAnalyzed || gem.headlines || 0}</span></div>
        <div class="kv"><span>Transfer-Storys</span><span>${gem.stories || 0}</span></div>
        <div class="kv"><span>Verletzungs-News</span><span>${gem.injuries || 0}</span></div>
        <div class="kv"><span>Verträge &amp; Kader übernommen</span><span>${gem.applied || 0}</span></div>
        <div class="kv"><span>Modell</span><span>${esc(gem.model || '')}${gem.grounded ? ' · mit Suche' : ''}</span></div>`
        : `<p class="muted" style="font-size:12px;line-height:1.55;margin-top:6px">${gem.error ? `Gemini konnte zuletzt nicht antworten (${esc(gem.error)}). Spiele, Tabellen und Live-Tore laufen trotzdem weiter.` : 'Liest Meldungen von Romano, Sky, kicker &amp; Co. und macht daraus Here-we-go-Karten, Verletzungs-News, Vertragsverlängerungen und das KI-Briefing.'}</p>`}
    </section>`;
    const ai = st.ai || {};
    if (Object.keys(ai).length) {
      const on = [['gemini', 'Gemini'], ['groq', 'Groq'], ['cerebras', 'Cerebras'], ['openrouter', 'OpenRouter'], ['mistral', 'Mistral']];
      // Ersatz-KIs werden täglich mit einer Mini-Anfrage getestet (status.aiCheck)
      const chk = st.aiCheck || {};
      const bad = (k2) => ai[k2] && chk[k2] && chk[k2].ok === false;
      const tested = on.filter(([k2]) => k2 !== 'gemini' && ai[k2] && chk[k2]);
      out += `<section class="card" style="margin-top:12px;display:flex;flex-direction:column;gap:10px"><span class="eyebrow">KI-Team · springt der Reihe nach ein</span>
        <div class="ai-chips">${on.map(([k2, l]) => `<span class="chip sm ${bad(k2) ? 'warn' : ai[k2] ? 'ok' : 'ghost'}">${bad(k2) ? '!' : ai[k2] ? '✓' : '–'} ${l}</span>`).join('')}</div>
        ${tested.map(([k2, l]) => `<div class="kv"><span>${l}-Test</span><span class="${chk[k2].ok ? 'green' : 'red'}">${chk[k2].ok ? 'bereit' : esc(chk[k2].error || 'Fehler')} · ${esc(rel(chk[k2].at))}</span></div>`).join('')}
        ${gem.drill ? `<div class="kv"><span>Ernstfall-Test (${esc(String(gem.drill.model || 'Ersatz-KI').split(':')[0].replace(/^./, (c) => c.toUpperCase()))})</span><span class="${gem.drill.ok ? 'green' : 'red'}">${gem.drill.ok
          ? `${gem.drill.stories} Meldungen erkannt${gem.drill.gemini ? ` · ${gem.drill.overlap} von ${gem.drill.gemini} wie Gemini` : ''}` : esc(gem.drill.error || 'fehlgeschlagen')} · ${esc(rel(gem.drill.at))}</span></div>` : ''}
        <p class="faint" style="font-size:12px;line-height:1.5;font-weight:600">Antwortet Gemini nicht, übernehmen die anderen News, Gerüchte und Verletzungen. Prognosen, Wahrscheinlichkeiten und den KI-Tipp rechnet die App selbst – ganz ohne KI.</p></section>`;
    }
    const modRow = (m) => `<div class="mod">${m.ok === false ? I.bad : m.warning ? I.warn : I.ok}<span class="grow"><b>${esc(m.label)}</b>${m.ok === false ? `<div class="red" style="font-size:12px">${esc(m.error || 'Fehler')}</div>` : m.warning ? `<div class="amber" style="font-size:12px">${esc(m.warning)}</div>` : ''}<div class="faint" style="font-size:11px;font-weight:600">${m.at ? 'aktualisiert ' + esc(rel(m.at)) : 'noch nie'}${m.seconds != null ? ' · ' + m.seconds + ' s' : ''}</div></span></div>`;
    out += `<section class="sec"><div class="sec-h"><h2>Automatisch</h2><span class="note">GitHub · 3× täglich</span></div><div class="card flat">${mods.map(modRow).join('')}</div></section>`;
    const pc = D['status-pc'] || {};
    const pcMods = Object.values(pc.modules || {});
    const aiAt = (D.squads || {}).aiUpdatedAt || (st.transfermarkt || {}).aiUpdatedAt;
    out += `<section class="sec"><div class="sec-h"><h2>Transfermarkt</h2><span class="note">Stand ${esc(pc.lastRun ? fmtDate(pc.lastRun) : '–')}</span></div>
      <div class="note-box" style="margin-bottom:10px">${I.info}<span>Transfermarkt sperrt Server wie GitHub mit einem Bot-Schutz. Vertragsverlängerungen, Wechsel und Verletzungen übernimmt deshalb <b>Gemini</b> aus den News, die Statistiken kommen von ESPN.${aiAt ? ` Letzte KI-Änderung am Kader: ${esc(rel(aiAt))}.` : ''} Tore zählt die App live aus den Spielberichten.</span></div>
      ${pcMods.length ? `<div class="card flat">${pcMods.map(modRow).join('')}</div>` : ''}</section>`;
    const runs = (st.runs || []).slice(0, 30).reverse();
    if (runs.length) {
      const mx = Math.max(1, ...runs.map((r) => r.changes || 0));
      out += `<section class="sec"><div class="sec-h"><h2>Letzte Läufe</h2><span class="note">${st.totalChanges7d || 0} Änderungen in 7 Tagen</span></div>
        <div class="card"><div class="runbars" role="img" aria-label="Änderungen pro Update">${runs.map((r, i) => `<i class="${r.ok === false ? 'err' : r.changes ? '' : 'zero'}" title="${esc(F.dayShort.format(new Date(r.at)))} ${esc(F.time.format(new Date(r.at)))}: ${r.changes} Änderungen" style="height:${Math.max(6, (r.changes || 0) / mx * 100)}%;animation-delay:${i * 0.025}s"></i>`).join('')}</div>
        <div class="row faint" style="justify-content:space-between;font-size:10px;margin-top:8px;font-weight:700"><span>${esc(F.dayShort.format(new Date(runs[0].at)))}</span><span>jetzt</span></div></div></section>`;
    }
    const items = ch.items || [];
    out += `<section class="sec"><div class="sec-h"><h2>Protokoll</h2><span class="note">letztes Update</span></div><div class="card">
      ${items.length ? items.map((it) => `<div class="log"><i style="background:${CAT_COLOR[it.cat] || '#FDE100'}"></i><span>${esc(it.text)}</span></div>`).join('') : `<p class="muted" style="font-size:13px">${st.firstRun ? 'Erstes Update – alle Daten wurden neu geladen.' : 'Beim letzten Update gab es keine Änderungen.'}</p>`}
    </div></section>`;
    out += `<div style="display:flex;flex-direction:column;gap:10px;margin-top:18px">
      <button type="button" class="btn" data-action="reload">${I.refresh} Daten neu laden</button>
      <a class="btn ghost" href="https://github.com/${REPO}/actions/workflows/update.yml" target="_blank" rel="noopener">${I.github} Update bei GitHub starten</a>
      <p class="faint" style="font-size:11px;text-align:center;font-weight:600">Auf GitHub „Run workflow“ antippen (du musst eingeloggt sein).</p></div>`;
    return out;
  }
  function vStats() {
    const k = 'profis';
    const comp = UI.statsComp;
    const ps = (team(k).players || []).map((p) => Object.assign({ s: statsOf(k, p.id, comp) || {} }, p));
    const boards = [['goals', 'Tore'], ['assists', 'Vorlagen'], ['scorer', 'Scorerpunkte'], ['apps', 'Einsätze'], ['minutes', 'Spielminuten'], ['yellow', 'Gelbe Karten']];
    const val = (p, key) => (key === 'scorer' ? (p.s.goals || 0) + (p.s.assists || 0) : p.s[key] || 0);
    const src = ((D.stats || {}).source || {})[k] || 'ESPN';
    let out = pageHead('Statis<em>tiken</em>', 'Profis · Saison ' + esc(String((D.stats || {}).season || '')) + ' · Quelle: ' + esc(src), '', '#/mehr');
    out += compChips();
    out += `<div class="grid3" style="margin-top:12px"><div class="stat-box"><b class="yellow">${ps.reduce((s, p) => s + (p.s.goals || 0), 0)}</b><span>Tore</span></div><div class="stat-box"><b>${ps.reduce((s, p) => s + (p.s.assists || 0), 0)}</b><span>Vorlagen</span></div><div class="stat-box"><b>${ps.filter((p) => p.s.apps).length}</b><span>Eingesetzt</span></div></div>`;
    for (const [key, label] of boards) {
      const top = ps.filter((p) => val(p, key) > 0).sort((a, b) => val(b, key) - val(a, key)).slice(0, 5);
      const mx = top.length ? val(top[0], key) : 1;
      out += `<section class="sec"><div class="sec-h"><h2>${label}</h2></div><div class="card flat"><div class="list">
        ${top.length ? top.map((p, i) => `<a class="li" href="#/spieler/${k}/${p.id}"><span class="rank">${i + 1}</span>${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}
          <span class="grow" style="display:flex;flex-direction:column;gap:6px"><span class="row" style="justify-content:space-between"><span class="t ellipsis">${esc(p.name)}${favMark(k, p.id)}</span><span class="v">${nf0.format(val(p, key))}${key === 'minutes' ? "'" : ''}</span></span><span class="bar"><span style="width:${(val(p, key) / mx * 100).toFixed(0)}%;animation-delay:${i * 0.05}s"></span></span></span></a>`).join('') : '<p class="muted" style="padding:12px 0;font-size:13px">Noch keine Werte.</p>'}
      </div></div></section>`;
    }
    // Beste Noten laut FotMob (Durchschnitt in der Bundesliga, täglich aktualisiert)
    const rated = (team('profis').players || []).filter((p) => p.fmRating && ((statsOf('profis', p.id, 'bl1') || {}).apps || 0) >= 3)
      .sort((a, b) => b.fmRating - a.fmRating).slice(0, 5);
    if (rated.length) {
      out += `<section class="sec"><div class="sec-h"><h2>Beste Noten</h2><span class="note">Ø FotMob-Note · Bundesliga</span></div><div class="card flat"><div class="list">${rated.map((p, i) => `<a class="li" href="#/spieler/profis/${p.id}"><span class="rank">${i + 1}</span>${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}
        <span class="grow" style="display:flex;flex-direction:column;gap:6px"><span class="row" style="justify-content:space-between"><span class="t ellipsis">${esc(p.name)}${favMark('profis', p.id)}</span><span class="v">${nf2.format(p.fmRating)}</span></span><span class="bar"><span style="width:${Math.max(4, (p.fmRating - 5) / 5 * 100).toFixed(0)}%;animation-delay:${i * 0.05}s"></span></span></span></a>`).join('')}</div></div></section>`;
    }
    return out;
  }
  const compChips = () => `<div class="chips" style="margin-top:12px" role="group" aria-label="Wettbewerb">${COMPS.map(([c, l]) => `<button type="button" class="${UI.statsComp === c ? 'on' : ''}" aria-pressed="${UI.statsComp === c}" data-action="statcomp" data-val="${c}">${l}</button>`).join('')}</div>`;
  const FORMATIONS = {
    '4-3-3': [['TW', 50, 89, 'Torwart'], ['LV', 14, 69, 'Abwehr'], ['IV', 37, 74, 'Abwehr'], ['IV', 63, 74, 'Abwehr'], ['RV', 86, 69, 'Abwehr'], ['ZM', 26, 49, 'Mittelfeld'], ['ZM', 50, 54, 'Mittelfeld'], ['ZM', 74, 49, 'Mittelfeld'], ['LA', 17, 23, 'Sturm'], ['ST', 50, 16, 'Sturm'], ['RA', 83, 23, 'Sturm']],
    '4-2-3-1': [['TW', 50, 89, 'Torwart'], ['LV', 14, 70, 'Abwehr'], ['IV', 37, 75, 'Abwehr'], ['IV', 63, 75, 'Abwehr'], ['RV', 86, 70, 'Abwehr'], ['DM', 36, 55, 'Mittelfeld'], ['DM', 64, 55, 'Mittelfeld'], ['LA', 16, 34, 'Sturm'], ['ZOM', 50, 37, 'Mittelfeld'], ['RA', 84, 34, 'Sturm'], ['ST', 50, 15, 'Sturm']],
    '3-4-3': [['TW', 50, 89, 'Torwart'], ['IV', 25, 73, 'Abwehr'], ['IV', 50, 76, 'Abwehr'], ['IV', 75, 73, 'Abwehr'], ['LM', 12, 49, 'Mittelfeld'], ['ZM', 37, 53, 'Mittelfeld'], ['ZM', 63, 53, 'Mittelfeld'], ['RM', 88, 49, 'Mittelfeld'], ['LA', 20, 23, 'Sturm'], ['ST', 50, 16, 'Sturm'], ['RA', 80, 23, 'Sturm']],
    '4-4-2': [['TW', 50, 89, 'Torwart'], ['LV', 14, 70, 'Abwehr'], ['IV', 37, 75, 'Abwehr'], ['IV', 63, 75, 'Abwehr'], ['RV', 86, 70, 'Abwehr'], ['LM', 14, 46, 'Mittelfeld'], ['ZM', 38, 50, 'Mittelfeld'], ['ZM', 62, 50, 'Mittelfeld'], ['RM', 86, 46, 'Mittelfeld'], ['ST', 36, 18, 'Sturm'], ['ST', 64, 18, 'Sturm']],
    '3-5-2': [['TW', 50, 89, 'Torwart'], ['IV', 25, 73, 'Abwehr'], ['IV', 50, 76, 'Abwehr'], ['IV', 75, 73, 'Abwehr'], ['LM', 10, 47, 'Mittelfeld'], ['ZM', 31, 53, 'Mittelfeld'], ['ZM', 50, 58, 'Mittelfeld'], ['ZM', 69, 53, 'Mittelfeld'], ['RM', 90, 47, 'Mittelfeld'], ['ST', 36, 18, 'Sturm'], ['ST', 64, 18, 'Sturm']],
    '3-4-2-1': [['TW', 50, 89, 'Torwart'], ['IV', 25, 73, 'Abwehr'], ['IV', 50, 76, 'Abwehr'], ['IV', 75, 73, 'Abwehr'], ['LM', 12, 51, 'Mittelfeld'], ['ZM', 37, 55, 'Mittelfeld'], ['ZM', 63, 55, 'Mittelfeld'], ['RM', 88, 51, 'Mittelfeld'], ['ZOM', 32, 32, 'Mittelfeld'], ['ZOM', 68, 32, 'Mittelfeld'], ['ST', 50, 15, 'Sturm']],
    '3-4-1-2': [['TW', 50, 89, 'Torwart'], ['IV', 25, 73, 'Abwehr'], ['IV', 50, 76, 'Abwehr'], ['IV', 75, 73, 'Abwehr'], ['LM', 12, 51, 'Mittelfeld'], ['ZM', 37, 55, 'Mittelfeld'], ['ZM', 63, 55, 'Mittelfeld'], ['RM', 88, 51, 'Mittelfeld'], ['ZOM', 50, 35, 'Mittelfeld'], ['ST', 36, 17, 'Sturm'], ['ST', 64, 17, 'Sturm']],
    '4-1-4-1': [['TW', 50, 89, 'Torwart'], ['LV', 14, 70, 'Abwehr'], ['IV', 37, 75, 'Abwehr'], ['IV', 63, 75, 'Abwehr'], ['RV', 86, 70, 'Abwehr'], ['DM', 50, 59, 'Mittelfeld'], ['LM', 14, 42, 'Mittelfeld'], ['ZM', 38, 45, 'Mittelfeld'], ['ZM', 62, 45, 'Mittelfeld'], ['RM', 86, 42, 'Mittelfeld'], ['ST', 50, 16, 'Sturm']],
    '4-4-1-1': [['TW', 50, 89, 'Torwart'], ['LV', 14, 70, 'Abwehr'], ['IV', 37, 75, 'Abwehr'], ['IV', 63, 75, 'Abwehr'], ['RV', 86, 70, 'Abwehr'], ['LM', 14, 49, 'Mittelfeld'], ['ZM', 38, 53, 'Mittelfeld'], ['ZM', 62, 53, 'Mittelfeld'], ['RM', 86, 49, 'Mittelfeld'], ['HS', 50, 32, 'Sturm'], ['ST', 50, 15, 'Sturm']],
    '4-3-1-2': [['TW', 50, 89, 'Torwart'], ['LV', 14, 70, 'Abwehr'], ['IV', 37, 75, 'Abwehr'], ['IV', 63, 75, 'Abwehr'], ['RV', 86, 70, 'Abwehr'], ['DM', 50, 60, 'Mittelfeld'], ['ZM', 27, 50, 'Mittelfeld'], ['ZM', 73, 50, 'Mittelfeld'], ['ZOM', 50, 37, 'Mittelfeld'], ['ST', 36, 17, 'Sturm'], ['ST', 64, 17, 'Sturm']],
    '4-2-2-2': [['TW', 50, 89, 'Torwart'], ['LV', 14, 70, 'Abwehr'], ['IV', 37, 75, 'Abwehr'], ['IV', 63, 75, 'Abwehr'], ['RV', 86, 70, 'Abwehr'], ['DM', 36, 57, 'Mittelfeld'], ['DM', 64, 57, 'Mittelfeld'], ['ZOM', 22, 35, 'Mittelfeld'], ['ZOM', 78, 35, 'Mittelfeld'], ['ST', 38, 16, 'Sturm'], ['ST', 62, 16, 'Sturm']],
    '5-3-2': [['TW', 50, 89, 'Torwart'], ['LV', 9, 62, 'Abwehr'], ['IV', 29, 74, 'Abwehr'], ['IV', 50, 77, 'Abwehr'], ['IV', 71, 74, 'Abwehr'], ['RV', 91, 62, 'Abwehr'], ['ZM', 27, 47, 'Mittelfeld'], ['ZM', 50, 51, 'Mittelfeld'], ['ZM', 73, 47, 'Mittelfeld'], ['ST', 36, 18, 'Sturm'], ['ST', 64, 18, 'Sturm']],
    '5-4-1': [['TW', 50, 89, 'Torwart'], ['LV', 9, 63, 'Abwehr'], ['IV', 29, 75, 'Abwehr'], ['IV', 50, 78, 'Abwehr'], ['IV', 71, 75, 'Abwehr'], ['RV', 91, 63, 'Abwehr'], ['LM', 16, 44, 'Mittelfeld'], ['ZM', 39, 48, 'Mittelfeld'], ['ZM', 61, 48, 'Mittelfeld'], ['RM', 84, 44, 'Mittelfeld'], ['ST', 50, 17, 'Sturm']],
  };
  const elf = () => store.get('elf', { f: '4-3-3', s: {} });
  // Eigene Formationen: Reihen von hinten nach vorne (z. B. 3-2-4-1), Positionen danach frei verschiebbar
  const customOf = (e) => (String(e.f).startsWith('c:') ? (e.custom || []).find((c) => 'c:' + c.id === e.f) : null);
  const slotsOf = (e) => (customOf(e) || {}).pos || FORMATIONS[e.f] || FORMATIONS['4-3-3'];
  const parseLines = (s) => {
    const p = String(s || '').trim().split(/[^0-9]+/).filter(Boolean).map(Number);
    return p.length >= 2 && p.length <= 5 && p.every((x) => x >= 1 && x <= 6) && p.reduce((a, b) => a + b, 0) === 10 ? p : null;
  };
  function buildFormation(lines) {
    const n = lines.length;
    const pos = [['TW', 50, 89, 'Torwart']];
    lines.forEach((m, k) => {
      const y = Math.round(74 - k * (58 / (n - 1)));
      const gap = m > 1 ? Math.min(24, 72 / (m - 1)) : 0;
      for (let i = 0; i < m; i += 1) {
        const x = Math.round(50 + (i - (m - 1) / 2) * gap);
        const edge = m >= 4 && (i === 0 || i === m - 1);
        if (k === 0) pos.push([edge ? (i === 0 ? 'LV' : 'RV') : 'IV', x, y, 'Abwehr']);
        else if (k === n - 1) pos.push([m >= 3 && (i === 0 || i === m - 1) ? (i === 0 ? 'LA' : 'RA') : 'ST', x, y, 'Sturm']);
        else pos.push([edge ? (i === 0 ? 'LM' : 'RM') : n >= 4 && k === 1 ? 'DM' : n >= 4 && k === n - 2 && m <= 3 ? 'ZOM' : 'ZM', x, y, 'Mittelfeld']);
      }
    });
    return pos;
  }
  function vElf() {
    const e = elf();
    const slots = slotsOf(e);
    const cust = customOf(e);
    const editing = !!(S.elfEdit && cust);
    const pros = team('profis').players || [];
    const chosen = Object.values(e.s).map((id) => pros.find((p) => p.id === id)).filter(Boolean);
    const goals = chosen.reduce((s, p) => s + ((statsOf('profis', p.id) || {}).goals || 0), 0);
    const age = chosen.length ? (chosen.reduce((s, p) => s + (p.age || 0), 0) / chosen.length).toFixed(1).replace('.', ',') : '–';
    let out = pageHead('Meine <em>Elf</em>', editing ? 'Ziehe die Positionen an ihren Platz' : 'Tippe auf eine Position', '', '#/mehr');
    out += `<div class="chips" role="group" aria-label="Formation">${Object.keys(FORMATIONS).map((f) => `<button type="button" class="${f === e.f ? 'on' : ''}" aria-pressed="${f === e.f}" data-action="formation" data-val="${f}">${f}</button>`).join('')}
      ${(e.custom || []).map((c) => `<button type="button" class="${'c:' + c.id === e.f ? 'on' : ''}" aria-pressed="${'c:' + c.id === e.f}" data-action="formation" data-val="c:${esc(c.id)}">★ ${esc(c.name)}</button>`).join('')}
      <button type="button" data-action="elf-new">+ Eigene</button></div>`;
    out += `<div class="elf-tools">${cust ? `<button type="button" class="btn ghost sm" data-action="elf-edit">${editing ? `${I.check} Fertig` : 'Positionen verschieben'}</button><button type="button" class="btn ghost sm" data-action="elf-del">Formation löschen</button>`
      : '<button type="button" class="btn ghost sm" data-action="elf-adapt">Diese Formation anpassen</button>'}</div>`;
    out += `<div class="pitch ${editing ? 'editing' : ''}" style="margin-top:12px">
      <svg class="pitch-lines" viewBox="0 0 68 94" preserveAspectRatio="none" aria-hidden="true" fill="none" stroke="rgba(253,225,0,.35)" stroke-width=".4">
        <rect x="2" y="2" width="64" height="90" rx="1.5"/><path d="M2 47h64"/><circle cx="34" cy="47" r="8"/><circle cx="34" cy="47" r=".7" fill="rgba(253,225,0,.5)"/><rect x="16" y="2" width="36" height="14"/><rect x="25" y="2" width="18" height="5"/><rect x="16" y="78" width="36" height="14"/><rect x="25" y="87" width="18" height="5"/>
      </svg>
      ${slots.map(([pos, x, y], i) => { const p = pros.find((pp) => pp.id === e.s[i]); return `<button type="button" class="slot ${p ? 'filled' : ''}" style="left:${x}%;top:${y}%" data-action="slot" data-i="${i}" aria-label="${p ? esc(p.name) + ' als ' : 'Position '}${pos}">
        <span class="sl-c">${p ? img(pimg(p.img, 'medium'), '', p.name, initials(p.name)) : I.plus}</span><span class="sl-n">${p ? esc(lastName(p.name)) : pos}</span></button>`; }).join('')}
    </div>`;
    out += `<div class="grid3" style="margin-top:12px"><div class="stat-box"><b>${chosen.length}/11</b><span>Spieler</span></div><div class="stat-box"><b class="yellow">${goals}</b><span>Saisontore</span></div><div class="stat-box"><b>${age}</b><span>Ø Alter</span></div></div>`;
    out += '<button type="button" class="btn ghost" style="margin-top:12px" data-action="elf-reset">Aufstellung leeren</button>';
    return out;
  }
  function openElfNew() {
    openSheet(`<h2 class="display" style="font-size:30px;text-transform:uppercase;margin-bottom:2px">Eigene Formation</h2>
      <p class="muted" style="font-size:12px;margin-bottom:12px;font-weight:600;line-height:1.5">Reihen von hinten nach vorne – zusammen 10 Feldspieler, der Torwart kommt automatisch dazu.</p>
      <label class="sr" for="elf-lines">Formation</label><input id="elf-lines" class="search" inputmode="numeric" placeholder="z. B. 3-2-4-1" autocomplete="off" data-action="elf-lines">
      <p id="elf-hint" class="faint" style="font-size:12px;margin-top:8px;font-weight:600">2 bis 5 Reihen mit je 1 bis 6 Spielern</p>
      <button type="button" class="btn" style="margin-top:14px" data-action="elf-create">Formation erstellen</button>
      <p class="faint" style="font-size:11px;margin-top:10px;font-weight:600;line-height:1.5">Danach kannst du jede Position auf dem Platz frei verschieben.</p>`);
    setTimeout(() => { const i = $('#elf-lines'); if (i) i.focus(); }, 300);
  }
  function elfHint(v) {
    const p = String(v || '').trim().split(/[^0-9]+/).filter(Boolean).map(Number);
    const sum = p.reduce((a, b) => a + b, 0);
    if (!p.length) return '2 bis 5 Reihen mit je 1 bis 6 Spielern';
    if (parseLines(v)) return `Passt: ${p[0]} in der Abwehr, ${p[p.length - 1]} im Sturm`;
    if (sum !== 10) return sum < 10 ? `Noch ${10 - sum} Spieler zu wenig (10 Feldspieler)` : `${sum - 10} Spieler zu viel (10 Feldspieler)`;
    return '2 bis 5 Reihen mit je 1 bis 6 Spielern';
  }
  // Ziehen der Positionen im Bearbeiten-Modus (Finger oder Maus)
  function elfAfter(v) {
    const pitch = $('.pitch.editing', v);
    if (!pitch) return;
    let drag = null;
    pitch.addEventListener('pointerdown', (ev) => {
      const b = ev.target.closest('.slot');
      if (!b) return;
      ev.preventDefault();
      drag = b;
      b.setPointerCapture(ev.pointerId);
      b.classList.add('drag');
    });
    pitch.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const r = pitch.getBoundingClientRect();
      drag.style.left = Math.max(7, Math.min(93, (ev.clientX - r.left) / r.width * 100)).toFixed(1) + '%';
      drag.style.top = Math.max(5, Math.min(95, (ev.clientY - r.top) / r.height * 100)).toFixed(1) + '%';
    });
    const end = () => {
      if (!drag) return;
      const e = elf();
      const c = customOf(e);
      const i = +drag.dataset.i;
      if (c && c.pos[i]) {
        c.pos[i][1] = Math.round(parseFloat(drag.style.left));
        c.pos[i][2] = Math.round(parseFloat(drag.style.top));
        store.set('elf', e);
      }
      drag.classList.remove('drag');
      drag = null;
    };
    pitch.addEventListener('pointerup', end);
    pitch.addEventListener('pointercancel', end);
  }
  function openSlot(i) {
    const e = elf();
    if (S.elfEdit && customOf(e)) return;
    const slots = slotsOf(e);
    const [pos, , , grp] = slots[i];
    const taken = new Set(Object.entries(e.s).filter(([k]) => +k !== i).map(([, v]) => v));
    const apps = (p) => (statsOf('profis', p.id) || {}).apps || 0;
    const pros = [...(team('profis').players || [])].sort((a, b) => ((b.group === grp) - (a.group === grp)) || (apps(b) - apps(a)));
    openSheet(`<h2 class="display" style="font-size:30px;text-transform:uppercase;margin-bottom:2px">${pos} wählen</h2><p class="muted" style="font-size:12px;margin-bottom:10px;font-weight:600">Passende Spieler zuerst</p>
      <div class="list">${e.s[i] ? `<button type="button" class="li" data-action="pick" data-i="${i}" data-id=""><span class="fb avatar sm">×</span><span class="grow t">Position leeren</span></button>` : ''}
      ${pros.map((p) => `<button type="button" class="li" data-action="pick" data-i="${i}" data-id="${p.id}" ${taken.has(p.id) ? 'disabled style="opacity:.35"' : ''}>
        ${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}<span class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.position || UNK)}${p.group === grp ? ' · <span class="yellow">passt</span>' : ''}</div></span><span class="v">${apps(p)} Sp.</span></button>`).join('')}</div>`);
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
    // Wer schon bei den Profis spielt, steht oben (nach Einsaetzen und Toren) - danach BVB II und U19 (ohne Zahlen, juengste zuerst)
    const sOf = (p) => statsOf(p.team, p.id) || {};
    const lvl = { profis: 2, u23: 1, u19: 0 };
    list.sort((a, b) => (lvl[b.team] - lvl[a.team]) || ((sOf(b).apps || 0) - (sOf(a).apps || 0)) || ((sOf(b).goals || 0) - (sOf(a).goals || 0)) || (a.age - b.age));
    const mx = Math.max(1, ...list.map((p) => sOf(p).apps || 0));
    const line = (p) => { if (p.team !== 'profis') return ''; const s = sOf(p); return `${s.apps || 0} Sp. · ${s.goals || 0} T. · ${s.assists || 0} V.`; };
    let out = pageHead('Talente-<em>Radar</em>', 'Alle Spieler bis 21 Jahre · Profis nach Einsätzen', '', '#/mehr');
    if (list.length >= 3) {
      out += `<div class="pgrid" style="grid-template-columns:repeat(3,minmax(0,1fr))">${list.slice(0, 3).map((p) => `<a class="pc" href="#/spieler/${p.team}/${p.id}" data-vt="player"><span class="pc-media" style="height:120px">${img(pimg(p.img, 'big'), '', p.name, initials(p.name), 'style="height:116px"')}</span><span class="pc-body"><span class="pc-name" style="font-size:15px">${esc(lastName(p.name))}</span><span class="pc-pos">${p.age} J. · ${esc(TEAMNAME[p.team])}</span><span class="pc-val" style="font-size:13px">${esc(line(p))}</span></span></a>`).join('')}</div>`;
    }
    out += `<div class="card flat" style="margin-top:14px"><div class="list">${list.slice(0, 30).map((p, i) => `<a class="li" href="#/spieler/${p.team}/${p.id}"><span class="rank">${i + 1}</span>${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}
      <span class="grow" style="display:flex;flex-direction:column;gap:5px"><span class="row" style="justify-content:space-between;gap:8px"><span class="t ellipsis">${esc(p.name)}</span><span class="v">${esc(line(p))}</span></span>
      <span class="s">${p.age || UNK} J. · ${esc(p.position || UNK)} · ${esc(TEAMNAME[p.team])}</span>${p.team === 'profis' ? `<span class="bar"><span style="width:${Math.max(2, (sOf(p).apps || 0) / mx * 100).toFixed(0)}%;animation-delay:${Math.min(i, 14) * 0.04}s"></span></span>` : ''}</span></a>`).join('') || '<p class="muted" style="padding:12px 0">Keine Daten.</p>'}</div></div>`;
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
    const row = (r) => `<a class="li" href="#/spieler/${r.p.team}/${r.p.id}">${img(pimg(r.p.img, 'medium'), 'avatar sm', r.p.name, initials(r.p.name))}<span class="grow"><div class="t ellipsis">${esc(r.p.name)} <span class="faint" style="font-size:11px;font-weight:600">${esc(TEAMNAME[r.p.team])}</span></div><div class="s">${esc(r.a.text)}</div></span></a>`;
    let out = pageHead('Laza<em>rett</em>', 'FotMob + Gemini-News + Transfermarkt', '', '#/mehr');
    out += `<div class="grid3"><div class="stat-box"><b class="red">${inj.length}</b><span>Verletzt</span></div><div class="stat-box"><b class="amber">${sus.length}</b><span>Gesperrt</span></div><div class="stat-box"><b class="green">${news.filter((n) => n.status === 'back' || n.status === 'fit').length}</b><span>Rückkehrer</span></div></div>`;
    if (news.length) out += `<section class="sec"><div class="sec-h"><h2>KI-News</h2><span class="note">via Gemini</span></div><div style="display:flex;flex-direction:column;gap:8px">${news.slice(0, 12).map((n) => `<div class="note-box"><span class="chip sm ${n.status === 'fit' || n.status === 'back' ? 'ok' : n.status === 'doubtful' ? 'warn' : 'loss'}">${esc({ injured: 'Fällt aus', doubtful: 'Fraglich', back: 'Training', fit: 'Fit' }[n.status] || '')}</span><span><b>${esc(n.player)}</b> ${esc(n.text || '')}${n.expectedReturn ? ` · Rückkehr: ${esc(n.expectedReturn)}` : ''}<div class="faint" style="font-size:11px;margin-top:3px;font-weight:600">${esc(n.source || '')} · ${esc(fmtDate(n.date))}</div></span></div>`).join('')}</div></section>`;
    out += `<section class="sec"><div class="sec-h"><h2>Verletzt</h2></div><div class="card flat"><div class="list">${inj.map(row).join('') || '<p class="green" style="padding:12px 0;font-size:13px">Keine Verletzten gemeldet.</p>'}</div></div></section>`;
    out += `<section class="sec"><div class="sec-h"><h2>Gesperrt / fehlt</h2></div><div class="card flat"><div class="list">${sus.map(row).join('') || '<p class="muted" style="padding:12px 0;font-size:13px">Niemand gesperrt.</p>'}</div></div></section>`;
    if (inel.length) out += `<section class="sec"><div class="sec-h"><h2>Nicht spielberechtigt</h2></div><div class="card flat"><div class="list">${inel.map(row).join('')}</div></div></section>`;
    return out;
  }
  function vErfolge() {
    const titles = (D.squads || {}).titles || [];
    const totalT = titles.reduce((s, t) => s + (t.count || 0), 0);
    const hist = historyItem();
    const y = new Date().getFullYear();
    let out = pageHead('Erfol<em>ge</em>', totalT ? `${totalT} große Titel` : 'Titel & große Momente', '', '#/mehr');
    if (titles.length) out += `<div class="grid2 stagger">${titles.map((t) => `<div class="card title-tile">${img(t.img, '', t.title, '')}<span><b>${t.count}×</b><div class="muted" style="font-size:12px;line-height:1.3;font-weight:600">${esc(t.title)}</div></span></div>`).join('')}</div>`;
    if (hist && hist.today) out += `<section class="card-y stripes" style="margin-top:12px"><span class="eyebrow">Heute vor ${hist.years} Jahren</span><b style="font-size:17px;display:block;margin-top:6px">${esc(hist.h[2])}</b></section>`;
    out += `<section class="sec"><div class="sec-h"><h2>Große Momente</h2></div><div class="card flat"><div class="list">
      ${[...HISTORY].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0])).map((h) => `<div class="li"><span class="num yellow" style="font-size:24px;width:52px;flex:none">${h[1]}</span><span class="grow"><div class="t" style="font-size:13px">${esc(h[2])}</div><div class="s">${h[0].slice(3)}.${h[0].slice(0, 2)}.${h[1]} · vor ${y - h[1]} Jahren</div></span></div>`).join('')}
    </div></div></section>`;
    return out;
  }
  function vInstall() {
    const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    let out = pageHead('Instal<em>lieren</em>', 'BVB 09 auf deinen Home-Bildschirm', '', '#/mehr');
    if (standalone) out += `<div class="note-box" style="margin-bottom:12px">${I.ok}<span><b>Läuft bereits als App.</b> Du hast BVB 09 schon auf dem Home-Bildschirm.</span></div>`;
    out += `<section class="card"><div class="steps">
      <div class="step"><span>Öffne diese Seite in <b>Safari</b> auf deinem iPhone.</span></div>
      <div class="step"><span>Tippe unten auf <b>Teilen</b> ${I.share.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px;stroke:var(--y)"')}</span></div>
      <div class="step"><span>Wähle <b>„Zum Home-Bildschirm“</b>. Eventuell musst du etwas nach unten scrollen.</span></div>
      <div class="step"><span>Tippe auf <b>„Hinzufügen“</b>. Fertig!</span></div>
    </div></section><p class="muted" style="font-size:12px;margin-top:12px;line-height:1.55">Die App öffnet sich dann im Vollbild wie eine normale App, ohne App Store und komplett kostenlos.</p>`;
    return out;
  }
  function vInfo() {
    return pageHead('Über die <em>App</em>', 'Quellen & Hinweise', '', '#/mehr') + `<section class="card" style="display:flex;flex-direction:column;gap:12px;font-size:13px;line-height:1.6">
      <p><b>BVB 09</b> ist eine inoffizielle Fan-App und nicht mit Borussia Dortmund verbunden. Namen, Wappen und Fotos gehören den jeweiligen Rechteinhabern.</p>
      <p><b>So bleibt alles aktuell:</b> Jeden Tag um 8:17, 14:17 und 20:17 Uhr läuft ein Programm auf GitHub. Es holt Spiele und die Bundesliga-Tabelle von OpenLigaDB, die Champions-League-Tabelle, Statistiken und den offiziellen Kader (Rückennummern, Zu- und Abgänge) von ESPN und Schlagzeilen über Google News. Die kostenlose <b>Gemini-KI</b> macht daraus Here-we-go-Karten, Verletzungs-News, Vertragsverlängerungen und das KI-Briefing. Statistiken kommen von ESPN, Tore zählt die App live aus den Spielberichten. Marktwerte gibt es direkt bei Transfermarkt (Transfers → TM).</p>
      <p><b>Spieltag-Zentrale:</b> Vor jedem Spiel schreibt Gemini einen Vorbericht mit KI-Tipp, nach dem Spiel einen Spielbericht. Offizielle Aufstellung, Live-Ticker und Statistik kommen während des Spiels direkt von ESPN. An Spieltagen läuft das Update zusätzlich stündlich. Dein Tippspiel wird nur auf deinem Handy gespeichert.</p>
      <p><b>Prognosen &amp; KI-Tipp</b> rechnet die App selbst – ganz ohne KI: Spielstärken (Angriff, Abwehr, Heimvorteil) aus Wettquoten und den Ergebnissen dieser und der letzten Saison, dann 15.000 simulierte Saisonverläufe. Die Champions League läuft mit allen Regeln: Ligaphase, Playoffs, Turnierbaum, Hin- und Rückspiel, Verlängerung und Elfmeterschießen – gespielte Hinspiele zählen mit. Nach jedem Bundesliga- und CL-Spiel wird neu gerechnet. Der KI-Tipp ist das Ergebnis mit den meisten erwarteten Tipp-Punkten.</p>
      <p><b>Konferenz:</b> alle Spiele des Spieltags live mit Live-Tabelle.</p>
      <p><b>Wetter &amp; Videos:</b> Das Wetter zum Anpfiff kommt von Open-Meteo (Stadion über OpenStreetMap), Highlights und Pressekonferenzen vom offiziellen YouTube-Kanal des BVB.</p>
      <p><b>Deine Einstellungen</b> (Name, Lieblingsspieler, Startseite, Tipps) bleiben nur auf deinem Handy gespeichert.</p>
      <p><b>Transfermarkt</b> sperrt Server mit einem Bot-Schutz. Positionen, Verträge sowie Kader und Statistiken von BVB II und U19 stammen daher vom letzten direkten Abruf; Verlängerungen und Wechsel ergänzt die KI aus den News.</p>
      <p><b>Gerüchte-Ampel:</b> grün = sehr verlässlich (z. B. Fabrizio Romano, Sky, kicker, Ruhr Nachrichten), gelb = meist verlässlich (z. B. Bild, Sport1, Transfermarkt). Alles andere wird gar nicht angezeigt.</p>
      <p class="faint">Alle Angaben ohne Gewähr. KI-Zusammenfassungen können Fehler enthalten.</p>
    </section><a class="btn ghost" style="margin-top:12px" href="https://github.com/${REPO}" target="_blank" rel="noopener">${I.github} Projekt auf GitHub</a>`;
  }

  // ------------------------------------------------------------------ Bundesliga-Konferenz (live, direkt von OpenLigaDB)
  const KONF = { data: null, at: 0, md: 0 };
  async function loadKonferenz(force) {
    const md = ((D.season || {}).konferenz || {}).matchday;
    if (!md) return null;
    if (!force && KONF.data && KONF.md === md && Date.now() - KONF.at < 25000) return KONF.data;
    try {
      const season = (D.season || {}).season || (D.matches || {}).season;
      const r = await fetch(`https://api.openligadb.de/getmatchdata/bl1/${season}/${md}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      KONF.data = await r.json();
      KONF.at = Date.now();
      KONF.md = md;
    } catch (e) { /* offline: alte Daten behalten */ }
    return KONF.data;
  }
  function konfGames(raw) {
    return (raw || []).map((m) => {
      let score = null;
      const fr = (m.matchResults || []).find((r) => r.resultTypeID === 2);
      if (fr) score = [fr.pointsTeam1, fr.pointsTeam2];
      else if ((m.goals || []).length) {
        const g = [...m.goals].sort((a, b) => (a.matchMinute || 0) - (b.matchMinute || 0) || (a.goalID || 0) - (b.goalID || 0)).pop();
        score = [g.scoreTeam1 || 0, g.scoreTeam2 || 0];
      }
      const t = Date.parse(m.matchDateTimeUTC || m.matchDateTime);
      const live = !m.matchIsFinished && t <= Date.now() && Date.now() - t < 150 * 60e3;
      if (live && !score) score = [0, 0];
      return { id: m.matchID, t, fin: !!m.matchIsFinished, live, score,
        home: { id: String(m.team1.teamId), name: m.team1.teamName, short: m.team1.shortName, icon: m.team1.teamIconUrl },
        away: { id: String(m.team2.teamId), name: m.team2.teamName, short: m.team2.shortName, icon: m.team2.teamIconUrl } };
    }).sort((a, b) => a.t - b.t || a.id - b.id);
  }
  const cmpRows = (a, b) => (b.points - a.points) || ((b.goals - b.against) - (a.goals - a.against)) || (b.goals - a.goals) || String(a.team).localeCompare(String(b.team));
  function liveTable(games) {
    const base = (((D.season || {}).konferenz || {}).base || []).map((r) => Object.assign({}, r));
    const by = Object.fromEntries(base.map((r) => [r.id, r]));
    const before = Object.fromEntries([...base].sort(cmpRows).map((r, i) => [r.id, i + 1]));
    for (const g of games) {
      if (!g.score || !(g.fin || g.live)) continue;
      const a = by[g.home.id];
      const b = by[g.away.id];
      if (!a || !b) continue;
      const [x, y] = g.score;
      a.played += 1; b.played += 1;
      a.goals += x; a.against += y; b.goals += y; b.against += x;
      if (x > y) { a.points += 3; a.won += 1; b.lost += 1; } else if (x < y) { b.points += 3; b.won += 1; a.lost += 1; } else { a.points += 1; b.points += 1; a.draw += 1; b.draw += 1; }
      if (g.live) { a.liveNow = true; b.liveNow = true; }
    }
    const rows = base.sort(cmpRows);
    rows.forEach((r, i) => { r.pos = i + 1; r.diff = r.goals - r.against; r.move = (before[r.id] || r.pos) - r.pos; r.isBVB = isBVBName(r.team); });
    return rows;
  }
  function konfHtml(raw) {
    const md = ((D.season || {}).konferenz || {}).matchday;
    if (!md) return '<div class="empty" style="margin-top:14px">Die Konferenz ist bald verfügbar.</div>';
    if (!raw) return '<div class="skel" style="height:120px;margin-top:14px"></div><div class="skel" style="height:420px;margin-top:12px"></div>';
    const games = konfGames(raw);
    const rows = liveTable(games);
    const me = rows.find((r) => r.isBVB);
    const live = games.some((g) => g.live);
    let out = me ? `<section class="konf-hero ${live ? 'live' : ''}"><span class="eyebrow">${live ? 'Live-Tabelle' : 'Tabelle mit diesem Spieltag'}</span><b>BVB ${live ? 'wäre jetzt' : 'ist'} ${me.pos}.</b><span>${me.points} Punkte · ${me.goals}:${me.against} Tore${me.move ? ` · ${me.move > 0 ? '▲' : '▼'} ${Math.abs(me.move)} ${Math.abs(me.move) === 1 ? 'Platz' : 'Plätze'}` : ''}</span></section>` : '';
    out += `<section class="sec"><div class="sec-h"><h2>${md}. Spieltag</h2><span class="note">${live ? 'live · alle 30 Sek.' : 'alle Spiele'}</span></div><div class="card flat konf-list">${games.map((g) => `<div class="kg ${g.live ? 'live' : ''} ${isBVBName(g.home.name) || isBVBName(g.away.name) ? 'me' : ''}">
      <span class="kg-t">${g.live ? '<span class="lb-dot" aria-hidden="true"></span>Live' : g.fin ? 'Ende' : esc(F.wd.format(new Date(g.t)).replace('.', '') + ' ' + F.time.format(new Date(g.t)))}</span>
      <span class="kg-team">${crest({ name: g.home.name, icon: g.home.icon }, 'crest xs')}<span class="ellipsis">${esc(g.home.short || g.home.name)}</span></span>
      <b class="kg-s">${g.score ? g.score[0] + ':' + g.score[1] : '–:–'}</b>
      <span class="kg-team r"><span class="ellipsis">${esc(g.away.short || g.away.name)}</span>${crest({ name: g.away.name, icon: g.away.icon }, 'crest xs')}</span></div>`).join('')}</div></section>`;
    out += `<section class="sec"><div class="sec-h"><h2>${live ? 'Live-Tabelle' : 'Tabelle'}</h2><span class="note">inkl. ${md}. Spieltag</span></div><div class="card" style="padding:6px 8px"><table class="table"><thead><tr><th>#</th><th>Verein</th><th>Sp</th><th>TD</th><th>Pkt</th></tr></thead><tbody>${rows.map((r) => `<tr class="${r.isBVB ? 'me' : ''}${r.liveNow ? ' lv' : ''}"><td>${r.pos}${r.move ? `<i class="mv ${r.move > 0 ? 'up' : 'dn'}">${r.move > 0 ? '▲' : '▼'}</i>` : ''}</td><td><span class="tm">${crest({ name: r.team, icon: r.icon }, 'crest xs')}<span>${esc(r.short || r.team)}</span></span></td><td>${r.played}</td><td>${r.diff > 0 ? '+' : ''}${r.diff}</td><td>${r.points}</td></tr>`).join('')}</tbody></table></div></section>`;
    return out;
  }
  function konfAfter(v) {
    clearInterval(S.konfTimer);
    S.konfTimer = null;
    if (!$('#konf', v)) return;
    const load = async () => {
      const raw = await loadKonferenz(true);
      const box = $('#konf');
      if (box && raw) box.innerHTML = konfHtml(raw);
    };
    load();
    S.konfTimer = setInterval(() => { if (konfGames(KONF.data).some((g) => g.live || (g.t - Date.now() < 15 * 60e3 && !g.fin && Date.now() - g.t < 150 * 60e3))) load(); }, 30000);
  }

  // ------------------------------------------------------------------ Champions League: alle Spiele und K.-o.-Runde
  const CL_ROUND = { 'league-phase': 'Ligaphase', 'knockout-round-playoffs': 'Playoffs', 'round-of-16': 'Achtelfinale', quarterfinals: 'Viertelfinale', semifinals: 'Halbfinale', final: 'Finale' };
  const CL_RSHORT = { 'knockout-round-playoffs': 'Playoffs', 'round-of-16': 'Achtelfinale', quarterfinals: 'Viertelfinale', semifinals: 'Halbfinale', final: 'Finale' };
  const CL_KO = ['knockout-round-playoffs', 'round-of-16', 'quarterfinals', 'semifinals', 'final'];
  const CLL = { at: 0, data: {} }; // Live-Stände von ESPN, haben Vorrang vor den Server-Daten
  const clTeam = (id) => (((D.cl || {}).teams || {})[id]) || { name: '?', short: '?' };
  function clGame(g) {
    const lv = CLL.data[g.id] || {};
    const live = lv.state === 'in' || lv.state === 'post';
    return { state: lv.state || g.state, hs: live ? lv.hs : g.hs, as: live ? lv.as : g.as, clock: lv.clock, winner: lv.winner || g.winner };
  }
  function clGroups() {
    const groups = [];
    for (const g of (D.cl || {}).games || []) {
      const lp = g.round === 'league-phase';
      const key = lp ? 'md' + g.md : g.round;
      let gr = groups.find((x) => x.key === key);
      if (!gr) {
        gr = { key, label: lp ? `${g.md}. Spieltag` : CL_ROUND[g.round] || g.round, short: lp ? `${g.md}. Spieltag` : CL_RSHORT[g.round] || g.round, games: [] };
        groups.push(gr);
      }
      gr.games.push(g);
    }
    return groups;
  }
  function clSelected(groups) {
    return groups.find((g) => g.key === UI.clGroup) || groups.find((g) => g.games.some((x) => clGame(x).state !== 'post')) || groups[groups.length - 1];
  }
  // Hin- und Rückspiel eines K.-o.-Duells
  const clLegs = (g) => ((D.cl || {}).games || []).filter((x) => x.round === g.round && [x.h, x.a].sort().join() === [g.h, g.a].sort().join())
    .sort((x, y) => (x.leg || 0) - (y.leg || 0) || String(x.date).localeCompare(String(y.date)));
  function clRow(g) {
    const s = clGame(g);
    const h = clTeam(g.h);
    const a = clTeam(g.a);
    const live = s.state === 'in';
    const fin = s.state === 'post';
    const mid = live || fin ? `<b>${s.hs != null ? s.hs : 0}:${s.as != null ? s.as : 0}</b>${live ? `<span class="clg-live">${esc(s.clock || 'live')}</span>` : ''}`
      : `<b class="clg-time">${esc(F.time.format(new Date(g.date)))}</b>`;
    let sub = '';
    if (g.round !== 'league-phase') {
      const legs = clLegs(g);
      const i = legs.indexOf(g);
      if (g.round === 'final') sub = 'Finale';
      else if (i === 1) {
        const f = clGame(legs[0]);
        sub = f.state === 'post' ? `Rückspiel · Hinspiel ${esc(clTeam(legs[0].h).short)} ${f.hs}:${f.as}` : 'Rückspiel';
      } else sub = 'Hinspiel';
    }
    const me = isBVBName(h.name) || isBVBName(a.name);
    const lostH = fin && s.winner && s.winner !== g.h;
    const lostA = fin && s.winner && s.winner !== g.a;
    return `<div class="clg ${me ? 'me' : ''} ${live ? 'live' : ''}"><div class="clg-row"><span class="clg-t h ${lostH ? 'lost' : ''}"><span class="ellipsis">${esc(h.short || h.name)}</span>${crest({ name: h.name, icon: h.logo }, 'crest xs')}</span><span class="clg-s">${mid}</span><span class="clg-t a ${lostA ? 'lost' : ''}">${crest({ name: a.name, icon: a.logo }, 'crest xs')}<span class="ellipsis">${esc(a.short || a.name)}</span></span></div>${sub ? `<div class="clg-sub">${sub}</div>` : ''}</div>`;
  }
  function clGamesHtml() {
    const sel = clSelected(clGroups());
    if (!sel) return '';
    const days = [];
    for (const g of [...sel.games].sort((x, y) => String(x.date).localeCompare(String(y.date)))) {
      const d = berlinYMD(g.date);
      let day = days.find((x) => x.d === d);
      if (!day) { day = { d, at: g.date, games: [] }; days.push(day); }
      day.games.push(g);
    }
    return days.map((day) => `<section class="cl-day"><div class="eyebrow">${esc(dayLabel(day.at))}</div><div class="card flat">${day.games.map(clRow).join('')}</div></section>`).join('');
  }
  function clGamesView() {
    const groups = clGroups();
    if (!groups.length) return '<div class="empty" style="margin-top:14px">Die Champions-League-Spiele kommen mit dem nächsten Update.</div>';
    const sel = clSelected(groups);
    return `<div class="chips cl-md" style="margin-top:14px" role="group" aria-label="Spieltag">${groups.map((g) => `<button type="button" class="${g === sel ? 'on' : ''}" aria-pressed="${g === sel}" data-action="clgroup" data-val="${g.key}">${esc(g.short)}</button>`).join('')}</div>
      <div id="clgames">${clGamesHtml()}</div>`;
  }
  // K.-o.-Runde: echte Duelle aus den Daten; in der Ligaphase "Stand jetzt" nach der festen Setzliste (seit 2024/25)
  function koTie(r, legs) {
    const A = legs[0].h;
    const B = legs[0].a;
    let ga = 0;
    let gb = 0;
    let played = 0;
    let live = false;
    for (const g of legs) {
      const s = clGame(g);
      if (s.state !== 'post' && s.state !== 'in') continue;
      played += 1;
      if (s.state === 'in') live = true;
      const x = s.hs || 0;
      const y = s.as || 0;
      if (g.h === A) { ga += x; gb += y; } else { ga += y; gb += x; }
    }
    const done = legs.every((g) => clGame(g).state === 'post') && (r === 'final' || legs.length >= 2);
    const win = done ? (ga > gb ? A : gb > ga ? B : clGame(legs[legs.length - 1]).winner || null) : null;
    const adv = ((D.cl || {}).advance || {})[r] || {};
    const team = (id, goals) => {
      const t = clTeam(id);
      return `<div class="ko-team ${win && win !== id ? 'lost' : ''} ${isBVBName(t.name) ? 'me' : ''}">${crest({ name: t.name, icon: t.logo }, 'crest sm')}<span class="grow ellipsis">${esc(t.name)}</span>${!done && adv[id] != null ? `<span class="ko-p">${esc(pctTxt(adv[id]))}</span>` : ''}${played ? `<b>${goals}</b>` : ''}</div>`;
    };
    const info = legs.map((g, i) => {
      const s = clGame(g);
      const lbl = r === 'final' ? 'Finale' : i === 0 ? 'Hinspiel' : 'Rückspiel';
      const res = s.state === 'post' || s.state === 'in' ? `${esc(clTeam(g.h).short)} ${s.hs}:${s.as} ${esc(clTeam(g.a).short)}${s.state === 'in' ? ' · live' : ''}`
        : `${esc(F.dayShort.format(new Date(g.date)))}, ${esc(F.time.format(new Date(g.date)))} Uhr`;
      return `<span><b>${lbl}</b> ${res}</span>`;
    }).join('') + (win && ga === gb ? `<span><b>${r === 'final' ? 'Sieger' : 'Weiter'}:</b> ${esc(clTeam(win).short)} nach Verlängerung/Elfmeterschießen</span>` : '');
    return `<div class="card ko-tie ${live ? 'live' : ''}">${team(A, ga)}${team(B, gb)}<div class="ko-legs">${info}</div></div>`;
  }
  function clKoHtml() {
    const games = (D.cl || {}).games || [];
    const rounds = CL_KO.filter((r) => games.some((g) => g.round === r));
    if (!rounds.length) return clKoPreview();
    let out = '';
    for (const r of rounds) {
      const ties = [];
      for (const g of games.filter((x) => x.round === r)) {
        const legs = clLegs(g);
        if (!ties.some((t) => t[0] === legs[0])) ties.push(legs);
      }
      out += `<section class="sec"><div class="sec-h"><h2>${CL_ROUND[r]}</h2><span class="note">${r === 'final' ? 'ein Spiel' : `${ties.length} Duelle`}${r !== 'final' ? ' · Chance weiterzukommen' : ''}</span></div><div class="ko-list">${ties.map((l) => koTie(r, l)).join('')}</div></section>`;
    }
    const next = CL_KO[CL_KO.indexOf(rounds[rounds.length - 1]) + 1];
    if (next) out += `<div class="note-box" style="margin-top:14px">${I.info}<span>${CL_ROUND[next]}: Die Paarungen stehen fest, sobald die Runde davor gespielt ist.</span></div>`;
    return out;
  }
  function clKoPreview() {
    const rows = (((D.tables || {}).ucl || {}).rows || []).slice().sort((a, b) => a.pos - b.pos);
    if (rows.length < 24) return '<div class="empty" style="margin-top:14px">Die K.-o.-Runde startet nach der Ligaphase.</div>';
    const by = Object.fromEntries(rows.map((r) => [r.pos, r]));
    const fc = Object.fromEntries((((D.season || {}).cl || {}).teams || []).map((t) => [t.espnId, t]));
    const line = (r, key) => {
      const t = fc[String(r.id).replace('espn-', '')];
      return `<div class="ko-team ${r.isBVB ? 'me' : ''}"><span class="ko-pos">${r.pos}</span>${crest({ name: r.team, icon: r.icon }, 'crest sm')}<span class="grow ellipsis">${esc(r.team)}</span>${t && t[key] != null ? `<span class="ko-p">${esc(pctTxt(t[key]))}</span>` : ''}</div>`;
    };
    const PO = [[[9, 10], [23, 24]], [[11, 12], [21, 22]], [[13, 14], [19, 20]], [[15, 16], [17, 18]]];
    let out = `<div class="note-box" style="margin-top:14px">${I.info}<span><b>Stand jetzt:</b> So sähe die K.-o.-Runde aus, wenn die Ligaphase heute enden würde. Die Prozente sind die Chancen laut Prognose.</span></div>`;
    out += `<section class="sec"><div class="sec-h"><h2>Direkt im Achtelfinale</h2><span class="note">Platz 1–8 · Chance auf Top 8</span></div><div class="card flat ko-flat">${[1, 2, 3, 4, 5, 6, 7, 8].map((p) => line(by[p], 'top8')).join('')}</div></section>`;
    out += `<section class="sec"><div class="sec-h"><h2>Playoffs</h2><span class="note">Platz 9–24 · Chance auf Top 24</span></div><div class="ko-list">${PO.map(([s, u]) => `<div class="card ko-tie"><span class="eyebrow">Gesetzt · Rückspiel zu Hause</span>${s.map((p) => line(by[p], 'top24')).join('')}<div class="ko-vs">gegen</div>${u.map((p) => line(by[p], 'top24')).join('')}</div>`).join('')}</div></section>`;
    out += `<section class="sec"><div class="sec-h"><h2>Aktuell raus</h2><span class="note">ab Platz 25 · Chance auf Top 24</span></div><div class="card flat ko-flat">${rows.filter((r) => r.pos >= 25).map((r) => line(r, 'top24')).join('')}</div></section>`;
    out += `<p class="faint" style="font-size:11px;font-weight:600;line-height:1.6;margin-top:12px">Achtelfinale nach fester Setzliste: Platz 1/2 trifft auf den Sieger aus 15/16 gegen 17/18, Platz 3/4 auf 13/14 gegen 19/20, Platz 5/6 auf 11/12 gegen 21/22, Platz 7/8 auf 9/10 gegen 23/24. Das Rückspiel hat immer das besser platzierte Team zu Hause.</p>`;
    return out;
  }
  async function loadClLive() {
    try {
      const r = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      for (const e of j.events || []) {
        const comp = (e.competitions || [])[0] || {};
        const cs = comp.competitors || [];
        const h = cs.find((x) => x.homeAway === 'home') || {};
        const a = cs.find((x) => x.homeAway === 'away') || {};
        const type = ((comp.status || e.status || {}).type) || {};
        CLL.data[String(e.id)] = { state: type.state, hs: h.score != null ? +h.score : null, as: a.score != null ? +a.score : null,
          clock: type.state === 'in' ? type.shortDetail || null : null,
          winner: h.winner ? String((h.team || {}).id) : a.winner ? String((a.team || {}).id) : null };
      }
      CLL.at = Date.now();
    } catch (e) { /* offline: Server-Daten bleiben */ }
  }
  const clHot = () => ((D.cl || {}).games || []).some((g) => { const t = Date.parse(g.date); return clGame(g).state !== 'post' && t - 15 * 60e3 <= Date.now() && Date.now() - t < 150 * 60e3; });
  function clAfter(v) {
    clearInterval(S.clTimer);
    S.clTimer = null;
    const chip = $('.chips.cl-md button.on', v);
    if (chip) chip.parentElement.scrollLeft = chip.offsetLeft - (chip.parentElement.clientWidth - chip.clientWidth) / 2;
    if (!$('#clgames', v) && !$('#clko', v)) return;
    const tick = async () => {
      await loadClLive();
      const g = $('#clgames');
      const k = $('#clko');
      if (g) g.innerHTML = clGamesHtml();
      if (k) k.innerHTML = clKoHtml();
    };
    if (clHot()) tick();
    S.clTimer = setInterval(() => { if (clHot()) tick(); }, 30000);
  }

  // ------------------------------------------------------------------ Saison: Fieberkurve, Prognose, Liga-Torjaeger
  function feverSvg(cur, prev) {
    const W = 340;
    const H = 200;
    const X = (md) => 26 + (md - 1) / 33 * (W - 36);
    const Y = (pos) => 14 + (pos - 1) / 17 * (H - 40);
    const line = (pts) => pts.map((q) => `${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join(' ');
    const last = cur[cur.length - 1];
    return `<svg viewBox="0 0 ${W} ${H}" class="fever" role="img" aria-label="Fieberkurve: Tabellenplatz nach jedem Spieltag">
      <rect x="26" y="${Y(1) - 6}" width="${W - 36}" height="${(Y(4) - Y(1) + 12).toFixed(1)}" rx="6" class="fv-cl"/>
      <rect x="26" y="${(Y(16) - 6).toFixed(1)}" width="${W - 36}" height="${(Y(18) - Y(16) + 12).toFixed(1)}" rx="6" class="fv-down"/>
      ${[1, 4, 6, 10, 15, 18].map((pos) => `<text x="16" y="${(Y(pos) + 3.5).toFixed(1)}" class="fv-ax" text-anchor="end">${pos}</text>`).join('')}
      ${[1, 9, 17, 25, 34].map((md) => `<text x="${X(md).toFixed(1)}" y="${H - 6}" class="fv-ax" text-anchor="middle">${md}</text>`).join('')}
      ${prev.length > 1 ? `<polyline points="${line(prev)}" class="fv-prev"/>` : ''}
      ${cur.length > 1 ? `<polyline points="${line(cur)}" class="fv-cur"/>` : ''}
      ${last ? `<circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="9" class="fv-ping"/><circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="5.5" class="fv-dot"/>` : ''}
    </svg>`;
  }
  const pctTxt = (v) => (v == null ? 'k. A.' : v >= 99.95 ? '100 %' : v > 0 && v < 0.1 ? '<0,1 %' : nf1.format(v) + ' %');
  function tieCard(t) {
    const fin = t.round === 'final';
    const legs = (t.legs || []).map((l, i) => `<div class="tie-leg"><span class="eyebrow">${fin ? 'Finale' : (l.leg === 2 || i === 1) ? 'Rückspiel' : 'Hinspiel'} · ${l.home ? 'Heim' : 'Auswärts'}</span><b>${l.score ? esc(l.score) : esc(F.dm.format(new Date(l.date)))}</b></div>`).join('');
    return `<div class="card tie-card"><div class="row" style="gap:12px">${crest({ name: t.opp.name, icon: t.opp.logo }, 'crest md')}<span class="grow"><span class="eyebrow">${esc(t.label)}</span><div class="tie-opp">gegen ${esc(t.opp.name)}</div></span>
      <span class="tie-p"><b>${esc(pctTxt(t.p))}</b><span>${fin ? 'Titel' : 'weiter'}</span></span></div><div class="tie-legs">${legs}</div></div>`;
  }
  const pctS = (v) => (v == null ? '–' : v >= 99.95 ? '100' : v > 0 && v < 0.5 ? '<1' : nf0.format(v));
  // Titelrennen: BVB gegen einen frei wählbaren Verein (Standard: der stärkste Konkurrent) – mit Erklärung
  function raceCard(fc, me) {
    const others = fc.teams.filter((t) => !t.isBVB);
    const top = [...others].sort((a, b) => (b.title - a.title) || (b.expPoints - a.expPoints))[0];
    const riv = others.find((t) => t.espnId === UI.raceRival) || top;
    if (!riv || me.ppg == null || riv.ppg == null) return '';
    const nm = (t) => esc(t.isBVB ? 'der BVB' : (t.short || t.team));
    const rank = (t) => fc.teams.indexOf(t) + 1;
    const dp = me.points - riv.points;
    const ahead = me.expPoints >= riv.expPoints ? me : riv;
    const behind = ahead === me ? riv : me;
    const gap = Math.round(Math.abs(me.expPoints - riv.expPoints));
    const stand = dp === 0 ? 'Gleich viele Punkte' : dp > 0 ? `${dp} ${dp === 1 ? 'Punkt' : 'Punkte'} Vorsprung für den BVB` : `${-dp} ${dp === -1 ? 'Punkt' : 'Punkte'} Rückstand für den BVB`;
    const flip = (dp > 0 && ahead === riv) || (dp < 0 && ahead === me);
    const verdict = gap < 1 ? 'am Saisonende liegen beide laut Prognose praktisch gleichauf'
      : `${flip ? 'trotzdem ' : ''}landet am Saisonende laut Prognose ${nm(ahead)} vorne – im Schnitt rund ${gap} ${gap === 1 ? 'Punkt' : 'Punkte'}`;
    const goals = Math.abs(me.diff - riv.diff) >= 6 ? ` Das Torverhältnis: ${me.goals}:${me.against} beim BVB, ${riv.goals}:${riv.against} bei ${nm(riv)}.` : '';
    const why = `${stand} – ${verdict}. Für die restlichen Spiele trauen Wettquoten und Ergebnisse dem BVB im Schnitt ${nf2.format(me.ppg)} Punkte pro Spiel zu, ${nm(riv)} ${nf2.format(riv.ppg)}.${goals}`;
    // direktes Duell aus dem Spielplan des BVB
    const duel = matchList('profis').filter((m) => m.comp === 'Bundesliga' && slug(oppOf(m).name || '') === slug(riv.team || ''));
    const duelTxt = duel.map((m) => (m.finished && m.score ? `${m.isHome ? 'Heim' : 'Auswärts'} ${m.isHome ? m.score[0] + ':' + m.score[1] : m.score[1] + ':' + m.score[0]}` : `${m.isHome ? 'Heim' : 'Auswärts'} am ${F.dm.format(new Date(m.date))}`)).join(' · ');
    const rows = [['Punkte', me.points, riv.points, dp], ['Tore', `${me.goals}:${me.against}`, `${riv.goals}:${riv.against}`, me.diff - riv.diff],
      ['Pkt. pro Spiel ab jetzt', nf2.format(me.ppg), nf2.format(riv.ppg), me.ppg - riv.ppg], ['Erwartet am Ende', nf0.format(me.expPoints), nf0.format(riv.expPoints), me.expPoints - riv.expPoints],
      ['Prognose-Platz', rank(me) + '.', rank(riv) + '.', rank(riv) - rank(me)],
      ['Meister-Chance', pctTxt(me.title), pctTxt(riv.title), me.title - riv.title], ['Top-4-Chance', pctTxt(me.cl), pctTxt(riv.cl), me.cl - riv.cl]];
    const picker = `<div class="chips race-pick" role="group" aria-label="Verein zum Vergleichen">${others.map((t) => `<button type="button" class="${t === riv ? 'on' : ''}" aria-pressed="${t === riv}" data-action="race" data-val="${esc(t.espnId)}">${crest({ name: t.team, icon: t.icon }, 'crest xs')}${esc(t.short || t.team)}</button>`).join('')}</div>`;
    return `<section class="sec"><div class="sec-h"><h2>Titelrennen</h2><span class="note">Verein antippen zum Vergleichen</span></div>${picker}<div class="card" style="margin-top:10px">
      <div class="race-head"><span class="rt">${crest({ name: me.team, icon: me.icon }, 'crest sm')}<span class="ellipsis">BVB</span></span><span class="vs">VS</span><span class="rt r"><span class="ellipsis">${esc(riv.short || riv.team)}</span>${crest({ name: riv.team, icon: riv.icon }, 'crest sm')}</span></div>
      ${rows.map(([l, a, b, d]) => `<div class="race-row"><b class="${d > 0 ? 'win' : ''}">${esc(a)}</b><span>${l}</span><b class="r ${d < 0 ? 'win' : ''}">${esc(b)}</b></div>`).join('')}
      ${duelTxt ? `<div class="kv" style="border-top:1px solid var(--hair)"><span>Direktes Duell</span><span>${esc(duelTxt)}</span></div>` : ''}
      <p class="race-why">${why}</p></div></section>`;
  }
  const COMP_LBL = { bl: 'Bundesliga', cl: 'Champions League', dfb: 'DFB-Pokal' };
  function nextGamesCard(list) {
    if (!list.length) return '';
    return `<section class="sec"><div class="sec-h"><h2>Nächste Spiele</h2><span class="note">Sieg · Remis · Niederlage</span></div><div class="card flat"><div class="list">${list.map((g) => `<div class="li">${crest({ name: g.opp, icon: g.logo }, 'crest sm')}
      <span class="grow" style="display:flex;flex-direction:column;gap:6px;min-width:0"><span class="row" style="justify-content:space-between;gap:8px"><span class="t ellipsis">${esc(g.opp)}</span><span class="s" style="margin:0;white-space:nowrap">${g.home ? 'Heim' : 'Auswärts'} · ${esc(F.dm.format(new Date(g.date)))}</span></span>
      <span class="wdl" role="img" aria-label="Sieg ${esc(pctTxt(g.win))}, Remis ${esc(pctTxt(g.draw))}, Niederlage ${esc(pctTxt(g.loss))}"><i class="w" style="flex:${g.win}"></i><i class="d" style="flex:${g.draw}"></i><i class="l" style="flex:${g.loss}"></i></span>
      <span class="wdl-n"><span class="yellow">${nf0.format(g.win)} %</span><span>${esc(COMP_LBL[g.comp] || '')}${g.odds ? ' · Quoten' : ''}</span><span class="red">${nf0.format(g.loss)} %</span></span></span></div>`).join('')}</div></div></section>`;
  }
  function fcTable(fc) {
    const all = !!UI.fcAll;
    const rows = fc.teams;
    const show = all ? rows : rows.filter((t, i) => i < 6 || t.isBVB);
    return `<section class="sec"><div class="sec-h"><h2>Prognose-Tabelle</h2><span class="note">erwarteter Endstand · Chancen in %</span></div>
      <div class="card" style="padding:6px 8px"><table class="table fc-t"><thead><tr><th>#</th><th>Verein</th><th>Pkt</th><th>Erw.</th><th>Meister</th><th>Top 4</th><th>Abst.</th></tr></thead><tbody>
      ${show.map((t) => `<tr class="${t.isBVB ? 'me' : ''}"><td>${rows.indexOf(t) + 1}</td><td><span class="tm">${crest({ name: t.team, icon: t.icon }, 'crest xs')}<span>${esc(t.short || t.team)}</span></span></td><td>${t.points}</td><td>${nf0.format(t.expPoints)}</td><td>${pctS(t.title)}</td><td>${pctS(t.cl)}</td><td>${pctS((t.down || 0) + (t.rel || 0))}</td></tr>`).join('')}
      </tbody></table><button type="button" class="more-btn" data-action="toggle" data-key="fcAll">${all ? 'Weniger anzeigen' : `Alle ${rows.length} Teams anzeigen`}</button></div></section>`;
  }
  function clFavTable(cl) {
    const all = !!UI.clAll;
    const rows = [...cl.teams].sort((a, b) => (b.win - a.win) || (b.final - a.final) || (b.r16 - a.r16));
    const show = all ? rows : rows.filter((t, i) => i < 8 || t.isBVB);
    const lp = !cl.leagueDone;
    return `<section class="sec"><div class="sec-h"><h2>Titel-Favoriten</h2><span class="note">Champions League · Chancen in %</span></div>
      <div class="card" style="padding:6px 8px"><table class="table fc-t"><thead><tr><th>#</th><th>Verein</th>${lp ? '<th>Top 8</th>' : ''}<th>AF</th><th>VF</th><th>HF</th><th>Sieg</th></tr></thead><tbody>
      ${show.map((t) => `<tr class="${t.isBVB ? 'me' : ''}"><td>${rows.indexOf(t) + 1}</td><td><span class="tm">${crest({ name: t.team, icon: t.icon }, 'crest xs')}<span>${esc(t.team)}</span></span></td>${lp ? `<td>${pctS(t.top8)}</td>` : ''}<td>${pctS(t.r16)}</td><td>${pctS(t.qf)}</td><td>${pctS(t.sf)}</td><td>${pctS(t.win)}</td></tr>`).join('')}
      </tbody></table><button type="button" class="more-btn" data-action="toggle" data-key="clAll">${all ? 'Weniger anzeigen' : `Alle ${rows.length} Teams anzeigen`}</button>
      <p class="faint" style="font-size:11px;font-weight:600;line-height:1.5;padding:2px 6px 8px">AF = Achtelfinale · VF = Viertelfinale · HF = Halbfinale</p></div></section>`;
  }
  // DFB-Pokal: Chancen auf jede weitere Runde (jede Runde ein Spiel, danach freie Auslosung)
  const DFB_LBL = { 'round-of-16': 'Achtelfinale', quarterfinals: 'Viertelfinale', semifinals: 'Halbfinale', final: 'Finale', win: 'Pokalsieg' };
  const DFB_SHORT = { 'round-of-16': 'AF', quarterfinals: 'VF', semifinals: 'HF', final: 'Finale', win: 'Sieg' };
  function dfbSection(d) {
    if (!d || !d.teams || !d.keys) return '';
    const me = d.teams.find((t) => t.isBVB);
    const keys = d.keys;
    let out = `<section class="sec"><div class="sec-h"><h2>DFB-Pokal</h2><span class="note">${nf0.format(d.sims)} Simulationen</span></div>`;
    if (!me) {
      out += '<div class="note-box">' + I.info + '<span>Der BVB ist in dieser Saison nicht mehr im DFB-Pokal dabei.</span></div>';
    } else {
      const t = d.tie;
      const open = t && !t.score;
      // offenes Spiel: Chance, diese Runde zu überstehen; schon weiter: Chance, auch die nächste Runde zu gewinnen
      const nk = open ? keys[0] : keys[1] || keys[0];
      const rest = keys.slice(keys.indexOf(nk) + 1);
      const after = rest.length > 3 ? [...rest.slice(0, 2), rest[rest.length - 1]] : rest;
      const rings = [['Nächste Runde', me[nk]], ...after.map((k) => [DFB_LBL[k], me[k]])];
      if (t) {
        out += `<div class="card tie-card"><div class="row" style="gap:12px">${crest({ name: t.opp.name, icon: t.opp.logo }, 'crest md')}<span class="grow"><span class="eyebrow">${esc(t.label)} · ${t.home ? 'Heim' : 'Auswärts'}</span><div class="tie-opp">gegen ${esc(t.opp.name)}</div></span>
          <span class="tie-p"><b>${t.score ? esc(t.score) : esc(pctTxt(me[keys[0]]))}</b><span>${t.score ? (t.won ? 'weiter' : 'raus') : 'weiter'}</span></span></div>
          ${t.score && t.won && keys[0] !== 'win' ? `<p class="faint" style="font-size:12px;font-weight:600">Als Nächstes: ${esc(DFB_LBL[keys[0]] || '')} – die Auslosung steht noch aus.</p>` : ''}</div>`;
      }
      out += `<div class="card fc-pro" style="margin-top:12px"><div class="pro-rings">${rings.map(([l, v]) => `<div class="pro-ring"><span class="pro-r">${ring((v || 0) / 100, 70, 7, 'var(--y)')}<b>${esc(pctTxt(v))}</b></span><span>${l}</span></div>`).join('')}</div>
        <div class="cl-path">${keys.map((k, i) => `<div class="clp"><span class="clp-l">${DFB_LBL[k]}</span><span class="clp-bar"><i style="--w:${Math.max(0.8, me[k] || 0).toFixed(1)}%;animation-delay:${(i * 0.06).toFixed(2)}s"></i></span><span class="clp-v">${esc(pctTxt(me[k]))}</span></div>`).join('')}</div>
        <p class="faint" style="font-size:11px;font-weight:600;line-height:1.6;margin-top:10px">Jede Runde ein Spiel mit Verlängerung und Elfmeterschießen, danach freie Auslosung – Amateure haben gegen Profis Heimrecht, das Finale in Berlin ist neutral. Nach jedem Pokalspiel neu berechnet.</p></div>`;
    }
    const cols = keys.slice(-4);
    const top = d.teams.slice(0, 8);
    if (me && !top.includes(me)) top.push(me);
    out += `<div class="card" style="padding:6px 8px;margin-top:12px"><table class="table fc-t"><thead><tr><th>#</th><th>Verein</th>${cols.map((k) => `<th>${DFB_SHORT[k]}</th>`).join('')}</tr></thead><tbody>
      ${top.map((x) => `<tr class="${x.isBVB ? 'me' : ''}"><td>${d.teams.indexOf(x) + 1}</td><td><span class="tm">${crest({ name: x.team, icon: x.icon }, 'crest xs')}<span>${esc(x.team)}</span></span></td>${cols.map((k) => `<td>${pctS(x[k])}</td>`).join('')}</tr>`).join('')}
      </tbody></table><p class="faint" style="font-size:11px;font-weight:600;line-height:1.5;padding:6px 6px 8px">Pokal-Favoriten · Chancen in % · ${d.teams.filter((x) => x[keys[0]] > 0).length} Teams noch im Rennen</p></div></section>`;
    return out;
  }
  function explainCard(info) {
    const data = info.matches ? `${nf0.format(info.matches)} Ligaspielen aus ${info.leagues} Ländern (Tore und xG)` : 'den Ergebnissen dieser und der letzten Saison';
    return `<details class="card explain"><summary><b>So rechnet die Prognose</b>${I.down}</summary><ul>
      <li><b>Spielstärke:</b> aus ${data} und ${nf0.format(info.odds || 0)} Wettquoten. Quoten sind die genaueste freie Einschätzung, wie stark ein Team wirklich ist – darin stecken Verletzungen, Form und Kader.</li>
      <li><b>Ligen vergleichen:</b> über alle Spiele in Champions League, Europa League und Conference League.</li>
      <li><b>Simulation:</b> Die restliche Saison wird ${nf0.format(info.sims || 15000)}-mal durchgespielt – mit Heimvorteil, Zufall und Formschwankungen.</li>
      <li><b>Punkte oder Stärke?</b> Gleich viele Punkte heißt nicht gleich stark. Wer seine Spiele knapp gewinnt, holt später im Schnitt weniger als ein Team, das klar gewinnt – deshalb zählt die Stärke mehr als der Tabellenplatz von heute.</li>
      <li><b>Nachgemessen:</b> An allen Spielen der letzten Saison aus 11 Ligen geprüft – die Stärke eines Teams schwankt über eine Saison weniger, als die Prognose vorsichtshalber einrechnet.</li>
      <li>Ganz ohne KI, nach jedem Bundesliga-, Champions-League- und Pokalspiel neu. Eine Schätzung, keine Garantie.</li></ul></details>`;
  }
  function vSaisonTab() {
    const se = D.season || {};
    if (!se.fever && !se.forecast) return '<div class="empty" style="margin-top:14px">Die Saison-Analyse kommt mit dem nächsten Update.</div>';
    let out = `<div class="row faint" style="font-size:12px;margin:14px 2px 0;gap:8px;font-weight:600"><span class="dot ${liveDotClass()}"></span><span>Neu gerechnet ${esc(rel(se.updatedAt) || '–')} · nach jedem Bundesliga-, CL- und Pokalspiel automatisch</span></div>`;
    const cur = (se.fever || {}).cur || [];
    const prev = (se.fever || {}).prev || [];
    const last = cur[cur.length - 1];
    const pSame = last ? prev.find((q) => q[0] === last[0]) : null;
    if (se.fever) {
      out += `<section class="card fv-card" style="margin-top:14px"><div class="row" style="justify-content:space-between;align-items:flex-start"><span><span class="eyebrow">Fieberkurve</span><div style="font-size:15px;font-weight:800;margin-top:3px">${last ? `Nach ${last[0]} ${last[0] === 1 ? 'Spieltag' : 'Spieltagen'}: Platz ${last[1]}` : 'Noch kein Spieltag'}</div>${pSame ? `<div class="faint" style="font-size:12px;font-weight:600">Vorsaison zum gleichen Zeitpunkt: Platz ${pSame[1]} · ${last[2] - pSame[2] >= 0 ? '+' : ''}${last[2] - pSame[2]} Punkte</div>` : ''}</span></div>
        ${feverSvg(cur, prev)}<div class="fv-legend"><span><i class="cur"></i>Diese Saison</span><span><i class="prev"></i>Vorsaison</span><span><i class="cl"></i>Champions League</span><span><i class="down"></i>Abstieg</span></div></section>`;
    }
    const info = se.model || {};
    const how = info.leagues ? `Ergebnissen, xG und Wettquoten aus ${info.leagues} Ligen`
      : (info.odds || 0) > 0 ? 'Wettquoten und Ergebnissen' : 'Ergebnissen';
    const fc = se.forecast;
    const me = fc && (fc.teams || []).find((t) => t.isBVB);
    if (me) {
      const rings = [['Meister', me.title, 'var(--y)'], ['Champions League', me.cl, 'var(--y)'], ['Europa / Conference', me.el + me.ecl, '#5AA9FF'], ['Abstieg', me.down + me.rel, 'var(--loss)']];
      out += `<section class="sec"><div class="sec-h"><h2>Bundesliga-Prognose</h2><span class="note">${nf0.format(fc.sims)} Simulationen</span></div>
        <div class="card fc-pro"><div class="pro-rings">${rings.map(([l, v, c]) => `<div class="pro-ring"><span class="pro-r">${ring((v || 0) / 100, 70, 7, c)}<b>${esc(pctTxt(v))}</b></span><span>${l}</span></div>`).join('')}</div>
        <div class="kv"><span>Erwartete Punkte am Saisonende</span><span>${nf1.format(me.expPoints)}</span></div>
        <div class="pro-dist" aria-label="Wahrscheinlichkeit je Tabellenplatz">${(me.dist || []).map((v, i) => `<span style="--h:${Math.max(2, Math.min(100, v * 2.2)).toFixed(1)}%" class="${i < 4 ? 'cl' : i >= 15 ? 'down' : ''}" title="Platz ${i + 1}: ${nf1.format(v)} %"><i></i><em>${i + 1}</em></span>`).join('')}</div>
        <p class="faint" style="font-size:11px;font-weight:600;line-height:1.6;margin-top:10px">Wahrscheinlichkeit für jeden Tabellenplatz – berechnet aus ${how}, nach jedem Spiel neu. Eine Schätzung, keine Garantie.</p></div></section>`;
      out += raceCard(fc, me);
      out += nextGamesCard(se.next || []);
      out += fcTable(fc);
    }
    const cl = se.cl;
    const cm = cl && (cl.teams || []).find((t) => t.isBVB);
    if (cm) {
      // "Nächste Runde": in der Ligaphase k. A., danach die Chance, die laufende K.-o.-Runde zu überstehen
      // (nach dem Hinspiel sofort neu gerechnet). Ohne angesetztes Duell entscheidet der Platz der Ligaphase.
      const NEXT = { 'knockout-round-playoffs': 'r16', 'round-of-16': 'qf', quarterfinals: 'sf', semifinals: 'final', final: 'win' };
      let nk = null;
      if (cl.tie && NEXT[cl.tie.round]) nk = NEXT[cl.tie.round];
      else if (cl.leagueDone && cm.pos) nk = cm.pos <= 8 ? 'qf' : cm.pos <= 24 ? 'r16' : 'out';
      const next = nk === 'out' ? 0 : nk ? cm[nk] : null;
      // nach der Ligaphase: nächste Runde, dann alle weiteren Runden bis zum Titel
      const LATER = [['r16', 'Achtelfinale'], ['qf', 'Viertelfinale'], ['sf', 'Halbfinale'], ['final', 'Finale'], ['win', 'CL-Sieg']];
      const rest = LATER.slice(nk && nk !== 'out' ? LATER.findIndex(([k]) => k === nk) + 1 : LATER.length - 1);
      const after = rest.length > 3 ? [...rest.slice(0, 2), rest[rest.length - 1]] : rest;
      const rings = cl.leagueDone ? [['Nächste Runde', next], ...after.map(([k, l]) => [l, cm[k]])]
        : [['Top 8', cm.top8], ['Top 24', cm.top24], ['Nächste Runde', next], ['CL-Sieg', cm.win]];
      out += `<section class="sec"><div class="sec-h"><h2>Champions League</h2><span class="note">${nf0.format(cl.sims)} Simulationen</span></div>`;
      if (cl.tie) out += tieCard(cl.tie);
      out += `<div class="card fc-pro" ${cl.tie ? 'style="margin-top:12px"' : ''}><div class="pro-rings">${rings.map(([l, v]) => `<div class="pro-ring"><span class="pro-r">${ring((v || 0) / 100, 70, 7, 'var(--y)')}<b>${esc(pctTxt(v))}</b></span><span>${l}</span></div>`).join('')}</div>
        <div class="cl-path">${[['K.-o.-Phase', cm.top24], ['Achtelfinale', cm.r16], ['Viertelfinale', cm.qf], ['Halbfinale', cm.sf], ['Finale', cm.final], ['Sieger', cm.win]].map(([l, v], i) => `<div class="clp"><span class="clp-l">${l}</span><span class="clp-bar"><i style="--w:${Math.max(0.8, v || 0).toFixed(1)}%;animation-delay:${(i * 0.06).toFixed(2)}s"></i></span><span class="clp-v">${esc(pctTxt(v))}</span></div>`).join('')}</div>
        ${!cl.leagueDone ? `<div class="kv"><span>Ligaphase: aktuell Platz ${cm.pos || '–'} · erwartete Punkte</span><span>${nf1.format(cm.expPoints)}</span></div>
        <div class="pro-dist d36" aria-label="Wahrscheinlichkeit je Platz in der Ligaphase">${(cm.dist || []).map((v, i) => `<span style="--h:${Math.max(2, Math.min(100, v * 3)).toFixed(1)}%" class="${i < 8 ? 'cl' : i >= 24 ? 'down' : 'po'}" title="Platz ${i + 1}: ${nf1.format(v)} %"><i></i><em>${[1, 8, 24, 36].includes(i + 1) ? i + 1 : ''}</em></span>`).join('')}</div>` : ''}
        <p class="faint" style="font-size:11px;font-weight:600;line-height:1.6;margin-top:10px">Platz 1–8 direkt ins Achtelfinale, 9–24 in die Playoffs, ab 25 raus. Die K.-o.-Runden sind komplett mit Turnierbaum, Hin- und Rückspiel, Verlängerung und Elfmeterschießen simuliert – gespielte Hinspiele zählen mit. Berechnet aus ${how}.</p></div></section>`;
      out += clFavTable(cl);
    }
    out += dfbSection(se.dfb);
    out += explainCard(info);
    const sc = se.scorers || [];
    if (sc.length) {
      out += `<section class="sec"><div class="sec-h"><h2>Liga-Torjäger</h2><span class="note">Bundesliga</span></div><div class="card flat"><div class="list">${sc.slice(0, 15).map((x, i) => `<div class="li ${x.isBVB ? 'me-row' : ''}"><span class="rank">${i + 1}</span>${crest({ name: x.team, icon: x.icon }, 'crest sm')}<span class="grow"><div class="t ellipsis">${esc(x.name)}</div><div class="s">${esc(x.short || x.team || 'k. A.')}</div></span><span class="num ${x.isBVB ? 'yellow' : ''}" style="font-size:24px">${x.goals}</span></div>`).join('')}</div></div></section>`;
    }
    return out;
  }

  // ------------------------------------------------------------------ Spieltag-Zentrale
  const mcAll = () => (D.matchcenter || {}).matches || {};
  const mcOf = (id) => mcAll()[id] || {};
  const oppOf = (m) => (m.isHome ? m.away : m.home);
  const bvbScore = (m) => (m.score ? (m.isHome ? [m.score[0], m.score[1]] : [m.score[1], m.score[0]]) : null);
  const matchById = (id) => matchList().find((x) => x.id === id);
  const scoreStr = (m) => (m.score ? `${m.score[0]}:${m.score[1]}` : '0:0');
  const RES_T = { W: 'Sieg', D: 'Remis', L: 'Niederlage' };
  const shortComp = (c) => (/champions/i.test(c || '') ? 'CL' : /pokal/i.test(c || '') ? 'Pokal' : /bundesliga/i.test(c || '') ? 'Bundesliga' : /supercup/i.test(c || '') ? 'Supercup' : String(c || '').split(' ')[0]);
  // Sperren gelten oft nur in einem Wettbewerb ("Rotsperre – DFB-Pokal")
  function absFor(a, m) {
    const t = a.text || '';
    if (/DFB[- ]Pokal/i.test(t) && m.compShort !== 'dfb') return false;
    if (/Champions League/i.test(t) && m.compShort !== 'ucl') return false;
    if (/Bundesliga/i.test(t) && m.compShort !== 'bl1') return false;
    return true;
  }
  function scorerPlayer(name) {
    if (!name) return null;
    const l = slug(name).split('-').pop();
    const c = (team('profis').players || []).filter((p) => slug(p.name).split('-').pop() === l);
    return c.length === 1 ? c[0] : playerByName(name);
  }

  // Tippspiel – gespeichert nur auf diesem Gerät
  const tipsAll = () => store.get('tips', {});
  const myTip = (id) => tipsAll()[id] || null;
  const kiTip = (m) => (mcOf(m.id).model || {}).tip || (mcOf(m.id).preview || {}).tip || null;
  const probBar = (mt) => (mt && mt.probs ? `<div class="pb" role="img" aria-label="Sieg ${mt.probs.w} Prozent, Remis ${mt.probs.d} Prozent, Niederlage ${mt.probs.l} Prozent">${[['w', 'Sieg'], ['d', 'Remis'], ['l', 'Niederl.']].map(([k, l]) => `<span class="pb-${k}" style="--w:${Math.max(8, mt.probs[k])}%"><b>${nf0.format(mt.probs[k])}%</b><em>${l}</em></span>`).join('')}</div>` : '');
  const srcTxt = (mt) => (mt.src === 'quoten' ? 'aus den Wettquoten' : 'aus den Spielstärken');
  const tipOpen = (m) => !m.finished && Date.parse(m.date) > Date.now();
  const tipStr = (t, m) => (m.isHome ? `${t.bvb}:${t.opp}` : `${t.opp}:${t.bvb}`);
  function tipPts(t, m) {
    const s = m.finished && bvbScore(m);
    if (!t || !s) return null;
    if (t.bvb === s[0] && t.opp === s[1]) return 3;
    if (t.bvb - t.opp === s[0] - s[1]) return 2;
    return Math.sign(t.bvb - t.opp) === Math.sign(s[0] - s[1]) ? 1 : 0;
  }
  function tipStats() {
    const out = { me: 0, ki: 0, exact: 0, hits: 0, n: 0, streak: 0, best: 0, rows: [] };
    let run = 0;
    for (const m of matchList().filter((x) => x.finished && x.score)) {
      const t = myTip(m.id);
      const k = kiTip(m);
      const pm = tipPts(t, m);
      const pk = tipPts(k, m);
      if (pm != null) {
        out.me += pm; out.n += 1;
        if (pm === 3) out.exact += 1;
        if (pm > 0) out.hits += 1;
        run = pm > 0 ? run + 1 : 0;
        out.best = Math.max(out.best, run);
      }
      if (pk != null) out.ki += pk;
      if (pm != null || pk != null) out.rows.push({ m, t, k, pm, pk });
    }
    out.streak = run;
    return out;
  }
  const tipRules = () => '<p class="faint" style="font-size:11px;font-weight:600;line-height:1.7;margin-top:12px;text-align:center">3 Punkte: exaktes Ergebnis · 2 Punkte: richtige Tordifferenz · 1 Punkt: richtiger Sieger bzw. Remis</p>';

  // Live-Daten direkt von ESPN (Aufstellung, Ticker, Statistik) – kommt sofort, ohne auf GitHub zu warten
  const ESPN_C = {};
  function parseEspn(d) {
    const comp = (((d || {}).header || {}).competitions || [])[0] || {};
    const st = (comp.status || {}).type || {};
    const isB = (t) => String((t || {}).id) === '124';
    const cs = comp.competitors || [];
    const me = cs.find((c) => isB(c.team));
    const ot = cs.find((c) => !isB(c.team));
    const lineups = ((d || {}).rosters || []).map((r) => ({
      bvb: isB(r.team), formation: r.formation || '',
      players: (r.roster || []).map((a) => ({ name: (a.athlete || {}).displayName || '', jersey: a.jersey || '', pos: String((a.position || {}).abbreviation || '').toUpperCase(),
        starter: !!a.starter, subIn: !!a.subbedIn, subOut: !!a.subbedOut })),
    }));
    const events = ((d || {}).keyEvents || []).map((k) => ({ type: (k.type || {}).text || '', min: (k.clock || {}).displayValue || '',
      bvb: k.team ? isB(k.team) : null, who: (k.participants || []).map((p) => (p.athlete || {}).displayName || '').filter(Boolean) }));
    const stats = {};
    for (const t of (((d || {}).boxscore || {}).teams || [])) stats[isB(t.team) ? 'bvb' : 'opp'] = Object.fromEntries((t.statistics || []).map((s) => [s.name, s.displayValue]));
    return { state: st.state || 'pre', clock: (comp.status || {}).displayClock || st.shortDetail || '', completed: !!st.completed,
      score: me && ot && me.score != null && ot.score != null ? [+me.score, +ot.score] : null, lineups, events, stats };
  }
  async function espnLive(e, maxAge) {
    if (!e || !e.id) return null;
    const k = e.lg + ':' + e.id;
    const c = ESPN_C[k];
    if (c && Date.now() - c.at < maxAge) return c.data;
    try {
      const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${e.lg}/summary?event=${e.id}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      ESPN_C[k] = { data: parseEspn(await r.json()), at: Date.now() };
      return ESPN_C[k].data;
    } catch (err) { return c ? c.data : null; }
  }
  const espnCached = (e) => (e && e.id && ESPN_C[e.lg + ':' + e.id] ? ESPN_C[e.lg + ':' + e.id].data : null);

  // Aufstellung als Spielfeld: Reihen nach der Formation (z. B. 3-1-4-2), innerhalb der Reihe links -> rechts
  function posDepth(a) {
    if (a === 'G' || a === 'GK') return 0;
    if (a === 'SW') return 1.5;
    if (/^(DM|CDM)/.test(a)) return 2;
    if (/^(AM|CAM)/.test(a)) return 4;
    if (/^(CD|CB|LB|RB|LWB|RWB)|^D$/.test(a)) return /WB/.test(a) ? 1.2 : 1;
    if (/^(F|CF|ST|LW|RW|LF|RF|SS)/.test(a)) return 5;
    return 3;
  }
  const posSide = (a) => (/^L/.test(a) ? 0 : /-L$/.test(a) ? 1 : /^R/.test(a) ? 4 : /-R$/.test(a) ? 3 : 2);
  function pitchHtml(lu) {
    const st = lu.players.filter((p) => p.starter);
    if (st.length < 11) return '';
    const gk = st.filter((p) => posDepth(p.pos) === 0);
    const field = st.filter((p) => posDepth(p.pos) !== 0).sort((a, b) => posDepth(a.pos) - posDepth(b.pos));
    const sizes = (lu.formation || '').split('-').map(Number).filter((n) => n > 0);
    let rows = [];
    if (sizes.length && sizes.reduce((a, b) => a + b, 0) === field.length) {
      let i = 0;
      for (const n of sizes) { rows.push(field.slice(i, i + n)); i += n; }
    } else {
      const by = {};
      field.forEach((p) => { const k = Math.round(posDepth(p.pos)); (by[k] = by[k] || []).push(p); });
      rows = Object.keys(by).sort((a, b) => a - b).map((k) => by[k]);
    }
    rows = [gk, ...rows].filter((r) => r.length);
    rows.forEach((r) => r.sort((a, b) => posSide(a.pos) - posSide(b.pos)));
    return `<div class="lu-pitch">${rows.reverse().map((r, i) => `<div class="lu-row">${r.map((p, j) => `<span class="lu-p ${p.subOut ? 'out' : ''}" style="animation-delay:${(i * 0.07 + j * 0.03).toFixed(2)}s"><b>${esc(p.jersey)}</b><i>${esc(lastName(p.name))}</i></span>`).join('')}</div>`).join('')}</div>`;
  }
  function lineupSection(x, m) {
    const mine = x.lineups.find((l) => l.bvb);
    const other = x.lineups.find((l) => !l.bvb);
    if (!mine || mine.players.filter((p) => p.starter).length < 11) return '';
    const bench = mine.players.filter((p) => !p.starter);
    const os = other ? other.players.filter((p) => p.starter) : [];
    return `<section class="sec"><div class="sec-h"><h2>Aufstellung</h2><span class="note">${esc(mine.formation)} · offiziell</span></div>${pitchHtml(mine)}
      ${bench.length ? `<div class="lu-bench"><span class="eyebrow">Bank</span><div>${bench.map((p) => `<span class="${p.subIn ? 'in' : ''}">${esc(p.jersey)} ${esc(lastName(p.name))}${p.subIn ? ' ↑' : ''}</span>`).join('')}</div></div>` : ''}
      ${os.length ? `<div class="lu-opp"><span class="eyebrow">${esc(tname(oppOf(m)))}${other.formation ? ' · ' + esc(other.formation) : ''}</span><p>${os.map((p) => esc(lastName(p.name))).join(' · ')}</p></div>` : ''}</section>`;
  }

  // Live-Ticker
  const EVT = [[/own goal/i, 'goal', 'Eigentor'], [/penalty.*(miss|saved)/i, 'miss', 'Elfmeter vergeben'], [/goal|penalty - scored/i, 'goal', 'Tor'],
    [/red card/i, 'red', 'Rote Karte'], [/yellow card/i, 'yellow', 'Gelbe Karte'], [/substitution/i, 'sub', 'Wechsel'],
    [/^halftime/i, 'ht', 'Halbzeit'], [/^kickoff/i, 'ko', 'Anpfiff'], [/end regular time|full time|match ends|end of game/i, 'ft', 'Abpfiff']];
  function tickerSection(x, m, live) {
    let rows = [];
    for (const ev of (x && x.events) || []) {
      const t = EVT.find(([re]) => re.test(ev.type));
      if (t) rows.push(Object.assign({ k: t[1], label: t[2] }, ev));
    }
    if (!rows.length) rows = (m.goals || []).map((g) => ({ k: 'goal', label: g.ownGoal ? 'Eigentor' : 'Tor', min: g.minute != null ? g.minute + "'" : '', bvb: (g.team === 'home') === m.isHome, who: [g.scorer || ''] }));
    if (!rows.length) return '';
    const who = (r) => (r.k === 'sub' && r.who.length >= 2 ? `${r.who[0]} für ${r.who[1]}` : r.k === 'goal' && r.who.length >= 2 ? `${r.who[0]} (Vorlage: ${r.who[1]})` : r.who[0] || '');
    return `<section class="sec"><div class="sec-h"><h2>Ticker</h2>${live ? '<span class="note">aktualisiert sich alle 30 Sek.</span>' : ''}</div><div class="card flat tkr-list">${rows.slice().reverse().map((r) => `<div class="tkr ev-${r.k}${r.bvb ? ' me' : ''}"><time>${esc(r.min)}</time><i class="tk-ic ev-${r.k}" aria-hidden="true"></i><span class="grow"><b>${esc(r.label)}${r.bvb != null && !['ht', 'ko', 'ft'].includes(r.k) ? ' · ' + (r.bvb ? 'BVB' : esc(tname(oppOf(m)))) : ''}</b>${who(r) ? `<span>${esc(who(r))}</span>` : ''}</span></div>`).join('')}</div></section>`;
  }
  const STAT_ROWS = [['possessionPct', 'Ballbesitz', '%'], ['totalShots', 'Schüsse', ''], ['shotsOnTarget', 'Aufs Tor', ''], ['wonCorners', 'Ecken', ''],
    ['foulsCommitted', 'Fouls', ''], ['yellowCards', 'Gelbe Karten', ''], ['offsides', 'Abseits', '']];
  function statBars(st, m) {
    const b = (st || {}).bvb || {};
    const o = (st || {}).opp || {};
    const rows = STAT_ROWS.filter(([k]) => b[k] != null && o[k] != null && b[k] !== '' && o[k] !== '');
    if (!rows.length) return '';
    const left = m.isHome ? b : o;
    const right = m.isHome ? o : b;
    return `<section class="sec"><div class="sec-h"><h2>Statistik</h2><span class="note">${esc(tname(m.home))} : ${esc(tname(m.away))}</span></div><div class="card ms">${rows.map(([k, l, u]) => {
      const L = parseFloat(left[k]) || 0;
      const R = parseFloat(right[k]) || 0;
      const sum = L + R || 1;
      return `<div class="ms-row"><div class="ms-top"><b class="${m.isHome ? 'me' : ''}">${nf0.format(L)}${u}</b><span>${l}</span><b class="${m.isHome ? '' : 'me'}">${nf0.format(R)}${u}</b></div>
        <div class="ms-bar"><i class="${m.isHome ? 'me' : ''}" style="width:${(L / sum * 100).toFixed(1)}%"></i><i class="${m.isHome ? '' : 'me'}" style="width:${(R / sum * 100).toFixed(1)}%"></i></div></div>`;
    }).join('')}</div></section>`;
  }
  function mcLiveHtml(m, e, x) {
    const fin = m.finished && m.score;
    const live = !fin && (isLive(m) || (x && x.state === 'in'));
    if (!fin && !live) {
      return (x && lineupSection(x, m)) || `<div class="note-box" style="margin-top:14px">${I.info}<span>Die offizielle Aufstellung erscheint etwa eine Stunde vor dem Anpfiff – diese Seite holt sie dann von selbst.</span></div>`;
    }
    const st = x && x.stats && x.stats.bvb && Object.keys(x.stats.bvb).length ? x.stats : (e.game || {}).teams || null;
    return tickerSection(x, m, live) + (st ? statBars(st, m) : '') + (x ? lineupSection(x, m) : '');
  }
  function reportSection(m, e) {
    const rp = e.report;
    if (!rp || !rp.text) return '<div class="empty" style="margin-top:14px">Der KI-Spielbericht kommt kurz nach dem Abpfiff.</div>';
    const p = rp.motm && rp.motm.id ? findPlayer('profis', rp.motm.id) : null;
    const v = p ? ((e.game || {}).players || {})[p.id] : null;
    let out = `<section class="brief mc-ai" style="margin-top:14px"><div class="row" style="margin-bottom:10px"><span class="ai-badge">${I.ai}</span><span class="grow"><b style="font-size:14px">KI-Spielbericht</b><div class="faint" style="font-size:11px;font-weight:600">Gemini · ${esc(rel(rp.at))}</div></span></div>
      <p>${esc(rp.text)}</p>${(rp.highlights || []).length ? `<ul class="mc-points">${rp.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}</section>`;
    if (p) {
      const line = v ? [v.min != null ? v.min + ' Min.' : '', v.g ? v.g + (v.g === 1 ? ' Tor' : ' Tore') : '', v.a ? v.a + (v.a === 1 ? ' Vorlage' : ' Vorlagen') : ''].filter(Boolean).join(' · ') : 'laut Medien';
      out += `<a class="motm press" href="#/spieler/profis/${esc(p.id)}"><span class="motm-txt"><span class="eyebrow">Spieler des Spiels</span><b>${esc(p.name)}</b><span>${esc(line)}</span></span>${img(pimg(p.img, 'big'), 'motm-img', p.name, 'sil')}</a>`;
    }
    return out;
  }
  function videoSection(m, e) {
    let out = `<section class="sec"><div class="sec-h"><h2>Highlights</h2>${e.video ? '<span class="note">offizieller BVB-Kanal</span>' : ''}</div>`;
    out += e.video ? ytCard(e.video, 'Highlights') : `<div class="note-box">${I.info}<span>Für dieses Spiel gibt es kein frei verfügbares Highlight-Video beim BVB. Viele Bundesliga-Highlights sind in Deutschland nur bei Sky, DAZN oder der Sportschau zu sehen.</span></div>`;
    out += `<a class="btn ghost" style="margin-top:10px" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${m.home.name} ${m.away.name} Highlights`)}" target="_blank" rel="noopener">Bei YouTube suchen ${I.ext.replace('<svg', '<svg style="stroke:currentColor"')}</a>`;
    if (e.pkAfter) out += `<div style="margin-top:12px">${ytCard(e.pkAfter, 'Pressekonferenz nach dem Spiel')}</div>`;
    return out + '</section>';
  }
  function playersSection(m, e) {
    const gp = (e.game || {}).players || {};
    const motm = ((e.report || {}).motm || {}).id;
    const rows = Object.entries(gp).map(([id, v]) => ({ p: findPlayer('profis', id), v })).filter((r) => r.p)
      .sort((a, b) => (b.v.s - a.v.s) || ((b.v.min || 0) - (a.v.min || 0)));
    if (!rows.length) return '';
    return `<section class="sec"><div class="sec-h"><h2>BVB-Spieler</h2><span class="note">Tore · Vorlagen · Minuten</span></div><div class="card flat"><div class="list">${rows.map(({ p, v }) => `<a class="li" href="#/spieler/profis/${esc(p.id)}">${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}
      <span class="grow"><div class="t ellipsis">${esc(p.name)}${p.id === motm ? ' <span class="chip y sm">Spieler des Spiels</span>' : ''}</div><div class="s">${v.s ? 'Startelf' : 'eingewechselt'}${v.y ? ' · <i class="cd y" title="Gelbe Karte"></i>' : ''}${v.r ? ' · <i class="cd r" title="Rote Karte"></i>' : ''}</div></span>
      <span class="mp">${v.g ? `<b class="pl g">${v.g} T</b>` : ''}${v.a ? `<b class="pl a">${v.a} V</b>` : ''}<span>${v.min != null ? v.min + "'" : 'k. A.'}</span></span></a>`).join('')}</div></div></section>`;
  }
  function mcVorbericht(m, e) {
    const pv = e.preview;
    const upcoming = tipOpen(m);
    let out = '';
    if (pv && pv.text) {
      out += `<section class="brief mc-ai" style="margin-top:14px"><div class="row" style="margin-bottom:10px"><span class="ai-badge live">${I.ai}</span><span class="grow"><b style="font-size:14px">KI-Vorbericht</b><div class="faint" style="font-size:11px;font-weight:600">Gemini · ${esc(rel(pv.at))}</div></span></div>
        <p>${esc(pv.text)}</p>${(pv.keyPoints || []).length ? `<ul class="mc-points">${pv.keyPoints.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}</section>`;
    } else {
      out += `<div class="empty" style="margin-top:14px">${upcoming ? 'Der KI-Vorbericht kommt etwa zwei Tage vor dem Anpfiff.' : 'Für dieses Spiel gibt es keinen Vorbericht.'}</div>`;
    }
    const mt = e.model;
    if (mt && mt.probs) {
      out += `<section class="card mc-prob" style="margin-top:12px"><div class="row" style="justify-content:space-between"><span class="eyebrow">Gewinnchancen BVB</span><span class="faint" style="font-size:11px;font-weight:700">${esc(srcTxt(mt))}</span></div>${probBar(mt)}</section>`;
    }
    const k = kiTip(m);
    if (k) {
      const show = !!myTip(m.id) || !upcoming;
      const why = (pv && pv.tipReason) || (mt ? `Berechnet ${srcTxt(mt)}: das Ergebnis mit den meisten erwarteten Tipp-Punkten.` : 'Prognose von Gemini');
      out += `<section class="card row mc-ki" style="margin-top:12px;gap:14px"><span class="ai-badge">${I.ai}</span><span class="grow"><span class="eyebrow">KI-Tipp</span><div style="font-size:13px;font-weight:600;margin-top:3px;line-height:1.4">${show ? esc(why) : 'Gib zuerst deinen eigenen Tipp ab – dann verrät dir die KI ihren.'}</div></span>
        ${show ? `<b class="mc-tipnum">${tipStr(k, m)}</b>` : `<a class="chip y" href="#/spiel/${esc(m.id)}/tipp">Tippen</a>`}</section>`;
    }
    if (upcoming && e.weather) {
      const w = e.weather;
      out += `<section class="card wx" style="margin-top:12px"><span class="wx-ic" aria-hidden="true">${weatherIcon(w.code)}</span><span class="grow"><span class="eyebrow">Wetter zum Anpfiff · ${esc(w.place || '')}</span><b>${w.temp != null ? Math.round(w.temp) + '°' : 'k. A.'} · ${esc(weatherText(w.code))}</b><span>${w.rain != null ? w.rain + ' % Regenrisiko' : 'Regen k. A.'} · Wind ${w.wind != null ? Math.round(w.wind) + ' km/h' : 'k. A.'}</span></span></section>`;
    }
    if (e.pk) out += `<section class="sec"><div class="sec-h"><h2>Pressekonferenz</h2><span class="note">offizieller BVB-Kanal</span></div>${ytCard(e.pk, 'Vor dem Spiel')}</section>`;
    if (upcoming) {
      const miss = (team('profis').players || []).map((p) => ({ p, a: absencesOf(p).filter((x) => absFor(x, m)) })).filter((r) => r.a.length);
      out += `<section class="sec"><div class="sec-h"><h2>Ausfälle BVB</h2><span class="note">${miss.length ? miss.length + ' Spieler' : 'keine bekannt'}</span></div>${miss.length ? `<div class="card flat"><div class="list">${miss.map(({ p, a }) => `<a class="li" href="#/spieler/profis/${esc(p.id)}">${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}<span class="grow"><div class="t ellipsis">${esc(p.name)}</div><div class="s ellipsis">${esc(a[0].text)}</div></span><span class="chip sm ${a[0].type === 'injury' ? 'loss' : 'warn'}">${a[0].type === 'injury' ? 'Verletzt' : a[0].type === 'suspension' ? 'Gesperrt' : 'Fehlt'}</span></a>`).join('')}</div></div>` : '<p class="green" style="font-size:13px;font-weight:700">Alle an Bord.</p>'}</section>`;
      out += `<a class="btn ghost" style="margin-top:14px" href="${icsFor(m)}" download="bvb-spiel.ics">${I.cal} In den Kalender</a>`;
    }
    return out;
  }
  function mcGegner(m, e) {
    const o = e.opponent || {};
    const opp = oppOf(m);
    const bl = ((D.tables || {}).bl1 || {}).rows || [];
    const bvbT = o.bvbTable || (m.compShort === 'bl1' ? bl.find((r) => r.isBVB) : null);
    const oppT = o.table || (m.compShort === 'bl1' ? bl.find((r) => r.id === opp.id) : null);
    const bvbF = (o.bvbForm || []).length ? o.bvbForm.map((f) => f.r) : formOf('profis');
    const oppF = (o.form || []).map((f) => f.r);
    const side = (c, name, t, f) => `<div class="vs-side">${crest(c, 'crest lg')}<b>${esc(name)}</b><span>${t ? `${t.pos}. Platz · ${t.points} Pkt.` : 'Tabelle k. A.'}</span>${f.length ? formHtml(f, 'sm') : '<span class="faint" style="font-size:11px">Form k. A.</span>'}</div>`;
    let out = `<section class="mc-vs" style="margin-top:14px">${side(BVB, 'BVB', bvbT, bvbF)}<div class="vs-mid" aria-hidden="true">VS</div>${side(opp, tname(opp), oppT, oppF)}</section>`;
    if (o.tableName && (bvbT || oppT)) out += `<p class="faint" style="font-size:11px;font-weight:600;text-align:center;margin-top:8px">Tabelle: ${esc(o.tableName)}</p>`;
    if ((o.form || []).length) {
      out += `<section class="sec"><div class="sec-h"><h2>Form ${esc(tname(opp))}</h2><span class="note">letzte Pflichtspiele</span></div><div class="card flat">${o.form.slice().reverse().map((f) => `<div class="kv"><span>${esc(fmtDate(f.date))} · ${esc(shortComp(f.comp))} · ${f.home ? 'gegen' : 'bei'} ${esc(f.opp || 'k. A.')}</span><span><i class="res-dot ${f.r}"></i>${esc(f.score)}</span></div>`).join('')}</div></section>`;
    }
    const h = o.h2h;
    if (h && h.w + h.d + h.l > 0) {
      const n = h.w + h.d + h.l;
      out += `<section class="sec"><div class="sec-h"><h2>Direkter Vergleich</h2><span class="note">${n} Spiele</span></div><div class="card"><div class="h2h-top"><span><b class="yellow">${h.w}</b>Siege</span><span><b>${h.d}</b>Remis</span><span><b class="red">${h.l}</b>Niederl.</span></div>
        <div class="h2h-bar"><i class="W" style="width:${(h.w / n * 100).toFixed(1)}%"></i><i class="D" style="width:${(h.d / n * 100).toFixed(1)}%"></i><i class="L" style="width:${(h.l / n * 100).toFixed(1)}%"></i></div>
        ${(h.last || []).map((g) => `<div class="kv"><span>${esc(fmtDate(g.date))} · ${esc(shortComp(g.comp))}</span><span><i class="res-dot ${g.r}"></i>${g.home ? 'BVB' : esc(tname(opp))} ${esc(g.score)} ${g.home ? esc(tname(opp)) : 'BVB'}</span></div>`).join('')}</div></section>`;
    }
    if (!h && !(o.form || []).length && !oppT) out += '<div class="empty" style="margin-top:14px">Die Gegner-Infos kommen in den Tagen vor dem Spiel.</div>';
    return out;
  }
  function mcTipp(m) {
    const t = myTip(m.id);
    const k = kiTip(m);
    const opp = oppOf(m);
    let out = '';
    if (tipOpen(m)) {
      const d = S.tipDraft && S.tipDraft.id === m.id ? S.tipDraft : { id: m.id, bvb: t ? t.bvb : 1, opp: t ? t.opp : 1 };
      S.tipDraft = d;
      const side = (who, label, c) => `<div class="tp-side">${crest(c, 'crest md')}<b>${esc(label)}</b><div class="tp-step"><button type="button" data-action="tip-step" data-who="${who}" data-d="-1" aria-label="${esc(label)}: ein Tor weniger">−</button><span class="tp-num" data-tipnum="${who}">${d[who]}</span><button type="button" data-action="tip-step" data-who="${who}" data-d="1" aria-label="${esc(label)}: ein Tor mehr">+</button></div></div>`;
      const a = side('bvb', 'BVB', BVB);
      const b = side('opp', tname(opp), opp);
      out += `<section class="card tp-card" style="margin-top:14px"><span class="eyebrow">Dein Tipp</span><div class="tp-row">${m.isHome ? a : b}<span class="tp-colon">:</span>${m.isHome ? b : a}</div>
        ${(mcOf(m.id).model || {}).probs ? `<div class="tp-prob"><span class="eyebrow">Gewinnchancen BVB · ${esc(srcTxt(mcOf(m.id).model))}</span>${probBar(mcOf(m.id).model)}</div>` : ''}
        <button type="button" class="btn" data-action="tip-save" data-id="${esc(m.id)}">${t ? 'Tipp ändern' : 'Tipp abgeben'}</button>
        <p class="faint" style="font-size:12px;font-weight:600;text-align:center">${t ? `Gespeichert: ${tipStr(t, m)} · änderbar bis zum Anpfiff` : 'Änderbar bis zum Anpfiff'}</p></section>`;
    } else {
      const pm = tipPts(t, m);
      const pk = tipPts(k, m);
      const col = (label, val, pts, cls = '') => `<div><span class="eyebrow">${label}</span><b class="${cls}">${val}</b>${pts != null ? `<span class="pts p${pts}">+${pts}</span>` : ''}</div>`;
      out += `<section class="card tp-res" style="margin-top:14px"><div class="tp-cols">${col('Dein Tipp', t ? tipStr(t, m) : '–', pm)}${col('Ergebnis', m.finished && m.score ? scoreStr(m) : 'läuft', null, 'yellow')}${col('KI-Tipp', k ? tipStr(k, m) : '–', pk)}</div>
        <p class="faint" style="font-size:12px;font-weight:600;text-align:center">${!m.finished ? 'Punkte gibt es nach dem Abpfiff.' : !t ? 'Für dieses Spiel hast du nicht getippt.' : pm === 3 ? 'Volltreffer!' : pm ? 'Gut getippt!' : 'Diesmal leider daneben.'}</p></section>`;
    }
    const s = tipStats();
    out += `<a class="card row press" href="#/mehr/tippspiel" style="margin-top:12px;gap:12px;color:var(--text)"><span class="ai-badge">${I.trophy}</span><span class="grow"><span class="eyebrow">Tippspiel</span><div style="font-size:17px;font-weight:900;margin-top:2px">Du ${s.me} : ${s.ki} KI</div></span><span class="chip ghost">Alle Tipps</span></a>`;
    return out + tipRules();
  }
  function mcHero(m, e, live, fin) {
    const n = daysUntil(m.date);
    const when = live ? 'Läuft' : fin ? RES_T[m.outcome] || 'Beendet' : n === 0 ? 'Heute' : n === 1 ? 'Morgen' : n > 1 ? `in ${n} Tagen` : '';
    const venue = e.venue || (e.game || {}).venue;
    const goals = (m.goals || []).map((g) => `<span class="goal ${g.team === 'away' ? 'away' : ''}"><time>${g.minute != null ? g.minute + "'" : ''}</time><span>${esc(g.scorer || 'Tor')}${g.penalty ? ' (E)' : ''}${g.ownGoal ? ' (ET)' : ''}</span><b>${esc(g.score || '')}</b></span>`).join('');
    return `<section class="mhero mc-hero ${live ? 'live' : ''} ${fin ? 'res ' + (m.outcome || '') : ''}">
      <span class="mh-light" aria-hidden="true"></span><span class="mh-beam l" aria-hidden="true"></span><span class="mh-beam r" aria-hidden="true"></span>
      <span class="mh-top">${live ? `<span class="live-tag">LIVE${S.mcClockId === m.id && S.mcClock ? ' · ' + esc(S.mcClock) : ''}</span>` : `<span class="chip y">${esc(compRound(m))}</span>`}<span class="eyebrow" style="color:var(--y)">${esc(when)}</span></span>
      <span class="mh-teams" style="display:grid">
        <span class="mh-team">${crest(m.home, 'crest')}<span class="mh-name ellipsis">${esc(tname(m.home))}</span></span>
        ${fin || live ? `<span class="mc-score"><span class="mh-score" data-mc-score>${scoreStr(m)}</span>${m.half ? `<span class="eyebrow">HZ ${m.half[0]}:${m.half[1]}</span>` : ''}</span>` : `<span class="mc-ko"><b>${m.timeKnown === false ? '--:--' : esc(F.time.format(new Date(m.date)))}</b><span class="eyebrow">Uhr</span></span>`}
        <span class="mh-team">${crest(m.away, 'crest')}<span class="mh-name ellipsis">${esc(tname(m.away))}</span></span>
      </span>
      <span class="mh-meta" style="display:block">${esc(F.day.format(new Date(m.date)))}${venue ? ' · ' + esc(venue) : ''}${(e.game || {}).attendance ? ' · ' + nf0.format(e.game.attendance) + ' Zuschauer' : ''}</span>
      ${!fin && !live ? odoHtml(m.date) : goals ? `<span class="goals" style="display:flex">${goals}</span>` : ''}
    </section>`;
  }
  function vSpiel(id, tab) {
    const m = matchById(id);
    if (!m) return pageHead('Spiel', '', '', '#/spiele') + '<div class="empty">Spiel nicht gefunden.</div>';
    const e = mcOf(id);
    const live = isLive(m);
    const fin = !!(m.finished && m.score);
    const t = tab || (fin || live ? 'spiel' : 'vorbericht');
    let out = mcHero(m, e, live, fin);
    out += `<div style="margin-top:14px">${seg('mc', [['vorbericht', 'Vorbericht', `#/spiel/${id}/vorbericht`], ['spiel', live ? 'Live' : 'Spiel', `#/spiel/${id}/spiel`], ['gegner', 'Gegner', `#/spiel/${id}/gegner`], ['tipp', 'Tipp', `#/spiel/${id}/tipp`]], t)}</div>`;
    if (t === 'gegner') out += mcGegner(m, e);
    else if (t === 'tipp') out += mcTipp(m);
    else if (t === 'spiel') out += (fin ? reportSection(m, e) + videoSection(m, e) : '') + `<div id="mc-live" data-id="${esc(id)}">${mcLiveHtml(m, e, espnCached(e.espn))}</div>` + (fin ? playersSection(m, e) : '');
    else out += mcVorbericht(m, e);
    return out;
  }
  // nach dem Rendern: Live-Daten von ESPN holen und am Spieltag alle 30 Sek. auffrischen
  function mcAfter(v) {
    clearInterval(S.mcTimer);
    S.mcTimer = null;
    const box = $('#mc-live', v);
    if (!box) return;
    const id = box.dataset.id;
    const e = mcOf(id);
    const m0 = matchById(id);
    if (!m0 || !e.espn) return;
    const ko = Date.parse(m0.date);
    const active = !m0.finished && Date.now() > ko - 2 * 36e5 && Date.now() < ko + 4 * 36e5;
    const load = async () => {
      const x = await espnLive(e.espn, active ? 20000 : 36e5);
      const cur = $('#mc-live');
      const m = matchById(id);
      if (!cur || cur.dataset.id !== id || !x || !m) return;
      if (x.state === 'in') { S.mcClock = x.clock; S.mcClockId = id; }
      cur.innerHTML = mcLiveHtml(m, e, x);
      // Spielstand: der aktuellere Stand gewinnt (ESPN oder OpenLigaDB - Tore werden nur mehr)
      const sc = $('[data-mc-score]');
      const shown = (sc ? sc.textContent.split(':') : []).map(Number);
      if (sc && x.score && x.state !== 'pre' && x.score[0] + x.score[1] > (shown[0] || 0) + (shown[1] || 0)) sc.textContent = m.isHome ? `${x.score[0]}:${x.score[1]}` : `${x.score[1]}:${x.score[0]}`;
      const lt = $('.mc-hero .live-tag');
      if (lt && x.state === 'in' && x.clock) lt.textContent = 'LIVE · ' + x.clock;
    };
    load();
    if (active) S.mcTimer = setInterval(load, 30000);
  }

  // Tippspiel-Seite
  function vTippspiel() {
    const s = tipStats();
    const open = matchList().filter(tipOpen).slice(0, 6);
    const un = userName();
    let out = pageHead('Tipp<em>spiel</em>', esc(un || 'Du') + ' gegen die KI', '', '#/mehr');
    const lead = s.me > s.ki ? `${un ? un + ', du' : 'Du'} liegst vorne!` : s.me < s.ki ? `Die KI führt – hol sie dir${un ? ', ' + un : ''}!` : s.n ? 'Gleichstand!' : 'Tippe das nächste Spiel und fordere die KI heraus.';
    out += `<section class="card-y stripes tp-hero"><div class="tp-score"><div><span class="eyebrow">${esc(un || 'Du')}</span><b>${s.me}</b></div><span class="tp-vs">:</span><div><span class="eyebrow">KI</span><b>${s.ki}</b></div></div><p>${esc(lead)}</p></section>`;
    out += `<div class="grid3" style="margin-top:12px"><div class="stat-box"><b>${s.exact}</b><span>Volltreffer</span></div><div class="stat-box"><b>${s.n ? Math.round(s.hits / s.n * 100) : 0}%</b><span>Trefferquote</span></div><div class="stat-box"><b>${s.streak}</b><span>Serie</span></div></div>`;
    if (open.length) {
      out += `<section class="sec"><div class="sec-h"><h2>Offene Tipps</h2></div><div class="card flat"><div class="list">${open.map((m) => { const t = myTip(m.id); return `<a class="li" href="#/spiel/${esc(m.id)}/tipp">${crest(oppOf(m), 'crest sm')}<span class="grow"><div class="t ellipsis">${esc(tname(m.home))} – ${esc(tname(m.away))}</div><div class="s">${esc(dayLabel(m.date))} · ${m.timeKnown === false ? 'Uhrzeit offen' : esc(F.time.format(new Date(m.date))) + ' Uhr'} · ${esc(compShort(m.comp))}</div></span>${t ? `<span class="chip y">${tipStr(t, m)}</span>` : '<span class="chip ghost">Tippen</span>'}</a>`; }).join('')}</div></div></section>`;
    }
    if (s.rows.length) {
      out += `<section class="sec"><div class="sec-h"><h2>Ausgewertet</h2><span class="note">Du · KI</span></div><div class="card flat"><div class="list">${s.rows.slice().reverse().map(({ m, t, k, pm, pk }) => `<a class="li" href="#/spiel/${esc(m.id)}/tipp">${crest(oppOf(m), 'crest sm')}<span class="grow"><div class="t ellipsis">${esc(tname(m.home))} ${scoreStr(m)} ${esc(tname(m.away))}</div><div class="s">${esc(fmtDate(m.date))}</div></span><span class="tp-mini"><span>${t ? tipStr(t, m) : '–'}${pm != null ? ` <b class="pts p${pm}">+${pm}</b>` : ''}</span><span class="faint">KI ${k ? tipStr(k, m) : '–'}${pk != null ? ` <b class="pts p${pk}">+${pk}</b>` : ''}</span></span></a>`).join('')}</div></div></section>`;
    } else {
      out += '<div class="empty" style="margin-top:14px">Noch keine ausgewerteten Tipps. Gib für das nächste Spiel deinen Tipp ab!</div>';
    }
    return out + tipRules();
  }

  // Formkurve im Spielerprofil
  function formRows(p) {
    const rows = [];
    for (const m of matchList().filter((x) => x.finished && x.score)) {
      const gp = (mcOf(m.id).game || {}).players;
      if (gp) rows.push({ m, v: gp[p.id] || null });
    }
    return rows.slice(-10);
  }
  function formCurve(p) {
    const rows = formRows(p);
    if (!rows.some((r) => r.v)) return '';
    S.fcRows = rows;
    const sum = rows.reduce((a, r) => (r.v ? { n: a.n + 1, g: a.g + r.v.g, a: a.a + r.v.a, min: a.min + (r.v.min || 0) } : a), { n: 0, g: 0, a: 0, min: 0 });
    return `<section class="sec"><div class="sec-h"><h2>Formkurve</h2><span class="note">letzte ${rows.length} Spiele</span></div><div class="card fc">
      <div class="fc-bars">${rows.map((r, i) => {
        const v = r.v;
        const h = v && v.min ? Math.max(8, Math.min(100, v.min / 90 * 100)) : 0;
        const o = oppOf(r.m);
        return `<button type="button" class="fc-col" data-action="fc" data-i="${i}" aria-label="${esc(fmtDate(r.m.date))} gegen ${esc(o.name || '')}: ${v ? (v.min || 0) + ' Minuten, ' + v.g + ' Tore, ' + v.a + ' Vorlagen' : 'nicht eingesetzt'}"><span class="fc-marks">${v ? '<i class="g"></i>'.repeat(Math.min(v.g, 3)) + '<i class="a"></i>'.repeat(Math.min(v.a, 3)) : ''}</span><span class="fc-track"><span class="fc-bar ${v ? (v.s ? 'st' : 'sub') : ''}" style="height:${h}%;animation-delay:${(i * 0.05).toFixed(2)}s"></span></span><span class="fc-lbl">${esc(abbr(o.name))}</span></button>`;
      }).join('')}</div>
      <div class="fc-legend"><span><i class="st"></i>Startelf</span><span><i class="sub"></i>Eingewechselt</span><span><i class="g"></i>Tor</span><span><i class="a"></i>Vorlage</span></div>
      <div class="fc-info" data-fc-info>${sum.n} Einsätze · ${sum.g} ${sum.g === 1 ? 'Tor' : 'Tore'} · ${sum.a} ${sum.a === 1 ? 'Vorlage' : 'Vorlagen'} · Ø ${sum.n ? Math.round(sum.min / sum.n) : 0} Min. – tippe auf einen Balken</div></div></section>`;
  }
  function fcInfo(i) {
    const r = (S.fcRows || [])[i];
    const box = $('[data-fc-info]');
    if (!r || !box) return;
    $$('.fc-col').forEach((b, j) => b.classList.toggle('on', j === i));
    const v = r.v;
    box.textContent = `${fmtDate(r.m.date)} · ${r.m.isHome ? 'gegen' : 'bei'} ${tname(oppOf(r.m))} ${scoreStr(r.m)} · ${v ? `${v.min != null ? v.min + ' Min.' : 'Minuten k. A.'}${v.s ? ' (Startelf)' : ' (eingewechselt)'}${v.g ? ' · ' + v.g + (v.g === 1 ? ' Tor' : ' Tore') : ''}${v.a ? ' · ' + v.a + (v.a === 1 ? ' Vorlage' : ' Vorlagen') : ''}` : 'nicht eingesetzt'}`;
  }

  // BVB Wrapped: Monats- und Saison-Rückblick als Story
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const monthName = (ym) => `${MONTHS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
  const seasonName = () => { const s = +((D.matches || {}).season) || new Date().getFullYear(); return `Saison ${String(s).slice(2)}/${String(s + 1).slice(2)}`; };
  const ymOf = (m) => berlinYMD(m.date).slice(0, 7);
  function wrapData(key) {
    const gs = matchList().filter((m) => m.finished && m.score && (key === 'season' || ymOf(m) === key));
    if (!gs.length) return null;
    const x = { key, gs, w: 0, d: 0, l: 0, gf: 0, ga: 0, best: null, run: 0, me: 0, ki: 0, tipped: 0 };
    const goals = {};
    const assists = {};
    let cur = 0;
    for (const m of gs) {
      x[{ W: 'w', D: 'd', L: 'l' }[m.outcome] || 'd'] += 1;
      const s = bvbScore(m);
      x.gf += s[0]; x.ga += s[1];
      if (!x.best || s[0] - s[1] > x.best.diff || (s[0] - s[1] === x.best.diff && s[0] > x.best.gf)) x.best = { m, diff: s[0] - s[1], gf: s[0] };
      cur = m.outcome === 'L' ? 0 : cur + 1;
      x.run = Math.max(x.run, cur);
      const gp = (mcOf(m.id).game || {}).players;
      if (gp) {
        for (const [id, v] of Object.entries(gp)) { goals[id] = (goals[id] || 0) + v.g; assists[id] = (assists[id] || 0) + v.a; }
      } else {
        for (const g of m.goals || []) {
          if (g.ownGoal || (g.team === 'home') !== m.isHome) continue;
          const p = scorerPlayer(g.scorer);
          if (p) goals[p.id] = (goals[p.id] || 0) + 1;
        }
      }
      const pm = tipPts(myTip(m.id), m);
      const pk = tipPts(kiTip(m), m);
      if (pm != null) { x.me += pm; x.tipped += 1; }
      if (pk != null) x.ki += pk;
    }
    const top = (o) => { const en = Object.entries(o).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1])[0]; const p = en && findPlayer('profis', en[0]); return p ? { p, n: en[1] } : null; };
    x.tg = top(goals);
    x.ta = top(assists);
    x.fazit = key === 'season' ? null : (((D.matchcenter || {}).months || {})[key] || {}).text || null;
    return x;
  }
  const playerSlide = (label, t, unit) => `<span class="eyebrow">${label}</span><div class="wr-player">${img(pimg(t.p.img, 'big'), 'wr-img', t.p.name, 'sil')}</div><h2 class="wr-name">${esc(t.p.name)}</h2><div class="wr-stat"><b>${t.n}</b> ${unit}</div>`;
  function wrapSlides(x) {
    const label = x.key === 'season' ? seasonName() : monthName(x.key);
    const s = [{ cls: 'w1', html: `<div class="wr-orb" aria-hidden="true"></div><span class="eyebrow">BVB 09 · Rückblick${userName() ? ' für ' + esc(userName()) : ''}</span><h1 class="wr-title">${esc(label)}</h1><p class="wr-sub">${x.gs.length} ${x.gs.length === 1 ? 'Spiel' : 'Spiele'} – hier ist die Bilanz.</p>` }];
    s.push({ cls: 'w2', html: `<span class="eyebrow">Bilanz</span><div class="wr-big">${x.w}<small>${x.w === 1 ? 'Sieg' : 'Siege'}</small></div><div class="wr-trio"><span><b>${x.d}</b>Remis</span><span><b>${x.l}</b>Niederl.</span><span><b>${x.gf}:${x.ga}</b>Tore</span></div>` });
    if (x.tg) s.push({ cls: 'w3', html: playerSlide('Top-Torschütze', x.tg, x.tg.n === 1 ? 'Tor' : 'Tore') });
    if (x.ta) s.push({ cls: 'w4', html: playerSlide('Top-Vorlagengeber', x.ta, x.ta.n === 1 ? 'Vorlage' : 'Vorlagen') });
    if (x.best && x.best.diff > 0) {
      const m = x.best.m;
      s.push({ cls: 'w5', confetti: true, html: `<span class="eyebrow">Bestes Spiel</span><div class="wr-match">${crest(m.home, 'crest xl')}<b>${scoreStr(m)}</b>${crest(m.away, 'crest xl')}</div><p class="wr-sub">${esc(tname(m.home))} – ${esc(tname(m.away))}<br>${esc(fmtDate(m.date))} · ${esc(m.comp || '')}</p>` });
    }
    if (x.run >= 2) s.push({ cls: 'w6', html: `<span class="eyebrow">Serie</span><div class="wr-big">${x.run}<small>Spiele am Stück ungeschlagen</small></div>` });
    if (x.tipped) s.push({ cls: 'w7', html: `<span class="eyebrow">Dein Tippspiel</span><div class="wr-duel"><span><b>${x.me}</b>${esc(userName() || 'Du')}</span><i>:</i><span><b>${x.ki}</b>KI</span></div><p class="wr-sub">${x.me > x.ki ? 'Du hast die KI geschlagen!' : x.me < x.ki ? 'Die KI war diesmal besser.' : 'Unentschieden gegen die KI.'}</p>` });
    if (x.fazit) s.push({ cls: 'w8', html: `<span class="ai-badge live">${I.ai}</span><span class="eyebrow">KI-Fazit</span><p class="wr-quote">${esc(x.fazit)}</p>` });
    const nm = nextMatch('profis');
    s.push({ cls: 'w9', html: `<div class="wr-orb" aria-hidden="true"></div><span class="eyebrow">Weiter geht's</span><h1 class="wr-title">Heja BVB!</h1>${nm ? `<p class="wr-sub">Nächstes Spiel: ${esc(tname(nm.home))} – ${esc(tname(nm.away))}<br>${esc(dayLabel(nm.date))} · ${nm.timeKnown === false ? 'Uhrzeit offen' : esc(F.time.format(new Date(nm.date))) + ' Uhr'}</p>` : ''}` });
    return s;
  }
  const WR = { slides: [], i: 0 };
  function openWrapped(key) {
    const x = wrapData(key);
    if (!x) { toast('In diesem Zeitraum gab es noch keine Spiele'); return; }
    WR.slides = wrapSlides(x);
    WR.i = 0;
    let el = $('#wrapped');
    if (!el) {
      el = document.createElement('div');
      el.id = 'wrapped';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', 'Rückblick');
      document.body.appendChild(el);
    }
    el.hidden = false;
    document.body.style.overflow = 'hidden';
    renderWrapped();
  }
  function renderWrapped() {
    const el = $('#wrapped');
    const s = WR.slides[WR.i];
    if (!el || !s) { closeWrapped(); return; }
    el.className = 'wr ' + s.cls;
    el.innerHTML = `<div class="st-bars">${WR.slides.map((_, j) => `<span class="st-bar ${j < WR.i ? 'done' : j === WR.i ? 'on' : ''}"><i></i></span>`).join('')}</div>
      <button type="button" class="st-close wr-close" data-action="wr-close" aria-label="Rückblick schließen">${I.x}</button>
      <section class="wr-slide" aria-live="polite">${s.html}</section>
      <button type="button" class="st-tap prev" data-action="wr-prev" aria-label="Zurück" style="background:none;border:0"></button>
      <button type="button" class="st-tap next" data-action="wr-next" aria-label="Weiter" style="background:none;border:0"></button>`;
    const bar = $('.st-bar.on i', el);
    if (bar && !reduce) bar.addEventListener('animationend', () => wrStep(1), { once: true });
    if (s.confetti) setTimeout(confetti, 350);
  }
  function wrStep(d) {
    const n = WR.i + d;
    if (n < 0) return;
    if (n >= WR.slides.length) { closeWrapped(); return; }
    WR.i = n;
    renderWrapped();
  }
  function closeWrapped() {
    const el = $('#wrapped');
    if (!el || el.hidden) return;
    el.hidden = true;
    el.innerHTML = '';
    document.body.style.overflow = '';
  }
  function vRueckblick() {
    const months = [...new Set(matchList().filter((m) => m.finished && m.score).map(ymOf))].reverse();
    let out = pageHead('Rück<em>blick</em>', 'Deine BVB-Bilanz als Story', '', '#/mehr');
    if (!months.length) return out + '<div class="empty">Noch keine Spiele in dieser Saison.</div>';
    const x = wrapData('season');
    out += `<button type="button" class="wr-card press" data-action="wrapped" data-key="season"><span class="eyebrow">${esc(seasonName())}</span><b>Saison-<br>Rückblick</b><span>${x.gs.length} Spiele · ${x.w} Siege · ${x.gf}:${x.ga} Tore</span><span class="wr-play" aria-hidden="true">▶</span></button>`;
    out += `<section class="sec"><div class="sec-h"><h2>Monate</h2><span class="note">als Story ansehen</span></div><div class="grid2">${months.map((ym) => {
      const y = wrapData(ym);
      return `<button type="button" class="wr-mcard press" data-action="wrapped" data-key="${ym}"><b>${esc(MONTHS[+ym.slice(5, 7) - 1])}</b><span>${y.w} S · ${y.d} U · ${y.l} N · ${y.gf}:${y.ga}</span>${formHtml(y.gs.map((m) => m.outcome).filter(Boolean).slice(-5), 'sm')}</button>`;
    }).join('')}</div></section>`;
    return out;
  }
  function wrapHomeCard() {
    const now = new Date();
    if (+F.dd.format(now) > 7) return '';
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const ym = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;
    if (store.get('wrapSeen', '') === ym) return '';
    const x = wrapData(ym);
    if (!x) return '';
    return `<button type="button" class="wr-home press" data-action="wrapped" data-key="${ym}"><span class="wr-home-ring" aria-hidden="true"></span><span class="grow"><span class="eyebrow">Neu · Rückblick</span><b>Dein ${esc(MONTHS[+ym.slice(5, 7) - 1])} mit dem BVB</b><span>${x.gs.length} Spiele · ${x.w} Siege – jetzt als Story ansehen</span></span><span class="wr-play" aria-hidden="true">▶</span></button>`;
  }

  // "Seit deinem letzten Besuch"
  function visitSnapshot() {
    const n = D.news || {};
    return { at: Date.now(), fin: matchList().filter((m) => m.finished).map((m) => m.id), st: Object.fromEntries((n.stories || []).map((s) => [s.key, s.status])),
      inj: (n.injuryNews || []).map((i) => `${slug(i.player)}|${i.status}|${i.date}`), brief: (n.briefing || {}).at || null };
  }
  function computeSince() {
    const prev = store.get('visit', null);
    const now = visitSnapshot();
    store.set('visit', now);
    if (!prev || !prev.at || Date.now() - prev.at < 2 * 36e5) return null;
    const items = [];
    for (const m of matchList().filter((x) => x.finished && x.score && !(prev.fin || []).includes(x.id))) items.push({ k: 'res ' + (m.outcome || ''), t: `${tname(m.home)} ${scoreStr(m)} ${tname(m.away)}`, s: RES_T[m.outcome] || 'Ergebnis', h: '#/spiel/' + m.id });
    for (const s of (D.news || {}).stories || []) if ((prev.st || {})[s.key] !== s.status) items.push({ k: 'tr', t: s.player, s: ((prev.st || {})[s.key] ? 'Jetzt: ' : 'Neu: ') + ((STATUS[s.status] || {}).label || s.status), h: '#/transfers/news' });
    for (const i of (D.news || {}).injuryNews || []) if (!(prev.inj || []).includes(`${slug(i.player)}|${i.status}|${i.date}`)) items.push({ k: 'inj', t: i.player, s: `${INJ[i.status] || ''} ${i.text || ''}`.trim(), h: '#/mehr/lazarett' });
    if (now.brief && now.brief !== prev.brief) items.push({ k: 'ai', t: 'Neues KI-Briefing', s: 'Gemini hat die Lage zusammengefasst', h: '#/home' });
    return items.length ? { at: prev.at, items } : null;
  }
  function sinceCard() {
    const x = S.since;
    if (!x || S.sinceOff) return '';
    return `<section class="since card"><div class="row" style="justify-content:space-between;gap:10px"><span><span class="eyebrow">Seit deinem letzten Besuch</span><div class="faint" style="font-size:11px;font-weight:600;margin-top:2px">${esc(rel(new Date(x.at).toISOString()))}</div></span><button type="button" class="chip ghost" data-action="since-off">Alles klar</button></div>
      <div class="since-list">${x.items.slice(0, 5).map((it) => `<a class="since-it" href="${it.h}"><i class="since-ic ${it.k}" aria-hidden="true"></i><span class="grow"><b class="ellipsis">${esc(it.t)}</b><span class="ellipsis">${esc(it.s)}</span></span></a>`).join('')}${x.items.length > 5 ? `<p class="faint" style="font-size:11px;font-weight:600;margin-top:8px">+ ${x.items.length - 5} weitere Neuigkeiten</p>` : ''}</div></section>`;
  }

  // Stimmungsbarometer
  function gaugeSvg(score) {
    const a = Math.PI * (1 - score / 100);
    const x = 50 + 38 * Math.cos(a);
    const y = 50 - 38 * Math.sin(a);
    return `<svg class="gauge" viewBox="0 0 100 58" aria-hidden="true"><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="#FF5A4E"/><stop offset=".5" stop-color="#FFB020"/><stop offset="1" stop-color="#FDE100"/></linearGradient></defs>
      <path d="M12 50 A38 38 0 0 1 88 50" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="9" stroke-linecap="round"/>
      <path class="gauge-arc" d="M12 50 A38 38 0 0 1 88 50" fill="none" stroke="url(#gg)" stroke-width="9" stroke-linecap="round" pathLength="100" stroke-dasharray="${score} 100"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="#fff" stroke="#050505" stroke-width="2.5"/></svg>`;
  }
  function moodTile() {
    const md = (D.news || {}).mood;
    if (!md || md.score == null) return '';
    return `<button type="button" class="tile mood-tile" data-action="mood"><span class="eyebrow">Stimmung</span><span class="mood-g">${gaugeSvg(md.score)}<b>${md.score}</b></span><span class="big" style="font-size:22px;margin-top:auto">${esc(md.label || '')}</span><span class="sub">Gemini · ${esc(rel(md.at))}</span></button>`;
  }
  function openMood() {
    const n = D.news || {};
    const md = n.mood || {};
    const h = (n.moodHistory || []).slice(-30);
    const spark = h.length >= 2 ? `<svg viewBox="0 0 300 74" class="mood-spark" role="img" aria-label="Verlauf der Stimmung"><polyline points="${h.map((p, i) => `${(i / (h.length - 1) * 300).toFixed(1)},${(68 - p[1] * 0.6).toFixed(1)}`).join(' ')}" fill="none" stroke="#FDE100" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>` : '';
    openSheet(`<div style="display:flex;flex-direction:column;gap:14px;padding-top:4px"><span class="eyebrow">Stimmungsbarometer</span>
      <div class="row" style="gap:16px"><span class="mood-g lg">${gaugeSvg(md.score || 0)}<b>${md.score != null ? md.score : '–'}</b></span><span class="grow"><b class="display" style="font-size:30px;text-transform:uppercase">${esc(md.label || 'k. A.')}</b><p class="muted" style="font-size:13px;line-height:1.5;margin-top:4px">${esc(md.reason || '')}</p></span></div>
      ${spark ? `<div><span class="eyebrow">Verlauf · ${h.length} Tage</span>${spark}</div>` : ''}
      <p class="faint" style="font-size:11px;font-weight:600;line-height:1.6">0 = Krise · 50 = normal · 100 = Euphorie. Gemini bewertet täglich die Schlagzeilen rund um den BVB.</p>
      <button type="button" class="btn" data-close>Schließen</button></div>`);
  }

  // Live-Leiste auf jeder Seite, solange der BVB spielt
  function liveBar() {
    const m = matchList().find((x) => isLive(x));
    let el = $('#livebar');
    const show = m && !(S.route || '').startsWith('/spiel/' + m.id);
    document.body.classList.toggle('has-live', !!show);
    if (!show) { if (el) el.hidden = true; return; }
    if (!el) { el = document.createElement('a'); el.id = 'livebar'; document.body.appendChild(el); }
    el.href = '#/spiel/' + m.id;
    el.hidden = false;
    el.innerHTML = `<span class="lb-dot" aria-hidden="true"></span><b>LIVE</b>${S.mcClockId === m.id && S.mcClock ? `<span class="lb-min">${esc(S.mcClock)}</span>` : ''}<span class="lb-t">${esc(tname(m.home))} <b>${scoreStr(m)}</b> ${esc(tname(m.away))}</span>`;
  }

  // Tor-Feier bei einem BVB-Tor (solange die App offen ist)
  function goalFx(g, m) {
    const p = g.ownGoal ? null : scorerPlayer(g.scorer);
    let el = $('#goalfx');
    if (!el) {
      el = document.createElement('div');
      el.id = 'goalfx';
      el.setAttribute('role', 'alert');
      document.body.appendChild(el);
      el.addEventListener('click', hideGoalFx);
    }
    el.innerHTML = `<div class="gf-rays" aria-hidden="true"></div><div class="gf-flash" aria-hidden="true"></div><div class="gf-in">
      ${p && p.img ? `<div class="gf-photo">${img(pimg(p.img, 'big'), 'gf-img', p.name, 'sil')}</div>` : ''}
      <div class="gf-word" aria-label="Tor für den BVB">${'TOOOR!'.split('').map((c, i) => `<span style="animation-delay:${(0.08 + i * 0.06).toFixed(2)}s">${c}</span>`).join('')}</div>
      <div class="gf-name">${esc(g.ownGoal ? `Eigentor ${g.scorer || ''}`.trim() : p ? p.name : g.scorer || 'Borussia Dortmund')}</div>
      <div class="gf-score">${esc(tname(m.home))} <b>${esc(g.score || scoreStr(m))}</b> ${esc(tname(m.away))}${g.minute != null ? ` · ${g.minute}'` : ''}</div></div>`;
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('on');
    if (SET.horn) playHorn();
    confetti();
    clearTimeout(S.gfT);
    S.gfT = setTimeout(hideGoalFx, 5200);
  }
  function hideGoalFx() {
    const el = $('#goalfx');
    if (!el || el.hidden) return;
    el.classList.remove('on');
    setTimeout(() => { el.hidden = true; }, reduce ? 0 : 350);
  }

  // ------------------------------------------------------------------ Einstellungen
  const swBtn = (key, on, label) => `<button type="button" class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" data-action="set" data-key="${key}"><i></i></button>`;
  const setRow = (title, sub, ctrl, ic) => `<div class="set-row">${ic ? `<span class="set-ic" aria-hidden="true">${ic}</span>` : ''}<span class="grow"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</span>${ctrl}</div>`;
  function homeRow(k, L) {
    const b = HOME_BLOCKS.find((x) => x[0] === k);
    const on = !L.hidden[k];
    return `<div class="ho-row ${on ? '' : 'off'}" data-k="${k}"><button type="button" class="ho-grip" data-grip aria-label="${esc(b[1])} verschieben (Pfeiltasten)">${I.grip}</button><span class="ho-ic" aria-hidden="true">${I[b[3]] || ''}</span><span class="grow ho-t">${esc(b[1])}</span><button type="button" class="sw sm ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${esc(b[1])} anzeigen" data-action="home-vis" data-k="${k}"><i></i></button></div>`;
  }
  function moveHome(k, d) {
    const L = homeLayout();
    const i = L.order.indexOf(k);
    const j = i + d;
    if (i < 0 || j < 0 || j >= L.order.length) return;
    L.order.splice(j, 0, L.order.splice(i, 1)[0]);
    saveHome(L.order, L.hidden);
    const list = $('#homeorder');
    if (list) list.innerHTML = L.order.map((x) => homeRow(x, L)).join('');
    const g = $(`#homeorder [data-k="${k}"] [data-grip]`);
    if (g) g.focus();
  }
  function vSettings() {
    const L = homeLayout();
    const fp = favPlayers();
    const tips = Object.keys(tipsAll()).length;
    const motionSub = SET.motion === 'full' ? 'Immer alle Effekte' : SET.motion === 'reduced' ? 'Ruhig, ohne große Bewegungen' : osReduce.matches ? 'Automatisch – dein iPhone hat „Bewegung reduzieren“ an' : 'Automatisch – volle Effekte';
    let out = pageHead('Einstel<em>lungen</em>', 'Gespeichert auf diesem Gerät', '', '#/mehr');
    out += `<section class="set-me stripes"><span class="set-av" aria-hidden="true">${esc(initials(userName() || 'BVB'))}</span><span class="grow"><label class="eyebrow" for="set-name">Dein Name</label>
      <input id="set-name" class="set-name" type="text" maxlength="24" autocomplete="given-name" autocapitalize="words" enterkeyhint="done" spellcheck="false" value="${esc(SET.name || '')}" placeholder="Wie heißt du?" data-set="name"></span></section>
      <p class="set-hint">Mit deinem Namen begrüßt dich die Startseite.</p>`;
    out += `<section class="sec"><div class="sec-h"><h2>Design</h2></div><div class="card flat">
      ${setRow('Tageszeit-Design', 'Licht und Stimmung wechseln mit Morgen, Tag, Abend und Nacht – am Spieltag mit Flutlicht', swBtn('daytime', SET.daytime, 'Tageszeit-Design'), I.sun)}
      <div class="set-row col"><span class="set-ic" aria-hidden="true">${I.motion}</span><span class="grow"><b>Animationen</b><span>${esc(motionSub)}</span></span>
        <div class="set-seg" role="group" aria-label="Animationen">${[['auto', 'Automatisch'], ['full', 'Voll'], ['reduced', 'Reduziert']].map(([v, l]) => `<button type="button" class="${SET.motion === v ? 'on' : ''}" aria-pressed="${SET.motion === v}" data-action="set" data-key="motion" data-val="${v}">${l}</button>`).join('')}</div></div>
      ${setRow('Torhorn', 'Ertönt bei einem BVB-Tor, solange die App offen ist (nicht im Lautlos-Modus)', swBtn('horn', SET.horn, 'Torhorn'), I.horn)}
      <div class="set-row"><button type="button" class="btn ghost set-btn" data-action="horn-test">${I.horn} Torhorn testen</button></div>
    </div></section>`;
    out += `<section class="sec"><div class="sec-h"><h2>Startseite</h2><button type="button" class="more" data-action="home-reset">Zurücksetzen</button></div>
      <p class="set-hint" style="margin:-4px 2px 12px">Halte den Griff gedrückt und schieb die Blöcke in deine Reihenfolge. Mit dem Schalter blendest du einen Block aus.</p>
      <div class="card flat ho-list" id="homeorder">${L.order.map((k) => homeRow(k, L)).join('')}</div></section>`;
    out += `<section class="sec"><div class="sec-h"><h2>Deine Spieler</h2><a class="more" href="#/kader/profis">Hinzufügen</a></div><div class="card flat">
      ${fp.length ? `<div class="list">${fp.map((p) => `<div class="li">${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}<a class="grow" href="#/spieler/${p.team}/${esc(p.id)}" style="color:inherit"><div class="t">${esc(p.name)}</div><div class="s">${esc(TEAMNAME[p.team])} · ${esc(p.position || UNK)}</div></a><button type="button" class="chip ghost" data-action="fav" data-k="${p.team}" data-id="${esc(p.id)}" data-rerender="1">Entfernen</button></div>`).join('')}</div>`
        : '<p class="muted" style="font-size:13px;padding:12px 0;line-height:1.5">Noch keine Lieblingsspieler. Öffne im Kader einen Spieler und tippe oben rechts auf den Stern.</p>'}
    </div></section>`;
    out += `<section class="sec"><div class="sec-h"><h2>Benachrichtigungen</h2></div><div class="card set-soon"><span class="set-ic" aria-hidden="true">${I.bell}</span><span class="grow"><b>Push-Nachrichten</b><span>Tore, Aufstellung, Here-we-go-Transfers und Verletzungen direkt aufs iPhone – kommt als Nächstes.</span></span><span class="chip y sm">Bald</span></div></section>`;
    out += `<section class="sec"><div class="sec-h"><h2>Daten</h2></div><div style="display:flex;flex-direction:column;gap:10px">
      <button type="button" class="btn ghost" data-action="reload">${I.refresh} Daten neu laden</button>
      <button type="button" class="btn ghost" data-action="app-update">${I.phone} Neueste App-Version laden</button>
      <button type="button" class="btn ghost danger" data-action="tips-reset" ${tips ? '' : 'disabled'}>${I.target} Tippspiel zurücksetzen${tips ? ` (${tips} ${tips === 1 ? 'Tipp' : 'Tipps'})` : ''}</button>
      <p class="faint" style="font-size:11px;text-align:center;font-weight:600;line-height:1.5">„Neueste App-Version laden“ hilft, falls dein iPhone noch eine alte Version zeigt.</p></div></section>`;
    return out;
  }
  async function hardUpdate() {
    if (!navigator.onLine) { toast('Keine Verbindung – versuch es gleich nochmal'); return false; }
    toast('Neueste Version wird geladen …');
    try { if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.filter((k) => k.startsWith('bvb09-shell')).map((k) => caches.delete(k))); } } catch (e) { /* egal */ }
    try { const regs = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : []; await Promise.all(regs.map((r) => r.update().catch(() => {}))); } catch (e) { /* egal */ }
    setTimeout(() => location.reload(), 500);
    return true;
  }

  // Torhorn: wird im Browser erzeugt (WebAudio), keine Audiodatei noetig
  let AC = null;
  function hornUnlock() {
    try {
      if (!AC) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        AC = new C();
        const b = AC.createBuffer(1, 1, 22050);
        const src = AC.createBufferSource();
        src.buffer = b;
        src.connect(AC.destination);
        src.start(0);
      }
      if (AC.state !== 'running') AC.resume();
    } catch (e) { AC = null; }
    return AC;
  }
  document.addEventListener('pointerdown', () => { if (SET.horn && (!AC || AC.state !== 'running')) hornUnlock(); }, { passive: true });
  function playHorn() {
    const ac = AC || hornUnlock();
    if (!ac) return;
    const t = ac.currentTime + 0.04;
    const out = ac.createGain();
    out.gain.value = 0.85;
    const comp = ac.createDynamicsCompressor();
    out.connect(comp);
    comp.connect(ac.destination);
    // Horn: leicht verstimmte Saegezahn-Toene (F-Dur) durch einen Tiefpass
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(2100, t + 0.3);
    const env = ac.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.3, t + 0.1);
    env.gain.setValueAtTime(0.3, t + 2.1);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.75);
    lp.connect(env);
    env.connect(out);
    const vib = ac.createOscillator();
    const vibG = ac.createGain();
    vib.frequency.value = 5.5;
    vibG.gain.value = 1.6;
    vib.connect(vibG);
    for (const [f, d, v] of [[87.3, 0, 0.16], [174.6, -6, 0.26], [220, 5, 0.2], [261.6, -3, 0.18], [349.2, 7, 0.08]]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = d;
      o.frequency.setValueAtTime(f * 0.93, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.14);
      vibG.connect(o.frequency);
      const g = ac.createGain();
      g.gain.value = v;
      o.connect(g);
      g.connect(lp);
      o.start(t);
      o.stop(t + 2.8);
    }
    vib.start(t);
    vib.stop(t + 2.8);
    // Jubel: gefiltertes Rauschen, das anschwillt und langsam abklingt
    const len = Math.floor(ac.sampleRate * 4.2);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const n = ac.createBufferSource();
    n.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 950;
    bp.Q.value = 0.55;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.14, t + 0.7);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 4.1);
    n.connect(bp);
    bp.connect(ng);
    ng.connect(out);
    n.start(t);
    n.stop(t + 4.2);
  }

  // Tageszeit-Design: Morgen, Tag, Abend, Nacht - am Spieltag Flutlicht
  function applyDaytime() {
    const root = document.documentElement;
    if (!SET.daytime) { delete root.dataset.tod; delete root.dataset.md; const mt0 = $('meta[name="theme-color"]'); if (mt0) mt0.setAttribute('content', '#050505'); return; }
    const h = parseInt(F.hour.format(new Date()), 10);
    root.dataset.tod = h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'evening' : 'night';
    const live = D.loaded && matchList().some((m) => isLive(m));
    const nm = D.loaded ? nextMatch('profis') : null;
    if (live) root.dataset.md = 'live';
    else if (nm && daysUntil(nm.date) === 0) root.dataset.md = '1';
    else delete root.dataset.md;
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || '#050505');
  }

  // ------------------------------------------------------------------ Spielervergleich
  const CMP_ROWS = [
    ['apps', 'Einsätze', 1], ['minutes', 'Minuten', 1], ['goals', 'Tore', 1], ['assists', 'Vorlagen', 1], ['scorer', 'Scorerpunkte', 1],
    ['per90', 'Scorer pro 90 Min.', 1], ['perScorer', 'Minuten pro Scorer', -1], ['yellow', 'Gelbe Karten', -1], ['red', 'Platzverweise', -1],
  ];
  function cmpVals(k, id, comp) {
    const s = statsOf(k, id, comp) || {};
    const sc = (s.goals || 0) + (s.assists || 0);
    return { apps: s.apps || 0, minutes: s.minutes || 0, goals: s.goals || 0, assists: s.assists || 0, scorer: sc,
      per90: s.minutes >= 90 ? Math.round(sc * 9000 / s.minutes) / 100 : null, perScorer: sc && s.minutes ? Math.round(s.minutes / sc) : null,
      yellow: s.yellow || 0, red: (s.yellowRed || 0) + (s.red || 0) };
  }
  const cmpRank = (p) => { const s = statsOf(p.team, p.id) || {}; return (s.goals || 0) * 3 + (s.assists || 0) * 2 + (s.minutes || 0) / 900; };
  function cmpCard(p, side) {
    return `<button type="button" class="cmp-p ${side} press" data-action="cmp-pick" data-side="${side}" aria-label="${esc(p.name)} – anderen Spieler wählen">
      ${p.number ? `<span class="cmp-num" aria-hidden="true">${esc(p.number)}</span>` : ''}
      <span class="cmp-ph">${p.img ? img(pimg(p.img, 'big'), '', p.name, 'sil') : SIL}</span>
      <b class="cmp-name">${esc(lastName(p.name))}</b><span class="cmp-sub">${esc(p.position || UNK)}${p.team !== 'profis' ? ' · ' + esc(TEAMNAME[p.team]) : ''}</span>
      <span class="cmp-chg">${I.swap} Ändern</span></button>`;
  }
  function vCompare(k1, id1, k2, id2) {
    // Vergleich nur unter Profis (fuer BVB II und U19 gibt es keine Statistiken)
    const get = (k, id) => { const p = k === 'profis' && findPlayer(k, id); return p ? Object.assign({ team: k }, p) : null; };
    let A = get(k1, id1);
    let B = get(k2, id2);
    const tk = A ? A.team : 'profis';
    const pool = (team(tk).players || []).map((p) => Object.assign({ team: tk }, p)).sort((a, b) => cmpRank(b) - cmpRank(a));
    if (!A) A = pool.find((p) => !B || p.id !== B.id) || null;
    if (!B && A) B = pool.find((p) => p.id !== A.id) || null;
    let out = pageHead('Ver<em>gleich</em>', 'Spieler gegenüber', '', A ? `#/spieler/${A.team}/${A.id}` : '#/kader');
    if (!A || !B) return out + '<div class="empty">Für einen Vergleich fehlen noch Kaderdaten.</div>';
    S.cmp = { a: [A.team, A.id], b: [B.team, B.id] };
    const both = A.team === 'profis' && B.team === 'profis';
    const comp = both ? UI.statsComp : 'all';
    const va = cmpVals(A.team, A.id, comp);
    const vb = cmpVals(B.team, B.id, comp);
    let wa = 0;
    let wb = 0;
    const fmt = (key, v) => (v == null ? '–' : key === 'per90' ? nf2.format(v) : key === 'minutes' || key === 'perScorer' ? nf0.format(v) + "'" : nf0.format(v));
    const rows = CMP_ROWS.map(([key, label, dir]) => {
      const a = va[key];
      const b = vb[key];
      let win = '';
      if (a != null && b != null && a !== b) { win = (dir > 0 ? a > b : a < b) ? 'a' : 'b'; if (win === 'a') wa++; else wb++; }
      const mx = Math.max(a || 0, b || 0) || 1;
      return `<div class="cmp-row"><span class="cmp-v ${win === 'a' ? 'win' : ''}">${fmt(key, a)}</span>
        <span class="cmp-mid"><span class="cmp-l">${label}</span>${dir > 0 ? `<span class="cmp-bars" aria-hidden="true"><i class="a" style="--w:${Math.round((a || 0) / mx * 100)}%"></i><i class="b" style="--w:${Math.round((b || 0) / mx * 100)}%"></i></span>` : ''}</span>
        <span class="cmp-v b ${win === 'b' ? 'win' : ''}">${fmt(key, b)}</span></div>`;
    }).join('');
    const verdict = wa > wb ? `${lastName(A.name)} liegt vorne` : wb > wa ? `${lastName(B.name)} liegt vorne` : 'Gleichstand';
    out += `<section class="cmp-hero">${cmpCard(A, 'a')}<span class="cmp-vs" aria-hidden="true">VS</span>${cmpCard(B, 'b')}</section>`;
    if (both) out += compChips();
    out += `<div class="cmp-score"><b>${wa}</b><span>${esc(verdict)}<small>${wa + wb ? 'gewonnene Werte' : 'noch keine Unterschiede'}</small></span><b>${wb}</b></div>`;
    out += `<section class="card flat cmp-rows" style="margin-top:12px">${rows}</section>`;
    if (both) {
      const ra = formRows(A);
      const rb = formRows(B);
      if (ra.some((r) => r.v) || rb.some((r) => r.v)) {
        const h = (v) => (v && v.min ? Math.max(6, Math.min(100, v.min / 90 * 100)) : 0);
        const dots = (v, c) => (v ? `<i class="${c}"></i>`.repeat(Math.min(3, (v.g || 0) + (v.a || 0))) : '');
        out += `<section class="sec"><div class="sec-h"><h2>Letzte Spiele</h2><span class="note">Minuten je Spiel</span></div><div class="card">
          <div class="cmp-form">${ra.map((r, i) => { const x = r.v; const y = (rb[i] || {}).v; return `<span class="cf-col" title="${esc(fmtDate(r.m.date))} gg. ${esc(tname(oppOf(r.m)))}"><span class="cf-dots">${dots(x, 'a')}${dots(y, 'b')}</span><span class="cf-bars"><i class="a" style="--h:${h(x)}%;animation-delay:${(i * 0.04).toFixed(2)}s"></i><i class="b" style="--h:${h(y)}%;animation-delay:${(i * 0.04 + 0.02).toFixed(2)}s"></i></span><span class="cf-l">${esc(abbr(oppOf(r.m).name))}</span></span>`; }).join('')}</div>
          <div class="fc-legend"><span><i class="cmpa"></i>${esc(lastName(A.name))}</span><span><i class="cmpb"></i>${esc(lastName(B.name))}</span><span>Punkte = Tor oder Vorlage</span></div></div></section>`;
      }
    }
    const facts = [
      ['Alter', (p) => (p.age ? p.age + ' J.' : UNK)], ['Nummer', (p) => (p.number ? '#' + p.number : UNK)], ['Größe', (p) => p.height || UNK],
      ['Fuß', (p) => p.foot || UNK], ['Nation', (p) => (p.flags || []).map((f) => f.name).join(' / ') || UNK], ['Vertrag bis', (p) => (p.contract ? fmtDate(p.contract) : UNK)],
    ];
    out += `<section class="sec"><div class="sec-h"><h2>Steckbrief</h2></div><div class="card flat">${facts.map(([l, f]) => `<div class="cmp-fact"><span>${esc(f(A))}</span><em>${l}</em><span>${esc(f(B))}</span></div>`).join('')}</div></section>`;
    out += `<div class="row" style="gap:10px;margin-top:14px"><a class="btn ghost grow" href="#/spieler/${A.team}/${esc(A.id)}">Profil ${esc(lastName(A.name))}</a><a class="btn ghost grow" href="#/spieler/${B.team}/${esc(B.id)}">Profil ${esc(lastName(B.name))}</a></div>`;
    return out;
  }
  function openCmpPick(side) {
    const c = S.cmp;
    if (!c) return;
    const other = side === 'a' ? c.b : c.a;
    const cur = side === 'a' ? c.a : c.b;
    const groups = ['profis'];
    const href = (k, id) => { const a = side === 'a' ? [k, id] : other; const b = side === 'a' ? other : [k, id]; return `#/vergleich/${a[0]}/${encodeURIComponent(a[1])}/${b[0]}/${encodeURIComponent(b[1])}`; };
    openSheet(`<h2 class="display" style="font-size:30px;text-transform:uppercase;margin-bottom:12px">Spieler wählen</h2>
      <input class="search" type="search" placeholder="Spieler suchen …" autocomplete="off" data-action="cmp-search" aria-label="Spieler suchen">
      <div class="cmp-pick">${groups.map((k) => {
        const ps = (team(k).players || []).filter((p) => !(k === other[0] && p.id === other[1]));
        if (!ps.length) return '';
        return `<div class="cmp-grp"><h3 class="group-h">${esc(TEAMNAME[k])}</h3><div class="list">${ps.map((p) => `<a class="li" href="${href(k, p.id)}" data-name="${esc(slug(p.name))}">${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}<span class="grow"><div class="t">${esc(p.name)}${favMark(k, p.id)}</div><div class="s">${esc(p.position || UNK)} · ${(statsOf(k, p.id) || {}).apps || 0} Spiele</div></span>${cur[0] === k && cur[1] === p.id ? '<span class="chip y sm">Aktuell</span>' : ''}</a>`).join('')}</div></div>`;
      }).join('')}</div>`);
  }

  // ------------------------------------------------------------------ Sheet
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
    setTimeout(() => { sh.hidden = true; sh.classList.remove('closing'); $('.sheet-panel', sh).style.transform = ''; if ($('#story').hidden) document.body.style.overflow = ''; }, reduce ? 0 : 260);
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

  // ------------------------------------------------------------------ Router
  const ROUTES = [
    [/^\/home$/, 'home', () => vHome(), 'BVB 09'],
    [/^\/transfers(?:\/(news|tm|werte|bilanz|vertraege))?$/, 'transfers', (m) => vTransfers(m[1] || 'news'), 'Transfers'],
    [/^\/spiele(?:\/(profis|u23))?(?:\/(kommend|ergebnisse|tabelle|cltabelle|cl|cltab|clko|konferenz|saison|torschuetzen))?$/, 'spiele', (m) => vSpiele('profis', m[2] || 'kommend'), 'Spiele'],
    [/^\/spiel\/(\d+)(?:\/(vorbericht|spiel|gegner|tipp))?$/, 'spiele', (m) => vSpiel(m[1], m[2]), 'Spieltag'],
    [/^\/kader(?:\/(profis|u23|u19))?$/, 'kader', (m) => vKader(m[1] || UI.kaderTeam || 'profis'), 'Kader'],
    [/^\/spieler\/(profis|u23|u19)\/([\w-]+)$/, 'kader', (m) => vSpieler(m[1], m[2]), (m) => ((findPlayer(m[1], m[2]) || {}).name || 'Spieler')],
    [/^\/mehr$/, 'mehr', () => vMehr(), 'Mehr'],
    [/^\/mehr\/update$/, 'mehr', () => vUpdate(), 'Update-Zentrale'],
    [/^\/mehr\/einstellungen$/, 'mehr', () => vSettings(), 'Einstellungen'],
    [/^\/vergleich(?:\/(profis|u23|u19)\/([\w-]+))?(?:\/(profis|u23|u19)\/([\w-]+))?$/, 'kader', (m) => vCompare(m[1], m[2], m[3], m[4]), 'Vergleich'],
    [/^\/mehr\/stats$/, 'mehr', () => vStats(), 'Statistiken'],
    [/^\/mehr\/elf$/, 'mehr', () => vElf(), 'Meine Elf'],
    [/^\/mehr\/tippspiel$/, 'mehr', () => vTippspiel(), 'Tippspiel'],
    [/^\/mehr\/rueckblick$/, 'mehr', () => vRueckblick(), 'Rückblick'],
    [/^\/mehr\/talente$/, 'mehr', () => vTalente(), 'Talente-Radar'],
    [/^\/mehr\/lazarett$/, 'mehr', () => vLazarett(), 'Lazarett'],
    [/^\/mehr\/erfolge$/, 'mehr', () => vErfolge(), 'Erfolge'],
    [/^\/mehr\/install$/, 'mehr', () => vInstall(), 'Installieren'],
    [/^\/mehr\/info$/, 'mehr', () => vInfo(), 'Über die App'],
  ];
  const TABS = ['home', 'transfers', 'spiele', 'kader', 'mehr'];
  const skeleton = () => '<div class="skel" style="height:80px;margin-bottom:16px"></div><div class="row" style="gap:14px;margin-bottom:18px">' + '<div class="skel" style="width:70px;height:70px;border-radius:50%;flex:none"></div>'.repeat(4) + '</div><div class="skel" style="height:310px"></div><div class="bento"><div class="skel" style="height:150px"></div><div class="skel" style="height:150px"></div></div>';
  function render(opts = {}) {
    applyDaytime();
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
    const ti = TABS.indexOf(r[1]);
    const depth = path.split('/').length;
    let dir = '';
    if (!same && S.route) dir = ti > S.tabIdx ? 'from-right' : ti < S.tabIdx ? 'from-left' : depth > S.depth ? 'from-right' : depth < S.depth ? 'from-left' : '';
    v.innerHTML = html;
    v.className = '';
    if (opts.animate !== false && !reduce && (!same || opts.forceAnim)) { void v.offsetWidth; v.className = ('enter ' + dir).trim(); }
    setTab(r[1]);
    const title = typeof r[3] === 'function' ? r[3](m) : r[3];
    const tb = $('#topbar');
    $('.tb-title', tb).textContent = title;
    const backBtn = $('.tb-back', tb);
    backBtn.hidden = !(path.startsWith('/mehr/') || path.startsWith('/spieler/') || path.startsWith('/spiel/') || path.startsWith('/vergleich'));
    backBtn.dataset.fallback = path.startsWith('/spieler/') ? '#/kader/' + m[1] : path.startsWith('/spiel/') ? '#/spiele' : path.startsWith('/vergleich') ? '#/kader' : '#/mehr';
    if (!same && !opts.keepScroll) window.scrollTo(0, 0);
    S.route = path;
    S.tabIdx = ti;
    S.depth = depth;
    S.level = levelOf(path);
    afterRender(v, opts);
    onScroll();
    saveUI();
  }
  // Seitenwechsel: Detailseiten schieben sich wie bei iOS hinein, Tabs gleiten weich hinueber
  const levelOf = (path) => (/^\/vergleich/.test(path) ? 2 : /^\/(spieler|spiel)\/|^\/mehr\/./.test(path) ? 1 : 0);
  // Uebergaenge nur, wenn der Browser beim Antippen gerade zeichnet - sonst (App/Fenster im Hintergrund) bliebe der Wechsel haengen
  S.lastFrame = 0;
  document.addEventListener('pointerdown', () => requestAnimationFrame(() => { S.lastFrame = performance.now(); }), { passive: true, capture: true });
  function navRender() {
    if (!document.startViewTransition || reduce || !D.loaded || !S.route || document.visibilityState !== 'visible' || performance.now() - S.lastFrame > 1500) { render(); return; }
    const path = (location.hash || '#/home').slice(1) || '/home';
    if (path === S.route) { render(); return; }
    const r = ROUTES.find(([re]) => re.test(path)) || ROUTES[0];
    const ti = TABS.indexOf(r[1]);
    const lv = levelOf(path);
    const nav = lv > (S.level || 0) ? 'push' : lv < (S.level || 0) ? 'pop' : ti !== S.tabIdx ? (ti > S.tabIdx ? 'tab-r' : 'tab-l') : 'fade';
    const root = document.documentElement;
    root.dataset.nav = nav;
    const t = document.startViewTransition(() => render({ animate: false, vt: true }));
    t.ready.catch(() => {}); // uebersprungen (schnelles Tippen, App im Hintergrund) - Seite ist trotzdem gerendert
    // Sicherung: zeichnet der Browser gerade nicht (App im Hintergrund), haengt der Uebergang sonst mit beiden Seiten uebereinander
    const wd = setTimeout(() => { try { t.skipTransition(); } catch (e) { /* schon fertig */ } }, 900);
    t.finished.finally(() => { clearTimeout(wd); if (root.dataset.nav === nav) delete root.dataset.nav; });
  }
  function afterRender(v, opts) {
    raf2(() => {
      $$('.seg-ind[data-to]', v).forEach((el) => { el.style.transform = `translateX(${el.dataset.to}%)`; });
      $$('.ring-svg .val[data-off], .uz-ring .val[data-off]', v).forEach((c) => { c.style.strokeDashoffset = c.dataset.off; });
    });
    if (opts.animate !== false) countUps(v);
    const tp = $('[data-type]', v);
    if (tp) { store.set('briefSeen', tp.dataset.type); tp.removeAttribute('data-type'); typewriter(tp); }
    mcAfter(v);
    konfAfter(v);
    clAfter(v);
    elfAfter(v);
    liveBar();
    if (S.cmpPick && (S.route || '').startsWith('/vergleich')) { const sd = S.cmpPick; S.cmpPick = null; setTimeout(() => openCmpPick(sd), reduce ? 0 : 320); }
    const tabOn = $('.tabs a.on', v);
    if (tabOn) { const nav = tabOn.parentElement; nav.scrollLeft = tabOn.offsetLeft - (nav.clientWidth - tabOn.clientWidth) / 2; }
    if (S.io) S.io.disconnect();
    if (!reduce && (opts.animate !== false || opts.vt) && 'IntersectionObserver' in window) {
      S.io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('rv-in'); S.io.unobserve(en.target); } }), { rootMargin: '0px 0px -6% 0px' });
      const fold = window.innerHeight;
      [...v.children].forEach((el) => { if (el.getBoundingClientRect().top > fold) { el.classList.add('rv'); S.io.observe(el); } });
    }
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
    if (ind && S.tabI != null && S.tabI !== i && !reduce) { ind.classList.remove('stretch'); void ind.offsetWidth; ind.classList.add('stretch'); }
    S.tabI = i;
  }
  function countUps(root) {
    if (reduce) return;
    $$('[data-count]', root).forEach((el) => {
      const to = +el.dataset.count;
      const fmt = el.dataset.fmt;
      if (!to) return;
      const show = (x) => (fmt === 'money' ? money(Math.round(x / 10000) * 10000) : fmt === 'moneyS' ? money(Math.round(x / 100000) * 100000, { short: 1 }) : nf0.format(Math.round(x)));
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 1100);
        el.textContent = show(to * (1 - Math.pow(1 - k, 4)));
        if (k < 1) requestAnimationFrame(step); else el.textContent = show(to);
      };
      requestAnimationFrame(step);
    });
  }
  function typewriter(el) {
    const text = el.textContent;
    let i = 0;
    el.textContent = '';
    const tn = document.createTextNode('');
    const caret = document.createElement('span');
    caret.className = 'caret';
    el.append(tn, caret);
    const step = () => {
      i = Math.min(text.length, i + 3);
      tn.nodeValue = text.slice(0, i);
      if (i < text.length) setTimeout(step, 16); else setTimeout(() => caret.remove(), 1400);
    };
    setTimeout(step, 500);
  }
  function onScroll() {
    const isP = (S.route || '').startsWith('/spieler/');
    $('#topbar').classList.toggle('on', isP ? window.scrollY > 300 : window.scrollY > 64);
  }
  window.addEventListener('scroll', () => { if (!S._st) { S._st = true; requestAnimationFrame(() => { S._st = false; onScroll(); }); } }, { passive: true });

  // ------------------------------------------------------------------ Navigation & Events
  function navigateVT(href, imgEl) {
    imgEl.style.viewTransitionName = 'player-photo';
    const t = document.startViewTransition(() => { history.pushState(null, '', href); S.prev = true; render({ animate: false }); });
    t.ready.catch(() => {});
    const wd = setTimeout(() => { try { t.skipTransition(); } catch (e) { /* schon fertig */ } }, 1100);
    t.finished.finally(() => { clearTimeout(wd); imgEl.style.viewTransitionName = ''; });
  }
  // Haptik: iOS 18+ gibt beim Umschalten eines Schalters ein kurzes Tick - ein unsichtbarer Schalter macht das nutzbar
  const hapLabel = document.createElement('label');
  hapLabel.className = 'hap';
  hapLabel.setAttribute('aria-hidden', 'true');
  hapLabel.innerHTML = '<input type="checkbox" switch tabindex="-1">';
  document.body.appendChild(hapLabel);
  const haptic = () => { try { hapLabel.click(); } catch (err) { /* kein Haptik-Support */ } };
  const HAPTIC = '.tab, .seg a, .tabs a, .chips button, .sw, .set-seg button, [data-action="fav"], [data-action="tip-step"], [data-action="tip-save"], [data-action="slot"], [data-action="pick"], [data-action="story-next"], [data-action="story-prev"]';
  document.addEventListener('click', (e) => {
    if (e.target === hapLabel || hapLabel.contains(e.target)) return;
    if (e.target.closest(HAPTIC)) haptic();
    if (e.target.closest('[data-close]')) { if (S.noClose && Date.now() - S.noClose < 450) return; closeSheet(); return; }
    const vt = e.target.closest('a[data-vt="player"]');
    if (vt && !e.metaKey && !e.ctrlKey && document.startViewTransition && !reduce && performance.now() - S.lastFrame < 1500) {
      const im = $('.pc-media img', vt);
      if (im) { e.preventDefault(); navigateVT(vt.getAttribute('href'), im); return; }
    }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action;
    if (act === 'team') { UI[a.dataset.key] = a.dataset.val; render({ forceAnim: true, keepScroll: true }); }
    else if (act === 'toggle') { UI[a.dataset.key] = !UI[a.dataset.key]; render({ animate: false, keepScroll: true }); }
    else if (act === 'race') { UI.raceRival = a.dataset.val; render({ animate: false, keepScroll: true }); }
    else if (act === 'clgroup') { UI.clGroup = a.dataset.val; render({ animate: false, keepScroll: true }); }
    else if (act === 'filter') { UI.newsFilter = a.dataset.val; render({ forceAnim: true, keepScroll: true }); }
    else if (act === 'kfilter') {
      UI.kaderFilter = a.dataset.val;
      $$('[data-action="kfilter"]').forEach((b) => { b.classList.toggle('on', b === a); b.setAttribute('aria-pressed', b === a); });
      $('#kgrid').innerHTML = kaderGrid(UI.kaderTeam);
      saveUI();
    }
    else if (act === 'tmore') { const box = a.nextElementSibling; const open = !box.classList.contains('open'); box.classList.toggle('open', open); a.setAttribute('aria-expanded', open); }
    else if (act === 'brief-more') { const b = a.closest('.brief'); b.classList.toggle('clamp'); a.textContent = b.classList.contains('clamp') ? 'Weiterlesen' : 'Weniger'; }
    else if (act === 'match') location.hash = '#/spiel/' + a.dataset.id;
    else if (act === 'story') { e.preventDefault(); openStories(storyItems(), +a.dataset.i, $('.story-ring', a)); }
    else if (act === 'statcomp') { UI.statsComp = a.dataset.val; render({ animate: false, keepScroll: true }); }
    else if (act === 'scorertab') { UI.scorerTab = a.dataset.val; render({ animate: false, keepScroll: true }); }
    else if (act === 'yt') {
      const box = a.closest('.yt');
      if (box) box.outerHTML = `<div class="yt on"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(a.dataset.id)}?autoplay=1&playsinline=1&rel=0" title="Video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
    }
    else if (act === 'story-next') { if (ST.held) { ST.held = false; return; } storyStep(1); }
    else if (act === 'story-prev') { if (ST.held) { ST.held = false; return; } storyStep(-1); }
    else if (act === 'story-close') closeStories();
    else if (act === 'back') { if (history.length > 1 && S.prev) history.back(); else location.hash = a.dataset.fallback || '#/home'; }
    else if (act === 'reload') { a.disabled = true; refresh(true).then(() => { a.disabled = false; }); }
    else if (act === 'formation') { const el = elf(); el.f = a.dataset.val; el.s = {}; store.set('elf', el); S.elfEdit = false; render({ animate: false }); }
    else if (act === 'elf-new') openElfNew();
    else if (act === 'elf-create') {
      const inp = $('#elf-lines');
      const lines = parseLines(inp && inp.value);
      if (!lines) { const h = $('#elf-hint'); if (h) { h.textContent = elfHint(inp && inp.value); h.classList.add('red'); } return; }
      const el = elf();
      const id = Date.now().toString(36);
      el.custom = [...(el.custom || []), { id, name: lines.join('-'), pos: buildFormation(lines) }].slice(-8);
      el.f = 'c:' + id;
      el.s = {};
      store.set('elf', el);
      S.elfEdit = true;
      closeSheet();
      render({ animate: false });
    }
    else if (act === 'elf-adapt') {
      const el = elf();
      const id = Date.now().toString(36);
      el.custom = [...(el.custom || []), { id, name: el.f, pos: slotsOf(el).map((x) => [...x]) }].slice(-8);
      el.f = 'c:' + id;
      store.set('elf', el);
      S.elfEdit = true;
      render({ animate: false });
    }
    else if (act === 'elf-edit') { S.elfEdit = !S.elfEdit; render({ animate: false, keepScroll: true }); }
    else if (act === 'elf-del') {
      const el = elf();
      el.custom = (el.custom || []).filter((c) => 'c:' + c.id !== el.f);
      el.f = '4-3-3';
      el.s = {};
      store.set('elf', el);
      S.elfEdit = false;
      render({ animate: false });
    }
    else if (act === 'slot') openSlot(+a.dataset.i);
    else if (act === 'pick') { const el = elf(); if (a.dataset.id) el.s[a.dataset.i] = a.dataset.id; else delete el.s[a.dataset.i]; store.set('elf', el); closeSheet(); render({ animate: false }); }
    else if (act === 'elf-reset') { const el = elf(); el.s = {}; store.set('elf', el); render({ animate: false }); }
    else if (act === 'tip-step') {
      const d = S.tipDraft;
      if (!d) return;
      const w = a.dataset.who;
      d[w] = Math.max(0, Math.min(15, d[w] + (+a.dataset.d)));
      const el = $(`[data-tipnum="${w}"]`);
      if (el) { el.textContent = d[w]; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    }
    else if (act === 'tip-save') {
      const m = matchById(a.dataset.id);
      if (!m || !tipOpen(m) || !S.tipDraft) { toast('Tippen geht nur bis zum Anpfiff'); render({ animate: false, keepScroll: true }); return; }
      const all = tipsAll();
      all[m.id] = { bvb: S.tipDraft.bvb, opp: S.tipDraft.opp, at: new Date().toISOString() };
      store.set('tips', all);
      toast(`Tipp gespeichert: ${tipStr(all[m.id], m)}`);
      render({ animate: false, keepScroll: true });
    }
    else if (act === 'fc') fcInfo(+a.dataset.i);
    else if (act === 'wrapped') { if (/^\d{4}-\d{2}$/.test(a.dataset.key)) store.set('wrapSeen', a.dataset.key); openWrapped(a.dataset.key); }
    else if (act === 'wr-next') wrStep(1);
    else if (act === 'wr-prev') wrStep(-1);
    else if (act === 'wr-close') { closeWrapped(); if (S.tab === 'home') render({ animate: false, keepScroll: true }); }
    else if (act === 'since-off') { S.sinceOff = true; const c = a.closest('.since'); if (c) c.remove(); }
    else if (act === 'mood') openMood();
    else if (act === 'fav') {
      const on = toggleFav(a.dataset.k, a.dataset.id);
      const p = findPlayer(a.dataset.k, a.dataset.id);
      const n = p ? lastName(p.name) : 'Spieler';
      toast(on ? `${n} ist jetzt einer deiner Spieler` : `${n} entfernt`);
      if (a.dataset.rerender) { render({ animate: false, keepScroll: true }); return; }
      a.classList.toggle('on', on);
      a.setAttribute('aria-pressed', on);
      if (on && !reduce) { a.classList.remove('burst'); void a.offsetWidth; a.classList.add('burst'); }
    }
    else if (act === 'set') {
      const key = a.dataset.key;
      if (key === 'motion') SET.motion = a.dataset.val; else SET[key] = !SET[key];
      saveSET();
      applyMotion();
      if (key === 'horn' && SET.horn) hornUnlock();
      render({ animate: false, keepScroll: true });
    }
    else if (act === 'home-vis') {
      const L = homeLayout();
      const k = a.dataset.k;
      if (L.hidden[k]) delete L.hidden[k]; else L.hidden[k] = 1;
      saveHome(L.order, L.hidden);
      const on = !L.hidden[k];
      a.classList.toggle('on', on);
      a.setAttribute('aria-checked', on);
      a.closest('.ho-row').classList.toggle('off', !on);
    }
    else if (act === 'home-reset') { SET.home = null; saveSET(); toast('Startseite zurückgesetzt'); render({ animate: false, keepScroll: true }); }
    else if (act === 'horn-test') { hornUnlock(); playHorn(); }
    else if (act === 'tips-reset') {
      if (!a.dataset.armed) {
        const orig = a.innerHTML;
        a.dataset.armed = '1';
        a.innerHTML = `${I.warn} Wirklich alle Tipps löschen?`;
        clearTimeout(S.armT);
        S.armT = setTimeout(() => { if (a.isConnected) { delete a.dataset.armed; a.innerHTML = orig; } }, 4000);
        return;
      }
      clearTimeout(S.armT);
      store.set('tips', {});
      toast('Tippspiel zurückgesetzt');
      render({ animate: false, keepScroll: true });
    }
    else if (act === 'app-update') { a.disabled = true; hardUpdate().then((ok) => { if (!ok) a.disabled = false; }); }
    else if (act === 'cmp-start') { S.cmpPick = 'b'; location.hash = `#/vergleich/${a.dataset.k}/${encodeURIComponent(a.dataset.id)}`; }
    else if (act === 'cmp-pick') openCmpPick(a.dataset.side);
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t || !t.dataset) return;
    if (t.dataset.action === 'search') { UI.kaderSearch = t.value; $('#kgrid').innerHTML = kaderGrid(UI.kaderTeam); }
    else if (t.dataset.action === 'elf-lines') { const h = $('#elf-hint'); if (h) { h.textContent = elfHint(t.value); h.classList.toggle('green', !!parseLines(t.value)); h.classList.remove('red'); } }
    else if (t.dataset.action === 'cmp-search') {
      const q = slug(t.value);
      $$('.cmp-pick .li').forEach((li) => { li.hidden = !!q && !li.dataset.name.includes(q); });
      $$('.cmp-grp').forEach((g) => { g.hidden = !$$('.li', g).some((li) => !li.hidden); });
    }
    else if (t.dataset.set === 'name') {
      SET.name = t.value.slice(0, 24);
      saveSET();
      const av = $('.set-av');
      if (av) av.textContent = initials(userName() || 'BVB');
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target && e.target.dataset && e.target.dataset.set === 'name') toast(userName() ? `Hallo ${userName()}!` : 'Name entfernt – die App sagt jetzt „Borusse“');
  });

  // Licht beim Antippen: kurzer Flutlicht-Schein an der Fingerspitze
  document.addEventListener('pointerdown', (e) => {
    if (reduce || e.button > 0 || !e.target.closest || !e.target.closest('a, button, [data-action], .tile, .pc, .ticket')) return;
    const g = document.createElement('i');
    g.className = 'tglow';
    g.style.left = e.clientX + 'px';
    g.style.top = e.clientY + 'px';
    document.body.appendChild(g);
    setTimeout(() => g.remove(), 700);
  }, { passive: true });

  // Sheet: am Griff nach unten ziehen zum Schliessen
  (() => {
    let d = null;
    document.addEventListener('pointerdown', (e) => {
      const g = e.target.closest && e.target.closest('.sheet-grip');
      if (!g || e.button > 0) return;
      d = { panel: g.closest('.sheet-panel'), y0: e.clientY, dy: 0, t0: Date.now() };
      d.panel.classList.add('drag');
      try { g.setPointerCapture(e.pointerId); } catch (err) { /* aeltere Browser */ }
    });
    document.addEventListener('pointermove', (e) => {
      if (!d) return;
      d.dy = Math.max(0, e.clientY - d.y0);
      d.panel.style.transform = d.dy ? `translateY(${d.dy}px)` : '';
    });
    const end = () => {
      if (!d) return;
      const { panel, dy, t0 } = d;
      d = null;
      panel.classList.remove('drag');
      if (dy > 6) S.noClose = Date.now();
      if (dy > 110 || (dy > 40 && Date.now() - t0 < 260)) { closeSheet(); return; }
      panel.classList.add('snap');
      panel.style.transform = '';
      setTimeout(() => panel.classList.remove('snap'), 380);
    };
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  })();

  // Startseite sortieren: Griff gedrueckt halten und ziehen
  (() => {
    let d = null;
    document.addEventListener('pointerdown', (e) => {
      const g = e.target.closest && e.target.closest('[data-grip]');
      if (!g || e.button > 0) return;
      const row = g.closest('.ho-row');
      const rows = [...row.parentElement.children];
      d = { row, rows, start: rows.indexOf(row), idx: rows.indexOf(row), y0: e.clientY, h: row.offsetHeight, tops: rows.map((r) => r.offsetTop) };
      try { g.setPointerCapture(e.pointerId); } catch (err) { /* aeltere Browser */ }
      row.classList.add('drag');
      e.preventDefault();
    });
    document.addEventListener('pointermove', (e) => {
      if (!d) return;
      const dy = Math.max(d.tops[0] - d.tops[d.start], Math.min(d.tops[d.rows.length - 1] - d.tops[d.start], e.clientY - d.y0));
      d.row.style.transform = `translateY(${dy}px)`;
      const mid = d.tops[d.start] + dy + d.h / 2;
      let idx = 0;
      d.rows.forEach((r, i) => { if (i !== d.start && d.tops[i] + d.h / 2 < mid) idx++; });
      if (idx === d.idx) return;
      d.idx = idx;
      d.rows.forEach((r, i) => {
        if (i === d.start) return;
        const sh = d.start < idx && i > d.start && i <= idx ? -d.h : d.start > idx && i >= idx && i < d.start ? d.h : 0;
        r.style.transform = sh ? `translateY(${sh}px)` : '';
      });
    });
    const end = () => {
      if (!d) return;
      const { row, rows, start, idx } = d;
      d = null;
      row.classList.remove('drag');
      rows.forEach((r) => { r.style.transform = ''; });
      if (idx === start) return;
      const L = homeLayout();
      const order = rows.map((r) => r.dataset.k);
      order.splice(idx, 0, order.splice(start, 1)[0]);
      saveHome(order, L.hidden);
      row.parentElement.innerHTML = order.map((k) => homeRow(k, L)).join('');
    };
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  })();
  document.addEventListener('keydown', (e) => {
    const wr = $('#wrapped');
    if (wr && !wr.hidden) {
      if (e.key === 'Escape') closeWrapped();
      else if (e.key === 'ArrowRight') wrStep(1);
      else if (e.key === 'ArrowLeft') wrStep(-1);
      return;
    }
    if (!$('#story').hidden) {
      if (e.key === 'Escape') closeStories();
      else if (e.key === 'ArrowRight') storyStep(1);
      else if (e.key === 'ArrowLeft') storyStep(-1);
      return;
    }
    const g = e.target && e.target.closest && e.target.closest('[data-grip]');
    if (g && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveHome(g.closest('.ho-row').dataset.k, e.key === 'ArrowUp' ? -1 : 1); return; }
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.set) { e.target.blur(); return; }
    if (e.key === 'Escape') closeSheet();
  });
  window.addEventListener('hashchange', () => { S.prev = true; closeSheet(); closeWrapped(); navRender(); });

  // Ziehen zum Aktualisieren
  (() => {
    let y0 = null;
    let dy = 0;
    const ptr = $('#ptr');
    window.addEventListener('touchstart', (e) => { y0 = window.scrollY <= 0 && $('#sheet').hidden && $('#story').hidden && !(e.target.closest && e.target.closest('[data-grip]')) ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      if (dy > 0 && window.scrollY <= 0) {
        const k = Math.min(1, dy / 90);
        ptr.style.opacity = k;
        ptr.style.transform = `translateY(${Math.min(dy, 120) - 70}px) rotate(${dy * 3}deg) scale(${0.6 + k * 0.4})`;
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
    const res = await Promise.all(FILES.map((f) => fetch(`data/${f}.json?v=${bust}`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
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
    render({ animate: false, keepScroll: true });
    const after = (D.status || {}).lastRun;
    toast(!ok ? 'Keine Verbindung – gespeicherte Daten' : after && after !== before ? 'Neue Daten geladen' : `Aktuell · Stand ${after ? F.time.format(new Date(after)) + ' Uhr' : '–'}`);
  }
  let toastT = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), 2600);
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
            const forBVB = (g.team === 'home') === m.isHome;
            if (forBVB) goalFx(g, Object.assign({}, m, l));
            else toast(`Tor für ${tname(m.isHome ? m.away : m.home)} · ${g.scorer || ''} · ${g.score}`);
          }
        }
      } catch (e) { /* offline */ }
    }
    if (changed && !once && (S.tab === 'home' || S.tab === 'spiele')) render({ animate: false, keepScroll: true });
    if (changed) liveBar();
    return changed;
  }
  function tick() {
    $$('[data-odo]').forEach((el) => {
      if (Date.parse(el.dataset.odo) <= Date.now()) { if (!el.dataset.done) { el.dataset.done = 1; pollLive(); } return; }
      tickOdo(el);
    });
  }
  const relTick = () => $$('[data-rel]').forEach((el) => { if (el.dataset.rel) el.textContent = rel(el.dataset.rel); });

  async function init() {
    if ('serviceWorker' in navigator && location.hostname !== 'localhost') navigator.serviceWorker.register('sw.js').catch(() => {});
    const t0 = Date.now();
    const hi = $('#splash .sp-hi');
    if (hi) hi.textContent = userName() ? `Hallo, ${userName()}!` : 'Heja BVB!';
    render();
    await loadData(false);
    if (D.loaded && D.matches) S.since = computeSince();
    await pollLive(true);
    const nm = D.loaded ? nextMatch('profis') : null;
    const sub = $('#splash .sp-sub');
    if (sub && nm && daysUntil(nm.date) === 0) {
      sub.textContent = `${isLive(nm) ? 'Läuft gerade' : nm.timeKnown === false ? 'Heute' : 'Heute ' + F.time.format(new Date(nm.date)) + ' Uhr'} · ${tname(nm.home)} – ${tname(nm.away)}`;
      sub.classList.add('on');
      if (hi) hi.textContent = `Spieltag, ${userName() || 'Borusse'}!`;
    }
    const wait = Math.max(0, (reduce ? 200 : 1650) - (Date.now() - t0));
    setTimeout(() => {
      const sp = $('#splash');
      sp.classList.add('out');
      setTimeout(() => render({ forceAnim: true }), reduce ? 0 : 380);
      setTimeout(() => sp.classList.add('gone'), reduce ? 0 : 700);
      setTimeout(() => sp.remove(), reduce ? 50 : 1100);
    }, wait);
    setInterval(tick, 1000);
    setInterval(relTick, 30000);
    setInterval(applyDaytime, 60000);
    setInterval(() => pollLive(false), 30000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - S.lastLoad > 10 * 60e3) loadData(false).then(() => render({ animate: false, keepScroll: true }));
    });
  }
  init();
})();
