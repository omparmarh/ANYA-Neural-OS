/**
 * ANYA TELEPHONY CALL MANAGER
 * Manages active incoming calls, live transcripts, AI summaries, and call control events.
 */

export interface CallSession {
  callSid: string;
  callerNumber: string;
  callerName: string;
  state: 'RINGING' | 'SCREENING' | 'TAKEOVER' | 'COMPLETED' | 'HANGUP';
  startTime: number;
  duration: number;
  transcript: Array<{ speaker: 'Aanya' | 'Caller'; text: string; timestamp: string }>;
  summary: string;
  instructions: string[];
}

class CallManager {
  private activeCalls: Map<string, CallSession> = new Map();
  private wsClients: Set<any> = new Set();

  public registerWsClient(ws: any) {
    this.wsClients.add(ws);
    ws.on('close', () => this.wsClients.delete(ws));
  }

  public broadcast(event: string, data: any) {
    const payload = JSON.stringify({ type: event, data });
    for (const client of this.wsClients) {
      try {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(payload);
        }
      } catch {}
    }
  }

  public createSession(callSid: string, callerNumber: string, callerName: string = 'Incoming Caller'): CallSession {
    const session: CallSession = {
      callSid,
      callerNumber,
      callerName,
      state: 'SCREENING',
      startTime: Date.now(),
      duration: 0,
      transcript: [],
      summary: 'Aanya is establishing call screening...',
      instructions: [],
    };
    this.activeCalls.set(callSid, session);
    this.broadcast('anya-call-started', session);
    return session;
  }

  public getSession(callSid: string): CallSession | undefined {
    return this.activeCalls.get(callSid);
  }

  public getActiveCalls(): CallSession[] {
    return Array.from(this.activeCalls.values()).filter(c => c.state !== 'COMPLETED' && c.state !== 'HANGUP');
  }

  public appendTranscript(callSid: string, speaker: 'Aanya' | 'Caller', text: string) {
    const session = this.activeCalls.get(callSid);
    if (!session) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    session.transcript.push({ speaker, text, timestamp });

    // Update AI Executive Summary heuristic
    if (speaker === 'Caller' && text.length > 5) {
      if (text.toLowerCase().includes('calling about') || text.toLowerCase().includes('regarding') || text.toLowerCase().includes('this is')) {
        session.summary = `Caller statement: "${text}"`;
      } else {
        session.summary = `Latest input: "${text}"`;
      }
    }

    this.broadcast('anya-call-transcript', {
      callSid,
      speaker,
      text,
      timestamp,
      summary: session.summary,
      fullTranscript: session.transcript,
    });
  }

  public updateState(callSid: string, state: CallSession['state']) {
    const session = this.activeCalls.get(callSid);
    if (!session) return;
    session.state = state;
    this.broadcast('anya-call-state-changed', { callSid, state });
  }

  public addInstruction(callSid: string, instruction: string) {
    const session = this.activeCalls.get(callSid);
    if (!session) return;
    session.instructions.push(instruction);
    this.appendTranscript(callSid, 'Aanya', `[Direct Instruction from User]: "${instruction}"`);
    this.broadcast('anya-call-instruction', { callSid, instruction });
  }

  public endSession(callSid: string, reason: string = 'completed') {
    const session = this.activeCalls.get(callSid);
    if (!session) return;

    session.state = 'COMPLETED';
    session.duration = Math.round((Date.now() - session.startTime) / 1000);
    this.broadcast('anya-call-ended', { callSid, duration: session.duration, reason });
    
    setTimeout(() => {
      this.activeCalls.delete(callSid);
    }, 60000);
  }
}

export const callManager = new CallManager();
