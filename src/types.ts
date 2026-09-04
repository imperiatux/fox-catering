// One variant (veg or non-veg)
export interface MenuVariant {
  main: string;       // main course name
  secondary: string;  // secondary course name
}

// Daily menu stored in KV
export interface DailyMenu {
  date: string;       // "YYYY-MM-DD"
  vegetarian: MenuVariant;
  nonVegetarian: MenuVariant;
}

// A single order stored within the daily orders object
export interface Order {
  nickname: string;   // normalized lowercase
  main: string;
  secondary: string;
}

// The full daily orders object stored in KV
export interface DailyOrders {
  date: string;
  orders: Order[];
}

// API request/response shapes
export interface SubmitOrderRequest {
  nickname: string;
  main: string;
  secondary: string;
}

export interface AdminMenuRequest {
  date: string;
  vegetarian: MenuVariant;
  nonVegetarian: MenuVariant;
}

export interface ApiError {
  error: string;
}

// Response from POST /api/admin/parse-menu
export interface ParseMenuResponse {
  vegetarian: MenuVariant;
  nonVegetarian: MenuVariant;
  /** Raw text extracted by the model, for transparency */
  raw: string;
}
