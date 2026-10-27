import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  LayoutDashboard,
  Columns3,
  ChartNoAxesCombined,
  CalendarDays,
  Download,
  X,
  MapPin,
  BriefcaseBusiness,
  ChevronRight,
  LogOut,
  RotateCcw,
  Check,
  Command,
  Leaf,
  LoaderCircle,
} from 'lucide-react';
import { api, supabase } from './api';
import {
  type Application,
  type Input,
  type Metrics,
  type Stage,
  stages,
  demoId,
  sampleData,
  toInput,
  dateOffset,
  formatDate,
  filterApplications,
  csvExport,
} from './model';
import { Modal } from './components/Modal';
import { ApplicationEditor } from './components/ApplicationEditor';
import { AuthDialog } from './components/AuthDialog';

const STORAGE = 'launchpad-demo-v1';
function readDemo(): Application[] {
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved) {
      const rows = JSON.parse(saved);
      if (
        Array.isArray(rows) &&
        rows.length <= 500 &&
        rows.every(
          (a) =>
            typeof a.company === 'string' &&
            typeof a.role === 'string' &&
            typeof a.location === 'string' &&
            stages.includes(a.stage) &&
            typeof a.id === 'string',
        )
      )
        return rows;
    }
  } catch {
    /* A corrupt or blocked browser store must not prevent opening the demo. */
  }
  return sampleData();
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [demo, setDemo] = useState(readDemo);
  const [remote, setRemote] = useState<Application[]>([]);
  const [page, setPage] = useState('Overview');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All stages');
  const [editing, setEditing] = useState<Application | 'new' | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [confirm, setConfirm] = useState<Application | 'reset' | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricError, setMetricError] = useState(false);
  const rows = session ? remote : demo;
  const filtered = filterApplications(rows, search, filter);
  const today = dateOffset();
  const due = rows.filter(
    (a) => a.follow_up && a.follow_up <= today && !['Closed', 'Offer'].includes(a.stage),
  );
  const interviews = rows
    .filter((a) => a.stage === 'Interview' && a.interview_on && a.interview_on >= today)
    .sort((a, b) => a.interview_on!.localeCompare(b.interview_on!));
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setRemote([]);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(demo));
    } catch {
      setError(
        'Browser storage is unavailable. Demo changes will be lost after closing this page.',
      );
    }
  }, [demo]);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    setLoading(true);
    api
      .list(session.access_token)
      .then((data) => {
        if (alive) setRemote(data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session]);
  useEffect(() => {
    const controller = new AbortController();
    setMetrics(null);
    setMetricError(false);
    const timer = setTimeout(
      () =>
        api
          .analytics(rows.map(toInput), controller.signal)
          .then(setMetrics)
          .catch((e) => {
            if (e.name !== 'AbortError') setMetricError(true);
          }),
      150,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [rows]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  async function save(input: Input, existing?: Application) {
    setBusy(true);
    setError('');
    try {
      if (!input.company.trim() || !input.role.trim())
        throw new Error('Company and role cannot be blank.');
      if (!existing && rows.length >= 500)
        throw new Error(
          'This portfolio workspace supports up to 500 applications. Export and remove old entries first.',
        );
      if (session) {
        const saved = existing
          ? await api.update(existing.id, input, session.access_token)
          : await api.create(input, session.access_token);
        setRemote((prev) =>
          existing ? prev.map((a) => (a.id === existing.id ? saved : a)) : [saved, ...prev],
        );
      } else {
        const saved = { ...input, id: existing?.id ?? demoId() };
        setDemo((prev) =>
          existing ? prev.map((a) => (a.id === existing.id ? saved : a)) : [saved, ...prev],
        );
      }
      setEditing(null);
      setNotice(existing ? 'Application updated' : 'Application added. One step closer.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm === 'reset') {
        setDemo(sampleData());
        setNotice('Demo workspace reset');
      } else if (session) {
        await api.remove(confirm.id, session.access_token);
        setRemote((prev) => prev.filter((a) => a.id !== confirm.id));
      } else setDemo((prev) => prev.filter((a) => a.id !== confirm.id));
      setConfirm(null);
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + csvExport(rows)], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `launchpad-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Workspace exported as CSV');
  }
  const nav = [
    ['Overview', LayoutDashboard],
    ['Applications', BriefcaseBusiness],
    ['Interviews', CalendarDays],
    ['Insights', ChartNoAxesCombined],
  ] as const;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage('Overview');
          }}
        >
          <span className="brand-icon">
            <ArrowUpRight size={25} />
          </span>
          launchpad<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">W</span>
          <div>
            My workspace<small>Internship season</small>
          </div>
          <span className="tiny-dot" />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={page === label ? 'nav active' : 'nav'}
              aria-current={page === label ? 'page' : undefined}
              onClick={() => setPage(label)}
            >
              <Icon size={19} />
              {label}
              {label === 'Applications' && <span className="nav-count">{rows.length}</span>}
              {label === 'Interviews' && interviews.length > 0 && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="note-card">
            <Leaf size={21} />
            <strong>Small steps. Big futures.</strong>
            <p>Your next chapter starts with one application.</p>
            <span>
              Keep going <ArrowUpRight size={15} />
            </span>
          </div>
          <div className="profile">
            <span className="avatar">
              {session ? session.user.email?.slice(0, 1).toUpperCase() : 'D'}
            </span>
            <div>
              <strong>{session ? 'Your workspace' : 'Demo explorer'}</strong>
              <small>{session ? 'Cloud sync enabled' : 'Make yourself at home'}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <span className="mode">
              <span />
              {session ? 'Personal workspace' : 'Interactive demo'}
            </span>
            {session ? (
              <button
                className="button small"
                onClick={async () => {
                  const result = await supabase!.auth.signOut();
                  if (result.error) setError(result.error.message);
                }}
              >
                <LogOut size={15} />
                Sign out
              </button>
            ) : (
              <button className="button small" onClick={() => setAuthOpen(true)}>
                Sign in <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR NEXT CHAPTER</div>
              <h1>
                {page === 'Overview'
                  ? 'A little progress, every day.'
                  : page === 'Applications'
                    ? 'Every opportunity, in one place.'
                    : page === 'Interviews'
                      ? 'Make a great first impression.'
                      : 'See the bigger picture.'}
              </h1>
              <p>
                {page === 'Overview'
                  ? 'A clear view of where you are — and what comes next.'
                  : page === 'Applications'
                    ? 'Keep the details organized. Leave room for the possibilities.'
                    : page === 'Interviews'
                      ? 'Your upcoming conversations and preparation notes.'
                      : 'Turn your application activity into a clearer next step.'}
              </p>
            </div>
            <button
              className="button primary"
              disabled={!authReady || loading || busy}
              onClick={() => setEditing('new')}
            >
              <Plus size={18} />
              Add application
            </button>
          </div>
          {!session && (
            <div className="demo-banner">
              <span className="demo-tag">DEMO</span>
              <span>
                A workspace to explore. Fictional companies, real functionality. Changes stay in
                this browser.
              </span>
              <button onClick={() => setConfirm('reset')} title="Reset demo">
                <RotateCcw size={14} />
                Reset
              </button>
            </div>
          )}
          {error && (
            <div role="alert" className="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {!authReady || loading ? (
            <div className="empty">
              <LoaderCircle className="spin" />
              Loading your workspace…
            </div>
          ) : (
            <>
              {(page === 'Overview' || page === 'Insights') && (
                <>
                  <div className="stats">
                    {[
                      [
                        'Total applications',
                        metrics?.total,
                        BriefcaseBusiness,
                        'Every opportunity counts',
                      ],
                      ['In progress', metrics?.active, ArrowUpRight, 'Applied + interviewing'],
                      ['Interviews', metrics?.interviews, CalendarDays, 'Conversations in motion'],
                      ['Offers received', metrics?.offers, Check, 'Something worth celebrating'],
                    ].map(([label, value, Icon, caption]) => {
                      const StatIcon = Icon as typeof Check;
                      return (
                        <article className="stat" key={String(label)}>
                          <div>
                            <span>{String(label)}</span>
                            <StatIcon size={17} />
                          </div>
                          <strong>
                            {value === undefined ? '—' : String(value).padStart(2, '0')}
                          </strong>
                          <small>{String(caption)}</small>
                        </article>
                      );
                    })}
                  </div>
                  {metricError && (
                    <div className="alert">
                      Python analytics is unavailable. Start the API locally or check the Vercel
                      function. Your applications are still accessible.
                    </div>
                  )}
                  <div className="insight-grid">
                    <section className="panel activity-panel">
                      <div className="panel-title">
                        <div>
                          <h2>Application activity</h2>
                          <p>Consistency builds momentum.</p>
                        </div>
                        <span className="pill">Last 6 weeks</span>
                      </div>
                      <div
                        className="chart"
                        role="img"
                        aria-label={
                          metrics
                            ? metrics.weeks
                                .map((w) => `${formatDate(w.week)}: ${w.count} applications`)
                                .join(', ')
                            : 'Analytics loading'
                        }
                      >
                        {(metrics?.weeks ?? []).map((w, i) => (
                          <div className="chart-column" key={w.week}>
                            <div className="bar-track">
                              <span
                                className={'bar ' + (i === 5 ? 'current' : '')}
                                style={{
                                  height: `${w.count ? Math.max(8, (w.count / Math.max(1, ...metrics!.weeks.map((v) => v.count))) * 100) : 0}%`,
                                }}
                              >
                                <b>{w.count}</b>
                              </span>
                            </div>
                            <small>{formatDate(w.week)}</small>
                          </div>
                        ))}
                        {!metrics && (
                          <span className="chart-placeholder">
                            {metricError ? 'Analytics offline' : 'Calculating your activity…'}
                          </span>
                        )}
                      </div>
                      <div className="chart-footer">
                        <span className="legend-dot" />
                        Applications by week <span>Powered by Python</span>
                      </div>
                    </section>
                    <section className="focus-card">
                      <div className="eyebrow">
                        YOUR NEXT MOVE <ArrowUpRight size={19} />
                      </div>
                      <h2>
                        {due.length
                          ? `${due.length} follow-up${due.length > 1 ? 's' : ''} on your radar.`
                          : 'A fresh opportunity awaits.'}
                      </h2>
                      <p>
                        {due.length
                          ? 'A thoughtful check-in can open a conversation. Start with the applications waiting for a reply.'
                          : 'Save an interesting role, prepare for your next conversation, or take a moment to celebrate your progress.'}
                      </p>
                      {due.length > 0 ? (
                        <button className="focus-next" onClick={() => setEditing(due[0])}>
                          <span className="company-avatar">{due[0].company.slice(0, 1)}</span>
                          <span>
                            <strong>{due[0].company}</strong>
                            <small>Follow up · {formatDate(due[0].follow_up)}</small>
                          </span>
                          <ArrowRight size={20} />
                        </button>
                      ) : (
                        <button className="button light" onClick={() => setEditing('new')}>
                          Find your next step
                          <ArrowRight size={16} />
                        </button>
                      )}
                      <div className="focus-orbit" aria-hidden="true" />
                    </section>
                  </div>
                </>
              )}
              {(page === 'Overview' || page === 'Applications') && (
                <section className="panel applications-panel">
                  <div className="panel-title">
                    <div className="section-title">
                      <h2>{page === 'Overview' ? 'Your applications' : 'Application pipeline'}</h2>
                      <span className="count">{rows.length}</span>
                    </div>
                    <button className="button small" onClick={exportData}>
                      <Download size={15} />
                      Export CSV
                    </button>
                  </div>
                  <div className="toolbar">
                    <div className="search-box">
                      <Search size={17} />
                      <input
                        aria-label="Search applications"
                        placeholder="Search company, role, location…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {search && (
                        <button aria-label="Clear search" onClick={() => setSearch('')}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <select
                      aria-label="Filter by stage"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option>All stages</option>
                      {stages.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <div className="view-toggle">
                      <button
                        aria-label="List view"
                        aria-pressed={view === 'list'}
                        onClick={() => setView('list')}
                      >
                        <LayoutDashboard size={17} />
                      </button>
                      <button
                        aria-label="Board view"
                        aria-pressed={view === 'board'}
                        onClick={() => setView('board')}
                      >
                        <Columns3 size={17} />
                      </button>
                    </div>
                  </div>
                  {!filtered.length ? (
                    <div className="empty">
                      <Search size={28} />
                      <h3>
                        {rows.length
                          ? 'No matching opportunities'
                          : 'Your next chapter starts here'}
                      </h3>
                      <p>
                        {rows.length
                          ? 'Try another company, role, or stage.'
                          : 'Add your first application and give your search a little structure.'}
                      </p>
                      <button
                        className="button"
                        onClick={() => {
                          if (rows.length) {
                            setSearch('');
                            setFilter('All stages');
                          } else setEditing('new');
                        }}
                      >
                        {rows.length ? 'Clear filters' : 'Add application'}
                      </button>
                    </div>
                  ) : view === 'list' ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>COMPANY & ROLE</th>
                            <th>STAGE</th>
                            <th>LOCATION</th>
                            <th>APPLIED</th>
                            <th>FOLLOW-UP</th>
                            <th>
                              <span className="sr-only">Edit</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((a, i) => (
                            <tr key={a.id}>
                              <td>
                                <button className="company-cell" onClick={() => setEditing(a)}>
                                  <span className={`company-avatar color-${i % 5}`}>
                                    {a.company.slice(0, 1)}
                                  </span>
                                  <span>
                                    <strong>{a.company}</strong>
                                    <small>{a.role}</small>
                                  </span>
                                </button>
                              </td>
                              <td>
                                <span className={`status ${a.stage.toLowerCase()}`}>
                                  <i />
                                  {a.stage}
                                </span>
                              </td>
                              <td className="location-cell">{a.location || '—'}</td>
                              <td>{a.applied_on ? formatDate(a.applied_on) : '—'}</td>
                              <td>
                                <span
                                  className={
                                    a.follow_up &&
                                    a.follow_up <= today &&
                                    !['Offer', 'Closed'].includes(a.stage)
                                      ? 'due-text'
                                      : ''
                                  }
                                >
                                  {a.follow_up ? formatDate(a.follow_up) : '—'}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="icon-button"
                                  aria-label={`Edit ${a.company}`}
                                  onClick={() => setEditing(a)}
                                >
                                  <ArrowUpRight size={17} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="board">
                      {stages
                        .filter((s) => filter === 'All stages' || filter === s)
                        .map((s) => (
                          <div className="board-column" key={s}>
                            <h3>
                              <span className={`status ${s.toLowerCase()}`}>
                                <i />
                                {s}
                              </span>
                              <span>{filtered.filter((a) => a.stage === s).length}</span>
                            </h3>
                            {filtered
                              .filter((a) => a.stage === s)
                              .map((a) => (
                                <article key={a.id} className="board-card">
                                  <button onClick={() => setEditing(a)}>
                                    <strong>{a.company}</strong>
                                    <span>{a.role}</span>
                                    <small>
                                      <MapPin size={12} />
                                      {a.location || 'Location not set'}
                                    </small>
                                  </button>
                                  <select
                                    aria-label={`Stage for ${a.company}`}
                                    value={a.stage}
                                    disabled={busy}
                                    onChange={(e) =>
                                      save({ ...toInput(a), stage: e.target.value as Stage }, a)
                                    }
                                  >
                                    {stages.map((s) => (
                                      <option key={s}>{s}</option>
                                    ))}
                                  </select>
                                </article>
                              ))}
                            {!filtered.some((a) => a.stage === s) && (
                              <p className="board-empty">Room for a new possibility.</p>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                  <div className="table-footer">
                    Showing {filtered.length} of {rows.length} applications
                    <span>Your future is a work in progress.</span>
                  </div>
                </section>
              )}
              {page === 'Interviews' && (
                <section className="interview-grid">
                  {interviews.length ? (
                    interviews.map((a) => (
                      <article className="panel interview-card" key={a.id}>
                        <div className="interview-date">
                          <CalendarDays size={20} />
                          {formatDate(a.interview_on)}
                        </div>
                        <h2>{a.company}</h2>
                        <p>{a.role}</p>
                        <div className="muted">
                          <MapPin size={15} />
                          {a.location || 'Location not set'}
                        </div>
                        <h3>Preparation notes</h3>
                        <p className="notes">
                          {a.notes || 'Add a few talking points, questions, or project highlights.'}
                        </p>
                        <button className="button" onClick={() => setEditing(a)}>
                          Prepare & edit
                          <ArrowUpRight size={16} />
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="panel empty">
                      <CalendarDays size={30} />
                      <h3>No upcoming interviews yet</h3>
                      <p>
                        Set an application to Interview and add an interview date to see it here.
                      </p>
                      <button className="button" onClick={() => setPage('Applications')}>
                        Open applications
                      </button>
                    </div>
                  )}
                </section>
              )}
              {page === 'Insights' && (
                <section className="panel breakdown">
                  <h2>Your pipeline, explained</h2>
                  <p className="muted">Current stages, not historical conversion rates.</p>
                  {stages.map((s) => (
                    <div className="stage-row" key={s}>
                      <span className={`status ${s.toLowerCase()}`}>
                        <i />
                        {s}
                      </span>
                      <div>
                        <span
                          style={{
                            width: `${metrics?.total ? (metrics.stages[s] / metrics.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <strong>{metrics?.stages[s] ?? '—'}</strong>
                    </div>
                  ))}
                  <div className="metric-explanation">
                    <strong>
                      {metrics ? `${metrics.progress_rate}%` : '—'} currently at interview or offer
                    </strong>
                    <p>
                      Interview + Offer divided by all non-Saved applications, including Closed.
                      This describes your current pipeline; it does not measure responses or predict
                      hiring success.
                    </p>
                  </div>
                </section>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <Command size={13} /> Built for the beginning of something good.
            </span>
            <span>Launchpad · v1.0</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {editing && (
        <ApplicationEditor
          value={editing}
          busy={busy}
          error={error}
          close={() => !busy && setEditing(null)}
          save={save}
          remove={(a) => setConfirm(a)}
        />
      )}
      {authOpen && <AuthDialog close={() => setAuthOpen(false)} />}
      {confirm && (
        <Modal
          title={confirm === 'reset' ? 'Reset demo workspace?' : 'Delete this application?'}
          close={() => !busy && setConfirm(null)}
        >
          <p>
            {confirm === 'reset'
              ? 'This replaces all browser-local demo changes with fresh sample applications. Account data is unaffected.'
              : `This permanently removes ${confirm.company} from your workspace.`}
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button className="button" disabled={busy} onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button className="button danger" disabled={busy} onClick={remove}>
              {busy ? 'Working…' : confirm === 'reset' ? 'Reset demo' : 'Delete application'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
