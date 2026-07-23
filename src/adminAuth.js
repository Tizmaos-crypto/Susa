/* ── 직원 데스크 인증 정보 (직원용 번들에만 포함) ──
   토큰은 소스에 하드코딩하지 않고, 직원이 로그인 시 입력한 값을
   sessionStorage 에만 보관합니다 (탭을 닫으면 삭제 → 공용 PC에서도 안전). */

const TOKEN_KEY = "reservation_admin_token";

export function getAdminToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setAdminToken(token) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* 저장 불가 시에도 현재 세션 동작에는 영향 없음 */
  }
}

export function clearAdminToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

/* 직원 백엔드 주소 — 공개 배포에는 이 값이 존재하지 않습니다 */
export function adminApiUrl() {
  const fromEnv = import.meta.env.VITE_ADMIN_API_URL;
  if (fromEnv) return String(fromEnv).trim();
  try {
    return localStorage.getItem("reservation_desk_api_url") || "";
  } catch {
    return "";
  }
}

/* 인증 만료/실패 시 토큰을 지우고 로그인 화면으로 되돌림 */
export function handleUnauthorized() {
  clearAdminToken();
  alert("인증이 만료되었습니다. 다시 로그인해주세요.");
  window.location.reload();
}
