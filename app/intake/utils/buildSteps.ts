import { Step } from '@/app/intake/Flow';

export function buildSteps(selectedTopicIds: string[], topics: { id:string; label:string }[]): Step[] {
  const base: Step[] = [
    { id:'reason', title:"Let's start simple — what's your focus?", description:"We'll tailor what comes next to match your choice.", type:'singleSelect', field:'story.reason_choice' },
    { id:'contact', title:'Quick contact details', description:'This helps us keep you updated about scheduling.', type:'contact', field:'profile' },
    { id:'areas_select', title:'What would you like to focus on?', description:'Pick one or more.', type:'areas_select', field:'areas' },
  ];
  const topicSteps: Step[] = selectedTopicIds.map((topicId: string) => ({
    id: `topic_${topicId}`,
    title: `Rate: ${topics.find(t=>t.id===topicId)?.label ?? topicId}`,
    description: '1 = mild · 5 = severe',
    type: 'topic_rate',
    field: 'areas',
    meta: { topicId }
  }));
  return [
    ...base,
    ...topicSteps,
    { id:'deep_dive', title:'Quick zoom-in', description:'0 = not at all · 10 = severe', type:'deep_dive', field:'deepdive' },
    { id:'daily',       title:'Daily habits & health', type:'daily', field:'daily' },
    { id:'sleep_intro', title:'Sleep context', description:'Why sleep matters for your map', type:'sleep_intro', field:'sleep_intro' },
    { id:'sleep_short', title:'Sleep habits', type:'sleep_short', field:'sleep' },
    { id:'cec',         title:'CEC questionnaire', type:'cec', field:'cec' },
    { id:'metabolic',   title:'Metabolic', type:'metabolic', field:'metabolic' },
    { id:'isi',         title:'Insomnia Severity Index', type:'isi', field:'isi' },
    { id:'review_prepare', title:'Getting things ready', type:'review_prepare', field:'review_prepare' },
    { id:'review',      title:'Review & submit', type:'review', field:'review' },
  ];
}


