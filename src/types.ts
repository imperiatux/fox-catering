// Fixed menu course options — used on both frontend and API
export const MENU_OPTIONS = {
  vegSoup:    'Vegi: Soup',
  vegMain:    'Vegi: Main',
  nonVegSoup: 'Non-Vegi: Soup',
  nonVegMain: 'Non-Vegi: Main',
} as const;

export type MenuOption = typeof MENU_OPTIONS[keyof typeof MENU_OPTIONS];

export const VALID_MAINS:      readonly MenuOption[] = [MENU_OPTIONS.vegMain,    MENU_OPTIONS.nonVegMain];
export const VALID_SECONDARIES: readonly MenuOption[] = [MENU_OPTIONS.vegSoup,   MENU_OPTIONS.nonVegSoup];

// A single order stored within the daily orders object
export interface Order {
  nickname: string;   // trimmed; original casing preserved
  main: MenuOption;
  secondary: MenuOption;
  note?: string;      // optional custom requirement for the main course
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
  note?: string;
}

export interface ApiError {
  error: string;
}
