"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchConfig } from "@/lib/client";
import Logo from "./Logo";

export default function AppHeader({ active }: { active: "new" | "history" }) {
  const [env, setEnv] = useState<"sandbox" | "production" | null>(null);

  useEffect(() => {
    fetchConfig()
      .then((c) => setEnv(c.env))
      .catch(() => setEnv(null));
  }, []);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="app-shell-header">
      <div className="app-shell-inner">
        <div className="brand">
          <div className="logo-tile">
            <Logo src="/logos/pit-logo.png" alt="Perception IT" height={28} fallback="PIT" />
          </div>
          <div className="brand-text">
            <h1>FBR Digital Invoicing Portal</h1>
            <div className="sub">
              by <strong>Perception&nbsp;IT</strong> · official FBR / PRAL integration
            </div>
          </div>
        </div>

        <div className="header-right">
          <nav className="nav">
            <Link href="/" className={active === "new" ? "active" : ""}>
              New invoice
            </Link>
            <Link href="/history" className={active === "history" ? "active" : ""}>
              History
            </Link>
          </nav>
          {env && (
            <span
              className={`env-badge ${env === "production" ? "env-production" : "env-sandbox"}`}
            >
              {env}
            </span>
          )}
          <div className="logo-tile fbr-tile">
            <Logo src="/logos/fbr-logo.png" alt="FBR Pakistan" height={30} fallback="FBR" />
          </div>
          <button type="button" className="logout-btn" onClick={logout} title="Sign out">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
