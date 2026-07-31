export type DefaultCategoryTemplate = {
  name: string
  code: string
  color: string
  type: "income" | "expense"
  icon: string
  sortOrder: number
}

export const DEFAULT_CATEGORY_TEMPLATES: readonly DefaultCategoryTemplate[] = [
  { name: "Lương", code: "INCOME_SALARY", color: "#16A34A", type: "income", icon: "money", sortOrder: 10 },
  { name: "Ăn uống", code: "EXPENSE_FOOD", color: "#F97316", type: "expense", icon: "utensils", sortOrder: 20 },
  { name: "Hóa đơn & tiện ích", code: "EXPENSE_BILLS_UTILITIES", color: "#0EA5E9", type: "expense", icon: "service", sortOrder: 30 },
  { name: "Di chuyển", code: "EXPENSE_TRANSPORTATION", color: "#8B5CF6", type: "expense", icon: "car", sortOrder: 40 },
  { name: "Y tế & sức khỏe", code: "EXPENSE_HEALTH", color: "#EF4444", type: "expense", icon: "heart", sortOrder: 50 },
  { name: "Chi tiêu cá nhân", code: "EXPENSE_PERSONAL", color: "#EC4899", type: "expense", icon: "shopping", sortOrder: 60 },
  { name: "Giáo dục & phát triển", code: "EXPENSE_EDUCATION", color: "#14B8A6", type: "expense", icon: "education", sortOrder: 70 },
  { name: "Quan hệ xã hội & quà tặng", code: "EXPENSE_SOCIAL_GIFTS", color: "#F43F5E", type: "expense", icon: "gift", sortOrder: 80 },
  { name: "Giải trí & sở thích", code: "EXPENSE_ENTERTAINMENT", color: "#A855F7", type: "expense", icon: "entertainment", sortOrder: 90 },
  { name: "Chi phí phát sinh", code: "EXPENSE_UNEXPECTED", color: "#64748B", type: "expense", icon: "tag", sortOrder: 100 },
  { name: "Đầu tư", code: "EXPENSE_INVESTMENT", color: "#10B981", type: "expense", icon: "landmark", sortOrder: 110 },
]
