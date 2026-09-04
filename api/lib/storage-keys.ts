// menu:{YYYY-MM-DD}   → DailyMenu JSON
// orders:{YYYY-MM-DD} → DailyOrders JSON

export function menuKey(date: string): string {
  return `menu:${date}`;
}

export function ordersKey(date: string): string {
  return `orders:${date}`;
}
