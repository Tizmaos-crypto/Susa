import { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";

/* ── 시간부 정보 ── */
const TIME_SLOTS = {
  "1부": "10:00 – 13:00",
  "2부": "13:30 – 16:00",
  "3부": "16:30 – 18:30",
  "4부": "19:00 – 21:00",
};

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(str) {
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const m = str.match(/(\d{4})[.\-/\s]+(\d{1,2})[.\-/\s]+(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return str;
}

function matchSlot(raw) {
  if (!raw) return raw;
  for (const key of Object.keys(TIME_SLOTS)) {
    if (raw.includes(key)) return key;
  }
  return raw;
}

function slotOrder(slot) {
  const idx = Object.keys(TIME_SLOTS).indexOf(matchSlot(slot));
  return idx >= 0 ? idx : 99;
}

/* ── 락커 직렬화 (F열에 "남12, 여15" 형식으로 저장) ── */
function parseLockers(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(남|여)\s*(.*)$/);
      return m ? { gender: m[1], number: m[2].trim() } : { gender: "남", number: s };
    });
}

function serializeLockers(lockers) {
  return lockers
    .map((l) => ({ gender: l.gender, number: l.number.trim() }))
    .filter((l) => l.number)
    .map((l) => `${l.gender}${l.number}`)
    .join(", ");
}

/* 약식 락커 입력 파싱: "M12" → 남 12, "W23" → 여 23 (남/여 한글도 허용) */
function parseShorthand(token) {
  const t = String(token).trim();
  if (!t) return null;
  const first = t[0];
  if (first === "M" || first === "m" || first === "남")
    return { gender: "남", number: t.slice(1).trim() };
  if (first === "W" || first === "w" || first === "여")
    return { gender: "여", number: t.slice(1).trim() };
  return { gender: "남", number: t }; // 접두사 없으면 남자로 간주
}

/* ── API 헬퍼 ── */
const STORAGE_KEY = "reservation_desk_api_url";

function getSavedUrl() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}
function setSavedUrl(url) {
  try {
    localStorage.setItem(STORAGE_KEY, url);
  } catch {}
}

/* ================================================================
   Setup Screen
   ================================================================ */
function SetupScreen({ onSave }) {
  const [url, setUrl] = useState("");

  return (
    <div className="setup-wrap">
      <div className="setup-card">
        <div className="icon">🔗</div>
        <h2>API 연결 설정</h2>
        <p>
          Google Apps Script 배포 URL을 입력해주세요.
          <br />
          <small>배포 → 웹 앱 → URL 복사</small>
        </p>
        <input
          className="input"
          placeholder="https://script.google.com/macros/s/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && url.trim() && onSave(url.trim())}
        />
        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 14, opacity: url.trim() ? 1 : 0.4 }}
          disabled={!url.trim()}
          onClick={() => onSave(url.trim())}
        >
          연결하기
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   현장 고객 등록 폼
   ================================================================ */
