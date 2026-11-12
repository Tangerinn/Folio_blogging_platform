import { useEffect, useState } from 'react';
import { api } from '../../services/api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useAuth } from '../../state/AuthContext.jsx';
import { Button, Chip, EmptyState, ErrorNote, Input, Select, Spinner } from '../../components/common/ui.jsx';
import { PageTitle } from '../../components/common/PageShell.jsx';
import { formatDate } from '../../utils/format.js';

export default function Users() {
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, loading, error, reload } = useAsync(() => api.adminListUsers({ q: dq }), [dq]);

  const update = async (id, patch) => {
    setBusyId(id);
    setActionError(null);
    try {
      await api.adminUpdateUser(id, patch);
      reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageTitle sub="Change roles or suspend accounts.">Users</PageTitle>

      <search className="mb-6">
        <Input
          type="search"
          placeholder="Search by name or email…"
          aria-label="Search users"
          enterKeyHint="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </search>

      {(actionError || error) && <div className="mb-6"><ErrorNote error={actionError || error} /></div>}

      {loading && !data ? (
        <Spinner />
      ) : !data ? null : data.length === 0 ? (
        <EmptyState
          title="No matching users"
          action={q && <Button variant="secondary" onClick={() => { setQ(''); setDq(''); }}>Clear search</Button>}
        >
          Try another name or email address.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-panel border border-outline-variant/50 bg-surface-low">
          <table className="w-full text-left text-sm">
            <caption className="visually-hidden">Registered platform users</caption>
            <thead className="border-b border-outline-variant/50 text-on-surface-variant">
              <tr>
                <th scope="col" className="px-5 py-4 font-semibold">User</th>
                <th scope="col" className="px-5 py-4 font-semibold">Role</th>
                <th scope="col" className="px-5 py-4 font-semibold">Status</th>
                <th scope="col" className="px-5 py-4 font-semibold">Joined</th>
                <th scope="col" className="px-5 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {data.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-pine">{u.name}</p>
                    <p className="text-xs text-on-surface-variant">{u.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <Select
                      aria-label={`Role for ${u.name}`}
                      className="!w-auto !py-1.5"
                      disabled={u.id === me?.id || busyId === u.id}
                      value={u.role}
                      onChange={(e) => update(u.id, { role: e.target.value })}
                    >
                      <option value="student">Student</option>
                      <option value="admin">Admin</option>
                    </Select>
                  </td>
                  <td className="px-5 py-4">
                    <Chip tone={u.status === 'suspended' ? 'warn' : 'default'}>{u.status}</Chip>
                  </td>
                  <td className="px-5 py-4 text-on-surface-variant">{formatDate(u.createdAt)}</td>
                  <td className="px-5 py-4 text-right">
                    {u.id !== me?.id && (
                      <Button
                        variant={u.status === 'active' ? 'outline' : 'secondary'}
                        className="!py-1.5"
                        disabled={busyId === u.id}
                        onClick={() => update(u.id, { status: u.status === 'active' ? 'suspended' : 'active' })}
                      >
                        {u.status === 'active' ? 'Suspend' : 'Reinstate'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
