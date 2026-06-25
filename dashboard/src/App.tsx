import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import { ToastProvider, useToast } from './components/cards/ToastProvider';
import { useStore } from './store/useStore';
import { useSocket } from './hooks/useSocket';
import { useTheme } from './hooks/useTheme';
import { Pipeline } from './types';
import { state as stateApi } from './api/client';

import DashboardPage  from './pages/DashboardPage';
import PreviewPage    from './pages/PreviewPage';
import GitHubPage     from './pages/GitHubPage';
import WordPressPage  from './pages/WordPressPage';
import DeployPage     from './pages/DeployPage';
import SettingsPage   from './pages/SettingsPage';
import ChatPage       from './pages/ChatPage';
import LoginPage      from './pages/LoginPage';
import RegisterPage   from './pages/RegisterPage';
import AdminPage         from './pages/AdminPage';
import ProfilePage       from './pages/ProfilePage';
import FileExplorerPage    from './pages/FileExplorerPage';
import MobileProjectsPage  from './pages/MobileProjectsPage';
import AuthGuard           from './components/AuthGuard';
import { useAuth }       from './store/useAuth';
import VerifyPage        from './pages/VerifyPage';

function AppInner() {
  const { toast } = useToast();
  const { theme, toggle: toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const store = useStore();
  const { state, deployLogs, serverOnline, setFullState, addBuild, addWpBuild, updatePipelineStep, addDeployLog, clearDeployLogs, setServerOnline } = store;

  useSocket({
    onStateUpdate: (s) => {
      setFullState(s);
      setServerOnline(true);
    },
    onWebhookReceived: (build) => {
      addBuild(build);
      const webFile = build.pageName?.split(/[\\/]/).pop() ?? build.pageName;
      toast(`Web build: ${webFile}`, 'success', build.projectName);
    },
    onWpBuildReceived: (build) => {
      addWpBuild(build);
      const wpFile = build.pageName?.split(/[\\/]/).pop() ?? build.pageName;
      toast(`WP build: ${wpFile}`, 'info', build.projectName);
    },
    onPipelineStep: ({ step, status, error }) => {
      updatePipelineStep(step as keyof Pipeline, status as Pipeline[keyof Pipeline]);
      if (error) toast(`${step}: ${error}`, 'error');
    },
    onDeployLog: (log) => addDeployLog(log),
    onVSCodeOpen: ({ filePath }) => {
      toast('VS Code opening...', 'info', filePath);
    },
    onChatResponse: ({ output }) => {
      window.dispatchEvent(new CustomEvent('n8n:chat-response', { detail: { output } }));
    },
  });

  // Poll every 30 s while pipeline is active so missed socket events don't leave the UI stale
  const pipelineRef = useRef(state.pipeline);
  pipelineRef.current = state.pipeline;
  useEffect(() => {
    const id = setInterval(async () => {
      const p = pipelineRef.current;
      const isActive = Object.values(p).some(v => v === 'running');
      if (!isActive) return;
      try { const fresh = await stateApi.get(); setFullState(fresh); } catch { /* offline */ }
    }, 30000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePipelineStep = (step: string, status: string) => {
    updatePipelineStep(step as keyof Pipeline, status as Pipeline[keyof Pipeline]);
  };

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public routes */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify"   element={<VerifyPage />} />

        {/* Protected routes */}
        <Route path="/*" element={
          <AuthGuard>
            <div className="shell">
              <Sidebar serverOnline={serverOnline} buildsCount={state.builds.length} wpBuildsCount={state.wpBuilds.length} />
              <div className="main-wrap">
                <TopBar
                  lastBuildTime={state.latestBuild?.timestamp}
                  theme={theme} onThemeToggle={toggleTheme} onRefresh={setFullState}
                  user={user} onLogout={logout}
                />
                <Routes>
                  <Route path="/chat"        element={<ChatPage key="web"    latestBuild={state.latestBuild} builds={state.builds} />} />
                  <Route path="/chat-webapp" element={<ChatPage key="webapp" latestBuild={state.latestBuild} builds={state.builds} pipelineType="webapp" />} />
                  <Route path="/mobile-projects" element={<MobileProjectsPage />} />
                  <Route path="/" element={<DashboardPage state={state} />} />
                  <Route path="/preview" element={<PreviewPage latestBuild={state.latestBuild} builds={state.builds} />} />
                  <Route path="/github"  element={<GitHubPage latestBuild={state.latestBuild} builds={state.builds} onPipelineStep={handlePipelineStep} />} />
                  <Route path="/wordpress" element={<WordPressPage latestBuild={state.latestWpBuild ?? state.latestBuild} builds={state.wpBuilds.length > 0 ? state.wpBuilds : state.builds} onPipelineStep={handlePipelineStep} />} />
                  <Route path="/deploy"   element={<DeployPage pipeline={state.pipeline} deployLogs={deployLogs} onClearLogs={clearDeployLogs} />} />
                  <Route path="/files"    element={<FileExplorerPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/profile"  element={<ProfilePage />} />
                  <Route path="/admin"    element={user?.role === 'admin' ? <AdminPage /> : <DashboardPage state={state} />} />
                </Routes>
              </div>
            </div>
          </AuthGuard>
        } />
      </Routes>
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
