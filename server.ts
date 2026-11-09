import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI, Modality } from '@google/genai';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));

// Shared Gemini AI instance
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health and status API
app.get('/api/status', (req, res) => {
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'online',
    hasApiKey,
    defaultModel: 'gemini-3.8-live',
    voices: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Zephyr'],
    extendedThinkingModel: 'gemini-3.8-live-extended-thinking',
    environment: {
      platform: process.platform,
      nodeVersion: process.version,
    },
  });
});

// REST fallback for spoken response generation
app.post('/api/gemini/converse', async (req, res) => {
  try {
    const { prompt, voice = 'Puck', systemInstruction } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction:
          systemInstruction ||
          'You are Gemini Live running directly on this PC. You provide crisp, engaging, spoken-style responses.',
      },
    });

    res.json({
      text: response.text || '',
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/converse:', error);
    res.status(500).json({ error: error?.message || 'Failed to converse with Gemini' });
  }
});

// WebSocket Server for Gemini Live Real-Time Audio & Video
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  } catch (err) {
    console.error('Upgrade error:', err);
    socket.destroy();
  }
});

wss.on('connection', async (clientWs: WebSocket) => {
  let session: any = null;
  let isClosed = false;

  clientWs.send(
    JSON.stringify({
      type: 'info',
      message: 'Connected to PC Live Bridge. Ready to start Gemini Live session.',
    })
  );

  async function startLiveSession(configData: {
    model?: string;
    voice?: string;
    systemInstruction?: string;
  }) {
    if (session) {
      try {
        session.close();
      } catch (e) {
        // ignore
      }
      session = null;
    }

    try {
      const ai = getGeminiClient();
      const model = configData.model || 'gemini-3.8-live';
      const voice = configData.voice || 'Puck';
      const systemInstruction =
        configData.systemInstruction ||
        'You are Gemini Live, a fast, expressive, natural voice assistant running directly on this user\'s PC. You can hear their microphone and see their camera or screen share if provided. Keep answers concise, direct, conversational, and natural to listen to.';

      clientWs.send(
        JSON.stringify({
          type: 'status',
          state: 'connecting',
          message: `Establishing Live session with ${model} (Voice: ${voice})...`,
        })
      );

      session = await ai.live.connect({
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
          },
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (message: any) => {
            if (isClosed) return;

            // Forward model audio chunks (24kHz PCM)
            for (const part of message.serverContent?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({
                    type: 'audio',
                    audio: part.inlineData.data,
                  })
                );
              }
            }

            // Real-time transcription
            if (message.serverContent?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'user_transcript',
                  text: message.serverContent.inputTranscription.text,
                })
              );
            }

            if (message.serverContent?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'model_transcript',
                  text: message.serverContent.outputTranscription.text,
                })
              );
            }

            // Model interrupted when user speaks
            if (message.serverContent?.interrupted) {
              clientWs.send(
                JSON.stringify({
                  type: 'interrupted',
                })
              );
            }

            // Turn complete
            if (message.serverContent?.turnComplete) {
              clientWs.send(
                JSON.stringify({
                  type: 'turn_complete',
                })
              );
            }
          },
          onclose: (e: any) => {
            if (!isClosed) {
              clientWs.send(
                JSON.stringify({
                  type: 'session_closed',
                  reason: e?.reason || 'Gemini Live session ended.',
                })
              );
            }
          },
          onerror: (err: any) => {
            console.error('Gemini Live API error:', err);
            if (!isClosed) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  error: err?.message || 'Error occurred during Gemini Live session',
                })
              );
            }
          },
        },
      });

      clientWs.send(
        JSON.stringify({
          type: 'ready',
          model,
          voice,
          message: 'Gemini Live is active! Listening on PC microphone...',
        })
      );
    } catch (err: any) {
      console.error('Failed to connect to Gemini Live:', err);
      clientWs.send(
        JSON.stringify({
          type: 'error',
          error:
            err?.message ||
            'Could not initiate Gemini Live session. Check that your GEMINI_API_KEY is configured in Settings > Secrets.',
        })
      );
    }
  }

  clientWs.on('message', async (data: Buffer | string) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'start') {
        await startLiveSession({
          model: msg.model,
          voice: msg.voice,
          systemInstruction: msg.systemInstruction,
        });
        return;
      }

      if (msg.type === 'stop') {
        if (session) {
          try {
            session.close();
          } catch (e) {
            // ignore
          }
          session = null;
        }
        clientWs.send(JSON.stringify({ type: 'status', state: 'stopped' }));
        return;
      }

      // Stream audio to Gemini Live session
      if (msg.type === 'audio' && msg.audio) {
        if (session) {
          session.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        }
        return;
      }

      // Stream video / image snapshot (webcam or screen share)
      if (msg.type === 'video' && msg.data) {
        if (session) {
          session.sendRealtimeInput({
            video: {
              data: msg.data,
              mimeType: 'image/jpeg',
            },
          });
        }
        return;
      }

      // Send text message directly into conversation
      if (msg.type === 'text' && msg.text) {
        if (session) {
          session.sendRealtimeInput({
            text: msg.text,
          });
        }
        return;
      }
    } catch (err: any) {
      console.error('Error handling client message:', err);
      clientWs.send(
        JSON.stringify({
          type: 'error',
          error: err?.message || 'Failed to process input message.',
        })
      );
    }
  });

  clientWs.on('close', () => {
    isClosed = true;
    if (session) {
      try {
        session.close();
      } catch (e) {
        // ignore
      }
      session = null;
    }
  });
});

// Mount Vite or static dist
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Gemini Live PC server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup error:', err);
});
