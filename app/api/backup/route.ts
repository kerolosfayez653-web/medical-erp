import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Function to refresh Google Drive Access Token using Refresh Token
async function getDriveAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Failed to refresh access token');
  }
  return data.access_token;
}

// Function to upload a file to Google Drive using multipart upload
async function uploadToGoogleDrive(accessToken: string, filename: string, content: string) {
  const metadata = {
    name: filename,
    mimeType: 'application/json',
  };

  const boundary = 'foo_bar_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    content +
    closeDelimiter;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(Buffer.byteLength(body)),
    },
    body: body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to upload to Google Drive');
  }
  return data;
}

export async function GET() {
  try {
    // 1. List local backup files
    let localBackups: any[] = [];
    if (fs.existsSync(BACKUP_DIR)) {
      const files = fs.readdirSync(BACKUP_DIR);
      localBackups = files
        .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
        .map(f => {
          const filePath = path.join(BACKUP_DIR, f);
          const stat = fs.statSync(filePath);
          return {
            filename: f,
            size: stat.size,
            createdAt: stat.birthtime,
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // 2. Check if Google Drive is configured
    const gDriveConfigured = !!(
      process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN
    );

    return NextResponse.json({
      success: true,
      localBackups,
      googleDrive: {
        configured: gDriveConfigured,
        clientId: process.env.GOOGLE_DRIVE_CLIENT_ID ? 'Configured (starts with ' + process.env.GOOGLE_DRIVE_CLIENT_ID.slice(0, 8) + '...)' : null,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { uploadToDrive = true } = body;

    // 1. Fetch all data from database
    const [
      products,
      people,
      invoices,
      invoiceItems,
      payments,
      expenses,
      lots,
      quotations,
      quotationItems,
      transfers,
    ] = await Promise.all([
      prisma.product.findMany(),
      prisma.person.findMany(),
      prisma.invoice.findMany(),
      prisma.invoiceItem.findMany(),
      prisma.payment.findMany(),
      prisma.expense.findMany(),
      prisma.inventoryLot.findMany(),
      prisma.quotation.findMany(),
      prisma.quotationItem.findMany(),
      prisma.transfer.findMany(),
    ]);

    const backupPayload = {
      version: '1.1.4',
      timestamp: new Date().toISOString(),
      data: {
        products,
        people,
        invoices,
        invoiceItems,
        payments,
        expenses,
        lots,
        quotations,
        quotationItems,
        transfers,
      }
    };

    const backupContent = JSON.stringify(backupPayload, null, 2);
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestampStr}.json`;

    // 2. Save locally
    const filePath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filePath, backupContent, 'utf-8');

    // 3. Upload to Google Drive if configured
    let driveUploadStatus = 'NOT_CONFIGURED';
    let driveError = null;
    let driveFileId = null;

    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

    if (uploadToDrive && clientId && clientSecret && refreshToken) {
      try {
        const accessToken = await getDriveAccessToken(clientId, clientSecret, refreshToken);
        const driveResult = await uploadToGoogleDrive(accessToken, filename, backupContent);
        driveUploadStatus = 'SUCCESS';
        driveFileId = driveResult.id;
      } catch (err: any) {
        console.error('Google Drive Upload Failed:', err);
        driveUploadStatus = 'FAILED';
        driveError = err.message || String(err);
      }
    }

    return NextResponse.json({
      success: true,
      filename,
      size: Buffer.byteLength(backupContent),
      localSaved: true,
      driveUpload: {
        status: driveUploadStatus,
        fileId: driveFileId,
        error: driveError,
      },
      backupData: backupPayload // Return to allow immediate browser download
    });

  } catch (error: any) {
    console.error('Backup generation failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
