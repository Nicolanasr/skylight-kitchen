import './globals.css';
import { ReactNode } from 'react'

export const metadata = {
    title: 'QR Table Ordering',
    description: 'Scan the QR code and order from your table',
}

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body className="min-h-screen ">{children}</body>
        </html>
    )
}
