"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        username,
        password,
      });

      if (res?.error) {
        setError("خطأ في اسم المستخدم أو كلمة المرور");
      } else {
        router.push(callbackUrl);
      }
    } catch (err: any) {
      setError("حدث خطأ ما، يرجى المحاولة مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-panel">
        <div className="login-header">
          <img src="/logo.png" alt="24Med Logo" className="login-logo" />
          <h1 className="gradient-text">تسجيل الدخول</h1>
          <p>أهلاً بك في نظام 24MED لإدارة المستلزمات الطبية</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">اسم المستخدم</label>
            <input
              id="username"
              type="text"
              className="input-field"
              placeholder="أدخل اسم المستخدم"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">كلمة المرور</label>
            <input
              id="password"
              type="password"
              className="input-field"
              placeholder="أدخل كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={loading}
          >
            {loading ? "جاري التحميل..." : "دخول"}
          </button>
        </form>

        <div className="login-footer">
          <span>&copy; 2026 24MED System. All rights reserved.</span>
        </div>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at center, #0d151c 0%, #05080a 100%);
          padding: 20px;
        }

        .login-card {
          width: 100%;
          max-width: 450px;
          padding: 40px;
          animation: fadeIn 0.8s ease-out;
          border: 1px solid rgba(16, 185, 129, 0.15);
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-logo {
          height: 80px;
          margin-bottom: 16px;
        }

        .login-header h1 {
          font-size: 2rem;
          margin-bottom: 8px;
        }

        .login-header p {
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 0.9rem;
          color: var(--text-primary);
          font-weight: 600;
        }

        .login-btn {
          width: 100%;
          padding: 14px;
          font-size: 1.1rem;
          margin-top: 8px;
        }

        .error-message {
          color: var(--danger-color);
          background: rgba(244, 63, 94, 0.1);
          padding: 12px;
          border-radius: var(--radius-md);
          font-size: 0.9rem;
          text-align: center;
          border: 1px solid rgba(244, 63, 94, 0.2);
        }

        .login-footer {
          margin-top: 32px;
          text-align: center;
          color: var(--text-secondary);
          font-size: 0.75rem;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
