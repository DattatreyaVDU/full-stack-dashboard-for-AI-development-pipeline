export interface Build {
  id: string;
  timestamp: string;
  projectName: string;
  pageId: string;
  pageName: string;
  filePath: string;
  folder: string;
  content: string;
  generatedFiles?: string[];
  rawPayload: Record<string, unknown>;
  status: 'received' | 'committed' | 'converted' | 'deployed' | 'error';
}

export type PipelineStatus = 'idle' | 'running' | 'done' | 'error';

export interface Pipeline {
  n8n: PipelineStatus;
  webhook: PipelineStatus;
  github: PipelineStatus;
  vscode: PipelineStatus;
  wordpress: PipelineStatus;
  deploy: PipelineStatus;
}

export interface DashboardState {
  latestBuild:   Build | null;
  latestWpBuild: Build | null;
  pipeline: Pipeline;
  builds:   Build[];   // Web pipeline builds
  wpBuilds: Build[];   // WordPress pipeline builds
}

export interface GitHubStatus {
  connected: boolean;
  repoName?: string;
  defaultBranch?: string;
  private?: boolean;
  lastPush?: string;
  error?: string;
}

export interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface DeployLog {
  msg: string;
  type: 'log' | 'error';
  ts: string;
}
