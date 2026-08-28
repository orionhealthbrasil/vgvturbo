import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { Loader2, Mail, Lock, User, Building2, ShieldCheck, Sparkles, ArrowRight, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useValidateInvite, useJoinViaInvite } from '@/hooks/useOrganizationInvites';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

const signUpSchema = z.object({
  fullName: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

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

interface LoginFormProps {
  loginEmail: string;
  setLoginEmail: (v: string) => void;
  loginPassword: string;
  setLoginPassword: (v: string) => void;
  loginErrors: Record<string, string>;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

function LoginForm({
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  loginErrors,
  isLoading,
  onSubmit,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email" className="text-slate-300">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-400/70" />
          <Input
            id="login-email"
            type="email"
            placeholder="seu@email.com"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            className="border-zinc-800 bg-zinc-900/80 pl-10 text-white placeholder:text-slate-500 focus-visible:border-orange-500/50 focus-visible:ring-orange-500/20"
          />
        </div>
        {loginErrors.email && (
          <p className="text-xs text-rose-400">{loginErrors.email}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-password" className="text-slate-300">Senha</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-400/70" />
          <Input
            id="login-password"
            type="password"
            placeholder="••••••••"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            className="border-zinc-800 bg-zinc-900/80 pl-10 text-white placeholder:text-slate-500 focus-visible:border-orange-500/50 focus-visible:ring-orange-500/20"
          />
        </div>
        {loginErrors.password && (
          <p className="text-xs text-rose-400">{loginErrors.password}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="group w-full bg-orange-500 text-zinc-950 shadow-[0_0_30px_-5px_hsl(25_84%_45%/0.6)] hover:bg-orange-400 hover:shadow-[0_0_40px_-5px_hsl(25_84%_45%/0.8)]"
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Acessar plataforma
        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Button>
    </form>
  );
}

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Invite handling
  const inviteCode = searchParams.get('invite');
  const { data: inviteData, isLoading: isValidatingInvite } = useValidateInvite(inviteCode);
  const joinViaInvite = useJoinViaInvite();

  const isOwnerInvite = inviteData?.invite_type === 'owner';
  const isMemberInvite = inviteData?.invite_type === 'member';
  const hasValidInvite = !!inviteData;
  const signupAllowed = hasValidInvite;

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});

  // Signup form
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [signUpErrors, setSignUpErrors] = useState<Record<string, string>>({});

  // Track if we need to join after auth
  const [pendingJoin, setPendingJoin] = useState(false);

  // Handle invite join after auth is confirmed
  useEffect(() => {
    const handleJoinOrganization = async () => {
      if (pendingJoin && user && inviteCode && inviteData) {
        // Owner invites: skip join, go straight to onboarding (will consume there)
        if (inviteData.invite_type === 'owner') {
          setPendingJoin(false);
          navigate(`/onboarding?invite=${inviteCode}`);
          return;
        }

        try {
          await joinViaInvite.mutateAsync(inviteCode);
          toast.success(`Você entrou em ${inviteData.organization_name}!`);
        } catch (error) {
          console.error('Error joining organization:', error);
          toast.error('Erro ao entrar na organização');
        } finally {
          setPendingJoin(false);
          navigate('/dashboard');
        }
      }
    };

    handleJoinOrganization();
  }, [pendingJoin, user, inviteCode, inviteData]);

  // Redirect if already logged in (without pending join)
  useEffect(() => {
    if (user && !pendingJoin) {
      if (inviteCode && inviteData) {
        setPendingJoin(true);
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, inviteCode, inviteData, pendingJoin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrors({});

    const result = loginSchema.safeParse({ email: loginEmail, password: loginPassword });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setLoginErrors(errors);
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      console.error('[Auth] Login error:', error.message, error);
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Credenciais inválidas. Verifique seu email e senha.');
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Por favor, confirme seu email antes de fazer login.');
      } else {
        toast.error(`Erro ao fazer login: ${error.message}`);
      }
      return;
    }

    toast.success('Login realizado com sucesso!');
    if (inviteCode && inviteData) {
      setPendingJoin(true);
    } else {
      navigate('/dashboard');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpErrors({});

    if (!signupAllowed) {
      toast.error('Cadastro disponível apenas via convite.');
      return;
    }

    const result = signUpSchema.safeParse({
      fullName: signUpName,
      email: signUpEmail,
      password: signUpPassword,
      confirmPassword: signUpConfirmPassword,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setSignUpErrors(errors);
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signUpEmail, signUpPassword, signUpName);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('User already registered')) {
        toast.error('Este email já está cadastrado. Tente fazer login.');
      } else if (error.message.includes('Password should be')) {
        toast.error('A senha não atende aos requisitos mínimos.');
      } else {
        toast.error('Erro ao criar conta. Tente novamente.');
      }
      return;
    }

    toast.success('Conta criada com sucesso!');
    if (inviteCode && inviteData) {
      setPendingJoin(true);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      {/* Background effects */}
      <Grid />
      <GlowOrb className="-top-40 -left-40 h-[420px] w-[420px] bg-orange-500/30" />
      <GlowOrb className="-bottom-32 -right-32 h-[480px] w-[480px] bg-sky-500/20" />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Brand */}
          <Link to="/" className="mb-8 flex flex-col items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/5 px-3 py-1 text-xs font-medium text-orange-300 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
              VGV Turbo Platform
            </div>
            <h1 className="bg-gradient-to-r from-orange-300 via-orange-200 to-sky-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
              VGV Turbo
            </h1>
            <p className="text-sm text-slate-400">
              Sistema operacional de vendas para imobiliárias
            </p>
          </Link>

          {/* Invite badge */}
          {hasValidInvite && (
            <div className="mb-4 rounded-2xl border border-orange-400/30 bg-orange-400/5 p-4 backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-orange-400/20 ring-1 ring-orange-400/30">
                  {isOwnerInvite ? (
                    <Sparkles className="h-4 w-4 text-orange-300" />
                  ) : (
                    <Building2 className="h-4 w-4 text-orange-300" />
                  )}
                </div>
                <div className="flex-1 text-sm">
                  {isOwnerInvite ? (
                    <>
                      <p className="font-semibold text-white">Convite para criar empresa</p>
                      <p className="text-slate-400">
                        Você tem permissão para criar uma nova empresa no VGV Turbo.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-white">
                        Convite para {inviteData?.organization_name}
                      </p>
                      <p className="text-slate-400">
                        Faça login ou crie sua conta para entrar.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Auth card */}
          <div className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-zinc-900/60 p-6 shadow-[0_0_60px_-15px_hsl(25_84%_45%/0.4)] backdrop-blur-xl sm:p-8">
            {/* card top gradient line */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/60 to-transparent" />

            {hasValidInvite ? (
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="mb-6 grid w-full grid-cols-2 bg-zinc-800/60 border border-zinc-800">
                  <TabsTrigger
                    value="login"
                    className="data-[state=active]:bg-orange-500 data-[state=active]:text-zinc-950 data-[state=active]:shadow-[0_0_20px_-5px_hsl(25_84%_45%/0.6)]"
                  >
                    Entrar
                  </TabsTrigger>
                  <TabsTrigger
                    value="signup"
                    className="data-[state=active]:bg-orange-500 data-[state=active]:text-zinc-950 data-[state=active]:shadow-[0_0_20px_-5px_hsl(25_84%_45%/0.6)]"
                  >
                    Cadastrar
                  </TabsTrigger>
                </TabsList>

                {/* Login (with invite) */}
                <TabsContent value="login" className="mt-0">
                  <LoginForm
                    loginEmail={loginEmail}
                    setLoginEmail={setLoginEmail}
                    loginPassword={loginPassword}
                    setLoginPassword={setLoginPassword}
                    loginErrors={loginErrors}
                    isLoading={isLoading}
                    onSubmit={handleLogin}
                  />
                </TabsContent>

                {/* Signup (with invite) */}
                <TabsContent value="signup" className="mt-0">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-slate-300">Nome completo</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-400/70" />
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="Seu nome"
                          value={signUpName}
                          onChange={(e) => setSignUpName(e.target.value)}
                          className="border-zinc-800 bg-zinc-900/80 pl-10 text-white placeholder:text-slate-500 focus-visible:border-orange-500/50 focus-visible:ring-orange-500/20"
                        />
                      </div>
                      {signUpErrors.fullName && (
                        <p className="text-xs text-rose-400">{signUpErrors.fullName}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-slate-300">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-400/70" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="seu@email.com"
                          value={signUpEmail}
                          onChange={(e) => setSignUpEmail(e.target.value)}
                          className="border-zinc-800 bg-zinc-900/80 pl-10 text-white placeholder:text-slate-500 focus-visible:border-orange-500/50 focus-visible:ring-orange-500/20"
                        />
                      </div>
                      {signUpErrors.email && (
                        <p className="text-xs text-rose-400">{signUpErrors.email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-slate-300">Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-400/70" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="••••••••"
                          value={signUpPassword}
                          onChange={(e) => setSignUpPassword(e.target.value)}
                          className="border-zinc-800 bg-zinc-900/80 pl-10 text-white placeholder:text-slate-500 focus-visible:border-orange-500/50 focus-visible:ring-orange-500/20"
                        />
                      </div>
                      {signUpErrors.password && (
                        <p className="text-xs text-rose-400">{signUpErrors.password}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm-password" className="text-slate-300">Confirmar senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-400/70" />
                        <Input
                          id="signup-confirm-password"
                          type="password"
                          placeholder="••••••••"
                          value={signUpConfirmPassword}
                          onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                          className="border-zinc-800 bg-zinc-900/80 pl-10 text-white placeholder:text-slate-500 focus-visible:border-orange-500/50 focus-visible:ring-orange-500/20"
                        />
                      </div>
                      {signUpErrors.confirmPassword && (
                        <p className="text-xs text-rose-400">{signUpErrors.confirmPassword}</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="group w-full bg-orange-500 text-zinc-950 shadow-[0_0_30px_-5px_hsl(25_84%_45%/0.6)] hover:bg-orange-400 hover:shadow-[0_0_40px_-5px_hsl(25_84%_45%/0.8)]"
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isOwnerInvite ? 'Criar conta e empresa' : 'Criar conta'}
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-4">
                <LoginForm
                  loginEmail={loginEmail}
                  setLoginEmail={setLoginEmail}
                  loginPassword={loginPassword}
                  setLoginPassword={setLoginPassword}
                  loginErrors={loginErrors}
                  isLoading={isLoading}
                  onSubmit={handleLogin}
                />

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-zinc-800" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-zinc-900/60 px-3 text-[11px] uppercase tracking-wider text-slate-500">
                      Ainda não tem conta?
                    </span>
                  </div>
                </div>

                <a
                  href="https://wa.me/5579991658966?text=Ol%C3%A1!%20Quero%20criar%20uma%20conta%20no%20VGV%20Turbo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex w-full items-center justify-center gap-2 rounded-md border border-orange-500/30 bg-orange-500/5 px-4 py-2.5 text-sm font-medium text-orange-300 transition-all hover:border-orange-400/60 hover:bg-orange-500/10 hover:text-orange-200"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Criar conta
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Ao continuar, você concorda em operar com responsabilidade dentro da sua empresa.
          </p>
        </div>
      </div>
    </div>
  );
}
