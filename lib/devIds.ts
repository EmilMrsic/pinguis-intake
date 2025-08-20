// Minimal ULID generator for dev; in prod you may use a vetted library
export function ulid(): string {
  const random = () => Math.floor(Math.random() * 0x100000000).toString(36).padStart(7, '0');
  const time = Date.now().toString(36).padStart(10, '0');
  return (time + random() + random()).slice(0, 26);
}

export const devPracticeId = process.env.NEXT_PUBLIC_DEV_PRACTICE_ID || '01hpracticeuliddevdevdevdev';
export const devClientId = process.env.NEXT_PUBLIC_DEV_CLIENT_ID || '01hclientuliddevdevdevdevdev';


