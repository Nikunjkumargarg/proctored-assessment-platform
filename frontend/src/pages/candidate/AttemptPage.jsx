import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { api } from '../../api/client';
import { useProctoring } from '../../hooks/useProctoring';

export default function AttemptPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(0);
  const [saveState, setSaveState] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dirtyRef = useRef(false);
  const answersRef = useRef({});

  const load = useCallback(async () => {
    const data = await api(`/attempts/${id}`);
    setAssessment(data.assessment);
    setAttempt(data.attempt);
    setRemaining(data.remainingSeconds || 0);
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

  // Local countdown; resync from server every 30s
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return undefined;

    const tick = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);

    const sync = setInterval(() => {
      api(`/attempts/${id}/timer`)
        .then((t) => {
          setRemaining(t.remainingSeconds);
          if (t.status === 'submitted') {
            load();
          }
        })
        .catch(() => {});
    }, 30000);

    return () => {
      clearInterval(tick);
      clearInterval(sync);
    };
  }, [attempt, id, load]);

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

  async function handleSubmit() {
    if (!window.confirm('Submit assessment? You cannot change answers after this.')) return;
    setSubmitting(true);
    setError('');
    try {
      await api(`/attempts/${id}/submit`, {
        method: 'POST',
        body: { answers: buildAnswerPayload() },
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const timeLabel = useMemo(() => formatSeconds(remaining), [remaining]);

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
        <div>
          <strong>{assessment.title}</strong>
          <span className={`timer ${remaining <= 60 ? 'danger' : ''}`}>
            Time left: {timeLabel}
          </span>
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
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>

      {error ? <div className="alert">{error}</div> : null}
      {remaining === 0 ? (
        <div className="alert">
          Time has expired. Please submit your answers (auto-submit is a good-to-have and not
          enabled in this core build).
        </div>
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
  const s = Math.max(0, total || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
