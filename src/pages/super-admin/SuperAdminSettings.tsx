import { useEffect, useState } from 'react';
import { Eye, EyeOff, Save, Loader2, KeySquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlatformOpenAiKey, useUpdatePlatformOpenAiKey } from '@/hooks/useSuperAdmin';

export default function SuperAdminSettings() {
  const { data: persistedKey, isLoading } = usePlatformOpenAiKey();
  const updateKey = useUpdatePlatformOpenAiKey();

  const [localKey, setLocalKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setLocalKey(null);
  }, [persistedKey]);

  const displayKey = localKey !== null ? localKey : persistedKey || '';
  const hasUnsavedChanges = localKey !== null && localKey !== (persistedKey || '');

  const handleSave = () => {
    updateKey.mutate(displayKey || null, {
      onSuccess: () => setLocalKey(null),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">
          Configurações globais que afetam todas as organizações do sistema.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <KeySquare className="h-4 w-4" />
            Chave da OpenAI (plataforma)
          </CardTitle>
          <CardDescription className="text-xs">
            Usada por qualquer organização que não tenha sua própria chave configurada — é o caso padrão
            de toda organização nova sob o modelo de créditos VGVCash. Nunca é exibida a clientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={displayKey}
                  onChange={(e) => setLocalKey(e.target.value)}
                  placeholder="sk-..."
                  className="font-mono text-sm"
                />
                <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateKey.isPending || !hasUnsavedChanges}>
                  {updateKey.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {hasUnsavedChanges
                  ? 'Há alterações não salvas nesta chave.'
                  : persistedKey
                    ? 'Chave salva e ativa para toda a plataforma.'
                    : 'Nenhuma chave de plataforma configurada — organizações sem chave própria não terão IA funcional.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
