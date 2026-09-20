/**
 * ANYA TELEPHONY ROUTER & TWILIO WEBHOOK HANDLER
 */

import { Router, Request, Response } from 'express';
import { callManager } from './callManager';

export const telephonyRouter = Router();

/**
 * Twilio Webhook: /api/voice/incoming
 * Called when an incoming phone call is routed to Aanya.
 * Returns TwiML XML instructing Twilio to open a WebSocket audio stream.
 */
telephonyRouter.post('/incoming', (req: Request, res: Response) => {
  const callSid = req.body?.CallSid || `call_${Date.now()}`;
  const callerNumber = req.body?.From || 'Unknown Number';
  const callerCity = req.body?.FromCity || '';
  const callerState = req.body?.FromState || '';
  const location = [callerCity, callerState].filter(Boolean).join(', ');
  const callerDisplayName = location ? `${callerNumber} (${location})` : callerNumber;

  // Initialize active call session
  callManager.createSession(callSid, callerNumber, callerDisplayName);

  // Host domain for WebSocket stream (fallback to current host header)
  const host = req.headers.host || 'localhost:3001';
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
  const streamUrl = `${protocol}://${host}/api/voice/media-stream`;

  // TwiML response to answer and open WebSocket audio stream
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Google.en-US-Standard-C">Connecting to Aanya executive call screening system.</Say>
    <Connect>
        <Stream url="${streamUrl}">
            <Parameter name="callSid" value="${callSid}" />
        </Stream>
    </Connect>
</Response>`;

  res.type('text/xml');
  res.send(twiml);
});

/**
 * REST API: GET /api/voice/active-calls
 * List all ongoing screened calls
 */
telephonyRouter.get('/active-calls', (_req: Request, res: Response) => {
  res.json({ success: true, calls: callManager.getActiveCalls() });
});

/**
 * REST API: POST /api/voice/takeover
 * Request 1-tap call takeover
 */
telephonyRouter.post('/takeover', (req: Request, res: Response) => {
  const { callSid, forwardNumber } = req.body;
  if (!callSid) {
    return res.status(400).json({ success: false, error: 'callSid is required' });
  }

  callManager.updateState(callSid, 'TAKEOVER');
  callManager.appendTranscript(callSid, 'Aanya', '[User Initiated Live Call Takeover]');

  res.json({
    success: true,
    callSid,
    message: 'Call takeover requested. Bridging audio to user device...',
    forwardNumber: forwardNumber || ''
  });
});

/**
 * REST API: POST /api/voice/hangup
 * Request polite call termination
 */
telephonyRouter.post('/hangup', (req: Request, res: Response) => {
  const { callSid, signOffMessage } = req.body;
  if (!callSid) {
    return res.status(400).json({ success: false, error: 'callSid is required' });
  }

  callManager.appendTranscript(callSid, 'Aanya', signOffMessage || 'Thank you for calling. Have a great day!');
  callManager.endSession(callSid, 'user_hangup');

  res.json({ success: true, callSid, message: 'Call terminated' });
});

/**
 * REST API: POST /api/voice/instruct
 * Inject custom voice instruction for Aanya to speak to the caller
 */
telephonyRouter.post('/instruct', (req: Request, res: Response) => {
  const { callSid, instruction } = req.body;
  if (!callSid || !instruction) {
    return res.status(400).json({ success: false, error: 'callSid and instruction are required' });
  }

  callManager.addInstruction(callSid, instruction);
  res.json({ success: true, callSid, instruction });
});
