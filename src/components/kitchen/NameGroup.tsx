"use client";

import React, { memo } from "react";
import { MenuItem, Order } from "@/types";
import OrderCard from "./OrderCard";

export type NameGroupProps = {
  name: string;
  orders: Order[];
  status: string;
  menuIndex: Record<number, MenuItem | undefined>;
  highlightItemName: (text: string) => React.ReactNode;
  formatDate: (utc: string) => string;
  getOrderSubtotal: (order: Order) => number;
  getOrderDiscount: (order: Order, subtotal: number) => number;
  onEdit: (order: Order) => void;
  updateStatus: (order: Order, nextStatus: string) => void | Promise<void>;
  nowTs?: number;
};

function NameGroupBase({
  name,
  orders,
  status,
  menuIndex,
  highlightItemName,
  formatDate,
  getOrderSubtotal,
  getOrderDiscount,
  onEdit,
  updateStatus,
  nowTs,
}: NameGroupProps) {
  const sorted = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="mb-3">
      <div className="mb-2 font-medium">{name}</div>
      {sorted.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          status={status}
          menuIndex={menuIndex}
          highlightItemName={highlightItemName}
          formatDate={formatDate}
          getOrderSubtotal={getOrderSubtotal}
          getOrderDiscount={getOrderDiscount}
          onEdit={onEdit}
          updateStatus={updateStatus}
          nowTs={nowTs}
        />
      ))}
    </div>
  );
}

const NameGroup = memo(NameGroupBase);
export default NameGroup;
