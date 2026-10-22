export function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "";
  }

  const first = words[0].charAt(0).toUpperCase();

  if (words.length === 1) {
    return first;
  }

  const last = words[words.length - 1].charAt(0).toUpperCase();

  return `${first}${last}`;
}
