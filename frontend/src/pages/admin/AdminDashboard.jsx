import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { api } from '../../api/client';

export default function AdminDashboard() {
  const [assessments, setAssessments] = useState([]);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const data = await api('/assessments');
      setAssessments(data.assessments);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await api('/assessments', {
        method: 'POST',
        body: { title, description, durationMinutes, isPublished: false },
      });
      setTitle('');
      setDescription('');
      setDurationMinutes(30);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Layout title="Admin">
      <section className="panel">
        <h2>Create assessment</h2>
        {error ? <div className="alert">{error}</div> : null}
        <form className="form-grid" onSubmit={handleCreate}>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Duration (minutes)
            <input
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              required
            />
          </label>
          <label className="full">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Assessments</h2>
        {assessments.length === 0 ? (
          <p className="muted">No assessments yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Duration</th>
                <th>Questions</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id}>
                  <td>{a.title}</td>
                  <td>{a.durationMinutes} min</td>
                  <td>{a.questionCount}</td>
                  <td>{a.isPublished ? 'Published' : 'Draft'}</td>
                  <td>
                    <Link to={`/admin/assessments/${a.id}`}>Manage</Link>
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
