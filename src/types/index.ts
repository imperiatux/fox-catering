export type MenuType = 'veg' | 'non-veg' | 'soup-only' | 'main-only' | 'custom';

export interface CourseSelection {
  soup: string;
  main: string;
}

export interface Order {
  id: string;
  nickname: string;
  menuType: MenuType;
  soup: string;
  main: string;
  note?: string;
  qty: number;
  tip?: number;
  createdAt: string;
}

export interface AppSettings {
  cutoffHour: number;
  cutoffMinute: number;
  cutoffEnabled: boolean;
  /** ISO weekday numbers: 1 = Monday … 7 = Sunday */
  activeDays: number[];
  /** WhatsApp recipient — digits after the country prefix "+4" */
  whatsappPhone: string;
  /** Price in RON for the full non-veg (daily) menu */
  priceNonVeg: number;
  /** Price in RON for the full vegetarian menu */
  priceVeg: number;
  /** Price in RON for first course (daily menu / non-veg) only */
  priceSoupNonVeg: number;
  /** Price in RON for first course (vegetarian) only */
  priceSoupVeg: number;
  /** Price in RON for second course (daily menu / non-veg) only */
  priceMainNonVeg: number;
  /** Price in RON for second course (vegetarian) only */
  priceMainVeg: number;
  /** Price in RON for custom orders */
  priceCustom: number;
}
