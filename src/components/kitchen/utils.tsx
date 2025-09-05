"use client";

import React from "react";
import { MenuItem, Order } from "@/types";

export const formatDateBeirut = (utcDate: string) =>
  new Date(`${utcDate}Z`).toLocaleString("en-US", { timeZone: "Asia/Beirut" });

export const buildMenuIndex = (menuItems: MenuItem[]) => {
  const idx: Record<number, MenuItem> = {};
  for (const mi of menuItems) idx[mi.id] = mi;
  return idx as Record<number, MenuItem>;
};

export const getOrderSubtotal = (order: Order, menuIndex: Record<number, MenuItem | undefined>) =>
  (order.order_items?.reduce((sum, it) => {
    const m = menuIndex[it.menu_item_id];
    return sum + (m ? m.price * it.quantity : 0);
  }, 0) || 0);

export const getOrderDiscount = (order: Order, subtotal: number) => {
  const pct = order.disc_pct && order.disc_pct > 0 ? order.disc_pct : 0;
  const amt = order.disc_amt && order.disc_amt > 0 ? order.disc_amt : 0;
  let discount = 0;
  if (pct > 0) discount = (subtotal * pct) / 100;
  else if (amt > 0) discount = amt;
  return Math.min(discount, subtotal);
};

export const buildHighlighter = (q: string) => {
  const qq = q.trim().toLowerCase();
  if (!qq) return (text: string) => text;
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapeRegExp(qq)})`, "ig");
  return (text: string) => {
    const parts = text.split(regex);
    return parts.map((part, idx) =>
      idx % 2 === 1 ? (
        <mark key={idx} className="bg-yellow-200 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        <span key={idx}>{part}</span>
      )
    );
  };
};

