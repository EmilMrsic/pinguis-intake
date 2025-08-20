import '../styles/globals.css';
export const metadata = { title: "Pinguis Intake" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial', padding: 24 }}>
        {children}
      </body>
    </html>
  );
}


