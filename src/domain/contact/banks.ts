export type BankName =
  | "Banamex"
  | "BBVA México"
  | "Santander"
  | "HSBC"
  | "Banco del Bajío"
  | "Inbursa"
  | "Mifel"
  | "Scotiabank"
  | "Banregio"
  | "Afirme"
  | "Banorte"
  | "Banco Azteca"
  | "Compartamos"
  | "BanCoppel"
  | "Banco del Bienestar";

const BANK_CATALOG: Record<string, BankName> = {
  "002": "Banamex",
  "012": "BBVA México",
  "014": "Santander",
  "021": "HSBC",
  "030": "Banco del Bajío",
  "036": "Inbursa",
  "042": "Mifel",
  "044": "Scotiabank",
  "058": "Banregio",
  "062": "Afirme",
  "072": "Banorte",
  "127": "Banco Azteca",
  "130": "Compartamos",
  "137": "BanCoppel",
  "166": "Banco del Bienestar",
};

export function detectBank(clabe: string): BankName | null {
  return BANK_CATALOG[clabe.slice(0, 3)] ?? null;
}
