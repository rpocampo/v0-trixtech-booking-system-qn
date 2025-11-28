import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SocketProvider from '../components/SocketProvider';
import NotificationProvider from '../components/NotificationProvider';
import { CartProvider } from '../components/CartContext';
import { UserProvider } from '../components/UserContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TRIXTECH - Events & Services',
  description: 'Book your events and services with TRIXTECH',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SocketProvider>
          <NotificationProvider>
            <UserProvider>
              <CartProvider>
                {children}
              </CartProvider>
            </UserProvider>
          </NotificationProvider>
        </SocketProvider>
      </body>
    </html>
  );
}
