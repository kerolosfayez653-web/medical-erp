"use client";
import React, { useState, useEffect } from "react";

interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
}

export default function BackupPage() {
  const [loading, setLoading] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/backup");
      const data = await res.json();
      if (data.success) {
        setStatus(data);
      } else {
        setMessage({ text: "فشل تحميل حالة النسخ الاحتياطي: " + data.error, type: "error" });
      }
    } catch (e: any) {
      setMessage({ text: "خطأ في الاتصال بالخادم", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const triggerBackup = async () => {
    setRunningBackup(true);
    setMessage({ text: "جاري إنشاء النسخة الاحتياطية وتصدير البيانات...", type: "info" });
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadToDrive: true })
      });
      const data = await res.json();
      if (data.success) {
        // Trigger download of the backup file
        const blob = new Blob([JSON.stringify(data.backupData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        let msg = `تم إنشاء النسخة الاحتياطية بنجاح وحفظها محلياً باسم (${data.filename}) وبدء تحميلها تلقائياً.`;
        if (data.driveUpload.status === "SUCCESS") {
          msg += " ✅ وتم رفعها بنجاح إلى حسابك على Google Drive!";
        } else if (data.driveUpload.status === "FAILED") {
          msg += ` ⚠️ ولكن فشل الرفع إلى Google Drive: ${data.driveUpload.error}`;
        } else {
          msg += " ℹ️ (لم يتم الرفع إلى Google Drive لعدم تهيئة مفاتيح الاتصال).";
        }

        setMessage({ text: msg, type: data.driveUpload.status === "FAILED" ? "info" : "success" });
        fetchStatus();
      } else {
        setMessage({ text: "فشل إنشاء النسخة الاحتياطية: " + data.error, type: "error" });
      }
    } catch (e: any) {
      setMessage({ text: "خطأ غير متوقع أثناء النسخ الاحتياطي", type: "error" });
    } finally {
      setRunningBackup(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", paddingBottom: "50px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            🔄 إدارة النسخ الاحتياطي
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>
            احمِ بيانات شركتك عن طريق أخذ نسخ احتياطية دورية وحفظها على Google Drive أو جهازك الشخصي.
          </p>
        </div>
        <button
          onClick={triggerBackup}
          disabled={runningBackup}
          className="btn btn-primary"
          style={{ fontSize: "1rem", padding: "12px 28px" }}
        >
          {runningBackup ? "⏳ جاري النسخ..." : "🚀 إنشاء نسخة احتياطية الآن"}
        </button>
      </div>

      {message && (
        <div
          className="glass-panel"
          style={{
            marginBottom: "2rem",
            background:
              message.type === "success"
                ? "rgba(16, 185, 129, 0.08)"
                : message.type === "error"
                ? "rgba(244, 63, 94, 0.08)"
                : "rgba(59, 130, 246, 0.08)",
            borderColor:
              message.type === "success"
                ? "var(--success-color)"
                : message.type === "error"
                ? "var(--danger-color)"
                : "#3b82f6",
            padding: "16px 20px",
            color: "var(--text-primary)",
            fontSize: "0.95rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "1.2rem"
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="stats-grid" style={{ marginBottom: "2rem" }}>
        <div className="stat-card" style={{ borderTop: "4px solid var(--accent-color)" }}>
          <span className="stat-title">حالة Google Drive</span>
          <span
            className="stat-value"
            style={{
              color: status?.googleDrive?.configured ? "var(--success-color)" : "var(--warning-color)",
              fontSize: "1.8rem"
            }}
          >
            {status?.googleDrive?.configured ? "✅ متصل ونشط" : "⚠️ غير متصل"}
          </span>
          <small style={{ color: "var(--text-secondary)" }}>
            {status?.googleDrive?.configured
              ? "يتم رفع النسخ تلقائياً إلى حساب Google Drive الخاص بالشركة."
              : "النسخ الاحتياطي يعمل محلياً فقط. اربط حساب Google Drive للحماية من الفقدان."}
          </small>
        </div>

        <div className="stat-card" style={{ borderTop: "4px solid #3b82f6" }}>
          <span className="stat-title">إجمالي النسخ المحلية</span>
          <span className="stat-value" style={{ color: "#3b82f6" }}>
            {status?.localBackups?.length || 0} نسخة
          </span>
          <small style={{ color: "var(--text-secondary)" }}>
            آخر نسخة محفظة: {status?.localBackups?.[0] ? new Date(status.localBackups[0].createdAt).toLocaleDateString("ar-EG") : "لا يوجد"}
          </small>
        </div>
      </div>

      <div className="glass-panel" style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>📋 سجل النسخ الاحتياطية المحلية</h2>
        {loading && <p>جاري تحميل السجل...</p>}
        {!loading && (!status?.localBackups || status.localBackups.length === 0) && (
          <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "20px" }}>
            لا توجد نسخ احتياطية محفوظة حالياً على الخادم. اضغط على الزر في الأعلى لإنشاء أول نسخة.
          </p>
        )}
        {!loading && status?.localBackups && status.localBackups.length > 0 && (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>اسم الملف</th>
                  <th>الحجم</th>
                  <th>تاريخ الإنشاء</th>
                  <th>خيارات</th>
                </tr>
              </thead>
              <tbody>
                {status.localBackups.map((file: BackupFile) => (
                  <tr key={file.filename}>
                    <td style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                      {file.filename}
                    </td>
                    <td>{formatSize(file.size)}</td>
                    <td>{new Date(file.createdAt).toLocaleString("ar-EG")}</td>
                    <td>
                      <a
                        href={`/backups/${file.filename}`}
                        download
                        className="btn"
                        style={{
                          padding: "6px 12px",
                          fontSize: "0.8rem",
                          borderColor: "rgba(16, 185, 129, 0.3)",
                          color: "var(--accent-color)"
                        }}
                        onClick={(e) => {
                          // Allow fallback or notify if direct file server route is not exposed
                          // Better way: Download backup JSON via JS if needed
                        }}
                      >
                        📥 تحميل ملف
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass-panel">
        <h2 style={{ marginBottom: "1rem", color: "var(--warning-color)" }}>🔑 إعداد ربط Google Drive تلقائياً</h2>
        <p style={{ fontSize: "0.95rem", lineHeight: "1.7", marginBottom: "1.5rem" }}>
          لكي يقوم النظام برفع النسخ الاحتياطية تلقائياً وبأمان إلى Google Drive الخاص بك، يرجى إضافة الإعدادات التالية في ملف البيئة الخاص بك <code>.env</code>:
        </p>
        <pre
          style={{
            background: "rgba(0,0,0,0.3)",
            padding: "20px",
            borderRadius: "10px",
            fontFamily: "monospace",
            fontSize: "0.9rem",
            direction: "ltr",
            textAlign: "left",
            lineHeight: "1.5",
            border: "1px solid var(--border-color)",
            marginBottom: "1.5rem"
          }}
        >
          {`GOOGLE_DRIVE_CLIENT_ID="XXXXXX-XXXXXXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com"
GOOGLE_DRIVE_CLIENT_SECRET="GOCSPX-XXXXXXXXXXXXXXXXXXXXXXXXXXXX"
GOOGLE_DRIVE_REFRESH_TOKEN="1//XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"`}
        </pre>
        <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>خطوات الحصول على المعاملات:</h3>
        <ol style={{ paddingRight: "20px", lineHeight: "1.8", color: "var(--text-secondary)" }}>
          <li>ادخل على <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-color)" }}>Google Cloud Console</a>.</li>
          <li>أنشئ مشروعاً جديداً وقم بتفعيل <strong>Google Drive API</strong>.</li>
          <li>اذهب إلى <strong>APIs & Services &gt; Credentials</strong> وأنشئ <strong>OAuth Client ID</strong> من نوع &quot;Web Application&quot;.</li>
          <li>أضف عنوان Redirect URI ليكون: <code>https://developers.google.com/oauthplayground</code> مؤقتاً لتوليد الـ Refresh Token.</li>
          <li>ادخل على <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-color)" }}>OAuth 2.0 Playground</a>، واختر Google Drive API (نطاق: <code>https://www.googleapis.com/auth/drive.file</code>).</li>
          <li>اضغط على Authorize وقم بتوليد الـ <strong>Refresh Token</strong>.</li>
        </ol>
      </div>
    </div>
  );
}
