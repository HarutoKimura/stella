import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Stella - AI English Tutor',
  description: 'Practice English with an AI tutor',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
