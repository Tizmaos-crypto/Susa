// ============================================================
//  [직원용] 데스크 관리 백엔드 — Google Apps Script (독립 스크립트)
// ------------------------------------------------------------
//  ⚠️ 이 스크립트 주소(URL)는 절대 외부에 공개하지 마세요.
//     모든 요청에 ADMIN_TOKEN이 필요하며, 토큰이 없으면 전부 거부됩니다.
//
//  [설치 — 공개용 스크립트와 별도의 새 프로젝트로 만듭니다]
//   1. https://script.google.com → 새 프로젝트
//   2. 이 파일 전체를 Code.gs에 붙여넣기
//   3. 아래 SHEET_ID 에 스프레드시트 ID 입력
//      (시트 주소 https://docs.google.com/spreadsheets/d/★이부분★/edit)
//   4. 저장 → 배포 → 새 배포
//      - 유형: 웹 앱 / 실행 계정: "나" / 액세스: "모든 사용자"
//        (브라우저에서 호출해야 하므로 구글 로그인 방식은 쓸 수 없고,
//         대신 아래 토큰으로 보호합니다)
//   5. 배포 URL을 복사 → 직원용 Vercel 프로젝트의 VITE_ADMIN_API_URL 에 설정
// ============================================================

// ⚠️ 직원 전용 토큰 — 외부 유출 금지. 유출 의심 시 이 값을 새로 바꾸고 재배포하세요.
const ADMIN_TOKEN = "4FhKkXx3ZZcP7og5vWt-3W1PZ3RReWiW";

const SHEET_ID = "";  // ← 스프레드시트 ID를 여기에 입력
const SHEET_NAME = "설문지 응답 1";
const NUM_COLS = 14;           // A~N
const SLOT_CAPACITY = 180;
const TIME_SLOTS = ["1부", "2부", "3부", "4부"];

