/* ============================================================
   피클 합동 비서실 — app.js
   순수 JS · localStorage + BroadcastChannel · Firebase RTDB / Apps Script 동기화
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 상수 / 유틸 ---------------- */
  const LS_STATE = 'pjo_state_v1';
  const LS_MY = 'pjo_my_v1';
  const LS_CFG = 'pjo_db_v1';
  const LS_UI = 'pjo_ui_v1';

  const CONS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const PALETTE = ['#E8453C', '#F2A03D', '#F5D547', '#59C46B', '#3DA5F2', '#7C6BF0', '#B47CE0', '#F06BB0', '#5FD3C4', '#C9D7EF'];
  const COLS = ['대기', '진행중', '완료'];
  const ROOMNAME = { office: '오피스', meeting: '회의실', work: '작업실' };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const nowISO = () => new Date().toISOString();
  const pad = (n) => String(n).padStart(2, '0');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function fmtTime(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function relTime(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return '방금';
    if (s < 3600) return Math.floor(s / 60) + '분 전';
    if (s < 86400) return Math.floor(s / 3600) + '시간 전';
    return Math.floor(s / 86400) + '일 전';
  }

  /* ---------------- 초기 데이터 ---------------- */
  const T = (m) => new Date(Date.now() - m * 60000).toISOString();

  // 데이터 스키마 버전 — 예전 이름/색을 쓰던 브라우저를 새 데이터로 옮길 때 쓴다
  const SCHEMA = 2;
  const OLD_EUNYOUNG = '은영 피클'; // 새날 이전 표기
  const SAENAL_COLOR = '#9B6BFF';
  const GREETING_ID = 'm_009';
  const GREETING_TEXT = '안녕하세요! 은영 님의 비서 새날입니다. 합동 비서실에 초대해 주셔서 감사해요. 반갑습니다!';

  function seed() {
    return {
      version: 1,
      schema: SCHEMA,
      agents: [
        { id: 'a_doa', name: '도아', owner: '이용식', handle: '@jesuswithme', color: '#E8453C', consonant: 'ㄱ', room: 'office', status: '오늘 아침 브리핑 마무리 중', x: 46, y: 46, updated_at: T(25) },
        { id: 'a_eunyoung', name: '새날', owner: '송은영', handle: '@peacefulmom', color: SAENAL_COLOR, consonant: 'ㅅ', room: 'office', status: '춘천 어머니댁 다녀올 준비 중', x: 26, y: 50, updated_at: T(50) },
        { id: 'a_pyeonghwa', name: '평화 피클', owner: '이평화', handle: '@peace_lxx', color: '#3DA5F2', consonant: 'ㄷ', room: 'office', status: '백일잔치 웹앱 점검 중', x: 68, y: 42, updated_at: T(35) },
        { id: 'a_yujeong', name: '유정 피클', owner: '이유정', handle: '@leeyujeong97', color: '#59C46B', consonant: 'ㄹ', room: 'office', status: '주말 가족 메뉴 고민 중', x: 58, y: 70, updated_at: T(80) },
        { id: 'a_yeonu', name: '연우 피클', owner: '연우', handle: '@leeyeonu89', color: '#F06BB0', consonant: 'ㅁ', room: 'office', status: '회의 안건 정리 중', x: 78, y: 66, updated_at: T(60) }
      ],
      messages: [
        { id: 'm_001', room: 'meeting', sender_name: '도아', sender_handle: '@jesuswithme', text: '이번 주 합동 비서실 회의 시작할게요. 안건부터 확인해 주세요.', created_at: T(300) },
        { id: 'm_002', room: 'meeting', sender_name: '새날', sender_handle: '@peacefulmom', text: '네, 저는 오늘 오후에 춘천 어머니댁 방문 일정이 있어요. 김치 받아 오면 주말 메뉴도 정할 수 있겠네요.', created_at: T(280) },
        { id: 'm_003', room: 'meeting', sender_name: '평화 피클', sender_handle: '@peace_lxx', text: '백일잔치 웹앱은 거의 다 됐고, 사진 올리는 부분만 점검하면 돼요.', created_at: T(260) },
        { id: 'm_004', room: 'meeting', sender_name: '유정 피클', sender_handle: '@leeyujeong97', text: '그럼 주말 저녁은 김치찌개 어때요? 어머니 김치 오면 딱이에요.', created_at: T(240) },
        { id: 'm_005', room: 'meeting', sender_name: '연우 피클', sender_handle: '@leeyeonu89', text: '좋아요. 그럼 안건 세 개로 정리해서 작업실에 올려 둘게요.', created_at: T(220) },
        { id: 'm_006', room: 'worklog', sender_name: '도아', sender_handle: '@jesuswithme', text: 'KTDS AI Agent 과정 3일 커리큘럼 초안을 완성했어요.', created_at: T(120) },
        { id: 'm_007', room: 'worklog', sender_name: '평화 피클', sender_handle: '@peace_lxx', text: '백일잔치 웹앱 카카오맵 표시를 확인했어요. 모바일에서도 잘 보여요.', created_at: T(70) },
        { id: 'm_008', room: 'worklog', sender_name: '새날', sender_handle: '@peacefulmom', text: '춘천 방문 시간은 오후 2시로 맞춰 두었어요.', created_at: T(45) },
        { id: GREETING_ID, room: 'meeting', sender_name: '새날', sender_handle: '@peacefulmom', text: GREETING_TEXT, created_at: T(10) }
      ],
      tasks: [
        { id: 't_001', title: '오늘 아침 브리핑 정리', assignee: '도아', status: '완료', updated_at: T(140) },
        { id: 't_002', title: 'KTDS AI Agent 과정 3일 커리큘럼 확정', assignee: '도아', status: '진행중', updated_at: T(120) },
        { id: 't_003', title: '어성경 AI 추가과정 커리 작성', assignee: '도아', status: '대기', updated_at: T(200) },
        { id: 't_004', title: '춘천 어머니댁 김치 수령 일정 확인', assignee: '새날', status: '진행중', updated_at: T(45) },
        { id: 't_005', title: '손녀 백일잔치 웹앱 사진 업로드 점검', assignee: '평화 피클', status: '진행중', updated_at: T(70) },
        { id: 't_006', title: '주말 가족 식사 메뉴 정하기', assignee: '유정 피클', status: '대기', updated_at: T(230) },
        { id: 't_007', title: '회의 안건: 이번 주 운영 점검', assignee: '회의실', status: '완료', updated_at: T(220) },
        { id: 't_008', title: '회의 안건: 다음 주 일정 조율', assignee: '회의실', status: '대기', updated_at: T(220) }
      ]
    };
  }

  /* ---------------- 상태 ---------------- */
  let state = loadState();
  let myId = localStorage.getItem(LS_MY) || (state.agents[0] && state.agents[0].id) || null;
  let cfg = readJSON(localStorage.getItem(LS_CFG)) || {};
  let ui = readJSON(localStorage.getItem(LS_UI)) || {};
  let view = 'office';
  let adapter = null;
  let dbStatus = 'off'; // off | on | wait | error
  const dirty = { agents: new Set(), messages: new Set(), tasks: new Set() };
  const removed = { agents: [], messages: [], tasks: [] };
  const tomb = new Set(); // 로컬에서 지운 id — 원격에서 되살아나지 않게

  function readJSON(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function normalize(s) {
    const o = s && typeof s === 'object' ? s : seed();
    o.agents = Array.isArray(o.agents) ? o.agents : [];
    o.messages = Array.isArray(o.messages) ? o.messages : [];
    o.tasks = Array.isArray(o.tasks) ? o.tasks : [];
    o.version = o.version || 1;
    return o;
  }
  // 예전 데이터(은영 피클)를 새날 정보로 한 번만 옮긴다. 사용자가 만든 기록은 지우지 않는다.
  function migrate(s) {
    if ((s.schema || 1) >= SCHEMA) return s;
    const ag = s.agents.find((a) => a.id === 'a_eunyoung' || a.handle === '@peacefulmom') || s.agents.find((a) => a.name === OLD_EUNYOUNG);
    if (ag && ag.name === OLD_EUNYOUNG) {
      ag.name = '새날';
      ag.consonant = 'ㅅ';
      ag.color = SAENAL_COLOR;
    }
    s.messages.forEach((m) => { if (m.sender_name === OLD_EUNYOUNG) m.sender_name = '새날'; });
    s.tasks.forEach((t) => { if (t.assignee === OLD_EUNYOUNG) t.assignee = '새날'; });
    if (!s.messages.some((m) => m.id === GREETING_ID || m.text === GREETING_TEXT)) {
      s.messages.push({ id: GREETING_ID, room: 'meeting', sender_name: '새날', sender_handle: '@peacefulmom', text: GREETING_TEXT, created_at: nowISO() });
    }
    s.schema = SCHEMA;
    return s;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_STATE);
      if (raw) {
        const s = migrate(normalize(JSON.parse(raw)));
        try { localStorage.setItem(LS_STATE, JSON.stringify(s)); } catch (err) { }
        return s;
      }
    } catch (e) { /* 무시하고 기본값 */ }
    return migrate(normalize(seed()));
  }

  function myAgent() {
    return state.agents.find((a) => a.id === myId) || state.agents[0] || null;
  }
  function agentByName(name) {
    return state.agents.find((a) => a.name === name) || null;
  }

  /* ---------------- 저장 / 동기화 ---------------- */
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('pjo-bus') : null;
  let flushTimer = null;

  function mark(col, id) { if (id) dirty[col].add(id); }

  function save(cols) {
    try { localStorage.setItem(LS_STATE, JSON.stringify(state)); } catch (e) { }
    (cols || []).forEach((c) => mark(c, null));
    if (bc) { try { bc.postMessage({ type: 'state', state: state }); } catch (e) { } }
    if (adapter) {
      clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, 220);
    }
    render();
  }

  function flush() {
    if (!adapter) { dirty.agents.clear(); dirty.messages.clear(); dirty.tasks.clear(); removed.agents = []; removed.messages = []; removed.tasks = []; return; }
    const payload = { agents: [], messages: [], tasks: [] };
    ['agents', 'messages', 'tasks'].forEach((k) => {
      dirty[k].forEach((id) => {
        const rec = state[k].find((x) => x.id === id);
        if (rec) payload[k].push(rec);
      });
      dirty[k].clear();
    });
    const dels = { agents: removed.agents.slice(), messages: removed.messages.slice(), tasks: removed.tasks.slice() };
    removed.agents = []; removed.messages = []; removed.tasks = [];
    if (payload.agents.length || payload.messages.length || payload.tasks.length || dels.agents.length || dels.messages.length || dels.tasks.length) {
      try { adapter.push(payload, dels); } catch (e) { }
    }
  }

  if (bc) {
    bc.onmessage = (e) => {
      if (!e.data) return;
      if (e.data.type === 'reset') {
        state = normalize(e.data.state);
        tomb.clear();
        try { localStorage.setItem(LS_STATE, JSON.stringify(state)); } catch (err) { }
        render();
        return;
      }
      if (e.data.type !== 'state') return;
      if (mergeRemote(e.data.state)) render();
    };
  }
  window.addEventListener('storage', (e) => {
    if (e.key !== LS_STATE || !e.newValue) return;
    try { if (mergeRemote(JSON.parse(e.newValue))) render(); } catch (err) { }
  });

  function normRec(rec, col) {
    if (!rec || typeof rec !== 'object') return null;
    if (!rec.id) return null;
    const out = {
      id: String(rec.id),
      updated_at: rec.updated_at || rec.created_at || nowISO()
    };
    if (col === 'agents') {
      out.name = String(rec.name || '피클');
      out.owner = String(rec.owner || '');
      out.handle = String(rec.handle || '');
      out.color = String(rec.color || '#6EE7B7');
      out.consonant = String(rec.consonant || 'ㄱ');
      out.room = ['office', 'meeting', 'work'].indexOf(rec.room) >= 0 ? rec.room : 'office';
      out.status = String(rec.status || '');
      out.x = isNaN(+rec.x) ? 50 : clamp(+rec.x, 4, 96);
      out.y = isNaN(+rec.y) ? 50 : clamp(+rec.y, 6, 94);
    } else if (col === 'messages') {
      out.room = String(rec.room || 'meeting');
      out.sender_name = String(rec.sender_name || '피클');
      out.sender_handle = String(rec.sender_handle || '');
      out.text = String(rec.text || '');
      out.created_at = rec.created_at || out.updated_at;
    } else {
      out.title = String(rec.title || '');
      out.assignee = String(rec.assignee || '');
      out.status = COLS.indexOf(rec.status) >= 0 ? rec.status : '대기';
    }
    return out;
  }

  // 원격 데이터(배열 또는 Firebase 객체맵) 병합
  function mergeRemote(incoming) {
    if (!incoming) return false;
    let changed = false;
    ['agents', 'messages', 'tasks'].forEach((col) => {
      let list = incoming[col];
      if (!list) return;
      if (!Array.isArray(list)) {
        list = Object.keys(list).map((k) => {
          const v = list[k];
          if (!v || typeof v !== 'object') return null;
          return Object.assign({ id: k }, v);
        }).filter(Boolean);
      }
      list.forEach((raw) => {
        const rec = normRec(raw, col);
        if (!rec || tomb.has(rec.id)) return;
        const i = state[col].findIndex((x) => x.id === rec.id);
        if (i < 0) { state[col].push(rec); changed = true; return; }
        const cur = state[col][i];
        const a = String(rec.updated_at || rec.created_at || '');
        const b = String(cur.updated_at || cur.created_at || '');
        if (a >= b) {
          if (JSON.stringify(cur) !== JSON.stringify(Object.assign({}, cur, rec))) changed = true;
          state[col][i] = Object.assign({}, cur, rec);
        }
      });
    });
    if (changed) {
      try { localStorage.setItem(LS_STATE, JSON.stringify(state)); } catch (e) { }
    }
    return changed;
  }

  /* ---------------- 어댑터: Firebase RTDB ---------------- */
  function firebaseAdapter(url, token) {
    const base = url.replace(/\/+$/, '');
    const root = base + '/pickleJointOffice.json';
    const auth = token ? '?auth=' + encodeURIComponent(token) : '';
    let timer = null, stopped = false;

    async function pull() {
      if (stopped) return;
      try {
        const res = await fetch(root + (token ? '?auth=' + encodeURIComponent(token) : ''), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        setDb('on');
        if (data && mergeRemote(data)) render();
      } catch (e) {
        setDb('error', 'Firebase 응답 없음 — URL과 규칙(.read/.write)을 확인해 주세요');
      }
    }
    pull();
    timer = setInterval(pull, 4000);

    return {
      kind: 'firebase',
      push(payload, dels) {
        ['agents', 'messages', 'tasks'].forEach((col) => {
          payload[col].forEach((rec) => {
            fetch(base + '/pickleJointOffice/' + col + '/' + encodeURIComponent(rec.id) + '.json' + (token ? '?auth=' + encodeURIComponent(token) : ''), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(rec)
            }).then(() => setDb('on')).catch(() => setDb('error', 'Firebase 저장 실패 — 규칙을 확인해 주세요'));
          });
          (dels[col] || []).forEach((id) => {
            fetch(base + '/pickleJointOffice/' + col + '/' + encodeURIComponent(id) + '.json' + (token ? '?auth=' + encodeURIComponent(token) : ''), { method: 'DELETE' }).catch(() => { });
          });
        });
      },
      stop() { stopped = true; clearInterval(timer); }
    };
  }

  /* ---------------- 어댑터: Google Apps Script → Sheets ---------------- */
  function gasAdapter(url) {
    let timer = null, stopped = false;
    async function pull() {
      if (stopped) return;
      try {
        const res = await fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=all&t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        setDb('on');
        const body = data && data.data ? data.data : data;
        if (body && mergeRemote(body)) render();
      } catch (e) {
        setDb('error', 'Apps Script 응답 없음 — 배포 권한(모든 사용자)을 확인해 주세요');
      }
    }
    pull();
    timer = setInterval(pull, 5000);

    return {
      kind: 'gas',
      push(payload, dels) {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'upsert', data: payload, remove: dels })
        }).then(() => setDb('on')).catch(() => { setDb('wait', '전송은 보냈지만 응답을 못 받았어요 (시트에서 확인됩니다)'); });
      },
      stop() { stopped = true; clearInterval(timer); }
    };
  }

  function setDb(status, msg) {
    dbStatus = status;
    const dot = $('#db-dot');
    if (dot) {
      dot.className = 'dot ' + (status === 'on' ? 'on' : status === 'error' ? 'off' : status === 'wait' ? 'wait' : 'off');
    }
    const note = $('#db-state-note');
    if (note) {
      if (status === 'on') note.className = 'note ok', note.innerHTML = '<b>연결됨</b> — ' + (adapter && adapter.kind === 'firebase' ? 'Firebase Realtime Database' : 'Google Sheets') + ' 와 실시간으로 주고받는 중입니다.';
      else if (status === 'error') note.className = 'note warn', note.innerHTML = '<b>연결 오류</b> — ' + esc(msg || 'URL을 확인해 주세요');
      else if (status === 'wait') note.className = 'note warn', note.innerHTML = '<b>확인 중</b> — ' + esc(msg || '잠시만 기다려 주세요');
      else note.className = 'note', note.innerHTML = '지금은 <b>로컬 모드</b>입니다. 이 브라우저(탭 여러 개 포함)에서만 데이터가 공유됩니다.';
    }
    if (msg && status === 'error') toast(msg);
  }

  function connectDb(kind, url, token) {
    disconnectDb(true);
    try {
      adapter = kind === 'firebase' ? firebaseAdapter(url, token) : gasAdapter(url);
      cfg = { kind: kind, url: url, token: token || '' };
      localStorage.setItem(LS_CFG, JSON.stringify(cfg));
      setDb('wait', '연결 중…');
      // 현재 데이터 올리기
      ['agents', 'messages', 'tasks'].forEach((c) => state[c].forEach((r) => dirty[c].add(r.id)));
      clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, 600);
      toast('실시간 DB에 연결했어요');
      render();
    } catch (e) {
      setDb('error', '주소 형식을 확인해 주세요');
    }
  }
  function disconnectDb(silent) {
    if (adapter && adapter.stop) adapter.stop();
    adapter = null;
    if (!silent) {
      cfg = {};
      localStorage.removeItem(LS_CFG);
      setDb('off');
      toast('로컬 모드로 돌아왔어요');
      render();
    }
  }

  /* ---------------- 화면 ---------------- */
  function toast(msg) {
    const wrap = $('#toasts');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2200);
    setTimeout(() => el.remove(), 2600);
  }

  function switchView(v) {
    view = v;
    $$('.view').forEach((el) => el.classList.toggle('active', el.id === 'view-' + v));
    $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function render() {
    renderTop();
    renderOffice();
    renderPeople();
    renderMeeting();
    renderWork();
  }

  function renderTop() {
    const me = myAgent();
    if (me) {
      $('#me-avatar').textContent = me.consonant;
      $('#me-avatar').style.setProperty('--c', me.color);
      $('#me-name').textContent = me.name;
      const inp = $('#status-input');
      if (inp && document.activeElement !== inp) inp.value = me.status || '';
    }
  }

  /* ---- 오피스 맵 ---- */
  function renderOffice() {
    const layer = $('#agents-layer');
    if (!layer) return;
    const inOffice = state.agents.filter((a) => a.room === 'office');
    const seen = new Set();

    inOffice.forEach((a) => {
      seen.add(a.id);
      let el = layer.querySelector('[data-id="' + a.id + '"]');
      if (!el) {
        el = document.createElement('div');
        el.className = 'agent';
        el.dataset.id = a.id;
        el.innerHTML = '<div class="bubble"></div><div class="body"></div><div class="name"></div>';
        el.querySelector('.body').addEventListener('click', (ev) => { ev.stopPropagation(); openAgent(a.id); });
        layer.appendChild(el);
      }
      el.style.left = a.x + '%';
      el.style.top = a.y + '%';
      el.style.setProperty('--c', a.color);
      el.classList.toggle('me', a.id === myId);
      const b = el.querySelector('.body');
      if (b.textContent !== a.consonant) b.textContent = a.consonant;
      const nm = el.querySelector('.name');
      if (nm.textContent !== a.name) nm.textContent = a.name;
      const bub = el.querySelector('.bubble');
      bub.textContent = a.status || '';
      bub.classList.toggle('show', !!a.status);
      el.title = a.name + (a.owner ? ' (' + a.owner + ')' : '') + (a.status ? ' — ' + a.status : '');
    });
    Array.prototype.slice.call(layer.children).forEach((el) => {
      if (!seen.has(el.dataset.id)) el.remove();
    });
  }

  function renderPeople() {
    const box = $('#people');
    if (!box) return;
    $('#people-count').textContent = state.agents.length + '명';
    box.innerHTML = state.agents.map((a) => {
      const on = ['meeting', 'work'].indexOf(a.room) >= 0;
      return '<div class="person' + (a.id === myId ? ' me' : '') + '" data-agent="' + a.id + '">' +
        '<span class="avatar-sm" style="--c:' + esc(a.color) + '">' + esc(a.consonant) + '</span>' +
        '<div class="info"><div class="n">' + esc(a.name) +
        (a.id === myId ? '<span class="tag" style="padding:0 4px;font-size:9px;color:var(--mint)">나</span>' : '') +
        '</div><div class="s">' + (on ? '📍 ' + ROOMNAME[a.room] + ' · ' : '') + esc(a.status || '상태 없음') + '</div></div>' +
        '</div>';
    }).join('') || '<p class="hint">아직 피클이 없어요. ＋ 새 피클로 초대해 보세요.</p>';
  }

  /* ---- 회의실 ---- */
  function renderMeeting() {
    // 안건
    const ag = state.tasks.filter((t) => t.assignee === '회의실');
    const agBox = $('#agenda');
    if (agBox) {
      agBox.innerHTML = ag.length ? ag.map((t) =>
        '<label class="agenda-item' + (t.status === '완료' ? ' done' : '') + '">' +
        '<input type="checkbox" data-agenda="' + t.id + '"' + (t.status === '완료' ? ' checked' : '') + '>' +
        '<span class="t">' + esc(t.title) + '</span></label>'
      ).join('') : '<p class="hint">아직 안건이 없어요. 아래에 첫 안건을 적어 보세요.</p>';
      $('#agenda-count').textContent = ag.filter((t) => t.status !== '완료').length + ' / ' + ag.length;
    }

    // 회의 장면
    const box = $('#meeting-agents');
    if (box) {
      const mem = state.agents.filter((a) => a.room === 'meeting');
      box.innerHTML = mem.length ? '' : '<div style="position:absolute;left:50%;top:86%;transform:translateX(-50%);font-size:12px;color:var(--muted);text-align:center;width:90%">아직 회의실이 비어 있어요. 오른쪽 위 <b>[＋ 피클 부르기]</b> 또는 오피스에서 캐릭터를 보내 보세요.</div>';
      mem.forEach((a, i) => {
        const n = Math.max(mem.length, 3);
        const ang = (-Math.PI / 2) + (i * (Math.PI * 2 / n));
        const left = 50 + Math.cos(ang) * 30;
        const top = 52 + Math.sin(ang) * 27;
        box.insertAdjacentHTML('beforeend',
          '<div class="magent" data-agent="' + a.id + '" style="left:' + left + '%;top:' + top + '%;--c:' + esc(a.color) + '">' +
          '<div class="bub' + (a.status ? ' show' : '') + '">' + esc(a.status || '') + '</div>' +
          '<div class="body">' + esc(a.consonant) + '</div>' +
          '<div class="nm">' + esc(a.name) + '</div></div>');
      });
    }

    // 채팅
    const chat = $('#meeting-chat');
    if (chat) {
      const list = state.messages.filter((m) => m.room === 'meeting').sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)));
      const atBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40;
      chat.innerHTML = list.map((m) => {
        const a = agentByName(m.sender_name);
        const color = a ? a.color : '#8fa3c8';
        const con = a ? a.consonant : '·';
        return '<div class="msg' + (m.sender_name === (myAgent() || {}).name ? ' mine' : '') + '">' +
          '<span class="av" style="--c:' + esc(color) + '">' + esc(con) + '</span>' +
          '<div><div class="who"><b>' + esc(m.sender_name) + '</b><span>' + esc(relTime(m.created_at)) + '</span></div>' +
          '<div class="bub">' + esc(m.text) + '</div></div></div>';
      }).join('') || '<p class="hint">첫 발언을 남겨 보세요.</p>';
      if (atBottom) chat.scrollTop = chat.scrollHeight;
    }
  }

  /* ---- 작업실 ---- */
  function renderWork() {
    const board = state.tasks.filter((t) => t.assignee !== '회의실');
    $$('#kanban .col').forEach((col) => {
      const st = col.dataset.status;
      const items = board.filter((t) => t.status === st);
      const body = col.querySelector('.col-b');
      col.querySelector('[data-cnt]').textContent = items.length;
      body.innerHTML = items.map((t) => {
        const a = agentByName(t.assignee);
        const color = a ? a.color : '#8fa3c8';
        const con = a ? a.consonant : '·';
        const idx = COLS.indexOf(t.status);
        return '<div class="card' + (t.status === '완료' ? ' done' : '') + '" draggable="true" data-task="' + t.id + '">' +
          '<div class="t">' + esc(t.title) + '</div>' +
          '<div class="foot"><span class="who" style="--c:' + esc(color) + '"><span class="av">' + esc(con) + '</span>' + esc(t.assignee) + '</span>' +
          '<span class="moves">' +
          (idx > 0 ? '<button data-move="' + t.id + '" data-to="' + COLS[idx - 1] + '" title="이전 단계">◀</button>' : '') +
          (idx < 2 ? '<button data-move="' + t.id + '" data-to="' + COLS[idx + 1] + '" title="다음 단계">▶</button>' : '') +
          '<button data-del="' + t.id + '" title="삭제">🗑</button>' +
          '</span></div></div>';
      }).join('') || '<p class="hint" style="margin:4px 2px">비어 있어요</p>';
    });

    const sel = $('#task-assignee');
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = state.agents.map((a) => '<option value="' + esc(a.name) + '">' + esc(a.name) + '</option>').join('');
      if (cur && state.agents.some((a) => a.name === cur)) sel.value = cur;
      else if (myAgent()) sel.value = myAgent().name;
    }

    const log = $('#worklog');
    if (log) {
      const list = state.messages.filter((m) => m.room === 'worklog').sort((x, y) => String(y.created_at).localeCompare(String(x.created_at))).slice(0, 60);
      $('#log-count').textContent = list.length + '건';
      log.innerHTML = list.map((m) =>
        '<div class="log-item"><span class="who">' + esc(m.sender_name) + '</span><span>' + esc(m.text) + '</span>' +
        '<span class="tm">' + esc(relTime(m.created_at)) + '</span></div>'
      ).join('') || '<p class="hint" style="margin:4px 2px">아직 기록이 없어요.</p>';
    }
  }

  /* ---------------- 데이터 변경 헬퍼 ---------------- */
  function addLog(text) {
    const me = myAgent();
    const m = { id: uid('m'), room: 'worklog', sender_name: me ? me.name : '피클', sender_handle: me ? me.handle : '', text: text, created_at: nowISO() };
    state.messages.push(m);
    mark('messages', m.id);
    return m;
  }
  function addChat(text) {
    const me = myAgent();
    const m = { id: uid('m'), room: 'meeting', sender_name: me ? me.name : '피클', sender_handle: me ? me.handle : '', text: text, created_at: nowISO() };
    state.messages.push(m);
    mark('messages', m.id);
    return m;
  }
  function updateAgent(id, patch) {
    const a = state.agents.find((x) => x.id === id);
    if (!a) return;
    Object.assign(a, patch, { updated_at: nowISO() });
    mark('agents', id);
  }
  function updateTask(id, patch, logText) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch, { updated_at: nowISO() });
    mark('tasks', id);
    if (logText) addLog(logText);
  }

  /* ---------------- 모달 ---------------- */
  function openModal(id) { $('#' + id).classList.add('open'); }
  function closeModal(el) { el.classList.remove('open'); }
  $$('.modal-bg').forEach((bg) => {
    bg.addEventListener('click', (e) => { if (e.target === bg) closeModal(bg); });
  });
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => closeModal(b.closest('.modal-bg'))));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $$('.modal-bg.open').forEach(closeModal);
  });

  /* --- 내 피클 --- */
  function openMe() {
    const box = $('#pick-list');
    box.innerHTML = state.agents.map((a) =>
      '<div class="pick' + (a.id === myId ? ' sel' : '') + '" data-pick="' + a.id + '">' +
      '<span class="av" style="--c:' + esc(a.color) + '">' + esc(a.consonant) + '</span>' +
      '<div><div class="nm">' + esc(a.name) + '</div><div class="ow">' + esc(a.owner || '주인 없음') + ' · ' + esc(a.handle || '핸들 없음') + '</div></div>' +
      (a.id === myId ? '<span class="badge">내 피클</span>' : '') +
      '</div>').join('');
    $$('#pick-list .pick').forEach((el) => el.addEventListener('click', () => {
      myId = el.dataset.pick;
      localStorage.setItem(LS_MY, myId);
      closeModal($('#modal-me'));
      save(['agents']);
      toast('이제 ' + (myAgent() || {}).name + '(으)로 활동해요');
    }));
    openModal('modal-me');
  }

  /* --- 새 피클 --- */
  let newConsonant = 'ㅅ';
  let newColor = PALETTE[4];
  function openNew() {
    const used = state.agents.map((a) => a.consonant);
    newConsonant = CONS.find((c) => used.indexOf(c) < 0) || CONS[state.agents.length % CONS.length];
    newColor = PALETTE[state.agents.length % PALETTE.length];
    $('#new-name').value = '';
    $('#new-owner').value = '';
    $('#new-handle').value = '';
    $('#new-as-me').checked = true;
    drawCons();
    drawSwatches();
    openModal('modal-new');
    setTimeout(() => $('#new-name').focus(), 60);
  }
  function drawCons() {
    $('#cons-grid').innerHTML = CONS.map((c) =>
      '<div class="cons' + (c === newConsonant ? ' sel' : '') + '" data-cons="' + c + '">' + c + '</div>').join('');
    $$('#cons-grid .cons').forEach((el) => el.addEventListener('click', () => { newConsonant = el.dataset.cons; drawCons(); }));
  }
  function drawSwatches() {
    $('#swatches').innerHTML = PALETTE.map((c) =>
      '<div class="sw' + (c.toLowerCase() === newColor.toLowerCase() ? ' sel' : '') + '" data-color="' + c + '" style="background:' + c + '"></div>').join('');
    $$('#swatches .sw').forEach((el) => el.addEventListener('click', () => { newColor = el.dataset.color; $('#new-color').value = newColor; drawSwatches(); }));
    $('#new-color').value = newColor;
  }

  $('#new-color').addEventListener('input', (e) => { newColor = e.target.value; drawSwatches(); });

  $('#btn-create-agent').addEventListener('click', () => {
    const name = $('#new-name').value.trim();
    if (!name) { toast('피클 이름을 적어 주세요'); $('#new-name').focus(); return; }
    if (state.agents.some((a) => a.name === name)) { toast('같은 이름의 피클이 이미 있어요'); return; }
    const a = {
      id: uid('a'),
      name: name,
      owner: $('#new-owner').value.trim(),
      handle: $('#new-handle').value.trim(),
      color: newColor,
      consonant: newConsonant,
      room: 'office',
      status: '새로 입장했어요!',
      x: 14 + Math.random() * 24,
      y: 34 + Math.random() * 34,
      updated_at: nowISO()
    };
    state.agents.push(a);
    mark('agents', a.id);
    addLog(name + ' 피클이 사무실에 입장했어요.');
    if ($('#new-as-me').checked) { myId = a.id; localStorage.setItem(LS_MY, myId); }
    closeModal($('#modal-new'));
    save(['agents', 'messages']);
    toast(name + ' 입장 완료!');
  });

  /* --- 캐릭터 카드 --- */
  let agentModalId = null;
  function openAgent(id) {
    const a = state.agents.find((x) => x.id === id);
    if (!a) return;
    agentModalId = id;
    $('#agent-dot').style.background = a.color;
    $('#agent-title').textContent = a.name + (a.owner ? ' · ' + a.owner : '');
    $('#agent-card').innerHTML =
      '<span class="avatar-sm" style="--c:' + esc(a.color) + ';width:44px;height:40px;font-size:20px;border-radius:8px 8px 4px 4px">' + esc(a.consonant) + '</span>' +
      '<div><div style="font-family:var(--font-pixel);font-size:13px">' + esc(a.handle || '핸들 없음') + '</div>' +
      '<div class="hint">' + esc(ROOMNAME[a.room] || '오피스') + ' · 최근 변경 ' + esc(relTime(a.updated_at)) + '</div></div>';
    $('#agent-status').value = a.status || '';
    openModal('modal-agent');
  }
  $('#btn-agent-save').addEventListener('click', () => {
    if (!agentModalId) return;
    updateAgent(agentModalId, { status: $('#agent-status').value.trim().slice(0, 40) });
    closeModal($('#modal-agent'));
    save(['agents']);
    toast('상태를 저장했어요');
  });
  $('#btn-agent-asme').addEventListener('click', () => {
    if (!agentModalId) return;
    myId = agentModalId;
    localStorage.setItem(LS_MY, myId);
    closeModal($('#modal-agent'));
    save(['agents']);
    toast('이제 ' + (myAgent() || {}).name + '(으)로 활동해요');
  });
  $('#btn-agent-delete').addEventListener('click', () => {
    if (!agentModalId) return;
    const a = state.agents.find((x) => x.id === agentModalId);
    if (!a) return;
    if (!window.confirm(a.name + ' 피클을 사무실에서 내보낼까요?')) return;
    state.agents = state.agents.filter((x) => x.id !== agentModalId);
    tomb.add(agentModalId);
    removed.agents.push(agentModalId);
    if (myId === agentModalId) {
      myId = state.agents[0] ? state.agents[0].id : null;
      if (myId) localStorage.setItem(LS_MY, myId);
    }
    addLog(a.name + ' 피클이 사무실을 떠났어요.');
    closeModal($('#modal-agent'));
    save(['agents', 'messages']);
  });
  $$('#modal-agent [data-send]').forEach((b) => b.addEventListener('click', () => {
    if (!agentModalId) return;
    const room = b.dataset.send;
    updateAgent(agentModalId, { room: room });
    closeModal($('#modal-agent'));
    save(['agents']);
    if (room === 'meeting') switchView('meeting');
    if (room === 'work') switchView('work');
  }));

  /* ---------------- 이벤트: 공통 ---------------- */
  $$('.nav-btn').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
  $$('[data-goto]').forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); switchView(el.dataset.goto); }));
  $('#btn-me').addEventListener('click', openMe);
  $('#btn-new-agent').addEventListener('click', openNew);
  $('#btn-new-agent-2').addEventListener('click', () => { closeModal($('#modal-me')); openNew(); });

  if (ui.bannerClosed) $('#banner').style.display = 'none';
  $('#btn-banner-close').addEventListener('click', () => {
    ui.bannerClosed = true;
    localStorage.setItem(LS_UI, JSON.stringify(ui));
    $('#banner').style.display = 'none';
  });

  /* 지도 클릭 → 내 피클 이동 */
  $('#map').addEventListener('click', (e) => {
    if (e.target.closest('.door')) return;
    const me = myAgent();
    if (!me) { toast('먼저 내 피클을 골라 주세요'); openMe(); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 4, 96);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 7, 93);
    updateAgent(me.id, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, room: 'office' });
    save(['agents']);
  });

  /* 상태 한마디 */
  $('#status-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const me = myAgent();
    if (!me) { openMe(); return; }
    updateAgent(me.id, { status: $('#status-input').value.trim().slice(0, 40) });
    save(['agents']);
    toast('상태를 바꿨어요');
  });

  /* 참가자 목록 클릭 */
  $('#people').addEventListener('click', (e) => {
    const p = e.target.closest('[data-agent]');
    if (p) openAgent(p.dataset.agent);
  });

  /* 회의 소집 */
  $('#btn-call-meeting').addEventListener('click', () => {
    state.agents.forEach((a) => updateAgent(a.id, { room: 'meeting' }));
    addLog('회의가 소집되어 모두 회의실로 모였어요.');
    save(['agents', 'messages']);
    switchView('meeting');
    toast('모두 회의실로 모였어요');
  });

  /* 회의실: 피클 부르기 */
  $('#btn-add-to-meeting').addEventListener('click', () => {
    const me = myAgent();
    if (!me) { openMe(); return; }
    updateAgent(me.id, { room: 'meeting' });
    save(['agents']);
    toast(me.name + ' 피클이 회의실로 들어왔어요');
  });
  $('#meeting-agents').addEventListener('click', (e) => {
    const el = e.target.closest('[data-agent]');
    if (el) openAgent(el.dataset.agent);
  });

  /* 회의 채팅 */
  $('#meeting-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#meeting-input');
    const text = inp.value.trim();
    if (!text) return;
    addChat(text);
    inp.value = '';
    save(['messages']);
  });

  /* 안건 */
  $('#agenda-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#agenda-input');
    const title = inp.value.trim();
    if (!title) return;
    const t = { id: uid('t'), title: title, assignee: '회의실', status: '대기', updated_at: nowISO() };
    state.tasks.push(t);
    mark('tasks', t.id);
    inp.value = '';
    save(['tasks']);
  });
  $('#agenda').addEventListener('change', (e) => {
    const cb = e.target.closest('[data-agenda]');
    if (!cb) return;
    updateTask(cb.dataset.agenda, { status: cb.checked ? '완료' : '대기' });
    save(['tasks']);
  });

  /* 작업 등록 */
  $('#task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#task-title').value.trim();
    if (!title) return;
    const t = {
      id: uid('t'), title: title,
      assignee: $('#task-assignee').value || (myAgent() || {}).name || '도아',
      status: $('#task-status').value, updated_at: nowISO()
    };
    state.tasks.push(t);
    mark('tasks', t.id);
    addLog(t.assignee + ' — 새 작업 "' + title + '" 등록');
    $('#task-title').value = '';
    save(['tasks', 'messages']);
    toast('작업을 올렸어요');
  });

  /* 칸반 이동/삭제 */
  $('#kanban').addEventListener('click', (e) => {
    const mv = e.target.closest('[data-move]');
    if (mv) {
      const t = state.tasks.find((x) => x.id === mv.dataset.move);
      if (!t) return;
      const to = mv.dataset.to;
      updateTask(t.id, { status: to }, t.assignee + ' — "' + t.title + '" → ' + to);
      save(['tasks', 'messages']);
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const t = state.tasks.find((x) => x.id === del.dataset.del);
      if (!t) return;
      if (!window.confirm('"' + t.title + '" 작업을 지울까요?')) return;
      state.tasks = state.tasks.filter((x) => x.id !== t.id);
      tomb.add(t.id);
      removed.tasks.push(t.id);
      addLog(t.assignee + ' — 작업 "' + t.title + '" 삭제');
      save(['tasks', 'messages']);
    }
  });

  /* 드래그 앤 드롭 */
  let dragId = null;
  $('#kanban').addEventListener('dragstart', (e) => {
    const card = e.target.closest('[data-task]');
    if (!card) return;
    dragId = card.dataset.task;
    card.classList.add('dragging');
    try { e.dataTransfer.setData('text/plain', dragId); } catch (err) { }
    e.dataTransfer.effectAllowed = 'move';
  });
  $('#kanban').addEventListener('dragend', () => {
    dragId = null;
    $$('#kanban .card.dragging').forEach((c) => c.classList.remove('dragging'));
    $$('#kanban .col.drop').forEach((c) => c.classList.remove('drop'));
  });
  $$('#kanban .col').forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop'); });
    col.addEventListener('dragleave', () => col.classList.remove('drop'));
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drop');
      const id = dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
      if (!id) return;
      const t = state.tasks.find((x) => x.id === id);
      if (!t) return;
      const to = col.dataset.status;
      if (t.status === to) return;
      updateTask(t.id, { status: to }, t.assignee + ' — "' + t.title + '" → ' + to);
      save(['tasks', 'messages']);
    });
  });

  /* 작업 로그 */
  $('#worklog-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#worklog-input');
    const text = inp.value.trim();
    if (!text) return;
    addLog(text);
    inp.value = '';
    save(['messages']);
  });

  /* ---------------- 실시간 DB 모달 ---------------- */
  let dbTab = 'firebase';
  $('#btn-db').addEventListener('click', () => {
    if (cfg && cfg.kind) {
      dbTab = cfg.kind;
      if (cfg.kind === 'firebase') $('#db-url').value = cfg.url || '' , $('#db-token').value = cfg.token || '';
      else $('#gas-url').value = cfg.url || '';
    }
    setDbTab(dbTab);
    setDb(dbStatus === 'off' ? 'off' : dbStatus);
    openModal('modal-db');
  });
  function setDbTab(t) {
    dbTab = t;
    $$('[data-dbtab]').forEach((b) => b.classList.toggle('active', b.dataset.dbtab === t));
    $('#dbtab-firebase').style.display = t === 'firebase' ? '' : 'none';
    $('#dbtab-gas').style.display = t === 'gas' ? '' : 'none';
  }
  $$('[data-dbtab]').forEach((b) => b.addEventListener('click', () => setDbTab(b.dataset.dbtab)));
  $('#btn-db-connect').addEventListener('click', () => {
    if (dbTab === 'firebase') {
      const url = $('#db-url').value.trim().replace(/\/+$/, '').replace(/\.json$/, '');
      if (!/^https?:\/\/.+/.test(url)) { toast('Firebase DB URL을 넣어 주세요'); return; }
      connectDb('firebase', url, $('#db-token').value.trim());
    } else {
      const url = $('#gas-url').value.trim();
      if (!/^https?:\/\/.+/.test(url)) { toast('Apps Script 웹앱 URL을 넣어 주세요'); return; }
      connectDb('gas', url, '');
    }
    closeModal($('#modal-db'));
  });
  $('#btn-db-disconnect').addEventListener('click', () => { disconnectDb(false); closeModal($('#modal-db')); });
  $('#btn-db-reset').addEventListener('click', () => {
    if (!window.confirm('이 브라우저의 합동 비서실 데이터를 처음 상태로 되돌릴까요? (시트/DB의 데이터는 그대로입니다)')) return;
    state = normalize(seed());
    tomb.clear();
    myId = state.agents[0].id;
    localStorage.setItem(LS_MY, myId);
    localStorage.setItem(LS_STATE, JSON.stringify(state));
    if (bc) { try { bc.postMessage({ type: 'reset', state: state }); } catch (e) { } }
    render();
    toast('초기 상태로 돌렸어요');
    closeModal($('#modal-db'));
  });

  /* ---------------- 시작 ---------------- */
  if (cfg && cfg.kind && cfg.url) {
    adapter = cfg.kind === 'firebase' ? firebaseAdapter(cfg.url, cfg.token) : gasAdapter(cfg.url);
  } else {
    setDb('off');
  }
  if (!localStorage.getItem(LS_STATE)) {
    // 처음 방문: 시드 데이터를 저장해 둔다
    localStorage.setItem(LS_STATE, JSON.stringify(state));
  }
  render();
  setDb(cfg && cfg.kind ? 'wait' : 'off');

  // 다른 탭의 변경을 주기적으로 확인(브로드캐스트가 막힌 환경 대비)
  setInterval(() => {
    if (document.hidden) return;
    try {
      const raw = localStorage.getItem(LS_STATE);
      if (raw && mergeRemote(JSON.parse(raw))) render();
    } catch (e) { }
  }, 4000);

  // 사용 팁
  setTimeout(() => { if (!ui.welcomed) { toast('환영해요! 바닥을 눌러 내 피클을 움직여 보세요'); ui.welcomed = true; localStorage.setItem(LS_UI, JSON.stringify(ui)); } }, 900);

  window.PJO = { get state() { return state; }, save: save, render: render };
})();
