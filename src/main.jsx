import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import StatusPage from "./StatusPage.jsx";
import "./index.css";

/* ?view=status → 고객용 공개 현황 페이지, 그 외 → 데스크 관리 앱 */
const isStatus = new URLSearchParams(window.location.search).get("view") === "status";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isStatus ? <StatusPage /> : <App />}
  </React.StrictMode>
);
