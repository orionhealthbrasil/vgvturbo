import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sticker, AlertCircle } from 'lucide-react';

interface AnimatedStickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AnimatedStickerDialog({ open, onOpenChange }: AnimatedStickerDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
              <Sticker className="w-6 h-6 text-accent-foreground" />
            </div>
            <AlertDialogTitle className="text-lg">
              Figurinha Animada
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left space-y-3">
            <p>
              Infelizmente não é possível salvar figurinhas animadas no momento.
            </p>
            <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                Por limitações técnicas da API do WhatsApp, apenas figurinhas estáticas podem ser salvas e reenviadas.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            Entendi
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
