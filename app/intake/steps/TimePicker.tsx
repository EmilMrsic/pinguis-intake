import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type TimeValue = { hour: number; minute: number; ampm: 'AM'|'PM' };

export default function TimePicker({ value, onChange }: { value: TimeValue; onChange: (v: TimeValue)=>void }) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div className="flex items-center gap-2">
      <Dropdown
        widthClass="w-16"
        display={String(value.hour)}
        options={hours.map(h=>({ key:String(h), label:String(h) }))}
        onSelect={(k)=> onChange({ ...value, hour: parseInt(k,10) })}
      />
      <Dropdown
        widthClass="w-16"
        display={String(value.minute).padStart(2,'0')}
        options={minutes.map(m=>({ key:String(m), label:String(m).padStart(2,'0') }))}
        onSelect={(k)=> onChange({ ...value, minute: parseInt(k,10) })}
      />
      <Dropdown
        widthClass="w-20"
        display={value.ampm}
        options={[{key:'AM',label:'AM'},{key:'PM',label:'PM'}]}
        onSelect={(k)=> onChange({ ...value, ampm: (k as 'AM'|'PM') })}
      />
    </div>
  );
}

function Dropdown({ display, options, onSelect, widthClass }: { display: string; options: { key:string; label:string }[]; onSelect: (key:string)=>void; widthClass?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement|null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  return (
    <div className={`relative ${widthClass||''}`} ref={ref}>
      <button type="button" className="flex h-9 w-full items-center justify-between rounded-md border bg-background px-2.5 text-sm shadow-sm hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-sky-300" onClick={()=> setOpen(o=>!o)}>
        <span>{display}</span>
        <ChevronDown className="h-4 w-4 opacity-70" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-background p-1 shadow-md">
          {options.map(opt => (
            <button key={opt.key} type="button" className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={()=>{ onSelect(opt.key); setOpen(false); }}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


