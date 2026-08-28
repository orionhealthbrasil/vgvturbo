import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import { Building2, Loader2, UserPlus, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useValidateInvite, useJoinViaInvite } from '@/hooks/useOrganizationInvites';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/contexts/AuthContext';

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

export default function JoinOrganization() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams<{ inviteCode?: string }>();
  // Support both /join/:inviteCode (legacy) and ?invite=... (new)
  const inviteCode = params.inviteCode || searchParams.get('invite');

  const { user } = useAuth();
  const { data: inviteData, isLoading: isValidating, error: validateError } = useValidateInvite(inviteCode);
  const { data: existingOrg, isLoading: isCheckingOrg } = useUserOrganization();
  const joinOrganization = useJoinViaInvite();

  const [isJoining, setIsJoining] = useState(false);

  // Owner invite → redirect to /auth?invite=... (signup) or /onboarding if logged in
  useEffect(() => {
    if (!inviteData) return;
    if (inviteData.invite_type === 'owner') {
      if (user) {
        navigate(`/onboarding?invite=${inviteCode}`, { replace: true });
      } else {
        navigate(`/auth?invite=${inviteCode}`, { replace: true });
      }
    }
  }, [inviteData, user, inviteCode, navigate]);

  // Member invite + user has no org + not logged in → send to /auth?invite=...
  useEffect(() => {
    if (inviteData?.invite_type === 'member' && !user) {
      navigate(`/auth?invite=${inviteCode}`, { replace: true });
    }
  }, [inviteData, user, inviteCode, navigate]);

  // Already in an organization
  useEffect(() => {
    if (!isCheckingOrg && existingOrg && inviteData?.invite_type === 'member') {
      toast.info('Você já faz parte de uma organização');
      navigate('/dashboard');
    }
  }, [existingOrg, isCheckingOrg, inviteData, navigate]);

  const handleJoin = async () => {
    if (!inviteCode) return;

    setIsJoining(true);
    try {
      await joinOrganization.mutateAsync(inviteCode);
      toast.success('Você entrou na organização!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error joining:', error);
      toast.error('Erro ao entrar na organização. O convite pode ter expirado.');
    } finally {
      setIsJoining(false);
    }
  };

  const renderError = (msg: string) => (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <Grid />
      <GlowOrb className="-top-40 -left-40 h-[420px] w-[420px] bg-rose-500/20" />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex flex-col items-center gap-3">
            <h1 className="bg-gradient-to-r from-orange-300 via-orange-200 to-sky-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
              VGV Turbo
            </h1>
          </Link>
          <div className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-zinc-900/60 p-6 shadow-[0_0_60px_-15px_hsl(0_84%_50%/0.3)] backdrop-blur-xl sm:p-8">
            <div className="space-y-4 text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-rose-400/10 ring-1 ring-rose-400/30">
                <AlertCircle className="h-5 w-5 text-rose-300" />
              </div>
              <p className="text-sm text-slate-300">{msg}</p>
              <Button
                onClick={() => navigate('/auth')}
                className="bg-orange-500 text-zinc-950 hover:bg-orange-400"
              >
                Voltar para login
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!inviteCode) {
    return renderError('Link de convite inválido. Peça um novo link ao administrador.');
  }

  if (isValidating || isCheckingOrg) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-zinc-950">
        <Grid />
        <GlowOrb className="-top-40 -left-40 h-[420px] w-[420px] bg-orange-500/30" />
        <div className="relative flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
        </div>
      </div>
    );
  }

  if (validateError || !inviteData) {
    return renderError('Este convite é inválido ou expirou. Peça um novo link ao administrador.');
  }

  // Owner invite is being redirected by useEffect — render loader meanwhile
  if (inviteData.invite_type === 'owner') {
    return (
      <div className="relative min-h-screen overflow-hidden bg-zinc-950">
        <Grid />
        <div className="relative flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
        </div>
      </div>
    );
  }

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
              Você foi convidado
            </div>
            <h1 className="bg-gradient-to-r from-orange-300 via-orange-200 to-sky-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
              VGV Turbo
            </h1>
          </Link>

          <div className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-zinc-900/60 p-6 shadow-[0_0_60px_-15px_hsl(25_84%_45%/0.4)] backdrop-blur-xl sm:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/60 to-transparent" />

            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400/20 to-sky-400/10 ring-1 ring-orange-400/30">
                <Building2 className="h-5 w-5 text-orange-300" />
              </div>
              <p className="text-sm text-slate-400">Você foi convidado para fazer parte de</p>
              <p className="mt-2 text-2xl font-bold text-white">{inviteData.organization_name}</p>
            </div>

            <Button
              onClick={handleJoin}
              disabled={isJoining}
              size="lg"
              className="group w-full bg-orange-500 text-zinc-950 shadow-[0_0_30px_-5px_hsl(25_84%_45%/0.6)] hover:bg-orange-400"
            >
              {isJoining ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Aceitar convite
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>

            <p className="mt-4 text-center text-xs text-slate-500">
              Ao aceitar, você terá acesso aos dados e ferramentas da organização.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
