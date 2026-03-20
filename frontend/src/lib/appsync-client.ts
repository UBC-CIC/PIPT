/**
 * AppSync real-time subscription client using the graphql-ws sub-protocol.
 *
 * Connects to the AppSync real-time endpoint with Cognito auth and
 * delivers onTextStream events to a callback.
 */
import { appConfig } from '@/config/aws-config';
import { authService } from '@/lib/auth';

export interface TextStreamEvent {
  type: 'start' | 'chunk' | 'end' | 'error' | 'empathy' | 'debrief';
  content: string;
}

type StreamCallback = (event: TextStreamEvent) => void;

/**
 * Subscribe to onTextStream for a sessionId.
 * Resolves with an unsubscribe function once the subscription is active.
 */
export async function subscribeToTextStream(
  sessionId: string,
  onEvent: StreamCallback,
): Promise<() => void> {
  const graphqlUrl = appConfig.appSync.graphqlUrl;
  if (!graphqlUrl) throw new Error('AppSync GraphQL URL not configured');

  const token = await authService.getIdToken();
  if (!token) throw new Error('No auth token for AppSync');

  // Derive realtime endpoint from HTTP endpoint
  const realtimeUrl = graphqlUrl
    .replace('https://', 'wss://')
    .replace('appsync-api', 'appsync-realtime-api');
  const host = new URL(graphqlUrl).host;

  const header = btoa(JSON.stringify({ Authorization: token, host }));
  const payload = btoa('{}');
  const wsUrl = `${realtimeUrl}?header=${encodeURIComponent(header)}&payload=${encodeURIComponent(payload)}`;

  return new Promise<() => void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl, ['graphql-ws']);
    let subId: string | null = null;
    let kaTimer: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;

    const cleanup = () => {
      if (kaTimer) clearTimeout(kaTimer);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        if (subId) ws.send(JSON.stringify({ type: 'stop', id: subId }));
        ws.close();
      }
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'connection_init' }));
    };

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);

      switch (msg.type) {
        case 'connection_ack': {
          subId = crypto.randomUUID();
          ws.send(JSON.stringify({
            id: subId,
            type: 'start',
            payload: {
              data: JSON.stringify({
                query: `subscription OnTextStream($sessionId: String!) {
                  onTextStream(sessionId: $sessionId) { sessionId data }
                }`,
                variables: { sessionId },
              }),
              extensions: {
                authorization: { Authorization: token, host },
              },
            },
          }));
          break;
        }
        case 'start_ack': {
          if (!resolved) { resolved = true; resolve(cleanup); }
          break;
        }
        case 'data': {
          try {
            const p = msg.payload?.data?.onTextStream;
            if (p?.data) onEvent(JSON.parse(p.data) as TextStreamEvent);
          } catch (e) {
            console.error('Failed to parse AppSync stream event:', e);
          }
          break;
        }
        case 'ka': {
          if (kaTimer) clearTimeout(kaTimer);
          kaTimer = setTimeout(() => { console.warn('AppSync WS keep-alive timeout'); cleanup(); }, 5 * 60_000);
          break;
        }
        case 'error': {
          console.error('AppSync subscription error:', msg.payload);
          if (!resolved) { resolved = true; reject(new Error(msg.payload?.errors?.[0]?.message || 'Subscription error')); }
          break;
        }
        case 'complete': {
          cleanup();
          break;
        }
      }
    };

    ws.onerror = (err) => {
      console.error('AppSync WS error:', err);
      if (!resolved) { resolved = true; reject(new Error('WebSocket connection failed')); }
    };

    ws.onclose = () => {
      if (kaTimer) clearTimeout(kaTimer);
    };
  });
}