function RegisterForm({ defaultDate, onSubmit }) {
  const [room, setRoom] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [timeSlot, setTimeSlot] = useState(Object.keys(TIME_SLOTS)[0]);
  const [tokens, setTokens] = useState([""]); // 약식 락커 입력 칸들
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const lockerRefs = useRef([]);
  const roomRef = useRef(null);
  const [focusIdx, setFocusIdx] = useState(null);

  const canSubmit = room.trim() && !saving;

  // Tab으로 새로 생긴 락커 칸에 포커스
  useEffect(() => {
    if (focusIdx != null && lockerRefs.current[focusIdx]) {
      lockerRefs.current[focusIdx].focus();
      setFocusIdx(null);
    }
  }, [focusIdx, tokens]);

  const setToken = (i, val) =>
    setTokens((prev) => prev.map((t, idx) => (idx === i ? val : t)));
  const removeToken = (i) =>
    setTokens((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length ? next : [""];
    });

  const handleLockerKey = (e, i) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Tab" && !e.shiftKey) {
      const isLast = i === tokens.length - 1;
      if (isLast && tokens[i].trim()) {
        e.preventDefault();
        const newIdx = tokens.length;
        setTokens((prev) => [...prev, ""]);
        setFocusIdx(newIdx);
      }
    }
  };

  const buildLockerString = () =>
    serializeLockers(tokens.map(parseShorthand).filter((l) => l && l.number.trim()));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const label = room.trim();
    const ok = await onSubmit({
      name: "",
      room: label,
      date,
      timeSlot,
      locker: buildLockerString(),
      memo: memo.trim(),
    });
    setSaving(false);
    if (ok) {
      // 연속 등록 편의: 날짜·시간부는 유지하고 나머지만 초기화
      setRoom("");
      setTokens([""]);
      setMemo("");
      setSavedMsg(`✓ ${label} 등록 완료`);
      setTimeout(() => setSavedMsg(""), 2500);
      lockerRefs.current = [];
      // 다음 고객을 위해 객실 칸으로 포커스 복귀
      setTimeout(() => roomRef.current && roomRef.current.focus(), 0);
    }
  };

  return (
    <div className="register-card">
      <div className="register-head">
        <span className="register-icon">🚶</span>
        <div>
          <h2>현장 고객 등록</h2>
          <p>객실 → Tab → 락커 → Enter 만으로 빠르게 등록하세요.</p>
        </div>
      </div>

      {/* 객실 */}
      <div>
        <label className="label">객실 호수 *</label>
        <input
          ref={roomRef}
          className="input"
          value={room}
          onChange={(e) => setRoom(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="예: A102"
          autoFocus
        />
      </div>

      {/* 락커 약식 입력 */}
      <div className="locker-edit" style={{ marginTop: 18 }}>
        <div className="locker-edit-head">
          <label className="label" style={{ margin: 0 }}>
            락커 배정 (선택)
          </label>
          <span className="locker-legend">
            <b className="male-txt">M</b>=남 · <b className="female-txt">W</b>=여
          </span>
        </div>

        {tokens.map((tok, i) => {
          const p = parseShorthand(tok);
          const valid = p && p.number.trim();
          return (
            <div className="locker-row-edit" key={i}>
              <input
                ref={(el) => (lockerRefs.current[i] = el)}
                className="input"
                value={tok}
                onChange={(e) => setToken(i, e.target.value)}
                onKeyDown={(e) => handleLockerKey(e, i)}
                placeholder="예: M12 (남12), W23 (여23)"
              />
              {valid ? (
                <span
                  className={`locker-chip ${p.gender === "남" ? "male" : "female"}`}
                >
                  {p.gender} {p.number}
                </span>
              ) : (
                <span className="locker-preview-empty">미입력</span>
              )}
              <button
                className="remove-locker-btn"
                onClick={() => removeToken(i)}
                title="삭제"
              >
                ✕
              </button>
            </div>
          );
        })}
        <div className="locker-tip">
          락커 칸에서 <b>Tab</b> → 다음 락커 추가, <b>Enter</b> → 즉시 등록
        </div>
      </div>

      {/* 날짜 · 시간부 */}
      <div className="register-grid" style={{ marginTop: 18 }}>
        <div>
          <label className="label">예약일</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">이용 시간(부)</label>
          <select
            className="input"
            value={timeSlot}
            onChange={(e) => setTimeSlot(e.target.value)}
          >
            {Object.entries(TIME_SLOTS).map(([key, time]) => (
              <option key={key} value={key}>
                {key} ({time})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="memo-row" style={{ marginTop: 14 }}>
        <label className="label">메모</label>
        <input
          className="input"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="비고 사항"
        />
      </div>

      <button
        className="btn btn-primary"
        style={{ width: "100%", marginTop: 18, opacity: canSubmit ? 1 : 0.45 }}
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {saving ? "등록중…" : "＋ 고객 등록 (Enter)"}
      </button>

      {savedMsg && <div className="register-saved">{savedMsg}</div>}
    </div>
  );
}

/* ================================================================
   Reservation Card
   ================================================================ */
function ReservationCard({ r, onUpdate }) {
  const [lockers, setLockers] = useState(() => parseLockers(r.locker));
  const [memo, setMemo] = useState(r.memo || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const serialized = serializeLockers(lockers);
  const dirty = serialized !== (r.locker || "") || memo !== (r.memo || "");

  // 외부 데이터 변경 시 동기화
  useEffect(() => {
    setLockers(parseLockers(r.locker));
    setMemo(r.memo || "");
  }, [r.locker, r.memo]);

  const updateLocker = (i, patch) =>
    setLockers((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLocker = () =>
    setLockers((prev) => [...prev, { gender: "남", number: "" }]);
  const removeLocker = (i) =>
    setLockers((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(r.rowIndex, serialized, memo);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const slot = matchSlot(r.timeSlot);
  const slotTime = TIME_SLOTS[slot] || "";
  const savedLockers = parseLockers(r.locker);

  const btnClass = saved
    ? "btn btn-saved"
    : dirty
      ? "btn btn-primary"
      : "btn btn-default";

  return (
    <div className="card">
      {/* 상단: 객실 + 시간부 */}
      <div className="card-top">
        <div className="room-badge">{r.room}</div>
        <div className="slot-badge">
          {slot}
          {slotTime && <span className="time">{slotTime}</span>}
        </div>
      </div>

      {/* 예약 정보 */}
      <div className="card-body">
        <div>
          <div className="field-label">예약자</div>
          <div className="field-value">{r.name}</div>
        </div>
        <div>
          <div className="field-label">예약일</div>
          <div className="field-value">{parseDate(r.date)}</div>
        </div>
        {r.timestamp && (
          <div>
            <div className="field-label">접수 시각</div>
            <div className="field-value" style={{ fontSize: 13, opacity: 0.7 }}>
              {r.timestamp}
            </div>
          </div>
        )}
      </div>

      {/* 락커 입력 (다수 배정 가능) */}
      <div className="locker-edit">
        <div className="locker-edit-head">
          <label className="label" style={{ margin: 0 }}>
            락커 배정 {lockers.length > 0 && `(${lockers.length})`}
          </label>
          <button className="add-locker-btn" onClick={addLocker}>
            + 락커 추가
          </button>
        </div>

        {lockers.length === 0 ? (
          <div className="no-locker-hint">
            배정된 락커가 없습니다 — “락커 추가”를 눌러 입력하세요
          </div>
        ) : (
          lockers.map((l, i) => (
            <div className="locker-row-edit" key={i}>
              <div className="gender-toggle">
                <button
                  className={`gender-btn male ${l.gender === "남" ? "active" : ""}`}
                  onClick={() => updateLocker(i, { gender: "남" })}
                >
                  남
                </button>
                <button
                  className={`gender-btn female ${l.gender === "여" ? "active" : ""}`}
                  onClick={() => updateLocker(i, { gender: "여" })}
                >
                  여
                </button>
              </div>
              <input
                className="input"
                value={l.number}
                onChange={(e) => updateLocker(i, { number: e.target.value })}
                placeholder="락커 번호 (예: 12)"
              />
              <button
                className="remove-locker-btn"
                onClick={() => removeLocker(i)}
                title="삭제"
              >
                ✕
              </button>
            </div>
          ))
        )}

        <div className="memo-row">
          <label className="label">메모</label>
          <input
            className="input"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="비고 사항"
          />
        </div>

        <button
          className={btnClass}
          style={{ width: "100%" }}
          disabled={saving || !dirty}
          onClick={handleSave}
        >
          {saving ? "저장중…" : saved ? "✓ 완료" : "저장"}
        </button>
      </div>

      {/* 배정 완료 표시 */}
      {savedLockers.length > 0 && (
        <div className="locker-confirm">
          🔐 배정 락커:{" "}
          {savedLockers.map((l, i) => (
            <span
              key={i}
              className={`locker-chip ${l.gender === "남" ? "male" : "female"}`}
            >
              {l.gender} {l.number}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Main App
   ================================================================ */
export default function App() {
  const [apiUrl, setApiUrl] = useState(getSavedUrl);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchRoom, setSearchRoom] = useState("");
  const [searchName, setSearchName] = useState("");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [tab, setTab] = useState("register");
  const fetchId = useRef(0);

  /* ── API URL 저장 ── */
  const saveUrl = (url) => {
    setSavedUrl(url);
    setApiUrl(url);
  };

  /* ── 예약 조회 ── */
  const fetchData = useCallback(
    async (room, name, date) => {
      if (!apiUrl) return;
      setLoading(true);
      setError("");
      const id = ++fetchId.current;

      try {
        const params = new URLSearchParams();
        if (room) params.set("room", room);
        if (name) params.set("name", name);
        if (date) params.set("date", date);

        const resp = await fetch(`${apiUrl}?${params.toString()}`);
        const json = await resp.json();
        if (fetchId.current !== id) return;

        if (json.error) {
          setError(json.error);
          setReservations([]);
        } else {
          const sorted = (json.reservations || []).sort(
            (a, b) => slotOrder(a.timeSlot) - slotOrder(b.timeSlot)
          );
          setReservations(sorted);
        }
      } catch {
        if (fetchId.current !== id) return;
        setError("서버 연결 실패 — Apps Script URL을 확인해주세요.");
        setReservations([]);
      } finally {
        if (fetchId.current === id) setLoading(false);
      }
    },
    [apiUrl]
  );

  /* ── 초기 로드 (오늘 날짜) ── */
  useEffect(() => {
    if (apiUrl) fetchData("", "", selectedDate);
  }, [apiUrl]); // eslint-disable-line

  /* ── 검색 실행 ── */
  const handleSearch = () => {
    fetchData(searchRoom.trim(), searchName.trim(), selectedDate);
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  /* ── 락커 저장 ── */
  const handleUpdate = async (rowIndex, locker, memo) => {
    try {
      await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({ action: "updateLocker", rowIndex, locker, memo }),
      });
      setReservations((prev) =>
        prev.map((r) => (r.rowIndex === rowIndex ? { ...r, locker, memo } : r))
      );
    } catch {
      alert("저장 실패 — 네트워크를 확인해주세요.");
    }
  };

  /* ── 현장 고객 등록 ── */
  const handleAddReservation = async (data) => {
    try {
      await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({ action: "addReservation", ...data }),
      });
      // 등록 탭에 머문 채 목록만 갱신 (조회·락커 현황 최신화)
      setSelectedDate(data.date);
      fetchData(searchRoom.trim(), searchName.trim(), data.date);
      return true;
    } catch {
      alert("등록 실패 — 네트워크를 확인해주세요.");
      return false;
    }
  };

  /* ── 락커 배정된 건 (예약별 다수 락커를 평탄화) ── */
  const allLockers = reservations
    .filter((r) => r.locker)
    .flatMap((r) => parseLockers(r.locker).map((l) => ({ ...l, r })));

  /* ── Setup ── */
  if (!apiUrl) return <SetupScreen onSave={saveUrl} />;

  return (
    <div className="shell">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <span className="logo">🏨</span>
          <div>
            <h1>예약 · 락커 관리</h1>
            <div className="sub">프론트 데스크</div>
          </div>
        </div>
        <button
          className="settings-btn"
          onClick={() => {
            if (window.confirm("API URL을 재설정하시겠습니까?")) {
              setSavedUrl("");
              setApiUrl("");
            }
          }}
        >
          ⚙ 설정
        </button>
      </header>

      {/* ── Tabs ── */}
      <div className="tabs">
        <button
          className={`tab-btn ${tab === "search" ? "active" : ""}`}
          onClick={() => setTab("search")}
        >
          📋 예약 조회
        </button>
        <button
          className={`tab-btn ${tab === "lockers" ? "active" : ""}`}
          onClick={() => setTab("lockers")}
        >
          🔐 락커 현황
          {allLockers.length > 0 && (
            <span className="tab-badge">{allLockers.length}</span>
          )}
        </button>
        <button
          className={`tab-btn ${tab === "register" ? "active" : ""}`}
          onClick={() => setTab("register")}
        >
          🚶 현장 등록
        </button>
      </div>

      {/* ════════════════════════════════════════
          예약 조회 탭
          ════════════════════════════════════════ */}
      {tab === "search" && (
        <div className="content">
          <div className="search-bar">
            <div className="search-field">
              <label className="label">날짜</label>
              <input
                type="date"
                className="input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="search-field">
              <label className="label">객실 호수</label>
              <input
                className="input"
                value={searchRoom}
                onChange={(e) => setSearchRoom(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="예: 301"
              />
            </div>
            <div className="search-field">
              <label className="label">예약자 성함</label>
              <input
                className="input"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="예: 홍길동"
              />
            </div>
            <button className="btn btn-primary" onClick={handleSearch}>
              {loading ? "조회중…" : "🔍 조회"}
            </button>
          </div>

          {error && <div className="error-msg">{error}</div>}

          {!loading && reservations.length === 0 && !error && (
            <div className="empty-state">
              <div className="emoji">📋</div>
              <p>조회된 예약이 없습니다</p>
            </div>
          )}

          <div className="card-list">
            {reservations.map((r) => (
              <ReservationCard key={r.rowIndex} r={r} onUpdate={handleUpdate} />
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          락커 현황 탭
          ════════════════════════════════════════ */}
      {tab === "lockers" && (
        <div className="content">
          {allLockers.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">🔐</div>
              <p>아직 배정된 락커가 없습니다</p>
            </div>
          ) : (
            <div className="locker-table">
              <div className="locker-header">
                <span className="lcell lcell-sm">구분</span>
                <span className="lcell lcell-sm">락커</span>
                <span className="lcell">객실</span>
                <span className="lcell">예약자</span>
                <span className="lcell lcell-lg">이용 시간</span>
                <span className="lcell lcell-lg">메모</span>
              </div>
              {allLockers
                .slice()
                .sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0))
                .map((item, idx) => {
                  const slot = matchSlot(item.r.timeSlot);
                  return (
                    <div key={`${item.r.rowIndex}-${idx}`} className="locker-row">
                      <span className="lcell lcell-sm">
                        <span
                          className={`gender-tag ${item.gender === "남" ? "male" : "female"}`}
                        >
                          {item.gender}
                        </span>
                      </span>
                      <span className="lcell lcell-sm lcell-locker">{item.number}</span>
                      <span className="lcell">{item.r.room}</span>
                      <span className="lcell">{item.r.name}</span>
                      <span className="lcell lcell-lg">
                        {slot} {TIME_SLOTS[slot] ? `(${TIME_SLOTS[slot]})` : ""}
                      </span>
                      <span
                        className="lcell lcell-lg"
                        style={{ opacity: item.r.memo ? 1 : 0.35 }}
                      >
                        {item.r.memo || "—"}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          현장 등록 탭
          ════════════════════════════════════════ */}
      {tab === "register" && (
        <div className="content">
          <RegisterForm defaultDate={getToday()} onSubmit={handleAddReservation} />
        </div>
      )}
    </div>
  );
}
