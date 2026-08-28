import { Link } from "react-router-dom";
import { useMemo, useRef, useEffect, useCallback, useState } from "react";
import {
  motion,
  useInView,
  animate,
  useMotionValue,
  useSpring,
  useTransform,
  useScroll,
  AnimatePresence,
  MotionConfig,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { VGVTurboLogo } from "@/components/brand/VGVTurboLogo";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  MessageSquare,
  Bot,
  BarChart3,
  Users,
  Clock,
  ArrowRight,
  Filter,
  Shield,
  Zap,
  Sparkles,
  Workflow,
  Calendar,
  Target,
  Mic,
  Image as ImageIcon,
  Headphones,
  Megaphone,
  Eye,
  CheckCircle2,
  Activity,
  Star,
  TrendingUp,
  Rocket,
  ChevronDown,
  Mail,
  Instagram,
} from "lucide-react";

const WHATSAPP_URL =
  "https://wa.me/5579991658966?text=Ol%C3%A1!%20Quero%20conhecer%20o%20VGV%20Turbo";

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 32, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const stagger = (delay = 0.07) => ({
  hidden: {},
  visible: { transition: { staggerChildren: delay, delayChildren: 0.05 } },
});

// Apple-style line reveal — surge de baixo com blur
const lineReveal = {
  hidden: { opacity: 0, y: "0.6em", filter: "blur(12px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const slideLeft = {
  hidden: { opacity: 0, x: -48, filter: "blur(6px)" },
  visible: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as const } },
};

const slideRight = {
  hidden: { opacity: 0, x: 48, filter: "blur(6px)" },
  visible: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as const } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92, filter: "blur(6px)" },
  visible: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const } },
};

// Variantes mobile — sem filter:blur (caro na GPU do iOS)
const fadeUpM = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};
const lineRevealM = {
  hidden: { opacity: 0, y: "0.4em" },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};
const slideLeftM = {
  hidden: { opacity: 0, x: -28 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};
const slideRightM = {
  hidden: { opacity: 0, x: 28 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};
const scaleInM = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

// ── Starfield (parallax) ──────────────────────────────────────────────────────

type StarLayer = { id: number; top: number; left: number; size: number; delay: number; duration: number }[];

function makeStars(n: number): StarLayer {
  return Array.from({ length: n }).map((_, i) => ({
    id: i,
    top: Math.random() * 100,
    left: Math.random() * 100,
    size: Math.random() > 0.85 ? 2.5 : Math.random() > 0.5 ? 1.6 : 1,
    delay: Math.random() * 6,
    duration: 3 + Math.random() * 5,
  }));
}

const StarLayerEl = ({
  stars,
  y,
  opacity,
}: {
  stars: StarLayer;
  y: ReturnType<typeof useTransform>;
  opacity: number;
}) => (
  <motion.div style={{ y }} className="absolute inset-0">
    {stars.map((s) => (
      <span
        key={s.id}
        className="absolute rounded-full bg-white animate-twinkle motion-reduce:animate-none"
        style={{
          top: `${s.top}%`,
          left: `${s.left}%`,
          width: s.size,
          height: s.size,
          opacity,
          animationDelay: `${s.delay}s`,
          animationDuration: `${s.duration}s`,
        }}
      />
    ))}
  </motion.div>
);

const Starfield = ({ density = 1 }: { density?: number }) => {
  const isMobile = useIsMobile();
  const { scrollY } = useScroll();
  const yFar = useTransform(scrollY, [0, 4000], [0, -120]);
  const yMid = useTransform(scrollY, [0, 4000], [0, -320]);
  const yNear = useTransform(scrollY, [0, 4000], [0, -640]);

  const far = useMemo(() => makeStars(Math.round(70 * density)), [density]);
  const mid = useMemo(() => makeStars(Math.round(45 * density)), [density]);
  const near = useMemo(() => makeStars(Math.round(25 * density)), [density]);

  if (isMobile) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <StarLayerEl stars={far} y={yFar} opacity={0.5} />
      <StarLayerEl stars={mid} y={yMid} opacity={0.7} />
      <StarLayerEl stars={near} y={yNear} opacity={0.95} />
    </div>
  );
};

// ── Shooting stars ────────────────────────────────────────────────────────────

const ShootingStars = ({ count = 10 }: { count?: number }) => {
  const meteors = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        top: Math.random() * 55,
        left: 15 + Math.random() * 80,
        delay: Math.random() * 9,
        duration: 4 + Math.random() * 3.5,
        width: 90 + Math.random() * 100,
      })),
    [count]
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
      {meteors.map((m) => (
        <span
          key={m.id}
          className="absolute h-px rounded-full bg-gradient-to-r from-transparent via-white/60 to-white animate-shooting"
          style={{
            top: `${m.top}%`,
            left: `${m.left}%`,
            width: m.width,
            opacity: 0,
            animationDelay: `${m.delay}s`,
            animationDuration: `${m.duration}s`,
            animationFillMode: "both",
            filter: "drop-shadow(0 0 6px rgba(255,255,255,0.7))",
          }}
        />
      ))}
    </div>
  );
};

// Belt dots — três estrelas, usado como assinatura da marca nos pills
const BeltDots = () => (
  <span className="inline-flex items-center gap-1">
    <span className="h-1 w-1 rounded-full bg-orange-400/60" />
    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
    <span className="h-1 w-1 rounded-full bg-sky-400/60" />
  </span>
);

// ── Cursor glow ───────────────────────────────────────────────────────────────

const CursorGlow = () => {
  const [pos, setPos] = useState({ x: -999, y: -999 });
  useEffect(() => {
    const fn = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", fn);
    return () => window.removeEventListener("mousemove", fn);
  }, []);
  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 hidden lg:block"
      style={{
        background: `radial-gradient(640px circle at ${pos.x}px ${pos.y}px, rgba(251,146,60,0.05), transparent 40%)`,
        transition: "background 0.1s",
      }}
    />
  );
};

// ── Animated counter ──────────────────────────────────────────────────────────

function AnimatedNumber({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const ctrl = animate(0, to, {
      duration: 1.8,
      ease: [0.22, 1, 0.36, 1] as const,
      onUpdate(v) {
        if (ref.current) ref.current.textContent = Math.round(v) + suffix;
      },
    });
    return () => ctrl.stop();
  }, [inView, to, suffix]);
  return <span ref={ref}>0{suffix}</span>;
}

// ── Magnetic button ───────────────────────────────────────────────────────────

const MagneticButton = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 20 });
  const sy = useSpring(y, { stiffness: 200, damping: 20 });

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * 0.35);
    y.set((e.clientY - r.top - r.height / 2) * 0.35);
  }, [x, y]);

  const onLeave = useCallback(() => { x.set(0); y.set(0); }, [x, y]);

  return (
    <motion.div style={{ x: sx, y: sy }} onMouseMove={onMove} onMouseLeave={onLeave} className={className}>
      {children}
    </motion.div>
  );
};

// ── 3-D tilt hook ─────────────────────────────────────────────────────────────

function useTilt() {
  const isMobile = useIsMobile();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotX = useSpring(useTransform(py, [-0.5, 0.5], [9, -9]), { stiffness: 300, damping: 30 });
  const rotY = useSpring(useTransform(px, [-0.5, 0.5], [-9, 9]), { stiffness: 300, damping: 30 });

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (isMobile) return;
      const r = e.currentTarget.getBoundingClientRect();
      px.set((e.clientX - r.left) / r.width - 0.5);
      py.set((e.clientY - r.top) / r.height - 0.5);
    },
    [px, py, isMobile]
  );

  const onMouseLeave = useCallback(() => {
    if (isMobile) return;
    px.set(0);
    py.set(0);
  }, [px, py, isMobile]);

  return { rotX, rotY, onMouseMove, onMouseLeave };
}

