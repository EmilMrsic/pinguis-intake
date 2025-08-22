"use client";
import { useEffect } from 'react';

export function useAvatarActions({
  payloadRef,
  setPayload,
  autosave,
  generateIntakeIdFrom,
  uploadProfile,
  generateAbstractAvatar,
}: {
  payloadRef: React.MutableRefObject<Record<string, any>>;
  setPayload: (p: any) => void;
  autosave: (p: any, opts?: { immediate?: boolean; silent?: boolean }) => void;
  generateIntakeIdFrom: (p:any)=>string;
  uploadProfile: (file: File, id: string) => Promise<any>;
  generateAbstractAvatar: (id: string) => Promise<any>;
}) {
  useEffect(() => {
    function onUpload(ev: any) {
      const file: File | undefined = ev?.detail?.file;
      if (!file) return;
      const id = payloadRef.current?.intakeId || generateIntakeIdFrom(payloadRef.current);
      uploadProfile(file, id).then((res:any)=>{
        const url = String(res?.url || '');
        if (!url) return;
        const next = structuredClone(payloadRef.current || {});
        next.intakeId = id;
        next.profile = { ...(next.profile||{}), photo_url: url };
        setPayload(next);
        autosave(next, { immediate: true, silent: true });
      }).catch(()=>{});
    }
    function onGenerate() {
      const id = payloadRef.current?.intakeId || generateIntakeIdFrom(payloadRef.current);
      generateAbstractAvatar(id).then((res:any)=>{
        const url = String(res?.url || '');
        if (!url) return;
        const next = structuredClone(payloadRef.current || {});
        next.intakeId = id;
        next.profile = { ...(next.profile||{}), photo_url: url };
        setPayload(next);
        autosave(next, { immediate: true, silent: true });
      }).catch(()=>{});
    }
    try {
      window.addEventListener('request-upload-photo', onUpload as any);
      window.addEventListener('request-generate-avatar', onGenerate as any);
      return () => {
        window.removeEventListener('request-upload-photo', onUpload as any);
        window.removeEventListener('request-generate-avatar', onGenerate as any);
      };
    } catch { return; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}


