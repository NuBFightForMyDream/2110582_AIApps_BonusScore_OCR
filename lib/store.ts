"use client";

import { useSyncExternalStore } from "react";
import { INITIAL_BANK, INITIAL_STOCK } from "./data";
import type { BankTx, BusyKind, LogEntry, Order, Sku, Toast } from "./types";

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
  guide: { orderId: string | null } | null;
  composeFor: string | null;
  toasts: Toast[];
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
    composeFor: null,
    toasts: [],
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