// ---------- 유틸 ----------
function getSheet() {
  if (!SHEET_ID) throw new Error("SHEET_ID가 설정되지 않았습니다.");
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDate(d) {
  if (!d) return "";
  if (Object.prototype.toString.call(d) === "[object Date]") {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  const s = String(d).trim();
  const m = s.match(/(\d{4})[.\-/\s]+(\d{1,2})[.\-/\s]+(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }
  return s;
}

function parseHeadcount(v) {
  const n = parseInt(String(v == null ? "" : v).replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function matchSlot(raw) {
  const s = String(raw || "");
  for (let i = 0; i < TIME_SLOTS.length; i++) {
    if (s.indexOf(TIME_SLOTS[i]) >= 0) return TIME_SLOTS[i];
  }
  return "";
}

function rowToObj(row, idx) {
  return {
    rowIndex: idx,
    timestamp: row[0] ? String(row[0]) : "",
    name:      row[1] ? String(row[1]).trim() : "",
    room:      row[2] ? String(row[2]).trim() : "",
    date:      row[3] ? formatDate(row[3]) : "",
    timeSlot:  row[4] ? String(row[4]).trim() : "",
    headcount: parseHeadcount(row[5]),
    lateCheckout: row[6] ? String(row[6]).trim() : "",
    source:    row[7] ? String(row[7]).trim() : "",
    locker:    row[8] ? String(row[8]).trim() : "",
    memo:      row[9] ? String(row[9]).trim() : "",
    assignedAt: row[10] ? String(row[10]) : "",
    returnedAt: row[11] ? String(row[11]) : "",
    site:      row[12] ? String(row[12]).trim() : "",
    canceledAt: row[13] ? String(row[13]) : "",
  };
}

function isCanceled(row) {
  return !!row[13];
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// ---------- 인증 ----------
function authOk(token) {
  return String(token || "") === ADMIN_TOKEN;
}
function authError() {
  return createJsonResponse({ error: "인증이 필요합니다.", unauthorized: true });
}

// ---------- GET (모두 토큰 필수) ----------
function doGet(e) {
  try {
    if (!authOk(e.parameter.token)) return authError();

    const action = (e.parameter.action || "").trim();

    // 기간 조회 (투숙 중 이용 이력 확인용)
    if (action === "range") {
      const from = formatDate((e.parameter.from || "").trim());
      const to = formatDate((e.parameter.to || "").trim());
      if (!from || !to) return createJsonResponse({ reservations: [] });
      const sh = getSheet();
      const lr = sh.getLastRow();
      if (lr < 2) return createJsonResponse({ reservations: [] });
      const rows = sh.getRange(2, 1, lr - 1, NUM_COLS).getValues();
      const out = [];
      rows.forEach(function (rw, i) {
        const d = formatDate(rw[3]);
        if (!d || d < from || d > to) return;
        out.push(rowToObj(rw, i + 2));
      });
      return createJsonResponse({ reservations: out });
    }

    // 전체/조건 조회
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return createJsonResponse({ reservations: [] });

    const data = sheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues();
    let results = data.map((row, i) => rowToObj(row, i + 2));

    const pRoom = (e.parameter.room || "").trim();
    const pName = (e.parameter.name || "").trim();
    const pDate = (e.parameter.date || "").trim();

    if (pRoom) results = results.filter((r) => r.room.includes(pRoom));
    if (pName) results = results.filter((r) => r.name.includes(pName));
    if (pDate) results = results.filter((r) => r.date.includes(pDate));

    return createJsonResponse({ reservations: results });
  } catch (err) {
    return createJsonResponse({ error: err.message });
  }
}

// ---------- POST (모두 토큰 필수) ----------
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!authOk(body.token)) return authError();

    const sheet = getSheet();

    // ---------- 락커 업데이트 ----------
    if (body.action === "updateLocker") {
      const row = body.rowIndex;
      const locker = body.locker || "";
      const memo = body.memo || "";

      sheet.getRange(row, 9).setValue(locker);   // I열
      sheet.getRange(row, 10).setValue(memo);    // J열
      sheet.getRange(row, 11).setValue(locker ? new Date() : ""); // K열
      return createJsonResponse({ success: true, rowIndex: row, locker, memo });
    }

    // ---------- 행 삭제 ----------
    if (body.action === "deleteRows") {
      const indices = (body.rowIndices || []).map(Number).filter((n) => n >= 2);
      indices.sort((a, b) => b - a); // 높은 행부터
      indices.forEach((r) => sheet.deleteRow(r));
      return createJsonResponse({ success: true, deleted: indices.length });
    }

    // ---------- 반납 처리 (L열) ----------
    if (body.action === "markReturned") {
      const indices = (body.rowIndices || []).map(Number).filter((n) => n >= 2);
      const now = new Date();
      indices.forEach((r) => sheet.getRange(r, 12).setValue(now));
      return createJsonResponse({ success: true, marked: indices.length });
    }

    // ---------- 예약 취소 / 취소 해제 (N열) ----------
    //  직원용: 이미 토큰으로 인증된 요청이므로 본인 확인 절차는 없음
    if (body.action === "cancelReservation") {
      const row = Number(body.rowIndex);
      if (!(row >= 2)) return createJsonResponse({ error: "잘못된 행입니다." });
      sheet.getRange(row, 14).setValue(body.restore ? "" : new Date());
      return createJsonResponse({ success: true, rowIndex: row, restored: !!body.restore });
    }

    // ---------- 예약 편집 (날짜 D / 시간부 E / 레이트체크아웃 G) ----------
    if (body.action === "editReservation") {
      const row = Number(body.rowIndex);
      if (!(row >= 2)) return createJsonResponse({ error: "잘못된 행입니다." });
      if (body.date !== undefined) sheet.getRange(row, 4).setValue(String(body.date));
      if (body.timeSlot !== undefined) sheet.getRange(row, 5).setValue(String(body.timeSlot));
      if (body.lateCheckout !== undefined)
        sheet.getRange(row, 7).setValue(String(body.lateCheckout));
      return createJsonResponse({ success: true, rowIndex: row });
    }

    // ---------- 현장 등록 (직원 재량 — 정원·중복 제한 없음) ----------
    if (body.action === "addReservation") {
      const room = String(body.room || "").trim();
      if (!room) return createJsonResponse({ error: "객실 호수는 필수입니다." });

      const name      = String(body.name  || "").trim();
      const date      = String(body.date  || "").trim();
      const timeSlot  = String(body.timeSlot || "").trim();
      const headcount = parseHeadcount(body.headcount);
      const lateCheckout = String(body.lateCheckout || "").trim();
      const source    = String(body.source || "").trim();
      const site      = String(body.site   || "").trim();
      const locker    = String(body.locker || "").trim();
      const memo      = String(body.memo   || "").trim();

      const assignedAt = locker ? new Date() : "";
      sheet.appendRow([
        new Date(), name, room, date, timeSlot,
        headcount || "", lateCheckout, source, locker, memo, assignedAt, "", site,
      ]);
      return createJsonResponse({ success: true, rowIndex: sheet.getLastRow() });
    }

    return createJsonResponse({ error: "지원하지 않는 요청입니다." });
  } catch (err) {
    return createJsonResponse({ error: err.message });
  }
}
