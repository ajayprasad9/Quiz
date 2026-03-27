/**
 * House Points Widget
 * Drop this one line into any page's <head> or before </body>:
 *   <script src="house-points-widget.js"></script>
 *
 * It renders a floating ⚡ button (top-right). Clicking opens a
 * slide-in panel where Avyukth can log points and see his calendar.
 * Data is stored in Google Sheets via a deployed Apps Script URL
 * (saved in localStorage after first-time setup).
 */
(function () {
  'use strict';

  // ── CONFIG ────────────────────────────────────────────────────────
  const RUPEES_PER_POINT = 1;
  const ACTIVITIES = [
    { label: 'Table Tennis Coaching', icon: '🏓', color: '#3b82f6' },
    { label: 'Piano Practice',        icon: '🎹', color: '#8b5cf6' },
    { label: 'Hanging Exercise',      icon: '🤸', color: '#22c55e' },
    { label: 'Reading',               icon: '📚', color: '#f59e0b' },
    { label: 'Daily Cleanliness',     icon: '🧹', color: '#ec4899' },
    { label: 'Other',                 icon: '⭐', color: '#94a3b8' },
  ];

  // ── STATE ─────────────────────────────────────────────────────────
  let scriptUrl = localStorage.getItem('hp_script_url') || '';
  let allEntries = [];
  try { allEntries = JSON.parse(localStorage.getItem('hp_local_entries') || '[]'); } catch(e) {}
  let calYear, calMonth;

  // ── INJECT STYLES ─────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #hp-fab {
      position: fixed; top: 16px; right: 16px; z-index: 9999;
      background: linear-gradient(135deg,#f5c842,#e67e22);
      border: none; border-radius: 50px;
      padding: 10px 16px;
      display: flex; align-items: center; gap: 7px;
      cursor: pointer; box-shadow: 0 4px 20px rgba(245,200,66,0.4);
      font-family: 'Nunito', sans-serif; font-size: 0.88rem; font-weight: 800;
      color: #1a0a2e; transition: all 0.2s;
      white-space: nowrap;
    }
    #hp-fab:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(245,200,66,0.5); }
    #hp-fab-pts {
      background: rgba(26,10,46,0.2); border-radius: 20px;
      padding: 2px 8px; font-size: 0.82rem;
    }

    #hp-overlay {
      position: fixed; inset: 0; z-index: 9998;
      background: rgba(0,0,0,0.55); backdrop-filter: blur(3px);
      opacity: 0; pointer-events: none; transition: opacity 0.25s;
    }
    #hp-overlay.open { opacity: 1; pointer-events: all; }

    #hp-panel {
      position: fixed; top: 0; right: 0; bottom: 0; z-index: 9999;
      width: min(420px, 100vw);
      background: #1c1730;
      border-left: 1px solid rgba(245,200,66,0.2);
      display: flex; flex-direction: column;
      transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
      font-family: 'Nunito', sans-serif;
      overflow: hidden;
    }
    #hp-panel.open { transform: translateX(0); }

    .hp-panel-header {
      padding: 18px 20px 14px;
      border-bottom: 1px solid rgba(245,200,66,0.12);
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0;
    }
    .hp-panel-title {
      font-family: 'Cinzel', 'Georgia', serif;
      font-size: 1.1rem; font-weight: 600;
      background: linear-gradient(135deg,#f5c842,#fff8e0);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .hp-close-btn {
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px; width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: #8b7fa8; font-size: 1rem;
      transition: all 0.15s;
    }
    .hp-close-btn:hover { background: rgba(255,255,255,0.14); color: #faf7f0; }

    .hp-panel-body { flex: 1; overflow-y: auto; padding: 16px 20px 24px; }
    .hp-panel-body::-webkit-scrollbar { width: 4px; }
    .hp-panel-body::-webkit-scrollbar-track { background: transparent; }
    .hp-panel-body::-webkit-scrollbar-thumb { background: rgba(245,200,66,0.2); border-radius: 4px; }

    /* stats strip */
    .hp-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
    .hp-stat {
      background: rgba(255,255,255,0.04); border: 1px solid rgba(245,200,66,0.15);
      border-radius: 12px; padding: 14px 12px; text-align: center;
    }
    .hp-stat-val { font-family: 'Cinzel','Georgia',serif; font-size: 1.7rem; font-weight: 600; color: #f5c842; display: block; line-height: 1; }
    .hp-stat-val.green { color: #4ade80; }
    .hp-stat-lbl { font-size: 0.7rem; color: #8b7fa8; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }

    /* add form */
    .hp-section-title { font-size: 0.75rem; font-weight: 800; text-transform: uppercase;
      letter-spacing: 2px; color: #8b7fa8; margin-bottom: 10px; }

    .hp-form { background: rgba(255,255,255,0.04); border: 1px solid rgba(245,200,66,0.15);
      border-radius: 14px; padding: 16px; margin-bottom: 18px; }

    .hp-select, .hp-date-input, .hp-text-input {
      width: 100%; background: #241f3a; border: 1.5px solid rgba(255,255,255,0.1);
      border-radius: 10px; padding: 10px 13px;
      font-family: 'Nunito', sans-serif; font-size: 0.9rem;
      color: #faf7f0; outline: none; margin-bottom: 10px;
      transition: border-color 0.2s; -webkit-appearance: none;
    }
    .hp-select:focus, .hp-date-input:focus, .hp-text-input:focus {
      border-color: rgba(245,200,66,0.5);
    }
    .hp-select option { background: #1c1730; }
    .hp-other-wrap { display: none; }
    .hp-other-wrap.visible { display: block; }

    .hp-date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    @media(max-width:380px){ .hp-date-row{ grid-template-columns:1fr; } }

    .hp-add-btn {
      width: 100%; padding: 12px;
      background: linear-gradient(135deg,#f5c842,#e67e22);
      border: none; border-radius: 10px;
      font-family: 'Nunito', sans-serif; font-size: 0.95rem; font-weight: 800;
      color: #1a0a2e; cursor: pointer; transition: all 0.18s;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .hp-add-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(245,200,66,0.3); }
    .hp-add-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

    .hp-feedback {
      margin-top: 10px; padding: 9px 13px; border-radius: 9px;
      font-size: 0.85rem; font-weight: 700; text-align: center; display: none;
    }
    .hp-feedback.success { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.28); color: #4ade80; display: block; }
    .hp-feedback.dupe    { background: rgba(245,200,66,0.08); border: 1px solid rgba(245,200,66,0.25); color: #f5c842; display: block; }
    .hp-feedback.error   { background: rgba(239,68,68,0.1);   border: 1px solid rgba(239,68,68,0.28);   color: #f87171; display: block; }

    /* calendar */
    .hp-cal { margin-bottom: 18px; }
    .hp-cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .hp-cal-nav-btn {
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 7px; padding: 5px 11px; color: #8b7fa8;
      font-family: 'Nunito',sans-serif; font-size: 0.9rem; cursor: pointer; transition: all 0.15s;
    }
    .hp-cal-nav-btn:hover { color: #f5c842; border-color: rgba(245,200,66,0.3); }
    .hp-cal-month { font-size: 0.88rem; font-weight: 700; color: #faf7f0; }

    .hp-cal-weekdays { display: grid; grid-template-columns: repeat(7,1fr); gap: 3px; margin-bottom: 4px; }
    .hp-cal-wd { text-align: center; font-size: 0.65rem; font-weight: 700; color: #8b7fa8; text-transform: uppercase; }

    .hp-cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 3px; }
    .hp-cal-day {
      aspect-ratio: 1; border-radius: 8px; background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.04);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-size: 0.72rem; font-weight: 700; color: #8b7fa8;
      position: relative; cursor: default; transition: all 0.15s;
      min-height: 36px;
    }
    .hp-cal-day.empty { background: transparent; border-color: transparent; }
    .hp-cal-day.today { border-color: rgba(245,200,66,0.5); color: #f5c842; }
    .hp-cal-day.future { opacity: 0.25; }
    .hp-cal-day.has-pts { cursor: pointer; color: #faf7f0; background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.1); }
    .hp-cal-day.has-pts:hover { border-color: rgba(245,200,66,0.4); transform: scale(1.05); }
    .hp-day-num { line-height: 1; }
    .hp-day-pts { font-size: 0.6rem; font-weight: 800; color: #f5c842; line-height: 1; margin-top: 2px; }
    .hp-dot-row { display: flex; gap: 2px; margin-top: 2px; justify-content: center; flex-wrap: wrap; }
    .hp-dot { width: 3px; height: 3px; border-radius: 50%; }

    /* day detail */
    .hp-day-detail {
      background: rgba(245,200,66,0.06); border: 1px solid rgba(245,200,66,0.2);
      border-radius: 12px; padding: 14px 16px; margin-bottom: 18px; display: none;
    }
    .hp-day-detail.visible { display: block; }
    .hp-day-detail-date { font-size: 0.78rem; font-weight: 700; color: #f5c842; margin-bottom: 8px; }
    .hp-day-activity { display: flex; align-items: center; gap: 8px; padding: 5px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem; color: #faf7f0; }
    .hp-day-activity:last-child { border-bottom: none; }

    /* breakdown */
    .hp-breakdown { margin-bottom: 16px; }
    .hp-bk-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .hp-bk-icon { font-size: 1.1rem; width: 24px; text-align: center; flex-shrink: 0; }
    .hp-bk-label { flex: 1; font-size: 0.82rem; font-weight: 600; color: #faf7f0; }
    .hp-bk-track { flex: 2; background: rgba(255,255,255,0.06); border-radius: 5px; height: 6px; overflow: hidden; }
    .hp-bk-fill { height: 100%; border-radius: 5px; }
    .hp-bk-count { font-size: 0.78rem; font-weight: 800; color: #f5c842; min-width: 20px; text-align: right; }

    /* setup */
    .hp-setup { background: rgba(245,200,66,0.05); border: 1px solid rgba(245,200,66,0.2);
      border-radius: 12px; padding: 16px; margin-bottom: 18px; }
    .hp-setup p { font-size: 0.82rem; color: rgba(250,247,240,0.6); margin-bottom: 10px; line-height: 1.6; }
    .hp-setup a { color: #f5c842; }
    .hp-setup-input {
      width: 100%; background: #241f3a; border: 1.5px solid rgba(245,200,66,0.25);
      border-radius: 9px; padding: 9px 12px;
      font-family: 'Nunito',sans-serif; font-size: 0.8rem; color: #faf7f0;
      outline: none; margin-bottom: 8px;
    }
    .hp-setup-btn {
      padding: 9px 20px; background: linear-gradient(135deg,#f5c842,#e67e22);
      border: none; border-radius: 9px; font-family: 'Nunito',sans-serif;
      font-size: 0.88rem; font-weight: 800; color: #1a0a2e; cursor: pointer;
    }

    .hp-spinner { display: inline-block; width: 14px; height: 14px;
      border: 2px solid rgba(26,10,46,0.3); border-top-color: #1a0a2e;
      border-radius: 50%; animation: hp-spin 0.7s linear infinite; vertical-align: middle; }
    @keyframes hp-spin { to { transform: rotate(360deg); } }

    .hp-divider { height: 1px; background: rgba(245,200,66,0.1); margin: 16px 0; }
  `;
  document.head.appendChild(style);

  // ── BUILD DOM ─────────────────────────────────────────────────────
  function buildWidget() {
    // FAB button
    const fab = document.createElement('button');
    fab.id = 'hp-fab';
    fab.innerHTML = '⚡ House Points <span id="hp-fab-pts">—</span>';
    fab.onclick = openPanel;

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'hp-overlay';
    overlay.onclick = closePanel;

    // Panel
    const panel = document.createElement('div');
    panel.id = 'hp-panel';
    panel.innerHTML = `
      <div class="hp-panel-header">
        <span class="hp-panel-title">⚡ House Points</span>
        <div class="hp-close-btn" onclick="document.getElementById('hp-overlay').click()">✕</div>
      </div>
      <div class="hp-panel-body" id="hp-body">
        <div id="hp-loading" style="text-align:center;padding:32px;color:#8b7fa8;font-size:0.88rem;">
          <span class="hp-spinner"></span> Loading…
        </div>
      </div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  }

  function openPanel() {
    document.getElementById('hp-overlay').classList.add('open');
    document.getElementById('hp-panel').classList.add('open');
    renderPanel();
  }
  function closePanel() {
    document.getElementById('hp-overlay').classList.remove('open');
    document.getElementById('hp-panel').classList.remove('open');
  }

  // ── RENDER PANEL ──────────────────────────────────────────────────
  function renderPanel() {
    const today = new Date();
    const y = today.getFullYear(), m = today.getMonth();
    const monthStr = `${y}-${String(m+1).padStart(2,'0')}`;
    const monthEntries = allEntries.filter(e => e.date.startsWith(monthStr));
    const monthPts = monthEntries.length;

    // streak
    let streak = 0;
    const check = new Date(today);
    while (streak < 366) {
      if (allEntries.find(e => e.date === toDateStr(check))) { streak++; check.setDate(check.getDate()-1); }
      else break;
    }

    const monthName = today.toLocaleString('default',{month:'long',year:'numeric'});

    // activity breakdown for this month
    const counts = {};
    ACTIVITIES.forEach(a => counts[a.label] = 0);
    monthEntries.forEach(e => { if (counts[e.activity] !== undefined) counts[e.activity]++; else counts['Other']++; });
    const maxCount = Math.max(1, ...Object.values(counts));

    const breakdownHTML = ACTIVITIES.map(a => {
      const c = counts[a.label] || 0;
      if (c === 0) return '';
      const pct = Math.round(c / maxCount * 100);
      return `<div class="hp-bk-row">
        <div class="hp-bk-icon">${a.icon}</div>
        <div class="hp-bk-label">${a.label}</div>
        <div class="hp-bk-track"><div class="hp-bk-fill" style="width:${pct}%;background:${a.color};"></div></div>
        <div class="hp-bk-count">${c}</div>
      </div>`;
    }).join('');

    // today's date for input defaults
    const todayStr = toDateStr(today);
    const minDate = new Date(today); minDate.setDate(minDate.getDate()-7);

    const setupSection = scriptUrl ? '' : `
      <div class="hp-setup">
        <p>Paste your Google Apps Script Web App URL below to save points across all devices:</p>
        <input class="hp-setup-input" id="hp-url-input" placeholder="https://script.google.com/macros/s/..." value="${scriptUrl}">
        <button class="hp-setup-btn" onclick="window._hpSaveUrl()">💾 Connect</button>
      </div>`;

    document.getElementById('hp-body').innerHTML = `
      ${setupSection}

      <div class="hp-stats">
        <div class="hp-stat">
          <span class="hp-stat-val" id="hp-stat-pts">${monthPts}</span>
          <span class="hp-stat-lbl">${today.toLocaleString('default',{month:'short'})} points</span>
        </div>
        <div class="hp-stat">
          <span class="hp-stat-val green">₹${monthPts * RUPEES_PER_POINT}</span>
          <span class="hp-stat-lbl">Pocket money 💰</span>
        </div>
      </div>

      <div class="hp-section-title">Log a point</div>
      <div class="hp-form">
        <select class="hp-select" id="hp-activity" onchange="window._hpActivityChange()">
          <option value="">Choose activity…</option>
          ${ACTIVITIES.map(a => `<option value="${a.label}">${a.icon} ${a.label}</option>`).join('')}
        </select>
        <div class="hp-date-row">
          <input type="date" class="hp-date-input" id="hp-date"
            value="${todayStr}" min="${toDateStr(minDate)}" max="${todayStr}">
        </div>
        <div class="hp-other-wrap" id="hp-other-wrap">
          <input type="text" class="hp-text-input" id="hp-other-text"
            placeholder="Describe what you did…" maxlength="80">
        </div>
        <button class="hp-add-btn" id="hp-add-btn" onclick="window._hpAddPoint()">
          ➕ Add Point
        </button>
        <div class="hp-feedback" id="hp-feedback"></div>
      </div>

      <div class="hp-divider"></div>

      <div class="hp-section-title">${monthName} calendar</div>
      <div class="hp-cal">
        <div class="hp-cal-nav">
          <button class="hp-cal-nav-btn" onclick="window._hpCalNav(-1)">‹</button>
          <span class="hp-cal-month" id="hp-cal-label"></span>
          <button class="hp-cal-nav-btn" onclick="window._hpCalNav(1)">›</button>
        </div>
        <div class="hp-cal-weekdays">
          ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=>`<div class="hp-cal-wd">${d}</div>`).join('')}
        </div>
        <div class="hp-cal-grid" id="hp-cal-grid"></div>
      </div>

      <div class="hp-day-detail" id="hp-day-detail"></div>

      ${breakdownHTML ? `
        <div class="hp-divider"></div>
        <div class="hp-section-title">${today.toLocaleString('default',{month:'short'})} breakdown</div>
        <div class="hp-breakdown">${breakdownHTML}</div>
      ` : ''}
    `;

    renderCal();
    updateFab();
  }

  // ── CALENDAR ─────────────────────────────────────────────────────
  function renderCal() {
    if (!calYear) { const t=new Date(); calYear=t.getFullYear(); calMonth=t.getMonth(); }
    const today = new Date(); const todayStr = toDateStr(today);
    const label = new Date(calYear,calMonth,1).toLocaleString('default',{month:'long',year:'numeric'});
    const el = document.getElementById('hp-cal-label');
    const grid = document.getElementById('hp-cal-grid');
    if (!el || !grid) return;
    el.textContent = label;

    const firstDay = new Date(calYear,calMonth,1).getDay();
    const daysInMonth = new Date(calYear,calMonth+1,0).getDate();
    let html = '';
    for (let i=0;i<firstDay;i++) html += '<div class="hp-cal-day empty"></div>';
    for (let d=1;d<=daysInMonth;d++) {
      const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday = ds===todayStr, isFuture = ds>todayStr;
      const de = allEntries.filter(e=>e.date===ds);
      const pts = de.length;
      let cls = 'hp-cal-day';
      if (isToday) cls+=' today';
      if (isFuture) cls+=' future';
      if (pts) cls+=' has-pts';
      const dots = de.map(e=>{
        const act = ACTIVITIES.find(a=>a.label===e.activity)||{color:'#94a3b8'};
        return `<div class="hp-dot" style="background:${act.color}"></div>`;
      }).join('');
      const click = pts ? `onclick="window._hpShowDay('${ds}')"` : '';
      html += `<div class="${cls}" ${click}>
        <span class="hp-day-num">${d}</span>
        ${pts ? `<span class="hp-day-pts">${pts}</span>` : ''}
        ${dots ? `<div class="hp-dot-row">${dots}</div>` : ''}
      </div>`;
    }
    grid.innerHTML = html;
  }

  window._hpCalNav = function(dir) {
    calMonth += dir;
    if (calMonth>11){calMonth=0;calYear++;}
    if (calMonth<0){calMonth=11;calYear--;}
    renderCal();
    document.getElementById('hp-day-detail').classList.remove('visible');
  };

  window._hpShowDay = function(ds) {
    const de = allEntries.filter(e=>e.date===ds);
    const detail = document.getElementById('hp-day-detail');
    if (!de.length){detail.classList.remove('visible');return;}
    const formatted = new Date(...ds.split('-').map((v,i)=>i===1?+v-1:+v))
      .toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});
    let html = `<div class="hp-day-detail-date">📅 ${formatted} · ${de.length} point${de.length>1?'s':''}</div>`;
    de.forEach(e=>{
      const act = ACTIVITIES.find(a=>a.label===e.activity)||{icon:'⭐'};
      const label = e.activity==='Other'&&e.note ? e.note : e.activity;
      html+=`<div class="hp-day-activity"><span>${act.icon}</span>${label}</div>`;
    });
    detail.innerHTML=html;
    detail.classList.add('visible');
  };

  // ── ADD POINT ─────────────────────────────────────────────────────
  window._hpActivityChange = function() {
    const v = document.getElementById('hp-activity').value;
    document.getElementById('hp-other-wrap').classList.toggle('visible', v==='Other');
  };

  window._hpAddPoint = async function() {
    const activity = document.getElementById('hp-activity').value;
    const date     = document.getElementById('hp-date').value;
    const note     = (document.getElementById('hp-other-text')||{}).value?.trim()||'';
    if (!activity||!date) return;
    if (activity==='Other'&&!note){showFb('dupe','✏️ Please describe what you did!');return;}
    const dupe = allEntries.find(e=>e.date===date&&e.activity===activity);
    if (dupe){showFb('dupe',`⚡ Already logged ${activity} for ${fmtDate(date)}!`);return;}

    const btn = document.getElementById('hp-add-btn');
    btn.disabled=true; btn.innerHTML='<span class="hp-spinner"></span> Saving…';

    const entry = {date, activity, note: activity==='Other'?note:''};

    if (scriptUrl) {
      try {
        await fetch(scriptUrl,{method:'POST',body:JSON.stringify(entry),headers:{'Content-Type':'application/json'},mode:'no-cors'});
      } catch(e){}
    }

    allEntries.push(entry);
    localStorage.setItem('hp_local_entries',JSON.stringify(allEntries));

    btn.disabled=false; btn.innerHTML='➕ Add Point';
    document.getElementById('hp-activity').value='';
    document.getElementById('hp-other-wrap').classList.remove('visible');
    document.getElementById('hp-date').value=toDateStr(new Date());

    showFb('success',`🎉 +1 point! ${ACTIVITIES.find(a=>a.label===activity)?.icon||'⭐'} ${activity}`);
    renderPanel();
    if (scriptUrl) setTimeout(loadEntries,1800);
  };

  function showFb(type,msg){
    const el=document.getElementById('hp-feedback');
    if(!el)return;
    el.className='hp-feedback '+type; el.textContent=msg;
    clearTimeout(el._t);
    el._t=setTimeout(()=>{el.className='hp-feedback';},3200);
  }

  // ── SETUP URL ─────────────────────────────────────────────────────
  window._hpSaveUrl = function() {
    const v=(document.getElementById('hp-url-input')||{}).value?.trim()||'';
    if (!v.startsWith('https://script.google.com')){alert('Please paste a valid Apps Script URL.');return;}
    scriptUrl=v; localStorage.setItem('hp_script_url',scriptUrl);
    loadEntries().then(renderPanel);
  };

  // ── LOAD FROM SHEETS ──────────────────────────────────────────────
  async function loadEntries() {
    if (!scriptUrl) return;
    try {
      const res = await fetch(scriptUrl);
      const data = await res.json();
      if (data.ok) {
        allEntries = data.entries.map(e=>({
          date: String(e.date).trim().substring(0,10),
          activity: String(e.activity).trim(),
          note: String(e.note||'').trim(),
        }));
        localStorage.setItem('hp_local_entries',JSON.stringify(allEntries));
      }
    } catch(e){}
    updateFab();
  }

  // ── FAB COUNTER ───────────────────────────────────────────────────
  function updateFab() {
    const today = new Date();
    const monthStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
    const pts = allEntries.filter(e=>e.date.startsWith(monthStr)).length;
    const el = document.getElementById('hp-fab-pts');
    if (el) el.textContent = pts + ' pts';
  }

  // ── HELPERS ───────────────────────────────────────────────────────
  function toDateStr(d){return d.toISOString().split('T')[0];}
  function fmtDate(ds){
    const [y,m,d]=ds.split('-');
    return new Date(+y,+m-1,+d).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
  }

  // ── BOOT ──────────────────────────────────────────────────────────
  function boot() {
    buildWidget();
    updateFab();
    if (scriptUrl) loadEntries();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();

})();
