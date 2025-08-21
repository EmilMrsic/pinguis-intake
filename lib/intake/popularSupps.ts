export const POPULAR_SUPPLEMENTS: string[] = [
  'Vitamin D', 'Magnesium', 'Omega-3', 'Vitamin B12', 'Vitamin C',
  'Probiotics', 'Zinc', 'Ashwagandha', 'Rhodiola', 'L-Theanine',
  'GABA', '5-HTP', 'Melatonin', 'Curcumin', 'CoQ10',
  'Iron', 'Folate', 'Calcium', 'Potassium', 'Electrolytes'
];

export function suggestSuppsLocal(query: string, limit = 10): string[] {
  const q = (query || '').trim().toLowerCase();
  const scored = POPULAR_SUPPLEMENTS.map(name => {
    const n = name.toLowerCase();
    let score = 0;
    if (!q) score = 1; else if (n.startsWith(q)) score = 100; else if (n.includes(q)) score = 50;
    return { name, score };
  }).filter(x => x.score > 0)
    .sort((a,b)=> b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(x => x.name);
  return scored;
}


