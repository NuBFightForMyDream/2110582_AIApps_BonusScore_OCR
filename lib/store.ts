"use client";

import { useSyncExternalStore } from "react";
import { INITIAL_BANK, INITIAL_STOCK } from "./data";
import type { Role } from "./roles";
import type { BankTx, BusyKind, LogEntry, Order, Sku, Toast } from "./types";

/** The parts of the state that undo/redo rewinds. */
export type Snapshot = Pick<State, "orders" | "selected" | "log" | "stock" | "bank" | "nextNo" | "paperIdx">;

export interface HistoryEntry {
  label: string;
  snap: Snapshot;
}

export interface State {
  orders: Order[];
  selected: string | null;
  log: LogEntry[];
  busy: Record<string, BusyKind>;
  stock: Record<Sku, number>;
  bank: BankTx[];
  nextNo: number;
  paperIdx: number;
  /** Step-by-step guide: which invoice it is following. null when the guide is off. */
  guide: { orderId: string | null; /** Last step whose screen the guide opened. */ shown?: string } | null;
  /** Orders whose automatic steps are running right now. */
  running: Record<string, true>;
  toasts: Toast[];
  /** Which role's screen is showing. Not part of undo. */
  role: Role;
  /** Undo stack (oldest first) and redo stack (most recent undo last). */
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export function initialState(): State {
  return {
    orders: [],
    selected: null,
    log: [],
    busy: {},
    stock: { ...INITIAL_STOCK },
    bank: INITIAL_BANK.map((t) => ({ ...t })),
    nextNo: 2041,
    paperIdx: 0,
    guide: null,
    running: {},
    toasts: [],
    role: "admin",
    past: [],
    future: [],
  };
}

/*
 * Tiny mutable store. Actions mutate `state` inside `update()` and bump a
 * version number; components re-render through useSyncExternalStore.
 * Everything lives in the browser — this is the "mock backend".
 */
let state = initialState();
let version = 0;
const listeners = new Set<() => void>();

export const getState = () => state;

export function update(fn: (s: State) => void) {
  fn(state);
  version++;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getVersion = () => version;

export function useStore(): State {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return state;
}
