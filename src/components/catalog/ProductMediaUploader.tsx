import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, Upload, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductImage } from '@/hooks/useCatalog';

interface Props {
  organizationId: string;
  value: ProductImage[];
  onChange: (next: ProductImage[]) => void;
}

export function ProductMediaUploader({ organizationId, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const uploaded: ProductImage[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${organizationId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('catalog-media').upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        });
        if (error) throw error;
        const { data: pub } = supabase.storage.from('catalog-media').getPublicUrl(path);
        uploaded.push({ url: pub.publicUrl, position: value.length + uploaded.length });
      }
      onChange([...value, ...uploaded]);
    } catch (e: any) {
      toast.error('Erro ao enviar imagem', { description: e.message });
    } finally {
      setUploading(false);
    }
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...value];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next.map((img, i) => ({ ...img, position: i })));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {value.map((img, i) => (
          <div key={i} className="relative group rounded-md border overflow-hidden aspect-square bg-muted">
            <img src={img.url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button size="icon" variant="secondary" type="button" onClick={() => move(i, -1)} disabled={i === 0}>
                <GripVertical className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="destructive" type="button" onClick={() => remove(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            {i === 0 && (
              <span className="absolute top-1 left-1 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                Capa
              </span>
            )}
          </div>
        ))}
        <label className="border-2 border-dashed rounded-md aspect-square flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 text-muted-foreground">
          <Upload className="h-5 w-5 mb-1" />
          <span className="text-xs">{uploading ? 'Enviando...' : 'Adicionar'}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => upload(e.target.files)}
            disabled={uploading}
          />
        </label>
      </div>
    </div>
  );
}
