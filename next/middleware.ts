import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const accessToken = req.cookies.get("access_token")?.value;
  const { pathname } = req.nextUrl;

  const isProtectedPath = pathname.startsWith("/dashboard");

  // 認証必須ページに未ログインでアクセスした場合はリダイレクト
  if (isProtectedPath && !accessToken) {
    const loginUrl = new URL("/login", req.url);
    // ログイン後に戻る用
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ログイン済みで "/", "/login", "/signup" にアクセスがあった場合
  const isAuthPage = ["/", "/login", "/signup"].includes(pathname);
  if (isAuthPage && accessToken) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

// ミドルウェアを適用するパス
export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
