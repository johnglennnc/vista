import React, { useState } from 'react';

const tabs = ['Upload Scan', 'Analyze', 'Ask VISTA', 'Export Report'];

function Tabs({ onTabChange }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="flex border-b border-gray-700">
      {tabs.map((tab, index) => (
        <button
          key={index}
          className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
            activeTab === index
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => {
            setActiveTab(index);
            onTabChange(index);
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
