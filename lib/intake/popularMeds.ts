export const POPULAR_MEDS: string[] = [
  'Sertraline', 'Fluoxetine', 'Escitalopram', 'Citalopram', 'Paroxetine',
  'Bupropion', 'Venlafaxine', 'Duloxetine', 'Mirtazapine', 'Trazodone',
  'Alprazolam', 'Lorazepam', 'Clonazepam', 'Diazepam', 'Buspirone',
  'Quetiapine', 'Aripiprazole', 'Risperidone', 'Olanzapine', 'Lamotrigine',
  'Lithium', 'Valproate', 'Topiramate', 'Gabapentin', 'Pregabalin',
  'Methylphenidate', 'Amphetamine–dextroamphetamine', 'Lisdexamfetamine', 'Guanfacine', 'Clonidine',
  'Propranolol', 'Hydroxyzine', 'Zolpidem', 'Eszopiclone', 'Melatonin',
  'Metformin', 'Levothyroxine', 'Omeprazole', 'Atorvastatin', 'Rosuvastatin'
];

export function suggestMedsLocal(query: string, limit = 10): string[] {
  const q = (query || '').trim().toLowerCase();
  const scored = POPULAR_MEDS.map(name => {
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


