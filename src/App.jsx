import { useState, useEffect, useCallback, useRef } from "react";
import { getAdminToken, handleUnauthorized, clearAdminToken } from "./adminAuth.js";
import "./App.css";

/* ── 시간부 정보 ── */
const TIME_SLOTS = {
  "1부": "10:00 – 13:00",
  "2부": "13:30 – 15:30",
  "3부": "16:00 – 18:00",
  "4부": "18:30 – 21:00",
};

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

/* 객실 표기 정규화 (대소문자·공백 무시): "a 102" → "A102" */
function normalizeRoom(s) {
  return String(s || "").toUpperCase().replace(/\s+/g, "");
}

/* ── 객실 입력 한글 자판 보정용 매핑 (ㅁ→A 등) ── */
const EN2KO = {
  q: "ㅂ", w: "ㅈ", e: "ㄷ", r: "ㄱ", t: "ㅅ", y: "ㅛ", u: "ㅕ", i: "ㅑ", o: "ㅐ", p: "ㅔ",
  a: "ㅁ", s: "ㄴ", d: "ㅇ", f: "ㄹ", g: "ㅎ", h: "ㅗ", j: "ㅓ", k: "ㅏ", l: "ㅣ",
  z: "ㅋ", x: "ㅌ", c: "ㅊ", v: "ㅍ", b: "ㅠ", n: "ㅜ", m: "ㅡ",
  Q: "ㅃ", W: "ㅉ", E: "ㄸ", R: "ㄲ", T: "ㅆ", O: "ㅒ", P: "ㅖ",
};
/* 객실 입력 보정: 한글 자판으로 친 동 접두사를 영문으로 치환
   (ㅁ=A, ㅠ=B, ㅊ=C, ㅔ=P, ㅗ=H 등 — 자모를 해당 키의 영문자로) */
