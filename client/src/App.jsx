import { useState, useEffect } from 'react';
import { initClient } from './lib/claude';

import PasswordScreen from './components/PasswordScreen';
import UploadScreen from './components/UploadScreen';
import ChatScreen from './components/ChatScreen';
import Dashboard from './components/Dashboard';

const SCREENS = { PASSWORD: 'password', UPLOAD: 'upload', CHAT: 'chat', DASHBOARD: 'dashboard' };

export default function App() {
  const [screen, setScreen] = useState(SCREENS.PASSWORD);
  const [analysisData, setAnalysisData] = useState(null);
  const [fundResearch, setFundResearch] = useState({});
  const [familyTree, setFamilyTree] = useState(null);

  // Restore auth from sessionStorage on mount
  useEffect(() => {
    if (sessionStorage.getItem('nwd_auth') === '1') {
      initClient();
      setScreen(SCREENS.UPLOAD);
    }

    // Clear all client data when the tab/window is closed
    function handleUnload() {
      sessionStorage.clear();
    }
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  function handleAuthenticated() {
    initClient();
    setScreen(SCREENS.UPLOAD);
  }

  function handleAnalysisComplete(result) {
    // Single profile mode
    setAnalysisData(result.data);
    setFundResearch(result.fundResearch || {});
    setFamilyTree(null);
    if (result.data.clarifyingQuestions?.length > 0) {
      setScreen(SCREENS.CHAT);
    } else {
      setScreen(SCREENS.DASHBOARD);
    }
  }

  function handleFamilyTreeComplete(tree) {
    // Multi-member mode — use first member's data for chat, store full tree
    setFamilyTree(tree);
    const firstMember = tree.generations[0]?.members[0];
    if (firstMember) {
      setAnalysisData(firstMember.analysisData);
      setFundResearch(firstMember.fundResearch || {});
    }
    setScreen(SCREENS.DASHBOARD);
  }

  function handleChatComplete(updatedData) {
    setAnalysisData(updatedData);
    setScreen(SCREENS.DASHBOARD);
  }

  function handleReset() {
    setScreen(SCREENS.UPLOAD);
    setAnalysisData(null);
    setFundResearch({});
    setFamilyTree(null);
  }

  return (
    <div className="min-h-screen">
      {screen === SCREENS.PASSWORD && (
        <PasswordScreen onAuthenticated={handleAuthenticated} />
      )}
      {screen === SCREENS.UPLOAD && (
        <UploadScreen
          onComplete={handleAnalysisComplete}
          onFamilyTreeComplete={handleFamilyTreeComplete}
        />
      )}
      {screen === SCREENS.CHAT && analysisData && (
        <ChatScreen
          data={analysisData}
          onComplete={handleChatComplete}
          onSkipAll={() => setScreen(SCREENS.DASHBOARD)}
        />
      )}
      {screen === SCREENS.DASHBOARD && analysisData && (
        <Dashboard
          data={analysisData}
          fundResearch={fundResearch}
          familyTree={familyTree}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
