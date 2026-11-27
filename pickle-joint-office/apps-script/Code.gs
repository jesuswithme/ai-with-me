/**
 * 피클 합동 비서실 — Google Apps Script 백엔드
 * 구글 시트 '피클 합동 비서실 DB'를 실시간 DB처럼 써 주는 웹앱입니다.
 *
 * ── 설치 ─────────────────────────────────────────────
 * 1) '피클 합동 비서실 DB' 스프레드시트를 연다
 *    https://docs.google.com/spreadsheets/d/1C-ZsCCMKwk7J3GScNl8Wl1C6jQNwtQ_xEC-3KdOsTgM/edit
 * 2) 확장 프로그램 → Apps Script → 이 파일 내용 전체를 붙여 넣고 저장
 * 3) 배포 → 새 배포 → 유형: 웹 앱
 *      · 다음 사용자로 실행: 나
 *      · 액세스 권한: 모든 사용자
 *    → 배포 후 나오는 '웹 앱 URL'(…/exec)을 복사
 * 4) 합동 비서실 페이지 → [실시간 DB 연결] → Google Sheets 탭 → URL 붙여 넣기 → 연결
 *
 * ── API ──────────────────────────────────────────────
 * GET  ?action=all                → {ok, data:{agents:[], messages:[], tasks:[]}}
 * POST {action:'upsert', data:{...}, remove:{...}}  → 변경 저장
 * ─────────────────────────────────────────────────────
 */

var SHEET_ID = '1C-ZsCCMKwk7J3GScNl8Wl1C6jQNwtQ_xEC-3KdOsTgM';

var SCHEMA = {
  agents: ['id', 'name', 'owner', 'handle', 'color', 'consonant', 'room', 'status', 'x', 'y', 'updated_at'],
  messages: ['id', 'room', 'sender_name', 'sender_handle', 'text', 'created_at'],
  tasks: ['id', 'title', 'assignee', 'status', 'updated_at']
};

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'all';
  try {
    if (action === 'ping') return json({ ok: true, message: 'pong' });
    return json({ ok: true, data: readAll() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ ok: false, error: 'JSON 파싱 실패: ' + String(err) });
  }
  try {
    if (payload.action === 'upsert' || payload.action === 'save') {
      var result = upsertAll(payload.data || {}, payload.remove || {});
      return json({ ok: true, updated: result });
    }
    return json({ ok: false, error: '알 수 없는 action: ' + payload.action });
  } catch (err2) {
    return json({ ok: false, error: String(err2) });
  }
}

/* ── 읽기 ─────────────────────────────────────────── */
function readAll() {
  var out = {};
  Object.keys(SCHEMA).forEach(function (name) {
    out[name] = readSheet(name);
  });
  return out;
}

function getSheet(name) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(SCHEMA[name]);
  }
  return sh;
}

function readSheet(name) {
  var sh = getSheet(name);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var cols = SCHEMA[name];
  var width = Math.max(sh.getLastColumn(), cols.length);
  var values = sh.getRange(1, 1, lastRow, width).getValues();
  var header = values.shift().map(function (h) { return String(h).trim(); });
  var rows = [];
  values.forEach(function (row) {
    var obj = {};
    var empty = true;
    for (var i = 0; i < header.length; i++) {
      var key = header[i];
      if (!key) continue;
      var v = row[i];
      if (v instanceof Date) v = v.toISOString();
      obj[key] = v;
      if (v !== '' && v !== null && v !== undefined) empty = false;
    }
    if (!empty && obj.id) rows.push(obj);
  });
  return rows;
}

/* ── 쓰기 ─────────────────────────────────────────── */
function upsertAll(data, remove) {
  var report = {};
  Object.keys(SCHEMA).forEach(function (name) {
    var list = data[name] || [];
    var dels = (remove && remove[name]) || [];
    report[name] = upsertSheet(name, list, dels);
  });
  return report;
}

function upsertSheet(name, records, removeIds) {
  var sh = getSheet(name);
  var cols = SCHEMA[name];
  var lastRow = sh.getLastRow();
  var width = Math.max(sh.getLastColumn(), cols.length);

  // 헤더 정리
  var header = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim(); });
  if (header.join('') === '') {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]);
    header = cols.slice();
  }

  var values = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, width).getValues() : [];
  var index = {};
  values.forEach(function (row, i) {
    var id = String(row[header.indexOf('id')] || '').trim();
    if (id) index[id] = i;
  });

  var stamped = (name === 'messages') ? 'created_at' : 'updated_at';
  var count = 0;

  (records || []).forEach(function (rec) {
    if (!rec || !rec.id) return;
    var id = String(rec.id);
    var rowVals = header.map(function (key) {
      var v = rec[key];
      return (v === undefined || v === null) ? '' : v;
    });
    if (index[id] !== undefined) {
      var i = index[id];
      var oldTs = String(values[i][header.indexOf(stamped)] || '');
      var newTs = String(rec[stamped] || rec.updated_at || rec.created_at || '');
      if (oldTs && newTs && oldTs > newTs) return; // 시트 쪽이 더 최신이면 건너뜀
      sh.getRange(i + 2, 1, 1, header.length).setValues([rowVals]);
      values[i] = rowVals;
    } else {
      sh.appendRow(rowVals);
      values.push(rowVals);
      index[id] = values.length - 1;
    }
    count++;
  });

  // 삭제 (아래에서 위로)
  var delSet = {};
  (removeIds || []).forEach(function (id) { delSet[String(id)] = true; });
  if (Object.keys(delSet).length) {
    var idCol = header.indexOf('id');
    for (var r = values.length - 1; r >= 0; r--) {
      if (delSet[String(values[r][idCol])]) {
        sh.deleteRow(r + 2);
        values.splice(r, 1);
      }
    }
  }
  return count;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
