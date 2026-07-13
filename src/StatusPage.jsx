import { useState, useEffect, useCallback } from "react";
import "./StatusPage.css";

/* ── 시간부 정보 (현장 앱과 동일) ── */
const TIME_SLOTS = {
  "1부": "10:00 – 13:00",
  "2부": "13:30 – 15:30",
  "3부": "16:00 – 18:00",
  "4부": "18:30 – 21:00",
};
const SLOT_KEYS = Object.keys(TIME_SLOTS);

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ── API URL 결정: ?api=... 우선, 없으면 데스크 앱이 저장한 localStorage 값 ── */
const STORAGE_KEY = "reservation_desk_api_url";
function resolveApiUrl() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get("api");
    if (fromQuery) return fromQuery.trim();
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

/* 잔여 비율에 따른 상태 (여유/혼잡/마감) */
function statusOf(slot) {
  if (!slot) return { key: "loading", label: "—" };
  if (slot.remaining <= 0) return { key: "full", label: "마감" };
  const ratio = slot.remaining / slot.capacity;
  if (ratio <= 0.15) return { key: "tight", label: "마감 임박" };
  if (ratio <= 0.4) return { key: "busy", label: "혼잡" };
  return { key: "open", label: "여유" };
}

export default function StatusPage() {
  const apiUrl = resolveApiUrl();
  const [date, setDate] = useState(getToday());
  const [data, setData] = useState(null); // { capacity, slots }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const fetchAvailability = useCallback(async () => {
    if (!apiUrl) {
      setError("현황 주소가 설정되지 않았습니다.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ action: "availability", date });
      const resp = await fetch(`${apiUrl}?${params.toString()}`);
      const json = await resp.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
        setUpdatedAt(new Date());
      }
    } catch {
      setError("현황을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, date]);

  /* 날짜 변경 시 즉시 조회 + 30초 자동 갱신 */
  useEffect(() => {
    fetchAvailability();
    const timer = setInterval(fetchAvailability, 30000);
    return () => clearInterval(timer);
  }, [fetchAvailability]);

  const slots = data?.slots || {};

  return (
    <div className="status-shell">
      <header className="status-header">
        <div className="status-logo">🏨</div>
        <h1>시간부별 예약 현황</h1>
        <p className="status-sub">원하는 시간(부)의 잔여 정원을 확인하고 예약해주세요</p>
      </header>

      <div className="status-controls">
        <label className="status-date-label">
          📅 예약 희망일
          <input
            type="date"
            className="status-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button
          className="status-refresh"
          onClick={fetchAvailability}
          disabled={loading}
        >
          {loading ? "갱신중…" : "🔄 새로고침"}
        </button>
      </div>

      {error && <div className="status-error">{error}</div>}

      <div className="status-grid">
        {SLOT_KEYS.map((key) => {
          const slot = slots[key];
          const st = statusOf(slot);
          const reserved = slot ? slot.reserved : 0;
          const capacity = slot ? slot.capacity : data?.capacity || 180;
          const remaining = slot ? slot.remaining : capacity;
          const pct = Math.min(100, Math.round((reserved / capacity) * 100));
          return (
            <div key={key} className={`slot-card slot-${st.key}`}>
              <div className="slot-card-top">
                <div className="slot-name">
                  {key}
                  <span className="slot-time">{TIME_SLOTS[key]}</span>
                </div>
                <span className={`slot-status slot-status-${st.key}`}>{st.label}</span>
              </div>

              <div className="slot-numbers">
                {slot ? (
                  st.key === "full" ? (
                    <span className="slot-remaining slot-remaining-full">예약 마감</span>
                  ) : (
                    <>
                      <span className="slot-remaining">
                        잔여 <b>{remaining}</b>명
                      </span>
                      <span className="slot-reserved">
                        예약 {reserved} / {capacity}
                      </span>
                    </>
                  )
                ) : (
                  <span className="slot-remaining slot-remaining-loading">불러오는 중…</span>
                )}
              </div>

              <div className="slot-bar">
                <div
                  className={`slot-bar-fill slot-bar-${st.key}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <footer className="status-footer">
        {updatedAt && (
          <span>
            마지막 갱신 {updatedAt.getHours().toString().padStart(2, "0")}:
            {updatedAt.getMinutes().toString().padStart(2, "0")} · 30초마다 자동 갱신
          </span>
        )}
        <span className="status-note">정원은 각 부 {data?.capacity || 180}명 기준입니다</span>
      </footer>
    </div>
  );
}
