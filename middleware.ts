import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { envMissing, SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

export async function middleware(request: NextRequest) {
  const missing = envMissing();
  if (missing.length) {
    return new NextResponse(
      `Lagerstyring mangler oppsett. Legg inn disse under Vercel -> Settings -> Environment Variables og deploy på nytt: ${missing.join(", ")}`,
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }
  try {
    return await refreshSession(request);
  } catch (err) {
    console.error("Middleware-feil", err);
    return NextResponse.next({ request });
  }
}

async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const open = ["/login", "/velkommen"].some((p) => request.nextUrl.pathname.startsWith(p));
  if (!user && !open) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
