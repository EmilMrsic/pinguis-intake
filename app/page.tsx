import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-3xl px-6 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">Pinguis Intake</h1>
          <p className="mt-3 text-muted-foreground">Adaptive patient intake with clinician workflow.</p>
        </div>

        <Card className="mt-10">
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>Select where you want to jump in.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <Link href="/login" className="sm:col-span-1">
                <Button variant="default" className="w-full">Login</Button>
              </Link>
              <Link href="/start" className="sm:col-span-1">
                <Button variant="secondary" className="w-full">Start Intake</Button>
              </Link>
              <Link href="/intake" className="sm:col-span-1">
                <Button variant="outline" className="w-full">Edit Intake JSON</Button>
              </Link>
            </div>
            <Separator className="my-6" />
            <div className="text-sm text-muted-foreground">
              You can sign in with your dev account, start a new intake, or directly edit an intake snapshot while we wire the full runner.
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}


