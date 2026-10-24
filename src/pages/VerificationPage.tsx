import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/Logo';
import {
  Upload,
  Loader2,
  ShieldCheck,
  Clock,
  XCircle,
  LogOut,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  Camera,
} from 'lucide-react';

interface VerificationPageProps {
  onSignOut: () => void;
}

function VerificationInstructions() {
  return (
    <section className="relative mt-5 w-full overflow-hidden rounded-2xl border border-amber-500/20 bg-[#0c1126]/90 p-5 shadow-xl backdrop-blur-md sm:p-6">
      <div className="relative mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
          <FileCheck2 size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-amber-100">ID Upload Guidelines</h2>
          <p className="text-xs text-amber-400/60">Ensure your submission meets these requirements for fast approval.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/15 bg-[#101733] p-3 text-xs text-amber-200/80">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
          <div>
            <strong className="block font-semibold text-amber-100">College Issued ID Card</strong>
            College ID Cards Are Accepted.
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/15 bg-[#101733] p-3 text-xs text-amber-200/80">
          <Camera size={16} className="mt-0.5 shrink-0 text-amber-300" />
          <div>
            <strong className="block font-semibold text-amber-100">Clear & Uncropped</strong>
            Ensure all four corners of the ID are visible with no glare or blur.
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/15 bg-[#101733] p-3 text-xs text-amber-200/80">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-400" />
          <div>
            <strong className="block font-semibold text-amber-100">Valid Expiration Date</strong>
            Expired documents or unreadable details will result in rejection.
          </div>
        </div>
      </div>
    </section>
  );
}

export default function VerificationPage({
  onSignOut,
}: VerificationPageProps) {
  const { profile, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const status = profile?.verification_status ?? 'unverified';

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];

    // Allow selecting the same file again after an attempt.
    input.value = '';

    if (!file) return;

    if (!profile?.id) {
      setError('Your profile is not available. Please sign in again.');
      return;
    }

    setError('');
    setSuccess(false);
    setUploading(true);

    try {
      const fileExt =
        file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
      const fileName =
        `${profile.id}/id_card_${Date.now()}_${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('id-cards')
        .upload(fileName, file, {
          contentType: file.type || undefined,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Store the private bucket path, not a public URL.
      // The database trigger changes verification_status to "pending".
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ id_card_url: fileName })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setSuccess(true);

      try {
        await refreshProfile();
      } catch (refreshError) {
        console.error('Profile refresh failed after upload:', refreshError);
      }
    } catch (uploadError) {
      console.error('ID card upload failed:', uploadError);
      setError('Failed to upload ID card. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const renderStatusContent = () => {
    switch (status) {
      case 'verified':
        return (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <ShieldCheck size={40} className="text-emerald-400" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-amber-100">Verified!</h2>
            <p className="text-sm font-medium text-amber-400/60">
              Your account is verified. Loading your feed...
            </p>
          </div>
        );

      case 'pending':
        return (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
              <Clock size={40} className="animate-pulse text-amber-300" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-amber-100">
              Pending Review
            </h2>
            <p className="mb-6 text-xs font-medium text-amber-400/60">
              Your ID card has been submitted and is being reviewed by our
              admin team. You will gain access once approved.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 text-xs font-bold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin text-amber-300" />
              ) : (
                <Upload size={16} className="text-amber-300" />
              )}
              {uploading ? 'Uploading...' : 'Re-upload ID'}
            </button>
          </div>
        );

      case 'rejected':
        return (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/30">
              <XCircle size={40} className="text-rose-400" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-rose-300">
              Verification Rejected
            </h2>
            <p className="mb-6 text-xs font-medium text-amber-400/60">
              Please upload a clear image of your valid ID card.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 px-5 text-xs font-bold text-slate-950 shadow-md transition hover:brightness-110 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              {uploading ? 'Uploading...' : 'Upload New ID'}
            </button>
          </div>
        );

      default:
        return (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
              <Upload size={40} className="text-amber-300" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-amber-100">
              Verify Your Identity
            </h2>
            <p className="mb-6 text-xs font-medium text-amber-400/60">
              Please upload a valid ID card to verify your account and gain
              full access.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 px-5 text-xs font-bold text-slate-950 shadow-md transition hover:brightness-110 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              {uploading ? 'Uploading...' : 'Upload ID Card'}
            </button>
          </div>
        );
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#060913] p-4 py-8 text-amber-50">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-amber-600/10 blur-3xl" />
        <div className="absolute -right-32 bottom-10 h-80 w-80 rounded-full bg-amber-700/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(245,158,11,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,.12)_1px,transparent_1px)] [background-size:44px_44px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-amber-500/20 bg-[#0c1126]/90 p-6 shadow-[0_20px_50px_-20px_rgba(217,119,6,0.25)] backdrop-blur-xl sm:p-8">
          <div className="mb-8 flex items-center justify-between">
            <Logo />
            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-400/60 transition hover:bg-amber-500/10 hover:text-amber-200"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300"
            >
              ID uploaded successfully! Status updated to pending.
            </div>
          )}

          {renderStatusContent()}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            accept="image/*"
            disabled={uploading}
            className="hidden"
          />
        </div>

        <VerificationInstructions />
        <p className="mt-4 text-center text-xs font-medium text-amber-500/50">
          Your details are encrypted and securely reviewed by our team.
        </p>
      </div>
    </main>
  );
}