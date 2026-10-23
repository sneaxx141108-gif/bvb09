/* BVB 09 – inoffizielle Fan-App · Design "Flutlicht"
 * Daten: data/*.json (3x taeglich von GitHub Actions + Gemini aktualisiert),
 * Live-Ergebnisse direkt von OpenLigaDB. */
'use strict';
(() => {
  const REPO = 'sneaxx141108-gif/bvb09';
  const FILES = ['status', 'status-pc', 'squads', 'stats', 'transfers', 'news', 'matches', 'tables'];
  const TZ = 'Europe/Berlin';
  const BVB = { name: 'Borussia Dortmund', crest: 'https://tmssl.akamaized.net/images/wappen/head/16.png' };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    statsTeam: 'profis', newsFilter: 'alle', kaderFilter: 'alle' }, store.get('ui', {}));
  UI.kaderSearch = '';
  const saveUI = () => { const c = Object.assign({}, UI); delete c.kaderSearch; store.set('ui', c); };

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
    link: sv('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
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
  function statsOf(k, id) {
    const st = (((D.stats || {}).teams || {})[k] || {})[id];
    if (k !== 'profis') return st;
    const p = findPlayer(k, id);
    if (!p) return st;
    const l = slug(p.name).split('-').pop();
    const same = (team('profis').players || []).filter((x) => slug(x.name).split('-').pop() === l).length;
    const g = same === 1 ? liveGoals()[l] || 0 : 0;
    if (!st) return g ? { goals: g, apps: 0, assists: 0, minutes: 0 } : st;
    return g > (st.goals || 0) ? Object.assign({}, st, { goals: g }) : st;
  }
  function absencesOf(p) {
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
        source: s.source, tier: s.tier, date: s.date || s.updatedAt,
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
    const h = parseInt(F.hour.format(new Date()), 10);
    return h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Hallo' : 'Guten Abend';
  }

  function vHome() {
    const st = D.status || {};
    const nm = nextMatch('profis');
    const lm = lastMatch('profis');
    const bl = ((D.tables || {}).bl1 || {}).rows || [];
    const me = bl.find((r) => r.isBVB);
    const fm = formOf('profis');
    const brief = (D.news || {}).briefing;
    const pro = team('profis');
    const feed = transferFeed().slice(0, 12);
    const missing = allPlayers().filter((p) => p.team === 'profis' && isOut(p));
    const win = windowInfo();
    const hist = historyItem();
    const bdays = birthdays();
    const heads = ((D.news || {}).headlines || []).slice(0, 4);
    let out = `<header class="hello">
      <div><div class="eyebrow">${esc(F.long.format(new Date()))}</div><h1>${esc(greeting())},<br><em>Borusse!</em></h1></div>
      <a class="live-pill press" href="#/mehr/update" aria-label="Update-Zentrale öffnen"><span class="dot ${liveDotClass()}"></span><span data-rel="${esc(st.lastRun || '')}">${st.lastRun ? esc(rel(st.lastRun)) : 'Update'}</span></a>
    </header>`;
    if (feed.length) {
      const seen = store.get('seen', {});
      out += `<div class="stories" role="list" aria-label="Transfer-Storys">${feed.map((it, i) => {
        const big = (STATUS[it.status] || {}).big;
        const ringCls = seen[it.key + '|' + it.status] ? 'seen' : big ? '' : 'rumor';
        const badge = big ? `<span class="story-badge">${I.check}</span>` : it.probability != null ? `<span class="story-badge rumor">${it.probability}%</span>` : '<span class="story-badge rumor">?</span>';
        return `<button type="button" class="story" role="listitem" data-action="story" data-i="${i}" aria-label="${esc(it.name)}: ${esc((STATUS[it.status] || {}).label || '')}">
          <span class="story-ring ${ringCls}"><span class="in">${img(pimg(it.img, 'medium'), '', it.name, initials(it.name))}</span>${badge}</span>
          <span class="story-name">${esc(lastName(it.name))}</span></button>`;
      }).join('')}</div>`;
    }
    out += nm ? heroMatch(nm) : '<section class="mhero"><span class="mh-light"></span><span class="eyebrow">Spielplan</span><p class="mh-name" style="margin-top:10px">Keine Spiele geplant</p></section>';
    if (brief && brief.text) {
      const fresh = store.get('briefSeen', '') !== brief.at;
      out += `<section class="brief clamp">
        <div class="row" style="margin-bottom:10px"><span class="ai-badge live">${I.ai}</span><span class="grow"><b style="font-size:14px">KI-Briefing</b><div class="faint" style="font-size:11px;font-weight:600">Gemini · ${esc(rel(brief.at))}</div></span></div>
        <p ${fresh && !reduce ? `data-type="${esc(brief.at)}"` : ''}>${esc(brief.text)}</p>
        <button type="button" class="more" data-action="brief-more">Weiterlesen</button></section>`;
    }
    const tiles = [];
    if (me) {
      const around = bl.filter((r) => Math.abs(r.pos - me.pos) <= 1 || (me.pos === 1 && r.pos <= 3)).slice(0, 3);
      tiles.push(`<a class="tile y stripes" href="#/spiele/profis/tabelle"><span class="eyebrow" style="position:relative">Bundesliga</span><span class="giant" style="position:relative">${me.pos}.</span><span class="sub" style="position:relative">${me.points} Punkte · ${me.goals}:${me.against} Tore</span>
        <span class="mini-table" style="position:relative">${around.map((r) => `<span class="${r.isBVB ? 'me' : ''}" style="display:flex;justify-content:space-between;padding:4px 8px;border-radius:9px"><span class="ellipsis">${r.pos}. ${esc(r.short || r.team)}</span><span>${r.points}</span></span>`).join('')}</span></a>`);
    }
    if (fm.length || lm) {
      tiles.push(`<a class="tile" href="#/spiele/profis/ergebnisse"><span class="eyebrow">Form</span>${formHtml(fm)}
        ${lm ? `<span style="margin-top:auto"><span class="faint" style="font-size:10px;font-weight:800;letter-spacing:.1em">LETZTES SPIEL · ${esc(compShort(lm.comp).toUpperCase())}</span><span class="big" style="display:block;margin-top:4px;font-size:24px">${esc(tname(lm.home))} <span class="yellow">${lm.score[0]}:${lm.score[1]}</span> ${esc(tname(lm.away))}</span><span class="sub" style="display:block;margin-top:4px">${esc(scorers(lm) || F.dm.format(new Date(lm.date)))}</span></span>` : ''}</a>`);
    }
    tiles.push(`<a class="tile tm-tile" href="#/transfers/tm"><span class="eyebrow">Transfermarkt</span>
      <span class="tm-tags" aria-hidden="true"><b>Profis</b><b>U23</b><b>U19</b></span>
      <span class="sub" style="margin-top:auto">Direkt zu transfermarkt.de</span></a>`);
    tiles.push(`<a class="tile" href="#/mehr/lazarett"><span class="eyebrow">Lazarett</span>
      <span class="big ${missing.length ? '' : 'green'}">${missing.length ? missing.length + ' fehlen' : 'Alle fit'}</span>
      <span class="stack-av" style="margin-top:auto">${missing.slice(0, 5).map((p) => img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))).join('')}</span>
      <span class="sub ellipsis">${missing.length ? esc(missing.slice(0, 2).map((p) => lastName(p.name)).join(', ')) + (missing.length > 2 ? ' …' : '') : 'Keine Ausfälle'}</span></a>`);
    if (win) {
      tiles.push(`<a class="tile" href="#/transfers/news"><span class="eyebrow">${win.open ? 'Fenster offen' : 'Transferfenster'}</span>
        <span style="position:relative;width:76px;height:76px;margin:2px 0">${ring(win.open ? win.days / win.total : 1 - win.days / win.total, 76, 7)}<span class="big" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:26px">${win.days}</span></span>
        <span class="sub">${win.open ? `schließt in ${win.days} Tagen` : `${win.name} öffnet in ${win.days} Tagen`}</span></a>`);
    }
    if (bdays.length) {
      const b = bdays[0];
      tiles.push(`<a class="tile" href="#/spieler/${b.p.team}/${b.p.id}"><span class="eyebrow">${b.days === 0 ? 'Heute Geburtstag' : `In ${b.days} ${b.days === 1 ? 'Tag' : 'Tagen'}`}</span>
        ${img(pimg(b.p.img, 'medium'), 'avatar', b.p.name, initials(b.p.name), 'style="width:56px;height:56px"')}
        <span class="big" style="font-size:22px;margin-top:auto">${esc(lastName(b.p.name))}</span><span class="sub">wird ${b.days === 0 ? b.p.age : (b.p.age || 0) + 1} · ${esc(TEAMNAME[b.p.team])}</span></a>`);
    }
    if (tiles.length % 2 === 1) tiles[tiles.length - 1] = tiles[tiles.length - 1].replace('class="tile', 'class="tile wide');
    if (hist) {
      tiles.push(`<a class="tile wide" href="#/mehr/erfolge"><span class="year-ghost" aria-hidden="true">${hist.h[1]}</span>
        <span class="eyebrow">${hist.today ? `Heute vor ${hist.years} Jahren` : `In ${hist.days} ${hist.days === 1 ? 'Tag' : 'Tagen'} · ${hist.years} Jahre`}</span>
        <span style="font-size:16px;font-weight:800;line-height:1.35;max-width:76%">${esc(hist.h[2])}</span><span class="sub">${esc(hist.h[0].slice(3))}.${esc(hist.h[0].slice(0, 2))}.${hist.h[1]}</span></a>`);
    }
    out += `<div class="bento">${tiles.join('')}</div>`;
    if (heads.length) {
      out += `<section class="sec"><div class="sec-h"><h2>Schlagzeilen</h2><a class="more" href="#/transfers/news">Alle</a></div>
        <div class="card flat">${heads.map((h) => `<a class="headline" href="${esc(h.url)}" target="_blank" rel="noopener"><span class="src-dot t${h.tier === 1 ? 1 : 2}" aria-hidden="true"></span><span class="grow"><div class="h-t">${esc(h.title)}</div><div class="h-m">${esc(h.outlet)} · ${esc(rel(h.date))}</div></span></a>`).join('')}</div></section>`;
    }
    out += '<p class="faint" style="font-size:11px;text-align:center;margin-top:26px;line-height:1.6;font-weight:600">Daten: Transfermarkt · OpenLigaDB · Google News · Gemini-KI · TheSportsDB<br>Inoffizielle Fan-App – nicht verbunden mit Borussia Dortmund</p>';
    return out;
  }

  function heroMatch(m) {
    const live = isLive(m);
    const word = `${tname(m.home)} · ${tname(m.away)} · `.toUpperCase().repeat(4);
    const n = daysUntil(m.date);
    const when = live ? 'Läuft' : n === 0 ? 'Heute' : n === 1 ? 'Morgen' : `in ${n} Tagen`;
    const goals = (m.goals || []).slice(-4).map((g) => `<span class="goal ${g.team === 'away' ? 'away' : ''}"><time>${g.minute != null ? g.minute + "'" : ''}</time><span>${esc(g.scorer || 'Tor')}</span><b>${esc(g.score || '')}</b></span>`).join('');
    return `<button type="button" class="mhero press ${live ? 'live' : ''}" data-action="match" data-id="${esc(m.id)}" data-team="profis" style="width:100%;text-align:left;font:inherit" aria-label="${esc(tname(m.home))} gegen ${esc(tname(m.away))}, Details öffnen">
      <span class="mh-light" aria-hidden="true"></span><span class="mh-beam l" aria-hidden="true"></span><span class="mh-beam r" aria-hidden="true"></span>
      <span class="mh-word" aria-hidden="true">${esc(word)}</span>
      <span class="mh-top">${live ? '<span class="live-tag">LIVE</span>' : `<span class="chip y">${esc(m.comp || '')}${m.round ? ' · ' + esc(m.round) : ''}</span>`}<span class="eyebrow" style="color:var(--y)">${esc(when)}</span></span>
      <span class="mh-teams" style="display:grid">
        <span class="mh-team">${crest(m.home, 'crest')}<span class="mh-name ellipsis">${esc(tname(m.home))}</span></span>
        ${live ? `<span class="mh-score">${m.score ? m.score[0] + ':' + m.score[1] : '0:0'}</span>` : '<span class="mh-vs">VS</span>'}
        <span class="mh-team">${crest(m.away, 'crest')}<span class="mh-name ellipsis">${esc(tname(m.away))}</span></span>
      </span>
      <span class="mh-meta" style="display:block">${esc(dayLabel(m.date))} · ${m.timeKnown === false ? 'Uhrzeit offen' : esc(F.time.format(new Date(m.date))) + ' Uhr'}${m.location ? ' · ' + esc(m.location) : ''}</span>
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
    const st = STATUS[it.status] || STATUS.interest;
    const big = st.big;
    const seen = store.get('seen', {});
    const k = it.key + '|' + it.status;
    const first = !seen[k];
    seen[k] = Date.now();
    store.set('seen', seen);
    const word = wordOf(it, 5);
    const stamp = big ? st.stamp : it.status === 'rumor' ? (it.probability != null ? `Gerücht<br>${it.probability}%` : 'Gerücht') : esc(st.label);
    const el = $('#story');
    el.classList.toggle('hwg', !!big);
    el.innerHTML = `<div class="st-bars">${ST.items.map((_, j) => `<span class="st-bar ${j < ST.i ? 'done' : j === ST.i ? 'on' : ''}"><i></i></span>`).join('')}</div>
      <div class="st-head"><span class="chip ${big ? 'ink' : 'warn'}">${big ? I.check : ''}${esc(st.label)}</span><span class="eyebrow" style="color:${big ? 'rgba(10,9,0,.7)' : 'var(--muted)'}">${it.date ? esc(fmtDate(it.date)) : ''}</span>
        <button type="button" class="st-close" data-action="story-close" aria-label="Story schließen">${I.x}</button></div>
      <section class="st-slide ${big ? 'hwg' : 'soft'}">
        <div class="st-words" aria-hidden="true"><div>${word}</div><div>${word}</div><div>${word}</div></div>
        <div class="st-stamp" aria-hidden="true">${stamp}</div>
        <div class="st-media">${it.img ? img(it.img, 'st-img', it.name, 'sil') : (big ? SIL : SIL_SOFT)}</div>
        <div class="st-info">
          <div class="st-flow">${crest(it.from)}<span class="tc-arrow" aria-hidden="true"></span>${crest(it.to)}</div>
          <div><h2 class="st-name">${esc(it.name)}</h2><div class="tc-meta">${esc(metaOf(it))}</div></div>
          <div class="tc-stats">${statsTriple(it)}</div>
          ${it.summary ? `<p class="tc-sum">${esc(it.summary)}</p>` : ''}
          <div class="tc-foot">${ampel(it)}${it.playerId && it.team ? `<a href="#/spieler/${it.team}/${it.playerId}" data-action="story-close" style="font-weight:800">Profil ›</a>` : ''}</div>
        </div>
      </section>
      <button type="button" class="st-tap prev" data-action="story-prev" aria-label="Vorherige Story" style="background:none;border:0"></button>
      <button type="button" class="st-tap next" data-action="story-next" aria-label="Nächste Story" style="background:none;border:0"></button>`;
    const bar = $('.st-bar.on i', el);
    if (bar) bar.addEventListener('animationend', () => storyStep(1), { once: true });
    if (big && first) setTimeout(() => confetti(), 350);
  }
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
    const marq = '<span>BORUSSIA DORTMUND · SÜDTRIBÜNE · BVB 09 · </span>';
    const tickets = TM_PAGES.map(([k, name, sub, wm, url], i) => {
      const t = team(k);
      return `<a class="tmp${i === 0 ? ' gold' : ''}" href="${url}" target="_blank" rel="noopener" style="--d:${(i * 1.6).toFixed(1)}s" aria-label="${name} auf Transfermarkt öffnen">
        <span class="tmp-wm" aria-hidden="true">${wm}</span>
        <span class="tmp-stub" aria-hidden="true"><img src="${BVB.crest}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>
        <span class="tmp-txt"><b>${name}</b><span>${esc(sub)}</span>${t.count ? `<span class="tmp-v">${t.count} Spieler</span>` : ''}</span>
        <span class="tmp-go" aria-hidden="true">${I.ext}</span>
      </a>`;
    }).join('');
    return `<section class="tmx" aria-label="Transfermarkt-Seiten">
      <div class="tmx-bg" aria-hidden="true">
        <span class="tmx-sky"></span><span class="tmx-beam l"></span><span class="tmx-beam r"></span>
        <span class="tmx-mast l">${'<i></i>'.repeat(8)}</span><span class="tmx-mast r">${'<i></i>'.repeat(8)}</span>
        <span class="tmx-marq">${marq}${marq}</span>
        <span class="tmx-wall"></span>
        <span class="tmx-sparks">${'<i></i>'.repeat(9)}</span>
      </div>
      <header class="tmx-head">
        <span class="tmx-badge"><img src="${BVB.crest}" alt="" decoding="async" referrerpolicy="no-referrer"></span>
        <h2>Transfer<em>markt</em></h2>
        <p>Profis, U23 und U19 – ein Tipp und du bist direkt auf der Seite.</p>
      </header>
      <div class="tmp-list stagger">${tickets}</div>
      <p class="tmx-foot">Öffnet transfermarkt.de</p>
    </section>`;
  }
  function vBilanz() {
    const tr0 = D.transfers || {};
    if (!tr0.in && !tr0.out) return '<div class="empty" style="margin-top:14px">Noch keine Transferdaten.</div>';
    const ins = [...(tr0.in || [])];
    const outs = [...(tr0.out || [])];
    const known = new Set([...ins, ...outs].map((x) => slug(x.name)));
    let addIn = 0;
    let addOut = 0;
    for (const s of (D.news || {}).stories || []) {
      if (s.status !== 'official' || !['in', 'out'].includes(s.direction) || known.has(slug(s.player))) continue;
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
      <span class="grow"><div class="t ellipsis">${esc(x.name)}${x.news ? ' <span class="chip ok sm">Neu</span>' : ''}</div><div class="s row" style="gap:6px">${crest(x.club, 'crest xs')}<span class="ellipsis">${dir === 'in' ? 'von' : 'zu'} ${esc((x.club || {}).name || UNK)}${x.news ? ' · laut ' + esc(x.news) : ''}</span></div></span>
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
    out += `<p class="faint" style="font-size:11px;margin-top:14px;text-align:center;font-weight:600">Quelle: Transfermarkt${addIn || addOut ? ' + neue offizielle Wechsel aus den News' : ''}</p>`;
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
    const tabOn = tab === 'cltabelle' ? 'tabelle' : tab;
    out += `<nav class="tabs" aria-label="Ansicht">${[['kommend', 'Kommende'], ['ergebnisse', 'Ergebnisse'], ['tabelle', 'Tabelle'], ['torschuetzen', 'Torschützen']].map(([t, l]) => `<a href="#/spiele/${k}/${t}" class="${t === tabOn ? 'on' : ''}">${l}</a>`).join('')}</nav>`;
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
    } else if (tab === 'tabelle' || tab === 'cltabelle') {
      const key = tab === 'cltabelle' ? 'ucl' : 'bl1';
      out += `<div style="margin-top:14px">${seg('tabelle', [['bl1', 'Bundesliga', '#/spiele/profis/tabelle'], ['ucl', 'Champions League', '#/spiele/profis/cltabelle']], key, 'sm')}</div>`;
      out += tableView(key);
    } else {
      out += scorerView(k);
    }
    return out;
  }
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
    const teamRow = (t, side) => `<span class="tk-team ${/Dortmund/.test(t.name || '') ? 'me' : ''}">${crest(t, 'crest md')}<span>${esc(tname(t))}</span>${fin || live ? `<b>${m.score ? m.score[side] : 0}</b>` : ''}</span>`;
    return `<button type="button" class="ticket ${isNext ? 'next' : ''} ${live ? 'live' : ''} ${fin ? 'res ' + (m.outcome || '') : ''}" data-action="match" data-id="${esc(m.id)}" data-team="${k}">
      <span class="tk-main"><span class="tk-comp">${live ? '<span class="live-tag">LIVE</span>' : `<span class="chip ${isNext ? 'y' : ''} sm">${esc(m.round || compShort(m.comp))}</span>`}<span class="eyebrow grow">${esc(m.comp || '')}</span>${when ? `<span class="eyebrow" style="color:var(--y)">${esc(when)}</span>` : ''}</span>
      <span class="tk-teams">${teamRow(m.home, 0)}${teamRow(m.away, 1)}</span></span>
      <span class="tk-stub">${stub}</span>
    </button>`;
  }
  function tableView(key) {
    const t = (D.tables || {})[key];
    if (!t || !t.rows || !t.rows.length) return '<div class="empty" style="margin-top:14px">Tabelle noch nicht verfügbar.</div>';
    const n = t.rows.length;
    const zone = (p) => (key === 'ucl' ? (p <= 8 ? 'z-cl' : p <= 24 ? 'z-el' : 'z-ab')
      : p <= 4 ? 'z-cl' : p === 5 ? 'z-el' : p === 6 ? 'z-ecl' : p === n - 2 ? 'z-rel' : p > n - 2 ? 'z-ab' : '');
    return `<p class="faint" style="font-size:12px;margin:14px 2px 8px;font-weight:600">${esc(t.name || '')}${t.updatedAt ? ' · Stand ' + esc(rel(t.updatedAt)) : ''}</p>
      <div class="card" style="padding:6px 8px"><table class="table"><thead><tr><th>#</th><th>Verein</th><th>Sp</th><th>TD</th><th>Pkt</th></tr></thead><tbody>
      ${t.rows.map((r) => `<tr class="${r.isBVB ? 'me' : ''}"><td><span class="zone ${zone(r.pos)}"></span>${r.pos}</td><td><span class="tm">${crest({ name: r.team, icon: r.icon }, 'crest xs')}<span>${esc(r.short || r.team)}</span></span></td><td>${r.played}</td><td>${r.diff > 0 ? '+' : ''}${r.diff}</td><td>${r.points}</td></tr>`).join('')}
      </tbody></table></div>
      ${key === 'bl1' ? '<p class="faint" style="font-size:11px;margin-top:10px;line-height:2;font-weight:600"><span class="zone z-cl"></span>Champions League &nbsp; <span class="zone z-el"></span>Europa League &nbsp; <span class="zone z-ecl"></span>Conference League &nbsp; <span class="zone z-rel"></span>Relegation &nbsp; <span class="zone z-ab"></span>Abstieg</p>'
    : '<p class="faint" style="font-size:11px;margin-top:10px;line-height:2;font-weight:600"><span class="zone z-cl"></span>Achtelfinale &nbsp; <span class="zone z-el"></span>Playoffs &nbsp; <span class="zone z-ab"></span>Ausgeschieden</p>'}`;
  }
  function scorerView(k) {
    const ps = (team(k).players || []).map((p) => Object.assign({ s: statsOf(k, p.id) || {} }, p)).filter((p) => (p.s.goals || 0) + (p.s.assists || 0) > 0)
      .sort((a, b) => ((b.s.goals || 0) - (a.s.goals || 0)) || ((b.s.assists || 0) - (a.s.assists || 0)));
    if (!ps.length) return '<div class="empty" style="margin-top:14px">Noch keine Torschützen.</div>';
    const top = ps.slice(0, 3);
    const order = [top[1], top[0], top[2]];
    const pod = order.map((p, i) => (p ? `<a class="pod ${['p2', 'p1', 'p3'][i]}" href="#/spieler/${k}/${p.id}">${img(pimg(p.img, 'medium'), 'avatar', p.name, initials(p.name))}<span class="pod-name">${esc(lastName(p.name))}</span><span class="pod-block"><b>${p.s.goals || 0}</b><span>Tore</span></span></a>` : '<span></span>')).join('');
    return `<p class="faint" style="font-size:12px;margin:14px 2px 0;font-weight:600">Alle Wettbewerbe${k === 'profis' ? ' · Tore live aus den Spielberichten' : ''}</p>
      <div class="podium">${pod}</div>
      <div class="card flat" style="margin-top:14px"><div class="list">${ps.map((p, i) => `<a class="li" href="#/spieler/${k}/${p.id}"><span class="rank">${i + 1}</span>${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}
      <span class="grow"><div class="t ellipsis">${esc(p.name)}</div><div class="s">${p.s.apps || 0} Spiele · ${p.s.assists || 0} Vorlagen</div></span><span class="num yellow" style="font-size:24px">${p.s.goals || 0}</span></a>`).join('')}</div></div>`;
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
    for (const [g, l] of GROUPS) {
      const gp = ps.filter((p) => p.group === g);
      if (gp.length) out += `<h2 class="group-h">${l} <span>${gp.length}</span></h2><div class="pgrid stagger">${gp.map((p) => pCard(p, k)).join('')}</div>`;
    }
    const rest = ps.filter((p) => !GROUPS.some(([g]) => g === p.group));
    if (rest.length) out += `<h2 class="group-h">Weitere</h2><div class="pgrid">${rest.map((p) => pCard(p, k)).join('')}</div>`;
    return out;
  }
  function pCard(p, k) {
    const ab = absencesOf(p).filter((a) => a.type !== 'ineligible');
    const s = statsOf(k, p.id) || {};
    const line = `${s.apps || 0} Sp.${s.goals ? ` · ${s.goals} ${s.goals === 1 ? 'Tor' : 'Tore'}` : ''}`;
    return `<a class="pc ${ab.length ? 'out' : ''}" href="#/spieler/${k}/${p.id}" data-vt="player">
      <span class="pc-media">${p.number ? `<span class="pc-num" aria-hidden="true">${esc(p.number)}</span>` : ''}${img(pimg(p.img, 'big'), '', p.name, initials(p.name))}${ab.length ? `<span class="pc-abs chip sm ${ab[0].type === 'injury' ? 'loss' : 'warn'}">${ab[0].type === 'injury' ? 'Verletzt' : 'Fehlt'}</span>` : ''}</span>
      <span class="pc-body"><span class="pc-name">${esc(p.name)}${p.captain ? ' <span class="yellow">©</span>' : ''}</span><span class="pc-pos">${esc(p.position || UNK)} · ${p.age || UNK} J.</span><span class="pc-val">${esc(line)}</span></span>
    </a>`;
  }
  const INJ = { injured: 'Fällt aus:', doubtful: 'Fraglich:', back: 'Zurück im Training:', fit: 'Wieder fit:', suspended: 'Gesperrt:' };
  function vSpieler(k, id) {
    const p = findPlayer(k, id);
    if (!p) return pageHead('Spieler', '', '', '#/kader/' + k) + '<div class="empty">Spieler nicht gefunden.</div>';
    const st = statsOf(k, id) || {};
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
      <span class="phero-team">KADER · ${esc(TEAMNAME[k].toUpperCase())}</span>
      <div class="phero-n"><b>#${esc(p.number || UNK)}</b><span class="chip ink">${esc(p.group || '')}</span>${p.captain ? '<span class="chip ink">Kapitän</span>' : ''}</div>
      <div class="phero-name"><h1>${esc(p.name)}</h1><span>${esc([p.position || `Position ${UNK}`, p.age ? p.age + ' Jahre' : `Alter ${UNK}`, (p.flags || []).map((f) => f.name).join(' / ')].filter(Boolean).join(' · '))}</span></div>
    </section>`;
    out += `<section class="grid4" style="margin-top:6px">
      <div class="stat-box"><b>${st.apps || 0}</b><span>Spiele</span></div>
      <div class="stat-box"><b class="yellow">${st.goals || 0}</b><span>Tore</span></div>
      <div class="stat-box"><b>${st.assists || 0}</b><span>Vorlagen</span></div>
      <div class="stat-box"><b>${st.minutes || 0}'</b><span>Minuten</span></div>
    </section>`;
    out += contract || `<section class="card row" style="margin-top:12px;gap:12px"><span class="eyebrow grow">Vertrag bis</span><b style="font-size:18px">${UNK}</b></section>`;
    if (abs.length || injNews.length) {
      out += `<section class="sec"><div class="sec-h"><h2>Status</h2></div><div style="display:flex;flex-direction:column;gap:8px">
        ${abs.map((a) => `<div class="note-box ${a.type === 'ineligible' ? '' : 'alert'}">${a.type === 'ineligible' ? I.info : I.injury}<span>${esc(a.text)}</span></div>`).join('')}
        ${injNews.map((n) => `<div class="note-box"><span class="ai-badge sm">${I.ai}</span><span><b>${esc(INJ[n.status] || '')}</b> ${esc(n.text || '')}${n.expectedReturn ? ` · Rückkehr: ${esc(n.expectedReturn)}` : ''}<div class="faint" style="font-size:11px;margin-top:3px;font-weight:600">${esc(n.source || '')} · ${esc(fmtDate(n.date))} · via Gemini</div></span></div>`).join('')}
      </div></section>`;
    }
    if (stories.length) out += `<section class="sec"><div class="sec-h"><h2>Transfer-News</h2></div><div style="display:flex;flex-direction:column;gap:14px">${stories.slice(0, 2).map(tCard).join('')}</div></section>`;
    out += `<section class="card flat" style="margin-top:18px">
      ${p.joined ? `<div class="kv"><span>Im Team seit</span><span>${fmtDate(p.joined)}${p.from ? ` · von ${esc(p.from.name)}` : ''}</span></div>` : ''}
      ${p.from && p.from.fee && p.from.fee !== '-' ? `<div class="kv"><span>Ablöse damals</span><span>${esc(p.from.fee)}</span></div>` : ''}
      ${p.birth ? `<div class="kv"><span>Geburtstag</span><span>${fmtDate(p.birth)}</span></div>` : ''}
      ${p.height ? `<div class="kv"><span>Größe</span><span>${esc(p.height)}</span></div>` : ''}
      ${p.foot ? `<div class="kv"><span>Starker Fuß</span><span>${esc(p.foot)}</span></div>` : ''}
      ${p.flags && p.flags.length ? `<div class="kv"><span>Nation</span><span>${flagImgs(p.flags)} ${esc(p.flags.map((f) => f.name).join(' / '))}</span></div>` : ''}
      <div class="kv"><span>Karten</span><span>${st.yellow || 0} Gelb · ${(st.yellowRed || 0) + (st.red || 0)} Rot</span></div>
      ${p.aiAdded ? `<div class="kv"><span>Im Kader seit</span><span>${fmtDate(p.joined)} · ${esc(p.aiAdded)}</span></div>` : ''}
    </section>
    ${/^\d+$/.test(id) ? `<a class="btn ghost" style="margin-top:12px" href="https://www.transfermarkt.de/x/profil/spieler/${esc(id)}" target="_blank" rel="noopener">Profil auf Transfermarkt ${I.ext.replace('<svg', '<svg style="stroke:currentColor"')}</a>` : ''}`;
    return out;
  }

  // ------------------------------------------------------------------ Mehr
  function vMehr() {
    const st = D.status || {};
    const items = [
      ['#/mehr/stats', I.chart, 'Statistiken', 'Tore, Vorlagen, Minuten'],
      ['#/mehr/elf', I.shirt, 'Meine Elf', 'Deine Traum-Aufstellung'],
      ['#/mehr/lazarett', I.cross, 'Lazarett', 'Verletzte & Rückkehrer'],
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
    const k = UI.statsTeam;
    const ps = (team(k).players || []).map((p) => Object.assign({ s: statsOf(k, p.id) || {} }, p));
    const boards = [['goals', 'Tore'], ['assists', 'Vorlagen'], ['scorer', 'Scorerpunkte'], ['apps', 'Einsätze'], ['minutes', 'Spielminuten'], ['yellow', 'Gelbe Karten']];
    const val = (p, key) => (key === 'scorer' ? (p.s.goals || 0) + (p.s.assists || 0) : p.s[key] || 0);
    const src = ((D.stats || {}).source || {})[k] || 'Transfermarkt';
    let out = pageHead('Statis<em>tiken</em>', 'Saison ' + esc(String((D.stats || {}).season || '')) + ' · Quelle: ' + esc(src), '', '#/mehr');
    out += teamSwitch('statsTeam', [['profis', 'Profis', ''], ['u23', 'BVB II', ''], ['u19', 'U19', '']]);
    out += `<div class="grid3" style="margin-top:12px"><div class="stat-box"><b class="yellow">${ps.reduce((s, p) => s + (p.s.goals || 0), 0)}</b><span>Tore</span></div><div class="stat-box"><b>${ps.reduce((s, p) => s + (p.s.assists || 0), 0)}</b><span>Vorlagen</span></div><div class="stat-box"><b>${ps.filter((p) => p.s.apps).length}</b><span>Eingesetzt</span></div></div>`;
    for (const [key, label] of boards) {
      const top = ps.filter((p) => val(p, key) > 0).sort((a, b) => val(b, key) - val(a, key)).slice(0, 5);
      const mx = top.length ? val(top[0], key) : 1;
      out += `<section class="sec"><div class="sec-h"><h2>${label}</h2></div><div class="card flat"><div class="list">
        ${top.length ? top.map((p, i) => `<a class="li" href="#/spieler/${k}/${p.id}"><span class="rank">${i + 1}</span>${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}
          <span class="grow" style="display:flex;flex-direction:column;gap:6px"><span class="row" style="justify-content:space-between"><span class="t ellipsis">${esc(p.name)}</span><span class="v">${nf0.format(val(p, key))}${key === 'minutes' ? "'" : ''}</span></span><span class="bar"><span style="width:${(val(p, key) / mx * 100).toFixed(0)}%;animation-delay:${i * 0.05}s"></span></span></span></a>`).join('') : '<p class="muted" style="padding:12px 0;font-size:13px">Noch keine Werte.</p>'}
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
    const goals = chosen.reduce((s, p) => s + ((statsOf('profis', p.id) || {}).goals || 0), 0);
    const age = chosen.length ? (chosen.reduce((s, p) => s + (p.age || 0), 0) / chosen.length).toFixed(1).replace('.', ',') : '–';
    let out = pageHead('Meine <em>Elf</em>', 'Tippe auf eine Position', '', '#/mehr');
    out += `<div class="chips" role="group" aria-label="Formation">${Object.keys(FORMATIONS).map((f) => `<button type="button" class="${f === e.f ? 'on' : ''}" aria-pressed="${f === e.f}" data-action="formation" data-val="${f}">${f}</button>`).join('')}</div>`;
    out += `<div class="pitch" style="margin-top:14px">
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
  function openSlot(i) {
    const e = elf();
    const slots = FORMATIONS[e.f] || FORMATIONS['4-3-3'];
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
    // Wer schon bei den Profis spielt, steht oben - danach BVB II und U19, jeweils nach Einsaetzen und Toren
    const sOf = (p) => statsOf(p.team, p.id) || {};
    const lvl = { profis: 2, u23: 1, u19: 0 };
    list.sort((a, b) => (lvl[b.team] - lvl[a.team]) || ((sOf(b).apps || 0) - (sOf(a).apps || 0)) || ((sOf(b).goals || 0) - (sOf(a).goals || 0)) || (a.age - b.age));
    const mx = Math.max(1, ...list.map((p) => sOf(p).apps || 0));
    const line = (p) => { const s = sOf(p); return `${s.apps || 0} Sp.${s.goals ? ` · ${s.goals} ${s.goals === 1 ? 'Tor' : 'Tore'}` : ''}`; };
    let out = pageHead('Talente-<em>Radar</em>', 'Alle Spieler bis 21 Jahre', '', '#/mehr');
    if (list.length >= 3) {
      out += `<div class="pgrid" style="grid-template-columns:repeat(3,minmax(0,1fr))">${list.slice(0, 3).map((p) => `<a class="pc" href="#/spieler/${p.team}/${p.id}" data-vt="player"><span class="pc-media" style="height:120px">${img(pimg(p.img, 'big'), '', p.name, initials(p.name), 'style="height:116px"')}</span><span class="pc-body"><span class="pc-name" style="font-size:15px">${esc(lastName(p.name))}</span><span class="pc-pos">${p.age} J. · ${esc(TEAMNAME[p.team])}</span><span class="pc-val" style="font-size:15px">${esc(line(p))}</span></span></a>`).join('')}</div>`;
    }
    out += `<div class="card flat" style="margin-top:14px"><div class="list">${list.slice(0, 30).map((p, i) => `<a class="li" href="#/spieler/${p.team}/${p.id}"><span class="rank">${i + 1}</span>${img(pimg(p.img, 'medium'), 'avatar sm', p.name, initials(p.name))}
      <span class="grow" style="display:flex;flex-direction:column;gap:5px"><span class="row" style="justify-content:space-between;gap:8px"><span class="t ellipsis">${esc(p.name)}</span><span class="v">${esc(line(p))}</span></span>
      <span class="s">${p.age || UNK} J. · ${esc(p.position || UNK)} · ${esc(TEAMNAME[p.team])}</span><span class="bar"><span style="width:${Math.max(2, (sOf(p).apps || 0) / mx * 100).toFixed(0)}%;animation-delay:${Math.min(i, 14) * 0.04}s"></span></span></span></a>`).join('') || '<p class="muted" style="padding:12px 0">Keine Daten.</p>'}</div></div>`;
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
    let out = pageHead('Laza<em>rett</em>', 'Transfermarkt + Gemini-News', '', '#/mehr');
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
      <p><b>Transfermarkt</b> sperrt Server mit einem Bot-Schutz. Positionen, Verträge sowie Kader und Statistiken von BVB II und U19 stammen daher vom letzten direkten Abruf; Verlängerungen und Wechsel ergänzt die KI aus den News.</p>
      <p><b>Gerüchte-Ampel:</b> grün = sehr verlässlich (z. B. Fabrizio Romano, Sky, kicker, Ruhr Nachrichten), gelb = meist verlässlich (z. B. Bild, Sport1, Transfermarkt). Alles andere wird gar nicht angezeigt.</p>
      <p class="faint">Alle Angaben ohne Gewähr. KI-Zusammenfassungen können Fehler enthalten.</p>
    </section><a class="btn ghost" style="margin-top:12px" href="https://github.com/${REPO}" target="_blank" rel="noopener">${I.github} Projekt auf GitHub</a>`;
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
    setTimeout(() => { sh.hidden = true; sh.classList.remove('closing'); if ($('#story').hidden) document.body.style.overflow = ''; }, reduce ? 0 : 260);
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
    openSheet(`<div style="display:flex;flex-direction:column;gap:16px;padding-top:4px">
      <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap">${live ? '<span class="live-tag">LIVE</span>' : ''}<span class="chip y">${esc(m.comp || '')}${m.round ? ' · ' + esc(m.round) : ''}</span></div>
      <div class="mh-teams" style="display:grid;margin:0"><div class="mh-team">${crest(m.home, 'crest xl')}<span class="mh-name">${esc(tname(m.home))}</span></div>
        ${fin || live ? `<div style="text-align:center"><div class="mh-score">${m.score ? m.score[0] + ':' + m.score[1] : '0:0'}</div>${m.half ? `<span class="eyebrow">HZ ${m.half[0]}:${m.half[1]}</span>` : ''}</div>` : '<span class="mh-vs">VS</span>'}
        <div class="mh-team">${crest(m.away, 'crest xl')}<span class="mh-name">${esc(tname(m.away))}</span></div></div>
      <p class="muted" style="text-align:center;font-size:13px;font-weight:600">${esc(dayLabel(m.date))} · ${m.timeKnown === false ? 'Uhrzeit offen' : esc(F.time.format(new Date(m.date))) + ' Uhr'}${m.location ? ' · ' + esc(m.location) : ''}</p>
      ${!fin && !live ? `${odoHtml(m.date)}<a class="btn ghost" href="${icsFor(m)}" download="bvb-spiel.ics">${I.cal} In den Kalender</a>` : ''}
      ${goals ? `<section><h3 class="eyebrow" style="margin-bottom:10px">Tore</h3><div class="goals">${goals}</div></section>` : fin ? '<p class="muted" style="text-align:center;font-size:13px">Keine Torschützen-Daten.</p>' : ''}
      <button type="button" class="btn" data-close>Schließen</button></div>`);
  }

  // ------------------------------------------------------------------ Router
  const ROUTES = [
    [/^\/home$/, 'home', () => vHome(), 'BVB 09'],
    [/^\/transfers(?:\/(news|tm|werte|bilanz|vertraege))?$/, 'transfers', (m) => vTransfers(m[1] || 'news'), 'Transfers'],
    [/^\/spiele(?:\/(profis|u23))?(?:\/(kommend|ergebnisse|tabelle|cltabelle|torschuetzen))?$/, 'spiele', (m) => vSpiele('profis', m[2] || 'kommend'), 'Spiele'],
    [/^\/kader(?:\/(profis|u23|u19))?$/, 'kader', (m) => vKader(m[1] || UI.kaderTeam || 'profis'), 'Kader'],
    [/^\/spieler\/(profis|u23|u19)\/([\w-]+)$/, 'kader', (m) => vSpieler(m[1], m[2]), (m) => ((findPlayer(m[1], m[2]) || {}).name || 'Spieler')],
    [/^\/mehr$/, 'mehr', () => vMehr(), 'Mehr'],
    [/^\/mehr\/update$/, 'mehr', () => vUpdate(), 'Update-Zentrale'],
    [/^\/mehr\/stats$/, 'mehr', () => vStats(), 'Statistiken'],
    [/^\/mehr\/elf$/, 'mehr', () => vElf(), 'Meine Elf'],
    [/^\/mehr\/talente$/, 'mehr', () => vTalente(), 'Talente-Radar'],
    [/^\/mehr\/lazarett$/, 'mehr', () => vLazarett(), 'Lazarett'],
    [/^\/mehr\/erfolge$/, 'mehr', () => vErfolge(), 'Erfolge'],
    [/^\/mehr\/install$/, 'mehr', () => vInstall(), 'Installieren'],
    [/^\/mehr\/info$/, 'mehr', () => vInfo(), 'Über die App'],
  ];
  const TABS = ['home', 'transfers', 'spiele', 'kader', 'mehr'];
  const skeleton = () => '<div class="skel" style="height:80px;margin-bottom:16px"></div><div class="row" style="gap:14px;margin-bottom:18px">' + '<div class="skel" style="width:70px;height:70px;border-radius:50%;flex:none"></div>'.repeat(4) + '</div><div class="skel" style="height:310px"></div><div class="bento"><div class="skel" style="height:150px"></div><div class="skel" style="height:150px"></div></div>';
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
    backBtn.hidden = !(path.startsWith('/mehr/') || path.startsWith('/spieler/'));
    backBtn.dataset.fallback = path.startsWith('/spieler/') ? '#/kader/' + m[1] : '#/mehr';
    if (!same && !opts.keepScroll) window.scrollTo(0, 0);
    S.route = path;
    S.tabIdx = ti;
    S.depth = depth;
    afterRender(v, opts);
    onScroll();
    saveUI();
  }
  function afterRender(v, opts) {
    raf2(() => {
      $$('.seg-ind[data-to]', v).forEach((el) => { el.style.transform = `translateX(${el.dataset.to}%)`; });
      $$('.ring-svg .val[data-off], .uz-ring .val[data-off]', v).forEach((c) => { c.style.strokeDashoffset = c.dataset.off; });
    });
    if (opts.animate !== false) countUps(v);
    const tp = $('[data-type]', v);
    if (tp) { store.set('briefSeen', tp.dataset.type); tp.removeAttribute('data-type'); typewriter(tp); }
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
    t.finished.finally(() => { imgEl.style.viewTransitionName = ''; });
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { closeSheet(); return; }
    const vt = e.target.closest('a[data-vt="player"]');
    if (vt && !e.metaKey && !e.ctrlKey && document.startViewTransition && !reduce) {
      const im = $('.pc-media img', vt);
      if (im) { e.preventDefault(); navigateVT(vt.getAttribute('href'), im); return; }
    }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action;
    if (act === 'team') { UI[a.dataset.key] = a.dataset.val; render({ forceAnim: true, keepScroll: true }); }
    else if (act === 'filter') { UI.newsFilter = a.dataset.val; render({ forceAnim: true, keepScroll: true }); }
    else if (act === 'kfilter') {
      UI.kaderFilter = a.dataset.val;
      $$('[data-action="kfilter"]').forEach((b) => { b.classList.toggle('on', b === a); b.setAttribute('aria-pressed', b === a); });
      $('#kgrid').innerHTML = kaderGrid(UI.kaderTeam);
      saveUI();
    }
    else if (act === 'tmore') { const box = a.nextElementSibling; const open = !box.classList.contains('open'); box.classList.toggle('open', open); a.setAttribute('aria-expanded', open); }
    else if (act === 'brief-more') { const b = a.closest('.brief'); b.classList.toggle('clamp'); a.textContent = b.classList.contains('clamp') ? 'Weiterlesen' : 'Weniger'; }
    else if (act === 'match') openMatch(a.dataset.id, a.dataset.team);
    else if (act === 'story') { e.preventDefault(); openStories(transferFeed().slice(0, 12), +a.dataset.i, $('.story-ring', a)); }
    else if (act === 'story-next') { if (ST.held) { ST.held = false; return; } storyStep(1); }
    else if (act === 'story-prev') { if (ST.held) { ST.held = false; return; } storyStep(-1); }
    else if (act === 'story-close') closeStories();
    else if (act === 'back') { if (history.length > 1 && S.prev) history.back(); else location.hash = a.dataset.fallback || '#/home'; }
    else if (act === 'reload') { a.disabled = true; refresh(true).then(() => { a.disabled = false; }); }
    else if (act === 'formation') { const el = elf(); el.f = a.dataset.val; el.s = {}; store.set('elf', el); render({ animate: false }); }
    else if (act === 'slot') openSlot(+a.dataset.i);
    else if (act === 'pick') { const el = elf(); if (a.dataset.id) el.s[a.dataset.i] = a.dataset.id; else delete el.s[a.dataset.i]; store.set('elf', el); closeSheet(); render({ animate: false }); }
    else if (act === 'elf-reset') { store.set('elf', { f: elf().f, s: {} }); render({ animate: false }); }
  });
  document.addEventListener('input', (e) => {
    if (e.target && e.target.dataset && e.target.dataset.action === 'search') { UI.kaderSearch = e.target.value; $('#kgrid').innerHTML = kaderGrid(UI.kaderTeam); }
  });
  document.addEventListener('keydown', (e) => {
    if (!$('#story').hidden) {
      if (e.key === 'Escape') closeStories();
      else if (e.key === 'ArrowRight') storyStep(1);
      else if (e.key === 'ArrowLeft') storyStep(-1);
      return;
    }
    if (e.key === 'Escape') closeSheet();
  });
  window.addEventListener('hashchange', () => { S.prev = true; closeSheet(); render(); });

  // Ziehen zum Aktualisieren
  (() => {
    let y0 = null;
    let dy = 0;
    const ptr = $('#ptr');
    window.addEventListener('touchstart', (e) => { y0 = window.scrollY <= 0 && $('#sheet').hidden && $('#story').hidden ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
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
            const ours = (g.team === 'home') === m.isHome && !g.ownGoal;
            toast(`${ours ? 'TOOOR für den BVB!' : 'Tor'} ${g.scorer || ''} · ${g.score}`);
            if (ours) confetti();
          }
        }
      } catch (e) { /* offline */ }
    }
    if (changed && !once && (S.tab === 'home' || S.tab === 'spiele')) render({ animate: false, keepScroll: true });
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
    render();
    await loadData(false);
    await pollLive(true);
    const wait = Math.max(0, (reduce ? 200 : 1500) - (Date.now() - t0));
    setTimeout(() => {
      const sp = $('#splash');
      sp.classList.add('out');
      setTimeout(() => render({ forceAnim: true }), reduce ? 0 : 380);
      setTimeout(() => sp.classList.add('gone'), reduce ? 0 : 700);
      setTimeout(() => sp.remove(), reduce ? 50 : 1100);
    }, wait);
    setInterval(tick, 1000);
    setInterval(relTick, 30000);
    setInterval(() => pollLive(false), 30000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - S.lastLoad > 10 * 60e3) loadData(false).then(() => render({ animate: false, keepScroll: true }));
    });
  }
  init();
})();
