import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { api } from '../../api/client';

export default function CandidateDashboard() {
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api('/attempts/mine')
      .then((data) => setAssignments(data.assignments))
      .catch((err) => setError(err.message));
  }, []);

  async function startOrResume(item) {
    setBusyId(item.assignmentId);
    setError('');
    try {
      if (item.attempt?.status === 'submitted') {
        navigate(`/candidate/attempts/${item.attempt.id}`);
        return;
      }
      if (item.attempt?.status === 'in_progress') {
        navigate(`/candidate/attempts/${item.attempt.id}`);
        return;
      }
      const data = await api('/attempts/start', {
        method: 'POST',
        body: { assignmentId: item.assignmentId },
      });
      navigate(`/candidate/attempts/${data.attempt.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout title="My assessments">
      {error ? <div className="alert">{error}</div> : null}
      <section className="panel">
        {assignments.length === 0 ? (
          <p className="muted">No published assessments assigned to you.</p>
        ) : (
          <div className="card-list">
            {assignments.map((item) => (
              <article key={item.assignmentId} className="assign-card">
                <div>
                  <h2>{item.assessment.title}</h2>
                  <p className="muted">{item.assessment.description}</p>
                  <p>
                    {item.assessment.durationMinutes} min ·{' '}
                    {item.assessment.questionCount} questions
                  </p>
                  {item.attempt ? (
                    <p>
                      Status: <strong>{item.attempt.status}</strong>
                      {item.attempt.status === 'submitted'
                        ? ` · Score ${item.attempt.score}/${item.attempt.maxScore}`
                        : item.attempt.status === 'in_progress'
                          ? ` · ${formatSeconds(item.attempt.remainingSeconds)} left`
                          : null}
                    </p>
                  ) : (
                    <p>Not started</p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyId === item.assignmentId}
                  onClick={() => startOrResume(item)}
                >
                  {item.attempt?.status === 'submitted'
                    ? 'View result'
                    : item.attempt?.status === 'in_progress'
                      ? 'Resume'
                      : 'Start'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}

function formatSeconds(total) {
  const s = Math.max(0, total || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
