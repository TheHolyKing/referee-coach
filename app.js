'use strict';

// ══════════════════════════════════════════════════════════
//  DATA LAYER
// ══════════════════════════════════════════════════════════

const DB = {
  save(key, val) {
    try { localStorage.setItem('rc_' + key, JSON.stringify(val)); } catch(e) {}
  },
  load(key, fallback = null) {
    try {
      const v = localStorage.getItem('rc_' + key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch(e) { return fallback; }
  }
};

// ══════════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════════

const State = {
  referees: DB.load('referees', []),
  matches:  DB.load('matches', []),

  saveReferees() { DB.save('referees', this.referees); },
  saveMatches()  { DB.save('matches',  this.matches); },

  addReferee(ref) {
    ref.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    ref.createdAt = Date.now();
    this.referees.push(ref);
    this.saveReferees();
    return ref;
  },

  updateReferee(id, updates) {
    const i = this.referees.findIndex(r => r.id === id);
    if (i >= 0) { Object.assign(this.referees[i], updates); this.saveReferees(); }
  },

  deleteReferee(id) {
    this.referees = this.referees.filter(r => r.id !== id);
    this.matches  = this.matches.filter(m => m.refereeId !== id);
    this.saveReferees();
    this.saveMatches();
  },

  addMatch(match) {
    match.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    match.createdAt = Date.now();
    this.matches.push(match);
    this.saveMatches();
    return match;
  },

  updateMatch(id, updates) {
    const i = this.matches.findIndex(m => m.id === id);
    if (i >= 0) { Object.assign(this.matches[i], updates); this.saveMatches(); }
  },

  deleteMatch(id) {
    this.matches = this.matches.filter(m => m.id !== id);
    this.saveMatches();
  },

  getMatch(id) { return this.matches.find(m => m.id === id); },
  getReferee(id) { return this.referees.find(r => r.id === id); },

  matchesForReferee(id) {
    return this.matches
      .filter(m => m.refereeId === id)
      .sort((a, b) => (b.date || 0) - (a.date || 0));
  }
};

// ══════════════════════════════════════════════════════════
//  PHASE DEFINITIONS
// ══════════════════════════════════════════════════════════

const PHASES = {
  'Scrum': {
    outcomes: ['Good','Reset','Wheeled','Collapsed','PK','FK','Advantage','Penalty Try'],
    infringements: ['Boring In','Binding','Crooked Feed','Prop Collapse','Not Straight','Early Engagement','Popping','Pulling Down','No Push','Other'],
    resetReasons: ['Collapse','Early Engage','Same Tunnel','Standing Up']
  },
  'Lineout': {
    outcomes: ['Good','Won Against','Disrupted','PK','FK','Advantage'],
    infringements: ['Not Straight','Lifting Early','Interference','Obstruction','Short Throw','Closing Gap','Off Feet','Offside','Other']
  },
  'Tackle': {
    outcomes: ['Good','Slow','Played Away','PK','Unplayable','Missed'],
    infringements: ['Tackler Release','Holding On','Not Rolling','Off Feet','Entry','Hands','Double Movement','Offside','No Arms','Other']
  },
  'Ruck': {
    outcomes: ['Good','Slow','Turnover','Unplayable','Advantage','PK','Missed'],
    infringements: ['Entry','Hands','Off Feet','Not Rolling','Bridging','Offside','No Arms','Neck Roll','Other']
  },
  'Maul': {
    outcomes: ['Good','Slow','Turnover','Unplayable','PK','FK','Penalty Try','Collapsed'],
    infringements: ['Offside','Collapsed','Obstruction','Hands','Other']
  },
  'Pen Gen Play': {
    outcomes: ['PK','FK','Advantage'],
    infringements: ['Offside','High Tackle','Obstruction','Foul Play','Not Releasing','Hands in Ruck','Time Wasting','Other']
  },
  'Free Kick': {
    outcomes: ['FK'],
    infringements: ['Offside','Quick Tap','Scrum Infringement','Lineout Infringement','Deliberate Knock On','Other']
  },
  'Advantage': {
    outcomes: ['Played On','Penalty','Insufficient'],
    infringements: ['Offside','High Tackle','Obstruction','Foul Play','Not Releasing','Hands','Other']
  },
  'Critical': {
    outcomes: ['Yellow Card','Red Card','TMO Review','Injury','Scuffle','Warning','Penalty Try'],
    infringements: ['High Tackle','Foul Play','Dangerous Play','Repeated Infringement','Other']
  }
};

// ══════════════════════════════════════════════════════════
//  ASSESSMENT AREAS
// ══════════════════════════════════════════════════════════

const AREAS = [
  { id: 'penalty',      label: 'Penalty Decision Accuracy',   sub: 'Correct/incorrect calls, consistency' },
  { id: 'setpiece',     label: 'Set Piece Management',        sub: 'Scrums, lineouts — decisions & positioning' },
  { id: 'positioning',  label: 'Positioning & Fitness',       sub: 'Field position, angles, work rate' },
  { id: 'communication',label: 'Communication & Control',     sub: 'Player management, communication style' },
  { id: 'laws',         label: 'Law Application',             sub: 'Specific law areas applied well or struggled with' },
  { id: 'officials',    label: 'Support Officials Management',sub: 'AR1, AR2, TMO use and communication' },
  { id: 'gamecontrol',  label: 'Game Control',                sub: 'Control of tempo, management of flashpoints' },
  { id: 'consistency',  label: 'Decision Consistency',        sub: 'Consistency across both teams and throughout match' },
];

// ══════════════════════════════════════════════════════════
//  ROUTER / NAVIGATION
// ══════════════════════════════════════════════════════════

const Router = {
  stack: ['home'],

  current() { return this.stack[this.stack.length - 1]; },

  push(screenId) {
    if (this.current() === screenId) return; // already here — ignore
    const prev = document.getElementById('screen-' + this.current());
    if (prev) prev.classList.add('slide-left');
    this.stack.push(screenId);
    const next = document.getElementById('screen-' + screenId);
    if (next) {
      next.offsetHeight; // force reflow before adding active
      next.classList.add('active');
    }
  },

  pop() {
    if (this.stack.length <= 1) return;
    const cur = document.getElementById('screen-' + this.current());
    if (cur) cur.classList.remove('active');
    this.stack.pop();
    const prev = document.getElementById('screen-' + this.current());
    if (prev) prev.classList.remove('slide-left');
  },

  replace(screenId) {
    const cur = document.getElementById('screen-' + this.current());
    if (cur) cur.classList.remove('active');
    this.stack[this.stack.length - 1] = screenId;
    const next = document.getElementById('screen-' + screenId);
    if (next) next.classList.add('active');
  }
};

// ══════════════════════════════════════════════════════════
//  TIMER
// ══════════════════════════════════════════════════════════

const Timer = {
  elapsed: 0,
  running: false,
  matchPhase: 'pregame', // pregame | first | halftime | second | fulltime
  _interval: null,
  _startedAt: null,

  start() {
    if (this.running) return;
    // Advance phase on first start and after half time
    if (this.matchPhase === 'pregame')  this.matchPhase = 'first';
    if (this.matchPhase === 'halftime') this.matchPhase = 'second';
    this.running = true;
    this._startedAt = Date.now() - this.elapsed * 1000;
    this._interval = setInterval(() => {
      this.elapsed = Math.floor((Date.now() - this._startedAt) / 1000);
      Timer.render();
    }, 500);
    this.renderControls();
  },

  pause() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this._interval);
    this.renderControls();
  },

  toggle() { this.running ? this.pause() : this.start(); },

  pressHalfTime() {
    this.pause();
    if (this.matchPhase === 'pregame' || this.matchPhase === 'first') {
      this.matchPhase = 'halftime';
    } else if (this.matchPhase === 'second') {
      this.matchPhase = 'fulltime';
    }
    this.renderControls();
    this.render();
  },

  reset() {
    this.pause();
    this.elapsed = 0;
    this.matchPhase = 'pregame';
    this.render();
    this.renderControls();
  },

  render() {
    const el = document.getElementById('live-timer');
    if (!el) return;
    const m = Math.floor(this.elapsed / 60);
    const s = this.elapsed % 60;
    el.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');

    const badge = document.getElementById('live-phase-badge');
    if (!badge) return;
    const labels = {
      pregame:  '',
      first:    '1st Half',
      halftime: 'Half Time',
      second:   '2nd Half',
      fulltime: 'Full Time',
    };
    badge.textContent = labels[this.matchPhase] || '';
    badge.className = 'live-phase-badge' + (
      this.matchPhase === 'halftime' ? ' phase-ht' :
      this.matchPhase === 'fulltime' ? ' phase-ft' : ''
    );
  },

  renderControls() {
    const toggleBtn   = document.getElementById('btn-timer-toggle');
    const halftimeBtn = document.getElementById('btn-halftime');
    if (!toggleBtn || !halftimeBtn) return;

    // Start/Pause label
    if (this.matchPhase === 'fulltime') {
      toggleBtn.textContent = 'Start';
      toggleBtn.disabled = true;
    } else {
      toggleBtn.disabled = false;
      toggleBtn.textContent = this.running ? 'Pause' : 'Start';
    }

    // Half Time / Full Time button
    if (this.matchPhase === 'fulltime') {
      halftimeBtn.textContent = 'Full Time';
      halftimeBtn.disabled = true;
      halftimeBtn.classList.add('btn-timer-ft');
    } else if (this.matchPhase === 'halftime') {
      halftimeBtn.textContent = 'Half Time';
      halftimeBtn.disabled = true;
      halftimeBtn.classList.remove('btn-timer-ft');
    } else if (this.matchPhase === 'second') {
      halftimeBtn.textContent = 'Full Time';
      halftimeBtn.disabled = false;
      halftimeBtn.classList.add('btn-timer-ft');
    } else {
      halftimeBtn.textContent = 'Half Time';
      halftimeBtn.disabled = false;
      halftimeBtn.classList.remove('btn-timer-ft');
    }
  },

  formatted() {
    const m = Math.floor(this.elapsed / 60);
    const s = this.elapsed % 60;
    return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }
};

