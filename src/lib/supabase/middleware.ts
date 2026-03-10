import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function applySecurityHeaders(response: NextResponse) {
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    return response;
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    // Defensive check for Vercel Environment Variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // If variables are missing at Edge runtime, fail gracefully without crashing the server
    if (!supabaseUrl || !supabaseKey) {
        console.error("Missing Supabase Environment Variables in Middleware")
        return applySecurityHeaders(supabaseResponse)
    }

    const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    try {
        // Fetch the current user session
        const { data: { user } } = await supabase.auth.getUser()

        // Protect the routes
        const pathname = request.nextUrl.pathname
        const isAuthRoute = pathname.startsWith('/login')
        const forceLogin = request.nextUrl.searchParams.get("force_login") === "1"
        const isPublicRoute =
            pathname.startsWith('/login')
            || pathname.startsWith('/forgot-password')
            || pathname.startsWith('/reset-password')
            || pathname.startsWith('/auth/confirm')
            || pathname.startsWith('/auth/callback')
        const isApiRoute = request.nextUrl.pathname.startsWith('/api')

        if (!user && !isPublicRoute && !isApiRoute) {
            // Redirect unauthenticated users to the login screen
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return applySecurityHeaders(NextResponse.redirect(url))
        }

        if (user && isAuthRoute && !forceLogin) {
            // Redirect authenticated users away from the login screen
            const url = request.nextUrl.clone()
            url.pathname = '/'
            return applySecurityHeaders(NextResponse.redirect(url))
        }

        return applySecurityHeaders(supabaseResponse)
    } catch (e) {
        // Fallback for Vercel Edge errors (e.g., Supabase timeout)
        console.error("Supabase Edge Middleware Error:", e)
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return applySecurityHeaders(NextResponse.redirect(url))
    }
}
