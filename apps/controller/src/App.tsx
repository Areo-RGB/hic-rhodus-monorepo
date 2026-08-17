import React from 'react';
import RhodusController from './components/RhodusController';

export default function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black font-mono">
      <div className="flex-1 min-w-0 relative">
        <RhodusController />
      </div>
    </div>
  );
}

