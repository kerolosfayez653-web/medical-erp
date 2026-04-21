import { NextRequest, NextResponse } from 'next/server';

const VALID_USERNAME = 'admin';
const VALID_PASSWORD = '24med2026';
// Token ثابت يُحفظ في الـ cookie - لا يتغير
// يمكن تغييره يدوياً هنا لإبطال كل الجلسات
const SESSION_TOKEN = 'erp_secure_v1_24med_2026_a7b8c9d0e1f2';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'برجاء إدخال بيانات الدخول' }, { status: 400 });
    }

    if (username.trim() !== VALID_USERNAME || password !== VALID_PASSWORD) {
      return NextResponse.json({ success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 });
    }

    // sessionValue = "username:static_token"
    const sessionValue = `${VALID_USERNAME}:${SESSION_TOKEN}`;

    const response = NextResponse.json({ success: true });
    response.cookies.set('erp_session', sessionValue, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 أيام
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ success: false, error: 'خطأ في الخادم' }, { status: 500 });
  }
}
