import { useState, useCallback } from 'react';
import { DashboardState, Build, Pipeline, DeployLog } from '../types';

const initialState: DashboardState = {
  latestBuild:   null,
  latestWpBuild: null,
  pipeline: {
    n8n: 'idle', webhook: 'idle', github: 'idle',
    vscode: 'idle', wordpress: 'idle', deploy: 'idle',
  },
  builds:   [],
  wpBuilds: [],
};

export function useStore() {
  const [state, setState] = useState<DashboardState>(initialState);
  const [deployLogs, setDeployLogs] = useState<DeployLog[]>([]);
  const [serverOnline, setServerOnline] = useState(false);

  const setFullState = useCallback((s: Partial<DashboardState>) => {
    setState(prev => ({
      ...prev,
      ...s,
      // Never let builds become undefined — keep existing array if server omits it
      builds:   Array.isArray(s.builds)   ? s.builds   : prev.builds,
      wpBuilds: Array.isArray(s.wpBuilds) ? s.wpBuilds : prev.wpBuilds,
    }));
    setServerOnline(true);
  }, []);

  const addBuild = useCallback((build: Build) => {
    setState(prev => ({
      ...prev,
      latestBuild: build,
      builds: [build, ...prev.builds].slice(0, 50),
    }));
  }, []);

  const addWpBuild = useCallback((build: Build) => {
    setState(prev => ({
      ...prev,
      latestWpBuild: build,
      wpBuilds: [build, ...prev.wpBuilds].slice(0, 50),
    }));
  }, []);

  const updatePipelineStep = useCallback((step: keyof Pipeline, status: Pipeline[keyof Pipeline]) => {
    setState(prev => ({
      ...prev,
      pipeline: { ...prev.pipeline, [step]: status },
    }));
  }, []);

  const addDeployLog = useCallback((log: DeployLog) => {
    setDeployLogs(prev => [...prev, log]);
  }, []);

  const clearDeployLogs = useCallback(() => setDeployLogs([]), []);

  return {
    state,
    deployLogs,
    serverOnline,
    setFullState,
    addBuild,
    addWpBuild,
    updatePipelineStep,
    addDeployLog,
    clearDeployLogs,
    setServerOnline,
  };
}
