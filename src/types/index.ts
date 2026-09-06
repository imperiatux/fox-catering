export type MenuType = 'veg' | 'non-veg' | 'custom';

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
}
