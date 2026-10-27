import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Modal } from './Modal';
import { type Application, type Input, type Stage, stages, toInput, dateOffset } from '../model';
export function ApplicationEditor({
  value,
  busy,
  error,
  close,
  save,
  remove,
}: {
  value: Application | 'new';
  busy: boolean;
  error: string;
  close: () => void;
  save: (input: Input, existing?: Application) => Promise<void>;
  remove: (a: Application) => void;
}) {
  const existing = value === 'new' ? undefined : value;
  const [input, setInput] = useState<Input>(
    existing
      ? toInput(existing)
      : {
          company: '',
          role: '',
          location: '',
          stage: 'Saved',
          applied_on: null,
          follow_up: null,
          interview_on: null,
          url: null,
          notes: '',
        },
  );
  function field<K extends keyof Input>(key: K, val: Input[K]) {
    setInput((prev) => ({ ...prev, [key]: val }));
  }
  return (
    <Modal title={existing ? 'Opportunity details' : 'A new possibility'} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save({ ...input, company: input.company.trim(), role: input.role.trim() }, existing);
        }}
      >
        <p className="form-intro">
          Keep the important details close. You can update these anytime.
        </p>
        <div className="form-grid">
          <label>
            Company
            <input
              autoFocus
              required
              maxLength={100}
              value={input.company}
              onChange={(e) => field('company', e.target.value)}
              placeholder="e.g. Orbit Labs"
            />
          </label>
          <label>
            Role
            <input
              required
              maxLength={150}
              value={input.role}
              onChange={(e) => field('role', e.target.value)}
              placeholder="e.g. Software Engineering Intern"
            />
          </label>
          <label>
            Stage
            <select value={input.stage} onChange={(e) => field('stage', e.target.value as Stage)}>
              {stages.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Location
            <input
              maxLength={100}
              value={input.location}
              onChange={(e) => field('location', e.target.value)}
              placeholder="City · Remote / Hybrid"
            />
          </label>
          <label>
            Applied on
            <input
              type="date"
              max={dateOffset()}
              value={input.applied_on ?? ''}
              onChange={(e) => field('applied_on', e.target.value || null)}
            />
          </label>
          <label>
            Follow-up date
            <input
              type="date"
              value={input.follow_up ?? ''}
              onChange={(e) => field('follow_up', e.target.value || null)}
            />
          </label>
          <label>
            Interview date
            <input
              type="date"
              value={input.interview_on ?? ''}
              onChange={(e) => field('interview_on', e.target.value || null)}
            />
          </label>
          <label>
            Job listing URL
            <input
              type="url"
              pattern="https?://.*"
              maxLength={2000}
              value={input.url ?? ''}
              onChange={(e) => field('url', e.target.value || null)}
              placeholder="https://…"
            />
          </label>
          <label className="full-width">
            Notes
            <textarea
              rows={4}
              maxLength={5000}
              value={input.notes}
              onChange={(e) => field('notes', e.target.value)}
              placeholder="Interview preparation, contacts, or what excites you about this role…"
            />
          </label>
        </div>
        {input.url && /^https?:\/\//.test(input.url) && (
          <a className="listing-link" href={input.url} target="_blank" rel="noopener noreferrer">
            Open job listing
            <ExternalLink size={14} />
          </a>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          {existing && (
            <button
              type="button"
              className="delete-link"
              disabled={busy}
              onClick={() => remove(existing)}
            >
              Delete application
            </button>
          )}
          <button type="button" className="button" disabled={busy} onClick={close}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save application'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
