import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Job Search",
  description: "A focused job collection and application tracking project.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <nav aria-label="Primary navigation">
            <Link href="/">Home</Link>
            <Link href="/jobs">Jobs</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
