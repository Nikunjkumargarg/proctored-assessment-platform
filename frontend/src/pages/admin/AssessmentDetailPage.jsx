import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { api } from '../../api/client';

const EMPTY_QUESTION = {
  text: '',
  type: 'single_choice',
  optionsText: 'A|Option A\nB|Option B\nC|Option C\nD|Option D',
  correctAnswers: 'A',
  points: 1,
};

function parseOptions(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, ...rest] = line.split('|');
      return { key: key.trim(), text: rest.join('|').trim() || key.trim() };
    });
}

export default function AssessmentDetailPage() {
  const { id } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [questionForm, setQuestionForm] = useState(EMPTY_QUESTION);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const [a, c, asg, subs] = await Promise.all([
      api(`/assessments/${id}`),
      api('/users/candidates'),
      api(`/assessments/${id}/assignments`),
      api(`/assessments/${id}/submissions`),
    ]);
    setAssessment(a.assessment);
    setCandidates(c.candidates);
    setAssignments(asg.assignments);
    setSubmissions(subs.submissions);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id]);

  async function saveMeta(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const data = await api(`/assessments/${id}`, {
        method: 'PATCH',
        body: {
          title: assessment.title,
          description: assessment.description,
          durationMinutes: assessment.durationMinutes,
          isPublished: assessment.isPublished,
          proctoringRules: assessment.proctoringRules,
        },
      });
      setAssessment(data.assessment);
      setMessage('Assessment saved');
    } catch (err) {
      setError(err.message);
    }
  }

  async function addQuestion(e) {
    e.preventDefault();
    setError('');
    try {
      const body = {
        text: questionForm.text,
        type: questionForm.type,
        points: Number(questionForm.points) || 1,
        options:
          questionForm.type === 'short_answer' ? [] : parseOptions(questionForm.optionsText),
        correctAnswers:
          questionForm.type === 'short_answer'
            ? []
            : questionForm.correctAnswers
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
      };
      const data = await api(`/assessments/${id}/questions`, { method: 'POST', body });
      setAssessment(data.assessment);
      setQuestionForm(EMPTY_QUESTION);
      setMessage('Question added');
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeQuestion(questionId) {
    if (!window.confirm('Delete this question?')) return;
    try {
      const data = await api(`/assessments/${id}/questions/${questionId}`, {
        method: 'DELETE',
      });
      setAssessment(data.assessment);
    } catch (err) {
      setError(err.message);
    }
  }

  async function assignSelected() {
    setError('');
    setMessage('');
    try {
      await api(`/assessments/${id}/assign`, {
        method: 'POST',
        body: { candidateIds: selectedCandidates },
      });
      const asg = await api(`/assessments/${id}/assignments`);
      setAssignments(asg.assignments);
      setSelectedCandidates([]);
      setMessage('Candidates assigned');
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleCandidate(cid) {
    setSelectedCandidates((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]
    );
  }

  if (!assessment) {
    return (
      <Layout title="Assessment">
        <div className="center-msg">{error || 'Loading...'}</div>
      </Layout>
    );
  }

  const rules = assessment.proctoringRules || {};

  return (
    <Layout title="Manage assessment">
      <p>
        <Link to="/admin">← Back</Link>
      </p>
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <section className="panel">
        <h2>Details & proctoring</h2>
        <form className="form-grid" onSubmit={saveMeta}>
          <label>
            Title
            <input
              value={assessment.title}
              onChange={(e) => setAssessment({ ...assessment, title: e.target.value })}
            />
          </label>
          <label>
            Duration (minutes)
            <input
              type="number"
              min={1}
              value={assessment.durationMinutes}
              onChange={(e) =>
                setAssessment({ ...assessment, durationMinutes: Number(e.target.value) })
              }
            />
          </label>
          <label className="full">
            Description
            <textarea
              rows={2}
              value={assessment.description}
              onChange={(e) => setAssessment({ ...assessment, description: e.target.value })}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={Boolean(assessment.isPublished)}
              onChange={(e) =>
                setAssessment({ ...assessment, isPublished: e.target.checked })
              }
            />
            Published (visible to assigned candidates)
          </label>

          <fieldset className="full rules">
            <legend>Proctoring capture</legend>
            {[
              ['captureTabSwitch', 'Tab switch'],
              ['captureWindowBlur', 'Window blur'],
              ['captureFullscreenExit', 'Fullscreen exit'],
              ['captureCopy', 'Copy'],
              ['capturePaste', 'Paste'],
              ['captureRightClick', 'Right-click'],
            ].map(([key, label]) => (
              <label key={key} className="checkbox">
                <input
                  type="checkbox"
                  checked={rules[key] !== false}
                  onChange={(e) =>
                    setAssessment({
                      ...assessment,
                      proctoringRules: { ...rules, [key]: e.target.checked },
                    })
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>

          <button className="btn btn-primary" type="submit">
            Save
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Questions ({assessment.questions.length})</h2>
        <ul className="question-list">
          {assessment.questions.map((q, idx) => (
            <li key={q._id}>
              <div>
                <strong>
                  Q{idx + 1}. [{q.type}] {q.text}
                </strong>
                <div className="muted">
                  {q.points} pt
                  {q.type !== 'short_answer'
                    ? ` · correct: ${(q.correctAnswers || []).join(', ')}`
                    : ' · not auto-scored'}
                </div>
                {q.options?.length ? (
                  <ul>
                    {q.options.map((o) => (
                      <li key={o.key}>
                        {o.key}: {o.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => removeQuestion(q._id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>

        <h3>Add question</h3>
        <form className="form-grid" onSubmit={addQuestion}>
          <label className="full">
            Text
            <input
              value={questionForm.text}
              onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
              required
            />
          </label>
          <label>
            Type
            <select
              value={questionForm.type}
              onChange={(e) => setQuestionForm({ ...questionForm, type: e.target.value })}
            >
              <option value="single_choice">Single Choice</option>
              <option value="multiple_choice">Multiple Choice</option>
              <option value="short_answer">Short Answer</option>
            </select>
          </label>
          <label>
            Points
            <input
              type="number"
              min={0}
              value={questionForm.points}
              onChange={(e) => setQuestionForm({ ...questionForm, points: e.target.value })}
            />
          </label>
          {questionForm.type !== 'short_answer' ? (
            <>
              <label className="full">
                Options (one per line: KEY|Text)
                <textarea
                  rows={4}
                  value={questionForm.optionsText}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, optionsText: e.target.value })
                  }
                />
              </label>
              <label className="full">
                Correct answer keys (comma-separated)
                <input
                  value={questionForm.correctAnswers}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, correctAnswers: e.target.value })
                  }
                  placeholder="A or A,B,D"
                  required
                />
              </label>
            </>
          ) : null}
          <button className="btn btn-primary" type="submit">
            Add question
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Assign candidates</h2>
        <div className="candidate-pick">
          {candidates.map((c) => (
            <label key={c.id} className="checkbox">
              <input
                type="checkbox"
                checked={selectedCandidates.includes(c.id)}
                onChange={() => toggleCandidate(c.id)}
              />
              {c.name} ({c.email})
            </label>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!selectedCandidates.length}
          onClick={assignSelected}
        >
          Assign selected
        </button>
        <h3>Already assigned</h3>
        <ul>
          {assignments.map((a) => (
            <li key={a.id}>
              {a.candidate?.name} ({a.candidate?.email})
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Submissions</h2>
        {submissions.length === 0 ? (
          <p className="muted">No attempts yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Status</th>
                <th>Score</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td>{s.candidate?.name}</td>
                  <td>{s.status}</td>
                  <td>
                    {s.status === 'submitted' ? `${s.score} / ${s.maxScore}` : '—'}
                  </td>
                  <td>
                    {s.submittedAt ? new Date(s.submittedAt).toLocaleString() : '—'}
                  </td>
                  <td>
                    <Link to={`/admin/attempts/${s.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </Layout>
  );
}
