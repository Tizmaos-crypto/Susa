import { useState, useEffect, useCallback } from "react";
import "./ReservePage.css";

/* ── 시간부 정의 ── */
const SLOTS = [
  { key: "1부", label: "1부 (10:00~13:00)", late: true },
  { key: "2부", label: "2부 (13:30~16:00)", late: true },
  { key: "3부", label: "3부 (16:30~18:30)", late: false },
  { key: "4부", label: "4부 (19:00~21:00)", late: false },
];

const LATE_YES = "네, 적용해 주세요.";
const LATE_NO = "아니요, 괜찮습니다. (기본 퇴실 시간 유지)";

const ROOM_NOTE =
  '체크인 전 접수하시는 고객님께서는 "체크인전"으로 작성해주시기 바라며, 수영장 방문 시 확인을 위해 연락처와 배정받으신 객실번호를 직원에게 말씀 부탁드립니다.';

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ── API URL 결정: ?api=... → VITE_API_URL → localStorage ── */
const STORAGE_KEY = "reservation_desk_api_url";
function resolveApiUrl() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get("api");
    if (fromQuery) return fromQuery.trim();
  } catch {
    /* noop */
  }
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv) return String(fromEnv).trim();
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export default function ReservePage() {
  const apiUrl = resolveApiUrl();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [headcount, setHeadcount] = useState(1);
  const [date, setDate] = useState(getToday());
  const [slotKey, setSlotKey] = useState("");
  const [lateCheckout, setLateCheckout] = useState("");

  const [avail, setAvail] = useState(null); // { slots: {...} }
  const [availLoading, setAvailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const selectedSlot = SLOTS.find((s) => s.key === slotKey) || null;

  /* 선택 날짜의 부별 잔여 정원 조회 */
  const fetchAvail = useCallback(async () => {
    if (!apiUrl || !date) return;
    setAvailLoading(true);
    try {
      const params = new URLSearchParams({ action: "availability", date });
      const resp = await fetch(`${apiUrl}?${params.toString()}`);
      const json = await resp.json();
      if (!json.error) setAvail(json);
    } catch {
      /* 조회 실패 시 정원 표시 없이 진행 (제출 시 서버가 재확인) */
    } finally {
      setAvailLoading(false);
    }
  }, [apiUrl, date]);

  useEffect(() => {
    fetchAvail();
  }, [fetchAvail]);

  /* 부의 잔여 정원 / 마감 여부 (선택 인원 기준) */
  const slotInfo = (key) => {
    const s = avail?.slots?.[key];
    if (!s) return { remaining: null, closed: false };
    const remaining = s.remaining;
    return { remaining, closed: remaining <= 0 || remaining < headcount };
  };

  const canNext1 =
    name.trim() &&
    room.trim() &&
    headcount >= 1 &&
    date &&
    slotKey &&
    !slotInfo(slotKey).closed;

  const goFromStep1 = () => {
    if (!canNext1) return;
    if (!selectedSlot.late) setLateCheckout(""); // 3·4부는 레이트 체크아웃 없음
    setStep(selectedSlot.late ? 2 : 3);
  };
  const goFromStep2 = () => {
    if (!lateCheckout) return;
    setStep(3);
  };
  const backFromStep3 = () => setStep(selectedSlot && selectedSlot.late ? 2 : 1);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const resp = await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({
          action: "addReservation",
          source: "", // 온라인 고객 예약
          name: name.trim(),
          room: room.trim(),
          date,
          timeSlot: selectedSlot.label,
          headcount: String(headcount),
          lateCheckout: selectedSlot.late ? lateCheckout : "",
        }),
      });
      const json = await resp.json();
      if (json.error) {
        setError(json.error);
        if (json.full) {
          // 정원 마감 → 1단계로 돌려보내고 최신 잔여 정원 반영
          setStep(1);
          setSlotKey("");
          fetchAvail();
        }
      } else {
        setDone(true);
      }
    } catch {
      setError("예약 전송에 실패했습니다. 네트워크를 확인하고 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── API 미설정 안내 ── */
  if (!apiUrl) {
    return (
      <div className="rsv-shell">
        <div className="rsv-card rsv-message">
          예약 시스템 주소가 설정되지 않았습니다. 관리자에게 문의해주세요.
        </div>
      </div>
    );
  }

  /* ── 완료 화면 ── */
  if (done) {
    return (
      <div className="rsv-shell">
        <div className="rsv-card rsv-done">
          <div className="rsv-done-icon">✅</div>
          <h2>예약이 확정되었습니다</h2>
          <div className="rsv-summary">
            <Row label="예약자" value={name} />
            <Row label="객실 호수" value={room} />
            <Row label="예약 날짜" value={date} />
            <Row label="이용 시간" value={selectedSlot?.label} />
            <Row label="입장 인원" value={`${headcount}명`} />
            {selectedSlot?.late && (
              <Row label="레이트 체크아웃" value={lateCheckout} />
            )}
          </div>
          <p className="rsv-done-note">
            예약 내역이 현장 데스크로 전송되었습니다. 방문 시 데스크에서 확인해주세요.
          </p>
          <button
            className="rsv-btn rsv-btn-ghost"
            onClick={() => window.location.reload()}
          >
            새 예약 하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rsv-shell">
      <header className="rsv-header">
        <div className="rsv-logo">🏨</div>
        <h1>예약 신청</h1>
        <div className="rsv-steps">
          <span className={step >= 1 ? "on" : ""}>1 신청</span>
          <span className={step >= 2 ? "on" : ""}>2 혜택</span>
          <span className={step >= 3 ? "on" : ""}>3 확인</span>
        </div>
      </header>

      {error && <div className="rsv-error">{error}</div>}

      {/* ── STEP 1: 예약 정보 ── */}
      {step === 1 && (
        <div className="rsv-card">
          <Field label="객실 예약자 성함">
            <input
              className="rsv-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="성함"
            />
          </Field>

          <Field label="객실 호수">
            <input
              className="rsv-input"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="예: B428 / 체크인전"
            />
            <p className="rsv-note">{ROOM_NOTE}</p>
          </Field>

          <Field label="입장 인원">
            <select
              className="rsv-input"
              value={headcount}
              onChange={(e) => setHeadcount(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n}명
                </option>
              ))}
            </select>
          </Field>

          <Field label="예약 날짜">
            <input
              type="date"
              className="rsv-input"
              value={date}
              min={getToday()}
              onChange={(e) => {
                setDate(e.target.value);
                setSlotKey("");
              }}
            />
          </Field>

          <Field label="예약 시간 (1박당 1일 1회 가능합니다)">
            <div className="rsv-slots">
              {SLOTS.map((s) => {
                const { remaining, closed } = slotInfo(s.key);
                const active = slotKey === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    className={`rsv-slot ${active ? "active" : ""} ${closed ? "closed" : ""}`}
                    disabled={closed}
                    onClick={() => setSlotKey(s.key)}
                  >
                    <span className="rsv-slot-label">{s.label}</span>
                    <span className="rsv-slot-remain">
                      {availLoading && remaining === null
                        ? "…"
                        : closed
                          ? "마감"
                          : remaining === null
                            ? ""
                            : `잔여 ${remaining}명`}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          <button
            className="rsv-btn rsv-btn-primary"
            disabled={!canNext1}
            onClick={goFromStep1}
          >
            다음
          </button>
        </div>
      )}

      {/* ── STEP 2: 레이트 체크아웃 (1·2부) ── */}
      {step === 2 && (
        <div className="rsv-card">
          <h2 className="rsv-q">[레이트 체크아웃 2시간 무료] 혜택을 적용하시겠습니까?</h2>
          <div className="rsv-radio-group">
            {[LATE_YES, LATE_NO].map((opt) => (
              <button
                key={opt}
                type="button"
                className={`rsv-radio ${lateCheckout === opt ? "active" : ""}`}
                onClick={() => setLateCheckout(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="rsv-actions">
            <button className="rsv-btn rsv-btn-ghost" onClick={() => setStep(1)}>
              뒤로
            </button>
            <button
              className="rsv-btn rsv-btn-primary"
              disabled={!lateCheckout}
              onClick={goFromStep2}
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: 최종 확인 ── */}
      {step === 3 && (
        <div className="rsv-card">
          <h2 className="rsv-q">✅ 예약 최종 확인</h2>
          <div className="rsv-summary">
            <Row label="예약자" value={name} />
            <Row label="객실 호수" value={room} />
            <Row label="예약 날짜" value={date} />
            <Row label="이용 시간" value={selectedSlot?.label} />
            <Row label="입장 인원" value={`${headcount}명`} />
            {selectedSlot?.late && (
              <Row label="레이트 체크아웃" value={lateCheckout || "—"} />
            )}
          </div>
          <p className="rsv-confirm-note">
            선택하신 시간대 및 혜택 신청 내역을 다시 확인하시려면 [뒤로] 버튼을 눌러
            이전 페이지를 확인해 주세요. 내역에 이상이 없다면 아래 [제출] 버튼을 눌러
            예약을 확정해 주시기 바랍니다. 제출 후에는 예약 내역이 현장 데스크로 자동
            전송됩니다.
          </p>
          <div className="rsv-actions">
            <button
              className="rsv-btn rsv-btn-ghost"
              onClick={backFromStep3}
              disabled={submitting}
            >
              뒤로
            </button>
            <button
              className="rsv-btn rsv-btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "제출 중…" : "제출"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="rsv-field">
      <label className="rsv-label">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="rsv-row">
      <span className="rsv-row-label">{label}</span>
      <span className="rsv-row-value">{value}</span>
    </div>
  );
}
