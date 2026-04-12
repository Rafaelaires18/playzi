import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasAcceptedCurrentLegalVersion } from "@/lib/legal-consents";

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
        const isAgeCheckRoute = pathname.startsWith('/age-check')
        const isConsentCheckRoute = pathname.startsWith('/consent-check')
        const forceLogin = request.nextUrl.searchParams.get("force_login") === "1"
        const isPublicRoute =
            pathname.startsWith('/login')
            || pathname.startsWith('/forgot-password')
            || pathname.startsWith('/reset-password')
            || pathname.startsWith('/auth/confirm')
            || pathname.startsWith('/auth/callback')
        const isApiRoute = request.nextUrl.pathname.startsWith('/api')
        const isAuthApiRoute = pathname.startsWith('/api/auth/')
        const isAgeVerificationApiRoute = pathname.startsWith('/api/profile/age-verification')
        const isConsentApiRoute = pathname.startsWith('/api/profile/consents')
        const isSupportRequestsApiRoute = pathname.startsWith('/api/support/requests')

        if (!user && !isPublicRoute && !isApiRoute) {
            // Redirect unauthenticated users to the login screen
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            const destination = `${request.nextUrl.pathname}${request.nextUrl.search || ""}`;
            if (destination && destination !== "/login") {
                url.searchParams.set("next", destination);
            }
            return applySecurityHeaders(NextResponse.redirect(url))
        }

        if (user && isAuthRoute && !forceLogin) {
            // Redirect authenticated users away from the login screen
            const url = request.nextUrl.clone()
            const nextParam = request.nextUrl.searchParams.get("next")
            const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
                ? nextParam
                : "/";
            url.pathname = safeNext
            url.search = ""
            return applySecurityHeaders(NextResponse.redirect(url))
        }

        if (user) {
            const { data: profile } = await supabase
                .from("profiles")
                .select("birth_date,age_verification_status,accepted_terms,accepted_terms_at,accepted_legal_version")
                .eq("id", user.id)
                .maybeSingle();

            const ageStatus = String(profile?.age_verification_status || "pending");
            const isAdultVerified = ageStatus === "verified_adult" && !!profile?.birth_date;
            const isBlockedMinor = ageStatus === "blocked_minor";
            const requiresAgeVerification = !isAdultVerified && !isBlockedMinor;
            const bypassAgeGate =
                isAgeCheckRoute
                || isAgeVerificationApiRoute
                || isAuthApiRoute
                || isSupportRequestsApiRoute;
            const hasAcceptedTerms = hasAcceptedCurrentLegalVersion(profile);
            const requiresConsentUpdate = isAdultVerified && !hasAcceptedTerms;
            const bypassConsentGate =
                isConsentCheckRoute
                || isConsentApiRoute
                || isAuthApiRoute
                || isAgeCheckRoute
                || isAgeVerificationApiRoute
                || isSupportRequestsApiRoute;

            if (isBlockedMinor && !bypassAgeGate) {
                if (isApiRoute) {
                    return applySecurityHeaders(
                        NextResponse.json(
                            { error: "Playzi est réservé aux personnes de 18 ans et plus.", code: "minor_blocked" },
                            { status: 403 }
                        )
                    );
                }
                const url = request.nextUrl.clone();
                url.pathname = "/age-check";
                url.search = "";
                url.searchParams.set("blocked", "1");
                return applySecurityHeaders(NextResponse.redirect(url));
            }

            if (requiresAgeVerification && !bypassAgeGate) {
                if (isApiRoute) {
                    return applySecurityHeaders(
                        NextResponse.json(
                            { error: "Vérification d'âge requise.", code: "age_verification_required" },
                            { status: 403 }
                        )
                    );
                }
                const url = request.nextUrl.clone();
                url.pathname = "/age-check";
                url.search = "";
                const destination = `${request.nextUrl.pathname}${request.nextUrl.search || ""}`;
                if (destination && destination !== "/age-check") {
                    url.searchParams.set("next", destination);
                }
                return applySecurityHeaders(NextResponse.redirect(url));
            }

            if (isAdultVerified && isAgeCheckRoute) {
                const url = request.nextUrl.clone();
                const nextParam = request.nextUrl.searchParams.get("next");
                const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
                    ? nextParam
                    : "/discover";
                url.pathname = safeNext;
                url.search = "";
                return applySecurityHeaders(NextResponse.redirect(url));
            }

            if (requiresConsentUpdate && !bypassConsentGate) {
                if (isApiRoute) {
                    return applySecurityHeaders(
                        NextResponse.json(
                            { error: "Acceptation des conditions requise.", code: "consent_required" },
                            { status: 403 }
                        )
                    );
                }
                const url = request.nextUrl.clone();
                url.pathname = "/consent-check";
                url.search = "";
                const destination = `${request.nextUrl.pathname}${request.nextUrl.search || ""}`;
                if (destination && destination !== "/consent-check") {
                    url.searchParams.set("next", destination);
                }
                return applySecurityHeaders(NextResponse.redirect(url));
            }

            if (!requiresConsentUpdate && isConsentCheckRoute) {
                const url = request.nextUrl.clone();
                const nextParam = request.nextUrl.searchParams.get("next");
                const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
                    ? nextParam
                    : "/discover";
                url.pathname = safeNext;
                url.search = "";
                return applySecurityHeaders(NextResponse.redirect(url));
            }
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
