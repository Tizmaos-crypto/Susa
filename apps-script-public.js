// ============================================================
//  [공개용] 고객 예약 백엔드 — Google Apps Script
// ------------------------------------------------------------
//  ⚠️ 보안 원칙: 이 스크립트에는 "전체 예약 조회" 기능이 없습니다.
//     고객 예약 사이트가 호출하는 주소이므로, 코드가 노출되어도
//     대량 개인정보 유출이 물리적으로 불가능해야 합니다.
//
//  제공 기능 (모두 개인정보 대량 노출 없음):
//   · availability     : 부별 잔여 정원 (집계 숫자만)
//   · checkDuplicate   : 중복 예약 여부 (true/false만)
//   · lookup           : 본인 예약 확인 (성함+객실 정확 일치 시, 최소 정보만)
//   · addReservation   : 예약 등록 (쓰기 전용)
//   · cancelReservation: 본인 예약 취소 (성함+객실 재확인 후)
//
//  ❌ 없는 기능(직원용 백엔드에만 존재): 전체 조회 / 기간 조회 /
//     락커 배정 / 예약 편집 / 행 삭제 / 반납 처리
//
//  [설치]
//   1. 예약이 기록되는 스프레드시트 → 확장 프로그램 → Apps Script
//   2. Code.gs 내용을 이 파일 전체로 교체 → 저장
//   3. 배포 → 배포 관리 → 새 버전 (URL 유지)
//      - 실행 계정: "나" / 액세스: "모든 사용자"
// ============================================================

const SHEET_NAME = "설문지 응답 1";
const NUM_COLS = 14;           // A~N
const SLOT_CAPACITY = 180;     // 각 시간부 최대 정원
const TIME_SLOTS = ["1부", "2부", "3부", "4부"];

// ---------- 유틸 ----------
function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
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

function normRoom(v) {
  return String(v || "").toUpperCase().replace(/\s+/g, "");
}

// 취소된 예약인지 (N열)
function isCanceled(row) {
  return !!row[13];
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// ---------- 부별 예약 인원 집계 (개인정보 없음) ----------
function computeAvailability(date) {
  const counts = {};
  TIME_SLOTS.forEach((s) => (counts[s] = 0));

  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const data = sheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues();
    data.forEach((row) => {
      if (isCanceled(row)) return;
      if (date && formatDate(row[3]) !== date) return;
      const slot = matchSlot(row[4]);
      if (!slot) return;
      counts[slot] += parseHeadcount(row[5]);
    });
  }

  const slots = {};
  TIME_SLOTS.forEach((s) => {
    const reserved = counts[s];
    slots[s] = {
      reserved: reserved,
      remaining: Math.max(0, SLOT_CAPACITY - reserved),
      capacity: SLOT_CAPACITY,
      full: reserved >= SLOT_CAPACITY,
    };
  });
  return { date: date || "", capacity: SLOT_CAPACITY, slots: slots };
}

// ---------- GET ----------
function doGet(e) {
  try {
    const action = (e.parameter.action || "").trim();

    // 부별 잔여 정원 (집계 숫자만)
    if (action === "availability") {
      return createJsonResponse(computeAvailability((e.parameter.date || "").trim()));
    }

    // 중복 예약 여부만 반환 (같은 날짜+시설+객실+성함이 모두 일치할 때만 true)
    if (action === "checkDuplicate") {
      const dDate = formatDate((e.parameter.date || "").trim());
      const dRoom = normRoom(e.parameter.room);
      const dName = (e.parameter.name || "").trim();
      const dSite = (e.parameter.site || "").trim() || "휘닉스";
      if (!dDate || !dRoom || !dName) return createJsonResponse({ duplicate: false });

      const sh = getSheet();
      const lr = sh.getLastRow();
      if (lr < 2) return createJsonResponse({ duplicate: false });
      const rows = sh.getRange(2, 1, lr - 1, NUM_COLS).getValues();
      const dup = rows.some(function (rw) {
        if (isCanceled(rw)) return false;
        if (formatDate(rw[3]) !== dDate) return false;
        if ((String(rw[12] || "").trim() || "휘닉스") !== dSite) return false;
        if (String(rw[1] || "").trim() !== dName) return false;
        return normRoom(rw[2]) === dRoom;
      });
      return createJsonResponse({ duplicate: dup });
    }

    // 본인 예약 확인 — 성함+객실이 정확히 일치할 때만, 최소 정보만 반환
    if (action === "lookup") {
      const lName = (e.parameter.name || "").trim();
      const lRoom = normRoom(e.parameter.room);
      if (!lName || !lRoom) return createJsonResponse({ reservations: [] });

      const sh = getSheet();
      const lr = sh.getLastRow();
      if (lr < 2) return createJsonResponse({ reservations: [] });
      const rows = sh.getRange(2, 1, lr - 1, NUM_COLS).getValues();
      const out = [];
      rows.forEach(function (rw, i) {
        if (isCanceled(rw)) return;
        if (String(rw[1] || "").trim() !== lName) return;
        if (normRoom(rw[2]) !== lRoom) return;
        out.push({
          rowIndex: i + 2,
          date: formatDate(rw[3]),
          timeSlot: String(rw[4] || "").trim(),
          headcount: parseHeadcount(rw[5]),
        });
      });
      return createJsonResponse({ reservations: out });
    }

    // 그 외 요청은 전부 거부 (전체 조회 같은 기능 자체가 없음)
    return createJsonResponse({ error: "지원하지 않는 요청입니다." });
  } catch (err) {
    return createJsonResponse({ error: err.message });
  }
}

