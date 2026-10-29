import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { api } from '../../api/client';
import { useProctoring } from '../../hooks/useProctoring';

function secondsUntil(endsAt) {
  if (!endsAt) return 0;
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
}

export default function AttemptPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(null);
  const [saveState, setSaveState] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dirtyRef = useRef(false);
  const answersRef = useRef({});
  const autoSubmitRef = useRef(false);
  const endsAtRef = useRef(null);

  const load = useCallback(async () => {
    const data = await api(`/attempts/${id}`);
    setAssessment(data.assessment);
    setAttempt(data.attempt);
    endsAtRef.current = data.attempt?.endsAt || null;
    const left =
      typeof data.remainingSeconds === 'number'
        ? data.remainingSeconds
        : secondsUntil(data.attempt?.endsAt);
    setRemaining(left);
    const map = {};
    for (const a of data.attempt.answers || []) {
      map[String(a.questionId)] = a.value;
    }
    setAnswers(map);
    answersRef.current = map;
    dirtyRef.current = false;
  }, [id]);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  // Countdown from server endsAt; resync every 15s
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return undefined;

    endsAtRef.current = attempt.endsAt;
    setRemaining(secondsUntil(attempt.endsAt));

    const tick = setInterval(() => {
      setRemaining(secondsUntil(endsAtRef.current));
    }, 1000);

    const sync = setInterval(() => {
      api(`/attempts/${id}/timer`)
        .then((t) => {
          if (t.endsAt) endsAtRef.current = t.endsAt;
          setRemaining(
            typeof t.remainingSeconds === 'number'
              ? t.remainingSeconds
              : secondsUntil(t.endsAt)
          );
          if (t.status === 'submitted') {
            load();
          }
        })
        .catch(() => {});
    }, 15000);

    return () => {
      clearInterval(tick);
      clearInterval(sync);
    };
  }, [attempt?.id, attempt?.status, attempt?.endsAt, id, load]);

  const buildAnswerPayload = useCallback(() => {
    return Object.entries(answersRef.current).map(([questionId, value]) => ({
      questionId,
      value,
    }));
  }, []);

  const saveAnswers = useCallback(
    async (silent = false) => {
      if (!attempt || attempt.status !== 'in_progress') return;
      if (!dirtyRef.current && silent) return;
      try {
        if (!silent) setSaveState('Saving...');
        await api(`/attempts/${id}/answers`, {
          method: 'PUT',
          body: { answers: buildAnswerPayload() },
        });
        dirtyRef.current = false;
        setSaveState(`Saved ${new Date().toLocaleTimeString()}`);
      } catch (err) {
        setSaveState(err.message || 'Save failed');
      }
    },
    [attempt, id, buildAnswerPayload]
  );

  // Autosave every 15s when dirty
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return undefined;
    const t = setInterval(() => saveAnswers(true), 15000);
    return () => clearInterval(t);
  }, [attempt, saveAnswers]);

  // Best-effort save on tab close / refresh
  useEffect(() => {
    function onLeave() {
      if (!dirtyRef.current || !attempt || attempt.status !== 'in_progress') return;
      const token = localStorage.getItem('token');
      fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/attempts/${id}/answers`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ answers: buildAnswerPayload() }),
          keepalive: true,
        }
      ).catch(() => {});
    }
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [attempt, id, buildAnswerPayload]);


  useProctoring(
    id,
    Boolean(attempt && attempt.status === 'in_progress'),
    assessment?.proctoringRules || {}
  );

  function updateAnswer(questionId, value) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      answersRef.current = next;
      dirtyRef.current = true;
      return next;
    });
    setSaveState('Unsaved changes');
  }

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      /* user may deny */
    }
  }

  const handleSubmit = useCallback(
    async ({ confirm = true, auto = false } = {}) => {
      if (submitting || attempt?.status !== 'in_progress') return;
      if (confirm && !window.confirm('Submit assessment? You cannot change answers after this.')) {
        return;
      }
      setSubmitting(true);
      setError('');
      try {
        await api(`/attempts/${id}/submit`, {
          method: 'POST',
          body: { answers: buildAnswerPayload() },
        });
        await load();
        if (auto) setSaveState('Time expired — submitted automatically');
      } catch (err) {
        setError(err.message);
        autoSubmitRef.current = false;
      } finally {
        setSubmitting(false);
      }
    },
    [attempt?.status, buildAnswerPayload, id, load, submitting]
  );

  // Auto-submit once when the countdown hits zero
  useEffect(() => {
    if (remaining !== 0 || !attempt || attempt.status !== 'in_progress') return;
    if (autoSubmitRef.current || submitting) return;
    autoSubmitRef.current = true;
    handleSubmit({ confirm: false, auto: true });
  }, [remaining, attempt, submitting, handleSubmit]);

  const timeLabel = useMemo(
    () => formatSeconds(remaining ?? 0),
    [remaining]
  );

  if (error && !attempt) {
    return (
      <Layout title="Attempt">
        <div className="alert">{error}</div>
        <Link to="/candidate">Back</Link>
      </Layout>
    );
  }

  if (!attempt || !assessment) {
    return (
      <Layout title="Attempt">
        <div className="center-msg">Loading...</div>
      </Layout>
    );
  }

  if (attempt.status === 'submitted') {
    return (
      <Layout title="Result">
        <section className="panel">
          <h2>{assessment.title}</h2>
          <p>
            Submitted · Objective score:{' '}
            <strong>
              {attempt.score} / {attempt.maxScore}
            </strong>
          </p>
          <p className="muted">Short-answer questions are not auto-scored.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/candidate')}>
            Back to assessments
          </button>
        </section>
      </Layout>
    );
  }

  return (
    <Layout title="Assessment in progress">
      <div className="attempt-bar">
        <div className="attempt-bar-title">
          <strong>{assessment.title}</strong>
          <span className="muted">
            {assessment.durationMinutes} min total
          </span>
        </div>
        <div
          className={`timer-panel ${remaining !== null && remaining <= 60 ? 'danger' : ''}`}
          aria-live="polite"
          aria-label={`Time remaining ${timeLabel}`}
        >
          <span className="timer-label">Time remaining</span>
          <span className="timer-value">{remaining === null ? '--:--' : timeLabel}</span>
        </div>
        <div className="attempt-actions">
          <span className="muted">{saveState}</span>
          <button type="button" className="btn btn-ghost" onClick={enterFullscreen}>
            Fullscreen
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => saveAnswers(false)}>
            Save now
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={submitting || remaining === 0}
            onClick={() => handleSubmit()}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>

      {error ? <div className="alert">{error}</div> : null}
      {remaining === 0 ? (
        <div className="alert">Time has expired. Submitting your answers…</div>
      ) : null}

      <section className="panel attempt-questions">
        {assessment.questions.map((q, idx) => (
          <div key={q._id} className="question-block">
            <h3>
              Q{idx + 1}. {q.text}{' '}
              <span className="muted">({q.points} pt)</span>
            </h3>

            {q.type === 'single_choice' ? (
              <div className="options">
                {q.options.map((o) => (
                  <label key={o.key} className="checkbox">
                    <input
                      type="radio"
                      name={q._id}
                      checked={answers[q._id] === o.key}
                      onChange={() => updateAnswer(q._id, o.key)}
                    />
                    {o.key}. {o.text}
                  </label>
                ))}
              </div>
            ) : null}

            {q.type === 'multiple_choice' ? (
              <div className="options">
                {q.options.map((o) => {
                  const selected = Array.isArray(answers[q._id]) ? answers[q._id] : [];
                  return (
                    <label key={o.key} className="checkbox">
                      <input
                        type="checkbox"
                        checked={selected.includes(o.key)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...selected, o.key]
                            : selected.filter((k) => k !== o.key);
                          updateAnswer(q._id, next);
                        }}
                      />
                      {o.key}. {o.text}
                    </label>
                  );
                })}
              </div>
            ) : null}

            {q.type === 'short_answer' ? (
              <textarea
                rows={3}
                value={answers[q._id] || ''}
                onChange={(e) => updateAnswer(q._id, e.target.value)}
                placeholder="Type your answer"
              />
            ) : null}
          </div>
        ))}
      </section>
    </Layout>
  );
}

function formatSeconds(total) {
  const s = Math.max(0, Math.floor(Number(total) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
