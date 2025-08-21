import React from 'react';
import { Input } from '@/components/ui/input';

export function ContactStep({ profile, onDraft }: { profile: any; onDraft: (p:any)=>void }) {
  const [local, setLocal] = React.useState<any>({
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    birthdate: profile?.birthdate ?? '',
    photo_url: profile?.photo_url ?? '',
  });
  React.useEffect(()=>{ setLocal((prev:any)=>({ ...prev, ...profile })); onDraft({ ...local, ...profile }); /* eslint-disable-next-line */},[]);
  const setField = (k: keyof typeof local, v: string) => { const next={ ...local, [k]: v }; setLocal(next); onDraft(next); };
  return (
    <div className="relative grid gap-6 pr-40">
      {/* Top-right avatar with actions below */}
      <div className="absolute right-0 top-0 flex w-32 flex-col items-center">
        <img
          src={(local.photo_url||'').trim() || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0%' stop-color='%2338bdf8'/><stop offset='100%' stop-color='%23f59e0b'/></linearGradient></defs><rect width='100%' height='100%' rx='128' fill='url(%23g)'/></svg>"}
          alt="Profile"
          className="h-28 w-28 rounded-full object-cover ring-2 ring-white shadow"
          draggable={false}
        />
        <input id="contact-photo-input" type="file" accept="image/*" className="hidden" onChange={(e)=>{
          const f = e.target.files?.[0];
          if (!f) return;
          const url = URL.createObjectURL(f);
          setField('photo_url', url);
          try { const ev:any = new CustomEvent('request-upload-photo', { detail: { file: f } }); window.dispatchEvent(ev); } catch {}
        }} />
        <div className="mt-2 flex gap-2">
          <button type="button" className="rounded-md border px-2 py-1 text-xs" onClick={()=>{
            try { (document.getElementById('contact-photo-input') as HTMLInputElement)?.click(); } catch {}
          }}>Upload</button>
          <button type="button" className="rounded-md border px-2 py-1 text-xs" onClick={()=>{
            const next = { ...local }; setLocal(next); onDraft(next);
            try { const ev:any = new CustomEvent('request-generate-avatar'); window.dispatchEvent(ev); } catch {}
          }}>Generate</button>
        </div>
      </div>
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


