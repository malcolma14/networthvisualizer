import { useState } from 'react';
import UploadScreen from './components/UploadScreen';
import ChatScreen from './components/ChatScreen';
import Dashboard from './components/Dashboard';

const SCREENS = { UPLOAD: 'upload', CHAT: 'chat', DASHBOARD: 'dashboard' };

export default function App() {
  const [screen, setScreen] = useState(SCREENS.UPLOAD);
  const [analysisData, setAnalysisData] = useState(null);
  const [fundResearch, setFundResearch] = useState({});

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
