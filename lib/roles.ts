import type { Status } from "./types";

export type Role = "admin" | "warehouse" | "driver" | "accounts" | "inbox";

export const ROLES: { id: Role; name: string; person: string }[] = [
  { id: "admin", name: "Back office", person: "Back-office clerk" },
  { id: "warehouse", name: "Warehouse", person: "Warehouse lead" },
  { id: "driver", name: "Driver", person: "Delivery driver" },
  { id: "accounts", name: "Accounts", person: "Accounts team" },
  { id: "inbox", name: "Customer inbox", person: "Customer" },
];

export const roleName = (r: Role) => ROLES.find((x) => x.id === r)!.name;

/** Which screen handles an order in each status. */
export const ROLE_OF: Record<Status, Role> = {
  stored: "admin",
  extracted: "admin",
  saved: "warehouse",
  short: "warehouse",
  ready: "admin",
  decided: "admin",
  released: "admin",
  invoiced: "driver",
  out: "driver",
  signed: "driver",
  proof_ok: "accounts",
  paid: "accounts",
  matched: "accounts",
  closed: "accounts",
  emailed: "inbox",
};