// ── Phone mockup ──────────────────────────────────────────────────────────────

type ChatStep =
  | { type: "user" | "ai"; text: string }
  | { type: "typing"; ms: number };

const CHAT_STEPS: ChatStep[] = [
  { type: "user", text: "Oi! Vi o apê de 2 quartos no Centro, ainda tá disponível?" },
  { type: "typing", ms: 1100 },
  { type: "ai", text: "Olá! Sim, ainda está disponível 🏠 Posso agendar uma visita? Tenho quarta às 10h ou sexta às 15h." },
  { type: "user", text: "Quarta às 10h, por favor!" },
  { type: "typing", ms: 900 },
  { type: "ai", text: "Confirmado. ✅ Envio a localização e um lembrete amanhã às 8h pelo WhatsApp." },
  { type: "user", text: "Perfeito, muito obrigada!" },
  { type: "typing", ms: 700 },
  { type: "ai", text: "À disposição. Até quarta! 👋" },
];

function usePhoneAnimation() {
  const [messages, setMessages] = useState<{ from: "user" | "ai"; text: string }[]>([]);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const ids: ReturnType<typeof setTimeout>[] = [];

    function run() {
      setMessages([]);
      setTyping(false);
      let delay = 800;

      for (const step of CHAT_STEPS) {
        if (step.type === "typing") {
          const d = delay;
          const ms = step.ms;
          ids.push(setTimeout(() => setTyping(true), d));
          ids.push(setTimeout(() => setTyping(false), d + ms));
          delay += ms + 150;
        } else {
          const d = delay;
          const from = step.type;
          const text = step.text;
          ids.push(setTimeout(() => setMessages((m) => [...m, { from, text }]), d));
          delay += 700;
        }
      }

      ids.push(setTimeout(run, delay + 3500));
    }

    ids.push(setTimeout(run, 600));
    return () => ids.forEach(clearTimeout);
  }, []);

  return { messages, typing };
}

const PhoneMockup = () => {
  const { messages, typing } = usePhoneAnimation();
  const chatRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { rotX, rotY, onMouseMove, onMouseLeave } = useTilt();

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, typing]);

  return (
    <motion.div
      style={isMobile ? undefined : { rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
      onMouseMove={isMobile ? undefined : onMouseMove}
      onMouseLeave={isMobile ? undefined : onMouseLeave}
      className="relative mx-auto w-[260px] cursor-default select-none"
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
    >
      {/* Glow behind phone */}
      <div className="absolute -inset-10 rounded-full bg-orange-500/25 blur-3xl" />
      <div className="absolute -inset-6 rounded-full bg-sky-500/10 blur-2xl" />

      {/* Animated gradient ring */}
      <div className="absolute -inset-[2px] overflow-hidden rounded-[42px]">
        <div
          className={`absolute inset-0 ${isMobile ? "" : "animate-gradient-spin motion-reduce:animate-none"}`}
          style={{
            background:
              "conic-gradient(from 0deg, transparent 60%, rgba(251,146,60,0.7) 80%, rgba(56,189,248,0.5) 100%)",
          }}
        />
      </div>

      {/* Phone frame */}
      <div className="relative rounded-[40px] border border-white/10 bg-zinc-900 p-[5px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="relative overflow-hidden rounded-[35px]" style={{ height: 540 }}>
          {/* Notch */}
          <div className="absolute left-1/2 top-0 z-10 h-6 w-24 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />

          {/* WA header */}
          <div className="bg-[#1f2c34] px-4 pb-3 pt-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-sky-400 text-[10px] font-bold text-orange-900">
                VT
              </div>
              <div>
                <p className="text-xs font-semibold text-white">VGV Turbo IA</p>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                  <p className="text-[9px] text-orange-300">Online agora</p>
                </div>
              </div>
            </div>
          </div>

          {/* Chat area */}
          <div
            ref={chatRef}
            className="flex flex-col gap-1.5 overflow-y-auto bg-[#0b141a] px-3 py-3 [scrollbar-width:none]"
            style={{ height: 432 }}
          >
            {messages.map((msg, i) => (
              <motion.div
                key={`${i}-${msg.text.slice(0, 8)}`}
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }}
                className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] rounded-lg px-2.5 py-1.5 text-[11px] leading-snug ${
                    msg.from === "user"
                      ? "rounded-tr-[3px] bg-[#005c4b] text-white"
                      : "rounded-tl-[3px] bg-[#202c33] text-white/90"
                  }`}
                >
                  {msg.text}
                  <span className="ml-1.5 text-[8px] text-white/30">
                    {msg.from === "ai" ? "14:32 · IA" : "14:32"}
                  </span>
                </div>
              </motion.div>
            ))}

            <AnimatePresence>
              {typing && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="flex justify-start"
                >
                  <div className="rounded-lg rounded-tl-[3px] bg-[#202c33] px-3 py-2">
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-white/50 animate-bounce-dot"
                          style={{ animationDelay: `${i * 0.18}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input bar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 border-t border-white/5 bg-[#0b141a] px-3 py-2">
            <div className="flex-1 rounded-full bg-[#2a3942] px-3 py-1.5">
              <span className="text-[10px] text-white/20">Mensagem</span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500">
              <ArrowRight className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.4, duration: 0.5 }}
        className="absolute -right-14 top-16 z-10"
      >
        <div className="flex items-center gap-1.5 rounded-full border border-orange-400/20 bg-slate-900 px-2.5 py-1.5 shadow-lg">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
          <span className="whitespace-nowrap text-[10px] font-medium text-orange-300">IA ativa</span>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 2.2, duration: 0.5 }}
        className="absolute -left-20 bottom-28 z-10"
      >
        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-900 px-2.5 py-1.5 shadow-lg">
          <CheckCircle2 className="h-3 w-3 text-orange-400" />
          <span className="whitespace-nowrap text-[10px] font-medium text-white/70">Visita marcada</span>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3.0, duration: 0.5 }}
        className="absolute -right-12 bottom-20 z-10"
      >
        <div className="flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-slate-900 px-2.5 py-1.5 shadow-lg">
          <TrendingUp className="h-3 w-3 text-sky-400" />
          <span className="whitespace-nowrap text-[10px] font-medium text-sky-300">+1 agendamento</span>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Marquee strip ─────────────────────────────────────────────────────────────

const MARQUEE_ITEMS = [
  { icon: Zap, text: "Respostas em segundos" },
  { icon: Calendar, text: "Agendamento automático" },
  { icon: Bot, text: "IA treinada na sua operação" },
  { icon: Activity, text: "98% de taxa de resposta" },
  { icon: Filter, text: "Funil organizado sozinho" },
  { icon: Shield, text: "Zero leads esquecidos" },
  { icon: Megaphone, text: "Campanhas em segurança" },
  { icon: Mic, text: "Áudio, foto e vídeo compreendidos" },
];

const MarqueeStrip = () => (
  <div className="overflow-hidden border-y border-white/5 py-3 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
    <div className="flex w-max animate-marquee gap-10">
      {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
        <div key={i} className="flex items-center gap-2.5 whitespace-nowrap text-sm text-slate-400">
          <item.icon className="h-3.5 w-3.5 flex-shrink-0 text-orange-400" />
          {item.text}
          <span className="ml-4 h-px w-6 bg-white/10" />
        </div>
      ))}
    </div>
  </div>
);