const KO2EN = Object.entries(EN2KO).reduce((acc, [en, ko]) => {
  if (!(ko in acc)) acc[ko] = en.toUpperCase();
  return acc;
}, {});
function fixRoomInput(s) {
  return String(s)
    .split("")
    .map((ch) => KO2EN[ch] || ch)
    .join("")
    .toUpperCase();
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

/* 약식 락커 입력 파싱: "M12" → 남 12, "W23" → 여 23 (남/여 한글도 허용)
   한/영 전환 없이 친 경우도 인식: M키=ㅡ, W키=ㅈ */
function parseShorthand(token) {
  const t = String(token).trim();
  if (!t) return null;
  const first = t[0];
  if (first === "M" || first === "m" || first === "남" || first === "ㅡ")
    return { gender: "남", number: t.slice(1).trim() };
  if (first === "W" || first === "w" || first === "여" || first === "ㅈ")
    return { gender: "여", number: t.slice(1).trim() };
  return { gender: "남", number: t }; // 접두사 없으면 남자로 간주
}

/* ── API 헬퍼 ── */
const STORAGE_KEY = "reservation_desk_api_url";

function getSavedUrl() {
  // 직원용 백엔드 주소는 환경변수(VITE_ADMIN_API_URL) 우선
  const fromEnv = import.meta.env.VITE_ADMIN_API_URL;
  if (fromEnv) return String(fromEnv).trim();
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

/* 모든 직원 요청에 토큰을 실어 보냅니다 (서버가 검증) */
function withToken(params) {
  params.set("token", getAdminToken());
  return params;
}
/* 인증 실패 응답이면 로그인 화면으로 되돌림 */
function checkAuth(json) {
  if (json && json.unauthorized) {
    handleUnauthorized();
    return false;
  }
  return true;
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
  const hasGender = "MmWw남여ㅡㅈ".includes(q[0]); // ㅡ=M키, ㅈ=W키 (한글 자판)
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
function RegisterForm({ onSubmit, dayReservations }) {
  const [room, setRoom] = useState("");
  const [headcount, setHeadcount] = useState("1");
  const [tokens, setTokens] = useState([""]); // 약식 락커 입력 칸들
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const roomRef = useRef(null);
  const lockerFirstRef = useRef(null); // 객실에서 Tab → 락커 첫 칸 바로 이동
  const composingRef = useRef(false); // 한글 IME 조합 중 여부 (조합 중 변환 금지)

  /* 유효한 락커 수만큼 입장 인원 자동 반영 */
  useEffect(() => {
    const n = tokens.filter((t) => {
      const p = parseShorthand(t);
      return p && p.number.trim();
    }).length;
    if (n >= 1) setHeadcount(String(n));
  }, [tokens]);

  /* 오늘 이 객실의 입장 기록 + 현재 입장 인원
     현재 입장 인원 = 반납되지 않은 활성 락커 수 (락커 반납 시 자동 감소) */
  const roomKey = normalizeRoom(room);
  const roomRows = roomKey
    ? (dayReservations || []).filter(
        (r) => normalizeRoom(r.room) === roomKey && !r.canceledAt
      )
    : [];
  const hasPrior = roomRows.length > 0;
  const presentCount = roomRows.reduce((sum, r) => {
    if (r.returnedAt) return sum; // 전원 반납(퇴장)된 건 제외
    const lockerN = parseLockers(r.locker).length;
    return sum + (lockerN || Number(r.headcount) || 0);
  }, 0);

  const addN = parseInt(headcount, 10) || 0;
  const newPresent = presentCount + addN;

  const canSubmit = room.trim() && addN >= 1 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const label = room.trim();
    const ok = await onSubmit({
      room: label,
      headcount: String(addN),
      locker: tokensToLocker(tokens),
      memo: memo.trim(),
    });
    setSaving(false);
    if (ok) {
      setRoom("");
      setHeadcount("1");
      setTokens([""]);
      setMemo("");
      setSavedMsg(`✓ ${label} ${addN}명 입장 등록`);
      setTimeout(() => setSavedMsg(""), 2500);
      setTimeout(() => roomRef.current && roomRef.current.focus(), 0);
    }
  };

  return (
    <div className="register-card">
      <div className="register-head">
        <span className="register-icon">🚶</span>
        <div>
          <h2>현장 입장 등록</h2>
          <p>객실 입력 시 오늘 입장 기록과 현재 입장 인원을 알려드립니다.</p>
        </div>
      </div>

      {/* 객실 + 입장 인원 */}
      <div className="register-grid">
        <div>
          <label className="label">객실 호수 *</label>
          <input
            ref={roomRef}
            className="input"
            value={room}
            onCompositionStart={() => (composingRef.current = true)}
            onCompositionEnd={(e) => {
              composingRef.current = false;
              setRoom(fixRoomInput(e.target.value));
            }}
            onChange={(e) =>
              setRoom(
                composingRef.current ? e.target.value : fixRoomInput(e.target.value)
              )
            }
            onKeyDown={(e) => {
              // 신속 등록: 객실에서 Tab → 락커 첫 칸으로 바로 이동
              if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                lockerFirstRef.current && lockerFirstRef.current.focus();
              }
            }}
            placeholder="예: A102 (ㅁ102도 인식)"
            autoFocus
          />
        </div>
        <div>
          <label className="label">입장 인원 * (락커 수 자동)</label>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            className="input"
            value={headcount}
            onChange={(e) => setHeadcount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>
      </div>

      {/* 이 객실 오늘 입장 기록 + 현재 입장 인원 (주력 — 이전 기록 체크) */}
      {hasPrior && (
        <div className={`present-box ${presentCount > 0 ? "warn" : "ok"}`}>
          {presentCount > 0 ? (
            <div className="present-line present-warn">
              ⚠️ 이 객실 현재 <b>{presentCount}명</b> 입장 중 — 이전 기록 있음
            </div>
          ) : (
            <div className="present-line present-ok">
              ℹ️ 이 객실 오늘 입장 기록 있음 · 전원 반납되어 현재 0명
            </div>
          )}
          {presentCount > 0 && addN >= 1 && (
            <div className="present-sub">
              이번 {addN}명 추가 시 총 <b>{newPresent}명</b> 입장 · 객실 무료 인원 초과 여부를 확인하세요
            </div>
          )}
          <div className="room-history">
            {roomRows.map((r, i) => {
              const activeN = r.returnedAt ? 0 : parseLockers(r.locker).length;
              return (
                <div key={i} className="room-history-row">
                  <span className="rh-head">
                    {r.headcount ? `${r.headcount}명 입장` : "—"}
                  </span>
                  {r.locker ? <span className="rh-locker">🔐 {r.locker}</span> : null}
                  <span className={`rh-status ${r.returnedAt ? "returned" : ""}`}>
                    {r.returnedAt ? "반납 완료 (퇴장)" : `현재 ${activeN}명 이용 중`}
                  </span>
                  {r.memo ? <span className="rh-memo">{r.memo}</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 락커 약식 입력 */}
      <div style={{ marginTop: 18 }}>
        <LockerEditor
          tokens={tokens}
          setTokens={setTokens}
          onEnter={handleSubmit}
          firstInputRef={lockerFirstRef}
        />
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
        {saving ? "등록중…" : "＋ 입장 등록 (Enter)"}
      </button>

      {savedMsg && <div className="register-saved">{savedMsg}</div>}
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
   락커 현황 — 선택한 행의 메모 보기/작성
   ================================================================ */
function LockerMemoEditor({ r, onSave }) {
  const [memo, setMemo] = useState(r.memo || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 외부 데이터 변경 시 동기화
  useEffect(() => {
    setMemo(r.memo || "");
  }, [r.memo]);

  const dirty = memo !== (r.memo || "");

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    await onSave(r.rowIndex, r.locker, memo);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="locker-memo" onClick={(e) => e.stopPropagation()}>
      <span className="locker-memo-label">
        📝 {r.room} · {r.name || "—"}
      </span>
      <input
        className="input locker-memo-input"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        placeholder="메모 입력 (Enter 저장)"
      />
      <button
        className={`btn ${saved ? "btn-saved" : dirty ? "btn-primary" : "btn-default"}`}
        onClick={handleSave}
        disabled={saving || !dirty}
      >
        {saving ? "저장중…" : saved ? "✓ 저장됨" : "저장"}
      </button>
    </div>
  );
}

/* ================================================================
   오늘 입장객 현황판 (누적 입장 인원 카운터)
   ================================================================ */
function DailyEntryPanel({ present, presentRooms, total }) {
  return (
    <aside className="slot-aside">
      <div className="slot-aside-title">🏊 오늘 입장 현황</div>
      <div className="entry-big">
        {present}
        <span className="entry-unit">명</span>
      </div>
      <div className="entry-caption">현재 이용 중 (락커 기준 · 반납 시 감소)</div>
      <div className="entry-subs">
        <div className="entry-sub">
          현재 <b>{presentRooms}</b> 객실 이용 중
        </div>
        <div className="entry-sub entry-cumulative">
          오늘 누적 <b>{total}</b>명 입장
        </div>
      </div>
      <div className="slot-aside-foot">⟳ 15초마다 자동 갱신 · 오늘 기록 기준</div>
    </aside>
  );
}

/* ================================================================
   Main App
   ================================================================ */
export default function App() {
  const [apiUrl, setApiUrl] = useState(getSavedUrl);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate] = useState(getToday());
  const [tab, setTab] = useState("register"); // register | lockers
  const [keyQuery, setKeyQuery] = useState(""); // 락커 현황 키 검색
  const [leftRooms, setLeftRooms] = useState(() => new Set()); // 일행 잔류 강조 객실
  const [selected, setSelected] = useState(() => new Set()); // 다중 반납 선택
  const fetchId = useRef(0);
  const mutationCount = useRef(0); // 진행 중인 저장/반납 수 (새로고침 경쟁 방지)
  const lastMutationAt = useRef(0); // 마지막 변경 완료 시각 (낡은 응답 폐기 기준)

  /* ── API URL 저장 ── */
  const saveUrl = (url) => {
    setSavedUrl(url);
    setApiUrl(url);
  };

  /* ── 예약(락커) 데이터 조회 ── */
  const fetchData = useCallback(
    async (room, name, date) => {
      if (!apiUrl) return;
      setLoading(true);
      const id = ++fetchId.current;
      const startedAt = Date.now();

      try {
        const params = new URLSearchParams();
        if (date) params.set("date", date);

        const resp = await fetch(`${apiUrl}?${withToken(params).toString()}`);
        const json = await resp.json();
        if (fetchId.current !== id) return;
        if (!checkAuth(json)) return;
        // 반납/저장 진행 중이거나 그 완료 이전에 출발한 응답은 낡은 데이터일 수
        // 있으므로 폐기 (반납한 키가 잠깐 되살아나는 현상 방지)
        if (mutationCount.current > 0 || startedAt <= lastMutationAt.current) return;

        if (!json.error) {
          const sorted = (json.reservations || []).sort(
            (a, b) => slotOrder(a.timeSlot) - slotOrder(b.timeSlot)
          );
          setReservations(sorted);
        }
      } catch {
        /* 조회 실패 시 기존 목록 유지 (자동 새로고침이 다시 시도) */
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

  /* ── 자동 새로고침 (모든 탭에서 하루치 전체를 주기적으로 갱신) ── */
  useEffect(() => {
    if (!apiUrl) return;
    const timer = setInterval(() => {
      if (mutationCount.current > 0) return; // 저장/반납 중엔 갱신 보류
      fetchData("", "", selectedDate);
    }, 15000);
    return () => clearInterval(timer);
  }, [apiUrl, selectedDate, fetchData]);

  /* ── 락커 저장 (낙관적 업데이트: 즉시 화면 반영, 실패 시 되돌림) ── */
  const handleUpdate = async (rowIndex, locker, memo) => {
    const target = reservations.find((r) => r.rowIndex === rowIndex);
    const before = target
      ? { locker: target.locker, memo: target.memo, assignedAt: target.assignedAt }
      : null;
    const assignedAt = locker ? new Date().toString() : "";
    setReservations((prev) =>
      prev.map((r) =>
        r.rowIndex === rowIndex ? { ...r, locker, memo, assignedAt } : r
      )
    );
    mutationCount.current += 1;
    try {
      await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({ action: "updateLocker", token: getAdminToken(), rowIndex, locker, memo }),
      });
    } catch {
      if (before)
        setReservations((prev) =>
          prev.map((r) => (r.rowIndex === rowIndex ? { ...r, ...before } : r))
        );
      alert("저장 실패 — 네트워크를 확인해주세요.");
    } finally {
      mutationCount.current -= 1;
      lastMutationAt.current = Date.now();
    }
  };

  /* ── 반납 처리 (행 삭제 대신 L열에 반납 시각 기록 → 시트엔 취소선, 현황에선 제외)
        낙관적 업데이트: 클릭 즉시 목록에서 제거, 실패 시 되돌림 ── */
  const handleMarkReturned = async (rowIndices) => {
    const marked = new Set(rowIndices);
    const prevReturned = new Map();
    reservations.forEach((r) => {
      if (marked.has(r.rowIndex)) prevReturned.set(r.rowIndex, r.returnedAt || "");
    });
    const now = new Date().toString();
    setReservations((prev) =>
      prev.map((r) => (marked.has(r.rowIndex) ? { ...r, returnedAt: now } : r))
    );
    mutationCount.current += 1;
    try {
      await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({ action: "markReturned", token: getAdminToken(), rowIndices }),
      });
    } catch {
      setReservations((prev) =>
        prev.map((r) =>
          prevReturned.has(r.rowIndex)
            ? { ...r, returnedAt: prevReturned.get(r.rowIndex) }
            : r
        )
      );
      alert("반납 처리 실패 — 네트워크를 확인해주세요.");
    } finally {
      mutationCount.current -= 1;
      lastMutationAt.current = Date.now();
    }
  };

  /* ── 현장 입장 등록 (당일만 기록) ── */
  const handleAddReservation = async (data) => {
    const today = getToday();
    try {
      await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({
          action: "addReservation",
          token: getAdminToken(),
          source: "현장",
          site: "휘닉스",
          date: today, // 당일만 기록 (예약일 필드 제거)
          timeSlot: "", // 부 개념 없음
          ...data,
        }),
      });
      fetchData("", "", today);
      return true;
    } catch {
      alert("등록 실패 — 네트워크를 확인해주세요.");
      return false;
    }
  };

  /* ── 락커 배정된 건 (예약별 다수 락커를 평탄화, 반납·취소 행은 제외) ── */
  const allLockers = reservations
    .filter((r) => r.locker && !r.returnedAt && !r.canceledAt)
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
      // 마지막 키 → 반납 처리(취소선)
      await handleMarkReturned([r.rowIndex]);
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
    const toReturn = [];
    const tasks = []; // 행별 요청 병렬 전송 (순차 대기 제거)

    for (const { r, rm } of Object.values(byRow)) {
      const remaining = parseLockers(r.locker).filter(
        (l) => !rm.has(`${l.gender}|${l.number}`)
      );
      if (remaining.length === 0) {
        toReturn.push(r.rowIndex); // 마지막 키 → 반납 처리 대상
      } else {
        tasks.push(handleUpdate(r.rowIndex, serializeLockers(remaining), r.memo || ""));
      }
    }

    if (toReturn.length > 0) tasks.push(handleMarkReturned(toReturn));
    await Promise.all(tasks);

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

  /* ── 오늘 입장 현황 집계 ──
     현재 이용 중 = 반납 안 된 활성 락커 수 (락커 반납 시 감소)
     오늘 누적 = 취소되지 않은 모든 입장 인원 합 (반납해도 줄지 않음) */
  const active = reservations.filter((r) => !r.canceledAt);
  const dailyTotal = active.reduce((sum, r) => sum + (Number(r.headcount) || 0), 0);
  const currentPresent = allLockers.length;
  const presentRooms = new Set(
    allLockers.map((it) => normalizeRoom(it.r.room))
  ).size;

  /* ── 오늘 데이터 전체 초기화 ── */
  const handleClearAll = async () => {
    if (
      !window.confirm(
        "오늘 입장 기록을 전부 삭제할까요?\n\n되돌릴 수 없습니다. (다음 영업일 시작 전 초기화용)"
      )
    )
      return;
    mutationCount.current += 1;
    try {
      await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({ action: "clearAll", token: getAdminToken() }),
      });
      setReservations([]);
      setSelected(new Set());
      setLeftRooms(new Set());
    } catch {
      alert("초기화 실패 — 네트워크를 확인해주세요.");
    } finally {
      mutationCount.current -= 1;
      lastMutationAt.current = Date.now();
    }
  };

  /* ── Setup ── */
  if (!apiUrl) return <SetupScreen onSave={saveUrl} />;

  return (
    <div className="shell">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <span className="logo">🏊</span>
          <div>
            <h1>입장 · 락커 관리</h1>
            <div className="sub">프론트 데스크 · 오늘 {dailyTotal}명 입장</div>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-danger reset-btn" onClick={handleClearAll}>
            🗑 오늘 데이터 초기화
          </button>
          <button
            className="settings-btn"
            onClick={() => {
              if (window.confirm("로그아웃하시겠습니까? (토큰이 삭제됩니다)")) {
                clearAdminToken();
                window.location.reload();
              }
            }}
          >
            ⚙ 로그아웃
          </button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="tabs">
        <button
          className={`tab-btn ${tab === "register" ? "active" : ""}`}
          onClick={() => setTab("register")}
        >
          🚶 현장 등록
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
      </div>

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
                    if (!window.confirm(`확인된 ${overdueLockers.length}건을 반납 처리할까요? (시트에 취소선 표시)`)) return;
                    const byRow = {};
                    overdueLockers.forEach((it) => {
                      if (!byRow[it.r.rowIndex])
                        byRow[it.r.rowIndex] = { r: it.r, rm: new Set() };
                      byRow[it.r.rowIndex].rm.add(`${it.gender}|${it.number}`);
                    });
                    const toReturn = [];
                    const tasks = [];
                    for (const { r, rm } of Object.values(byRow)) {
                      const remaining = parseLockers(r.locker).filter(
                        (l) => !rm.has(`${l.gender}|${l.number}`)
                      );
                      if (remaining.length === 0) toReturn.push(r.rowIndex);
                      else tasks.push(handleUpdate(r.rowIndex, serializeLockers(remaining), r.memo || ""));
                    }
                    if (toReturn.length > 0) tasks.push(handleMarkReturned(toReturn));
                    await Promise.all(tasks);
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
              onClick={() => fetchData("", "", selectedDate)}
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
                    행을 클릭하면 선택 + 메모 칸이 열립니다 · 여러 키를 한 번에 반납할 수 있어요
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
                // 같은 예약(행)의 락커가 여러 개 선택돼도 메모 칸은 첫 번째에만
                const showMemo =
                  isSelected &&
                  visibleLockers.findIndex(
                    (x) => x.r.rowIndex === item.r.rowIndex && selected.has(keyId(x))
                  ) === idx;
                return (
                  <div key={`${item.r.rowIndex}-${idx}`} className="locker-row-wrap">
                  <div
                    className={cls}
                    onClick={() => toggleSelect(id)}
                    title="클릭하여 선택 / 해제 (메모 칸이 열립니다)"
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
                  {showMemo && (
                    <LockerMemoEditor r={item.r} onSave={handleUpdate} />
                  )}
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
        <div className="content content-flex">
          <div className="main-col">
            <RegisterForm
              onSubmit={handleAddReservation}
              dayReservations={reservations}
            />
          </div>
          <DailyEntryPanel
            present={currentPresent}
            presentRooms={presentRooms}
            total={dailyTotal}
          />
        </div>
      )}
    </div>
  );
}
