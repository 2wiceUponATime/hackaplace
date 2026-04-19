"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useState } from "react";

export default function Header() {
    const { data: session, isPending } = authClient.useSession();
    const [ loading, setLoading ] = useState(false);

    return (
        <header id="header" className="font-sans flex items-center justify-between px-4 py-3 border-b">
            <Link href="/" className="font-semibold text-[2em]">Hackaplace</Link>
            {loading || isPending ? (
                <></>
            ) : (
                <div className="flex items-center gap-3">
                    {session ? (
                        <>
                            <span>{session.user.name ?? session.user.email}</span>
                            <button className="button"
                                onClick={() => {
                                    setLoading(true);
                                    authClient.signOut().then(() => setLoading(false));
                                }}
                            >
                                Sign out
                            </button>
                        </>
                    ) : (
                        <button className="button"
                            onClick={() => {
                                authClient.signIn.oauth2({ providerId: "hack-club" }).then(() => setLoading(false));
                                setLoading(true);
                            }}
                        >
                            Sign in
                        </button>
                    )}
                </div>
            )}
        </header>
    );
}
