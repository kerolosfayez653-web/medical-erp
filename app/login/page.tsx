'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  useEffect(() => {
    setMounted(true);
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('برجاء إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(redirect);
        router.refresh();
      } else {
        setError(data.error || 'بيانات الدخول غير صحيحة');
      }
    } catch {
      setError('حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#05080a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Cairo', sans-serif",
      direction: 'rtl',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated background */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'pulse 6s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', left: '-10%',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'pulse 8s ease-in-out infinite reverse',
        }} />
        {/* Grid lines */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(16,185,129,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;800&display=swap');
        @keyframes pulse { 0%,100%{transform:scale(1) translate(0,0);opacity:0.8} 50%{transform:scale(1.1) translate(-20px,20px);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .login-card { animation: fadeUp 0.6s ease forwards; }
        .login-input:focus { border-color: #10b981 !important; box-shadow: 0 0 0 3px rgba(16,185,129,0.15) !important; outline: none; }
        .login-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(16,185,129,0.4) !important; }
        .login-btn:active { transform: translateY(0); }
        .login-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .spinner { width:20px;height:20px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;display:inline-block; }
      `}</style>

      <div className="login-card" style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: '460px',
        margin: '20px',
        background: 'rgba(13,21,28,0.9)',
        border: '1px solid rgba(16,185,129,0.2)',
        borderRadius: '24px',
        padding: '48px 40px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(16,185,129,0.1)',
      }}>
        {/* Logo & Brand */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img src="/logo.png" alt="24Med" style={{ height: '70px', marginBottom: '20px' }} />
          <h1 style={{
            fontSize: '1.8rem', fontWeight: '800', color: '#f1f5f9',
            margin: '0 0 8px',
          }}>
            مرحباً بعودتك 👋
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
            سجّل دخولك للوصول إلى نظام الإدارة
          </p>
        </div>

        {/* Divider */}
        <div style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.3), transparent)',
          marginBottom: '32px',
        }} />

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>
              👤 اسم المستخدم
            </label>
            <input
              className="login-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="أدخل اسم المستخدم"
              autoComplete="username"
              style={{
                width: '100%', padding: '14px 16px',
                background: 'rgba(5,8,10,0.8)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: '12px',
                color: '#f1f5f9', fontSize: '1rem',
                fontFamily: 'Cairo, sans-serif',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>
              🔒 كلمة المرور
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="login-input"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                autoComplete="current-password"
                style={{
                  width: '100%', padding: '14px 50px 14px 16px',
                  background: 'rgba(5,8,10,0.8)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: '12px',
                  color: '#f1f5f9', fontSize: '1rem',
                  fontFamily: 'Cairo, sans-serif',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#64748b', fontSize: '1.1rem', padding: '4px',
                }}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(244,63,94,0.1)',
              border: '1px solid rgba(244,63,94,0.3)',
              borderRadius: '10px',
              padding: '12px 16px',
              color: '#f43f5e',
              fontSize: '0.9rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <button
            className="login-btn"
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '15px',
              background: 'linear-gradient(135deg, #10b981, #047857)',
              border: 'none', borderRadius: '12px',
              color: 'white', fontSize: '1.05rem', fontWeight: '700',
              fontFamily: 'Cairo, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 20px rgba(16,185,129,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            }}
          >
            {loading ? (
              <>
                <span className="spinner" />
                جاري تسجيل الدخول...
              </>
            ) : (
              <>
                🚀 تسجيل الدخول
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <div style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
            marginBottom: '20px',
          }} />
          <p style={{ color: '#334155', fontSize: '0.8rem', margin: 0 }}>
            © 2026 24MED — نظام إدارة التوزيع الطبي
          </p>
          <p style={{ color: '#1e293b', fontSize: '0.75rem', marginTop: '4px' }}>
            v1.1.3 • جميع الحقوق محفوظة
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#05080a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#10b981', fontFamily: 'Cairo, sans-serif', fontSize: '1.2rem' }}>جاري التحميل...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
