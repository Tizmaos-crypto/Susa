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

/* 현재 시각 기준 시간부 자동 선택 (각 부의 종료 시각이 아직 안 지난 첫 부) */
const SLOT_END_MIN = { "1부": 13 * 60, "2부": 16 * 60, "3부": 18 * 60 + 30, "4부": 21 * 60 };
function getCurrentSlot() {
  const d = new Date();
  const mins = d.getHours() * 60 + d.getMinutes();
  for (const key of Object.keys(TIME_SLOTS)) {
    if (mins <= SLOT_END_MIN[key]) return key;
  }
  return Object.keys(TIME_SLOTS).slice(-1)[0]; // 영업 종료 후엔 마지막 부
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
   락커 약식 입력 에디터 (M12=남, W23=여 / Tab=다음, Enter=적용)
   ================================================================ */
function LockerEditor({ tokens, setTokens, onEnter, firstInputRef }) {
  const refs = useRef([]);
  const [focusIdx, setFocusIdx] = useState(null);

  useEffect(() => {
    if (focusIdx != null && refs.current[focusIdx]) {
      refs.current[focusIdx].focus();
      setFocusIdx(null);
    }
  }, [focusIdx, tokens]);

  const setToken = (i, val) => setTokens(tokens.map((t, idx) => (idx === i ? val : t)));
  const removeToken = (i) => {
    const next = tokens.filter((_, idx) => idx !== i);
    setTokens(next.length ? next : [""]);
  };

  const handleKey = (e, i) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter && onEnter();
    } else if (e.key === "Tab" && !e.shiftKey) {
      const isLast = i === tokens.length - 1;
      if (isLast && tokens[i].trim()) {
        e.preventDefault();
        const newIdx = tokens.length;
        setTokens([...tokens, ""]);
        setFocusIdx(newIdx);
      }
    }
  };

  return (
    <div className="locker-edit">
      <div className="locker-edit-head">
        <label className="label" style={{ margin: 0 }}>
          락커 배정
        </label>
        <div className="locker-head-right">
          <span className="locker-legend">
            <b className="male-txt">M</b>=남 · <b className="female-txt">W</b>=여
          </span>
          <button
            type="button"
            className="add-locker-btn"
            tabIndex={-1}
            onClick={() => setTokens([...tokens, ""])}
          >
            + 추가
          </button>
        </div>
      </div>

      {tokens.map((tok, i) => {
        const p = parseShorthand(tok);
        const valid = p && p.number.trim();
        return (
          <div className="locker-row-edit" key={i}>
            <input
              ref={(el) => {
                refs.current[i] = el;
                if (i === 0 && firstInputRef) firstInputRef.current = el;
              }}
              className="input"
              value={tok}
              onChange={(e) => setToken(i, e.target.value)}
              onKeyDown={(e) => handleKey(e, i)}
              placeholder="예: M12 (남12), W23 (여23)"
            />
            {valid ? (
              <span className={`locker-chip ${p.gender === "남" ? "male" : "female"}`}>
                {p.gender} {p.number}
              </span>
            ) : (
              <span className="locker-preview-empty">미입력</span>
            )}
            <button
              type="button"
              className="remove-locker-btn"
              tabIndex={-1}
              onClick={() => removeToken(i)}
              title="삭제"
            >
              ✕
            </button>
          </div>
        );
      })}
      <div className="locker-tip">
        락커 칸에서 <b>Tab</b> → 다음 락커, <b>Enter</b> → 적용
      </div>
    </div>
  );
}

/* 락커 문자열 → 약식 토큰 배열 ("남12, 여23" → ["남12","여23"]) */
function lockerToTokens(raw) {
  const arr = parseLockers(raw).map((l) => `${l.gender}${l.number}`);
  return arr.length ? arr : [""];
}
/* 약식 토큰 배열 → 저장용 문자열 */
function tokensToLocker(tokens) {
  return serializeLockers(tokens.map(parseShorthand).filter((l) => l && l.number.trim()));
}

