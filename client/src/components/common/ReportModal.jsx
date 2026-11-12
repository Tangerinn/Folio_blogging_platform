import { useState } from 'react';
import { api } from '../../services/api/index.js';
import { Button, ErrorNote, Field, Modal, Textarea } from './ui.jsx';

export default function ReportModal({ targetType, targetId, onClose }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError(new Error('Please describe the issue before sending.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createReport({ targetType, targetId, reason: reason.trim() });
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Report this ${targetType}`} onClose={onClose} dismissible={!busy}>
      {done ? (
        <>
          <p className="mb-6 text-on-surface-variant">Thanks — an admin will take a look.</p>
          <div className="flex justify-end"><Button autoFocus onClick={onClose}>Close</Button></div>
        </>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="Reason for report" required>
            <Textarea
              rows={4}
              autoFocus
              required
              maxLength={500}
              placeholder="What’s wrong with it?"
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (error) setError(null); }}
            />
          </Field>
          <ErrorNote error={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
