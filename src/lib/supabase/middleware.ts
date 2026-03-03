import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
        return supabaseResponse
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
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
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
        const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
        const isApiRoute = request.nextUrl.pathname.startsWith('/api')

        if (!user && !isAuthRoute && !isApiRoute) {
            // Redirect unauthenticated users to the login screen
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }

        if (user && isAuthRoute) {
            // Redirect authenticated users away from the login screen
            const url = request.nextUrl.clone()
            url.pathname = '/'
            return NextResponse.redirect(url)
        }

        return supabaseResponse
    } catch (e) {
        // Fallback for Vercel Edge errors (e.g., Supabase timeout)
        console.error("Supabase Edge Middleware Error:", e)
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }
}