/* 키 검색 매칭: "M12"=남12, "W23"=여23, "12"=번호만, "A102"=객실(부분일치) */
function matchKeyQuery(query, item) {
  const q = String(query).trim();
  if (!q) return true;
  // 객실 부분 일치
  if (String(item.r.room).toUpperCase().includes(q.toUpperCase())) return true;
  // 키 매칭
  const hasGender = "MmWw남여".includes(q[0]);
  if (hasGender) {
    const p = parseShorthand(q);
    const num = p.number.trim();
    if (!num) return item.gender === p.gender; // 성별만 입력 시
    return item.gender === p.gender && String(item.number) === num;
  }
  return String(item.number) === q; // 번호만 입력
}

/* ================================================================
   현장 고객 등록 폼
   ================================================================ */
function RegisterForm({ defaultDate, onSubmit }) {
  const [room, setRoom] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [timeSlot, setTimeSlot] = useState(getCurrentSlot);
  const [headcount, setHeadcount] = useState("");
  const [tokens, setTokens] = useState([""]); // 약식 락커 입력 칸들
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const roomRef = useRef(null);
  const canSubmit = room.trim() && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const label = room.trim();
    const ok = await onSubmit({
      name: "",
      room: label,
      date,
      timeSlot,
      headcount: headcount.trim(),
      locker: tokensToLocker(tokens),
      memo: memo.trim(),
    });
    setSaving(false);
    if (ok) {
      // 연속 등록 편의: 날짜·시간부는 유지하고 나머지만 초기화
      setRoom("");
      setHeadcount("");
      setTokens([""]);
      setMemo("");
      setTimeSlot(getCurrentSlot()); // 시간 흐름 반영
      setSavedMsg(`✓ ${label} 등록 완료`);
      setTimeout(() => setSavedMsg(""), 2500);
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
      <div style={{ marginTop: 18 }}>
        <LockerEditor tokens={tokens} setTokens={setTokens} onEnter={handleSubmit} />
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

      <div className="register-grid" style={{ marginTop: 14 }}>
        <div>
          <label className="label">입장 인원</label>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            className="input"
            value={headcount}
            onChange={(e) => setHeadcount(e.target.value)}
            placeholder="예: 2"
          />
        </div>
        <div className="memo-row">
          <label className="label">메모</label>
          <input
            className="input"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="비고 사항"
          />
        </div>
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
function ReservationCard({ r, onUpdate, firstInputRef }) {
  const [tokens, setTokens] = useState(() => lockerToTokens(r.locker));
  const [memo, setMemo] = useState(r.memo || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const serialized = tokensToLocker(tokens);
  const dirty = serialized !== (r.locker || "") || memo !== (r.memo || "");

  // 외부 데이터 변경 시 동기화
  useEffect(() => {
    setTokens(lockerToTokens(r.locker));
    setMemo(r.memo || "");
  }, [r.locker, r.memo]);

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
        {r.name && (
          <div>
            <div className="field-label">예약자</div>
            <div className="field-value">{r.name}</div>
          </div>
        )}
        <div>
          <div className="field-label">예약일</div>
          <div className="field-value">{parseDate(r.date)}</div>
        </div>
        {r.headcount ? (
          <div>
            <div className="field-label">입장 인원</div>
            <div className="field-value">{r.headcount}명</div>
          </div>
        ) : null}
        {r.timestamp && (
          <div>
            <div className="field-label">접수 시각</div>
            <div className="field-value" style={{ fontSize: 13, opacity: 0.7 }}>
              {r.timestamp}
            </div>
          </div>
        )}
      </div>

      {/* 락커 입력 (약식, 다수 배정 가능) */}
      <LockerEditor
        tokens={tokens}
        setTokens={setTokens}
        onEnter={handleSave}
        firstInputRef={firstInputRef}
      />

      <div className="memo-row" style={{ marginTop: 12 }}>
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
        style={{ width: "100%", marginTop: 12 }}
        disabled={saving || !dirty}
        onClick={handleSave}
      >
        {saving ? "저장중…" : saved ? "✓ 완료" : "저장"}
      </button>

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
   락커 현황 — 키 번호 인라인 수정
   ================================================================ */
function EditableLockerNumber({ item, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");

  const commit = () => {
    setEditing(false);
    const v = val.trim();
    if (v && v !== item.number) onCommit(item, v);
  };

  if (!editing) {
    return (
      <button
        className="locker-num-btn"
        onClick={(e) => {
          e.stopPropagation();
          setVal(item.number);
          setEditing(true);
        }}
        title="키 번호 수정"
      >
        {item.number}
        <span className="edit-mark">✎</span>
      </button>
    );
  }

  return (
    <input
      className="locker-num-input"
      value={val}
      autoFocus
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        else if (e.key === "Escape") {
          setVal(item.number);
          setEditing(false);
        }
      }}
      onBlur={commit}
    />
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
  const [keyQuery, setKeyQuery] = useState(""); // 락커 현황 키 검색
  const [leftRooms, setLeftRooms] = useState(() => new Set()); // 일행 잔류 강조 객실
  const [selected, setSelected] = useState(() => new Set()); // 다중 반납 선택
  const fetchId = useRef(0);
  const firstLockerRef = useRef(null); // 조회 결과 첫 카드의 락커 입력
  const pendingFocus = useRef(false);

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

  /* ── 락커 현황 자동 새로고침 (탭이 현황일 때만) ── */
  useEffect(() => {
    if (!apiUrl || tab !== "lockers") return;
    const timer = setInterval(() => {
      fetchData(searchRoom.trim(), searchName.trim(), selectedDate);
    }, 15000);
    return () => clearInterval(timer);
  }, [apiUrl, tab, selectedDate, searchRoom, searchName, fetchData]);

  /* ── 검색 실행 ── */
  const handleSearch = () => {
    pendingFocus.current = true; // 결과 렌더 후 첫 락커 칸으로 포커스
    fetchData(searchRoom.trim(), searchName.trim(), selectedDate);
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  /* ── 조회 결과가 오면 첫 카드의 락커 칸으로 자동 포커스 ── */
  useEffect(() => {
    if (
      pendingFocus.current &&
      tab === "search" &&
      reservations.length > 0 &&
      firstLockerRef.current
    ) {
      firstLockerRef.current.focus();
    }
    pendingFocus.current = false;
  }, [reservations, tab]);

  /* ── 락커 저장 ── */
  const handleUpdate = async (rowIndex, locker, memo) => {
    try {
      await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({ action: "updateLocker", rowIndex, locker, memo }),
      });
      const assignedAt = locker ? new Date().toString() : "";
      setReservations((prev) =>
        prev.map((r) =>
          r.rowIndex === rowIndex ? { ...r, locker, memo, assignedAt } : r
        )
      );
    } catch {
      alert("저장 실패 — 네트워크를 확인해주세요.");
    }
  };

  /* ── 행 삭제 (내림차순으로 처리) ── */
  const handleDeleteRows = async (rowIndices) => {
    try {
      await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({ action: "deleteRows", rowIndices }),
      });
      const gone = new Set(rowIndices);
      setReservations((prev) => prev.filter((r) => !gone.has(r.rowIndex)));
    } catch {
      alert("삭제 실패 — 네트워크를 확인해주세요.");
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

  /* 객실별 락커 수 (일행 그룹 판별용) */
  const roomCounts = allLockers.reduce((acc, it) => {
    acc[it.r.room] = (acc[it.r.room] || 0) + 1;
    return acc;
  }, {});

  /* ── 키 검색 + 같은 객실 통합 ── */
  const matchedRooms = new Set(
    keyQuery.trim()
      ? allLockers.filter((it) => matchKeyQuery(keyQuery, it)).map((it) => it.r.room)
      : []
  );
  const visibleLockers = (
    keyQuery.trim()
      ? allLockers.filter((it) => matchedRooms.has(it.r.room))
      : allLockers
  )
    .slice()
    .sort(
      (a, b) =>
        String(a.r.room).localeCompare(String(b.r.room)) ||
        (parseInt(a.number) || 0) - (parseInt(b.number) || 0)
    );

  /* ── 키 반납(제거) ── */
  const handleRemoveLocker = async (item) => {
    const { r, gender, number } = item;
    if (!window.confirm(`${r.room} · ${gender}${number} 락커 키를 반납 처리할까요?`))
      return;

    const remaining = parseLockers(r.locker).filter(
      (l) => !(l.gender === gender && l.number === number)
    );
    const roomHasOthers = allLockers.some(
      (x) =>
        x.r.room === r.room &&
        !(x.r.rowIndex === r.rowIndex && x.gender === gender && x.number === number)
    );

    if (remaining.length === 0) {
      // 마지막 키 → 행 삭제
      await handleDeleteRows([r.rowIndex]);
    } else {
      await handleUpdate(r.rowIndex, serializeLockers(remaining), r.memo || "");
    }

    setLeftRooms((prev) => {
      const next = new Set(prev);
      if (roomHasOthers) next.add(r.room);
      else next.delete(r.room);
      return next;
    });
  };

  const dismissAlert = (room) =>
    setLeftRooms((prev) => {
      const next = new Set(prev);
      next.delete(room);
      return next;
    });

  /* ── 키 번호 변경 (락커 상태 불만으로 교체 요청 시) ── */
  const handleChangeLockerNumber = async (item, newNumber) => {
    const { r, gender, number } = item;
    const updated = parseLockers(r.locker).map((l) =>
      l.gender === gender && l.number === number ? { ...l, number: newNumber } : l
    );
    await handleUpdate(r.rowIndex, serializeLockers(updated), r.memo || "");
  };

  /* ── 다중 선택 반납 ── */
  const keyId = (it) => `${it.r.rowIndex}|${it.gender}|${it.number}`;
  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allVisibleSelected =
    visibleLockers.length > 0 && visibleLockers.every((it) => selected.has(keyId(it)));
  const toggleSelectAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleLockers.forEach((it) => next.delete(keyId(it)));
      else visibleLockers.forEach((it) => next.add(keyId(it)));
      return next;
    });

  const handleRemoveSelected = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`선택한 ${selected.size}개 락커 키를 반납 처리할까요?`)) return;

    const byRow = {};
    allLockers.forEach((it) => {
      if (!selected.has(keyId(it))) return;
      if (!byRow[it.r.rowIndex]) byRow[it.r.rowIndex] = { r: it.r, rm: new Set() };
      byRow[it.r.rowIndex].rm.add(`${it.gender}|${it.number}`);
    });

    const remainingAll = allLockers.filter((it) => !selected.has(keyId(it)));
    const affectedRooms = new Set(Object.values(byRow).map((v) => v.r.room));
    const toDelete = [];

    for (const { r, rm } of Object.values(byRow)) {
      const remaining = parseLockers(r.locker).filter(
        (l) => !rm.has(`${l.gender}|${l.number}`)
      );
      if (remaining.length === 0) {
        toDelete.push(r.rowIndex); // 마지막 키 → 행 삭제 대상
      } else {
        await handleUpdate(r.rowIndex, serializeLockers(remaining), r.memo || "");
      }
    }

    if (toDelete.length > 0) await handleDeleteRows(toDelete);

    setLeftRooms((prev) => {
      const next = new Set(prev);
      affectedRooms.forEach((room) => {
        if (remainingAll.some((x) => x.r.room === room)) next.add(room);
        else next.delete(room);
      });
      return next;
    });
    setSelected(new Set());
  };

  /* ── 3시간 경과 락커 (배정 시각 기준, 없으면 A열 등록 시각으로 대체) ── */
  const overdueLockers = allLockers.filter((it) => {
    const raw = it.r.assignedAt || it.r.timestamp;
    if (!raw) return false;
    const t = new Date(raw);
    return !isNaN(t) && Date.now() - t.getTime() > 3 * 60 * 60 * 1000;
  });
  // 경과 시간 포맷 (예: 3시간 25분)
  function elapsedLabel(item) {
    const raw = item.r.assignedAt || item.r.timestamp;
    const mins = Math.floor((Date.now() - new Date(raw).getTime()) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const label = h > 0 ? `${h}시간 ${m}분 경과` : `${m}분 경과`;
    return item.r.assignedAt ? label : `${label} (등록 시각 기준)`;
  }

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
            <div className="search-field search-date">
              <label className="label">날짜</label>
              <div className="date-static">📅 오늘 · {selectedDate}</div>
            </div>
            <div className="search-field">
              <label className="label">객실 호수</label>
              <input
                className="input"
                value={searchRoom}
                onChange={(e) => setSearchRoom(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                placeholder="예: A102"
                autoFocus
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
              {loading ? "조회중…" : "🔍 조회 (Enter)"}
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
            {reservations.map((r, i) => (
              <ReservationCard
                key={r.rowIndex}
                r={r}
                onUpdate={handleUpdate}
                firstInputRef={i === 0 ? firstLockerRef : null}
              />
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          락커 현황 탭
          ════════════════════════════════════════ */}
      {tab === "lockers" && (
        <div className="content">

          {/* ── 반납 확인 필요 (3시간 경과) ── */}
          {overdueLockers.length > 0 && (
            <div className="overdue-section">
              <div className="overdue-header">
                <span className="overdue-title">
                  ⚠️ 반납 확인 필요 — {overdueLockers.length}건
                </span>
                <span className="overdue-sub">락커 배정 후 3시간 이상 경과</span>
                <button
                  className="btn btn-danger"
                  style={{ marginLeft: "auto", padding: "6px 14px", fontSize: 13 }}
                  onClick={async () => {
                    if (!window.confirm(`확인된 ${overdueLockers.length}건의 반납을 처리하고 데이터를 삭제할까요?`)) return;
                    const byRow = {};
                    overdueLockers.forEach((it) => {
                      if (!byRow[it.r.rowIndex])
                        byRow[it.r.rowIndex] = { r: it.r, rm: new Set() };
                      byRow[it.r.rowIndex].rm.add(`${it.gender}|${it.number}`);
                    });
                    const toDelete = [];
                    for (const { r, rm } of Object.values(byRow)) {
                      const remaining = parseLockers(r.locker).filter(
                        (l) => !rm.has(`${l.gender}|${l.number}`)
                      );
                      if (remaining.length === 0) toDelete.push(r.rowIndex);
                      else await handleUpdate(r.rowIndex, serializeLockers(remaining), r.memo || "");
                    }
                    if (toDelete.length > 0) await handleDeleteRows(toDelete);
                  }}
                >
                  전체 반납 처리
                </button>
              </div>
              {overdueLockers.map((item, idx) => {
                const slot = matchSlot(item.r.timeSlot);
                return (
                  <div key={`od-${idx}`} className="overdue-row">
                    <span className={`gender-tag ${item.gender === "남" ? "male" : "female"}`}>
                      {item.gender}
                    </span>
                    <span className="overdue-num">{item.number}</span>
                    <span className="overdue-room">{item.r.room}</span>
                    <span className="overdue-time">{slot}</span>
                    <span className="overdue-elapsed">{elapsedLabel(item)}</span>
                    <button
                      className="key-remove-btn"
                      onClick={() => handleRemoveLocker(item)}
                    >
                      🔑 반납
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 키 검색 */}
          <div className="key-search">
            <span className="key-search-icon">🔑</span>
            <input
              className="input"
              value={keyQuery}
              onChange={(e) => setKeyQuery(e.target.value.toUpperCase())}
              placeholder="검색 — M12 / W23 / 번호 / 객실(A102) · 일행 키 함께 표시"
              autoFocus
            />
            {keyQuery && (
              <button className="key-search-clear" onClick={() => setKeyQuery("")}>
                ✕
              </button>
            )}
            <button
              className="refresh-btn"
              onClick={() =>
                fetchData(searchRoom.trim(), searchName.trim(), selectedDate)
              }
              title="새로고침"
            >
              {loading ? "갱신중…" : "🔄"}
            </button>
          </div>
          <div className="auto-refresh-note">⟳ 15초마다 자동 갱신됩니다</div>

          {allLockers.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">🔐</div>
              <p>아직 배정된 락커가 없습니다</p>
            </div>
          ) : visibleLockers.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">🔍</div>
              <p>“{keyQuery}” 키를 찾을 수 없습니다</p>
            </div>
          ) : (
            <div className="locker-table">
              <div className={`select-bar ${selected.size > 0 ? "active" : ""}`}>
                {selected.size > 0 ? (
                  <>
                    <span className="select-bar-count">{selected.size}개 선택됨</span>
                    <div className="select-bar-actions">
                      <button
                        className="btn btn-default"
                        onClick={() => setSelected(new Set())}
                      >
                        선택 해제
                      </button>
                      <button className="btn btn-danger" onClick={handleRemoveSelected}>
                        🔑 선택 반납 ({selected.size})
                      </button>
                    </div>
                  </>
                ) : (
                  <span className="select-bar-hint">
                    체크박스를 선택하면 여러 키를 한 번에 반납할 수 있어요
                  </span>
                )}
              </div>
              <div className="locker-header">
                <span className="lcell lcell-check">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    title="전체 선택/해제"
                  />
                </span>
                <span className="lcell lcell-sm">구분</span>
                <span className="lcell lcell-sm">락커</span>
                <span className="lcell">객실</span>
                <span className="lcell">예약자</span>
                <span className="lcell lcell-lg">이용 시간</span>
                <span className="lcell lcell-lg">메모</span>
                <span className="lcell lcell-sm">반납</span>
              </div>
              {visibleLockers.map((item, idx) => {
                const slot = matchSlot(item.r.timeSlot);
                const isGroup = roomCounts[item.r.room] > 1;
                const isAlert = leftRooms.has(item.r.room);
                const isMatch = keyQuery.trim() && matchKeyQuery(keyQuery, item);
                const id = keyId(item);
                const isSelected = selected.has(id);
                const cls = [
                  "locker-row",
                  isGroup ? "group" : "",
                  isAlert ? "alert" : "",
                  isMatch ? "match" : "",
                  isSelected ? "selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <div
                    key={`${item.r.rowIndex}-${idx}`}
                    className={cls}
                    onClick={isAlert ? () => dismissAlert(item.r.room) : undefined}
                    title={isAlert ? "클릭하여 일행 잔류 표시 해제" : undefined}
                  >
                    <span
                      className="lcell lcell-check"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(id)}
                      />
                    </span>
                    <span className="lcell lcell-sm">
                      <span
                        className={`gender-tag ${item.gender === "남" ? "male" : "female"}`}
                      >
                        {item.gender}
                      </span>
                    </span>
                    <span className="lcell lcell-sm lcell-locker">
                      <EditableLockerNumber
                        item={item}
                        onCommit={handleChangeLockerNumber}
                      />
                    </span>
                    <span className="lcell">
                      {item.r.room}
                      {isGroup && <span className="group-tag">👥 일행 {roomCounts[item.r.room]}</span>}
                    </span>
                    <span className="lcell">{item.r.name || "—"}</span>
                    <span className="lcell lcell-lg">
                      {slot} {TIME_SLOTS[slot] ? `(${TIME_SLOTS[slot]})` : ""}
                    </span>
                    <span
                      className="lcell lcell-lg"
                      style={{ opacity: item.r.memo ? 1 : 0.35 }}
                    >
                      {item.r.memo || "—"}
                    </span>
                    <span className="lcell lcell-sm">
                      <button
                        className="key-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveLocker(item);
                        }}
                      >
                        🔑 반납
                      </button>
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
