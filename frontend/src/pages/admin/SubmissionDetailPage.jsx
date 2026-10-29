import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { api } from '../../api/client';

const EVENT_LABELS = {
  tab_switch: 'Tab switch',
  window_blur: 'Window blur',
  fullscreen_exit: 'Fullscreen exit',
  copy_attempt: 'Copy attempt',
  paste_attempt: 'Paste attempt',
  right_click_attempt: 'Right-click attempt',
};

export default function SubmissionDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/attempts/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <Layout title="Submission">
        <div className="alert">{error}</div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout title="Submission">
        <div className="center-msg">Loading...</div>
      </Layout>
    );
  }

  const { attempt, assessment, proctoringEvents = [] } = data;
  const answerMap = new Map(
    (attempt.answers || []).map((a) => [String(a.questionId), a.value])
  );

  return (
    <Layout title="Submission detail">
      <p>
        <Link to={`/admin/assessments/${assessment._id}`}>← Back to assessment</Link>
      </p>

      <section className="panel">
        <h2>{assessment.title}</h2>
        <p>
          Status: <strong>{attempt.status}</strong>
          {attempt.status === 'submitted' ? (
            <>
              {' '}
              · Score: <strong>
                {attempt.score} / {attempt.maxScore}
              </strong>
            </>
          ) : null}
        </p>
        <p className="muted">
          Started {new Date(attempt.startedAt).toLocaleString()}
          {attempt.submittedAt
            ? ` · Submitted ${new Date(attempt.submittedAt).toLocaleString()}`
            : ''}
        </p>
      </section>

      <section className="panel">
        <h2>Answers</h2>
        <ol className="answer-review">
          {assessment.questions.map((q) => {
            const value = answerMap.get(String(q._id));
            return (
              <li key={q._id}>
                <div>
                  <strong>[{q.type}]</strong> {q.text}
                </div>
                <div>Response: {formatValue(value)}</div>
                {q.type !== 'short_answer' ? (
                  <div className="muted">
                    Correct: {(q.correctAnswers || []).join(', ')}
                  </div>
                ) : (
                  <div className="muted">Short answer — not auto-scored</div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="panel">
        <h2>Proctoring timeline ({proctoringEvents.length})</h2>
        {proctoringEvents.length === 0 ? (
          <p className="muted">No events recorded.</p>
        ) : (
          <ul className="timeline">
            {proctoringEvents.map((e) => (
              <li key={e.id}>
                <time>{new Date(e.occurredAt).toLocaleString()}</time>
                <span>{EVENT_LABELS[e.type] || e.type}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}

function formatValue(value) {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ') || '—';
  return String(value);
}
