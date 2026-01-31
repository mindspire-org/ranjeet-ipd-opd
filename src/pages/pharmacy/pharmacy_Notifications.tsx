import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCircle,
  Clock,
  RefreshCw,
  Trash2,
  CheckCheck,
} from "lucide-react";
import { pharmacyApi } from "../../utils/api";

type Notification = {
  _id: string;
  type:
    | "low_stock"
    | "expiring_soon"
    | "purchase"
    | "finance"
    | "closing_balance"
    | "alert";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical" | "success";
  read: boolean;
  createdAt: string;
  metadata?: any;
};

export default function Pharmacy_Notifications() {
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [readFilter, setReadFilter] = useState("");

  const unreadCount = useMemo(() => list.filter((n) => !n.read).length, [list]);

  const load = async () => {
    try {
      setLoading(true);
      const readParam =
        readFilter === "read"
          ? true
          : readFilter === "unread"
            ? false
            : undefined;
      const res: any = await pharmacyApi.getNotifications({
        page,
        limit,
        search: search || undefined,
        severity: (severity || undefined) as any,
        read: readParam,
      });
      const arr: Notification[] = (res?.notifications ||
        res?.items ||
        []) as Notification[];
      setList(Array.isArray(arr) ? arr : []);
      const tp = Number(res?.totalPages || 0);
      if (!isNaN(tp) && tp > 0) setTotalPages(tp);
      else {
        const total = Number(res?.total);
        if (!isNaN(total) && limit > 0)
          setTotalPages(Math.max(1, Math.ceil(total / limit)));
        else setTotalPages(arr.length < limit ? page : page + 1);
      }
      const newTp =
        Number(res?.totalPages || 0) ||
        (Number(res?.total)
          ? Math.max(1, Math.ceil(Number(res.total) / limit))
          : totalPages);
      if (newTp > 0 && page > newTp) setPage(newTp);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, limit, search, severity, readFilter]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/20 dark:border-rose-700 dark:text-rose-300";
      case "warning":
        return "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300";
      case "success":
        return "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300";
      default:
        return "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300";
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await pharmacyApi.markNotificationRead(id);
    } catch {}
    setList((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n)),
    );
  };

  const markAllRead = async () => {
    try {
      await pharmacyApi.markAllNotificationsRead();
    } catch {}
    await load();
  };

  const remove = async (id: string) => {
    try {
      await pharmacyApi.deleteNotification(id);
    } catch {}
    setList((prev) => prev.filter((n) => n._id !== id));
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">Notifications</div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500">Unread: {unreadCount}</div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0 || loading}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[220px]">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Search title or message..."
          />
        </div>
        <select
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
        >
          <option value="">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
          <option value="success">Success</option>
        </select>
        <select
          value={readFilter}
          onChange={(e) => {
            setReadFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
        >
          <option value="">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"></div>
          </div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="mx-auto mb-2 h-12 w-12 text-slate-300" />
            <p className="text-sm text-slate-600">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {list
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              )
              .map((n) => (
                <div
                  key={n._id}
                  className="flex items-start justify-between gap-3 p-4"
                >
                  <div
                    className={`flex-1 min-w-0 rounded-lg border p-3 ${getSeverityColor(n.severity)} ${!n.read ? "ring-1 ring-indigo-400/40" : ""}`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <div className="text-sm font-bold truncate">
                        {n.title}
                      </div>
                      {!n.read && (
                        <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
                      )}
                    </div>
                    <div className="text-sm">{n.message}</div>
                    <div className="mt-1 flex items-center gap-1 text-xs opacity-70">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!n.read && (
                      <button
                        onClick={() => markAsRead(n._id)}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        <CheckCircle className="mr-1 inline h-3.5 w-3.5" /> Read
                      </button>
                    )}
                    <button
                      onClick={() => remove(n._id)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-sm">
        <div className="text-slate-600">
          Page {page} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value) || 10);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button
            onClick={() => setPage(1)}
            disabled={page <= 1}
            className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
          >
            First
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
          >
            Prev
          </button>
          {Array.from(
            (() => {
              const pages: number[] = [];
              const max = Math.max(1, totalPages);
              if (max <= 7) {
                for (let i = 1; i <= max; i++) pages.push(i);
                return pages;
              }
              pages.push(1);
              const start = Math.max(2, page - 2);
              const end = Math.min(max - 1, page + 2);
              if (start > 2) pages.push(-1);
              for (let i = start; i <= end; i++) pages.push(i);
              if (end < max - 1) pages.push(-2);
              pages.push(max);
              return pages;
            })(),
          ).map((p, idx) =>
            p < 0 ? (
              <span key={`e-${idx}`} className="px-2">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`rounded-md border px-2 py-1 ${page === p ? "border-navy-600 bg-navy-50 text-navy-700" : "border-slate-200"}`}
              >
                {p}
              </button>
            ),
          )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
          >
            Next
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages}
            className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}
