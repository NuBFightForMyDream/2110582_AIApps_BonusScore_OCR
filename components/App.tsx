"use client";

import { useStore } from "@/lib/store";
import OrderView from "./OrderView";
import { GmailModal, GuideBar, Toasts } from "./Overlays";
import Queue from "./Queue";
import SidePanel from "./SidePanel";
import TopBar from "./TopBar";
import Welcome from "./Welcome";

export default function App() {
  const s = useStore();
  const o = s.orders.find((x) => x.id === s.selected);
  return (
    <div className={`app ${s.guide ? "has-guide" : ""}`}>
      <TopBar />
      <div className="shell">
        <Queue />
        <main className="workspace">{o ? <OrderView o={o} /> : <Welcome />}</main>
        <SidePanel />
      </div>
      <GmailModal />
      <Toasts />
      <GuideBar />
    </div>
  );
}
