// Mirrors payment_service._calculate_price on the backend exactly — greedy
// tiered pricing (whole 30-day months, then whole 7-day weeks, remainder at
// daily_rate). Used for a live preview only; the backend's own calculation
// at charge time is always the source of truth for what's actually billed.
export function calculateRentalPrice(
  item: { daily_rate?: number | null; weekly_rate?: number | null; monthly_rate?: number | null },
  days: number,
): number | null {
  if (item.daily_rate == null || days <= 0) return null
  let remaining = days
  let total = 0
  if (item.monthly_rate) {
    const months = Math.floor(remaining / 30)
    remaining -= months * 30
    total += months * item.monthly_rate
  }
  if (item.weekly_rate) {
    const weeks = Math.floor(remaining / 7)
    remaining -= weeks * 7
    total += weeks * item.weekly_rate
  }
  total += remaining * item.daily_rate
  return Math.round(total * 100) / 100
}
