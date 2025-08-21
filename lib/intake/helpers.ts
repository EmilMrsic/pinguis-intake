export function jumpToNextRelevantIndex({
  reasonChoice,
  profile,
  selectedTopics,
  severities,
  steps,
}: {
  reasonChoice?: 'problem'|'peak';
  profile: any;
  selectedTopics: string[];
  severities: Record<string, number>;
  steps: { id: string }[];
}): number {
  let targetIdx = 0;
  if (reasonChoice) targetIdx = 1; // contact
  const needContact = !(((profile.first_name||'').trim()) && ((profile.last_name||'').trim()) && ((profile.email||'').trim()));
  if (!needContact) targetIdx = 2; // areas_select
  if ((selectedTopics?.length ?? 0) > 0) {
    const firstMissing = selectedTopics.find(t => !((severities?.[t] ?? 0) >= 1));
    const topicId = firstMissing ?? selectedTopics[0];
    const idx = steps.findIndex(s => s.id === `topic_${topicId}`);
    if (idx >= 0) targetIdx = idx;
  }
  return targetIdx;
}

export async function markIntakeComplete({ practiceId, clientId, intakeId, payload }: { practiceId: string; clientId: string; intakeId: string; payload: any }) {
  const res = await fetch('/api/intake-save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ practiceId, clientId, intakeId, payload, complete: true })});
  await res.json().catch(()=>({}));
}


