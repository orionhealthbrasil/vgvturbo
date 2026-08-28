import { useState, useMemo } from 'react';
import { Plus, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeadForms } from '@/hooks/useLeadForms';
import { FormCard } from '@/components/forms/FormCard';
import { FormBuilderDialog } from '@/components/forms/FormBuilderDialog';
import { FormSubmissionsDialog } from '@/components/forms/FormSubmissionsDialog';
import type { LeadForm } from '@/types/forms';

export default function Forms() {
  const { data: forms, isLoading } = useLeadForms();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<LeadForm | null>(null);
  const [submissionsForm, setSubmissionsForm] = useState<LeadForm | null>(null);

  const { actives, inactives } = useMemo(() => {
    const a: LeadForm[] = [];
    const i: LeadForm[] = [];
    (forms || []).forEach((f) => (f.is_active ? a.push(f) : i.push(f)));
    return { actives: a, inactives: i };
  }, [forms]);

  const openNew = () => {
    setEditing(null);
    setBuilderOpen(true);
  };

  const openEdit = (form: LeadForm) => {
    setEditing(form);
    setBuilderOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Formulários
          </h1>
          <p className="text-muted-foreground">
            Capture leads de qualquer site com formulários públicos.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Novo formulário
        </Button>
      </div>

      <Tabs defaultValue="actives">
        <TabsList>
          <TabsTrigger value="actives">Ativos ({actives.length})</TabsTrigger>
          <TabsTrigger value="inactives">Inativos ({inactives.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="actives" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          ) : actives.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Nenhum formulário ativo. Clique em "Novo formulário" para começar.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {actives.map((f) => (
                <FormCard
                  key={f.id}
                  form={f}
                  onEdit={openEdit}
                  onViewSubmissions={setSubmissionsForm}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inactives" className="mt-4">
          {inactives.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Nenhum formulário inativo.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inactives.map((f) => (
                <FormCard
                  key={f.id}
                  form={f}
                  onEdit={openEdit}
                  onViewSubmissions={setSubmissionsForm}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <FormBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        form={editing}
      />
      <FormSubmissionsDialog
        open={!!submissionsForm}
        onOpenChange={(o) => !o && setSubmissionsForm(null)}
        form={submissionsForm}
      />
    </div>
  );
}
