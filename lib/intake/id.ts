export function generateIntakeIdFrom(next: any): string {
  const fi = (next?.profile?.first_name || '').trim().charAt(0).toLowerCase() || 'x';
  const li = (next?.profile?.last_name || '').trim().charAt(0).toLowerCase() || 'x';
  const rand = Math.floor(100000 + Math.random() * 900000).toString();
  return `${fi}${li}${rand}`;
}


