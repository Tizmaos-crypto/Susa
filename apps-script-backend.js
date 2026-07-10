// ============================================================
//  예약 확인 & 락커 관리 시스템 — Google Apps Script 백엔드
// ============================================================
//
//  [설치 방법]
//  1. Google 스프레드시트를 엽니다 (구글 폼 응답이 기록되는 시트).
//  2. 상단 메뉴 → 확장 프로그램 → Apps Script 클릭
//  3. 이 파일의 전체 내용을 복사하여 Code.gs에 붙여넣기
//  4. 저장 (Ctrl+S)
//  5. 상단 메뉴 → 배포 → 새 배포
//     - 유형: 웹 앱
//     - 실행 계정: "나"
//     - 액세스 권한: "모든 사용자" (또는 조직 내 사용자)
//  6. 배포 후 나오는 URL을 복사 → 웹앱의 API_URL에 붙여넣기
//
//  [시트 구조] (1행은 헤더, 데이터는 2행부터)
//   A열: 타임스탬프 (구글폼 자동)
//   B열: 예약자 성함
//   C열: 객실 호수
//   D열: 예약 날짜
//   E열: 예약 시간(부)
//   F열: 입장 인원            ← 구글폼
//   G열: 레이트 체크아웃 희망   ← 구글폼 (1·2부 프로모션)
//   H열: 구분(현장 등록 여부)   ← 웹앱에서 기록 ("현장" = 현장 등록)
//   I열: 락커 번호            ← 웹앱에서 기록
//   J열: 메모                ← 선택사항
//   K열: 락커 배정 시각        ← 웹앱에서 기록 (3시간 경과 확인용)
//   L열: 반납 시각            ← 웹앱에서 기록 (반납=취소선 표시용, 조건부 서식)
//   M열: 예약 경로            ← 웹앱에서 기록 (휘닉스=리조트, 플캠=연계 숙박업소)
// ============================================================

// ---------- 설정 ----------
const SHEET_NAME = "설문지 응답 1";
const NUM_COLS = 13;           // A~M
const SLOT_CAPACITY = 120;     // 각 시간부(1부~4부) 최대 정원
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

// "입장 인원" 값에서 숫자만 추출 ("2명" → 2, "" → 0)
function parseHeadcount(v) {
  const n = parseInt(String(v == null ? "" : v).replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

// timeSlot 원본 문자열에서 "1부"~"4부" 키를 찾아 반환 (없으면 "")
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
    headcount: parseHeadcount(row[5]),                 // F열: 입장 인원
    lateCheckout: row[6] ? String(row[6]).trim() : "", // G열: 레이트 체크아웃 희망
    source:    row[7] ? String(row[7]).trim() : "",    // H열: 구분 ("현장"=현장 등록)
    locker:    row[8] ? String(row[8]).trim() : "",    // I열: 락커
    memo:      row[9] ? String(row[9]).trim() : "",    // J열: 메모
    assignedAt: row[10] ? String(row[10]) : "",        // K열: 락커 배정 시각
    returnedAt: row[11] ? String(row[11]) : "",        // L열: 반납 시각
    site:      row[12] ? String(row[12]).trim() : "",  // M열: 예약 경로
  };
}

