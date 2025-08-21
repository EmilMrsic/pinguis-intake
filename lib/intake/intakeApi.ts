export async function loadIntake(body: any) {
  const res = await fetch('/api/intake-load', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('intake-load failed');
  return res.json();
}

export async function saveIntake(body: any) {
  const res = await fetch('/api/intake-save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('intake-save failed');
  return res.json().catch(()=>({}));
}

export async function uploadProfile(file: File, intakeId: string) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('intakeId', intakeId);
  const res = await fetch('/api/upload-profile', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('upload-profile failed');
  return res.json();
}

export async function generateAbstractAvatar(intakeId: string) {
  const res = await fetch('/api/generate-abstract-avatar', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ intakeId }) });
  if (!res.ok) throw new Error('generate-abstract-avatar failed');
  return res.json();
}


