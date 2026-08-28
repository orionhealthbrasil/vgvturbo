import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ImagePlus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useCreateBroadcastCampaign, BroadcastCampaign } from '@/hooks/useBroadcast';
import { toast } from 'sonner';

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  message_content: z.string().min(1, 'Mensagem é obrigatória'),
  min_interval_minutes: z.number().min(5).max(15),
  max_interval_minutes: z.number().min(5).max(15),
  batch_size: z.number().min(10).max(30),
});

type FormValues = z.infer<typeof formSchema>;

interface NewCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (campaign: BroadcastCampaign) => void;
}

export function NewCampaignDialog({ open, onOpenChange, onSuccess }: NewCampaignDialogProps) {
  const createCampaign = useCreateBroadcastCampaign();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      message_content: '',
      min_interval_minutes: 5,
      max_interval_minutes: 15,
      batch_size: 20,
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Imagem muito grande. Máximo: 5MB');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      let mediaUrl: string | null = null;

      if (imageFile) {
        setIsUploading(true);
        const ext = imageFile.name.split('.').pop();
        const fileName = `broadcast/${Date.now()}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('chat-media')
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
        setIsUploading(false);
      }

      const result = await createCampaign.mutateAsync({
        name: values.name,
        message_content: values.message_content,
        media_url: mediaUrl,
        media_type: mediaUrl ? 'image' : null,
        min_interval_seconds: values.min_interval_minutes * 60,
        max_interval_seconds: values.max_interval_minutes * 60,
        batch_size: values.batch_size,
        batch_pause_min_seconds: 300,
        batch_pause_max_seconds: 600,
        messages_per_hour_limit: 30,
      });

      form.reset();
      removeImage();
      onSuccess(result);
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Nova Campanha</DialogTitle>
          <DialogDescription>
            Configure sua campanha de disparo em massa
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto flex-1 pr-1">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da campanha</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Promoção de Janeiro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message_content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensagem</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Digite sua mensagem..."
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Use {'{nome}'} para personalizar com o nome do contato
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Imagem (opcional)</Label>
              {imagePreview ? (
                <div className="relative w-32 h-32">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={removeImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center w-32 h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <div className="text-center">
                    <ImagePlus className="w-8 h-8 mx-auto text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Adicionar</span>
                  </div>
                </label>
              )}
            </div>

            {/* Interval Settings */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium text-sm">Configurações de Segurança</h4>
              
              <FormField
                control={form.control}
                name="min_interval_minutes"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm">Intervalo mínimo</FormLabel>
                      <span className="text-sm font-medium">{field.value} min</span>
                    </div>
                    <FormControl>
                      <Slider
                        value={[field.value]}
                        onValueChange={([v]) => {
                          field.onChange(v);
                          const max = form.getValues('max_interval_minutes');
                          if (v > max) form.setValue('max_interval_minutes', v);
                        }}
                        min={5}
                        max={15}
                        step={1}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_interval_minutes"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm">Intervalo máximo</FormLabel>
                      <span className="text-sm font-medium">{field.value} min</span>
                    </div>
                    <FormControl>
                      <Slider
                        value={[field.value]}
                        onValueChange={([v]) => {
                          field.onChange(v);
                          const min = form.getValues('min_interval_minutes');
                          if (v < min) form.setValue('min_interval_minutes', v);
                        }}
                        min={5}
                        max={15}
                        step={1}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="batch_size"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm">Tamanho do lote</FormLabel>
                      <span className="text-sm font-medium">{field.value} msgs</span>
                    </div>
                    <FormControl>
                      <Slider
                        value={[field.value]}
                        onValueChange={([v]) => field.onChange(v)}
                        min={10}
                        max={30}
                        step={5}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Pausa de 5-10min a cada lote
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createCampaign.isPending || isUploading}>
                {isUploading ? 'Enviando imagem...' : createCampaign.isPending ? 'Criando...' : 'Criar Campanha'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
