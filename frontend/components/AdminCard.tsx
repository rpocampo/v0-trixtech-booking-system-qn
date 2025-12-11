import React from 'react';

interface AdminCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function AdminCard({ title, children, className = '' }: AdminCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="text-gray-600">
        {children}
      </div>
    </div>
  );
}