import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, X, RotateCcw, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface WebcamCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File, caption?: string) => void;
}

export function WebcamCaptureDialog({
  open,
  onOpenChange,
  onCapture,
}: WebcamCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL("image/jpeg", 0.9);
      setCapturedImage(imageData);
      stopCamera();
    }
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setCaption("");
    startCamera();
  }, [startCamera]);

  const handleSend = useCallback(() => {
    if (!capturedImage || !canvasRef.current) return;

    canvasRef.current.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: "image/jpeg" });
          onCapture(file, caption.trim() || undefined);
          handleClose();
        }
      },
      "image/jpeg",
      0.9
    );
  }, [capturedImage, caption, onCapture]);

  const handleClose = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setCaption("");
    setError(null);
    onOpenChange(false);
  }, [stopCamera, onOpenChange]);

  useEffect(() => {
    if (open && !capturedImage) {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [open, capturedImage, startCamera, stopCamera]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Capturar Foto
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {error ? (
            <div className="aspect-video bg-muted flex items-center justify-center p-6">
              <div className="text-center">
                <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{error}</p>
                <Button variant="outline" className="mt-4" onClick={startCamera}>
                  Tentar novamente
                </Button>
              </div>
            </div>
          ) : capturedImage ? (
            <div className="relative">
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full aspect-video object-contain bg-black"
              />
              <div className="p-4 space-y-3">
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Adicionar legenda (opcional)..."
                  rows={2}
                  className="resize-none"
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={retakePhoto}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Tirar outra
                  </Button>
                  <Button className="flex-1" onClick={handleSend}>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video object-cover bg-black"
              />
              {isStreaming && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <Button
                    size="lg"
                    className="rounded-full h-16 w-16 p-0"
                    onClick={capturePhoto}
                  >
                    <div className="h-12 w-12 rounded-full bg-background" />
                  </Button>
                </div>
              )}
              {!isStreaming && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
