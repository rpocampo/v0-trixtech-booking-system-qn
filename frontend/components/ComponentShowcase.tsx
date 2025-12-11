import React from 'react';
import AdminCard from './AdminCard';

export default function ComponentShowcase() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Component Showcase</h1>

      <AdminCard title="Admin Card Example">
        <p>This is an example of the AdminCard component being used in the ComponentShowcase.</p>
        <p>It provides a clean, consistent layout for admin-related content.</p>
      </AdminCard>

      <AdminCard title="Another Example">
        <p>You can use multiple AdminCard components in your showcase.</p>
        <p>Each card can contain different content and styling.</p>
      </AdminCard>
    </div>
  );
}