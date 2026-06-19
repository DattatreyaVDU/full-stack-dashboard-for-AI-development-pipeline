import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import { ToastProvider, useToast } from './components/cards/ToastProvider';
import { useStore } from './store/useStore';
import { useSocket } from './hooks/useSocket';
import { useTheme } from './hooks/useTheme';
import { Pipeline } from './types';

import DashboardPage  from './pages/DashboardPage';
import PreviewPage    from './pages/PreviewPage';
import GitHubPage     from './pages/GitHubPage';
import WordPressPage  from './pages/WordPressPage';
import DeployPage     from './pages/DeployPage';
import SettingsPage   from './pages/SettingsPage';
import ChatPage       from './pages/ChatPage';

function AppInner() {
  const { toast } = useToast();
  const { theme, toggle: toggleTheme } = useTheme();
  const store = useStore();
  const { state, deployLogs, serverOnline, setFullState, addBuild, updatePipelineStep, addDeployLog, clearDeployLogs, setServerOnline } = store;

  useSocket({
    onStateUpdate: (s) => {
      setFullState(s);
      setServerOnline(true);
    },
    onWebhookReceived: (build) => {
      addBuild(build);
      toast(`Build received: ${build.pageName}`, 'success', build.projectName);
    },
    onPipelineStep: ({ step, status, error }) => {
      updatePipelineStep(step as keyof Pipeline, status as Pipeline[keyof Pipeline]);
      if (error) toast(`${step}: ${error}`, 'error');
    },
    onDeployLog: (log) => addDeployLog(log),
    onVSCodeOpen: ({ filePath }) => {
      toast('VS Code opening...', 'info', filePath);
    },
  });

  const handlePipelineStep = (step: string, status: string) => {
    updatePipelineStep(step as keyof Pipeline, status as Pipeline[keyof Pipeline]);
  };

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="shell">
        <Sidebar serverOnline={serverOnline} buildsCount={state.builds.length} />
        <div className="main-wrap">
          <TopBar lastBuildTime={state.latestBuild?.timestamp} theme={theme} onThemeToggle={toggleTheme} onRefresh={setFullState} />
          <Routes>
            <Route path="/chat" element={
              <ChatPage latestBuild={state.latestBuild} builds={state.builds} />
            } />
            <Route path="/" element={<DashboardPage state={state} />} />
            <Route path="/preview" element={
              <PreviewPage latestBuild={state.latestBuild} builds={state.builds} />
            } />
            <Route path="/github" element={
              <GitHubPage latestBuild={state.latestBuild} builds={state.builds} onPipelineStep={handlePipelineStep} />
            } />
            <Route path="/wordpress" element={
              <WordPressPage latestBuild={state.latestBuild} builds={state.builds} onPipelineStep={handlePipelineStep} />
            } />
            <Route path="/deploy" element={
              <DeployPage pipeline={state.pipeline} deployLogs={deployLogs} onClearLogs={clearDeployLogs} />
            } />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
