import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function sanitizeNextPath(value: string | null): string {
    if (!value) return "/";
    const trimmed = value.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
    return trimmed;
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    // if "next" is in param, use it as the redirect path
    const next = sanitizeNextPath(searchParams.get('next'));

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Check if user has a gender in their profile
            const { data: { user } } = await supabase.auth.getUser();
            console.info("[AUTH][oauth_callback][exchange_success]", {
                user_id: user?.id || null,
                user_email: user?.email || null,
            });
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('gender')
                    .eq('id', user.id)
                    .single();

                // If gender is missing, redirect to complete-profile
                if (!profile?.gender) {
                    return NextResponse.redirect(`${origin}/complete-profile?next=${encodeURIComponent(next)}`);
                }
            }

            const forwardedHost = request.headers.get('x-forwarded-host'); // original origin before load balancer
            const isLocalEnv = process.env.NODE_ENV === 'development';
            if (isLocalEnv) {
                // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
                return NextResponse.redirect(`${origin}${next}`);
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`);
            } else {
                return NextResponse.redirect(`${origin}${next}`);
            }
        }
        console.error("[AUTH][oauth_callback][exchange_failed]", {
            error: error?.message || "unknown",
        });
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/login?force_login=1&error=oauth_failed`);
}
