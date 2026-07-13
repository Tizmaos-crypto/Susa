import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ReservePage from "./ReservePage.jsx";
import ReserveV2 from "./ReserveV2.jsx";
import StatusPage from "./StatusPage.jsx";
import AdminGate from "./AdminGate.jsx";
import "./index.css";

/* ── 라우팅 (쿼리파라미터 기반) ──
   ?view=admin   → 직원 데스크 (비밀번호 게이트)
   ?view=status  → 공개 현황 페이지 (읽기 전용 잔여 정원)
   ?view=old     → 구버전 예약 페이지 (롤백용 비상구)
   ?site=partner → 플캠 예약 페이지 (배포된 QR 유지 — 구버전 그대로)
   그 외(기본)   → 휘닉스 예약 페이지 (신규 버전, 기존 QR 그대로 사용) */
const params = new URLSearchParams(window.location.search);
const view = params.get("view");
const site = params.get("site");

let page;
if (view === "admin") {
  page = (
    <AdminGate>
      <App />
    </AdminGate>
  );
} else if (view === "status") {
  page = <StatusPage />;
} else if (view === "old") {
  page = <ReservePage />; // 문제 발생 시 즉시 되돌릴 수 있는 경로
} else if (site === "partner") {
  page = <ReservePage />; // 플캠은 기존 페이지 유지
} else {
  page = <ReserveV2 />; // 기본 = 신규 휘닉스 예약 페이지
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{page}</React.StrictMode>
);
