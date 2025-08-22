export type CaffeineEstimate = {
  servings: number;
  unit: 'servings/day';
  estimated_mg: number;
  items?: { label: string; count: number; mg_each?: number }[];
};

// Rough reference values (per typical serving)
export const CAFFEINE_DB: { key: string; mg: number; aliases: string[] }[] = [
  { key: 'coffee_cup', mg: 95, aliases: ['coffee', 'cup of coffee'] },
  { key: 'espresso_shot', mg: 64, aliases: ['espresso', 'shot'] },
  { key: 'tea_cup', mg: 40, aliases: ['tea'] },
  { key: 'redbull', mg: 80, aliases: ['red bull', 'redbull'] },
  { key: 'monster', mg: 160, aliases: ['monster'] },
  { key: 'five_hour', mg: 200, aliases: ['5 hour', '5-hour', '5 hour energy', '5-hour energy'] },
  { key: 'starbucks_grande', mg: 330, aliases: ['starbucks', 'grande'] },
  { key: 'coke', mg: 34, aliases: ['coke', 'cola', 'soda'] },
];

export function heuristicEstimate(text: string): CaffeineEstimate | null {
  const t = (text||'').toLowerCase();
  if (!t.trim()) return null;
  let totalMg = 0; let servings = 0;
  const items: { label: string; count: number; mg_each?: number }[] = [];
  for (const row of CAFFEINE_DB) {
    for (const alias of row.aliases) {
      if (t.includes(alias)) {
        // crude count: look for leading number like "2 coffee"
        const re = new RegExp(`(\\d+)[^a-zA-Z]{0,3}${alias.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}`);
        const m = t.match(re);
        const count = m ? parseInt(m[1], 10) : 1;
        servings += count;
        totalMg += count * row.mg;
        items.push({ label: alias, count, mg_each: row.mg });
        break;
      }
    }
  }
  if (totalMg === 0) return null;
  return { servings, unit: 'servings/day', estimated_mg: totalMg, items };
}


