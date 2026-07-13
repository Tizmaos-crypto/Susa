import { useState, useEffect, useCallback } from "react";
import "./ReservePage.css";
import "./ReserveV2.css";

/* ============================================================
   신규 예약 페이지 (컨펌 전 미리보기) — ?view=v2
   기존 운영 페이지(ReservePage)와 완전히 분리되어 영향 없음
   ============================================================ */

const SITE_LABEL = "휘닉스";
const CAPACITY = 180; // 각 부 정원 (신규 정책)

const SLOTS = [
  { key: "1부", label: "1부 (10:00~13:00)", labelEn: "Part 1 (10:00–13:00)" },
  { key: "2부", label: "2부 (13:30~15:30)", labelEn: "Part 2 (13:30–15:30)" },
  { key: "3부", label: "3부 (16:00~18:00)", labelEn: "Part 3 (16:00–18:00)" },
  { key: "4부", label: "4부 (18:30~21:00)", labelEn: "Part 4 (18:30–21:00)" },
];

const STR = {
  ko: {
    langBtn: "🌐 ENG",
    lookupBtn: "📋 예약 확인",
    title: "수영장 이용 예약 접수",
    steps: ["1 신청", "2 확인"],
    intro: {
      lead: "쾌적하고 안전한 시설 이용을 위해 극성수기 기간 동안 수영장 및 사우나를 4부제 예약제로 운영합니다. 아래 유의사항을 반드시 확인하신 후 예약해 주시기 바랍니다.",
      sec1: "🚨 필독: 이용 횟수 및 객실 배정",
      limitLabel: "[이용 횟수 제한]",
      limitPre: "본 시설은 ",
      limitBold: "1박당 1일 1회",
      limitPost: ", 지정된 회차에만 이용 가능합니다. (중복 예약 불가)",
      roomLabel: "[객실 배정 필수]",
      roomBody:
        "수영장 이용을 위해서는 객실 배정(체크인)이 완료되어야 합니다. 체크인 전 예약은 불가하며, 예약 시 배정받으신 객실 번호를 정확히 입력해 주세요.",
      hoursTitle: "⏰ 운영 시간 및 락커 키 안내",
      hoursLabel: "[운영 시간]",
      hours: [
        "1부: 10:00 – 13:00",
        "2부: 13:30 – 15:30",
        "3부: 16:00 – 18:00 🚨 혼잡 예상 / 러시아워",
        "4부: 18:30 – 21:00 🚨 혼잡 예상 / 러시아워",
      ],
      hoursFine:
        "각 회차 사이 30분은 수질 점검 및 락커룸 딥클리닝 등 시설 정비 시간입니다. 쾌적한 환경을 위해 퇴장 시간을 엄수해 주시기 바랍니다.",
      capLabel: "[사전 예약 인원]",
      capBody: `각 부당 사전 예약은 선착순 ${CAPACITY}명으로 마감되며, 예약자에게만 사우나 락커 키가 배정됩니다.`,
      lockerLabel: "🔑 [락커 키 배정 안내]",
      lockerKeys: [
        "수영장 데스크에서 로얄 객실은 락커 키 2개, 스위트 객실은 락커 키 3개를 제공합니다.",
        "성수기 기간 동안 최대한 많은 고객님께서 이용하실 수 있도록 락커 키 수량을 조정하여 운영합니다. 이용 인원 수만큼 락커 키가 배정되지 않는 점 너른 양해 부탁드립니다.",
        "락커 1개를 일행이 함께 사용하시거나, 객실에서 수영복으로 환복 후 방문해 주시면 더욱 편리합니다.",
      ],
      noshowLabel: "[노쇼 규정]",
      noshow:
        "예약된 회차 시작 후 30분 경과 시 예약은 자동 취소되며, 해당 락커 키는 현장 대기자에게 양도됩니다.",
      walkinLabel: "🚶 [현장 입장 안내 — 예약 없이 방문]",
      walkin: [
        "사전 예약이 없어도 현장에서 바로 입장하실 수 있습니다. 다만 락커 키 배정이 불가하므로, 반드시 객실에서 수영복으로 환복하신 후 방문해 주시기 바랍니다.",
        "노쇼 자동 취소 이전에 현장 입장하시는 경우에는 락커 키를 배정해 드릴 수 없습니다. 락커 키는 예약 고객에게 우선 배정되며, 노쇼 처리 후 남는 키에 한해 현장 대기자에게 양도됩니다.",
        "현장 입장 역시 수영장 총 적정 수용 인원을 초과할 경우 대기가 발생할 수 있습니다.",
      ],
      walkinFine:
        "락커 키보다 이용 시간을 우선하시는 고객님은 환복 후 바로 입장하시는 편이 편리할 수 있습니다. 다만 대기 없이 안정적으로 이용하시려면 사전 예약을 권장합니다. (관련 법률에 따른 수영장 총 적정 수용 인원 기준 내에서 안전하게 운영됩니다.)",
      noticeTitle: "📌 이용 안내 및 유의사항",
      roomCapacity:
        "객실별 이용 인원: 로얄 객실 최대 4인, 스위트 객실 최대 6인까지 무료 이용이 가능합니다. (무료 인원 초과 시 객실당 최대 2인까지 투숙객 50% 할인 금액으로 현장 결제 후 추가 입장 가능 / 최대 입장 인원: 로얄 총 6인, 스위트 총 8인)",
      entryPre: "입장 확인: 현장 수영·사우나 데스크에서 예약자 확인 후 입장하므로, 반드시",
      entryBold: " '객실 예약자' 본인 성함",
      entryPost: "으로 작성해 주세요.",
      envPolicy:
        "환경 정책: 도내 환경 정책 및 자원순환 규제에 따라 젖은 수영복을 담을 일회용 비닐봉투는 시설 내 무상 제공되지 않습니다. 개인용 방수 가방이나 다회용 가방을 지참해 주시기 바랍니다.",
      startBtn: "위 내용을 확인했습니다 · 예약 시작하기",
    },
    fName: "객실 예약자 성함",
    phName: "성함",
    fRoom: "객실 호수",
    phRoom: "예: B428",
    roomHint: "배정받으신 실제 객실 번호를 입력해 주세요. (체크인 전 예약 불가)",
    fHeadcount: "입장 인원",
    lockerWarn: `🔑 락커 키는 인원 수만큼 배정되지 않습니다. 로얄 객실 2개 · 스위트 객실 3개가 제공되며, 성수기 운영에 따른 조치이니 양해 부탁드립니다.`,
    fDate: "예약 날짜",
    fSlot: "예약 시간 (1박당 1일 1회 가능합니다)",
    slotRemain: (n) => `잔여 ${n}명`,
    slotClosed: "마감",
    people: (n) => `${n}명`,
    dupChecking: "예약 내역 확인 중…",
    dupBlocked:
      "⚠️ 이전에 예약한 내역이 있어 예약을 진행할 수 없습니다. 1박당 1일 1회만 이용 가능합니다. 변경이 필요하시면 수영장 프론트에 문의해 주세요.",
    next: "다음",
    back: "뒤로",
    submit: "제출",
    submitting: "제출 중…",
    confirmTitle: "✅ 예약 최종 확인",
    rName: "예약자",
    rRoom: "객실 호수",
    rDate: "예약 날짜",
    rSlot: "이용 시간",
    rHeadcount: "입장 인원",
    confirmNote:
      "선택하신 내역을 다시 확인하시려면 [뒤로] 버튼을 눌러 이전 페이지를 확인해 주세요. 내역에 이상이 없다면 아래 [제출] 버튼을 눌러 예약을 확정해 주시기 바랍니다. 제출 후에는 예약 내역이 현장 데스크로 자동 전송됩니다.",
    doneTitle: "예약이 확정되었습니다",
    doneNote: "예약 내역이 현장 데스크로 전송되었습니다. 방문 시 데스크에서 확인해주세요.",
    newBooking: "새 예약 하기",
    noApi: "예약 시스템 주소가 설정되지 않았습니다. 관리자에게 문의해주세요.",
    submitFail: "예약 전송에 실패했습니다. 네트워크를 확인하고 다시 시도해주세요.",
    lookupTitle: "📋 예약 확인",
    lookupDesc: "예약하신 성함과 객실 번호를 입력하시면 예약 내역을 확인하실 수 있습니다.",
    lookupSearch: "조회",
    lookupSearching: "조회 중…",
    lookupNone: "해당 성함·객실 번호로 예약된 내역이 없습니다.",
    lookupClose: "닫기",
    lookupCount: (n) => `예약 ${n}건`,
    cancelBtn: "예약 취소",
    cancelling: "취소 중…",
    cancelConfirm: (d, s) =>
      `${d} ${s} 예약을 취소하시겠습니까?\n\n취소 후에는 되돌릴 수 없으며, 다시 예약하셔야 합니다.\n예약 변경은 수영장 프론트에 문의해 주세요.`,
    cancelDone: "예약이 취소되었습니다.",
    cancelFail: "취소에 실패했습니다. 잠시 후 다시 시도해주세요.",
    cancelNote: "※ 예약 변경은 불가합니다. 변경이 필요하시면 취소 후 다시 예약하시거나 수영장 프론트에 문의해 주세요.",
  },
  en: {
    langBtn: "🌐 한국어",
    lookupBtn: "📋 My Reservation",
    title: "Pool Reservation",
    steps: ["1 Apply", "2 Confirm"],
    intro: {
      lead: "For a comfortable and safe experience, the pool and sauna operate on a 4-session reservation system during the peak season. Please read the notes below carefully before booking.",
      sec1: "🚨 Must Read: Usage Limit & Room Assignment",
      limitLabel: "[Usage Limit]",
      limitPre: "This facility may be used ",
      limitBold: "once per day, per night's stay",
      limitPost: ", only during your reserved session. (No duplicate reservations)",
      roomLabel: "[Room Assignment Required]",
      roomBody:
        "You must have completed check-in and been assigned a room to use the pool. Booking before check-in is not allowed. Please enter your assigned room number exactly.",
      hoursTitle: "⏰ Operating Hours & Locker Keys",
      hoursLabel: "[Operating Hours]",
      hours: [
        "Part 1: 10:00 – 13:00",
        "Part 2: 13:30 – 15:30",
        "Part 3: 16:00 – 18:00 🚨 Expected to be crowded / Rush hour",
        "Part 4: 18:30 – 21:00 🚨 Expected to be crowded / Rush hour",
      ],
      hoursFine:
        "The 30 minutes between sessions is for water-quality checks and locker-room deep cleaning. Please observe the exit times for everyone's comfort.",
      capLabel: "[Advance Reservation Capacity]",
      capBody: `Advance reservations for each session close at the first ${CAPACITY} guests, and sauna locker keys are assigned only to guests with a reservation.`,
      lockerLabel: "🔑 [Locker Key Policy]",
      lockerKeys: [
        "At the pool desk, Royal rooms receive 2 locker keys and Suite rooms receive 3 locker keys.",
        "During the peak season we limit the number of locker keys so that as many guests as possible can use the facility. Please understand that locker keys are not provided for every guest in your party.",
        "Sharing one locker within your party, or changing into swimwear in your room before visiting, will make your visit more convenient.",
      ],
      noshowLabel: "[No-show Policy]",
      noshow:
        "If 30 minutes pass after the reserved session begins, the reservation is automatically canceled and that locker key is passed to on-site waiting guests.",
      walkinLabel: "🚶 [Walk-in Entry — visiting without a reservation]",
      walkin: [
        "You may enter directly even without an advance reservation. However, a locker key cannot be assigned, so please change into your swimwear in your room before visiting.",
        "If you walk in before the no-show cancellation time, a locker key cannot be provided. Locker keys are assigned to guests with reservations first; only keys remaining after no-show processing are passed to on-site waiting guests.",
        "Walk-in entry may also involve waiting if the pool exceeds its total appropriate capacity.",
      ],
      walkinFine:
        "If you value pool time over a locker key, changing in your room and entering directly may be more convenient. For a reliable visit without waiting, however, advance reservation is recommended. (Operated safely within the pool's legal maximum capacity.)",
      noticeTitle: "📌 Usage Guide & Notes",
      roomCapacity:
        "Room capacity: Royal rooms up to 4 guests, Suite rooms up to 6 guests may use the pool free of charge. (Beyond the free capacity, up to 2 more guests per room may enter after paying 50% of the guest rate on site / Maximum entry: Royal 6 total, Suite 8 total)",
      entryPre: "Entry check: Since entry proceeds after verification at the on-site pool/sauna desk, please book under",
      entryBold: " the room-holder's own name",
      entryPost: ".",
      envPolicy:
        "Environmental policy: Under local environmental and recycling regulations, disposable plastic bags for wet swimwear are not provided free on site. Please bring your own waterproof or reusable bag.",
      startBtn: "I have read the above · Start reservation",
    },
    fName: "Guest name (room holder)",
    phName: "Name",
    fRoom: "Room number",
    phRoom: "e.g., B428",
    roomHint: "Please enter your assigned room number. (Booking before check-in is not allowed)",
    fHeadcount: "Number of guests",
    lockerWarn: `🔑 Locker keys are not provided for every guest. Royal rooms receive 2 keys and Suite rooms 3 keys — a peak-season measure. Thank you for your understanding.`,
    fDate: "Reservation date",
    fSlot: "Session (once per day, per night's stay)",
    slotRemain: (n) => `${n} left`,
    slotClosed: "Full",
    people: (n) => (n === 1 ? "1 person" : `${n} people`),
    dupChecking: "Checking existing reservations…",
    dupBlocked:
      "⚠️ You already have a reservation, so you cannot book again. The pool may be used once per day, per night's stay. Please contact the pool front desk if you need a change.",
    next: "Next",
    back: "Back",
    submit: "Submit",
    submitting: "Submitting…",
    confirmTitle: "✅ Final Confirmation",
    rName: "Guest",
    rRoom: "Room number",
    rDate: "Date",
    rSlot: "Session",
    rHeadcount: "Guests",
    confirmNote:
      "To review your selection, tap [Back] to see the previous page. If everything is correct, tap [Submit] below to confirm. After submission, your reservation is sent automatically to the on-site desk.",
    doneTitle: "Your reservation is confirmed",
    doneNote: "Your reservation has been sent to the on-site desk. Please check in at the desk when you visit.",
    newBooking: "Make another reservation",
    noApi: "The reservation system address is not configured. Please contact the administrator.",
    submitFail: "Failed to send the reservation. Please check your connection and try again.",
    lookupTitle: "📋 My Reservation",
    lookupDesc: "Enter the name and room number you booked with to see your reservation.",
    lookupSearch: "Search",
    lookupSearching: "Searching…",
    lookupNone: "No reservation found for that name and room number.",
    lookupClose: "Close",
    lookupCount: (n) => `${n} reservation(s)`,
    cancelBtn: "Cancel",
    cancelling: "Cancelling…",
    cancelConfirm: (d, s) =>
      `Cancel your reservation for ${d} ${s}?\n\nThis cannot be undone — you would need to book again.\nFor changes, please contact the pool front desk.`,
    cancelDone: "Your reservation has been cancelled.",
    cancelFail: "Cancellation failed. Please try again in a moment.",
    cancelNote:
      "※ Reservations cannot be modified. To change, please cancel and book again, or contact the pool front desk.",
  },
};

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

