import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
  isUploading?: boolean;
}

export function AudioRecorder({ onRecordingComplete, onCancel, isUploading }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Start recording immediately when component mounts
    startRecording();
    
    return () => {
      // Cleanup on unmount
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Prioriza formatos aceitos pelo WhatsApp Oficial (Meta):
      // ogg/opus (Firefox), mp4/aac (Chrome novo), mpeg, e por último webm
      const candidates = [
        'audio/ogg;codecs=opus',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/aac',
        'audio/mpeg',
        'audio/webm;codecs=opus',
      ];
      const preferredMimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: preferredMimeType,
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: preferredMimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob, duration);
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    onCancel();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-destructive/10 rounded-lg border border-destructive/20">
      {/* Cancel button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/20"
        onClick={handleCancel}
        disabled={isUploading}
      >
        <X className="w-4 h-4" />
      </Button>

      {/* Recording indicator / Audio preview */}
      <div className="flex-1 flex items-center gap-3">
        {isRecording ? (
          <>
            {/* Pulsing red dot */}
            <div className="relative">
              <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
              <div className="absolute inset-0 w-3 h-3 bg-destructive rounded-full animate-ping opacity-75" />
            </div>
            
            {/* Waveform animation */}
            <div className="flex items-center gap-0.5 h-6">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-destructive rounded-full animate-pulse"
                  style={{
                    height: `${Math.random() * 16 + 8}px`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: '0.5s',
                  }}
                />
              ))}
            </div>
          </>
        ) : audioUrl ? (
          <audio src={audioUrl} controls className="h-8 w-full max-w-[200px]" />
        ) : null}
        
        {/* Duration */}
        <span className={cn(
          "text-sm font-mono tabular-nums",
          isRecording ? "text-destructive" : "text-muted-foreground"
        )}>
          {formatDuration(duration)}
        </span>
      </div>

      {/* Stop / Send button */}
      {isRecording ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onClick={stopRecording}
        >
          <Square className="w-4 h-4" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={handleSend}
          disabled={!audioBlob || isUploading}
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      )}
    </div>
  );
}
