import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Building2, Loader2, Plus, Sparkles, ArrowRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateOrganization } from '@/hooks/useOrganization';
import { useQueryClient } from '@tanstack/react-query';
import { useValidateInvite } from '@/hooks/useOrganizationInvites';
import { supabase } from '@/integrations/supabase/client';

const GlowOrb = ({ className = "" }: { className?: string }) => (
  <div
    aria-hidden
    className={`pointer-events-none absolute rounded-full blur-3xl opacity-60 ${className}`}
  />
);

const Grid = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]"
    style={{
      backgroundImage:
        "linear-gradient(to right, hsl(25 60% 50% / 0.08) 1px, transparent 1px), linear-gradient(to bottom, hsl(25 60% 50% / 0.08) 1px, transparent 1px)",
      backgroundSize: "48px 48px",
    }}
  />
);

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const createOrganization = useCreateOrganization();
  const [orgName, setOrgName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const inviteCode = searchParams.get('invite');
  const { data: inviteData, isLoading: isValidating } = useValidateInvite(inviteCode);

  // Without an owner invite, the user cannot create a new organization here.
  const ownerInviteValid = inviteData?.invite_type === 'owner';

  // If there's no invite at all, redirect to /auth (existing users still go to /dashboard from there).
  useEffect(() => {
    if (!inviteCode) {
      navigate('/auth', { replace: true });
    }
  }, [inviteCode, navigate]);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!orgName.trim()) {
      toast.error('Por favor, insira o nome da empresa');
      return;
    }

    if (!ownerInviteValid || !inviteCode) {
      toast.error('Convite inválido para criar empresa.');
      return;
    }

    setIsLoading(true);
    try {
      await createOrganization.mutateAsync(orgName.trim());

      // Consume the owner invite (best-effort)
      try {
        await supabase.rpc('consume_owner_invite', { p_invite_code: inviteCode });
      } catch (err) {
        console.error('Failed to consume owner invite:', err);
      }

      await queryClient.invalidateQueries({ queryKey: ['user-organization'] });
      await queryClient.refetchQueries({ queryKey: ['user-organization'] });

      toast.success('Empresa criada com sucesso!');
      navigate('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Error creating organization:', error);
      toast.error(`Erro ao criar empresa: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <Grid />
      <GlowOrb className="-top-40 -left-40 h-[420px] w-[420px] bg-orange-500/30" />
      <GlowOrb className="-bottom-32 -right-32 h-[480px] w-[480px] bg-sky-500/20" />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex flex-col items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/5 px-3 py-1 text-xs font-medium text-orange-300 backdrop-blur">
              <Sparkles className="h-3 w-3" />
              Configuração inicial
            </div>
            <h1 className="bg-gradient-to-r from-orange-300 via-orange-200 to-sky-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
              VGV Turbo
            </h1>
          </Link>

          <div className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-zinc-900/60 p-6 shadow-[0_0_60px_-15px_hsl(25_84%_45%/0.4)] backdrop-blur-xl sm:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/60 to-transparent" />

            {isValidating ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
              </div>
            ) : !ownerInviteValid ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-rose-400/10 ring-1 ring-rose-400/30">
                  <AlertTriangle className="h-5 w-5 text-rose-300" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Convite inválido</p>
                  <p className="mt-1 text-sm text-slate-400">
                    O link usado não é válido para criar uma nova empresa. Solicite um novo convite ao administrador.
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/auth')}
                  className="bg-orange-500 text-zinc-950 hover:bg-orange-400"
                >
                  Voltar para login
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400/20 to-sky-400/10 ring-1 ring-orange-400/30">
                    <Building2 className="h-5 w-5 text-orange-300" />
                  </div>
                  <h2 className="text-xl font-semibold text-white">Crie sua empresa</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Você poderá convidar membros e configurar tudo logo em seguida.
                  </p>
                </div>

                <form onSubmit={handleCreateOrganization} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-name" className="text-slate-300">Nome da empresa</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-400/70" />
                      <Input
                        id="org-name"
                        type="text"
                        placeholder="Ex: Minha Loja LTDA"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        className="border-zinc-800 bg-zinc-900/80 pl-10 text-white placeholder:text-slate-500 focus-visible:border-orange-500/50 focus-visible:ring-orange-500/20"
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="group w-full bg-orange-500 text-zinc-950 shadow-[0_0_30px_-5px_hsl(25_84%_45%/0.6)] hover:bg-orange-400"
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Criar empresa
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </form>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Após criar, você terá acesso a todas as ferramentas do VGV Turbo.
          </p>
        </div>
      </div>
    </div>
  );
}
