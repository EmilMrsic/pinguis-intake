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
    <div className="grid gap-6">
      {/* Avatar overlapping the card header area */}
      <div className="relative h-0">
        <div className="absolute left-1/2 -translate-x-1/2 -top-14">
          <div className="relative">
            <img
              src={(local.photo_url||'').trim() || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0%' stop-color='%2338bdf8'/><stop offset='100%' stop-color='%23f59e0b'/></linearGradient></defs><rect width='100%' height='100%' rx='128' fill='url(%23g)'/></svg>"}
              alt="Profile"
              className="h-28 w-28 rounded-full object-cover ring-2 ring-white shadow"
              draggable={false}
            />
            <label className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground text-xs cursor-pointer shadow">
              <input type="file" accept="image/*" className="hidden" onChange={(e)=>{
                const f = e.target.files?.[0];
                if (!f) return;
                const url = URL.createObjectURL(f);
                setField('photo_url', url);
                try { const ev:any = new CustomEvent('request-upload-photo', { detail: { file: f } }); window.dispatchEvent(ev); } catch {}
              }} />
              ↑
            </label>
          </div>
          <div className="mt-2 flex justify-center gap-2 text-xs text-muted-foreground">
            <button type="button" className="underline" onClick={()=>{ setField('photo_url',''); }}>Remove</button>
          </div>
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
      <div className="flex items-center justify-center gap-3">
        <button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={()=>{
          // signal to parent to generate abstract avatar by clearing and setting a sentinel; parent saves
          const next = { ...local };
          setLocal(next); onDraft(next);
          try { const ev:any = new CustomEvent('request-generate-avatar'); window.dispatchEvent(ev); } catch {}
        }}>Generate abstract avatar</button>
      </div>
    </div>
  );
}


