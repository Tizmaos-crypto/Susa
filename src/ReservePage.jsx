import { useState, useEffect, useCallback } from "react";
import "./ReservePage.css";

/* ── 시간부 정의 ── (label=시트 저장용 한글, labelEn=영어 표시용) */
const SLOTS = [
  { key: "1부", label: "1부 (10:00~13:00)", labelEn: "Part 1 (10:00–13:00)", late: true },
  { key: "2부", label: "2부 (13:30~15:30)", labelEn: "Part 2 (13:30–15:30)", late: true },
  { key: "3부", label: "3부 (16:00~18:00)", labelEn: "Part 3 (16:00–18:00)", late: false },
  { key: "4부", label: "4부 (18:30~21:00)", labelEn: "Part 4 (18:30–21:00)", late: false },
];

/* 레이트 체크아웃 (value=시트 저장용 한글, 표시만 언어별) */
const LATE_YES = "네, 적용해 주세요.";
const LATE_NO = "아니요, 괜찮습니다. (기본 퇴실 시간 유지)";
const LATE_OPTIONS = [
  { value: LATE_YES, ko: LATE_YES, en: "Yes, please apply it." },
  { value: LATE_NO, ko: LATE_NO, en: "No, thank you. (Keep the standard check-out time)" },
];

/* ── 사이트 변형 (URL ?site=partner) ── */
const SITE_CONFIG = {
  resort: {
    siteLabel: "휘닉스",
    showBenefits: true,
    showRoomCapacityNotice: true,
    showRoomNote: true,
    lateCheckout: true,
    beachTowelLine: false,
    roomPlaceholder: { ko: "예: B428 / 체크인전", en: "e.g., B428 / before check-in" },
    maxHeadcount: 8,
    stayOnlyNotice: false,
  },
  partner: {
    siteLabel: "플캠",
    showBenefits: false,
    showRoomCapacityNotice: false,
    showRoomNote: false,
    lateCheckout: false,
    beachTowelLine: true,
    roomPlaceholder: { ko: "예: 1201", en: "e.g., 1201" },
    maxHeadcount: 2,
    stayOnlyNotice: true,
  },
};
function getSiteConfig() {
  try {
    const s = new URLSearchParams(window.location.search).get("site");
    return SITE_CONFIG[s] || SITE_CONFIG.resort;
  } catch {
    return SITE_CONFIG.resort;
  }
}

