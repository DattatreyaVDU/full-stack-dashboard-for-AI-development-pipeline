import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { DashboardState, Build, DeployLog } from '../types';

interface SocketHandlers {
  onStateUpdate?: (state: DashboardState) => void;
  onWebhookReceived?: (build: Build) => void;
  onWpBuildReceived?: (build: Build) => void;
  onPipelineStep?: (data: { step: string; status: string; error?: string }) => void;
  onDeployLog?: (log: DeployLog) => void;
  onVSCodeOpen?: (data: { filePath: string }) => void;
  onChatResponse?: (data: { sessionId: string; output: string }) => void;
}

export function useSocket(handlers: SocketHandlers) {
  const socketRef   = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    // If already connected with a valid socket, skip
    if (socketRef.current?.connected) return;
    // Clean up any stale disconnected socket first
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const token = localStorage.getItem('n8n-auth-token') ?? '';
    // Don't connect if there's no token — AuthGuard hasn't let user through yet
    if (!token) return;

    socketRef.current = io('/', {
      auth:                 { token },
      transports:           ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay:    2000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current.on('state:update', (data: DashboardState) => {
      handlersRef.current.onStateUpdate?.(data);
    });

    // 'build:update' is the primary event emitted by POST /api/webhook/n8n
    socketRef.current.on('build:update', (build: Build) => {
      handlersRef.current.onWebhookReceived?.(build);
    });

    // 'webhook:received' kept for backward compatibility
    socketRef.current.on('webhook:received', (build: Build) => {
      handlersRef.current.onWebhookReceived?.(build);
    });

    // WordPress pipeline builds (from /api/webhook/wp)
    socketRef.current.on('wpbuild:update', (build: Build) => {
      handlersRef.current.onWpBuildReceived?.(build);
    });

    socketRef.current.on('pipeline:step', (data: { step: string; status: string; error?: string }) => {
      handlersRef.current.onPipelineStep?.(data);
    });

    socketRef.current.on('deploy:log', (log: DeployLog) => {
      handlersRef.current.onDeployLog?.(log);
    });

    socketRef.current.on('vscode:open', (data: { filePath: string }) => {
      handlersRef.current.onVSCodeOpen?.(data);
      // Open VS Code via URL protocol — use open() so page doesn't navigate away
      window.open(`vscode://file/${data.filePath}`, '_self');
    });

    socketRef.current.on('chat:response', (data: { sessionId: string; output: string }) => {
      handlersRef.current.onChatResponse?.(data);
    });

    return socketRef.current;
  }, []);

  useEffect(() => {
    connect();
    return () => { disconnect(); };
  }, [connect, disconnect]);

  return { socket: socketRef.current, disconnect };
}
