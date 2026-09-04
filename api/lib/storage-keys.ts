// orders:{YYYY-MM-DD}      → DailyOrders JSON
// menu-image:{YYYY-MM-DD}  → base64 data URL of the uploaded menu photo

export function ordersKey(date: string): string {
  return `orders:${date}`;
}

export function menuImageKey(date: string): string {
  return `menu-image:${date}`;
}
