import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';
import Avatar from '@/components/Avatar';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  X,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  getRememberedAccount,
  RememberedAccount,
} from '@/lib/rememberedAccount';

interface AuthPageProps {
  onBack: () => void;
  onAdminAccess: () => void;
}

export default function AuthPage({
  onBack,
  onAdminAccess,
}: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);

  const [remembered, setRemembered] =
    useState<RememberedAccount | null>(() =>
      mode === 'login' ? getRememberedAccount() : null
    );

  const dismissRemembered = () => {
    setRemembered(null);

    try {
      localStorage.removeItem('geajao-remembered-account');
    } catch {
      // Ignore storage errors.
    }
  };

  const handleQuickLogin = async () => {
    if (!remembered) return;

    setQuickLoading(true);
    setError('');
    setUsername(remembered.username);
    setRemembered(null);
    setQuickLoading(false);
  };

  const handleLogoTap = () => {
    const newTaps = logoTaps + 1;
    setLogoTaps(newTaps);

    if (newTaps >= 5) {
      setLogoTaps(0);
      onAdminAccess();
    }

    setTimeout(() => setLogoTaps(0), 2000);
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!username || !password || !fullName) {
          setError(
            'Username, password, and full name are required'
          );
          setLoading(false);
          return;
        }

        if (!email && !phone) {
          setError(
            'Please provide either an email or phone number'
          );
          setLoading(false);
          return;
        }

        const emailForAuth =
          email || `${username.toLowerCase()}@geajao.app`;

        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: emailForAuth,
            password,
            options: {
              data: {
                username,
                full_name: fullName,
                email: email || null,
                phone: phone || null,
              },
            },
          });

        if (signUpError) {
          if (signUpError.message.includes('already')) {
            setError(
              'This username or email is already taken'
            );
          } else {
            setError(signUpError.message);
          }

          setLoading(false);
          return;
        }

        if (data.user) {
          // The existing database trigger creates the profile.
          // Existing signup behavior is preserved.
        }
      } else {
        let emailForLogin = username;

        if (!username.includes('@')) {
          const {
            data: emailData,
            error: lookupError,
          } = await supabase.rpc(
            'get_email_by_username',
            { p_username: username.toLowerCase() }
          );

          if (lookupError || !emailData) {
            setError('Invalid username or password');
            setLoading(false);
            return;
          }

          emailForLogin = emailData as string;
        }

        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: emailForLogin,
            password,
          });

        if (signInError) {
          setError('Invalid username or password');
          setLoading(false);
          return;
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="auth-future relative flex min-h-screen items-center justify-center overflow-hidden bg-[#010409] px-4 py-6 text-white sm:px-6 sm:py-10">
      {/* Animated futuristic background with pure dark gold tones */}
      <div
        aria-hidden="true"
        className="auth-atmosphere pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="auth-grid absolute inset-0" />

        <div className="auth-aurora auth-aurora-one absolute left-1/2 top-[-12rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full" />

        <div className="auth-aurora auth-aurora-two absolute bottom-[-14rem] left-[-8rem] h-[28rem] w-[28rem] rounded-full" />

        <div className="auth-aurora auth-aurora-three absolute right-[-10rem] top-1/4 h-[30rem] w-[30rem] rounded-full" />

        <div className="auth-orbit auth-orbit-one absolute left-1/2 top-[45%] h-[min(78vw,48rem)] w-[min(78vw,48rem)] -translate-x-1/2 -translate-y-1/2 rounded-full" />

        <div className="auth-orbit auth-orbit-two absolute left-1/2 top-[45%] h-[min(58vw,36rem)] w-[min(58vw,36rem)] -translate-x-1/2 -translate-y-1/2 rounded-full" />

        <div className="auth-scan absolute inset-x-0 top-0 h-24" />

        <div className="auth-stars absolute inset-0" />
      </div>

      <div className="auth-content relative z-10 w-full max-w-md sm:max-w-lg">
        {/* Back button */}
        <button
          onClick={onBack}
          className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-amber-200/70 transition hover:bg-white/5 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:mb-7"
        >
          <ArrowLeft size={18} />
          Back to Welcome
        </button>

        {/* Logo: five taps opens admin access */}
        <div className="auth-brand mb-6 text-center sm:mb-8">
          <h1
            onClick={handleLogoTap}
            className="cursor-default select-none text-4xl font-extrabold tracking-tight text-white sm:text-5xl"
          >
            <span className="auth-logo-wrap mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] sm:h-28 sm:w-28">
              <Logo className="auth-logo mx-auto h-20 w-20 drop-shadow-[0_8px_24px_rgba(212,175,55,0.35)] sm:h-24 sm:w-24" />
            </span>
          </h1>

          <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-amber-300/80">
            GEAJAO{' '}
            <span className="text-amber-400">
              // SECURE ACCESS
            </span>
          </p>

          <p className="mt-2 text-sm text-zinc-400 sm:text-base">
            {mode === 'login'
              ? 'Welcome back to your world.'
              : 'Your next chapter starts here.'}
          </p>
        </div>

        {/* Authentication panel */}
        <div className="auth-panel relative rounded-3xl border border-amber-400/20 bg-[#0d0902]/90 p-5 shadow-[0_24px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-8">
          <div className="mb-4 flex items-center justify-center gap-2 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-amber-200/60">
            <ShieldCheck size={13} className="text-amber-400" />
            Encrypted session
            <span className="text-white/20">•</span>
            <Sparkles size={13} className="text-amber-300" />
            Next-gen access
          </div>

          {/* Login / signup toggle */}
          <div className="mb-6 flex rounded-2xl border border-amber-400/20 bg-black/30 p-1.5 sm:mb-7">
            <button
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`auth-mode-btn flex-1 rounded-xl py-3 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-500/25'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              Login
            </button>

            <button
              onClick={() => {
                setMode('signup');
                setError('');
              }}
              className={`auth-mode-btn flex-1 rounded-xl py-3 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                mode === 'signup'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-500/25'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Remembered account */}
          {mode === 'login' && remembered && !loading && (
            <div className="auth-enter mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/[0.045] p-4 shadow-[inset_0_0_30px_rgba(212,175,55,0.035)] sm:p-5">
              <div className="flex items-center gap-3">
                <Avatar
                  name={remembered.full_name}
                  avatarUrl={remembered.avatar_url}
                  size={10}
                  className="shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {remembered.full_name}
                  </p>
                  <p className="truncate text-xs text-zinc-400">
                    @{remembered.username}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={dismissRemembered}
                  className="rounded-xl p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  aria-label="Forget this account"
                >
                  <X size={16} />
                </button>
              </div>

              <button
                type="button"
                onClick={handleQuickLogin}
                disabled={quickLoading}
                className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0902] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {quickLoading && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                Continue as @{remembered.username}
              </button>

              <p className="mt-3 text-center text-xs leading-5 text-zinc-400">
                Just enter your password below to sign in.
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-200">
                  Full Name
                </label>

                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="auth-input input-field min-h-12 w-full rounded-xl border border-amber-400/20 bg-black/30 px-4 py-3 text-base text-white placeholder:text-zinc-500 outline-none transition focus:border-amber-400/70 focus:ring-4 focus:ring-amber-400/10 sm:text-sm"
                  placeholder="Your real name"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-200">
                {mode === 'login'
                  ? 'Username or Email'
                  : 'Username'}
              </label>

              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="auth-input input-field min-h-12 w-full rounded-xl border border-amber-400/20 bg-black/30 px-4 py-3 text-base text-white placeholder:text-zinc-500 outline-none transition focus:border-amber-400/70 focus:ring-4 focus:ring-amber-400/10 sm:text-sm"
                placeholder={
                  mode === 'login'
                    ? 'Enter your username'
                    : 'Choose a username'
                }
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-200">
                Password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input input-field min-h-12 w-full rounded-xl border border-amber-400/20 bg-black/30 px-4 py-3 pr-12 text-base text-white placeholder:text-zinc-500 outline-none transition focus:border-amber-400/70 focus:ring-4 focus:ring-amber-400/10 sm:text-sm"
                  placeholder="••••••••"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  aria-label={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showPassword
                    ? <EyeOff size={18} />
                    : <Eye size={18} />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-200">
                    Email{' '}
                    <span className="text-zinc-500">
                      (or phone below)
                    </span>
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="auth-input input-field min-h-12 w-full rounded-xl border border-amber-400/20 bg-black/30 px-4 py-3 text-base text-white placeholder:text-zinc-500 outline-none transition focus:border-amber-400/70 focus:ring-4 focus:ring-amber-400/10 sm:text-sm"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-200">
                    Mobile Number{' '}
                    <span className="text-zinc-500">
                      (or email above)
                    </span>
                  </label>

                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="auth-input input-field min-h-12 w-full rounded-xl border border-amber-400/20 bg-black/30 px-4 py-3 text-base text-white placeholder:text-zinc-500 outline-none transition focus:border-amber-400/70 focus:ring-4 focus:ring-amber-400/10 sm:text-sm"
                    placeholder="+1 234 567 890"
                  />
                </div>
              </>
            )}

            {error && (
              <div
                role="alert"
                className="auth-error rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm leading-5 text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="auth-submit btn-primary mt-1 flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 px-4 py-3 text-base font-bold text-white shadow-lg shadow-amber-500/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0902] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : mode === 'login' ? (
                'Login'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs leading-5 text-zinc-400 sm:mt-6">
            {mode === 'signup'
              ? 'After signing up, you will need to verify your identity with an ID card.'
              : 'Only verified users can see and create posts.'}
          </p>
        </div>
      </div>

      {/* Component-scoped animations and pure dark-gold palette */}
      <style>{`
        .auth-future {
          isolation: isolate;
        }

        .auth-grid {
          opacity: .18;
          background-image:
            linear-gradient(rgba(212,175,55,.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,175,55,.12) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: radial-gradient(ellipse at center, #000 15%, transparent 76%);
          animation: auth-grid-drift 28s linear infinite;
        }

        .auth-aurora {
          filter: blur(85px);
          opacity: .35;
          will-change: transform;
        }

        .auth-aurora-one {
          background: radial-gradient(circle, rgba(212,175,55,.28), rgba(120,80,10,.15) 48%, transparent 72%);
          animation: auth-float-one 15s ease-in-out infinite alternate;
        }

        .auth-aurora-two {
          background: radial-gradient(circle, rgba(180,130,20,.2), rgba(212,175,55,.08) 52%, transparent 72%);
          animation: auth-float-two 19s ease-in-out infinite alternate;
        }

        .auth-aurora-three {
          background: radial-gradient(circle, rgba(234,179,8,.22), rgba(140,90,15,.15) 52%, transparent 72%);
          animation: auth-float-three 17s ease-in-out infinite alternate;
        }

        .auth-orbit {
          border: 1px solid rgba(212,175,55,.12);
          box-shadow: 0 0 55px rgba(212,175,55,.04), inset 0 0 55px rgba(212,175,55,.03);
        }

        .auth-orbit-one {
          animation: auth-spin 55s linear infinite;
          border-style: dashed;
        }

        .auth-orbit-two {
          border-color: rgba(212,175,55,.18);
          animation: auth-spin-reverse 38s linear infinite;
        }

        .auth-scan {
          z-index: 1;
          pointer-events: none;
          background: linear-gradient(180deg, transparent, rgba(212,175,55,.045), transparent);
          animation: auth-scan 11s ease-in-out infinite;
        }

        .auth-stars {
          opacity: .28;
          background-image:
            radial-gradient(1px 1px at 12% 24%, #fde047 99%, transparent),
            radial-gradient(1px 1px at 76% 18%, #facc15 99%, transparent),
            radial-gradient(1.5px 1.5px at 63% 72%, #fff 99%, transparent),
            radial-gradient(1px 1px at 24% 81%, #eab308 99%, transparent),
            radial-gradient(1px 1px at 88% 58%, #ca8a04 99%, transparent);
          background-size: 280px 260px;
          animation: auth-twinkle 7s ease-in-out infinite alternate;
        }

        .auth-content {
          animation: auth-content-in .85s cubic-bezier(.2,.8,.2,1) both;
        }

        .auth-logo-wrap {
          position: relative;
          border: 1px solid rgba(212,175,55,.3);
          background: radial-gradient(circle at 50% 45%, rgba(212,175,55,.18), rgba(90,60,10,.15) 48%, transparent 72%);
          box-shadow: 0 0 35px rgba(212,175,55,.18), inset 0 0 25px rgba(212,175,55,.08);
          animation: auth-logo-breathe 4s ease-in-out infinite;
        }

        .auth-logo-wrap::before,
        .auth-logo-wrap::after {
          content: '';
          position: absolute;
          inset: -7px;
          border: 1px solid rgba(212,175,55,.2);
          border-radius: 2.2rem;
          animation: auth-ring 9s linear infinite;
          pointer-events: none;
        }

        .auth-logo-wrap::after {
          inset: -13px;
          border-color: rgba(212,175,55,.15);
          animation-duration: 14s;
          animation-direction: reverse;
        }

        .auth-logo {
          transition: transform .45s cubic-bezier(.2,.8,.2,1), filter .45s ease;
        }

        .auth-logo-wrap:hover .auth-logo {
          transform: scale(1.07) rotate(-4deg);
          filter: drop-shadow(0 0 18px rgba(212,175,55,.4));
        }

        .auth-panel {
          animation: auth-panel-in .9s .08s cubic-bezier(.2,.8,.2,1) both;
          transition: border-color .35s ease, box-shadow .35s ease, transform .35s ease;
        }

        .auth-panel:hover {
          border-color: rgba(212,175,55,.35);
          box-shadow: 0 25px 100px rgba(0,0,0,.55), 0 0 35px rgba(212,175,55,.06);
        }

        .auth-mode-btn {
          position: relative;
          overflow: hidden;
        }

        .auth-mode-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 20%, rgba(255,255,255,.18) 48%, transparent 76%);
          transform: translateX(-130%);
          transition: transform .65s ease;
          pointer-events: none;
        }

        .auth-mode-btn:hover::after {
          transform: translateX(130%);
        }

        .auth-input {
          transition: border-color .25s ease, background .25s ease, box-shadow .25s ease, transform .25s ease;
        }

        .auth-input:focus {
          transform: translateY(-1px);
          background-color: rgba(13,9,2,.85);
          box-shadow: 0 0 0 1px rgba(212,175,55,.1), 0 0 24px rgba(212,175,55,.1);
        }

        .auth-submit {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          transition: transform .25s ease, box-shadow .3s ease, filter .3s ease;
        }

        .auth-submit::before {
          content: '';
          position: absolute;
          z-index: -1;
          inset: 0;
          background: linear-gradient(105deg, transparent 15%, rgba(255,255,255,.25) 48%, transparent 78%);
          transform: translateX(-120%);
          transition: transform .7s ease;
        }

        .auth-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          filter: saturate(1.18);
          box-shadow: 0 10px 32px rgba(212,175,55,.3), 0 0 22px rgba(212,175,55,.2);
        }

        .auth-submit:hover:not(:disabled)::before {
          transform: translateX(120%);
        }

        .auth-submit:active:not(:disabled) {
          transform: translateY(0) scale(.99);
        }

        .auth-enter {
          animation: auth-content-in .4s ease both;
        }

        .auth-error {
          animation: auth-error-in .28s ease both;
        }

        @keyframes auth-content-in {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes auth-panel-in {
          from {
            opacity: 0;
            transform: translateY(22px) scale(.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes auth-grid-drift {
          to {
            background-position: 44px 44px;
          }
        }

        @keyframes auth-float-one {
          to {
            transform: translate(5%, 7%) scale(1.08);
          }
        }

        @keyframes auth-float-two {
          to {
            transform: translate(8%, -5%) scale(1.1);
          }
        }

        @keyframes auth-float-three {
          to {
            transform: translate(-7%, 8%) scale(.94);
          }
        }

        @keyframes auth-spin {
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }

        @keyframes auth-spin-reverse {
          to {
            transform: translate(-50%, -50%) rotate(-360deg);
          }
        }

        @keyframes auth-scan {
          0%, 100% {
            transform: translateY(-30vh);
            opacity: 0;
          }
          15%, 75% {
            opacity: 1;
          }
          90% {
            transform: translateY(110vh);
            opacity: 0;
          }
        }

        @keyframes auth-twinkle {
          to {
            opacity: .48;
          }
        }

        @keyframes auth-logo-breathe {
          0%, 100% {
            box-shadow: 0 0 28px rgba(212,175,55,.12), inset 0 0 25px rgba(212,175,55,.08);
          }
          50% {
            box-shadow: 0 0 42px rgba(212,175,55,.25), inset 0 0 32px rgba(212,175,55,.15);
          }
        }

        @keyframes auth-ring {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes auth-error-in {
          from {
            opacity: 0;
            transform: translateX(-5px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @media (max-width: 640px) {
          .auth-grid {
            background-size: 32px 32px;
          }

          .auth-orbit {
            opacity: .55;
          }

          .auth-panel {
            backdrop-filter: blur(18px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .auth-future *,
          .auth-future *::before,
          .auth-future *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>
    </div>
  );
}