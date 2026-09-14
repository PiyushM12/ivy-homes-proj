export function formatINR(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatArea(sqft) {
  if (sqft === null || sqft === undefined || Number.isNaN(sqft)) return "—";
  return `${new Intl.NumberFormat("en-IN").format(sqft)} sqft`;
}

export function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function titleCase(s) {
  if (!s) return "";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
