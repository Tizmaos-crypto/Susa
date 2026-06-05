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
//   E열: 이용 시간(부)
//   F열: 락커 번호  ← 웹앱에서 기록
//   G열: 메모       ← 선택사항
//   H열: 락커 배정 시각 ← 웹앱에서 기록 (3시간 경과 확인용)
// ============================================================

// ---------- 설정 ----------
const SHEET_NAME = "설문지 응답 1";

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

function rowToObj(row, idx) {
  return {
    rowIndex: idx,
    timestamp: row[0] ? String(row[0]) : "",
    name:      row[1] ? String(row[1]).trim() : "",
    room:      row[2] ? String(row[2]).trim() : "",
    date:      row[3] ? formatDate(row[3]) : "",
    timeSlot:  row[4] ? String(row[4]).trim() : "",
    locker:    row[5] ? String(row[5]).trim() : "",
    memo:      row[6] ? String(row[6]).trim() : "",
    assignedAt: row[7] ? String(row[7]) : "", // H열: 락커 배정 시각
  };
}

// ---------- CORS 헤더 ----------
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// ---------- GET: 예약 조회 ----------
function doGet(e) {
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return createJsonResponse({ reservations: [] });

    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues(); // A~H 8열
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

      sheet.getRange(row, 6).setValue(locker);
      sheet.getRange(row, 7).setValue(memo);

      // 락커가 새로 배정될 때 H열에 현재 시각 기록, 비워질 때 삭제
      if (locker) {
        sheet.getRange(row, 8).setValue(new Date());
      } else {
        sheet.getRange(row, 8).setValue("");
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

    // ---------- 현장 고객 등록 ----------
    if (body.action === "addReservation") {
      const room = String(body.room || "").trim();
      if (!room) return createJsonResponse({ error: "객실 호수는 필수입니다." });

      const name     = String(body.name     || "").trim();
      const date     = String(body.date     || "").trim();
      const timeSlot = String(body.timeSlot || "").trim();
      const locker   = String(body.locker   || "").trim();
      const memo     = String(body.memo     || "").trim();

      // A:타임스탬프, B:이름, C:객실, D:날짜, E:시간부, F:락커, G:메모, H:배정시각
      const assignedAt = locker ? new Date() : "";
      sheet.appendRow([new Date(), name, room, date, timeSlot, locker, memo, assignedAt]);
      const rowIndex = sheet.getLastRow();

      return createJsonResponse({ success: true, rowIndex });
    }

    return createJsonResponse({ error: "Unknown action" });
  } catch (err) {
    return createJsonResponse({ error: err.message });
  }
}