// ══════════════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════════════

const App = {
  currentRefereeId: null,
  currentMatchId:   null,
  currentMatch:     null,  // live working copy
  editingRefereeId: null,

  // ── Navigation helpers ──────────────────────────────────
  nav(screen) {
    Router.push(screen);
    this.onScreenEnter(screen);
  },

  back() {
    const leaving = Router.current();
    Router.pop();
    // Cleanup leaving screen
    if (leaving === 'live-match')   Timer.pause();
    if (leaving === 'new-referee')  this.editingRefereeId = null;
    this.onScreenEnter(Router.current());
  },

  onScreenEnter(screen) {
    switch(screen) {
      case 'home':            this.renderHome(); break;
      case 'new-match-select':
        const si = document.getElementById('select-referee-search');
        if (si) si.value = '';
        this.renderSelectReferee();
        break;
      case 'referee':         this.renderRefereeProfile(); break;
      case 'assessment':      this.renderAssessment(); break;
      case 'report':          this.renderReport(); break;
    }
  },

  // ── Toast ───────────────────────────────────────────────
  toast(msg, duration = 2000) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), duration);
  },

  // ── Modal ───────────────────────────────────────────────
  showModal(title, message, confirmLabel, confirmClass, onConfirm) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    const btn = document.getElementById('modal-confirm');
    btn.textContent = confirmLabel;
    btn.className = 'btn-modal btn-modal-confirm' + (confirmClass ? ' ' + confirmClass : '');
    btn.onclick = () => { this.closeModal(); onConfirm(); };
    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  // ══════════════════════════════════════════════════════
  //  HOME SCREEN
  // ══════════════════════════════════════════════════════
  renderHome(filter = '') {
    const list = document.getElementById('referee-list');
    const refs = State.referees
      .filter(r => !filter || (r.firstName + ' ' + r.lastName).toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

    if (refs.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
        <p>${filter ? 'No referees found' : 'No referees yet.\nTap + to add your first referee.'}</p>
      </div>`;
      return;
    }

    list.innerHTML = refs.map(r => {
      const matches = State.matchesForReferee(r.id);
      const last = matches[0];
      const initials = ((r.firstName||'?')[0] + (r.lastName||'?')[0]).toUpperCase();
      return `<div class="list-item" onclick="App.openReferee('${r.id}')">
        <div class="list-avatar">${initials}</div>
        <div class="list-item-body">
          <div class="list-item-title">${r.firstName} ${r.lastName}</div>
          <div class="list-item-sub">${r.grade || ''}${r.grade && r.union ? ' · ' : ''}${r.union || ''} · ${matches.length} match${matches.length !== 1 ? 'es' : ''}</div>
        </div>
        <div class="list-chevron">›</div>
      </div>`;
    }).join('');
  },

  filterReferees(val) { this.renderHome(val); },

  // ── Bulk import ─────────────────────────────────────────
  importReferees(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = ''; // reset so the same file can be re-selected

    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => this._processImportRows(this._parseCSV(e.target.result));
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      if (typeof XLSX === 'undefined') {
        this.toast('XLSX support requires an internet connection on first load.', 3000);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        this._processImportRows(rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      this.toast('Please select a .csv or .xlsx file.');
    }
  },

  _parseCSV(text) {
    // Handle both \r\n and \n, and basic quoted fields
    return text.split(/\r?\n/).map(line => {
      const cols = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQ = !inQ; }
        else if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
        else { cur += c; }
      }
      cols.push(cur.trim());
      return cols;
    });
  },

  _processImportRows(rows) {
    if (!rows || rows.length === 0) { this.toast('No data found in file.'); return; }

    // Detect header row and map columns
    const firstRow = rows[0].map(h => String(h || '').toLowerCase().trim());
    const headerKeywords = ['first', 'last', 'email', 'union', 'club', 'name'];
    const hasHeader = firstRow.some(h => headerKeywords.some(k => h.includes(k)));

    let colFirst = 0, colLast = 1, colUnion = 2, colEmail = 3;
    let startIdx = 0;

    if (hasHeader) {
      startIdx = 1;
      firstRow.forEach((h, i) => {
        if (h.includes('first'))                  colFirst = i;
        else if (h.includes('last'))              colLast  = i;
        else if (h.includes('union') || h.includes('club')) colUnion = i;
        else if (h.includes('email'))             colEmail = i;
      });
    }

    let added = 0, skipped = 0;
    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every(c => !c)) continue; // skip empty rows
      const fn = String(row[colFirst] || '').trim();
      const ln = String(row[colLast]  || '').trim();
      if (!fn || !ln) { skipped++; continue; }

      // Skip duplicates (same first + last name)
      const exists = State.referees.some(r =>
        r.firstName.toLowerCase() === fn.toLowerCase() &&
        r.lastName.toLowerCase()  === ln.toLowerCase()
      );
      if (exists) { skipped++; continue; }

      State.addReferee({
        firstName: fn,
        lastName:  ln,
        union:     String(row[colUnion] || '').trim(),
        email:     String(row[colEmail] || '').trim(),
      });
      added++;
    }

    this.renderHome();
    const msg = skipped > 0
      ? `${added} imported, ${skipped} skipped (duplicates or missing name)`
      : `${added} referee${added !== 1 ? 's' : ''} imported`;
    this.toast(msg, 3000);
  },

  // ══════════════════════════════════════════════════════
  //  REFEREE CRUD
  // ══════════════════════════════════════════════════════
  saveReferee() {
    const fn = document.getElementById('ref-firstname').value.trim();
    const ln = document.getElementById('ref-lastname').value.trim();
    if (!fn || !ln) { this.toast('Please enter a first and last name'); return; }

    const data = {
      firstName: fn,
      lastName:  ln,
      union:     document.getElementById('ref-union').value.trim(),
      email:     document.getElementById('ref-email').value.trim(),
    };

    if (this.editingRefereeId) {
      State.updateReferee(this.editingRefereeId, data);
      this.editingRefereeId = null;
      this.toast('Referee updated');
      Router.pop();
      this.openReferee(data.id || this.currentRefereeId);
    } else {
      const ref = State.addReferee(data);
      this.toast('Referee added');
      Router.pop();
      this.renderHome();
      this.openReferee(ref.id);
    }
  },

  editReferee() {
    const ref = State.getReferee(this.currentRefereeId);
    if (!ref) return;
    this.editingRefereeId = ref.id;
    document.getElementById('ref-firstname').value = ref.firstName || '';
    document.getElementById('ref-lastname').value  = ref.lastName  || '';
    document.getElementById('ref-union').value     = ref.union     || '';
    document.getElementById('ref-email').value     = ref.email     || '';
    this.nav('new-referee');
    document.querySelector('#screen-new-referee .topbar h1').textContent = 'Edit Referee';
  },

  openReferee(id) {
    this.currentRefereeId = id;
    this.nav('referee');
  },

  renderRefereeProfile() {
    const ref = State.getReferee(this.currentRefereeId);
    if (!ref) return;
    document.getElementById('referee-profile-name').textContent = ref.firstName + ' ' + ref.lastName;

    const matches = State.matchesForReferee(ref.id);
    const assessed = matches.filter(m => m.assessment);
    const ratings = assessed.map(m => m.assessment.ratings?.overall).filter(Boolean);
    const ratingCounts = { Excellent: 0, Good: 0, OK: 0, Poor: 0 };
    ratings.forEach(r => { if (ratingCounts[r] !== undefined) ratingCounts[r]++; });

    document.getElementById('referee-profile-details').innerHTML = `
      <div class="profile-stat-row">
        <div class="profile-stat"><div class="profile-stat-val">${matches.length}</div><div class="profile-stat-label">Matches</div></div>
        <div class="profile-stat"><div class="profile-stat-val">${ratingCounts.Excellent + ratingCounts.Good}</div><div class="profile-stat-label">Good+</div></div>
        <div class="profile-stat"><div class="profile-stat-val">${ratingCounts.Poor}</div><div class="profile-stat-label">Poor</div></div>
      </div>
      <div class="profile-info-row">
        ${ref.grade ? `<span class="profile-chip">${ref.grade}</span>` : ''}
        ${ref.union ? `<span class="profile-chip">${ref.union}</span>` : ''}
        ${ref.email ? `<span class="profile-chip">${ref.email}</span>` : ''}
      </div>
      ${ref.notes ? `<div style="margin-top:10px;font-size:13px;color:var(--text2);">${ref.notes}</div>` : ''}
    `;

    const hist = document.getElementById('referee-match-history');
    if (matches.length === 0) {
      hist.innerHTML = `<div class="empty-state"><p>No matches recorded yet.</p></div>`;
      return;
    }

    hist.innerHTML = matches.map(m => {
      const d = m.date ? new Date(m.date) : null;
      const dayStr = d ? d.getDate() : '–';
      const monStr = d ? d.toLocaleString('default',{month:'short'}).toUpperCase() : '';
      const rating = m.assessment?.ratings?.overall || 'none';
      return `<div class="match-item" onclick="App.openMatch('${m.id}')">
        <div class="match-date-badge">
          <div class="match-date-day">${dayStr}</div>
          <div class="match-date-mon">${monStr}</div>
        </div>
        <div class="match-item-body">
          <div class="match-item-teams">${m.homeTeam || 'TBC'} v ${m.awayTeam || 'TBC'}</div>
          <div class="match-item-sub">${m.competition || ''}${m.competition && m.venue ? ' · ' : ''}${m.venue || ''}</div>
        </div>
        <div class="match-rating-dot ${rating}"></div>
      </div>`;
    }).join('');
  },

  startMatchForCurrentReferee() {
    this.nav('match-setup');
    this.prefillMatchSetup();
  },

  // ══════════════════════════════════════════════════════
  //  SELECT REFEREE (new match from home)
  // ══════════════════════════════════════════════════════
  renderSelectReferee(filter = '') {
    const list = document.getElementById('select-referee-list');
    const q = filter.toLowerCase();
    const refs = [...State.referees]
      .filter(r => !q || `${r.firstName} ${r.lastName}`.toLowerCase().includes(q))
      .sort((a, b) => (a.lastName||'').localeCompare(b.lastName||''));

    if (State.referees.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>Add a referee first before creating a match.</p></div>`;
      return;
    }

    if (refs.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>No referees match "${filter}".</p></div>`;
      return;
    }

    list.innerHTML = refs.map(r => {
      const initials = ((r.firstName||'?')[0] + (r.lastName||'?')[0]).toUpperCase();
      return `<div class="list-item" onclick="App.selectRefereeForMatch('${r.id}')">
        <div class="list-avatar">${initials}</div>
        <div class="list-item-body">
          <div class="list-item-title">${r.firstName} ${r.lastName}</div>
          <div class="list-item-sub">${r.union||''}</div>
        </div>
        <div class="list-chevron">›</div>
      </div>`;
    }).join('');
  },

  filterSelectReferee(val) { this.renderSelectReferee(val); },

  selectRefereeForMatch(id) {
    this.currentRefereeId = id;
    this.nav('match-setup');
    this.prefillMatchSetup();
  },

  // ══════════════════════════════════════════════════════
  //  MATCH SETUP
  // ══════════════════════════════════════════════════════
  prefillMatchSetup() {
    const today = new Date().toISOString().slice(0,10);
    document.getElementById('match-date').value = today;
    document.getElementById('match-competition').value = '';
    document.getElementById('match-home').value = '';
    document.getElementById('match-away').value = '';
    document.getElementById('match-venue').value = '';
    document.getElementById('match-ar1').value = '';
    document.getElementById('match-ar2').value = '';
    document.getElementById('match-tmo').value = '';
    document.getElementById('match-duration').value = '40';
  },

  startLiveMatch() {
    const date  = document.getElementById('match-date').value;
    const home  = document.getElementById('match-home').value.trim();
    const away  = document.getElementById('match-away').value.trim();
    if (!home || !away) { this.toast('Please enter both team names'); return; }

    const halfMins = parseInt(document.getElementById('match-duration').value, 10);

    const matchData = {
      refereeId:   this.currentRefereeId,
      date:        date ? new Date(date).getTime() : Date.now(),
      competition: document.getElementById('match-competition').value.trim(),
      homeTeam:    home,
      awayTeam:    away,
      venue:       document.getElementById('match-venue').value.trim(),
      halfMins,
      ar1:         document.getElementById('match-ar1').value.trim(),
      ar2:         document.getElementById('match-ar2').value.trim(),
      tmo:         document.getElementById('match-tmo').value.trim(),
      liveData: {
        homeScore: 0,
        awayScore: 0,
        events:    [],
        notes:     '',
        halfMins
      }
    };

    const match = State.addMatch(matchData);
    this.currentMatchId = match.id;
    this.currentMatch   = match;

    Timer.reset();
    this.nav('live-match');
    this.renderLiveMatch();
  },

  // ══════════════════════════════════════════════════════
  //  LIVE MATCH
  // ══════════════════════════════════════════════════════
  _editMode: false,

  renderLiveMatch() {
    const m = this.currentMatch;
    if (!m) return;
    document.getElementById('live-teams').textContent = m.homeTeam + ' v ' + m.awayTeam;
    document.getElementById('live-home-name').textContent = m.homeTeam;
    document.getElementById('live-away-name').textContent = m.awayTeam;
    this.renderScores();
    this.renderEventLog();
    document.getElementById('live-notes').value = m.liveData?.notes || '';
    Timer.render();
    Timer.renderControls();
  },

  renderScores() {
    const ld = State.getMatch(this.currentMatchId)?.liveData || {};
    document.getElementById('live-home-score').textContent = ld.homeScore ?? 0;
    document.getElementById('live-away-score').textContent = ld.awayScore ?? 0;
  },

  adjustScore(team, delta) {
    const match = State.getMatch(this.currentMatchId);
    if (!match) return;
    const val = Math.max(0, (match.liveData[team + 'Score'] || 0) + delta);
    match.liveData[team + 'Score'] = val;
    State.saveMatches();
    this.renderScores();
  },

  // ── Score picker ──
  _scoringTeam: null,

  openScorePicker(team) {
    this._scoringTeam = team;
    const match = State.getMatch(this.currentMatchId);
    const teamName = team === 'home' ? (match?.homeTeam || 'Home') : (match?.awayTeam || 'Away');
    document.getElementById('score-picker-title').textContent = teamName + ' Scored';
    document.getElementById('score-picker-overlay').classList.remove('hidden');
  },

  closeScorePicker() {
    document.getElementById('score-picker-overlay').classList.add('hidden');
    this._scoringTeam = null;
  },

  applyScore(points, label) {
    if (!this._scoringTeam) return;
    this.adjustScore(this._scoringTeam, points);
    const match = State.getMatch(this.currentMatchId);
    const teamName = this._scoringTeam === 'home' ? (match?.homeTeam || 'Home') : (match?.awayTeam || 'Away');
    this.logEvent({
      phase: 'Score',
      possession: this._scoringTeam,
      outcome: label || `+${points}`,
      notes: `${teamName} — ${label || points + ' pts'} (+${points})`,
      isScore: true,
    });
    this.closeScorePicker();
  },

  openPhase(phase) {
    PhaseModal.open(phase);
  },

  logEvent(event) {
    const match = State.getMatch(this.currentMatchId);
    if (!match) return;
    if (!match.liveData.events) match.liveData.events = [];
    event.time = Timer.formatted();
    event.id   = Date.now().toString(36);
    match.liveData.events.push(event);
    State.saveMatches();
    this.renderEventLog();
  },

  deleteEvent(id) {
    const match = State.getMatch(this.currentMatchId);
    if (!match) return;
    match.liveData.events = (match.liveData.events || []).filter(e => e.id !== id);
    State.saveMatches();
    this.renderEventLog();
  },

  toggleEditEntries() {
    this._editMode = !this._editMode;
    const btn = document.querySelector('.btn-edit-entries');
    const log = document.getElementById('event-log-list');
    btn.classList.toggle('active', this._editMode);
    log.classList.toggle('edit-mode', this._editMode);
    btn.textContent = this._editMode ? 'Done' : 'Edit Entries';
  },

  renderEventLog() {
    const match = State.getMatch(this.currentMatchId);
    const events = match?.liveData?.events || [];
    const pkCount = { home: 0, away: 0 };
    events.forEach(e => {
      if ((e.outcome === 'PK' || e.phase === 'Pen Gen Play') && e.against) {
        pkCount[e.against]++;
      }
    });

    document.getElementById('event-log-title').textContent =
      `Events (${events.length})  ·  PK: ${match?.homeTeam || 'H'} ${pkCount.home} – ${pkCount.away} ${match?.awayTeam || 'A'}`;

    const log = document.getElementById('event-log-list');
    if (events.length === 0) {
      log.innerHTML = '<div style="padding:10px 0;font-size:13px;color:var(--text2);">No events logged yet. Tap a phase button above.</div>';
      return;
    }

    const posLabel = { 'half-home': 'Home Half', 'half-away': 'Away Half', '22-home': 'Home 22', '22-away': 'Away 22' };
    const teamName = (t) => t === 'home' ? (match?.homeTeam || 'Home') : (match?.awayTeam || 'Away');
    const isCritical = (e) => e.phase === 'Critical';
    const isPK = (e) => e.outcome === 'PK' || e.phase === 'Pen Gen Play';

    log.innerHTML = events.slice().reverse().map(e => {
      // Half Time / Full Time marker
      if (e.isMarker) {
        const isHT = e.phase === 'Half Time';
        return `<div class="event-marker ${isHT ? 'marker-ht' : 'marker-ft'}">
          <span class="event-marker-time">${e.time}</span>
          <span class="event-marker-label">${e.phase}</span>
          <button class="event-del" onclick="App.deleteEvent('${e.id}')">×</button>
        </div>`;
      }

      // Score event
      if (e.isScore) {
        return `<div class="event-marker marker-score">
          <span class="event-marker-time">${e.time}</span>
          <span class="event-marker-label">&#9679; ${e.notes}</span>
          <button class="event-del" onclick="App.deleteEvent('${e.id}')">×</button>
        </div>`;
      }

      const badgeClass = isCritical(e) ? 'critical' : isPK(e) ? 'penalty' : '';
      const parts = isCritical(e)
        ? (e.notes || '<em style="color:var(--text2)">No text</em>')
        : [
            e.possession ? teamName(e.possession) : null,
            e.position   ? posLabel[e.position]   : null,
            e.outcome    ? `<span class="event-outcome">${e.outcome}</span>` : null,
            e.infringement ? e.infringement : null,
          ].filter(Boolean).join(' · ');

      const against = e.against ? `<span class="event-against">vs ${teamName(e.against)}</span>` : '';

      const cardBadge = e.card === 'yellow' ? '<span class="card-badge card-yellow">YC</span>'
                      : e.card === 'red'    ? '<span class="card-badge card-red">RC</span>'
                      : '';

      return `<div class="event-entry">
        <span class="event-time">${e.time}</span>
        <span class="event-phase-badge ${badgeClass}">${e.phase}</span>
        <span class="event-body">${parts}</span>
        ${cardBadge}
        ${against}
        <button class="event-del" onclick="App.deleteEvent('${e.id}')">×</button>
      </div>`;
    }).join('');
  },

  saveLiveNotes() {
    const match = State.getMatch(this.currentMatchId);
    if (!match) return;
    match.liveData.notes = document.getElementById('live-notes').value;
    State.saveMatches();
  },

  toggleTimer()    { Timer.toggle(); },
  pressHalfTime() {
    Timer.pressHalfTime();
    // Log a marker so the report shows half/full time in context
    const label = Timer.matchPhase === 'halftime' ? 'Half Time'
                : Timer.matchPhase === 'fulltime'  ? 'Full Time'
                : null;
    if (label) {
      App.logEvent({ phase: label, isMarker: true });
    }
  },
  resetTimer()     { Timer.reset(); },

  confirmExitLive() {
    this.saveLiveNotes();
    this.showModal(
      'Exit Match?',
      'The match will be saved. You can return to it later to complete the assessment.',
      'Exit',
      null,
      () => {
        Timer.pause();
        Router.pop();
        this.onScreenEnter(Router.current());
      }
    );
  },

  goToAssessment() {
    this.saveLiveNotes();
    Timer.pause();
    this.nav('assessment');
    this.renderAssessment();
  },

  // ══════════════════════════════════════════════════════
  //  ASSESSMENT
  // ══════════════════════════════════════════════════════
  _ratings: {},
  _cards:   { yellow: 0, red: 0 },

  renderAssessment() {
    const match = State.getMatch(this.currentMatchId);
    if (!match) return;

    const ref  = State.getReferee(match.refereeId);
    const date = match.date ? new Date(match.date).toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric'}) : '';
    document.getElementById('assessment-match-summary').innerHTML =
      `<strong>${ref ? ref.firstName + ' ' + ref.lastName : 'Unknown Referee'}</strong><br>
       ${match.homeTeam} v ${match.awayTeam}<br>
       ${[match.competition, match.venue, date].filter(Boolean).join(' · ')}`;

    document.getElementById('final-home-label').textContent = match.homeTeam;
    document.getElementById('final-away-label').textContent = match.awayTeam;
    document.getElementById('final-home-score').value = match.liveData?.homeScore ?? match.assessment?.homeScore ?? 0;
    document.getElementById('final-away-score').value = match.liveData?.awayScore ?? match.assessment?.awayScore ?? 0;

    const a = match.assessment || {};
    this._ratings = { ...(a.ratings || {}) };

    // Count cards from event log; fall back to manually entered counts
    const events = match.liveData?.events || [];
    const evYellow = events.filter(e => e.card === 'yellow').length;
    const evRed    = events.filter(e => e.card === 'red').length;
    this._cards = {
      yellow: a.yellowCards != null ? a.yellowCards : evYellow,
      red:    a.redCards    != null ? a.redCards    : evRed
    };

    document.getElementById('count-yellow').textContent = this._cards.yellow;
    document.getElementById('count-red').textContent    = this._cards.red;
    document.getElementById('assess-observations').value = a.observations || match.liveData?.notes || '';
    document.getElementById('assess-strengths').value    = a.strengths    || '';
    document.getElementById('assess-development').value  = a.development  || '';
    document.getElementById('assess-actions').value      = a.actions      || '';
    document.getElementById('assess-self').value         = a.selfAssessment || '';

    const container = document.getElementById('assessment-areas');
    container.innerHTML = AREAS.map(area => `
      <div class="rating-group">
        <div class="rating-label">${area.label}</div>
        <div class="rating-sub">${area.sub}</div>
        <div class="rating-buttons">
          ${['Excellent','Good','OK','Poor'].map(v =>
            `<button class="btn-rating${this._ratings[area.id] === v ? ' selected' : ''}"
              data-area="${area.id}" data-val="${v}" onclick="App.setRating(this)">${v}</button>`
          ).join('')}
        </div>
        <div class="rating-notes">
          <textarea placeholder="Notes for this area…" rows="2"
            data-area="${area.id}">${(a.areaNotes || {})[area.id] || ''}</textarea>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('[data-area="overall"]').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.val === this._ratings.overall);
    });
  },

  setRating(btn) {
    const area = btn.dataset.area;
    const val  = btn.dataset.val;
    this._ratings[area] = val;
    document.querySelectorAll(`[data-area="${area}"]`).forEach(b => {
      b.classList.toggle('selected', b.dataset.val === val);
    });
  },

  adjCard(type, delta) {
    this._cards[type] = Math.max(0, (this._cards[type] || 0) + delta);
    document.getElementById(`count-${type}`).textContent = this._cards[type];
  },

  saveAssessment() {
    const areaNotes = {};
    document.querySelectorAll('.rating-notes textarea').forEach(el => {
      if (el.dataset.area) areaNotes[el.dataset.area] = el.value.trim();
    });

    const assessment = {
      ratings:        { ...this._ratings },
      areaNotes,
      homeScore:      parseInt(document.getElementById('final-home-score').value, 10) || 0,
      awayScore:      parseInt(document.getElementById('final-away-score').value, 10) || 0,
      yellowCards:    this._cards.yellow,
      redCards:       this._cards.red,
      observations:   document.getElementById('assess-observations').value.trim(),
      strengths:      document.getElementById('assess-strengths').value.trim(),
      development:    document.getElementById('assess-development').value.trim(),
      actions:        document.getElementById('assess-actions').value.trim(),
      selfAssessment: document.getElementById('assess-self').value.trim(),
      completedAt:    Date.now()
    };

    State.updateMatch(this.currentMatchId, { assessment });
    this.toast('Assessment saved');
    this.nav('report');
    this.renderReport();
  },

  // ══════════════════════════════════════════════════════
  //  REPORT
  // ══════════════════════════════════════════════════════
  openMatch(id) {
    this.currentMatchId = id;
    const match = State.getMatch(id);
    this.currentMatch   = match;
    if (match?.assessment) {
      this.nav('report');
    } else {
      this.nav('assessment');
      this.renderAssessment();
    }
  },

  renderReport() {
    const match = State.getMatch(this.currentMatchId);
    if (!match) return;

    const ref    = State.getReferee(match.refereeId);
    const a      = match.assessment || {};
    const events = match.liveData?.events || [];
    const date   = match.date ? new Date(match.date).toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long', year:'numeric'}) : 'Unknown date';

    const posLabel = { 'half-home': 'Home Half', 'half-away': 'Away Half', '22-home': 'Home 22', '22-away': 'Away 22' };
    const teamName = (t) => t === 'home' ? (match.homeTeam || 'Home') : (match.awayTeam || 'Away');
    const ratingBadge = (r) => r ? `<span class="rating-badge ${r}">${r}</span>` : '<span style="color:var(--text2)">Not rated</span>';

    // Event summaries by phase
    const phaseCounts = {};
    const pkAgainst = { home: 0, away: 0 };
    events.forEach(e => {
      phaseCounts[e.phase] = (phaseCounts[e.phase] || 0) + 1;
      if ((e.outcome === 'PK' || e.phase === 'Pen Gen Play') && e.against) pkAgainst[e.against]++;
    });

    // Build event log rows for report
    const eventRows = events.map(e => {
      if (e.isMarker) {
        const isHT = e.phase === 'Half Time';
        return `<div class="report-marker ${isHT ? 'marker-ht' : 'marker-ft'}">
          <span>${e.time}</span><span>${e.phase}</span>
        </div>`;
      }
      const parts = e.phase === 'Critical'
        ? (e.notes || '')
        : [
            e.possession ? teamName(e.possession) : null,
            e.position   ? posLabel[e.position]   : null,
            e.outcome    || null,
            e.infringement || null,
            e.against    ? `→ against ${teamName(e.against)}` : null,
          ].filter(Boolean).join(' · ');
      return `<div class="report-row">
        <span class="report-row-label">${e.time} <strong>${e.phase}</strong></span>
        <span class="report-row-val" style="font-size:13px;text-align:right;">${parts}</span>
      </div>`;
    }).join('');

    document.getElementById('report-content').innerHTML = `
      <div class="report-section">
        <div class="report-section-title">Match Information</div>
        <div class="report-row"><span class="report-row-label">Referee</span><span class="report-row-val">${ref ? ref.firstName + ' ' + ref.lastName : '–'}</span></div>
        <div class="report-row"><span class="report-row-label">Grade</span><span class="report-row-val">${ref?.grade || '–'}</span></div>
        <div class="report-row"><span class="report-row-label">Date</span><span class="report-row-val">${date}</span></div>
        <div class="report-row"><span class="report-row-label">Competition</span><span class="report-row-val">${match.competition || '–'}</span></div>
        <div class="report-row"><span class="report-row-label">Venue</span><span class="report-row-val">${match.venue || '–'}</span></div>
        <div class="report-row"><span class="report-row-label">Result</span><span class="report-row-val">${match.homeTeam} ${a.homeScore ?? match.liveData?.homeScore ?? 0} – ${a.awayScore ?? match.liveData?.awayScore ?? 0} ${match.awayTeam}</span></div>
        ${match.ar1 ? `<div class="report-row"><span class="report-row-label">AR1</span><span class="report-row-val">${match.ar1}</span></div>` : ''}
        ${match.ar2 ? `<div class="report-row"><span class="report-row-label">AR2</span><span class="report-row-val">${match.ar2}</span></div>` : ''}
        ${match.tmo ? `<div class="report-row"><span class="report-row-label">TMO</span><span class="report-row-val">${match.tmo}</span></div>` : ''}
        <div class="report-row"><span class="report-row-label">Yellow Cards</span><span class="report-row-val">${a.yellowCards || 0}</span></div>
        <div class="report-row"><span class="report-row-label">Red Cards</span><span class="report-row-val">${a.redCards || 0}</span></div>
      </div>

      <div class="report-section">
        <div class="report-section-title">Overall Performance</div>
        <div class="report-row"><span class="report-row-label">Overall Rating</span><span class="report-row-val">${ratingBadge(a.ratings?.overall)}</span></div>
      </div>

      <div class="report-section">
        <div class="report-section-title">Performance Areas</div>
        ${AREAS.map(area => `
          <div class="report-row" style="flex-direction:column;align-items:flex-start;gap:6px;">
            <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
              <span class="report-row-label">${area.label}</span>
              ${ratingBadge(a.ratings?.[area.id])}
            </div>
            ${a.areaNotes?.[area.id] ? `<div style="font-size:13px;color:var(--text2);">${a.areaNotes[area.id]}</div>` : ''}
          </div>
        `).join('')}
      </div>

      <div class="report-section">
        <div class="report-section-title">Penalty Count</div>
        <div class="report-row"><span class="report-row-label">${match.homeTeam}</span><span class="report-row-val">${pkAgainst.home} penalties against</span></div>
        <div class="report-row"><span class="report-row-label">${match.awayTeam}</span><span class="report-row-val">${pkAgainst.away} penalties against</span></div>
      </div>

      <div class="report-section">
        <div class="report-section-title">Events by Phase (${events.length} total)</div>
        ${Object.keys(phaseCounts).length > 0 ? Object.entries(phaseCounts).map(([p,c]) =>
          `<div class="report-row"><span class="report-row-label">${p}</span><span class="report-row-val">${c}</span></div>`
        ).join('') : '<div style="color:var(--text2);font-size:14px;">No events logged.</div>'}
      </div>

      ${events.length > 0 ? `<div class="report-section"><div class="report-section-title">Full Event Log</div>${eventRows}</div>` : ''}

      ${a.observations  ? `<div class="report-section"><div class="report-section-title">Key Observations</div><div class="report-text-block">${a.observations}</div></div>` : ''}
      ${a.strengths     ? `<div class="report-section"><div class="report-section-title">Strengths</div><div class="report-text-block">${a.strengths}</div></div>` : ''}
      ${a.development   ? `<div class="report-section"><div class="report-section-title">Areas for Development</div><div class="report-text-block">${a.development}</div></div>` : ''}
      ${a.actions       ? `<div class="report-section"><div class="report-section-title">Action Points</div><div class="report-text-block">${a.actions}</div></div>` : ''}
      ${a.selfAssessment? `<div class="report-section"><div class="report-section-title">Referee Self-Assessment</div><div class="report-text-block">${a.selfAssessment}</div></div>` : ''}
    `;
  },

  printReport() {
    const match = State.getMatch(this.currentMatchId);
    if (!match) return;
    const ref    = State.getReferee(match.refereeId);
    const a      = match.assessment || {};
    const events = match.liveData?.events || [];
    const date   = match.date
      ? new Date(match.date).toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
      : 'Unknown date';

    const teamName  = t => t === 'home' ? (match.homeTeam || 'Home') : (match.awayTeam || 'Away');
    const posLabel  = { 'half-home': 'Home Half', 'half-away': 'Away Half', '22-home': 'Home 22', '22-away': 'Away 22' };

    // ── stats ──────────────────────────────────────────────
    const pkAgainst    = { home: 0, away: 0 };
    const pkByPhase    = { home: {}, away: {} };
    const pkByInfring  = { home: {}, away: {} };
    const allPkByPos   = {};

    events.forEach(e => {
      if (e.isMarker) return;
      const isPK = e.outcome === 'PK' || e.phase === 'Pen Gen Play';
      if (isPK && e.against) {
        const t = e.against;
        pkAgainst[t]++;
        pkByPhase[t][e.phase] = (pkByPhase[t][e.phase] || 0) + 1;
        if (e.infringement) pkByInfring[t][e.infringement] = (pkByInfring[t][e.infringement] || 0) + 1;
        if (e.position) allPkByPos[e.position] = (allPkByPos[e.position] || 0) + 1;
      }
    });

    // ── helpers ────────────────────────────────────────────
    const ratingClass = r => r ? r.toLowerCase() : '';

    const buildStatsRows = obj =>
      Object.entries(obj).length === 0
        ? '<tr><td colspan="2" style="color:#888;font-size:10px;">None recorded</td></tr>'
        : Object.entries(obj).sort((a,b) => b[1]-a[1])
            .map(([k,v]) => `<tr><td>${k}</td><td style="text-align:center;font-weight:600;">${v}</td></tr>`).join('');

    // ── ratings rows ───────────────────────────────────────
    const ratingsRows = AREAS.map(area => {
      const r    = a.ratings?.[area.id] || '';
      const note = a.areaNotes?.[area.id] || '';
      return `<tr>
        <td>${area.label}</td>
        <td class="rc ${ratingClass(r)}">${r || '–'}</td>
        <td>${note}</td>
      </tr>`;
    }).join('');

    // ── game notes rows ────────────────────────────────────
    const gameNotesRows = events.map(e => {
      if (e.isMarker) {
        const cls = e.phase === 'Half Time' ? 'ht' : 'ft';
        return `<tr class="mk ${cls}">
          <td>${e.time}</td>
          <td colspan="7" style="text-align:center;font-weight:bold;letter-spacing:.5px;">${e.phase}</td>
        </tr>`;
      }
      if (e.isScore) {
        return `<tr style="background:#e8f4ff;">
          <td style="white-space:nowrap;">${e.time}</td>
          <td colspan="7" style="font-weight:bold;color:#1a3a6a;">&#9679; ${e.notes}</td>
        </tr>`;
      }
      const card = e.card === 'yellow' ? 'YC' : e.card === 'red' ? 'RC' : '';
      const outcome = e.phase === 'Critical' ? (e.notes || '') : (e.outcome || '');
      const infring = e.phase === 'Critical' ? '' : (e.infringement || '');
      return `<tr>
        <td style="white-space:nowrap;">${e.time}</td>
        <td>${e.phase}</td>
        <td>${e.possession ? teamName(e.possession) : ''}</td>
        <td>${e.position ? posLabel[e.position] : ''}</td>
        <td>${outcome}</td>
        <td>${infring}</td>
        <td>${e.against ? teamName(e.against) : ''}</td>
        <td style="text-align:center;font-weight:bold;color:${e.card==='red'?'#c00':e.card==='yellow'?'#b07800':'inherit'}">${card}</td>
      </tr>`;
    }).join('');

    // ── heat map ───────────────────────────────────────────
    const positions = ['22-home','half-home','half-away','22-away'];
    const posLabels = {
      '22-home':   (match.homeTeam || 'Home') + ' 22',
      'half-home': (match.homeTeam || 'Home') + ' Half',
      'half-away': (match.awayTeam || 'Away') + ' Half',
      '22-away':   (match.awayTeam || 'Away') + ' 22',
    };
    const maxPos = Math.max(1, ...Object.values(allPkByPos));
    const heatCells = positions.map(pos => {
      const n   = allPkByPos[pos] || 0;
      const pct = n / maxPos;
      const bg  = n === 0 ? '#f0f0f0' : `rgba(200,40,40,${(0.15 + pct * 0.75).toFixed(2)})`;
      const fg  = pct > 0.5 ? 'white' : '#333';
      return `<div class="hc" style="background:${bg};color:${fg};">
        <div class="hl">${posLabels[pos]}</div>
        <div class="hn">${n}</div>
      </div>`;
    }).join('');

    const homeScore = a.homeScore ?? match.liveData?.homeScore ?? 0;
    const awayScore = a.awayScore ?? match.liveData?.awayScore ?? 0;
    const overall   = a.ratings?.overall || '';

    // ── HTML ───────────────────────────────────────────────
    const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>Coaching Report — ${ref ? ref.firstName + ' ' + ref.lastName : 'Referee'}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;background:#e8e8e8}
h2{font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;color:#1a3a6a;border-bottom:2px solid #1a3a6a;padding-bottom:4px;margin-bottom:8px}
h3{font-size:10px;font-weight:bold;color:#1a3a6a;margin-bottom:5px}
.page{background:white;padding:14mm 14mm 12mm;margin:0 auto;max-width:210mm;min-height:297mm}
@page{size:A4;margin:0}
@media print{body{background:white}.no-print{display:none!important}.page{box-shadow:none}}
@media screen{.page{box-shadow:0 2px 10px rgba(0,0,0,.2);margin:12px auto}}
.no-print{position:fixed;bottom:20px;padding:10px 22px;background:#1a3a6a;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.no-print.print-btn{right:20px}.no-print.close-btn{left:20px;background:#555}
/* header */
.rh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;padding-bottom:10px;border-bottom:3px solid #1a3a6a}
.rh-left h1{font-size:20px;font-weight:bold;color:#1a3a6a}
.rh-left .sub{font-size:11px;color:#555;margin-top:3px}
.rh-right{text-align:center;background:#1a3a6a;color:white;padding:8px 16px;border-radius:8px;min-width:90px}
.score{font-size:26px;font-weight:bold;line-height:1}
.score-teams{font-size:9px;opacity:.8}
/* info grid */
.ig{display:grid;grid-template-columns:1fr 1fr;gap:3px 20px;margin-bottom:12px}
.ir{display:flex;gap:6px;font-size:10px}
.il{color:#888;min-width:85px}
.iv{font-weight:600}
/* overall badge */
.ob{display:inline-block;padding:2px 10px;border-radius:20px;font-weight:bold;font-size:11px}
.ob.excellent{background:#d0f0e0;color:#0a6030}.ob.good{background:#d0e4ff;color:#1a4a8a}.ob.ok{background:#fff0c0;color:#7a4f00}.ob.poor{background:#ffe0e0;color:#8a0000}
/* performance table */
.pt{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px}
.pt th{background:#1a3a6a;color:white;padding:5px 8px;text-align:left;font-size:10px;text-transform:uppercase}
.pt td{padding:5px 8px;border-bottom:1px solid #eee;vertical-align:top}
.pt tr:nth-child(even) td{background:#f8f8f8}
.rc{font-weight:bold;text-align:center}
.rc.excellent{color:#0a6030}.rc.good{color:#1a4a8a}.rc.ok{color:#7a4f00}.rc.poor{color:#c00}
/* text blocks */
.sec{margin-bottom:12px}
.tb{background:#f8f8f8;border-left:3px solid #1a3a6a;padding:7px 10px;font-size:11px;line-height:1.5;border-radius:0 4px 4px 0;white-space:pre-wrap}
/* game notes */
.nt{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:12px}
.nt th{background:#1a3a6a;color:white;padding:4px 6px;text-align:left;font-size:9px;text-transform:uppercase;white-space:nowrap}
.nt td{padding:3px 6px;border-bottom:1px solid #eee;vertical-align:top}
.nt tr:nth-child(even) td{background:#fafafa}
.nt .mk.ht td{background:#fff3cd;color:#7a4f00;font-weight:bold}
.nt .mk.ft td{background:#d4edda;color:#0d6e35;font-weight:bold}
/* stats grid */
.sg{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.sc{border:1px solid #ddd;border-radius:6px;padding:8px 10px}
.st{width:100%;border-collapse:collapse;font-size:10px}
.st th{color:#888;padding:2px 4px;font-size:9px;text-transform:uppercase;border-bottom:1px solid #eee;text-align:left}
.st td{padding:3px 4px;border-bottom:1px solid #f0f0f0}
.st .tot td{border-top:2px solid #ddd;border-bottom:none;font-weight:bold}
/* heat map */
.hm{display:flex;gap:4px;margin-bottom:6px}
.hc{flex:1;padding:10px 6px;text-align:center;border-radius:6px;border:1px solid #ddd}
.hl{font-size:9px;margin-bottom:4px}
.hn{font-size:22px;font-weight:bold}
.page-break{page-break-after:always}
</style></head><body>
<button class="no-print close-btn" onclick="window.close()">&#8592; Close</button>
<button class="no-print print-btn" onclick="window.print()">&#128438; Print / Save PDF</button>

<div class="page">
  <div class="rh">
    <div class="rh-left">
      <h1>${ref ? ref.firstName + ' ' + ref.lastName : 'Unknown Referee'}</h1>
      <div class="sub">${match.homeTeam || 'Home'} v ${match.awayTeam || 'Away'}${match.competition ? ' · ' + match.competition : ''}</div>
      <div class="sub">${date}${match.venue ? ' · ' + match.venue : ''}</div>
    </div>
    <div class="rh-right">
      <div class="score-teams">${match.homeTeam || 'Home'}</div>
      <div class="score">${homeScore} – ${awayScore}</div>
      <div class="score-teams">${match.awayTeam || 'Away'}</div>
    </div>
  </div>

  <div class="ig">
    ${ref?.union ? `<div class="ir"><span class="il">Union/Club:</span><span class="iv">${ref.union}</span></div>` : '<div></div>'}
    <div class="ir"><span class="il">Overall Rating:</span><span class="iv">${overall ? `<span class="ob ${overall.toLowerCase()}">${overall}</span>` : '–'}</span></div>
    ${match.ar1 ? `<div class="ir"><span class="il">AR1:</span><span class="iv">${match.ar1}</span></div>` : '<div></div>'}
    ${match.ar2 ? `<div class="ir"><span class="il">AR2:</span><span class="iv">${match.ar2}</span></div>` : '<div></div>'}
    ${match.tmo ? `<div class="ir"><span class="il">TMO:</span><span class="iv">${match.tmo}</span></div>` : '<div></div>'}
    <div class="ir"><span class="il">Yellow Cards:</span><span class="iv">${a.yellowCards || 0}</span></div>
    <div class="ir"><span class="il">Red Cards:</span><span class="iv">${a.redCards || 0}</span></div>
    <div class="ir"><span class="il">Events Logged:</span><span class="iv">${events.length}</span></div>
  </div>

  <div class="sec">
    <h2>Performance Assessment</h2>
    <table class="pt">
      <thead><tr><th style="width:32%">Area</th><th style="width:12%">Rating</th><th>Notes</th></tr></thead>
      <tbody>${ratingsRows}</tbody>
    </table>
  </div>

  ${a.observations  ? `<div class="sec"><h2>Key Observations</h2><div class="tb">${a.observations}</div></div>` : ''}
  ${a.strengths     ? `<div class="sec"><h2>Strengths</h2><div class="tb">${a.strengths}</div></div>` : ''}
  ${a.development   ? `<div class="sec"><h2>Areas for Development</h2><div class="tb">${a.development}</div></div>` : ''}
  ${a.actions       ? `<div class="sec"><h2>Action Points</h2><div class="tb">${a.actions}</div></div>` : ''}
  ${a.selfAssessment? `<div class="sec"><h2>Referee Self-Assessment</h2><div class="tb">${a.selfAssessment}</div></div>` : ''}
</div>

${events.length > 0 ? `<div class="page-break"></div>
<div class="page">
  <div class="rh">
    <div class="rh-left">
      <h1>Game Notes</h1>
      <div class="sub">${ref ? ref.firstName + ' ' + ref.lastName : ''} · ${match.homeTeam || 'Home'} v ${match.awayTeam || 'Away'} · ${date}</div>
    </div>
  </div>

  <div class="sec">
    <h2>Event Log (${events.filter(e=>!e.isMarker).length} entries)</h2>
    <table class="nt">
      <thead><tr><th>Time</th><th>Phase</th><th>Possession</th><th>Position</th><th>Outcome</th><th>Infringement</th><th>Against</th><th>Card</th></tr></thead>
      <tbody>${gameNotesRows}</tbody>
    </table>
  </div>

  <div class="sec">
    <h2>Penalty Summary  ·  ${match.homeTeam || 'Home'} ${pkAgainst.home} – ${pkAgainst.away} ${match.awayTeam || 'Away'}</h2>
    <div class="sg">
      <div class="sc">
        <h3>${match.homeTeam || 'Home'} — ${pkAgainst.home} penalties against</h3>
        <h3 style="margin-top:6px;">By Phase</h3>
        <table class="st"><thead><tr><th>Phase</th><th>Count</th></tr></thead><tbody>
          ${buildStatsRows(pkByPhase.home)}
          ${pkAgainst.home > 0 ? `<tr class="tot"><td>Total</td><td style="text-align:center;">${pkAgainst.home}</td></tr>` : ''}
        </tbody></table>
        ${Object.keys(pkByInfring.home).length > 0 ? `
        <h3 style="margin-top:8px;">By Infringement</h3>
        <table class="st"><thead><tr><th>Infringement</th><th>Count</th></tr></thead><tbody>
          ${buildStatsRows(pkByInfring.home)}
        </tbody></table>` : ''}
      </div>
      <div class="sc">
        <h3>${match.awayTeam || 'Away'} — ${pkAgainst.away} penalties against</h3>
        <h3 style="margin-top:6px;">By Phase</h3>
        <table class="st"><thead><tr><th>Phase</th><th>Count</th></tr></thead><tbody>
          ${buildStatsRows(pkByPhase.away)}
          ${pkAgainst.away > 0 ? `<tr class="tot"><td>Total</td><td style="text-align:center;">${pkAgainst.away}</td></tr>` : ''}
        </tbody></table>
        ${Object.keys(pkByInfring.away).length > 0 ? `
        <h3 style="margin-top:8px;">By Infringement</h3>
        <table class="st"><thead><tr><th>Infringement</th><th>Count</th></tr></thead><tbody>
          ${buildStatsRows(pkByInfring.away)}
        </tbody></table>` : ''}
      </div>
    </div>
  </div>

  ${Object.keys(allPkByPos).length > 0 ? `
  <div class="sec">
    <h2>Penalty Location Heat Map</h2>
    <div class="hm">${heatCells}</div>
    <div style="font-size:9px;color:#888;text-align:center;margin-top:4px;">← ${match.homeTeam || 'Home'} attacking end &nbsp;·&nbsp; Field Zones &nbsp;·&nbsp; ${match.awayTeam || 'Away'} attacking end →</div>
  </div>` : ''}
</div>` : ''}

</body></html>`;

    const w = window.open('', '_blank');
    if (!w) { this.toast('Allow pop-ups to print'); return; }
    w.document.write(html);
    w.document.close();
  },

  emailReport() {
    const match = State.getMatch(this.currentMatchId);
    if (!match) return;
    const ref    = State.getReferee(match.refereeId);
    const a      = match.assessment || {};
    const events = match.liveData?.events || [];
    const date   = match.date ? new Date(match.date).toLocaleDateString('en-AU') : '';

    const posLabel = { 'half-home': 'Home Half', 'half-away': 'Away Half', '22-home': 'Home 22', '22-away': 'Away 22' };
    const teamName = (t) => t === 'home' ? (match.homeTeam || 'Home') : (match.awayTeam || 'Away');

    const pkAgainst = { home: 0, away: 0 };
    events.forEach(e => { if ((e.outcome === 'PK' || e.phase === 'Pen Gen Play') && e.against) pkAgainst[e.against]++; });

    const areaLines = AREAS.map(area => {
      const r = a.ratings?.[area.id] || 'Not rated';
      const note = a.areaNotes?.[area.id] ? `\n   ${a.areaNotes[area.id]}` : '';
      return `${area.label}: ${r}${note}`;
    }).join('\n');

    const eventLines = events.map(e => {
      const parts = [
        e.possession ? teamName(e.possession) : null,
        e.position   ? posLabel[e.position]   : null,
        e.outcome    || null,
        e.infringement || null,
        e.against    ? `against ${teamName(e.against)}` : null,
      ].filter(Boolean).join(' · ');
      return `${e.time}  ${e.phase}  ${parts}`;
    }).join('\n');

    const body = [
      `REFEREE COACHING REPORT`,
      `═══════════════════════`,
      `Referee: ${ref ? ref.firstName + ' ' + ref.lastName : 'Unknown'}`,
      `Date:    ${date}`,
      `Match:   ${match.homeTeam} ${a.homeScore ?? 0} – ${a.awayScore ?? 0} ${match.awayTeam}`,
      match.competition ? `Competition: ${match.competition}` : '',
      match.venue       ? `Venue: ${match.venue}`             : '',
      ``,
      `OVERALL RATING: ${a.ratings?.overall || 'Not rated'}`,
      ``,
      `PERFORMANCE AREAS\n─────────────────`,
      areaLines,
      ``,
      `PENALTIES AGAINST\n─────────────────`,
      `${match.homeTeam}: ${pkAgainst.home}`,
      `${match.awayTeam}: ${pkAgainst.away}`,
      ``,
      `CARDS: Yellow ${a.yellowCards || 0}  Red ${a.redCards || 0}`,
      ``,
      events.length ? `EVENT LOG (${events.length})\n─────────────────\n${eventLines}` : '',
      ``,
      a.observations  ? `KEY OBSERVATIONS\n${a.observations}`        : '',
      a.strengths     ? `\nSTRENGTHS\n${a.strengths}`                 : '',
      a.development   ? `\nAREAS FOR DEVELOPMENT\n${a.development}`   : '',
      a.actions       ? `\nACTION POINTS\n${a.actions}`               : '',
      a.selfAssessment? `\nREFEREE SELF-ASSESSMENT\n${a.selfAssessment}` : '',
    ].filter(Boolean).join('\n').trim();

    const email   = ref?.email || '';
    const subject = encodeURIComponent(`Coaching Report — ${ref ? ref.firstName + ' ' + ref.lastName : 'Referee'} — ${date}`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(body)}`;
  },

  applyUpdate() {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg && reg.waiting) {
        reg.waiting.postMessage('SKIP_WAITING');
      }
    });
  },

  shareReport() {
    if (navigator.share) {
      const match = State.getMatch(this.currentMatchId);
      const ref   = State.getReferee(match?.refereeId);
      navigator.share({ title: `Coaching Report — ${ref ? ref.firstName + ' ' + ref.lastName : 'Referee'}`, text: 'Referee coaching report.' });
    } else {
      this.toast('Use Print/PDF or Email to share.');
    }
  },

  confirmDeleteReferee() {
    const ref = State.getReferee(this.currentRefereeId);
    if (!ref) return;
    const matchCount = State.matchesForReferee(ref.id).length;
    const matchWarning = matchCount > 0
      ? ` This will also delete ${matchCount} match record${matchCount !== 1 ? 's' : ''}.`
      : '';
    this.showModal(
      `Delete ${ref.firstName} ${ref.lastName}?`,
      `This referee will be permanently removed.${matchWarning} This cannot be undone.`,
      'Delete',
      'btn-modal-danger',
      () => {
        State.deleteReferee(this.currentRefereeId);
        this.currentRefereeId = null;
        this.toast('Referee deleted');
        // Go back to home
        Router.pop();
        this.onScreenEnter(Router.current());
      }
    );
  },

  confirmDeleteMatch() {
    this.showModal(
      'Delete Match?',
      'This will permanently delete this match and all its data. This cannot be undone.',
      'Delete',
      'btn-modal-danger',
      () => {
        State.deleteMatch(this.currentMatchId);
        this.currentMatchId = null;
        this.currentMatch   = null;
        this.toast('Match deleted');
        Router.pop();
        Router.pop();
        this.onScreenEnter(Router.current());
      }
    );
  }
};

// ══════════════════════════════════════════════════════════
//  PHASE MODAL
// ══════════════════════════════════════════════════════════

const PhaseModal = {
  phase:        null,
  possession:   'home',
  position:     null,
  outcome:      null,
  infringement: null,
  against:      null,
  card:         null,
  scrumResets:  0,    // count of resets logged for the current scrum

  open(phase) {
    this.phase       = phase;
    this.scrumResets = 0;
    this.reset();

    const cfg = PHASES[phase];
    document.getElementById('pm-title').textContent = phase;

    // Team buttons - update labels
    const match = State.getMatch(App.currentMatchId);
    if (match) {
      document.getElementById('pm-team-home').textContent = match.homeTeam;
      document.getElementById('pm-team-away').textContent = match.awayTeam;
      document.getElementById('pm-against-home').textContent = `Against ${match.homeTeam}`;
      document.getElementById('pm-against-away').textContent = `Against ${match.awayTeam}`;
    } else {
      document.getElementById('pm-team-home').textContent = 'Home';
      document.getElementById('pm-team-away').textContent = 'Away';
      document.getElementById('pm-against-home').textContent = 'Against Home';
      document.getElementById('pm-against-away').textContent = 'Against Away';
    }

    // Set default team selection
    document.getElementById('pm-team-home').classList.add('active');
    document.getElementById('pm-team-away').classList.remove('active');

    // Render outcomes
    const outDiv = document.getElementById('pm-outcomes');
    if (cfg.outcomes && cfg.outcomes.length) {
      document.getElementById('pm-outcome-label').style.display = '';
      outDiv.innerHTML = cfg.outcomes.map(o =>
        `<button class="pm-opt-btn outcome" data-val="${o}" onclick="PhaseModal.setOutcome(this)">${o}</button>`
      ).join('');
    } else {
      document.getElementById('pm-outcome-label').style.display = 'none';
      outDiv.innerHTML = '';
    }

    // Render infringements
    const infDiv = document.getElementById('pm-infringements');
    if (cfg.infringements && cfg.infringements.length) {
      document.getElementById('pm-infringement-label').style.display = '';
      infDiv.innerHTML = cfg.infringements.map(i =>
        `<button class="pm-opt-btn infringement" data-val="${i}" onclick="PhaseModal.setInfringement(this)">${i}</button>`
      ).join('');
    } else {
      document.getElementById('pm-infringement-label').style.display = 'none';
      infDiv.innerHTML = '';
    }

    // Show/hide sections based on phase
    const isCritical = phase === 'Critical';
    document.getElementById('pm-critical-section').classList.toggle('hidden', !isCritical);
    document.getElementById('pm-structured-section').classList.toggle('hidden', isCritical);
    document.getElementById('pm-card-section').classList.toggle('hidden', isCritical);
    if (isCritical) document.getElementById('pm-critical-text').value = '';

    document.getElementById('phase-modal-overlay').classList.remove('hidden');
    document.getElementById('phase-modal').scrollTop = 0;
  },

  setTeam(team) {
    this.possession = team;
    document.getElementById('pm-team-home').classList.toggle('active', team === 'home');
    document.getElementById('pm-team-away').classList.toggle('active', team === 'away');
  },

  setPos(btn) {
    this.position = btn.dataset.pos;
    document.querySelectorAll('.pm-pos-btn').forEach(b => b.classList.toggle('active', b === btn));
  },

  setOutcome(btn) {
    this.outcome = btn.dataset.val;
    document.querySelectorAll('.pm-opt-btn.outcome').forEach(b => b.classList.toggle('active', b === btn));

    // For Scrum Reset: swap infringement section to reset reasons
    if (this.phase === 'Scrum') {
      const cfg = PHASES['Scrum'];
      if (this.outcome === 'Reset') {
        document.getElementById('pm-infringement-label').textContent = 'Reset Reason';
        document.getElementById('pm-infringements').innerHTML = cfg.resetReasons.map(r =>
          `<button class="pm-opt-btn infringement pm-reset-reason" data-val="${r}" onclick="PhaseModal.logReset(this)">${r}</button>`
        ).join('');
      } else {
        document.getElementById('pm-infringement-label').textContent = 'Infringement';
        document.getElementById('pm-infringements').innerHTML = cfg.infringements.map(i =>
          `<button class="pm-opt-btn infringement" data-val="${i}" onclick="PhaseModal.setInfringement(this)">${i}</button>`
        ).join('');
        this.infringement = null;
      }
    }
  },

  setInfringement(btn) {
    this.infringement = btn.dataset.val;
    document.querySelectorAll('.pm-opt-btn.infringement').forEach(b => b.classList.toggle('active', b === btn));
  },

  logReset(btn) {
    const reason = btn.dataset.val;
    // Log the reset event immediately
    App.logEvent({
      phase:        'Scrum',
      possession:   this.possession,
      position:     this.position,
      outcome:      'Reset',
      infringement: reason,
      against:      null,
      card:         null,
    });
    this.scrumResets++;
    App.toast(`Scrum reset — ${reason}`);

    // Clear outcome & infringement selections, restore normal infringement buttons
    this.outcome      = null;
    this.infringement = null;
    document.querySelectorAll('.pm-opt-btn.outcome').forEach(b => b.classList.remove('active'));
    document.getElementById('pm-infringement-label').textContent = 'Infringement';
    document.getElementById('pm-infringements').innerHTML = PHASES['Scrum'].infringements.map(i =>
      `<button class="pm-opt-btn infringement" data-val="${i}" onclick="PhaseModal.setInfringement(this)">${i}</button>`
    ).join('');

    // Update reset counter display
    this._renderResetCounter();

    // Scroll back to top so the outcome buttons are visible
    document.getElementById('phase-modal').scrollTop = 0;
  },

  _renderResetCounter() {
    let el = document.getElementById('pm-reset-counter');
    if (this.scrumResets === 0) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'pm-reset-counter';
      el.className = 'pm-reset-counter';
      // Insert before the outcome label
      const outcomeLabel = document.getElementById('pm-outcome-label');
      outcomeLabel.parentNode.insertBefore(el, outcomeLabel);
    }
    el.textContent = `↺ ${this.scrumResets} reset${this.scrumResets > 1 ? 's' : ''} logged — select final outcome`;
  },

  setAgainst(team) {
    this.against = team;
    document.getElementById('pm-against-home').classList.toggle('active', team === 'home');
    document.getElementById('pm-against-away').classList.toggle('active', team === 'away');
  },

  setCard(type) {
    // Toggle: tap same card again to deselect
    this.card = this.card === type ? null : type;
    document.getElementById('pm-card-yellow').classList.toggle('active', this.card === 'yellow');
    document.getElementById('pm-card-red').classList.toggle('active', this.card === 'red');
  },

  reset() {
    this.possession   = 'home';
    this.position     = null;
    this.outcome      = null;
    this.infringement = null;
    this.against      = null;
    this.card         = null;
    this.scrumResets  = 0;
    document.querySelectorAll('.pm-opt-btn, .pm-pos-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('pm-team-home').classList.add('active');
    document.getElementById('pm-team-away').classList.remove('active');
    document.getElementById('pm-against-home').classList.remove('active');
    document.getElementById('pm-against-away').classList.remove('active');
    document.getElementById('pm-card-yellow').classList.remove('active');
    document.getElementById('pm-card-red').classList.remove('active');
    // Restore infringement label and buttons if we were in a scrum reset state
    const infLabel = document.getElementById('pm-infringement-label');
    if (infLabel) infLabel.textContent = 'Infringement';
    const counter = document.getElementById('pm-reset-counter');
    if (counter) counter.remove();
  },

  cancel() {
    document.getElementById('phase-modal-overlay').classList.add('hidden');
  },

  done() {
    const notes = this.phase === 'Critical'
      ? document.getElementById('pm-critical-text').value.trim()
      : null;

    App.logEvent({
      phase:        this.phase,
      possession:   this.phase === 'Critical' ? null : this.possession,
      position:     this.phase === 'Critical' ? null : this.position,
      outcome:      this.outcome,
      infringement: this.infringement,
      against:      this.phase === 'Critical' ? null : this.against,
      card:         this.card,
      notes,
    });
    const cardMsg = this.card ? ` + ${this.card === 'yellow' ? '🟡 Yellow' : '🔴 Red'} card` : '';
    App.toast(`${this.phase} logged${cardMsg}`);
    document.getElementById('phase-modal-overlay').classList.add('hidden');
  }
};

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  App.renderHome();

  const liveNotes = document.getElementById('live-notes');
  if (liveNotes) liveNotes.addEventListener('input', () => App.saveLiveNotes());

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      // If a new SW is already waiting on first load, show banner immediately
      if (reg.waiting) {
        document.getElementById('update-banner').classList.remove('hidden');
      }
      // If a new SW installs while the app is open
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            document.getElementById('update-banner').classList.remove('hidden');
          }
        });
      });
    }).catch(() => {});

    // After SKIP_WAITING, the new SW activates — reload to use it
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }
});
