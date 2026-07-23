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

function parseDate(str) {
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const m = str.match(/(\d{4})[.\-/\s]+(\d{1,2})[.\-/\s]+(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return str;
}

/* 접수 시각(타임스탬프)을 "7/10 14:23" 형태로 축약 */
function formatTimestamp(raw) {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d)) return String(raw);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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

/* 투숙 이력 조회 범위 (최대 10박까지 커버) */
const HISTORY_DAYS = 10;

/* 날짜 이동: shiftDate("2026-07-12", -1) → "2026-07-11" */
function shiftDate(dateStr, delta) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ""));
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* 고객 식별 키 (POS 확인 기준과 동일: 시설 + 객실 + 성함) */
function guestKey(r) {
  return `${r.site || "휘닉스"}|${normalizeRoom(r.room)}|${String(r.name || "").trim()}`;
}

/* ── 영타 → 한글 변환 (두벌식) : "rla" → "김" ──
   바쁠 때 한/영 안 바꾸고 영문으로 친 성함도 검색되게 하기 위함 */
const EN2KO = {
  q: "ㅂ", w: "ㅈ", e: "ㄷ", r: "ㄱ", t: "ㅅ", y: "ㅛ", u: "ㅕ", i: "ㅑ", o: "ㅐ", p: "ㅔ",
  a: "ㅁ", s: "ㄴ", d: "ㅇ", f: "ㄹ", g: "ㅎ", h: "ㅗ", j: "ㅓ", k: "ㅏ", l: "ㅣ",
  z: "ㅋ", x: "ㅌ", c: "ㅊ", v: "ㅍ", b: "ㅠ", n: "ㅜ", m: "ㅡ",
  Q: "ㅃ", W: "ㅉ", E: "ㄸ", R: "ㄲ", T: "ㅆ", O: "ㅒ", P: "ㅖ",
};
const KO_CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ".split("");
const KO_JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ".split("");
const KO_JONG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const KO_VOWELS = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅛㅜㅠㅡㅣ";
const KO_CONS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const VOWEL_COMBO = {
  ㅗ: { ㅏ: "ㅘ", ㅐ: "ㅙ", ㅣ: "ㅚ" },
  ㅜ: { ㅓ: "ㅝ", ㅔ: "ㅞ", ㅣ: "ㅟ" },
  ㅡ: { ㅣ: "ㅢ" },
};
const JONG_COMBO = {
  ㄱ: { ㅅ: "ㄳ" }, ㄴ: { ㅈ: "ㄵ", ㅎ: "ㄶ" },
  ㄹ: { ㄱ: "ㄺ", ㅁ: "ㄻ", ㅂ: "ㄼ", ㅅ: "ㄽ", ㅌ: "ㄾ", ㅍ: "ㄿ", ㅎ: "ㅀ" },
  ㅂ: { ㅅ: "ㅄ" },
};
const JONG_SPLIT = {
  ㄳ: ["ㄱ", "ㅅ"], ㄵ: ["ㄴ", "ㅈ"], ㄶ: ["ㄴ", "ㅎ"], ㄺ: ["ㄹ", "ㄱ"], ㄻ: ["ㄹ", "ㅁ"],
  ㄼ: ["ㄹ", "ㅂ"], ㄽ: ["ㄹ", "ㅅ"], ㄾ: ["ㄹ", "ㅌ"], ㄿ: ["ㄹ", "ㅍ"], ㅀ: ["ㄹ", "ㅎ"], ㅄ: ["ㅂ", "ㅅ"],
};

