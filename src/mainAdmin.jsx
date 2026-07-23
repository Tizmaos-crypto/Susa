import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AdminGate from "./AdminGate.jsx";

/* ── 직원 데스크 배포 진입점 ──
   별도의 비공개 Vercel 프로젝트로만 배포됩니다 (VITE_APP_MODE=admin).
   토큰은 번들에 포함되지 않고, 직원이 로그인 시 입력합니다. */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AdminGate>
      <App />
    </AdminGate>
  </React.StrictMode>
);
