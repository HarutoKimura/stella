/**
 * Phase 2: Realtime Voice Client
 *
 * Wraps the OpenAI Agents SDK RealtimeAgent for voice conversations.
 * Manages WebRTC connection, audio streaming, and function call handling.
 */

import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime'
import { VoiceIntent } from './aiContracts'

export type VoiceClientEvents = {
  transcript: (text: string, role: 'user' | 'tutor') => void
  response: (text: string) => void
  functionCall: (intent: VoiceIntent) => void
  error: (error: Error) => void
  connected: () => void
  disconnected: () => void
}

export class RealtimeVoiceClient {
  private agent: RealtimeAgent | null = null
  private session: RealtimeSession | null = null
  private listeners: Partial<VoiceClientEvents> = {}
  private isConnected = false

  constructor() {}

  /**
   * Initialize and connect to OpenAI Realtime API
   */
  async connect(token: string, instructions: string, functions: any[]) {
    try {
      // Create agent with instructions
      this.agent = new RealtimeAgent({
        name: 'Tutor',
        instructions,
      })

      // TODO Phase 2: Add function definitions
      // Example:
      // for (const func of functions) {
      //   this.agent.addFunction(func.name, func.description, func.parameters, (args) => {
      //     this.handleFunctionCall(func.name, args);
      //   });
      // }

      // Create session
      this.session = new RealtimeSession(this.agent, {
        model: 'gpt-realtime-mini-2025-10-06',
      })

      // Connect with ephemeral token
      await this.session.connect({
        apiKey: token, // ephemeral token from /api/realtime-token
      })

      this.isConnected = true
      this.emit('connected')

      // Setup event listeners
      this.setupEventListeners()
    } catch (error) {
      console.error('Failed to connect to Realtime API:', error)
      this.emit('error', error as Error)
      throw error
    }
  }

  /**
   * Setup event listeners for realtime session
   */
  private setupEventListeners() {
    if (!this.session) return

    // TODO Phase 2: Implement event listeners based on @openai/agents SDK
    //
    // Example events to handle:
    // - session.on('transcript', (data) => { ... })
    // - session.on('response', (data) => { ... })
    // - session.on('function_call', (data) => { ... })
    // - session.on('error', (error) => { ... })
    //
    // Refer to: https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/
  }

  /**
   * Handle function calls from the model
   */
  private handleFunctionCall(name: string, args: any) {
    let intent: VoiceIntent | null = null

    switch (name) {
      case 'mark_target_used':
        intent = {
          type: 'mark_target_used',
          phrase: args.phrase,
        }
        break

      case 'add_correction':
        intent = {
          type: 'add_correction',
          correctionType: args.type,
          example: args.example,
          correction: args.correction,
        }
        break

      case 'end_session':
        intent = { type: 'end_session' }
        break

      case 'navigate':
        intent = {
          type: 'navigate',
          destination: args.destination,
        }
        break

      default:
        console.warn(`Unknown function call: ${name}`)
    }

    if (intent) {
      this.emit('functionCall', intent)
    }
  }

  /**
   * Disconnect from Realtime API
   */
  async disconnect() {
    if (this.session) {
      // TODO Phase 2: Implement proper disconnect
      // await this.session.disconnect()
      this.session = null
    }
    this.agent = null
    this.isConnected = false
    this.emit('disconnected')
  }

  /**
   * Check connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected
  }

  /**
   * Register event listener
   */
  on<K extends keyof VoiceClientEvents>(
    event: K,
    listener: VoiceClientEvents[K]
  ) {
    this.listeners[event] = listener
  }

  /**
   * Emit event to listeners
   */
  private emit<K extends keyof VoiceClientEvents>(
    event: K,
    ...args: Parameters<VoiceClientEvents[K]>
  ) {
    const listener = this.listeners[event]
    if (listener) {
      // @ts-ignore
      listener(...args)
    }
  }
}

/**
 * Singleton instance for global access
 */
let voiceClientInstance: RealtimeVoiceClient | null = null

export function getVoiceClient(): RealtimeVoiceClient {
  if (!voiceClientInstance) {
    voiceClientInstance = new RealtimeVoiceClient()
  }
  return voiceClientInstance
}
