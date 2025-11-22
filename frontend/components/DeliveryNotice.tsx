'use client';

import { useState, useEffect } from 'react';

interface DeliveryStatus {
  status: 'available' | 'busy' | 'scheduled';
  currentDelivery?: {
    id: string;
    customerName: string;
    scheduledDate: string;
    estimatedDuration: number;
    actualStartTime?: string;
  };
  nextDelivery?: {
    id: string;
    customerName: string;
    scheduledDate: string;
    estimatedDuration: number;
  };
  nextAvailableTime?: string;
}

interface DeliveryNoticeProps {
  className?: string;
}

export default function DeliveryNotice({ className = '' }: DeliveryNoticeProps) {
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus | null>(null);
  const [timeUntilAvailable, setTimeUntilAvailable] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Fetch delivery status
  const fetchDeliveryStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/deliveries/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (response.ok) {
        const data = await response.json();
        setDeliveryStatus(data);
      }
    } catch (error) {
      console.error('Error fetching delivery status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate time until available
  useEffect(() => {
    if (deliveryStatus?.nextAvailableTime) {
      const updateTime = () => {
        const now = new Date().getTime();
        const availableTime = new Date(deliveryStatus.nextAvailableTime!).getTime();
        const diff = availableTime - now;

        if (diff > 0) {
          setTimeUntilAvailable(Math.ceil(diff / (1000 * 60))); // minutes
        } else {
          setTimeUntilAvailable(0);
          // Refresh status if time has passed
          fetchDeliveryStatus();
        }
      };

      updateTime();
      const interval = setInterval(updateTime, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [deliveryStatus?.nextAvailableTime]);

  // Initial fetch
  useEffect(() => {
    fetchDeliveryStatus();

    // Refresh every 5 minutes
    const interval = setInterval(fetchDeliveryStatus, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={`p-4 border rounded-lg bg-gray-50 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!deliveryStatus || deliveryStatus.status === 'available') {
    return (
      <div className={`p-4 border border-green-200 rounded-lg bg-green-50 ${className}`}>
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              Delivery Available
            </h3>
            <p className="text-sm text-green-700 mt-1">
              Our delivery truck is available for scheduling.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (deliveryStatus.status === 'busy') {
    const current = deliveryStatus.currentDelivery!;
    const hours = Math.floor(timeUntilAvailable / 60);
    const minutes = timeUntilAvailable % 60;

    return (
      <div className={`p-4 border border-red-200 rounded-lg bg-red-50 ${className}`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-red-800">
              Delivery In Progress
            </h3>
            <p className="text-sm text-red-700 mt-1">
              Our delivery truck is currently delivering to another customer.
            </p>
            <div className="mt-2 text-sm text-red-600">
              <p><strong>Current delivery:</strong> {current.customerName}</p>
              <p><strong>Estimated completion:</strong> {new Date(current.scheduledDate).toLocaleString()}</p>
              {timeUntilAvailable > 0 && (
                <p className="mt-1">
                  <strong>Available again in:</strong> {hours > 0 ? `${hours}h ${minutes}m` : `${minutes} minutes`}
                </p>
              )}
            </div>
            <div className="mt-3">
              <p className="text-sm text-red-700">
                Please wait at least 1 hour after delivery completion before scheduling your delivery.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (deliveryStatus.status === 'scheduled') {
    const next = deliveryStatus.nextDelivery!;
    const hours = Math.floor(timeUntilAvailable / 60);
    const minutes = timeUntilAvailable % 60;

    return (
      <div className={`p-4 border border-yellow-200 rounded-lg bg-yellow-50 ${className}`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0 1 1 0 012 0zm-1 4a1 1 0 00-1 1v4a1 1 0 102 0V9a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-yellow-800">
              Delivery Scheduled
            </h3>
            <p className="text-sm text-yellow-700 mt-1">
              Our delivery truck has upcoming deliveries scheduled.
            </p>
            <div className="mt-2 text-sm text-yellow-600">
              <p><strong>Next delivery:</strong> {next.customerName}</p>
              <p><strong>Scheduled for:</strong> {new Date(next.scheduledDate).toLocaleString()}</p>
              {timeUntilAvailable > 0 && (
                <p className="mt-1">
                  <strong>Truck available in:</strong> {hours > 0 ? `${hours}h ${minutes}m` : `${minutes} minutes`}
                </p>
              )}
            </div>
            <div className="mt-3">
              <p className="text-sm text-yellow-700">
                Please schedule your delivery at least 1 hour after the current delivery completion.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}