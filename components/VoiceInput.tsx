import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Mic, 
  Square, 
  Volume2, 
  AlertCircle
} from 'lucide-react';
import { cn } from './ui/utils';
import { AriaLiveRegionManager } from '../utils/accessibility';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
  autoSend?: boolean;
  language?: string;
  continuous?: boolean;
}

interface VoiceCommand {
  phrase: string;
  action: () => void;
  description: string;
}

export function VoiceInput({
  onTranscript,
  onError,
  disabled = false,
  className,
  autoSend = false,
  language = 'en-US',
  continuous = false
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Voice commands for navigation
  const voiceCommands: VoiceCommand[] = [
    {
      phrase: 'new conversation',
      action: () => {
        const event = new CustomEvent('voice-command', { detail: { command: 'new-conversation' } });
        window.dispatchEvent(event);
      },
      description: 'Start a new conversation'
    },
    {
      phrase: 'send message',
      action: () => {
        if (transcript.trim()) {
          onTranscript(transcript);
          setTranscript('');
        }
      },
      description: 'Send the current message'
    },
    {
      phrase: 'clear message',
      action: () => {
        setTranscript('');
        AriaLiveRegionManager.announce('voice', 'Message cleared', 'polite');
      },
      description: 'Clear the current message'
    },
    {
      phrase: 'stop listening',
      action: () => {
        stopListening();
      },
      description: 'Stop voice input'
    }
  ];

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser');
      return;
    }

    // Initialize speech recognition
    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      AriaLiveRegionManager.announce('voice', 'Voice input started', 'polite');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          finalTranscript += transcript;
          setConfidence(confidence);
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        // Check for voice commands
        const command = voiceCommands.find(cmd => 
          finalTranscript.toLowerCase().includes(cmd.phrase.toLowerCase())
        );

        if (command) {
          command.action();
          AriaLiveRegionManager.announce('voice', `Command executed: ${command.description}`, 'polite');
        } else {
          setTranscript(prev => prev + finalTranscript);
          if (autoSend && finalTranscript.trim()) {
            onTranscript(finalTranscript);
            setTranscript('');
          }
        }
      } else if (interimTranscript) {
        setTranscript(prev => prev + interimTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMessage = getErrorMessage(event.error);
      setError(errorMessage);
      setIsListening(false);
      onError?.(errorMessage);
      AriaLiveRegionManager.announce('voice', `Voice input error: ${errorMessage}`, 'assertive');
    };

    recognition.onend = () => {
      setIsListening(false);
      AriaLiveRegionManager.announce('voice', 'Voice input stopped', 'polite');
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      cleanup();
    };
  }, [language, continuous, autoSend, onTranscript, onError]);

  // Audio visualization
  const setupAudioVisualization = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      microphoneRef.current = microphone;

      // Start volume monitoring
      monitorVolume();
    } catch (error) {
      console.error('Error setting up audio visualization:', error);
    }
  }, []);

  const monitorVolume = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateVolume = () => {
      if (!analyserRef.current || !isListening) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setVolume(Math.min(100, (average / 255) * 100));

      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };

    updateVolume();
  }, [isListening]);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported || !recognitionRef.current || disabled) return;

    try {
      setIsProcessing(true);
      await setupAudioVisualization();
      recognitionRef.current.start();
    } catch (error) {
      const errorMessage = 'Failed to start voice input';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [isSupported, disabled, setupAudioVisualization, onError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    cleanup();
    setVolume(0);
  }, [isListening, cleanup]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case 'no-speech':
        return 'No speech detected. Please try again.';
      case 'audio-capture':
        return 'Microphone access denied or unavailable.';
      case 'not-allowed':
        return 'Microphone permission denied.';
      case 'network':
        return 'Network error occurred.';
      case 'service-not-allowed':
        return 'Speech recognition service not allowed.';
      default:
        return `Speech recognition error: ${error}`;
    }
  };

  const handleSendTranscript = () => {
    if (transcript.trim()) {
      onTranscript(transcript);
      setTranscript('');
      AriaLiveRegionManager.announce('voice', 'Message sent', 'polite');
    }
  };

  if (!isSupported) {
    return (
      <Alert className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Voice Input Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant={isListening ? "destructive" : "default"}
          size="sm"
          onClick={toggleListening}
          disabled={disabled || isProcessing}
          className={cn(
            "transition-all duration-200",
            isListening && "animate-pulse"
          )}
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
        >
          {isProcessing ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : isListening ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          <span className="ml-2">
            {isProcessing ? 'Starting...' : isListening ? 'Stop' : 'Voice Input'}
          </span>
        </Button>

        {/* Volume Indicator */}
        {isListening && (
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Progress value={volume} className="w-20 h-2" />
            <Badge variant="outline" className="text-xs">
              {Math.round(volume)}%
            </Badge>
          </div>
        )}

        {/* Confidence Indicator */}
        {confidence > 0 && (
          <Badge variant={confidence > 0.8 ? "default" : "secondary"} className="text-xs">
            {Math.round(confidence * 100)}% confident
          </Badge>
        )}
      </div>

      {/* Transcript Display */}
      {transcript && (
        <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">Transcript:</p>
              <p className="text-sm">{transcript}</p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSendTranscript}
                className="h-7 px-2"
                aria-label="Send transcript"
              >
                Send
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTranscript('');
                  AriaLiveRegionManager.announce('voice', 'Transcript cleared', 'polite');
                }}
                className="h-7 px-2"
                aria-label="Clear transcript"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Voice Commands Help */}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Voice Commands
        </summary>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {voiceCommands.map((command, index) => (
            <div key={index} className="flex justify-between">
              <span className="font-mono">"{command.phrase}"</span>
              <span>{command.description}</span>
            </div>
          ))}
        </div>
      </details>

      {/* Status for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isListening && 'Voice input is active'}
        {transcript && `Current transcript: ${transcript}`}
        {error && `Error: ${error}`}
      </div>
    </div>
  );
}

// Voice navigation hook for global voice commands
export function useVoiceNavigation() {
  useEffect(() => {
    const handleVoiceCommand = (event: CustomEvent) => {
      const { command } = event.detail;
      
      switch (command) {
        case 'new-conversation':
          // Trigger new conversation
          const newConvButton = document.querySelector('[data-new-conversation]') as HTMLElement;
          newConvButton?.click();
          break;
        case 'focus-input':
          // Focus chat input
          const chatInput = document.querySelector('[data-chat-input]') as HTMLElement;
          chatInput?.focus();
          break;
        case 'toggle-sidebar':
          // Toggle sidebar
          const sidebarToggle = document.querySelector('[data-sidebar-toggle]') as HTMLElement;
          sidebarToggle?.click();
          break;
        case 'open-settings':
          // Open settings
          const settingsButton = document.querySelector('[data-settings-toggle]') as HTMLElement;
          settingsButton?.click();
          break;
      }
    };

    window.addEventListener('voice-command', handleVoiceCommand as EventListener);
    
    return () => {
      window.removeEventListener('voice-command', handleVoiceCommand as EventListener);
    };
  }, []);
}

// Extend window interface for speech recognition
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  }

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    readonly isFinal: boolean;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }
}