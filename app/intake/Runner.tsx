"use client";
import { useMemo, useState } from 'react';
import { AREAS, DEEP_DIVES, DEEP_DIVE_TRIGGER } from '@/lib/intake/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import Flow from './Flow';

export default function Runner() {
  // Placeholder to swap in full state machine; for now we reuse Flow as the per-step UI
  return <Flow />;
}


