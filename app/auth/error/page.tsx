"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export default function AuthError() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The verification token has expired or has already been used.",
    OAuthSignin: "Error occurred during OAuth sign-in process.",
    OAuthCallback: "Error occurred during OAuth callback.",
    OAuthCreateAccount: "Could not create OAuth account.",
    EmailCreateAccount: "Could not create email account.",
    Callback: "Error in callback handler.",
    OAuthAccountNotLinked: "Email already associated with another account.",
    EmailSignin: "Unable to send sign-in email.",
    CredentialsSignin: "Sign in failed. Check your credentials.",
    SessionRequired: "Please sign in to access this page.",
    Default: "An unknown error occurred during authentication.",
  };

  const message = errorMessages[error || "Default"] || errorMessages.Default;

  return (
    <div className="flex min-h-screen items-center justify-center bg-base">
      <div className="max-w-md rounded-3xl border border-border bg-surface p-8 text-center">
        <h1 className="mb-4 text-2xl font-bold text-strong">
          Authentication Error
        </h1>
        <p className="mb-6 text-muted">{message}</p>
        <div className="space-y-2">
          <p className="text-sm text-muted">Error code: {error || "Unknown"}</p>
          <div className="flex flex-col gap-2 mt-6">
            <button
              onClick={() => signIn("azure-ad")}
              className="w-full px-4 py-2 bg-accent-primary text-white rounded-full hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
            <a
              href="/"
              className="w-full px-4 py-2 border border-border rounded-full hover:bg-surface-muted transition-colors inline-block"
            >
              Go Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
