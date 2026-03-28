import { useState, useEffect } from 'react';
import { initClient, isClientReady } from './lib/claude';
import ApiKeyScreen from './components/ApiKeyScreen';
import UploadScreen from './components/UploadScreen';
import ChatScreen from './components/ChatScreen';
import Dashboard from './components/Dashboard';

const SCREENS = { API_KEY: 'apiKey', UPLOAD: 'upload', CHAT: 'chat', DASHBOARD: 'dashboard' };

export default function App() {
  const [screen, setScreen] = useState(SCREENS.API_KEY);
  const [analysisData, setAnalysisData] = useState(null);
  const [fundResearch, setFundResearch] = useState({});

  // Restore API key from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('nwd_api_key');
    if (saved) {
      initClient(saved);
      setScreen(SCREENS.UPLOAD);
    }
  }, []);

  function handleApiKeyReady() {
    setScreen(SCREENS.UPLOAD);
  }

  function handleAnalysisComplete(result) {
    setAnalysisData(result.data);
    setFundResearch(result.fundResearch || {});
    if (result.data.clarifyingQuestions?.length > 0) {
      setScreen(SCREENS.CHAT);
    } else {
      setScreen(SCREENS.DASHBOARD);
    }
  }

  function handleChatComplete(updatedData) {
    setAnalysisData(updatedData);
    setScreen(SCREENS.DASHBOARD);
  }

  function handleReset() {
    setScreen(SCREENS.UPLOAD);
    setAnalysisData(null);
    setFundResearch({});
  }

  return (
    <div className="min-h-screen">
      {screen === SCREENS.API_KEY && (
        <ApiKeyScreen onReady={handleApiKeyReady} />
      )}
      {screen === SCREENS.UPLOAD && (
        <UploadScreen onComplete={handleAnalysisComplete} />
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
          onReset={handleReset}
        />
      )}
    </div>
  );
}
