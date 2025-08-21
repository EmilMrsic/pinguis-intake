import React from 'react';
import { Input } from '@/components/ui/input';

export function ContactStep({ profile, onDraft }: { profile: any; onDraft: (p:any)=>void }) {
  const [local, setLocal] = React.useState<any>({
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    birthdate: profile?.birthdate ?? '',
  });
  React.useEffect(()=>{ setLocal((prev:any)=>({ ...prev, ...profile })); onDraft({ ...local, ...profile }); /* eslint-disable-next-line */},[]);
  const setField = (k: keyof typeof local, v: string) => { const next={ ...local, [k]: v }; setLocal(next); onDraft(next); };
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="grid gap-1"><label className="text-sm font-medium">First name</label><Input value={local.first_name} onChange={(e)=>setField('first_name', e.target.value)} /></div>
        <div className="grid gap-1"><label className="text-sm font-medium">Last name</label><Input value={local.last_name} onChange={(e)=>setField('last_name', e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="grid gap-1"><label className="text-sm font-medium">Email</label><Input type="email" value={local.email} onChange={(e)=>setField('email', e.target.value)} /></div>
        <div className="grid gap-1"><label className="text-sm font-medium">Phone</label><Input type="tel" value={local.phone} onChange={(e)=>setField('phone', e.target.value)} /></div>
      </div>
      <div className="grid gap-1"><label className="text-sm font-medium">Birthdate</label><Input type="date" value={local.birthdate} onChange={(e)=>setField('birthdate', e.target.value)} /></div>
    </div>
  );
}


