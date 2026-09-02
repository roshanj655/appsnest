import { useState, useEffect } from 'react';
import axios from 'axios';
import PageHeader from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AuditLog {
  _id: string;
  tenantId: string;
  businessId: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  action: string;
  entity: string;
  entityId?: string;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/audit-logs', {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: currentPage, limit: 20 }
      });
      setLogs(response.data.logs);
      setTotalPages(response.data.pagination.pages);
      setTotalLogs(response.data.pagination.total);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentPage]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatChanges = (changes: any) => {
    if (!changes) return null;
    try {
      return JSON.stringify(changes, null, 2);
    } catch {
      return String(changes);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Audit Logs"
        description="Review create, update, and delete activity across the tenant workspace."
        actions={<div className="text-sm font-medium text-slate-500">Total logs: {totalLogs}</div>}
      />

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-12 text-slate-500">
          <div className="text-xl">Loading...</div>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-200 bg-slate-50/70">
            <CardTitle>Activity Timeline</CardTitle>
            <CardDescription>Paginated system events with actor, entity, and change payload details.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Date/Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Entity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">IP Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Changes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {logs.map(log => (
                    <tr key={log._id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm">{formatDate(log.createdAt)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <div className="font-medium text-slate-900">{log.userId?.name}</div>
                        <div className="text-slate-500">{log.userId?.email}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          log.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                          log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                          log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <div className="font-medium">{log.entity}</div>
                        {log.entityId && (
                          <div className="font-mono text-xs text-slate-500">{log.entityId}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {log.ipAddress || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {log.changes ? (
                          <details className="text-xs text-slate-600">
                            <summary className="cursor-pointer hover:text-slate-800">View changes</summary>
                            <pre className="mt-2 max-h-40 overflow-x-auto rounded-xl bg-slate-50 p-3">{formatChanges(log.changes)}</pre>
                          </details>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {logs.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                No audit logs available
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
                <div className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AuditLogs;
