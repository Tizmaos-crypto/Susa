import { useState } from "react";

/* ── 직원 데스크 접근 비밀번호 ──
   ⚠️ 클라이언트 측 게이트라 진짜 보안은 아닙니다(번들에 노출됨). 내부용 최소 차단 용도.
   비밀번호를 바꾸려면 아래 값을 수정하세요. */
const ADMIN_PASSWORD = "pool0709";
const SESSION_KEY = "reservation_desk_admin_ok";

function isUnlocked() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export default function AdminGate({ children }) {
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (pw === ADMIN_PASSWORD) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {}
      setUnlocked(true);
    } else {
      setError(true);
    }
  };

  if (unlocked) return children;

  return (
    <div className="setup-wrap">
      <div className="setup-card">
        <div className="icon">🔒</div>
        <h2>직원 전용</h2>
        <p>데스크 관리 페이지입니다. 비밀번호를 입력해주세요.</p>
        <input
          className="input"
          type="password"
          placeholder="비밀번호"
          value={pw}
          autoFocus
          onChange={(e) => {
            setPw(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && (
          <div style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>
            비밀번호가 올바르지 않습니다.
          </div>
        )}
        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 14 }}
          onClick={submit}
        >
          입장
        </button>
      </div>
    </div>
  );
}
