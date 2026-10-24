import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { verifyAdminPin } from '@/lib/admin';
import { ArrowLeft, Lock, Loader2 } from 'lucide-react';

type AdminRole = 'admin' | 'moderator';

interface AdminPinPageProps {
  onBack: () => void;
  onSuccess: (pin: string, role: AdminRole) => void;
}

async function getAdminRole(userId: string): Promise<AdminRole | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin, is_moderator')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.is_admin) {
    return 'admin';
  }

  if (data?.is_moderator) {
    return 'moderator';
  }

  return null;
}

export default function AdminPinPage({
  onBack,
  onSuccess,
}: AdminPinPageProps) {
  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const checkExistingSession = async () => {
      try {
        const { data, error: sessionError } =
          await supabase.auth.getSession();

        if (!active) return;

        if (sessionError) {
          setError('Could not check your sign-in status. Please try again.');
          return;
        }

        const userId = data.session?.user.id;

        if (!userId) return;

        const role = await getAdminRole(userId);

        if (!active) return;

        if (role === 'admin') {
          setHasSession(true);
        } else if (role === 'moderator') {
          setHasSession(true);
          setIsModerator(true);
        } else {
          setError('This account does not have admin or moderator access.');
        }
      } catch {
        if (active) {
          setError('Could not verify account access. Please try again.');
        }
      } finally {
        if (active) {
          setAuthChecked(true);
        }
      }
    };

    void checkExistingSession();

    return () => {
      active = false;
    };
  }, []);

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (loading) return;

    setError('');
    setLoading(true);

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError || !data.user) {
        setError('Sign-in failed. Check your email and password.');
        return;
      }

      const role = await getAdminRole(data.user.id);

      if (role === 'admin') {
        setPassword('');
        setHasSession(true);
        setIsModerator(false);
        return;
      }

      if (role === 'moderator') {
        setPassword('');
        setHasSession(true);
        setIsModerator(true);
        return;
      }

      setError('This account does not have admin or moderator access.');
    } catch {
      setError('Could not verify account access. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const candidate = pin.trim();

    if (loading || !candidate) return;

    setError('');
    setLoading(true);

    try {
      const isValid = await verifyAdminPin(candidate);

      if (!isValid) {
        setPin('');
        setError('Invalid PIN. Access denied.');
        return;
      }

      setPin('');
      onSuccess(candidate, 'admin');
    } catch {
      setError('Could not verify access. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAsModerator = () => {
    if (!isModerator || loading) return;
    onSuccess('', 'moderator');
  };

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#010409]">
        <Loader2 size={24} className="animate-spin text-amber-400" />
      </div>
    );
  }

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

      <div className="relative w-full max-w-sm z-10">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-amber-200/70 transition hover:text-amber-200"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div className="rounded-3xl border border-amber-400/20 bg-[#0d0902]/90 p-8 shadow-[0_24px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 shadow-[0_0_30px_rgba(212,175,55,0.2)]">
              <Lock size={28} className="text-amber-400" />
            </div>

            <h1 className="text-xl font-bold text-white">Staff Access</h1>

            <p className="mt-1 text-sm text-zinc-400">
              {isModerator
                ? 'Your moderator account is verified'
                : hasSession
                  ? 'Enter the admin PIN to continue'
                  : 'Sign in to continue'}
            </p>
          </div>

          {!hasSession ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                aria-label="Email"
                required
                placeholder="Email"
                className="w-full rounded-xl border border-amber-400/20 bg-black/30 px-4 py-3 text-white placeholder-zinc-500 transition focus:border-amber-400/70 focus:outline-none focus:ring-4 focus:ring-amber-400/10"
              />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-label="Password"
                required
                placeholder="Password"
                className="w-full rounded-xl border border-amber-400/20 bg-black/30 px-4 py-3 text-white placeholder-zinc-500 transition focus:border-amber-400/70 focus:outline-none focus:ring-4 focus:ring-amber-400/10"
              />

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-center text-sm text-red-300"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full rounded-xl bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 py-3 text-base font-bold text-white shadow-lg shadow-amber-500/25 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={20} className="mx-auto animate-spin" />
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          ) : isModerator ? (
            <div className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-center text-sm text-red-300"
                >
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleContinueAsModerator}
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 py-3 text-base font-bold text-white shadow-lg shadow-amber-500/25 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue as moderator
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
                autoComplete="off"
                inputMode="numeric"
                aria-label="Admin PIN"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'pin-error' : undefined}
                className="w-full rounded-xl border border-amber-400/20 bg-black/30 px-4 py-3 text-center text-2xl tracking-[0.5em] text-white placeholder-zinc-700 transition-all duration-200 focus:border-amber-400/70 focus:outline-none focus:ring-4 focus:ring-amber-400/10"
                placeholder="••••••"
              />

              {error && (
                <div
                  id="pin-error"
                  role="alert"
                  className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-center text-sm text-red-300"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !pin.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 py-3 text-base font-bold text-white shadow-lg shadow-amber-500/25 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={20} className="mx-auto animate-spin" />
                ) : (
                  'Unlock'
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Component-scoped pure dark-gold background animations */}
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