// ---------- JSON 응답 ----------
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// ---------- 시간부별 예약 인원 집계 (공개 현황 페이지용, 개인정보 제외) ----------
function computeAvailability(date) {
  const counts = {};
  TIME_SLOTS.forEach((s) => (counts[s] = 0));

  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const data = sheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues();
    data.forEach((row) => {
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
    // 공개 현황: 시간부별 예약 인원 / 잔여 정원만 반환 (개인정보 없음)
    if ((e.parameter.action || "") === "availability") {
      return createJsonResponse(computeAvailability((e.parameter.date || "").trim()));
    }

    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return createJsonResponse({ reservations: [] });

    const data = sheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues(); // A~I
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

// ---------- POST ----------
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const sheet = getSheet();

    // ---------- 락커 업데이트 ----------
    if (body.action === "updateLocker") {
      const row    = body.rowIndex;
      const locker = body.locker || "";
      const memo   = body.memo   || "";

      sheet.getRange(row, 9).setValue(locker);  // I열: 락커
      sheet.getRange(row, 10).setValue(memo);   // J열: 메모

      // 락커가 새로 배정될 때 K열에 현재 시각 기록, 비워질 때 삭제
      if (locker) {
        sheet.getRange(row, 11).setValue(new Date());
      } else {
        sheet.getRange(row, 11).setValue("");
      }

      return createJsonResponse({ success: true, rowIndex: row, locker, memo });
    }

    // ---------- 행 삭제 (반납 완료된 고객 데이터 정리) ----------
    if (body.action === "deleteRows") {
      // rowIndices는 1-based 시트 행 번호 배열
      const indices = (body.rowIndices || [])
        .map(Number)
        .filter((n) => n >= 2); // 헤더(1행) 보호

      // 높은 행부터 삭제해야 아래 행 번호 이동 영향을 받지 않는다
      indices.sort((a, b) => b - a);
      indices.forEach((r) => sheet.deleteRow(r));

      return createJsonResponse({ success: true, deleted: indices.length });
    }

    // ---------- 반납 처리 (행 삭제 대신 L열에 반납 시각 기록 → 취소선 표시) ----------
    if (body.action === "markReturned") {
      const indices = (body.rowIndices || [])
        .map(Number)
        .filter((n) => n >= 2); // 헤더 보호
      const now = new Date();
      indices.forEach((r) => sheet.getRange(r, 12).setValue(now)); // L열
      return createJsonResponse({ success: true, marked: indices.length });
    }

    // ---------- 예약 편집 (날짜 D / 시간부 E / 레이트체크아웃 G) ----------
    if (body.action === "editReservation") {
      const row = Number(body.rowIndex);
      if (!(row >= 2)) return createJsonResponse({ error: "잘못된 행입니다." });
      if (body.date !== undefined) sheet.getRange(row, 4).setValue(String(body.date));       // D열
      if (body.timeSlot !== undefined) sheet.getRange(row, 5).setValue(String(body.timeSlot)); // E열
      if (body.lateCheckout !== undefined)
        sheet.getRange(row, 7).setValue(String(body.lateCheckout));                          // G열
      return createJsonResponse({ success: true, rowIndex: row });
    }

    // ---------- 예약 등록 (온라인 고객 예약 + 현장 직원 등록 공용) ----------
    if (body.action === "addReservation") {
      const room = String(body.room || "").trim();
      if (!room) return createJsonResponse({ error: "객실 호수는 필수입니다." });

      const name        = String(body.name        || "").trim();
      const date        = String(body.date        || "").trim();
      const timeSlot    = String(body.timeSlot    || "").trim();
      const headcount   = parseHeadcount(body.headcount);
      const lateCheckout = String(body.lateCheckout || "").trim();
      const source      = String(body.source      || "").trim(); // "현장"=직원 등록, ""=온라인
      const site        = String(body.site        || "").trim(); // "휘닉스" / "플캠"
      const locker      = String(body.locker      || "").trim();
      const memo        = String(body.memo        || "").trim();

      // 온라인 고객 예약은 정원 초과 시 거부 (현장 직원 등록은 초과 허용)
      if (source !== "현장") {
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
      }

      // A:ts B:이름 C:객실 D:날짜 E:시간부 F:입장인원 G:레이트체크아웃 H:구분 I:락커 J:메모 K:배정시각 L:반납시각 M:예약경로
      const assignedAt = locker ? new Date() : "";
      sheet.appendRow([
        new Date(), name, room, date, timeSlot,
        headcount || "", lateCheckout, source, locker, memo, assignedAt, "", site,
      ]);
      const rowIndex = sheet.getLastRow();

      return createJsonResponse({ success: true, rowIndex });
    }

    return createJsonResponse({ error: "Unknown action" });
  } catch (err) {
    return createJsonResponse({ error: err.message });
  }
}

// ============================================================
//  [제거된 기능] 구글폼 시간부 자동 마감 (2026-07-10 폐기)
// ------------------------------------------------------------
//  웹앱 예약 전환으로 구글폼 채널이 다음 주 종료 예정이라
//  updateFormSlots / createFormSlotTriggers 및 관련 트리거를 제거했다.
//  (폼 선택지는 날짜 공통이라 날짜별 마감이 원리상 불가능했던 기능)
//  ⚠️ Apps Script의 ⏰트리거 메뉴에서 updateFormSlots 트리거 2개
//     (폼 제출 시 / 5분마다)를 삭제한 뒤 이 파일로 교체할 것.
// ============================================================
