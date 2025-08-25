import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAuth } from 'firebase/auth'

export function GapReportButton({ intakeId, onDone }: { intakeId: string; onDone?: ()=>void }) {
	const [open, setOpen] = useState(false)
	return (
		<>
			<Button variant="outline" size="sm" onClick={() => setOpen(true)}>Gap Report</Button>
			{open && <GapReportModal intakeId={intakeId} onClose={() => setOpen(false)} onAutoClose={() => { setOpen(false); onDone?.(); }} />}
		</>
	)
}

function GapReportModal({ intakeId, onClose, onAutoClose }: { intakeId: string; onClose: ()=>void; onAutoClose: ()=>void }) {
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [markdown, setMarkdown] = useState<string>("")
	const [json, setJson] = useState<any>(null)

	useEffect(() => {
		(async () => {
			try {
				const auth = getAuth();
				const u = auth.currentUser!;
				// First check if cached on intake to avoid re-generation
				const cacheRes = await fetch(`/api/provider/intakes/${encodeURIComponent(intakeId)}`, { headers: { Authorization: `Bearer ${await u.getIdToken()}` } })
				const cacheData = await cacheRes.json();
				if (cacheRes.ok && cacheData?.item?.gap_report) {
					setMarkdown(cacheData.item.gap_report.markdown || '')
					setJson(cacheData.item.gap_report.json || null)
					setLoading(false)
					return
				}
				const res = await fetch(`/api/provider/gap-report?intakeId=${encodeURIComponent(intakeId)}`, { headers: { Authorization: `Bearer ${await u.getIdToken()}` } })
				const data = await res.json()
				if (!res.ok || data.ok === false) throw new Error(data?.error || 'Failed to generate')
				setMarkdown(data.markdown || '')
				setJson(data.json || null)
				try { setTimeout(() => onAutoClose(), 300) } catch {}
			} catch (e:any) { setError(e?.message || 'Failed to generate') }
			finally { setLoading(false) }
		})()
	}, [intakeId])

	return (
		<div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
			<div className="w-full max-w-3xl rounded-lg border bg-white shadow-lg" onClick={e=>e.stopPropagation()}>
				<div className="flex items-center justify-between p-4 border-b">
					<div className="text-lg font-semibold">Gap Report — Provider Only</div>
					<Button variant="outline" size="sm" onClick={onClose}>Close</Button>
				</div>
				<div className="max-h-[70vh] overflow-auto p-4">
					{loading && (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
							Generating Gap Report…
						</div>
					)}
					{error && <p className="text-sm text-red-600">{error}</p>}
					{!loading && !error && (
						<div className="space-y-6">
							{markdown && (
								<div className="prose max-w-none">
									<h2 className="mt-0">Gap Report — {json?.gapReport?.patientName || ''}</h2>
									<p className="text-sm text-muted-foreground">Gap Report is ready. We switched you to the Gap tab to review and complete it.</p>
									<div className="pt-2">
										<Button size="sm" onClick={onClose}>Open Gap tab</Button>
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