// ---------- POST ----------
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const sheet = getSheet();

    // ---------- 고객 예약 등록 ----------
    if (body.action === "addReservation") {
      const room = String(body.room || "").trim();
      if (!room) return createJsonResponse({ error: "객실 호수는 필수입니다." });

      const name      = String(body.name  || "").trim();
      const date      = String(body.date  || "").trim();
      const timeSlot  = String(body.timeSlot || "").trim();
      const headcount = parseHeadcount(body.headcount);
      const site      = String(body.site  || "").trim(); // "휘닉스" / "플캠"
      // 공개 백엔드에서는 항상 온라인 예약 (현장 등록은 직원 백엔드에서만 가능)
      const source = "";

      // ① 중복 예약 차단 (같은 날짜+시설+객실+성함)
      const roomNorm = normRoom(room);
      const isRealRoom = roomNorm && roomNorm.indexOf("체크인") < 0;
      if (isRealRoom && name) {
        const dateNorm = formatDate(date);
        const siteNorm = site || "휘닉스";
        const lastRow = sheet.getLastRow();
        if (lastRow >= 2) {
          const data = sheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues();
          const dup = data.some((rw) => {
            if (isCanceled(rw)) return false;
            if (formatDate(rw[3]) !== dateNorm) return false;
            if ((String(rw[12] || "").trim() || "휘닉스") !== siteNorm) return false;
            if (String(rw[1] || "").trim() !== name) return false;
            return normRoom(rw[2]) === roomNorm;
          });
          if (dup) {
            return createJsonResponse({
              error: "동일한 성함·객실로 해당 날짜에 이미 예약이 있습니다. 수영장 프론트에 문의해주세요.",
              duplicate: true,
            });
          }
        }
      }

      // ② 정원 초과 차단
      const slotKey = matchSlot(timeSlot);
      if (slotKey) {
        const s = computeAvailability(date).slots[slotKey];
        if (s && s.reserved + headcount > SLOT_CAPACITY) {
          return createJsonResponse({
            error: `${slotKey}는 정원(${SLOT_CAPACITY}명)이 마감되었습니다. 다른 시간을 선택해주세요.`,
            full: true,
          });
        }
      }

      // A:ts B:이름 C:객실 D:날짜 E:시간부 F:인원 G:레이트체크아웃 H:구분
      // I:락커 J:메모 K:배정시각 L:반납시각 M:예약경로 (N:취소시각은 비움)
      sheet.appendRow([
        new Date(), name, room, date, timeSlot,
        headcount || "", "", source, "", "", "", "", site,
      ]);
      return createJsonResponse({ success: true });
    }

    // ---------- 본인 예약 취소 (성함+객실 재확인 후에만) ----------
    if (body.action === "cancelReservation") {
      const row = Number(body.rowIndex);
      if (!(row >= 2)) return createJsonResponse({ error: "잘못된 요청입니다." });

      const vals = sheet.getRange(row, 1, 1, NUM_COLS).getValues()[0];
      const reqName = String(body.name || "").trim();
      const reqRoom = normRoom(body.room);

      if (
        !reqName || !reqRoom ||
        reqName !== String(vals[1] || "").trim() ||
        reqRoom !== normRoom(vals[2])
      ) {
        return createJsonResponse({ error: "예약 정보가 일치하지 않습니다." });
      }
      if (isCanceled(vals)) {
        return createJsonResponse({ error: "이미 취소된 예약입니다." });
      }

      sheet.getRange(row, 14).setValue(new Date()); // N열: 취소 시각
      return createJsonResponse({ success: true });
    }

    // 그 외(락커·편집·삭제 등)는 이 백엔드에 존재하지 않음
    return createJsonResponse({ error: "지원하지 않는 요청입니다." });
  } catch (err) {
    return createJsonResponse({ error: err.message });
  }
}
