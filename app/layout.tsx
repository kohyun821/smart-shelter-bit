import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Smart Shelter",
  description: "Smart Shelter Management Dashboard",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased">
        <div className="h-screen flex flex-col overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  )
}
