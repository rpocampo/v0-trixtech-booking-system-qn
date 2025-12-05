import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SocketProvider from '../components/SocketProvider';
import NotificationProvider from '../components/NotificationProvider';
import { CartProvider } from '../components/CartContext';
import { UserProvider } from '../components/UserContext';
import ServiceWorker from '../components/ServiceWorker';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TRIXTECH - Events & Services',
  description: 'Book your events and services with TRIXTECH - Professional event management and equipment rental system',
  keywords: 'events, booking, services, equipment rental, party planning, TRIXTECH',
  authors: [{ name: 'TRIXTECH Team' }],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className={inter.className}>
        {/* Skip Links for Accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50"
        >
          Skip to main content
        </a>
        <a
          href="#navigation"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-32 bg-blue-600 text-white px-4 py-2 rounded-md z-50"
        >
          Skip to navigation
        </a>

        <SocketProvider>
          <NotificationProvider>
            <UserProvider>
              <CartProvider>
                <ServiceWorker />
                <div id="main-content" role="main" tabIndex={-1}>
                  {children}
                </div>
              </CartProvider>
            </UserProvider>
          </NotificationProvider>
        </SocketProvider>
      </body>
    </html>
  );
}
