import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../api';
export function AuthDialog({ close }: { close: () => void }) {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = signup
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          })
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) close();
      else
        setMessage(
          'Check your email to confirm your account, then sign in. Demo records are kept separate from your account.',
        );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={signup ? 'Start your next chapter' : 'Welcome back'}
      close={() => !busy && close()}
    >
      {!supabase ? (
        <>
          <p>
            This deployment is in demo mode. You can explore every workspace feature without
            creating an account.
          </p>
          <p>
            To enable personal accounts and cloud storage, follow the Supabase setup in the project
            README and add the environment variables before deploying.
          </p>
          <button className="button primary" onClick={close}>
            Explore the demo
            <ArrowRight size={16} />
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <p className="form-intro">
            Your applications, saved securely in your personal workspace.
          </p>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              minLength={8}
              required
              autoComplete={signup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {message && <p role="status">{message}</p>}
          <div className="form-actions">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => {
                setSignup(!signup);
                setMessage('');
              }}
            >
              {signup ? 'Have an account?' : 'Create account'}
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
