import { useState } from "react";
import { getAdminToken, setAdminToken, clearAdminToken, adminApiUrl } from "./adminAuth.js";

/* ── 직원 데스크 인증 게이트 ──
   ⚠️ 예전처럼 브라우저 안에서 비밀번호를 비교하지 않습니다.
   입력한 토큰을 백엔드에 실제로 검증 요청하고, 서버가 인정할 때만 통과합니다.
   (토큰은 번들에 없고, 통과 후 sessionStorage 에만 보관 — 탭을 닫으면 사라짐) */
export default function AdminGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => !!getAdminToken());
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    const token = pw.trim();
    if (!token || checking) return;
    setChecking(true);
    setError("");
    try {
      // 서버에 토큰 검증 (가벼운 조회 1건)
      const params = new URLSearchParams({
        action: "range",
        from: "2000-01-01",
        to: "2000-01-01",
        token,
      });
      const resp = await fetch(`${adminApiUrl()}?${params.toString()}`);
      const json = await resp.json();
      if (json.unauthorized) {
        setError("토큰이 올바르지 않습니다.");
      } else if (json.error) {
        setError(json.error);
      } else {
        setAdminToken(token);
        setUnlocked(true);
      }
    } catch {
      setError("서버에 연결할 수 없습니다. 네트워크를 확인해주세요.");
    } finally {
      setChecking(false);
    }
  };

  if (unlocked) return children;

  return (
    <div className="setup-wrap">
      <div className="setup-card">
        <div className="icon">🔒</div>
        <h2>직원 전용</h2>
        <p>
          데스크 관리 시스템입니다.
          <br />
          <small>발급받은 직원 토큰을 입력해주세요.</small>
        </p>
        <input
          className="input"
          type="password"
          placeholder="직원 토큰"
          value={pw}
          autoFocus
          autoComplete="off"
          onChange={(e) => {
            setPw(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && (
          <div style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{error}</div>
        )}
        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 14, opacity: pw.trim() ? 1 : 0.45 }}
          disabled={!pw.trim() || checking}
          onClick={submit}
        >
          {checking ? "확인 중…" : "입장"}
        </button>
      </div>
    </div>
  );
}

export { clearAdminToken };
