import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ReservePage from "./ReservePage.jsx";
import StatusPage from "./StatusPage.jsx";
import AdminGate from "./AdminGate.jsx";
import "./index.css";

/* ── 라우팅 (쿼리파라미터 기반) ──
   ?view=admin  → 직원 데스크 (비밀번호 게이트)
   ?view=status → 공개 현황 페이지 (읽기 전용 잔여 정원)
   그 외(기본)  → 고객 예약 페이지 */
const view = new URLSearchParams(window.location.search).get("view");

let page;
if (view === "admin") {
  page = (
    <AdminGate>
      <App />
    </AdminGate>
  );
} else if (view === "status") {
  page = <StatusPage />;
} else {
  page = <ReservePage />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{page}</React.StrictMode>
);
