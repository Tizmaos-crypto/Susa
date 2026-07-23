import React from "react";
import ReactDOM from "react-dom/client";
import ReserveV2 from "./ReserveV2.jsx";
import ReservePage from "./ReservePage.jsx";
import StatusPage from "./StatusPage.jsx";

/* ── 공개(고객) 배포 진입점 ──
   이 번들에는 직원 데스크 코드·직원 백엔드 주소·토큰이 전혀 포함되지 않습니다.

   ?site=partner → 플캠 예약 페이지
   ?view=status  → 공개 현황 페이지
   ?view=old     → 구버전 예약 페이지
   그 외(기본)   → 휘닉스 예약 페이지 */
const params = new URLSearchParams(window.location.search);
const view = params.get("view");
const site = params.get("site");

let page;
if (view === "status") {
  page = <StatusPage />;
} else if (view === "old" || site === "partner") {
  page = <ReservePage />;
} else {
  page = <ReserveV2 />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{page}</React.StrictMode>
);