function engToKorean(input) {
  let out = "";
  let cur = null; // { cho, jung, jong }
  const flush = () => {
    if (!cur) return;
    if (cur.cho && cur.jung) {
      const ci = KO_CHO.indexOf(cur.cho);
      const ji = KO_JUNG.indexOf(cur.jung);
      const ki = cur.jong ? KO_JONG.indexOf(cur.jong) : 0;
      if (ci >= 0 && ji >= 0 && ki >= 0) {
        out += String.fromCharCode(0xac00 + (ci * 21 + ji) * 28 + ki);
      } else {
        out += (cur.cho || "") + (cur.jung || "") + (cur.jong || "");
      }
    } else {
      out += (cur.cho || "") + (cur.jung || "") + (cur.jong || "");
    }
    cur = null;
  };

  for (const ch of String(input)) {
    const j = EN2KO[ch] || EN2KO[ch.toLowerCase()];
    if (!j) {
      flush();
      out += ch;
      continue;
    }
    if (KO_VOWELS.includes(j)) {
      if (cur && cur.jung) {
        if (!cur.jong && VOWEL_COMBO[cur.jung] && VOWEL_COMBO[cur.jung][j]) {
          cur.jung = VOWEL_COMBO[cur.jung][j];
        } else if (cur.jong) {
          const split = JONG_SPLIT[cur.jong];
          const move = split ? split[1] : cur.jong;
          cur.jong = split ? split[0] : "";
          flush();
          cur = { cho: move, jung: j, jong: "" };
        } else {
          flush();
          cur = { cho: "", jung: j, jong: "" };
        }
      } else if (cur && cur.cho) {
        cur.jung = j;
      } else {
        flush();
        cur = { cho: "", jung: j, jong: "" };
      }
    } else if (KO_CONS.includes(j)) {
      if (cur && cur.jung && !cur.jong) {
        cur.jong = j;
      } else if (cur && cur.jung && cur.jong) {
        if (JONG_COMBO[cur.jong] && JONG_COMBO[cur.jong][j]) {
          cur.jong = JONG_COMBO[cur.jong][j];
        } else {
          flush();
          cur = { cho: j, jung: "", jong: "" };
        }
      } else {
        flush();
        cur = { cho: j, jung: "", jong: "" };
      }
    }
  }
  flush();
  return out;
}

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

/* 성함 검색 후보 생성: 원문 + 영타변환 + (CapsLock 대비)소문자 영타변환 */
function nameQueryCandidates(query) {
  const q = String(query || "").trim();
  if (!q) return [];
  return [...new Set([q, engToKorean(q), engToKorean(q.toLowerCase())].filter(Boolean))];
}

/* 현재 시각 기준 시간부 자동 선택 (각 부의 종료 시각이 아직 안 지난 첫 부) */
const SLOT_END_MIN = { "1부": 13 * 60, "2부": 15 * 60 + 30, "3부": 18 * 60, "4부": 21 * 60 };
function getCurrentSlot() {
  const d = new Date();
  const mins = d.getHours() * 60 + d.getMinutes();
  for (const key of Object.keys(TIME_SLOTS)) {
    if (mins <= SLOT_END_MIN[key]) return key;
  }
  return Object.keys(TIME_SLOTS).slice(-1)[0]; // 영업 종료 후엔 마지막 부
}

/* 레이트 체크아웃 적용 표시 (G열 저장값 / 판별)
   컴플레인 등으로 레이트 체크아웃을 약속한 고객을 직원이 표시해 두는 용도 */
