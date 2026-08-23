import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AdminGate from "./AdminGate.jsx";
import "./index.css";

/* 비시즌: 예약 사이트는 종료되고 직원 데스크만 운영합니다.
   (현장 등록 + 락커 현황). 토큰 인증은 AdminGate 에서 처리. */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AdminGate>
      <App />
    </AdminGate>
  </React.StrictMode>
);
