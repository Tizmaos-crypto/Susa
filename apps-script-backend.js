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
//   F열: 락커 번호  ← 이 열은 웹앱에서 기록합니다
//   G열: 메모       ← 선택사항
// ============================================================

// ---------- 설정 ----------
// 시트 이름을 실제 시트 탭 이름과 맞춰주세요
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

  // Date 객체 판별: instanceof는 Apps Script에서 realm 차이로 실패할 수 있어
  // toString 태그로 안전하게 검사한다.
  if (Object.prototype.toString.call(d) === "[object Date]") {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  const s = String(d).trim();

  // "2026. 6. 12", "2026/6/12", "2026-6-12" 등 → "2026-06-12"
  const m = s.match(/(\d{4})[.\-/\s]+(\d{1,2})[.\-/\s]+(\d{1,2})/);
  if (m) {
    return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  }

  // "Fri Jun 12 2026 ..." 같은 Date.toString() 문자열도 파싱 시도
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }

  return s;
}

function rowToObj(row, idx) {
  return {
    rowIndex: idx, // 실제 시트 행 번호 (1-based)
    timestamp: row[0] ? String(row[0]) : "",
    name: row[1] ? String(row[1]).trim() : "",
    room: row[2] ? String(row[2]).trim() : "",
    date: row[3] ? formatDate(row[3]) : "",
    timeSlot: row[4] ? String(row[4]).trim() : "",
    locker: row[5] ? String(row[5]).trim() : "",
    memo: row[6] ? String(row[6]).trim() : "",
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

    const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    let results = data.map((row, i) => rowToObj(row, i + 2));

    // 필터: room, name, date
    const pRoom = (e.parameter.room || "").trim();
    const pName = (e.parameter.name || "").trim();
    const pDate = (e.parameter.date || "").trim();

    if (pRoom) {
      results = results.filter((r) => r.room.includes(pRoom));
    }
    if (pName) {
      results = results.filter((r) => r.name.includes(pName));
    }
    if (pDate) {
      results = results.filter((r) => r.date.includes(pDate));
    }

    return createJsonResponse({ reservations: results });
  } catch (err) {
    return createJsonResponse({ error: err.message });
  }
}

// ---------- POST: 락커 번호 / 메모 저장 ----------
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const sheet = getSheet();

    if (body.action === "updateLocker") {
      const row = body.rowIndex; // 1-based 시트 행
      const locker = body.locker || "";
      const memo = body.memo || "";

      // F열(6번째)에 락커, G열(7번째)에 메모
      sheet.getRange(row, 6).setValue(locker);
      sheet.getRange(row, 7).setValue(memo);

      return createJsonResponse({ success: true, rowIndex: row, locker, memo });
    }

    return createJsonResponse({ error: "Unknown action" });
  } catch (err) {
    return createJsonResponse({ error: err.message });
  }
}
