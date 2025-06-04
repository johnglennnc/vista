// src/App.js
import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from './firebase/config';

import UploadScan from './components/UploadScan';
import AnalyzeScan from './components/AnalyzeScan';
import Login from './components/Login';

const auth = getAuth(app);

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('upload');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />;
  }

  const handleLogout = async () => {
    await auth.signOut();
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">VISTA – Vision Integrated Scan & Treatment Assistant</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
        >
          Logout
        </button>
      </div>

      <div className="flex space-x-4 mb-6">
        <button
          className={`px-4 py-2 rounded ${activeTab === 'upload' ? 'bg-purple-700' : 'bg-gray-700'}`}
          onClick={() => setActiveTab('upload')}
        >
          Upload Scan
        </button>
        <button
          className={`px-4 py-2 rounded ${activeTab === 'analyze' ? 'bg-purple-700' : 'bg-gray-700'}`}
          onClick={() => setActiveTab('analyze')}
        >
          Analyze Scan
        </button>
      </div>

      {activeTab === 'upload' && <UploadScan />}
      {activeTab === 'analyze' && <AnalyzeScan />}
    </div>
  );
}

export default App;
