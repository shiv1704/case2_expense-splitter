const INR_FMT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function formatINR(amount: number): string {
  return INR_FMT.format(amount);
}

// Formats an amount in its original currency (e.g. "AED 600.00").
// Falls back to formatINR when currency is INR.
export function formatAmount(amount: number, currency: string): string {
  if (currency === "INR") return formatINR(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
}