/* ── 다국어 문자열 ── */
const STR = {
  ko: {
    langBtn: "🌐 ENG",
    title: "수영장 이용 예약 접수",
    steps: ["1 신청", "2 혜택", "3 확인"],
    stepConfirm2: "2 확인",
    stayBanner: "⚠️ 투숙 중에만 이용 가능합니다.",
    intro: {
      lead: "쾌적하고 안전한 시설 이용을 위해 극성수기 기간 동안 수영장 및 사우나를 4부제 예약제로 운영합니다. 아래 유의사항을 반드시 확인하신 후 예약해 주시기 바랍니다.",
      sec1Full: "🚨 필독: 이용 횟수 안내 및 🎁 1·2부 특별 혜택",
      sec1Short: "🚨 필독: 이용 횟수 안내",
      limitLabel: "[이용 횟수 제한]",
      limitPre: "본 시설은 ",
      limitBold: "1박당 1일 1회",
      limitPost: ", 지정된 회차에만 이용 가능합니다. (중복 예약 불가)",
      benefitLabel: "[1·2부 예약 고객 특별 혜택]",
      benefitLead: "오전 및 낮 시간대(1·2부) 예약 고객님께 다음 혜택을 제공합니다.",
      benefits: [
        "혜택 1: 비치타월 객실당 1장 무료 대여",
        "혜택 2: 객실 체크인 전 수영장 선(先) 입장 가능",
        "혜택 3: 레이트 체크아웃 2시간 무료 제공",
      ],
      lateWarnPre: "⚠️ 레이트 체크아웃은 ",
      lateWarnBold: "퇴실 당일 이용 시 적용되지 않습니다.",
      lateWarnPost:
        " 혜택 명단이 이용 당일 수영장 마감 후 객실 프론트로 전달되기 때문에, 수영장 이용일과 퇴실일이 같은 경우에는 적용이 불가합니다.",
      benefitFine: "※ 상세 적용 절차는 프론트 데스크로 문의 바랍니다.",
      towelLabel: "[비치타월 안내]",
      towelBody: "비치타월을 객실당 1장 무료로 대여해 드립니다. (1·2부에 한해)",
      hoursTitle: "⏰ 운영 시간 및 락커 배정 안내",
      hoursLabel: "[운영 시간]",
      hours: [
        "1부: 10:00 – 13:00",
        "2부: 13:30 – 15:30",
        "3부: 16:00 – 18:00 🚨 혼잡 예상 / 러시아워",
        "4부: 18:30 – 21:00 🚨 혼잡 예상 / 러시아워",
      ],
      hoursFine:
        "각 회차 사이 30분은 수질 점검 및 락커룸 딥클리닝 등 시설 정비 시간입니다. 쾌적한 환경을 위해 퇴장 시간을 엄수해 주시기 바랍니다.",
      lockerLabel: "[사전 예약 인원 및 락커 배정]",
      lockers: [
        "각 부당 사전 예약은 선착순 180명으로 마감되며, 예약자에게만 사우나 락커가 정상 배정됩니다.",
        "[노쇼 규정] 예약된 회차 시작 후 30분 경과 시 예약은 자동 취소되며, 락커는 현장 대기자에게 양도됩니다.",
        "사전 예약 마감(180명 초과) 또는 노쇼 자동 취소 이후 현장 방문 시 입장은 가능하나, 락커 배정이 불가합니다. 이 경우 객실에서 수영복으로 환복 후 락커 키 없이 바로 입장하셔야 하므로 가급적 사전 예약을 권장합니다. (관련 법률에 따른 수영장 총 적정 수용 인원 기준 내에서 안전하게 운영됩니다.)",
      ],
      noticeTitle: "📌 이용 안내 및 유의사항",
      roomCapacity:
        "객실별 이용 인원 및 혜택: 로얄 객실 최대 4인, 스위트 객실 최대 6인까지 무료 이용 가능합니다. (무료 인원 초과 시 객실당 최대 2인까지 투숙객 50% 할인 금액으로 현장 결제 후 추가 입장 가능 / 최대 입장 인원: 로얄 총 6인, 스위트 총 8인)",
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
    fHeadcount: "입장 인원",
    fDate: "예약 날짜",
    fSlot: "예약 시간 (1박당 1일 1회 가능합니다)",
    slotRemain: (n) => `잔여 ${n}명`,
    slotClosed: "마감",
    people: (n) => `${n}명`,
    next: "다음",
    back: "뒤로",
    submit: "제출",
    submitting: "제출 중…",
    lateQ: "[레이트 체크아웃 2시간 무료] 혜택을 적용하시겠습니까?",
    lateWarnStepPre: "⚠️ ",
    lateWarnStepBold: "퇴실 당일 이용 고객님은 적용 대상이 아닙니다.",
    lateWarnStepPost: " 혜택 명단이 이용 당일 수영장 마감 후 객실 프론트로 전달되기 때문입니다.",
    confirmTitle: "✅ 예약 최종 확인",
    rName: "예약자",
    rRoom: "객실 호수",
    rDate: "예약 날짜",
    rSlot: "이용 시간",
    rHeadcount: "입장 인원",
    rLate: "레이트 체크아웃",
    confirmNote:
      "선택하신 시간대 및 혜택 신청 내역을 다시 확인하시려면 [뒤로] 버튼을 눌러 이전 페이지를 확인해 주세요. 내역에 이상이 없다면 아래 [제출] 버튼을 눌러 예약을 확정해 주시기 바랍니다. 제출 후에는 예약 내역이 현장 데스크로 자동 전송됩니다.",
    doneTitle: "예약이 확정되었습니다",
    doneNote: "예약 내역이 현장 데스크로 전송되었습니다. 방문 시 데스크에서 확인해주세요.",
    newBooking: "새 예약 하기",
    noApi: "예약 시스템 주소가 설정되지 않았습니다. 관리자에게 문의해주세요.",
    submitFail: "예약 전송에 실패했습니다. 네트워크를 확인하고 다시 시도해주세요.",
  },
  en: {
    langBtn: "🌐 한국어",
    title: "Pool Reservation",
    steps: ["1 Apply", "2 Benefit", "3 Confirm"],
    stepConfirm2: "2 Confirm",
    stayBanner: "⚠️ Available only during your stay.",
    intro: {
      lead: "For a comfortable and safe experience, the pool and sauna operate on a 4-session reservation system during the peak season. Please read the notes below carefully before booking.",
      sec1Full: "🚨 Must Read: Usage Limit & 🎁 Part 1·2 Special Benefits",
      sec1Short: "🚨 Must Read: Usage Limit",
      limitLabel: "[Usage Limit]",
      limitPre: "This facility may be used ",
      limitBold: "once per day, per night's stay",
      limitPost: ", only during your reserved session. (No duplicate reservations)",
      benefitLabel: "[Special Benefits for Part 1·2 Guests]",
      benefitLead: "Guests who reserve the morning/daytime sessions (Part 1·2) receive the following benefits:",
      benefits: [
        "Benefit 1: One beach towel per room, free rental",
        "Benefit 2: Early pool entry allowed before room check-in",
        "Benefit 3: Free 2-hour late check-out",
      ],
      lateWarnPre: "⚠️ Late check-out ",
      lateWarnBold: "does not apply if you use the pool on your check-out day.",
      lateWarnPost:
        " The benefit list is delivered to the room front desk after the pool closes on the day of use, so it cannot be applied when the pool-use date and check-out date are the same.",
      benefitFine: "※ For detailed procedures, please ask the front desk.",
      towelLabel: "[Beach Towel]",
      towelBody: "One beach towel per room is provided free of charge. (Part 1·2 only)",
      hoursTitle: "⏰ Operating Hours & Locker Assignment",
      hoursLabel: "[Operating Hours]",
      hours: [
        "Part 1: 10:00 – 13:00",
        "Part 2: 13:30 – 15:30",
        "Part 3: 16:00 – 18:00 🚨 Expected to be crowded / Rush hour",
        "Part 4: 18:30 – 21:00 🚨 Expected to be crowded / Rush hour",
      ],
      hoursFine:
        "The 30 minutes between sessions is for water-quality checks and locker-room deep cleaning. Please observe the exit times for everyone's comfort.",
      lockerLabel: "[Advance Reservation Capacity & Locker Assignment]",
      lockers: [
        "Advance reservations for each session close at the first 180 guests, and sauna lockers are assigned only to guests with a reservation.",
        "[No-show Policy] If 30 minutes pass after the reserved session begins, the reservation is automatically canceled and the locker is passed to on-site waiting guests.",
        "After advance reservations are full (over 180) or a no-show is auto-canceled, walk-in entry is possible but a locker cannot be assigned. In that case, please change into swimwear in your room and enter directly without a locker key. Advance reservation is recommended. (Operated safely within the pool's legal maximum capacity.)",
      ],
      noticeTitle: "📌 Usage Guide & Notes",
      roomCapacity:
        "Room capacity & benefits: Royal rooms up to 4 guests, Suite rooms up to 6 guests may use the pool free of charge. (Beyond the free capacity, up to 2 more guests per room may enter after paying 50% of the guest rate on site / Maximum entry: Royal 6 total, Suite 8 total)",
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
    fHeadcount: "Number of guests",
    fDate: "Reservation date",
    fSlot: "Session (once per day, per night's stay)",
    slotRemain: (n) => `${n} left`,
    slotClosed: "Full",
    people: (n) => (n === 1 ? "1 person" : `${n} people`),
    next: "Next",
    back: "Back",
    submit: "Submit",
    submitting: "Submitting…",
    lateQ: "Would you like the [Free 2-hour Late Check-out] benefit?",
    lateWarnStepPre: "⚠️ ",
    lateWarnStepBold: "Guests using the pool on their check-out day are not eligible.",
    lateWarnStepPost: " This is because the benefit list is sent to the room front desk after the pool closes on the day of use.",
    confirmTitle: "✅ Final Confirmation",
    rName: "Guest",
    rRoom: "Room number",
    rDate: "Date",
    rSlot: "Session",
    rHeadcount: "Guests",
    rLate: "Late check-out",
    confirmNote:
      "To review your session and benefit request, tap [Back] to see the previous page. If everything is correct, tap [Submit] below to confirm. After submission, your reservation is sent automatically to the on-site desk.",
    doneTitle: "Your reservation is confirmed",
    doneNote: "Your reservation has been sent to the on-site desk. Please check in at the desk when you visit.",
    newBooking: "Make another reservation",
    noApi: "The reservation system address is not configured. Please contact the administrator.",
    submitFail: "Failed to send the reservation. Please check your connection and try again.",
  },
};

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
  const config = getSiteConfig();

  const [lang, setLang] = useState("ko");
  const t = STR[lang];
  const tIntro = t.intro;

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [headcount, setHeadcount] = useState(1);
  const [date, setDate] = useState(getToday());
  const [slotKey, setSlotKey] = useState("");
  const [lateCheckout, setLateCheckout] = useState("");

  const [avail, setAvail] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const selectedSlot = SLOTS.find((s) => s.key === slotKey) || null;
  const slotDisplay = (s) => (s ? (lang === "en" ? s.labelEn : s.label) : "");
  const lateDisplay = (val) => {
    const o = LATE_OPTIONS.find((x) => x.value === val);
    return o ? (lang === "en" ? o.en : o.ko) : val;
  };

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

  const useLate = config.lateCheckout && !!selectedSlot && selectedSlot.late;
  const goFromStep1 = () => {
    if (!canNext1) return;
    if (!useLate) setLateCheckout("");
    setStep(useLate ? 2 : 3);
  };
  const goFromStep2 = () => {
    if (!lateCheckout) return;
    setStep(3);
  };
  const backFromStep3 = () => setStep(useLate ? 2 : 1);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const resp = await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({
          action: "addReservation",
          source: "",
          site: config.siteLabel,
          name: name.trim(),
          room: room.trim(),
          date,
          timeSlot: selectedSlot.label, // 시트 저장은 항상 한글 라벨
          headcount: String(headcount),
          lateCheckout: useLate ? lateCheckout : "", // 저장값 한글 유지
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
          setStep(1); // 객실·날짜를 고칠 수 있게 1단계로
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

  const langToggle = (
    <button
      className="rsv-lang-btn"
      onClick={() => setLang((l) => (l === "ko" ? "en" : "ko"))}
      type="button"
    >
      {t.langBtn}
    </button>
  );

  /* ── API 미설정 안내 ── */
  if (!apiUrl) {
    return (
      <div className="rsv-shell">
        {langToggle}
        <div className="rsv-card rsv-message">{t.noApi}</div>
      </div>
    );
  }

  /* ── 완료 화면 ── */
  if (done) {
    return (
      <div className="rsv-shell">
        {langToggle}
        <div className="rsv-card rsv-done">
          <div className="rsv-done-icon">✅</div>
          <h2>{t.doneTitle}</h2>
          <div className="rsv-summary">
            <Row label={t.rName} value={name} />
            <Row label={t.rRoom} value={room} />
            <Row label={t.rDate} value={date} />
            <Row label={t.rSlot} value={slotDisplay(selectedSlot)} />
            <Row label={t.rHeadcount} value={t.people(headcount)} />
            {useLate && <Row label={t.rLate} value={lateDisplay(lateCheckout)} />}
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
      {langToggle}
      <header className="rsv-header">
        <div className="rsv-logo">🏊</div>
        <h1>{t.title}</h1>
        {step >= 1 && (
          <div className="rsv-steps">
            <span className={step >= 1 ? "on" : ""}>{t.steps[0]}</span>
            {config.lateCheckout && (
              <span className={step >= 2 ? "on" : ""}>{t.steps[1]}</span>
            )}
            <span className={step >= 3 ? "on" : ""}>
              {config.lateCheckout ? t.steps[2] : t.stepConfirm2}
            </span>
          </div>
        )}
      </header>

      {config.stayOnlyNotice && <div className="rsv-stay-banner">{t.stayBanner}</div>}

      {error && <div className="rsv-error">{error}</div>}

      {/* ── STEP 0: 이용 안내 ── */}
      {step === 0 && (
        <div className="rsv-card rsv-intro">
          <p className="rsv-intro-lead">{tIntro.lead}</p>

          <section className="rsv-notice">
            <h3>{config.showBenefits ? tIntro.sec1Full : tIntro.sec1Short}</h3>
            <p className="rsv-notice-sub">{tIntro.limitLabel}</p>
            <p>
              {tIntro.limitPre}
              <b>{tIntro.limitBold}</b>
              {tIntro.limitPost}
            </p>

            {config.showBenefits && (
              <>
                <p className="rsv-notice-sub">{tIntro.benefitLabel}</p>
                <p>{tIntro.benefitLead}</p>
                <ul>
                  {tIntro.benefits.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
                <p className="rsv-warn-note">
                  {tIntro.lateWarnPre}
                  <b>{tIntro.lateWarnBold}</b>
                  {tIntro.lateWarnPost}
                </p>
                <p className="rsv-notice-fine">{tIntro.benefitFine}</p>
              </>
            )}

            {config.beachTowelLine && (
              <>
                <p className="rsv-notice-sub">{tIntro.towelLabel}</p>
                <p>{tIntro.towelBody}</p>
              </>
            )}
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
            <p className="rsv-notice-sub">{tIntro.lockerLabel}</p>
            <ul>
              {tIntro.lockers.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </section>

          <section className="rsv-notice">
            <h3>{tIntro.noticeTitle}</h3>
            <ul>
              {config.showRoomCapacityNotice && <li>{tIntro.roomCapacity}</li>}
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

      {/* ── STEP 1: 예약 정보 ── */}
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
              placeholder={config.roomPlaceholder[lang]}
            />
            {config.showRoomNote && (
              <p className="rsv-note">
                {lang === "en"
                  ? 'Guests booking before check-in: please enter "before check-in" for the room number. When visiting the pool, please tell the staff your contact number and assigned room number for verification.'
                  : '체크인 전 접수하시는 고객님께서는 "체크인전"으로 작성해주시기 바라며, 수영장 방문 시 확인을 위해 연락처와 배정받으신 객실번호를 직원에게 말씀 부탁드립니다.'}
              </p>
            )}
          </Field>

          <Field label={t.fHeadcount}>
            <select
              className="rsv-input"
              value={headcount}
              onChange={(e) => setHeadcount(Number(e.target.value))}
            >
              {Array.from({ length: config.maxHeadcount }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {t.people(n)}
                </option>
              ))}
            </select>
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
            onClick={goFromStep1}
          >
            {t.next}
          </button>
        </div>
      )}

      {/* ── STEP 2: 레이트 체크아웃 ── */}
      {step === 2 && (
        <div className="rsv-card">
          <h2 className="rsv-q">{t.lateQ}</h2>
          <p className="rsv-warn-note">
            {t.lateWarnStepPre}
            <b>{t.lateWarnStepBold}</b>
            {t.lateWarnStepPost}
          </p>
          <div className="rsv-radio-group">
            {LATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`rsv-radio ${lateCheckout === opt.value ? "active" : ""}`}
                onClick={() => setLateCheckout(opt.value)}
              >
                {lang === "en" ? opt.en : opt.ko}
              </button>
            ))}
          </div>
          <div className="rsv-actions">
            <button className="rsv-btn rsv-btn-ghost" onClick={() => setStep(1)}>
              {t.back}
            </button>
            <button
              className="rsv-btn rsv-btn-primary"
              disabled={!lateCheckout}
              onClick={goFromStep2}
            >
              {t.next}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: 최종 확인 ── */}
      {step === 3 && (
        <div className="rsv-card">
          <h2 className="rsv-q">{t.confirmTitle}</h2>
          <div className="rsv-summary">
            <Row label={t.rName} value={name} />
            <Row label={t.rRoom} value={room} />
            <Row label={t.rDate} value={date} />
            <Row label={t.rSlot} value={slotDisplay(selectedSlot)} />
            <Row label={t.rHeadcount} value={t.people(headcount)} />
            {useLate && <Row label={t.rLate} value={lateDisplay(lateCheckout) || "—"} />}
          </div>
          <p className="rsv-confirm-note">{t.confirmNote}</p>
          <div className="rsv-actions">
            <button
              className="rsv-btn rsv-btn-ghost"
              onClick={backFromStep3}
              disabled={submitting}
            >
              {t.back}
            </button>
            <button
              className="rsv-btn rsv-btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
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
