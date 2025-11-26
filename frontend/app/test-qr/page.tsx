'use client';

import { useState, useEffect } from 'react';

export default function TestQRPage() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    testQRGeneration();
  }, []);

  const testQRGeneration = async () => {
    try {
      setLoading(true);
      setError('');

      // Test QR generation without authentication
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/payments/test-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 100,
          referenceNumber: 'TEST123',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate QR code');
      }

      const data = await response.json();
      if (data.success && data.qrCode) {
        setQrCode(data.qrCode);
      } else {
        throw new Error('Invalid QR response');
      }
    } catch (error) {
      console.error('QR test failed:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">QR Code Test</h1>
          <p className="text-gray-600 mt-2">Testing QR code generation</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Generating QR code...</p>
          </div>
        ) : qrCode ? (
          <div className="text-center">
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block mb-4">
              <img
                src={qrCode}
                alt="Test QR Code"
                className="w-64 h-64"
              />
            </div>
            <p className="text-gray-600">QR code generated successfully!</p>
          </div>
        ) : null}

        <div className="mt-6 text-center">
          <button
            onClick={testQRGeneration}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Test Again
          </button>
        </div>
      </div>
    </div>
  );
}