const LATE_YES = "네, 적용해 주세요.";
const hasLateCheckout = (r) => String(r.lateCheckout || "").includes("적용");

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
function RegisterForm({ defaultDate, onSubmit, dayReservations }) {
  const [room, setRoom] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [timeSlot, setTimeSlot] = useState(getCurrentSlot);
  const [headcount, setHeadcount] = useState("1"); // 기본 1명 (비면 잔여 카운트에 0으로 잡히므로 필수)
  const [tokens, setTokens] = useState([""]); // 약식 락커 입력 칸들
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const roomRef = useRef(null);
  const lockerFirstRef = useRef(null); // 객실에서 Tab → 락커 첫 칸 바로 이동
  const composingRef = useRef(false); // 한글 IME 조합 중 여부 (조합 중 변환 금지)
  const canSubmit = room.trim() && parseInt(headcount, 10) >= 1 && !saving;

  /* 유효한 락커 수만큼 입장 인원 자동 반영 (락커 없이 등록하는 경우는 기본 1 유지) */
  useEffect(() => {
    const n = tokens.filter((t) => {
      const p = parseShorthand(t);
      return p && p.number.trim();
    }).length;
    if (n >= 1) setHeadcount(String(n));
  }, [tokens]);

  /* 입력한 객실이 오늘 이미 예약/입장했는지 (추가 입장·다른 부 재입장 판별용) */
  const roomKey = normalizeRoom(room);
  const roomInfo = roomKey
    ? (dayReservations || []).filter((r) => normalizeRoom(r.room) === roomKey)
    : [];
  const roomTotal = roomInfo.reduce((sum, r) => sum + (Number(r.headcount) || 0), 0);

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
      setHeadcount("1");
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
          <p>객실 → Tab → 락커 → Enter. 인원은 락커 수만큼 자동 반영됩니다.</p>
        </div>
      </div>

      {/* 객실 + 입장 인원 (인원은 잔여 카운트에 반영되므로 필수) */}
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
              if (e.key === "Enter") handleSubmit();
              else if (e.key === "Tab" && !e.shiftKey) {
                // 인원 칸 건너뛰고 락커로 (인원은 락커 수 자동 반영)
                e.preventDefault();
                if (lockerFirstRef.current) lockerFirstRef.current.focus();
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
            placeholder="예: 2"
          />
        </div>
      </div>

      {/* 이미 등록된 객실 안내 (추가 입장 / 다른 부 재입장 판별) */}
      {roomInfo.length > 0 && (
        <div className="room-history">
          <div className="room-history-title">
            ⚠️ 이 객실은 오늘 이미 {roomInfo.length}건 등록됨 · 총 {roomTotal}명
          </div>
          {roomInfo.map((r, i) => (
            <div key={i} className="room-history-row">
              <span
                className={`src-badge ${r.source === "현장" ? "src-onsite" : "src-form"}`}
              >
                {r.source === "현장" ? "현장" : "폼예약"}
              </span>
              <span className="rh-slot">{matchSlot(r.timeSlot) || "—"}</span>
              <span className="rh-head">{r.headcount ? `${r.headcount}명` : "—"}</span>
              {r.locker ? <span className="rh-locker">🔐 {r.locker}</span> : null}
            </div>
          ))}
          <div className="room-history-hint">
            추가 입장인지 · 다른 부 재입장인지 확인하세요 (객실 정원 초과 시 최대 2인 추가 결제)
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
function ReservationCard({ r, onUpdate, prevInfo }) {
  const needsCheck = !!(prevInfo && prevInfo.had);
  const [tokens, setTokens] = useState(() => lockerToTokens(r.locker));
  const [memo, setMemo] = useState(r.memo || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lockerRef = useRef(null);

  const serialized = tokensToLocker(tokens);
  const dirty = serialized !== (r.locker || "") || memo !== (r.memo || "");

  // 외부 데이터 변경 시 동기화
  useEffect(() => {
    setTokens(lockerToTokens(r.locker));
    setMemo(r.memo || "");
  }, [r.locker, r.memo]);

  // 펼칠 때 락커 입력 칸으로 자동 포커스
  useEffect(() => {
    if (expanded && lockerRef.current) lockerRef.current.focus();
  }, [expanded]);

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
    <div
      className={`card ${expanded ? "card-expanded" : ""} ${needsCheck ? "card-check" : ""}`}
    >
      {/* 요약 (클릭하면 락커·메모 펼침) */}
      <div
        className="card-summary"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
      >
        {/* 상단: 예약자 성함(우선) + 시간부 */}
        <div className="card-top">
          <div className="name-lead">{r.name || "(성함 없음)"}</div>
          {r.site === "플캠" && <span className="site-chip">플캠</span>}
          {hasLateCheckout(r) && (
            <span
              className="late-badge"
              title="레이트 체크아웃 적용 대상입니다. 퇴실 시 반드시 적용해 주세요."
            >
              🕐 레이트 체크아웃
            </span>
          )}
          {needsCheck && (
            <span
              className="check-badge"
              title="투숙 중 이전 예약 이력이 있는 1부 예약입니다. 몇 박 투숙인지 확인해 잔여 이용 횟수를 따져 주세요."
            >
              ⚠️ 확인 필요 · 이전 이용 {prevInfo.usedCount}회
            </span>
          )}
          {prevInfo && !prevInfo.had && (
            <span
              className="ok-badge"
              title="최근 이전 예약 이력이 없는 1부 예약입니다. 미이용 고객이므로 혜택 대상입니다."
            >
              ✅ 이전 이용 없음
            </span>
          )}
          <div className="slot-badge">
            {slot}
            {slotTime && <span className="time">{slotTime}</span>}
          </div>
        </div>

        {/* 예약 정보: 객실 + 인원 */}
        <div className="card-body">
          <div>
            <div className="field-label">객실 호수</div>
            <div className="field-value field-value-lg">{r.room}</div>
          </div>
          {r.headcount ? (
            <div>
              <div className="field-label">입장 인원</div>
              <div className="field-value field-value-lg">{r.headcount}명</div>
            </div>
          ) : null}
        </div>

        {/* 하단: 락커 배정 상태 요약 + 펼침 안내 */}
        <div className="card-summary-foot">
          {savedLockers.length > 0 ? (
            <span className="summary-lockers">
              🔐{" "}
              {savedLockers.map((l, i) => (
                <span
                  key={i}
                  className={`locker-chip ${l.gender === "남" ? "male" : "female"}`}
                >
                  {l.gender} {l.number}
                </span>
              ))}
            </span>
          ) : (
            <span className="summary-nolocker">락커 미배정</span>
          )}
          <span className="expand-hint">{expanded ? "▲ 접기" : "▼ 락커 · 메모"}</span>
        </div>

        {hasLateCheckout(r) && (
          <div className="late-note">
            🕐 <b>레이트 체크아웃 적용 대상</b>입니다 — 퇴실 시 반드시 적용해 주세요.
          </div>
        )}

        {needsCheck && (
          <div className="check-note">
            <div className="check-note-line">
              이전 예약 이력 <b>{prevInfo.items.length}건</b> · 락커 배정 기록{" "}
              <b className="check-used">{prevInfo.usedCount}회</b> (= 실제 이용 추정)
            </div>
            <ul className="check-note-list check-history">
              {prevInfo.items.map((it, i) => (
                <li key={i}>
                  {it.date} <b>{it.slot}</b> —{" "}
                  {it.used ? (
                    <b className="check-used">락커 O (이용함)</b>
                  ) : (
                    <b className="check-noshow">락커 X (노쇼 가능)</b>
                  )}
                </li>
              ))}
            </ul>
            <div className="check-note-line check-note-ask">
              👉 <b>몇 박 투숙인지 확인해 주세요.</b> (1박당 1회 이용)
            </div>
            <ul className="check-note-list">
              <li>
                <b>투숙 박수 − 이미 이용한 횟수 = 잔여 횟수.</b> 잔여가 남아 있으면 오늘
                이용은 정상입니다. (예: 3박인데 2회만 이용 → 1회 남음)
              </li>
              <li>
                <b>오늘 퇴실</b>이고 <b>잔여 횟수가 없다면</b> 퇴실 당일 1부·레이트
                체크아웃 혜택 대상이 아닙니다.
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* 상세 (펼침) — 락커·메모 입력 */}
      {expanded && (
        <div className="card-detail">
          <LockerEditor
            tokens={tokens}
            setTokens={setTokens}
            onEnter={handleSave}
            firstInputRef={lockerRef}
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
   부별 실시간 예약 현황판 (오른쪽 고정, 스크롤 따라옴)
   ================================================================ */
function SlotStatusPanel({ totals, capacity = 180, date, onDateChange }) {
  const nowSlot = getCurrentSlot(); // 지금 접수 기준 부 (현장 등록 자동 선택과 동일)
  const [showPicker, setShowPicker] = useState(false);
  const isToday = !date || date === getToday();
  return (
    <aside className="slot-aside">
      <div className="slot-aside-title">
        <span>🏊 부별 예약 인원</span>
        {onDateChange && (
          <button
            className="slot-aside-cal"
            onClick={() => setShowPicker((v) => !v)}
            title="날짜 선택"
          >
            📅
          </button>
        )}
      </div>
      {onDateChange && (
        <>
          <div className={`slot-aside-date ${isToday ? "" : "other"}`}>
            {isToday ? `오늘 · ${date}` : date}
          </div>
          {showPicker && (
            <input
              type="date"
              className="input slot-aside-input"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          )}
        </>
      )}
      {Object.entries(TIME_SLOTS).map(([k, time]) => {
        const n = totals[k] || 0;
        const pct = Math.min(100, Math.round((n / capacity) * 100));
        const full = n >= capacity;
        const isNow = isToday && k === nowSlot; // "현재"는 오늘일 때만
        return (
          <div
            key={k}
            className={`slot-aside-row ${full ? "full" : ""} ${isNow ? "now" : ""}`}
          >
            <div className="slot-aside-head">
              <span className="slot-aside-name">
                {k}
                {isNow && <span className="now-chip">현재</span>}
              </span>
              <span className="slot-aside-count">
                {n}
                <i>/{capacity}</i>
              </span>
            </div>
            <div className="slot-aside-time">{time}</div>
            <div className="slot-aside-bar">
              <div className="slot-aside-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      <div className="slot-aside-foot">⟳ 15초마다 자동 갱신</div>
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
  const [error, setError] = useState("");
  const [searchRoom, setSearchRoom] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchSlot, setSearchSlot] = useState(""); // "" = 전체, "1부"~"4부" = 해당 부만
  /* 예약자 검색 (전 날짜) — 탭 열 때 한 번만 로드, 필터는 클라이언트 처리 */
  const [guestName, setGuestName] = useState("");
  const [guestRoom, setGuestRoom] = useState("");
  const [allRes, setAllRes] = useState([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allError, setAllError] = useState("");
  const [panelDate, setPanelDate] = useState(getToday()); // 예약자 검색 현황판 조회 날짜
  const [historyRes, setHistoryRes] = useState([]); // 투숙 기간 이용 이력 (최근 10일)
  const [historyLoaded, setHistoryLoaded] = useState(false); // 로드 전엔 "없음"으로 오판 방지
  /* 예약자 검색 편집 상태 */
  const [editId, setEditId] = useState(null); // 편집 중인 rowIndex
  const [editDate, setEditDate] = useState("");
  const [editSlot, setEditSlot] = useState("");
  const [editLate, setEditLate] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [tab, setTab] = useState("register");
  const [keyQuery, setKeyQuery] = useState(""); // 락커 현황 키 검색
  const [leftRooms, setLeftRooms] = useState(() => new Set()); // 일행 잔류 강조 객실
  const [selected, setSelected] = useState(() => new Set()); // 다중 반납 선택
  const fetchId = useRef(0);
  const mutationCount = useRef(0); // 진행 중인 저장/반납 수 (새로고침 경쟁 방지)
  const lastMutationAt = useRef(0); // 마지막 변경 완료 시각 (낡은 응답 폐기 기준)
  const searchComposingRef = useRef(false); // 객실 검색 한글 IME 조합 중 여부

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
      const startedAt = Date.now();

      try {
        const params = new URLSearchParams();
        if (room) params.set("room", room);
        if (name) params.set("name", name);
        if (date) params.set("date", date);

        const resp = await fetch(`${apiUrl}?${withToken(params).toString()}`);
        const json = await resp.json();
        if (fetchId.current !== id) return;
        if (!checkAuth(json)) return;
        // 반납/저장 진행 중이거나 그 완료 이전에 출발한 응답은 낡은 데이터일 수
        // 있으므로 폐기 (반납한 키가 잠깐 되살아나는 현상 방지)
        if (mutationCount.current > 0 || startedAt <= lastMutationAt.current) return;

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

  /* ── 투숙 기간 이용 이력 로드 (퇴실 당일 1부 예외 혜택 판정용)
        1박당 1회이므로 여러 날 투숙 시 잔여 횟수 계산이 필요 → 최근 10일치를 한 번에 조회.
        과거 데이터는 거의 변하지 않으므로 날짜가 바뀔 때만 1회 조회 (폴링 없음) ── */
  useEffect(() => {
    if (!apiUrl || !selectedDate) return;
    const from = shiftDate(selectedDate, -HISTORY_DAYS);
    const to = shiftDate(selectedDate, -1);
    if (!from || !to) return;
    let aborted = false;
    setHistoryLoaded(false);
    (async () => {
      try {
        const params = withToken(
          new URLSearchParams({ action: "range", from, to })
        );
        const resp = await fetch(`${apiUrl}?${params.toString()}`);
        const json = await resp.json();
        if (aborted) return;
        if (!checkAuth(json)) return;
        if (!json.error) {
          setHistoryRes(json.reservations || []);
          setHistoryLoaded(true);
        }
      } catch {
        /* 실패해도 조회는 정상 동작 (뱃지만 생략) */
      }
    })();
    return () => {
      aborted = true;
    };
  }, [apiUrl, selectedDate]);

  /* ── 예약자 검색: 전 날짜 데이터 로드 (탭 열 때 1회 + 수동 새로고침만, 반복 조회 없음) ── */
  const fetchAllDates = useCallback(async () => {
    if (!apiUrl) return;
    setAllLoading(true);
    setAllError("");
    try {
      // 날짜 필터 없이 전체 (직원 토큰 필요)
      const resp = await fetch(`${apiUrl}?${withToken(new URLSearchParams()).toString()}`);
      const json = await resp.json();
      if (!checkAuth(json)) return;
      if (json.error) {
        setAllError(json.error);
      } else {
        setAllRes(json.reservations || []);
      }
    } catch {
      setAllError("서버 연결 실패 — 잠시 후 다시 시도해주세요.");
    } finally {
      setAllLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    if (tab === "guest") fetchAllDates();
  }, [tab, fetchAllDates]);

  /* ── 자동 새로고침 (모든 탭에서 하루치 전체를 주기적으로 갱신) ── */
  useEffect(() => {
    if (!apiUrl) return;
    const timer = setInterval(() => {
      if (mutationCount.current > 0) return; // 저장/반납 중엔 갱신 보류
      fetchData("", "", selectedDate);
    }, 15000);
    return () => clearInterval(timer);
  }, [apiUrl, selectedDate, fetchData]);

  /* ── 수동 새로고침 (검색은 타이핑 즉시 클라이언트에서 필터링) ── */
  const handleRefresh = () => fetchData("", "", selectedDate);

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

  /* ── 예약 편집 (날짜·부·레이트 체크아웃) — 예약자 검색 탭 ── */
  const startEdit = (r) => {
    setEditId(r.rowIndex);
    setEditDate(parseDate(r.date));
    setEditSlot(matchSlot(r.timeSlot) || "1부");
    setEditLate(hasLateCheckout(r));
  };
  const cancelEdit = () => setEditId(null);

  const saveEdit = async (r) => {
    const fields = {
      date: editDate,
      timeSlot: `${editSlot} (${TIME_SLOTS[editSlot]})`,
      lateCheckout: editLate ? LATE_YES : "",
    };
    setEditSaving(true);
    mutationCount.current += 1;
    try {
      await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({ action: "editReservation", token: getAdminToken(), rowIndex: r.rowIndex, ...fields }),
      });
      const patch = (list) =>
        list.map((x) => (x.rowIndex === r.rowIndex ? { ...x, ...fields } : x));
      setAllRes(patch);
      setReservations(patch); // 당일 목록·현황판도 동기화
      setEditId(null);
    } catch {
      alert("수정 실패 — 네트워크를 확인해주세요.");
    } finally {
      setEditSaving(false);
      mutationCount.current -= 1;
      lastMutationAt.current = Date.now();
    }
  };

  /* ── 현장 고객 등록 ── */
  const handleAddReservation = async (data) => {
    try {
      await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({ action: "addReservation", token: getAdminToken(), source: "현장", site: "휘닉스", ...data }),
      });
      // 등록 탭에 머문 채 목록만 갱신 (하루치 전체 — 검색어와 무관하게)
      setSelectedDate(data.date);
      fetchData("", "", data.date);
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

  /* ── 예약 조회: 타이핑 즉시 클라이언트 필터 (하루치 reservations에서 추림) ── */
  /* 현장 등록(H열 "현장")은 폼 예약 조회 목록에서 제외 */
  /* 고객이 취소한 예약(N열)은 어디에도 잡히지 않게 전면 제외 */
  const formReservations = reservations.filter(
    (r) => r.source !== "현장" && !r.canceledAt
  );
  /* 락커가 모두 반납된 예약(returnedAt)은 조회 목록에서 제외 (단, 명단 추출에는 포함) */
  const activeReservations = formReservations.filter((r) => !r.returnedAt);
  const nameCands = nameQueryCandidates(searchName); // 한 번만 계산 (행마다 반복 X)
  const searchResults = activeReservations.filter((r) => {
    const roomOk =
      !searchRoom.trim() ||
      String(r.room).toUpperCase().includes(searchRoom.trim().toUpperCase());
    const nameOk =
      nameCands.length === 0 ||
      nameCands.some((c) => String(r.name).includes(c));
    const slotOk = !searchSlot || matchSlot(r.timeSlot) === searchSlot;
    return roomOk && nameOk && slotOk;
  });

  /* ── 부별 실시간 예약 인원 (선택 날짜 기준, 전체 인원 합산) ── */
  const slotTotals = { "1부": 0, "2부": 0, "3부": 0, "4부": 0 };
  reservations.forEach((r) => {
    if (r.canceledAt) return; // 취소 예약은 정원에서 제외
    const s = matchSlot(r.timeSlot);
    if (s in slotTotals) slotTotals[s] += Number(r.headcount) || 0;
  });

  /* ── 1부 예약의 투숙 중 이용 이력 판정 (퇴실 당일 1부 예외 혜택 검증)
        1박당 1회이므로 "몇 박 투숙 − 이미 이용한 횟수 = 잔여 횟수"를 따져야 함.
        시스템은 투숙 박수를 모르므로, 이전 이력을 나열해 직원이 판단하도록 제공.
        (락커 배정 기록 = 실제 방문 흔적 / 없으면 노쇼 가능성) ── */
  const historyByGuest = {};
  historyRes.forEach((r) => {
    if (r.canceledAt) return;
    const k = guestKey(r);
    (historyByGuest[k] = historyByGuest[k] || []).push(r);
  });
  const prevInfoFor = (r) => {
    if (!historyLoaded) return null;
    if (matchSlot(r.timeSlot) !== "1부") return null;
    const list = historyByGuest[guestKey(r)];
    if (!list || list.length === 0) return { had: false };
    const items = list
      .slice()
      .sort((a, b) => parseDate(a.date).localeCompare(parseDate(b.date)))
      .map((p) => ({
        date: parseDate(p.date),
        slot: matchSlot(p.timeSlot) || "—",
        used: !!(p.locker || p.returnedAt),
      }));
    return {
      had: true,
      items,
      usedCount: items.filter((i) => i.used).length, // 락커 기록이 있는 = 실제 이용
    };
  };

  /* ── 예약자 검색 (전 날짜): 필터 + 이용일·부·접수순 정렬 ── */
  const guestNameCands = nameQueryCandidates(guestName);
  const guestHasQuery = Boolean(guestName.trim() || guestRoom.trim());
  const guestResults = !guestHasQuery
    ? []
    : allRes
        .filter((r) => {
          const roomOk =
            !guestRoom.trim() ||
            normalizeRoom(r.room).includes(normalizeRoom(guestRoom));
          const nameOk =
            guestNameCands.length === 0 ||
            guestNameCands.some((c) => String(r.name).includes(c));
          return roomOk && nameOk;
        })
        .sort(
          (a, b) =>
            parseDate(a.date).localeCompare(parseDate(b.date)) ||
            slotOrder(a.timeSlot) - slotOrder(b.timeSlot) ||
            a.rowIndex - b.rowIndex
        );

  /* ── 예약자 검색 현황판: 선택 날짜(panelDate)의 부별 인원 (전 날짜 데이터에서 집계) ── */
  const panelTotals = { "1부": 0, "2부": 0, "3부": 0, "4부": 0 };
  allRes.forEach((r) => {
    if (r.canceledAt) return; // 취소 예약 제외
    if (parseDate(r.date) !== panelDate) return;
    const s = matchSlot(r.timeSlot);
    if (!(s in panelTotals)) return;
    panelTotals[s] += Number(r.headcount) || 0;
  });

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
            if (window.confirm("로그아웃하시겠습니까? (토큰이 삭제됩니다)")) {
              clearAdminToken();
              window.location.reload();
            }
          }}
        >
          ⚙ 로그아웃
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
        <button
          className={`tab-btn ${tab === "guest" ? "active" : ""}`}
          onClick={() => setTab("guest")}
        >
          📞 예약자 검색
        </button>
      </div>

      {/* ════════════════════════════════════════
          예약 조회 탭
          ════════════════════════════════════════ */}
      {tab === "search" && (
        <div className="content content-flex">
          <div className="main-col">
          <div className="search-bar">
            <div className="search-field search-date">
              <label className="label">날짜</label>
              <div className="date-static">📅 오늘 · {selectedDate}</div>
            </div>
            <div className="search-field">
              <label className="label">예약자 성함</label>
              <input
                className="input"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="예: 홍길동 (영타 rla=김 도 인식)"
                autoFocus
              />
            </div>
            <div className="search-field">
              <label className="label">객실 호수</label>
              <input
                className="input"
                value={searchRoom}
                onCompositionStart={() => (searchComposingRef.current = true)}
                onCompositionEnd={(e) => {
                  searchComposingRef.current = false;
                  setSearchRoom(fixRoomInput(e.target.value));
                }}
                onChange={(e) =>
                  setSearchRoom(
                    searchComposingRef.current
                      ? e.target.value
                      : fixRoomInput(e.target.value)
                  )
                }
                placeholder="예: A102 (ㅁ102도 인식)"
              />
            </div>
            <div className="search-field search-slot">
              <label className="label">시간(부)</label>
              <select
                className="input"
                value={searchSlot}
                onChange={(e) => setSearchSlot(e.target.value)}
              >
                <option value="">전체</option>
                {Object.entries(TIME_SLOTS).map(([k, time]) => (
                  <option key={k} value={k}>
                    {k} ({time})
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-default search-refresh" onClick={handleRefresh}>
              {loading ? "갱신중…" : "🔄 새로고침"}
            </button>
          </div>

          {error && <div className="error-msg">{error}</div>}

          {!loading && searchResults.length === 0 && !error && (
            <div className="empty-state">
              <div className="emoji">📋</div>
              <p>
                {searchRoom.trim() || searchName.trim() || searchSlot
                  ? "검색 결과가 없습니다"
                  : "조회된 예약이 없습니다"}
              </p>
            </div>
          )}

          <div className="card-list">
            {searchResults.map((r) => (
              <ReservationCard
                key={r.rowIndex}
                r={r}
                onUpdate={handleUpdate}
                prevInfo={prevInfoFor(r)}
              />
            ))}
          </div>
          </div>
          <SlotStatusPanel totals={slotTotals} />
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
                    행을 클릭하면 선택됩니다 · 여러 키를 한 번에 반납할 수 있어요
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
                    onClick={() => toggleSelect(id)}
                    title="클릭하여 선택 / 해제"
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
        <div className="content content-flex">
          <div className="main-col">
            <RegisterForm
              defaultDate={getToday()}
              onSubmit={handleAddReservation}
              dayReservations={reservations}
            />
          </div>
          <SlotStatusPanel totals={slotTotals} />
        </div>
      )}

      {/* ════════════════════════════════════════
          예약자 검색 탭 (전 날짜 · 전화 문의 대응)
          ════════════════════════════════════════ */}
      {tab === "guest" && (
        <div className="content content-flex">
          <div className="main-col">
          <div className="search-bar">
            <div className="search-field">
              <label className="label">예약자 성함</label>
              <input
                className="input"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="예: 홍길동 (영타 rla=김 도 인식)"
                autoFocus
              />
            </div>
            <div className="search-field">
              <label className="label">객실 호수</label>
              <input
                className="input"
                value={guestRoom}
                onChange={(e) => setGuestRoom(fixRoomInput(e.target.value))}
                placeholder="예: A102"
              />
            </div>
            <button
              className="btn btn-default search-refresh"
              onClick={fetchAllDates}
            >
              {allLoading ? "갱신중…" : "🔄 새로고침"}
            </button>
          </div>
          <div className="guest-hint">
            📅 오늘뿐 아니라 <b>모든 날짜</b>의 예약에서 찾습니다 · 총 {allRes.length}건
            불러옴
          </div>

          {allError && <div className="error-msg">{allError}</div>}

          {!guestHasQuery ? (
            <div className="empty-state">
              <div className="emoji">📞</div>
              <p>성함 또는 객실 호수를 입력하면 전체 날짜에서 검색됩니다</p>
            </div>
          ) : allLoading && guestResults.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">⏳</div>
              <p>불러오는 중…</p>
            </div>
          ) : guestResults.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">🔍</div>
              <p>검색 결과가 없습니다</p>
            </div>
          ) : (
            <div className="guest-table">
              {guestResults.map((r) => {
                const slot = matchSlot(r.timeSlot);
                const editing = editId === r.rowIndex;
                return (
                  <div key={r.rowIndex} className="guest-item">
                    <div className="guest-row">
                      <span className="gcell-date">이용 {parseDate(r.date)}</span>
                      <span className="gcell-slot">{slot || "—"}</span>
                      <span className="gcell-name">{r.name || "(무명)"}</span>
                      <span className="gcell-room">{r.room}</span>
                      <span
                        className={`site-chip ${r.site === "플캠" ? "" : "site-chip-resort"}`}
                      >
                        {r.site || "휘닉스"}
                      </span>
                      {hasLateCheckout(r) && (
                        <span className="late-badge">🕐 레이트 체크아웃</span>
                      )}
                      {r.source === "현장" && <span className="chip-etc">현장</span>}
                      {r.returnedAt && <span className="chip-etc">반납됨</span>}
                      {r.canceledAt && <span className="chip-cancel">취소됨</span>}
                      <span className="gcell-ts">접수 {formatTimestamp(r.timestamp)}</span>
                      <button
                        className="guest-edit-btn"
                        onClick={() => (editing ? cancelEdit() : startEdit(r))}
                      >
                        {editing ? "✕ 취소" : "✏️ 편집"}
                      </button>
                    </div>

                    {editing && (
                      <div className="guest-edit">
                        <div className="guest-edit-fields">
                          <label className="guest-edit-field">
                            <span>이용 날짜</span>
                            <input
                              type="date"
                              className="input"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                            />
                          </label>
                          <label className="guest-edit-field">
                            <span>시간(부)</span>
                            <select
                              className="input"
                              value={editSlot}
                              onChange={(e) => setEditSlot(e.target.value)}
                            >
                              {Object.entries(TIME_SLOTS).map(([k, time]) => (
                                <option key={k} value={k}>
                                  {k} ({time})
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="guest-edit-check" title="컴플레인 대응 등으로 레이트 체크아웃을 약속한 고객에게 체크해 두면, 예약 조회 화면에 표시되어 놓치지 않습니다.">
                            <input
                              type="checkbox"
                              checked={editLate}
                              onChange={(e) => setEditLate(e.target.checked)}
                            />
                            🕐 레이트 체크아웃 적용
                          </label>
                        </div>
                        <div className="guest-edit-actions">
                          <button
                            className="btn btn-default"
                            onClick={cancelEdit}
                            disabled={editSaving}
                          >
                            취소
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={() => saveEdit(r)}
                            disabled={editSaving}
                          >
                            {editSaving ? "저장중…" : "💾 저장"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </div>
          <SlotStatusPanel
            totals={panelTotals}
            date={panelDate}
            onDateChange={setPanelDate}
          />
        </div>
      )}
    </div>
  );
}