// Divisor de seção — três estrelas ao centro
const SectionDivider = () => {
  const isMobile = useIsMobile();
  return (
  <motion.div
    initial={isMobile ? false : "hidden"}
    whileInView={isMobile ? undefined : "visible"}
    viewport={isMobile ? undefined : { once: true }}
    variants={isMobile ? undefined : fadeUp}
    className="mx-auto flex max-w-sm items-center gap-4 px-6 py-4"
  >
    <span className="h-px flex-1 bg-gradient-to-r from-transparent to-orange-400/25" />
    <BeltDots />
    <span className="h-px flex-1 bg-gradient-to-l from-transparent to-orange-400/25" />
  </motion.div>
  );
};

// ── Ambient helpers ───────────────────────────────────────────────────────────

const GlowOrb = ({ className = "" }: { className?: string }) => (
  <div className={`pointer-events-none absolute rounded-full blur-3xl opacity-50 ${className}`} />
);

// Aurora — gradientes em movimento lento no fundo
const Aurora = ({ mobile = false }: { mobile?: boolean }) => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    <div
      className={`absolute left-[6%] top-[4%] h-[44vw] w-[44vw] rounded-full bg-orange-500/12 ${mobile ? "" : "animate-aurora motion-reduce:animate-none"}`}
      style={{ filter: `blur(${mobile ? 70 : 130}px)` }}
    />
    <div
      className={`absolute right-[2%] top-[26%] h-[36vw] w-[36vw] rounded-full bg-sky-500/10 ${mobile ? "" : "animate-aurora motion-reduce:animate-none"}`}
      style={{ filter: `blur(${mobile ? 60 : 130}px)`, ...(mobile ? {} : { animationDelay: "-7s" }) }}
    />
    <div
      className={`absolute bottom-[0%] left-[28%] h-[32vw] w-[32vw] rounded-full bg-indigo-500/10 ${mobile ? "" : "animate-aurora motion-reduce:animate-none"}`}
      style={{ filter: `blur(${mobile ? 55 : 130}px)`, ...(mobile ? {} : { animationDelay: "-13s" }) }}
    />
  </div>
);

// Sistema orbital — canais e mídias girando ao redor do núcleo de IA
const ORBIT_OUTER = [
  { icon: MessageSquare, label: "WhatsApp", cls: "bg-orange-500/15 text-orange-300 ring-orange-400/30" },
  { icon: Instagram, label: "Instagram", cls: "bg-pink-500/15 text-pink-300 ring-pink-400/30" },
  { icon: Mail, label: "E-mail", cls: "bg-sky-500/15 text-sky-300 ring-sky-400/30" },
  { icon: Star, label: "Avaliações", cls: "bg-amber-500/15 text-amber-300 ring-amber-400/30" },
];

const ORBIT_INNER = [
  { icon: Mic, cls: "bg-sky-500/15 text-sky-300 ring-sky-400/30" },
  { icon: ImageIcon, cls: "bg-orange-500/15 text-orange-300 ring-orange-400/30" },
  { icon: Headphones, cls: "bg-sky-500/15 text-sky-300 ring-sky-400/30" },
];

const OrbitalSystem = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-sky-500 shadow-[0_0_40px_-5px_rgba(251,146,60,0.6)]">
          <Bot className="h-8 w-8 text-orange-950" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {ORBIT_OUTER.map((c) => (
            <div key={c.label} className={`flex items-center gap-2.5 rounded-2xl p-3 ring-1 ${c.cls}`}>
              <c.icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
  <div className="relative mx-auto aspect-square w-full max-w-[440px]">
    {/* glow central */}
    <div className="absolute inset-[14%] rounded-full bg-orange-500/15 blur-3xl" />

    {/* anéis */}
    <div className="absolute inset-0 rounded-full border border-white/[0.07]" />
    <div className="absolute inset-[20%] rounded-full border border-dashed border-white/[0.06]" />

    {/* órbita externa — canais */}
    {ORBIT_OUTER.map((c, i) => (
      <div
        key={c.label}
        className="absolute inset-0 animate-orbit-slow motion-reduce:animate-none"
        style={{ animationDelay: `${-(30 / ORBIT_OUTER.length) * i}s` }}
      >
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
          <div
            className="animate-orbit-slow-rev motion-reduce:animate-none"
            style={{ animationDelay: `${-(30 / ORBIT_OUTER.length) * i}s` }}
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 backdrop-blur-sm ${c.cls}`}>
              <c.icon className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>
    ))}

    {/* órbita interna — mídias (sentido contrário) */}
    {ORBIT_INNER.map((c, i) => (
      <div
        key={i}
        className="absolute inset-[20%] animate-orbit-mid-rev motion-reduce:animate-none"
        style={{ animationDelay: `${-(22 / ORBIT_INNER.length) * i}s` }}
      >
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
          <div
            className="animate-orbit-mid motion-reduce:animate-none"
            style={{ animationDelay: `${-(22 / ORBIT_INNER.length) * i}s` }}
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 backdrop-blur-sm ${c.cls}`}>
              <c.icon className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    ))}

    {/* núcleo de IA */}
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <div className="relative">
        <span className="absolute inset-0 animate-ping rounded-full bg-orange-400/20" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-sky-500 shadow-[0_0_50px_-5px_rgba(251,146,60,0.7)]">
          <Bot className="h-9 w-9 text-orange-950" />
        </div>
      </div>
    </div>
  </div>
  );
};

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2.5 rounded-full border border-orange-400/20 bg-orange-400/5 px-3.5 py-1 text-xs font-medium text-orange-300 backdrop-blur">
    <BeltDots />
    {children}
  </span>
);

// ── Bento feature card (tilt + spotlight) ─────────────────────────────────────

const BentoCard = ({
  icon: Icon,
  title,
  description,
  featured = false,
  accentColor = "emerald",
  children,
  className = "",
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  featured?: boolean;
  accentColor?: "emerald" | "cyan" | "purple";
  children?: React.ReactNode;
  className?: string;
}) => {
  const isMobile = useIsMobile();
  const { rotX, rotY, onMouseMove, onMouseLeave } = useTilt();

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      onMouseMove(e as React.MouseEvent<HTMLElement>);
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty("--sx", `${e.clientX - r.left}px`);
      e.currentTarget.style.setProperty("--sy", `${e.clientY - r.top}px`);
    },
    [onMouseMove]
  );

  const colors = {
    emerald: { ring: "from-orange-400/20 to-orange-400/5 ring-orange-400/30", text: "text-orange-300", glow: "hsl(25 70% 50% / 0.12)" },
    cyan: { ring: "from-sky-400/20 to-sky-400/5 ring-sky-400/30", text: "text-sky-300", glow: "hsl(199 70% 50% / 0.12)" },
    purple: { ring: "from-purple-400/20 to-purple-400/5 ring-purple-400/30", text: "text-purple-300", glow: "hsl(270 70% 60% / 0.12)" },
  }[accentColor];

  return (
    <motion.div
      variants={isMobile ? fadeUpM : fadeUp}
      style={isMobile ? undefined : { rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
      onMouseMove={isMobile ? undefined : handleMouseMove}
      onMouseLeave={isMobile ? undefined : onMouseLeave}
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-colors hover:border-white/[0.12] ${isMobile ? "" : "backdrop-blur-sm"} ${featured ? "p-7" : "p-5"} ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(380px circle at var(--sx, 50%) var(--sy, 50%), ${colors.glow}, transparent 40%)`,
        }}
      />
      <div className="relative" style={isMobile ? undefined : { transform: "translateZ(10px)" }}>
        <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ${colors.ring}`}>
          <Icon className={`h-[18px] w-[18px] ${colors.text}`} />
        </div>
        <h3 className={`mb-1.5 font-semibold text-white ${featured ? "text-xl" : "text-base"}`}>{title}</h3>
        <p className={`leading-relaxed text-slate-400 ${featured ? "text-sm" : "text-xs"}`}>{description}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </motion.div>
  );
};

