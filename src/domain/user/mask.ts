export function maskPhone(phone: string): string {
  const digits = phone.replace(/\s+/g, "");
  return `${digits.slice(0, 2)} •••• ${digits.slice(-4)}`;
}
