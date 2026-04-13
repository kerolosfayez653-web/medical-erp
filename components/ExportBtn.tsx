"use client";
import React, { useState } from 'react';

interface ExportBtnProps {
  type: string;
  params?: Record<string, string>;
  label?: string;
  style?: React.CSSProperties;
  className?: string;
}

export default function ExportBtn({ type, params = {}, label = "📊 إكسيل", style, className }: ExportBtnProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({ type, ...params });
      const response = await fetch(`/api/export?${queryParams.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Try to extract filename from content-disposition
      const disposition = response.headers.get('content-disposition');
      let filename = 'export.xlsx';
      if (disposition && disposition.indexOf('filename*=') !== -1) {
        const parts = disposition.split("filename*=UTF-8''");
        if (parts.length > 1) filename = decodeURIComponent(parts[1]);
      } else if (disposition && disposition.indexOf('filename=') !== -1) {
        filename = disposition.split('filename=')[1].replace(/"/g, '');
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
      alert('خطأ أثناء التصدير: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleExport}
      disabled={loading}
      className={className || "btn"}
      style={{ 
        background: '#10b981', 
        color: 'white', 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '8px',
        opacity: loading ? 0.7 : 1,
        cursor: loading ? 'not-allowed' : 'pointer',
        ...style 
      }}
    >
      {loading ? '⏳ جاري التحميل...' : label}
    </button>
  );
}
