import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FormField } from '@/types/forms';

interface PublicFormRendererProps {
  fields: FormField[];
  primaryColor: string;
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (values: Record<string, any>, honeypot: string) => void | Promise<void>;
  preview?: boolean;
}

export function PublicFormRenderer({
  fields,
  primaryColor,
  submitting,
  submitLabel = 'Enviar',
  onSubmit,
  preview = false,
}: PublicFormRendererProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setValue = (key: string, v: any) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) return;
    const newErrors: Record<string, string> = {};
    fields.forEach((f) => {
      if (f.required) {
        const v = values[f.key];
        if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
          newErrors[f.key] = 'Campo obrigatório';
        }
      }
      if (f.type === 'email' && values[f.key]) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values[f.key]))) {
          newErrors[f.key] = 'E-mail inválido';
        }
      }
    });
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }
    await onSubmit(values, honeypot);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot - hidden from real users */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        <label>
          Não preencha este campo:
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            name="website_url"
          />
        </label>
      </div>

      {fields.map((f) => {
        const value = values[f.key] ?? (f.type === 'checkbox' ? false : '');
        const err = errors[f.key];
        return (
          <div key={f.key} className="space-y-1.5">
            {f.type !== 'checkbox' && (
              <Label className="text-sm font-medium">
                {f.label}
                {f.required && <span className="text-destructive ml-1">*</span>}
              </Label>
            )}
            {f.type === 'text' && (
              <Input
                value={value}
                placeholder={f.placeholder}
                onChange={(e) => setValue(f.key, e.target.value)}
              />
            )}
            {f.type === 'email' && (
              <Input
                type="email"
                value={value}
                placeholder={f.placeholder || 'voce@exemplo.com'}
                onChange={(e) => setValue(f.key, e.target.value)}
              />
            )}
            {f.type === 'phone' && (
              <Input
                type="tel"
                inputMode="tel"
                value={value}
                placeholder={f.placeholder || '(11) 91234-5678'}
                onChange={(e) => setValue(f.key, e.target.value)}
              />
            )}
            {f.type === 'number' && (
              <Input
                type="number"
                value={value}
                placeholder={f.placeholder}
                onChange={(e) => setValue(f.key, e.target.value)}
              />
            )}
            {f.type === 'textarea' && (
              <Textarea
                value={value}
                placeholder={f.placeholder}
                rows={4}
                onChange={(e) => setValue(f.key, e.target.value)}
              />
            )}
            {f.type === 'select' && (
              <Select value={value} onValueChange={(v) => setValue(f.key, v)}>
                <SelectTrigger>
                  <SelectValue placeholder={f.placeholder || 'Selecione...'} />
                </SelectTrigger>
                <SelectContent>
                  {(f.options || []).map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {f.type === 'checkbox' && (
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={!!value}
                  onCheckedChange={(c) => setValue(f.key, !!c)}
                />
                <span className="text-sm">
                  {f.label}
                  {f.required && <span className="text-destructive ml-1">*</span>}
                </span>
              </label>
            )}
            {err && <p className="text-xs text-destructive">{err}</p>}
          </div>
        );
      })}

      <Button
        type="submit"
        className="w-full"
        disabled={submitting || preview || fields.length === 0}
        style={{ backgroundColor: primaryColor, color: '#fff' }}
      >
        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
