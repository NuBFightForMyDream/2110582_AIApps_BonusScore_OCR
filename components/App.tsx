"use client";

import { redo, undo } from "@/lib/actions";
import { useStore } from "@/lib/store";
import { useEffect } from "react";
import { AgentConfirm } from "./AgentReview";
import { GuideBar, Toasts } from "./Overlays";
import AccountsScreen from "./screens/AccountsScreen";
import AdminScreen from "./screens/AdminScreen";
import DriverScreen from "./screens/DriverScreen";
import InboxScreen from "./screens/InboxScreen";
import WarehouseScreen from "./screens/WarehouseScreen";
import TopBar from "./TopBar";

const SCREENS = {
  admin: AdminScreen,
  warehouse: WarehouseScreen,
  driver: DriverScreen,
  accounts: AccountsScreen,
  inbox: InboxScreen,
};

export default function App() {
  const s = useStore();
  const Screen = SCREENS[s.role];

  // Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) step back and forth, except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`app role-${s.role} ${s.guide ? "has-guide" : ""}`}>
      <TopBar />
      <main className="screen" id="main">
        <Screen />
      </main>
      <AgentConfirm />
      <Toasts />
      <GuideBar />
    </div>
  );
}
