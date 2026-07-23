import "./index.css";

/* ── 빌드 분리 진입점 ──
   VITE_APP_MODE 는 빌드 시점에 문자열 리터럴로 치환되므로,
   해당하지 않는 쪽 import 는 번들에서 통째로 제거됩니다.
   → 공개 배포 번들에는 직원용 코드·주소가 아예 들어가지 않습니다.

   · 공개 배포 (기본)      : VITE_APP_MODE 미설정 또는 "public"
   · 직원 데스크 배포      : VITE_APP_MODE=admin  (+ VITE_ADMIN_API_URL) */
if (import.meta.env.VITE_APP_MODE === "admin") {
  import("./mainAdmin.jsx");
} else {
  import("./mainPublic.jsx");
}