export default function ReserveV2() {
  const apiUrl = resolveApiUrl();
  const [lang, setLang] = useState("ko");
  const t = STR[lang];
  const tIntro = t.intro;

  const [step, setStep] = useState(0); // 0 안내 / 1 신청 / 2 확인
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [headcount, setHeadcount] = useState(1);
  const [date, setDate] = useState(getToday());
  const [slotKey, setSlotKey] = useState("");

  const [avail, setAvail] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  /* 중복 예약 실시간 확인 */
  const [dupState, setDupState] = useState("idle"); // idle | checking | ok | blocked

  /* 예약 확인 패널 */
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lkName, setLkName] = useState("");
  const [lkRoom, setLkRoom] = useState("");
  const [lkResults, setLkResults] = useState(null);
  const [lkLoading, setLkLoading] = useState(false);
  const [cancelingRow, setCancelingRow] = useState(null);
  const [lkMsg, setLkMsg] = useState("");

  const selectedSlot = SLOTS.find((s) => s.key === slotKey) || null;
  const slotDisplay = (s) => (s ? (lang === "en" ? s.labelEn : s.label) : "");

  /* ── 부별 잔여 정원 (백엔드의 reserved 값에 신규 정원 180 적용) ── */
  const fetchAvail = useCallback(async () => {
    if (!apiUrl || !date) return;
    setAvailLoading(true);
    try {
      const params = new URLSearchParams({ action: "availability", date });
      const resp = await fetch(`${apiUrl}?${params.toString()}`);
      const json = await resp.json();
      if (!json.error) setAvail(json);
    } catch {
      /* 실패 시 표시 없이 진행 */
    } finally {
      setAvailLoading(false);
    }
  }, [apiUrl, date]);

  useEffect(() => {
    fetchAvail();
  }, [fetchAvail]);

  const slotInfo = (key) => {
    const s = avail?.slots?.[key];
    if (!s) return { remaining: null, closed: false };
    const remaining = Math.max(0, CAPACITY - (s.reserved || 0));
    return { remaining, closed: remaining <= 0 || remaining < headcount };
  };

  /* ── 객실+날짜 입력 시 중복 예약 확인 (디바운스) ── */
  useEffect(() => {
    const r = room.trim();
    if (!apiUrl || !r || !date) {
      setDupState("idle");
      return;
    }
    setDupState("checking");
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          action: "checkDuplicate",
          room: r,
          date,
          site: SITE_LABEL,
        });
        const resp = await fetch(`${apiUrl}?${params.toString()}`);
        const json = await resp.json();
        setDupState(json.duplicate ? "blocked" : "ok");
      } catch {
        setDupState("idle"); // 확인 실패 시 막지 않음 (제출 시 서버가 최종 검사)
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [apiUrl, room, date]);

  const canNext1 =
    name.trim() &&
    room.trim() &&
    headcount >= 1 &&
    date &&
    slotKey &&
    !slotInfo(slotKey).closed &&
    dupState !== "blocked" &&
    dupState !== "checking";

  const handleSubmit = async () => {
    if (submitting || dupState === "blocked") return;
    setSubmitting(true);
    setError("");
    try {
      const resp = await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({
          action: "addReservation",
          source: "",
          site: SITE_LABEL,
          name: name.trim(),
          room: room.trim(),
          date,
          timeSlot: selectedSlot.label, // 시트 저장은 한글 라벨
          headcount: String(headcount),
          lateCheckout: "", // 신규 정책: 레이트 체크아웃 문항 없음
        }),
      });
      const json = await resp.json();
      if (json.error) {
        setError(json.error);
        if (json.full) {
          setStep(1);
          setSlotKey("");
          fetchAvail();
        } else if (json.duplicate) {
          setStep(1);
          setDupState("blocked");
        }
      } else {
        setDone(true);
      }
    } catch {
      setError(t.submitFail);
    } finally {
      setSubmitting(false);
    }
  };

  const runLookup = async () => {
    if (!lkName.trim() || !lkRoom.trim()) return;
    setLkLoading(true);
    setLkResults(null);
    setLkMsg("");
    try {
      const params = new URLSearchParams({
        action: "lookup",
        name: lkName.trim(),
        room: lkRoom.trim(),
      });
      const resp = await fetch(`${apiUrl}?${params.toString()}`);
      const json = await resp.json();
      setLkResults(json.reservations || []);
    } catch {
      setLkResults([]);
    } finally {
      setLkLoading(false);
    }
  };

  /* 예약 취소 (변경은 불가 — 취소만) */
  const cancelReservation = async (r) => {
    if (!window.confirm(t.cancelConfirm(r.date, r.timeSlot))) return;
    setCancelingRow(r.rowIndex);
    setLkMsg("");
    try {
      const resp = await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({
          action: "cancelReservation",
          rowIndex: r.rowIndex,
          name: lkName.trim(),
          room: lkRoom.trim(),
        }),
      });
      const json = await resp.json();
      if (json.error) {
        setLkMsg(json.error);
      } else {
        setLkMsg(t.cancelDone);
        setLkResults((prev) => (prev || []).filter((x) => x.rowIndex !== r.rowIndex));
        fetchAvail(); // 잔여 정원 갱신
        setDupState("idle"); // 취소했으니 재예약 가능
      }
    } catch {
      setLkMsg(t.cancelFail);
    } finally {
      setCancelingRow(null);
    }
  };

  const topButtons = (
    <>
      <button className="rsv-lookup-btn" onClick={() => setLookupOpen(true)} type="button">
        {t.lookupBtn}
      </button>
      <button
        className="rsv-lang-btn"
        onClick={() => setLang((l) => (l === "ko" ? "en" : "ko"))}
        type="button"
      >
        {t.langBtn}
      </button>
    </>
  );

  const lookupPanel = lookupOpen && (
    <div className="rsv-modal-wrap" onClick={() => setLookupOpen(false)}>
      <div className="rsv-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="rsv-q">{t.lookupTitle}</h2>
        <p className="rsv-confirm-note">{t.lookupDesc}</p>
        <div className="rsv-field">
          <label className="rsv-label">{t.fName}</label>
          <input
            className="rsv-input"
            value={lkName}
            onChange={(e) => setLkName(e.target.value)}
            placeholder={t.phName}
          />
        </div>
        <div className="rsv-field">
          <label className="rsv-label">{t.fRoom}</label>
          <input
            className="rsv-input"
            value={lkRoom}
            onChange={(e) => setLkRoom(e.target.value)}
            placeholder={t.phRoom}
            onKeyDown={(e) => e.key === "Enter" && runLookup()}
          />
        </div>
        <button
          className="rsv-btn rsv-btn-primary"
          onClick={runLookup}
          disabled={lkLoading || !lkName.trim() || !lkRoom.trim()}
        >
          {lkLoading ? t.lookupSearching : t.lookupSearch}
        </button>

        {lkMsg && <div className="rsv-lookup-msg">{lkMsg}</div>}

        {lkResults !== null && (
          <div className="rsv-lookup-results">
            {lkResults.length === 0 ? (
              <p className="rsv-lookup-none">{t.lookupNone}</p>
            ) : (
              <>
                <p className="rsv-lookup-count">{t.lookupCount(lkResults.length)}</p>
                {lkResults.map((r) => (
                  <div className="rsv-lookup-row" key={r.rowIndex}>
                    <div className="rsv-lookup-info">
                      <span className="rsv-lookup-date">{r.date}</span>
                      <span className="rsv-lookup-slot">{r.timeSlot}</span>
                      <span className="rsv-lookup-head">{t.people(r.headcount)}</span>
                    </div>
                    <button
                      className="rsv-cancel-btn"
                      onClick={() => cancelReservation(r)}
                      disabled={cancelingRow === r.rowIndex}
                    >
                      {cancelingRow === r.rowIndex ? t.cancelling : t.cancelBtn}
                    </button>
                  </div>
                ))}
                <p className="rsv-cancel-note">{t.cancelNote}</p>
              </>
            )}
          </div>
        )}

        <button
          className="rsv-btn rsv-btn-ghost"
          style={{ marginTop: 10 }}
          onClick={() => setLookupOpen(false)}
        >
          {t.lookupClose}
        </button>
      </div>
    </div>
  );

  if (!apiUrl) {
    return (
      <div className="rsv-shell">
        {topButtons}
        <div className="rsv-card rsv-message">{t.noApi}</div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rsv-shell">
        {topButtons}
        {lookupPanel}
        <div className="rsv-card rsv-done">
          <div className="rsv-done-icon">✅</div>
          <h2>{t.doneTitle}</h2>
          <div className="rsv-summary">
            <Row label={t.rName} value={name} />
            <Row label={t.rRoom} value={room} />
            <Row label={t.rDate} value={date} />
            <Row label={t.rSlot} value={slotDisplay(selectedSlot)} />
            <Row label={t.rHeadcount} value={t.people(headcount)} />
          </div>
          <p className="rsv-done-note">{t.doneNote}</p>
          <button
            className="rsv-btn rsv-btn-ghost"
            onClick={() => window.location.reload()}
          >
            {t.newBooking}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rsv-shell">
      {topButtons}
      {lookupPanel}

      <header className="rsv-header">
        <div className="rsv-logo">🏊</div>
        <h1>{t.title}</h1>
        {step >= 1 && (
          <div className="rsv-steps">
            <span className={step >= 1 ? "on" : ""}>{t.steps[0]}</span>
            <span className={step >= 2 ? "on" : ""}>{t.steps[1]}</span>
          </div>
        )}
      </header>

      {error && <div className="rsv-error">{error}</div>}

      {/* ── STEP 0: 이용 안내 ── */}
      {step === 0 && (
        <div className="rsv-card rsv-intro">
          <p className="rsv-intro-lead">{tIntro.lead}</p>

          <section className="rsv-notice">
            <h3>{tIntro.sec1}</h3>
            <p className="rsv-notice-sub">{tIntro.limitLabel}</p>
            <p>
              {tIntro.limitPre}
              <b>{tIntro.limitBold}</b>
              {tIntro.limitPost}
            </p>
            <p className="rsv-notice-sub">{tIntro.roomLabel}</p>
            <p>{tIntro.roomBody}</p>
          </section>

          <section className="rsv-notice">
            <h3>{tIntro.hoursTitle}</h3>
            <p className="rsv-notice-sub">{tIntro.hoursLabel}</p>
            <ul>
              {tIntro.hours.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
            <p className="rsv-notice-fine">{tIntro.hoursFine}</p>

            <p className="rsv-notice-sub">{tIntro.capLabel}</p>
            <p>{tIntro.capBody}</p>

            <div className="rsv-locker-box">
              <p className="rsv-locker-title">{tIntro.lockerLabel}</p>
              <ul>
                {tIntro.lockerKeys.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>

            <p className="rsv-notice-sub">{tIntro.noshowLabel}</p>
            <p>{tIntro.noshow}</p>

            <div className="rsv-walkin-box">
              <p className="rsv-walkin-title">{tIntro.walkinLabel}</p>
              <ul>
                {tIntro.walkin.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
            <p className="rsv-notice-fine">{tIntro.walkinFine}</p>
          </section>

          <section className="rsv-notice">
            <h3>{tIntro.noticeTitle}</h3>
            <ul>
              <li>{tIntro.roomCapacity}</li>
              <li>
                {tIntro.entryPre}
                <b>{tIntro.entryBold}</b>
                {tIntro.entryPost}
              </li>
              <li>{tIntro.envPolicy}</li>
            </ul>
          </section>

          <button className="rsv-btn rsv-btn-primary" onClick={() => setStep(1)}>
            {tIntro.startBtn}
          </button>
        </div>
      )}

      {/* ── STEP 1: 예약 신청 ── */}
      {step === 1 && (
        <div className="rsv-card">
          <Field label={t.fName}>
            <input
              className="rsv-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.phName}
            />
          </Field>

          <Field label={t.fRoom}>
            <input
              className="rsv-input"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder={t.phRoom}
            />
            <p className="rsv-note">{t.roomHint}</p>
            {dupState === "checking" && (
              <p className="rsv-dup-checking">{t.dupChecking}</p>
            )}
            {dupState === "blocked" && <p className="rsv-dup-blocked">{t.dupBlocked}</p>}
          </Field>

          <Field label={t.fHeadcount}>
            <select
              className="rsv-input"
              value={headcount}
              onChange={(e) => setHeadcount(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {t.people(n)}
                </option>
              ))}
            </select>
            {/* 입장 인원 바로 아래 — 락커 키 안내 (잘 보이게) */}
            <p className="rsv-locker-warn">{t.lockerWarn}</p>
          </Field>

          <Field label={t.fDate}>
            <input
              type="date"
              className="rsv-input"
              value={date}
              min={getToday()}
              onChange={(e) => {
                setDate(e.target.value);
                setSlotKey("");
                setAvail(null);
              }}
            />
          </Field>

          <Field label={t.fSlot}>
            <div className="rsv-slots">
              {SLOTS.map((s) => {
                const { remaining, closed } = slotInfo(s.key);
                const active = slotKey === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    className={`rsv-slot ${active ? "active" : ""} ${closed ? "closed" : ""}`}
                    disabled={closed || availLoading}
                    onClick={() => setSlotKey(s.key)}
                  >
                    <span className="rsv-slot-label">{slotDisplay(s)}</span>
                    <span className="rsv-slot-remain">
                      {availLoading
                        ? "…"
                        : closed
                          ? t.slotClosed
                          : remaining === null
                            ? ""
                            : t.slotRemain(remaining)}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          <button
            className="rsv-btn rsv-btn-primary"
            disabled={!canNext1}
            onClick={() => setStep(2)}
          >
            {t.next}
          </button>
        </div>
      )}

      {/* ── STEP 2: 최종 확인 ── */}
      {step === 2 && (
        <div className="rsv-card">
          <h2 className="rsv-q">{t.confirmTitle}</h2>
          <div className="rsv-summary">
            <Row label={t.rName} value={name} />
            <Row label={t.rRoom} value={room} />
            <Row label={t.rDate} value={date} />
            <Row label={t.rSlot} value={slotDisplay(selectedSlot)} />
            <Row label={t.rHeadcount} value={t.people(headcount)} />
          </div>
          <p className="rsv-locker-warn">{t.lockerWarn}</p>
          <p className="rsv-confirm-note">{t.confirmNote}</p>
          {dupState === "blocked" && <p className="rsv-dup-blocked">{t.dupBlocked}</p>}
          <div className="rsv-actions">
            <button
              className="rsv-btn rsv-btn-ghost"
              onClick={() => setStep(1)}
              disabled={submitting}
            >
              {t.back}
            </button>
            <button
              className="rsv-btn rsv-btn-primary"
              onClick={handleSubmit}
              disabled={submitting || dupState === "blocked"}
            >
              {submitting ? t.submitting : t.submit}
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
