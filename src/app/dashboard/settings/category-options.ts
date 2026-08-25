import type { ComponentType } from "react";
import {
  BookOpen,
  Briefcase,
  Car,
  CircleDollarSign,
  Coffee,
  CreditCard,
  Dumbbell,
  Film,
  Fuel,
  Gift,
  GraduationCap,
  Heart,
  House,
  Landmark,
  Plane,
  Shield,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tag,
  Utensils,
  Wrench,
} from "lucide-react";

export const CATEGORY_COLOR_PRESETS = [
  "#FF5B3D",
  "#69B7F3",
  "#F6B94A",
  "#41A862",
  "#7959C8",
  "#E58EB3",
  "#008E9B",
  "#334E8C",
  "#A66A42",
];

export const ICON_MAP: Record<
  string,
  ComponentType<{ size?: number; className?: string }>
> = {
  tag: Tag,
  utensils: Utensils,
  coffee: Coffee,
  house: House,
  car: Car,
  fuel: Fuel,
  shopping: ShoppingBag,
  heart: Heart,
  work: Briefcase,
  money: CircleDollarSign,
  landmark: Landmark,
  card: CreditCard,
  education: GraduationCap,
  travel: Plane,
  utilities: Sparkles,
  gift: Gift,
  shield: Shield,
  tech: Smartphone,
  entertainment: Film,
  sport: Dumbbell,
  service: Wrench,
  book: BookOpen,
};

export function slugifyCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9\s_]/g, "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}
