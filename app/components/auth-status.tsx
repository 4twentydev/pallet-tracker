"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";
import { forceSyncWithOneDrive } from "@/app/actions/pallets";

export function AuthStatus() {
  const { data: session, status } = useSession();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await forceSyncWithOneDrive();
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (status === "loading") {
    return <div className="text-sm text-muted">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted">
          Sign in to access your OneDrive pallet data
        </p>
        <button
          onClick={async () => {
            try {
              const result = await signIn("azure-ad", {
                callbackUrl: "/",
                redirect: true
              });
              if (result?.error) {
                console.error("[Auth] Sign-in error:", result.error);
              }
            } catch (error) {
              console.error("[Auth] Sign-in exception:", error);
            }
          }}
          className="px-4 py-2 bg-accent-primary text-white rounded-full hover:opacity-90 transition-opacity"
        >
          Sign in with Microsoft
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col">
        <p className="text-sm text-strong">
          {session.user?.name || session.user?.email}
        </p>
        <p className="text-xs text-muted">Connected to OneDrive</p>
      </div>
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="px-3 py-1 text-sm bg-surface border border-border rounded-full hover:bg-surface-muted transition-colors disabled:opacity-50"
      >
        {isSyncing ? "Syncing..." : "Sync Now"}
      </button>
      <button
        onClick={() => signOut()}
        className="px-3 py-1 text-sm bg-surface border border-border rounded-full hover:bg-surface-muted transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}