// ── Stats section ─────────────────────────────────────────────────────────────

const STATS = [
  { value: 47, suffix: "s", label: "Tempo médio de resposta da IA" },
  { prefix: "24", suffix: "/7", label: "Operação ativa, sem interrupções", raw: true },
  { value: 3, suffix: "×", label: "Mais conversões com follow-up automático" },
  { value: 0, suffix: "", label: "Leads perdidos por falta de resposta" },
];

const StatsSection = () => {
  const isMobile = useIsMobile();
  return (
  <section className="relative border-y border-white/5 py-16">
    <div className="mx-auto max-w-7xl px-6">
      <motion.div
        initial={isMobile ? false : "hidden"}
        whileInView={isMobile ? undefined : "visible"}
        viewport={isMobile ? undefined : { once: true, margin: "-60px" }}
        variants={isMobile ? undefined : stagger(0.1)}
        className="grid grid-cols-2 gap-8 md:grid-cols-4"
      >
        {STATS.map((s, i) => (
          <motion.div key={i} variants={isMobile ? undefined : fadeUp} className="text-center">
            <p className="text-4xl font-bold tracking-tight text-white md:text-5xl">
              {s.raw ? (
                <span>{s.prefix}<span className="text-orange-400">{s.suffix}</span></span>
              ) : (
                <>
                  <AnimatedNumber to={s.value!} />
                  <span className="text-orange-400">{s.suffix}</span>
                </>
              )}
            </p>
            <p className="mt-2 text-xs leading-snug text-slate-500">{s.label}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
  );
};

// ── Testimonials ──────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    name: "Rafael C.",
    role: "Corretor de Imóveis",
    avatar: "RC",
    text: "A IA agendou 14 visitas enquanto eu estava atendendo outro cliente. Quando terminei, minha semana já estava lotada.",
  },
  {
    name: "João Mendes",
    role: "Diretor de Imobiliária",
    avatar: "JM",
    text: "Meu time descansou no feriado e nenhum lead foi perdido. A IA conduziu tudo como se fosse um corretor.",
  },
  {
    name: "Ana Paula R.",
    role: "Corretora Autônoma",
    avatar: "AP",
    text: "Um cliente elogiou: 'sua atendente é muito atenciosa'. Ele falou com a IA o tempo todo e nem percebeu.",
  },
];

const TestimonialsSection = () => {
  const isMobile = useIsMobile();
  return (
  <section className="relative py-24">
    <GlowOrb className="-left-40 top-1/2 h-80 w-80 bg-purple-500/10" />
    <GlowOrb className="-right-40 top-1/3 h-80 w-80 bg-orange-500/10" />
    <div className="mx-auto max-w-7xl px-6">
      <motion.div
        initial={isMobile ? false : "hidden"}
        whileInView={isMobile ? undefined : "visible"}
        viewport={isMobile ? undefined : { once: true, margin: "-60px" }}
        variants={isMobile ? undefined : stagger(0.1)}
        className="mb-12 text-center"
      >
        <motion.div variants={isMobile ? undefined : fadeUp}><Pill>Quem já opera com a VGV Turbo</Pill></motion.div>
        <motion.h2 variants={isMobile ? undefined : fadeUp} className="mt-6 text-3xl font-bold tracking-tight text-white md:text-4xl">
          Resultados que nossos clientes{" "}
          <span className="bg-gradient-to-r from-orange-300 to-sky-300 bg-clip-text text-transparent">
            já enxergam
          </span>
        </motion.h2>
      </motion.div>

      <motion.div
        initial={isMobile ? false : "hidden"}
        whileInView={isMobile ? undefined : "visible"}
        viewport={isMobile ? undefined : { once: true, margin: "-60px" }}
        variants={isMobile ? undefined : stagger(0.1)}
        className="grid gap-4 md:grid-cols-3"
      >
        {TESTIMONIALS.map((t, i) => (
          <motion.div
            key={i}
            variants={isMobile ? undefined : scaleIn}
            className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 ${isMobile ? "" : "backdrop-blur-sm"}`}
          >
            <div className="mb-4 flex gap-0.5">
              {Array.from({ length: 5 }).map((_, s) => (
                <Star key={s} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="mb-6 text-sm leading-relaxed text-slate-300">"{t.text}"</p>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400/30 to-sky-400/20 text-xs font-bold text-white ring-1 ring-white/10">
                {t.avatar}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{t.name}</p>
                <p className="text-xs text-slate-500">{t.role}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
  );
};

// ── ToolBlock ─────────────────────────────────────────────────────────────────

const ToolBlock = ({
  icon: Icon,
  tag,
  title,
  description,
  bullets,
  visual,
  reversed = false,
}: {
  icon: React.ElementType;
  tag: string;
  title: string;
  description: string;
  bullets: string[];
  visual: React.ReactNode;
  reversed?: boolean;
}) => {
  const isMobile = useIsMobile();
  const sL = isMobile ? slideLeftM : slideLeft;
  const sR = isMobile ? slideRightM : slideRight;
  return (
  <motion.div
    initial={isMobile ? false : "hidden"}
    whileInView={isMobile ? undefined : "visible"}
    viewport={isMobile ? undefined : { once: true, margin: "-80px" }}
    variants={isMobile ? undefined : stagger(0.1)}
    className={`grid items-center gap-12 lg:grid-cols-2 ${reversed ? "lg:[&>*:first-child]:order-2" : ""}`}
  >
    <motion.div variants={isMobile ? undefined : (reversed ? sR : sL)}>
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/5 px-3 py-1 text-xs font-medium text-orange-300">
        <Icon className="h-3.5 w-3.5" />
        {tag}
      </div>
      <h3 className="mb-4 text-3xl font-bold tracking-tight text-white md:text-4xl">{title}</h3>
      <p className="mb-6 text-lg leading-relaxed text-slate-400">{description}</p>
      <ul className="space-y-3">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-3 text-slate-300">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-400" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </motion.div>
    <motion.div variants={isMobile ? undefined : (reversed ? sL : sR)} className="relative">
      <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-orange-500/15 via-sky-500/8 to-transparent blur-2xl" />
      <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-6 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)] ${isMobile ? "" : "backdrop-blur-xl"}`}>
        {visual}
      </div>
    </motion.div>
  </motion.div>
  );
};

// ── Mobile phone card (sem Framer Motion) ────────────────────────────────────

const MobilePhoneCard = () => {
  const { messages, typing } = usePhoneAnimation();
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, typing]);

  return (
    <div className="relative mx-auto w-[240px]">
      <div className="absolute -inset-8 rounded-full bg-orange-500/20" style={{ filter: "blur(60px)" }} />
      <div className="relative rounded-[36px] border border-white/10 bg-zinc-900 p-[4px] shadow-[0_30px_60px_-10px_rgba(0,0,0,0.9)]">
        <div className="relative overflow-hidden rounded-[32px]" style={{ height: 460 }}>
          <div className="absolute left-1/2 top-0 z-10 h-5 w-20 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />
          <div className="bg-[#1f2c34] px-3 pb-2 pt-7">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-sky-400 text-[9px] font-bold text-orange-900">VT</div>
              <div>
                <p className="text-[11px] font-semibold text-white">VGV Turbo IA</p>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                  <p className="text-[9px] text-orange-300">Online agora</p>
                </div>
              </div>
            </div>
          </div>
          <div ref={chatRef} className="flex flex-col gap-1.5 overflow-y-hidden bg-[#0b141a] px-3 py-3" style={{ height: 372 }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-lg px-2.5 py-1.5 text-[11px] leading-snug ${msg.from === "user" ? "rounded-tr-[3px] bg-[#005c4b] text-white" : "rounded-tl-[3px] bg-[#202c33] text-white/90"}`}>
                  {msg.text}
                  <span className="ml-1 text-[8px] text-white/30">{msg.from === "ai" ? "14:32 · IA" : "14:32"}</span>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="rounded-lg rounded-tl-[3px] bg-[#202c33] px-3 py-2">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/50 animate-bounce-dot" style={{ animationDelay: `${i * 0.18}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 border-t border-white/5 bg-[#0b141a] px-3 py-2">
            <div className="flex-1 rounded-full bg-[#2a3942] px-3 py-1.5">
              <span className="text-[10px] text-white/20">Mensagem</span>
            </div>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500">
              <ArrowRight className="h-3 w-3 text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Mobile Landing (sem Framer Motion, sem animações de entrada) ──────────────

const MOBILE_FEATURES = [
  { icon: Bot, title: "IA treinada no seu negócio", desc: "Responde no seu tom de voz, 24h por dia, sem folga.", color: "text-orange-300" },
  { icon: Calendar, title: "Agenda visitas em tempo real", desc: "Cliente pede horário, a IA confirma e marca direto.", color: "text-sky-300" },
  { icon: Filter, title: "Funil organizado sozinho", desc: "Cada lead vai para a etapa certa automaticamente.", color: "text-orange-300" },
  { icon: Shield, title: "Zero clientes esquecidos", desc: "O sistema avisa o time antes do cliente reclamar.", color: "text-sky-300" },
  { icon: Mic, title: "Áudio, foto e vídeo", desc: "Cliente manda áudio? A IA escuta e responde.", color: "text-orange-300" },
  { icon: BarChart3, title: "Dashboard em tempo real", desc: "Veja quantos chegaram, foram atendidos e compraram.", color: "text-sky-300" },
];

function LandingMobile() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#03040a] text-slate-100 antialiased">
      {/* Gradiente de fundo estático */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-10%,_hsl(25_70%_16%/0.35),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_hsl(225_60%_18%/0.25),transparent_55%)]" />
        <div className="absolute left-1/2 top-0 h-[350px] w-[350px] -translate-x-1/2 rounded-full bg-orange-500/15" style={{ filter: "blur(80px)" }} />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#03040a]/95 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-white/5 p-1 ring-1 ring-white/10">
              <VGVTurboLogo size="sm" variant="icon" />
            </div>
            <span className="font-semibold text-white">VGV Turbo</span>
          </div>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            <Button className="h-9 rounded-full bg-orange-500 px-4 text-sm font-semibold text-slate-950 shadow-[0_0_16px_-2px_hsl(25_84%_45%/0.5)]">
              Começar agora
            </Button>
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-5 pb-12 pt-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/5 px-3 py-1 text-xs font-medium text-orange-300">
          <BeltDots />
          +50 operações no ar
        </span>

        <h1 className="mt-5 text-[2.2rem] font-bold leading-[1.1] tracking-tight text-white">
          Enquanto você atende um cliente,{" "}
          <span className="bg-gradient-to-r from-orange-300 to-sky-300 bg-clip-text text-transparent">
            o VGV Turbo fecha o próximo.
          </span>
        </h1>

        <p className="mt-4 text-base leading-relaxed text-slate-400">
          Uma IA exclusiva, treinada na sua operação, que atende cada cliente com o seu tom de voz — 24h por dia, sem nunca parar.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="h-14 w-full rounded-full bg-orange-500 text-base font-semibold text-slate-950 shadow-[0_0_28px_-4px_hsl(25_84%_45%/0.6)] active:scale-[0.98]">
              Quero ver funcionando
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
          <Link to="/auth">
            <Button size="lg" variant="ghost" className="h-14 w-full rounded-full border border-white/10 text-base text-slate-300 active:scale-[0.98]">
              Já sou cliente
            </Button>
          </Link>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex -space-x-2">
            {["RC", "JM", "AP", "TS", "MF"].map((init, i) => (
              <div key={i} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#03040a] bg-gradient-to-br from-orange-400/40 to-sky-400/20 text-[8px] font-bold text-white">
                {init}
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-400">
            <span className="font-semibold text-white">+50 empresas</span> automatizadas
          </p>
        </div>

        <div className="mt-10">
          <MobilePhoneCard />
        </div>
      </section>

      {/* Marquee */}
      <MarqueeStrip />

      {/* Stats */}
      <section className="border-y border-white/5 px-5 py-12">
        <div className="grid grid-cols-2 gap-6">
          {[
            { value: "47s", label: "Tempo médio de resposta da IA", color: "text-orange-400" },
            { value: "24/7", label: "Operação ativa, sem interrupções", color: "text-sky-400" },
            { value: "3×", label: "Mais conversões com follow-up", color: "text-orange-400" },
            { value: "0", label: "Leads perdidos por falta de resposta", color: "text-sky-400" },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <p className={`text-4xl font-bold tracking-tight ${s.color}`}>{s.value}</p>
              <p className="mt-1.5 text-xs leading-snug text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recursos */}
      <section className="px-5 py-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/5 px-3 py-1 text-xs font-medium text-orange-300">
          <BeltDots />
          Tudo entregue rodando
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
          Uma operação completa.{" "}
          <span className="bg-gradient-to-r from-orange-300 to-sky-300 bg-clip-text text-transparent">Pronta no dia 1.</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Você não constrói nada. A VGV Turbo estrutura tudo sob medida e entrega rodando.
        </p>

        <div className="mt-8 space-y-4">
          {MOBILE_FEATURES.map((f, i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-white/10">
                <f.icon className={`h-5 w-5 ${f.color}`} />
              </div>
              <div>
                <p className="font-semibold text-white">{f.title}</p>
                <p className="mt-0.5 text-sm text-slate-400">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="border-t border-white/[0.06] px-5 py-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/5 px-3 py-1 text-xs font-medium text-orange-300">
          <BeltDots />
          Como funciona
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
          Simples para você,{" "}
          <span className="bg-gradient-to-r from-orange-300 to-sky-300 bg-clip-text text-transparent">poderoso para o cliente.</span>
        </h2>

        <div className="mt-8 space-y-6">
          {[
            { n: "1", title: "Cliente manda mensagem", desc: "WhatsApp, Instagram ou e-mail — a IA recebe em todos os canais ao mesmo tempo." },
            { n: "2", title: "IA entende e responde", desc: "Em segundos, com o seu tom de voz, qualificando o lead e avançando na conversa." },
            { n: "3", title: "Você acompanha no painel", desc: "Veja tudo em tempo real. Entre na conversa quando quiser — a IA para automaticamente." },
          ].map((step) => (
            <div key={step.n} className="flex gap-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-sm font-bold text-orange-300 ring-1 ring-orange-400/30">
                {step.n}
              </div>
              <div className="pt-1">
                <p className="font-semibold text-white">{step.title}</p>
                <p className="mt-1 text-sm text-slate-400">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Canais */}
      <section className="border-t border-white/[0.06] px-5 py-12">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Conectado onde seus{" "}
          <span className="bg-gradient-to-r from-orange-300 to-sky-300 bg-clip-text text-transparent">clientes já estão</span>
        </h2>
        <p className="mt-3 text-sm text-slate-400">
          Tudo dentro do WhatsApp e Instagram da sua empresa. Seus clientes nem percebem que há uma IA.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {ORBIT_OUTER.map((c) => (
            <div key={c.label} className={`flex items-center gap-3 rounded-2xl p-3.5 ring-1 ${c.cls}`}>
              <c.icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{c.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Depoimentos */}
      <section className="border-t border-white/[0.06] px-5 py-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/5 px-3 py-1 text-xs font-medium text-orange-300">
          <BeltDots />
          Quem já opera com a VGV Turbo
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
          Resultados que nossos clientes{" "}
          <span className="bg-gradient-to-r from-orange-300 to-sky-300 bg-clip-text text-transparent">já enxergam</span>
        </h2>

        <div className="mt-8 space-y-4">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="mb-4 text-sm leading-relaxed text-slate-300">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400/30 to-sky-400/20 text-xs font-bold text-white ring-1 ring-white/10">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-14">
        <div className="relative overflow-hidden rounded-3xl border border-orange-400/20 bg-orange-500/5 p-8 text-center">
          <div className="absolute inset-0 rounded-3xl" style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(25 70% 30% / 0.15), transparent 70%)" }} />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/5 px-3 py-1 text-xs font-medium text-orange-300">
              <Rocket className="h-3 w-3" />
              Pronto para colocar no ar
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
              Vamos conectar seu{" "}
              <span className="bg-gradient-to-r from-orange-300 to-sky-300 bg-clip-text text-transparent">WhatsApp agora?</span>
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              Sem formulário longo. Uma conversa direta com quem vai estruturar sua operação.
            </p>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="mt-6 block">
              <Button size="lg" className="h-14 w-full rounded-full bg-orange-500 text-base font-semibold text-slate-950 shadow-[0_0_40px_-5px_hsl(25_84%_45%/0.7)]">
                <MessageSquare className="mr-2 h-5 w-5" />
                Conversar no WhatsApp
              </Button>
            </a>
            <p className="mt-4 text-xs text-slate-600">+55 (79) 99165-8966 · Seg–Sex, 9h às 19h</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-5 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-white/5 p-1 ring-1 ring-white/10">
              <VGVTurboLogo size="sm" variant="icon" />
            </div>
            <span className="font-semibold text-white">VGV Turbo</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/legal/privacy" className="text-xs text-slate-500">Privacidade</Link>
            <Link to="/legal/terms" className="text-xs text-slate-500">Termos</Link>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-600">© 2026 VGV Turbo</p>
      </footer>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function LandingDesktop() {
  const isMobile = false;
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.15]);

  const { scrollYProgress: pageScroll } = useScroll();
  const progressX = useSpring(pageScroll, { stiffness: 120, damping: 30, mass: 0.3 });

  return (
    <MotionConfig reducedMotion="never">
    <div className="min-h-screen overflow-x-hidden bg-[#03040a] text-slate-100 antialiased">
      {/* Barra de progresso de scroll */}
      <motion.div
        style={{ scaleX: progressX }}
        className="fixed left-0 right-0 top-0 z-[60] h-0.5 origin-left bg-gradient-to-r from-orange-400 via-orange-300 to-sky-400"
      />

      {/* Deep-space ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-10%,_hsl(25_70%_16%/0.35),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_hsl(225_60%_18%/0.28),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_hsl(199_70%_22%/0.14),transparent_60%)]" />
        <Aurora mobile={isMobile} />
        <div
          className="absolute inset-0 opacity-[0.04] mix-blend-soft-light"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      {/* Starfield with parallax */}
      <Starfield density={isMobile ? 0.3 : 1} />

      <CursorGlow />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#03040a]/75 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/5 p-1.5 ring-1 ring-white/10">
              <VGVTurboLogo size="sm" variant="icon" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">VGV Turbo</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            {[
              { href: "#capabilities", label: "Recursos" },
              { href: "#tools", label: "Como funciona" },
              { href: "#depoimentos", label: "Depoimentos" },
              { to: "/blog", label: "Blog" },
            ].map((item) =>
              item.to ? (
                <Link key={item.label} to={item.to} className="text-sm text-slate-400 transition hover:text-orange-300">
                  {item.label}
                </Link>
              ) : (
                <a key={item.label} href={item.href} className="text-sm text-slate-400 transition hover:text-orange-300">
                  {item.label}
                </a>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" className="text-sm text-slate-300 hover:bg-white/5 hover:text-white">
                Entrar
              </Button>
            </Link>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <Button className="rounded-full bg-orange-500 px-5 text-sm text-slate-950 shadow-[0_0_24px_-4px_hsl(25_84%_45%/0.6)] hover:bg-orange-400">
                Falar no WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero (centralizado, estilo Apple) ─────────────────────────────────── */}
      <section ref={heroRef} className="relative overflow-hidden pb-24 pt-36 lg:pt-44">
        <ShootingStars count={isMobile ? 0 : 22} />

        {/* Nebula glows */}
        <div
          className="pointer-events-none absolute left-1/2 top-16 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-orange-500/20 motion-reduce:animate-none"
          style={{
            filter: `blur(${isMobile ? 80 : 130}px)`,
            ...(isMobile ? {} : { animation: "breathe 7s ease-in-out infinite" }),
          }}
        />
        <div
          className="pointer-events-none absolute right-1/4 top-40 h-[420px] w-[420px] rounded-full bg-sky-500/10 motion-reduce:animate-none"
          style={{
            filter: `blur(${isMobile ? 70 : 110}px)`,
            ...(isMobile ? {} : { animation: "breathe 9s ease-in-out 2s infinite" }),
          }}
        />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Copy */}
            <motion.div initial={isMobile ? false : "hidden"} animate={isMobile ? undefined : "visible"} variants={isMobile ? undefined : stagger(0.12)} className="text-center lg:text-left">
              <motion.div variants={isMobile ? undefined : fadeUp}>
                <Pill>Mais de 50 operações de WhatsApp no ar</Pill>
              </motion.div>

              <motion.h1
                variants={isMobile ? undefined : stagger(0.14)}
                className="mt-8 text-balance text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
              >
                <motion.span variants={isMobile ? undefined : lineReveal} className="block">
                  Enquanto você atende um cliente,
                </motion.span>
                <motion.span
                  variants={isMobile ? undefined : lineReveal}
                  className="block animate-text-shimmer bg-gradient-to-r from-orange-300 via-sky-300 to-orange-300 bg-[length:200%_auto] bg-clip-text text-transparent motion-reduce:animate-none"
                >
                  o VGV Turbo fecha o próximo.
                </motion.span>
              </motion.h1>

              <motion.p variants={isMobile ? undefined : fadeUp} className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-slate-400 md:text-xl lg:mx-0">
                Uma IA exclusiva, treinada na sua operação, que atende cada cliente com o seu tom de voz — 24 horas por dia, sem nunca parar.
              </motion.p>

              <motion.div variants={isMobile ? undefined : fadeUp} className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <MagneticButton>
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                    <Button
                      size="lg"
                      className="group relative h-14 overflow-hidden rounded-full bg-orange-500 px-8 text-base font-semibold text-slate-950 shadow-[0_0_40px_-5px_hsl(25_84%_45%/0.7)] transition hover:bg-orange-400"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        Quero ver funcionando
                        <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                      </span>
                      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    </Button>
                  </a>
                </MagneticButton>
                <Link to="/auth">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="h-14 rounded-full border border-white/10 px-8 text-base text-slate-300 hover:bg-white/5 hover:text-white"
                  >
                    Já sou cliente
                  </Button>
                </Link>
              </motion.div>

              {/* Social proof */}
              <motion.div variants={isMobile ? undefined : fadeUp} className="mt-8 flex items-center justify-center gap-3 lg:justify-start">
                <div className="flex -space-x-2">
                  {["RC", "JM", "AP", "TS", "MF"].map((init, i) => (
                    <div
                      key={i}
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#03040a] bg-gradient-to-br from-orange-400/40 to-sky-400/20 text-[9px] font-bold text-white"
                    >
                      {init}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-400">
                  <span className="font-semibold text-white">+50 empresas</span> já automatizadas
                </p>
              </motion.div>
            </motion.div>

            {/* Phone */}
            <motion.div
              initial={isMobile ? { opacity: 0, y: 32 } : { opacity: 0, x: 48, scale: 0.96, filter: "blur(12px)" }}
              animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 1, delay: 0.7, ease: [0.22, 1, 0.36, 1] as const }}
              className="flex justify-center"
            >
              <PhoneMockup />
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.8 }}
          className="relative z-10 mt-24 flex flex-col items-center gap-2 text-slate-400"
        >
          <span className="text-[11px] uppercase tracking-[0.2em]">Role para explorar</span>
          <ChevronDown className="h-4 w-4 animate-bounce text-orange-400/80" />
        </motion.div>
      </section>

      {/* ── Marquee ───────────────────────────────────────────────────────────── */}
      <MarqueeStrip />

      {/* ── Stats ─────────────────────────────────────────────────────────────── */}
      <StatsSection />

      {/* ── Capabilities (bento) ─────────────────────────────────────────────── */}
      <section id="capabilities" className="relative py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,hsl(25_60%_22%/0.10),transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-6">
          <motion.div
            initial={isMobile ? false : "hidden"}
            whileInView={isMobile ? undefined : "visible"}
            viewport={isMobile ? undefined : { once: true, margin: "-80px" }}
            variants={isMobile ? undefined : stagger(0.1)}
            className="mx-auto mb-16 max-w-2xl text-center"
          >
            <motion.div variants={isMobile ? undefined : fadeUp}><Pill>Tudo entregue rodando</Pill></motion.div>
            <motion.h2 variants={isMobile ? undefined : fadeUp} className="mt-6 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Uma operação completa.{" "}
              <span className="bg-gradient-to-r from-orange-300 to-sky-300 bg-clip-text text-transparent">
                Pronta no dia 1.
              </span>
            </motion.h2>
            <motion.p variants={isMobile ? undefined : fadeUp} className="mt-5 text-lg text-slate-400">
              Você não constrói nada. A VGV Turbo estrutura tudo sob medida e entrega rodando. A você cabe acompanhar os resultados.
            </motion.p>
          </motion.div>

          <motion.div
            initial={isMobile ? false : "hidden"}
            whileInView={isMobile ? undefined : "visible"}
            viewport={isMobile ? undefined : { once: true, margin: "-60px" }}
            variants={isMobile ? undefined : stagger(0.06)}
            className="grid auto-rows-auto gap-3 md:grid-cols-3"
          >
            <BentoCard
              icon={Bot}
              title="Agente de IA exclusivo, treinado no seu negócio"
              description="Aprende seu tom de voz, seus produtos e suas regras. Responde, qualifica e acompanha cada cliente como se fosse você — 24 horas por dia."
              featured
              accentColor="emerald"
              className="md:col-span-2"
            >
              <div className="mt-2 flex flex-wrap gap-2">
                {["Tom de voz personalizado", "Pausa quando você entra", "Audita cada conversa"].map((tag) => (
                  <span key={tag} className="rounded-full border border-orange-400/15 bg-orange-400/5 px-2.5 py-0.5 text-[10px] text-orange-300">
                    {tag}
                  </span>
                ))}
              </div>
            </BentoCard>

            <BentoCard icon={Filter} title="Funil organizado sozinho" description="Cada lead vai para a etapa certa automaticamente. Você abre o painel e vê onde está cada negócio." accentColor="cyan" />
            <BentoCard icon={Calendar} title="Agenda visitas em tempo real" description="Cliente pede horário, a IA confirma e marca direto na sua agenda. Lembrete automático incluído." accentColor="emerald" />

            <BentoCard
              icon={BarChart3}
              title="Você enxerga o que antes era invisível"
              description="Quantos clientes chegaram, foram atendidos e compraram — e o que travou os que não compraram. Em tempo real."
              featured
              accentColor="cyan"
              className="md:col-span-2"
            >
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: "Taxa resposta", value: "98%" },
                  { label: "SLA cumprido", value: "94%" },
                  { label: "NPS médio", value: "72" },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-lg border border-white/5 bg-white/[0.03] p-2 text-center">
                    <p className="text-base font-bold text-white">{kpi.value}</p>
                    <p className="mt-0.5 text-[9px] text-slate-500">{kpi.label}</p>
                  </div>
                ))}
              </div>
            </BentoCard>

            <BentoCard icon={Shield} title="Nenhum cliente esquecido" description="O sistema avisa o time antes do cliente reclamar. Respeita horário comercial e feriados." accentColor="emerald" />
            <BentoCard icon={Mic} title="Áudio, foto e vídeo compreendidos" description="Cliente manda áudio? A IA escuta. Manda foto? A IA analisa. Nada se perde pelo formato." accentColor="cyan" />
            <BentoCard icon={Megaphone} title="Campanhas que preservam seu número" description="Disparos em lotes com pausas naturais. Sua mensagem chega à base sem queimar o WhatsApp." accentColor="purple" />
            <BentoCard icon={Activity} title="Saiba por que perdeu cada venda" description="A IA audita as conversas e aponta onde o atendimento falhou e o que está escapando." accentColor="emerald" />
            <BentoCard icon={Target} title="Seu time competindo pela meta" description="Metas por vendedor, ranking ao vivo e cada fechamento visível para a equipe inteira." accentColor="cyan" />
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ── How it works ──────────────────────────────────────────────────────── */}
      <section id="tools" className="relative py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,hsl(199_60%_22%/0.08),transparent_70%)]" />
        <GlowOrb className="-left-40 top-1/4 h-96 w-96 bg-orange-500/15" />
        <GlowOrb className="-right-40 bottom-1/4 h-96 w-96 bg-sky-500/15" />

        <div className="mx-auto max-w-7xl space-y-36 px-6">
          <ToolBlock
            icon={Bot}
            tag="Inteligência Artificial"
            title="Um agente que vende enquanto você dorme"
            description="Treinado com seus produtos, preços, regras e tom de voz. Atende qualquer cliente, a qualquer hora, como seu melhor vendedor — sem folga."
            bullets={[
              "Pausa sozinho quando você entra na conversa",
              "Consulta agenda, funil e histórico do cliente na hora",
              "Conhece exatamente seus horários de funcionamento",
              "Cada conversa é auditada e classificada automaticamente",
            ]}
            visual={
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-orange-400" />
                  Conversa ao vivo · WhatsApp · 14:32
                </div>
                {[
                  { from: "user", text: "Oi! Vi o apartamento de 3 quartos na Aclimação, ainda está disponível?" },
                  { from: "ai", text: "Olá! Sim, ainda está disponível 🏠 Posso agendar uma visita? Tenho hoje às 16h ou amanhã às 10h." },
                  { from: "user", text: "Pode marcar para hoje às 16h 👍" },
                  { from: "ai", text: "Confirmado. Envio a localização e os detalhes do imóvel agora. À disposição! ✅" },
                ].map((m, i) => (
                  <div key={i} className={`flex ${m.from === "user" ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        m.from === "user"
                          ? "rounded-tl-sm bg-slate-800/70 text-slate-200"
                          : "rounded-tr-sm bg-orange-500/15 text-slate-100 ring-1 ring-orange-400/20"
                      }`}
                    >
                      {m.text}
                      <p className={`mt-1 text-[10px] ${m.from === "user" ? "text-slate-500" : "text-orange-300/70"}`}>
                        {m.from === "ai" ? "14:32 · IA" : "14:32"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            }
          />

          <ToolBlock
            icon={Workflow}
            tag="Operação automatizada"
            title="Uma operação inteira rodando sem você"
            description="Atendimento, follow-up, qualificação e distribuição acontecem sozinhos. Tudo desenhado pela VGV Turbo sob medida — você não precisa mexer em nada."
            bullets={[
              "Lead respondido em segundos, a qualquer hora do dia",
              "Distribuição automática para o vendedor certo",
              "Follow-up com quem sumiu, sem precisar lembrar",
              "Reativação de clientes parados no momento certo",
            ]}
            reversed
            visual={
              <div className="space-y-2">
                {[
                  { icon: MessageSquare, label: "Cliente manda mensagem", color: "emerald", time: "agora" },
                  { icon: Bot, label: "IA entende e qualifica", color: "cyan", time: "< 1s" },
                  { icon: Users, label: "Distribui para o vendedor certo", color: "emerald", time: "automático" },
                  { icon: Zap, label: "Proposta enviada", color: "cyan", time: "< 30s" },
                  { icon: Clock, label: "Follow-up agendado", color: "emerald", time: "2 dias" },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${
                        step.color === "emerald"
                          ? "bg-orange-500/10 text-orange-300 ring-orange-400/30"
                          : "bg-sky-500/10 text-sky-300 ring-sky-400/30"
                      }`}
                    >
                      <step.icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-1 items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                      <span className="text-sm text-slate-300">{step.label}</span>
                      <span className="text-[10px] text-slate-600">{step.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            }
          />

          <ToolBlock
            icon={BarChart3}
            tag="Resultados claros"
            title="O que antes era invisível, agora está na tela"
            description="Painel direto: quantos clientes chegaram, foram atendidos e compraram — e exatamente o que travou os que não compraram."
            bullets={[
              "Tempo médio de fechamento por vendedor",
              "Onde o atendimento mais falha, apontado pela IA",
              "Oportunidades que estão escapando agora",
              "SLA de resposta monitorado em tempo real",
            ]}
            visual={
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Conversas hoje", value: 847, suffix: "" },
                  { label: "Taxa de resposta", value: 98, suffix: "%" },
                  { label: "SLA cumprido", value: 94, suffix: "%" },
                  { label: "NPS", value: 72, suffix: "" },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <p className="text-xs text-slate-500">{kpi.label}</p>
                    <p className="mt-1 text-2xl font-bold text-white">
                      <AnimatedNumber to={kpi.value} suffix={kpi.suffix} />
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-orange-400">
                      <TrendingUp className="h-3 w-3" /> em alta
                    </p>
                  </div>
                ))}
              </div>
            }
          />
        </div>
      </section>

      {/* ── Channels ──────────────────────────────────────────────────────────── */}
      <section id="stack" className="relative border-y border-white/[0.06] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-14 lg:grid-cols-2">
            <motion.div initial={isMobile ? false : "hidden"} whileInView={isMobile ? undefined : "visible"} viewport={isMobile ? undefined : { once: true, margin: "-80px" }} variants={isMobile ? undefined : stagger(0.1)}>
              <motion.div variants={isMobile ? undefined : fadeUp}><Pill>Onde sua empresa já vende</Pill></motion.div>
              <motion.h2 variants={isMobile ? undefined : fadeUp} className="mt-6 text-4xl font-bold tracking-tight text-white md:text-5xl">
                Conectado onde seus clientes já estão
              </motion.h2>
              <motion.p variants={isMobile ? undefined : fadeUp} className="mt-5 text-lg leading-relaxed text-slate-400">
                Tudo dentro do WhatsApp e do Instagram da sua empresa, exatamente como é hoje. Seus clientes nem percebem que há uma IA — apenas recebem respostas mais rápidas.
              </motion.p>
              <motion.div variants={isMobile ? undefined : fadeUp} className="mt-7 flex flex-wrap gap-2">
                {["WhatsApp", "Instagram Direct", "E-mail", "Google Avaliações"].map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
                    {tag}
                  </span>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              initial={isMobile ? false : "hidden"}
              whileInView={isMobile ? undefined : "visible"}
              viewport={isMobile ? undefined : { once: true, margin: "-80px" }}
              variants={isMobile ? undefined : scaleIn}
              className="flex items-center justify-center"
            >
              <OrbitalSystem />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────────────────── */}
      <div id="depoimentos">
        <TestimonialsSection />
      </div>

      <SectionDivider />

      {/* ── CTA ───────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-32">
        <ShootingStars count={isMobile ? 0 : 8} />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/15 blur-[120px]" />
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/10 blur-[80px]" />
        </div>

        <motion.div
          initial={isMobile ? false : "hidden"}
          whileInView={isMobile ? undefined : "visible"}
          viewport={isMobile ? undefined : { once: true, margin: "-80px" }}
          variants={isMobile ? undefined : stagger(0.12)}
          className="relative mx-auto max-w-3xl px-6 text-center"
        >
          <motion.div variants={isMobile ? undefined : fadeUp}>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-orange-400/20 bg-orange-400/5 px-3.5 py-1 text-xs font-medium text-orange-300 backdrop-blur">
              <Rocket className="h-3.5 w-3.5" />
              Pronto para colocar no ar
            </span>
          </motion.div>
          <motion.h2 variants={isMobile ? undefined : fadeUp} className="mt-7 text-balance text-4xl font-bold tracking-tight text-white md:text-6xl">
            Vamos conectar seu{" "}
            <span className="bg-gradient-to-r from-orange-300 to-sky-300 bg-clip-text text-transparent">WhatsApp agora</span>?
          </motion.h2>
          <motion.p variants={isMobile ? undefined : fadeUp} className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-400">
            Sem formulário longo, sem robô de vendas. Uma conversa direta com quem vai estruturar a operação do seu negócio.
          </motion.p>
          <motion.div variants={isMobile ? undefined : fadeUp} className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <MagneticButton>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <Button
                  size="lg"
                  className="group relative h-16 overflow-hidden rounded-full bg-orange-500 px-10 text-lg font-semibold text-slate-950 shadow-[0_0_60px_-5px_hsl(25_84%_45%/0.8)] transition hover:bg-orange-400"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    <MessageSquare className="h-5 w-5" />
                    Conversar no WhatsApp
                    <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                  </span>
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                </Button>
              </a>
            </MagneticButton>
          </motion.div>
          <motion.div variants={isMobile ? undefined : fadeUp} className="mt-6 flex items-center justify-center gap-4 text-sm text-slate-500">
            <span>+55 (79) 99165-8966</span>
            <span className="h-1 w-1 rounded-full bg-slate-600" />
            <span>Segunda a sexta, 9h às 19h</span>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/5 p-1.5 ring-1 ring-white/10">
              <VGVTurboLogo size="sm" variant="icon" />
            </div>
            <span className="font-semibold text-white">VGV Turbo</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/legal/privacy" className="text-xs text-slate-500 transition hover:text-slate-300">Privacidade</Link>
            <Link to="/legal/terms" className="text-xs text-slate-500 transition hover:text-slate-300">Termos</Link>
            <p className="text-xs text-slate-600">© 2026 VGV Turbo</p>
          </div>
        </div>
      </footer>
    </div>
    </MotionConfig>
  );
}

export default function Landing() {
  const isMobile = useIsMobile();
  return isMobile ? <LandingMobile /> : <LandingDesktop />;
}
