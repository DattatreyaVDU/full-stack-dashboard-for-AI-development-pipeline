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
  files_written?: string[];
  source?: 'web' | 'wordpress';
  rawPayload: Record<string, unknown>;
  status: 'received' | 'committed' | 'converted' | 'deployed' | 'error';
}

export interface DiskProject {
  name: string;
  type: 'wordpress' | 'react' | 'unknown';
  fileCount: number;
  totalSize: number;
  totalSizeFmt: string;
  lastModified: string | null;
  extCounts: Record<string, number>;
  topFiles: string[];
}

export interface FileTreeNode {
  type: 'file' | 'dir';
  name: string;
  path: string;
  size?: number;
  ext?: string;
  children?: FileTreeNode[];
}

export interface ErrorLog {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  buildId?: string | null;
  stack?: string;
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
