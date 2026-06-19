import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { DashboardState, Build, DeployLog } from '../types';

interface SocketHandlers {
  onStateUpdate?: (state: DashboardState) => void;
  onWebhookReceived?: (build: Build) => void;
  onPipelineStep?: (data: { step: string; status: string; error?: string }) => void;
  onDeployLog?: (log: DeployLog) => void;
  onVSCodeOpen?: (data: { filePath: string }) => void;
}

export function useSocket(handlers: SocketHandlers) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    socketRef.current = io('/', {
      transports: ['polling', 'websocket'],  // polling first — more reliable through Vite proxy
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
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

    socketRef.current.on('pipeline:step', (data: { step: string; status: string; error?: string }) => {
      handlersRef.current.onPipelineStep?.(data);
    });

    socketRef.current.on('deploy:log', (log: DeployLog) => {
      handlersRef.current.onDeployLog?.(log);
    });

    socketRef.current.on('vscode:open', (data: { filePath: string }) => {
      handlersRef.current.onVSCodeOpen?.(data);
      // Open VS Code via URL protocol
      window.location.href = `vscode://file/${data.filePath}`;
    });

    return socketRef.current;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
    };
  }, [connect]);

  return { socket: socketRef.current };
}
