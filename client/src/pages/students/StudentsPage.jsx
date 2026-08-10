import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import studentsAPI from '../../api/students';
import githubAPI from '../../api/github';
import DataTable from '../../components/tables/DataTable';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import LoadingSpinner from '../../components/feedback/LoadingSpinner';
import EmptyState from '../../components/feedback/EmptyState';
import { useDebounce } from '../../hooks/useDebounce';
import {
  HiOutlineMagnifyingGlass,
  HiOutlinePlus,
  HiOutlineAcademicCap,
  HiOutlineFunnel,
  HiOutlineArrowPath,
  HiOutlineArrowUpTray,
  HiOutlineTrash,
} from 'react-icons/hi2';
import { toast } from 'react-toastify';

function PlatformStatus({ row, platform }) {
  const username = platform === 'github'
    ? row.github_username
    : (row.platform_usernames?.[platform] || row[`${platform}_username`]);
  if (!username || !String(username).trim()) return null;
  const status = platform === 'github'
    ? row.sync_status || 'pending'
    : row.platform_profiles?.[platform]?.status || 'pending';
  return <Badge variant={status === 'synced' ? 'success' : status === 'failed' ? 'danger' : 'warning'} dot>{status}</Badge>;
}

export default function StudentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const importInputRef = useRef(null);

  const debouncedSearch = useDebounce(search);

  const { data: syncStatus } = useQuery({
    queryKey: ['github-sync-status'],
    queryFn: () => githubAPI.getStatus(),
    select: (res) => res.data,
    staleTime: 10000,
    refetchInterval: (query) => (query.state.data?.is_syncing ? 1000 : false),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['students', debouncedSearch, page, department, year, sortBy],
    queryFn: () =>
      studentsAPI.getAll({
        search: debouncedSearch,
        page,
        limit: 20,
        department,
        year,
        sort_by: sortBy,
        sort_order: sortBy === 'name' ? 'asc' : 'desc',
      }),
    select: (res) => res.data,
    placeholderData: (previousData) => {
      if (previousData) return previousData;
      const cached = queryClient.getQueriesData({ queryKey: ['students'] });
      for (const [_, val] of cached) {
        if (val?.data?.students?.length) return val.data;
      }
      return undefined;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchInterval: () => (syncStatus?.is_syncing ? 1000 : false),
  });

  const { data: deptData } = useQuery({
    queryKey: ['departments-list'],
    queryFn: () => studentsAPI.getDepartments(),
    select: (res) => res.data.departments,
    staleTime: 60000,
  });

  const { data: yearsData } = useQuery({
    queryKey: ['years-list'],
    queryFn: () => studentsAPI.getYears(),
    select: (res) => res.data.years,
    staleTime: 60000,
  });

  const [platformSync, setPlatformSync] = useState('github');

  const syncMutation = useMutation({
    mutationFn: () => githubAPI.syncAll(),
    onSuccess: (res) => {
      if (res.data?.nothing_to_sync) {
        toast.info(res.data.message || 'Nothing to sync. All platform profiles are already up to date!');
      } else {
        toast.success('All-platform data sync started');
      }
      queryClient.invalidateQueries({ queryKey: ['github-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Could not start platform sync'),
  });

  const syncPlatformMutation = useMutation({
    mutationFn: (platform) => githubAPI.syncPlatform(platform),
    onSuccess: (res, platform) => {
      if (res.data?.nothing_to_sync) {
        toast.info(res.data.message || `Nothing to sync. All ${platform} profiles are already up to date!`);
      } else {
        toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} sync started`);
      }
      queryClient.invalidateQueries({ queryKey: ['github-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Could not start platform sync'),
  });

  const isSyncing = Boolean(syncStatus?.is_syncing || syncMutation.isPending || syncPlatformMutation.isLoading);

  const importMutation = useMutation({
    mutationFn: studentsAPI.importExcel,
    onSuccess: ({ data: result }) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['departments-list'] });
      queryClient.invalidateQueries({ queryKey: ['years-list'] });
      const summary = `${result.imported_count} imported${result.failed_count ? `, ${result.failed_count} skipped` : ''}`;
      result.imported_count ? toast.success(summary) : toast.warning(summary);
      if (result.errors?.length) {
        toast.info(result.errors.slice(0, 3).map((item) => `Row ${item.row}: ${item.error}`).join(' | '), { autoClose: 10000 });
      }
    },
    onError: (error) => toast.error(error.response?.data?.error || error.message || 'Excel import failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids) => studentsAPI.delete(ids),
    onSuccess: (_, ids) => {
      setSelectedIds([]);
      queryClient.invalidateQueries();
      queryClient.invalidateQueries({ queryKey: ['departments-list'] });
      queryClient.invalidateQueries({ queryKey: ['years-list'] });
      const count = Array.isArray(ids) ? ids.length : 1;
      toast.success(`${count} student${count === 1 ? '' : 's'} deleted`);
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Could not delete selected students'),
  });

  const visibleIds = (data?.students || []).map((student) => student.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const toggleSelectAll = () => {
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  };
  const confirmDelete = (ids) => {
    if (!ids.length) return;
    const message = ids.length === 1 ? 'Delete this student?' : `Delete ${ids.length} selected students?`;
    if (window.confirm(message)) deleteMutation.mutate(ids);
  };

  useEffect(() => {
    const activeSearch = new URLSearchParams(location.search).get('search') || '';
    if (activeSearch !== search) {
      setSearch(activeSearch);
    }
  }, [location.search]);

  useEffect(() => {
    if (syncStatus?.last_status === 'completed') {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    }
  }, [syncStatus?.last_sync, syncStatus?.last_status, queryClient]);

  const columns = [
    {
      header: <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Select all students on this page" className="h-4 w-4 accent-primary-600" />,
      cell: (row) => <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => setSelectedIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} aria-label={`Select ${row.name}`} className="h-4 w-4 accent-primary-600" />,
    },
    {
      header: 'Student',
      cell: (row) => (
          <div className="flex items-center gap-3">
            <Avatar src={row.avatar_url} name={row.name} size="md" />
            <div className="min-w-0">
              <p className="font-medium text-surface-900 dark:text-white truncate">{row.name}</p>
              <p className="text-xs text-surface-400 truncate">@{row.github_username || Object.values(row.platform_usernames || {})[0] || ''}</p>
            </div>
          </div>
        ),
    },
    { header: 'Department', accessor: 'department' },
    { header: 'Year', accessor: 'year' },
    { header: 'GitHub', cell: (row) => <PlatformStatus row={row} platform="github" /> },
    { header: 'LeetCode', cell: (row) => <PlatformStatus row={row} platform="leetcode" /> },
    { header: 'CodeChef', cell: (row) => <PlatformStatus row={row} platform="codechef" /> },
    { header: 'HackerRank', cell: (row) => <PlatformStatus row={row} platform="hackerrank" /> },
    {
      header: 'Action',
      cell: (row) => <Button variant="danger" size="sm" icon={HiOutlineTrash} onClick={() => confirmDelete([row.id])} disabled={deleteMutation.isPending}>Delete</Button>,
    },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">Manage and monitor student activity across all coding platforms</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.length > 0 && (
            <Button variant="danger" onClick={() => confirmDelete(selectedIds)} icon={HiOutlineTrash} loading={deleteMutation.isPending} disabled={deleteMutation.isPending} size="sm">
              Delete Selected ({selectedIds.length})
            </Button>
          )}
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importMutation.mutate(file);
              event.target.value = '';
            }}
          />
          <Button variant="secondary" onClick={() => importInputRef.current?.click()} icon={HiOutlineArrowUpTray} loading={importMutation.isPending} disabled={importMutation.isPending} size="sm">
            Import Excel
          </Button>
          <Button
            variant="secondary"
            onClick={() => syncMutation.mutate()}
            icon={HiOutlineArrowPath}
            loading={isSyncing}
            disabled={isSyncing}
            size="sm"
          >
            {syncStatus?.is_syncing
              ? `Syncing ${syncStatus.progress || 0}/${syncStatus.total || 0}`
              : 'Fetch All Platform Data'}
          </Button>
          <div className="relative inline-flex">
            <select
              value={platformSync}
              onChange={(event) => setPlatformSync(event.target.value)}
              className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 focus:border-primary-500 focus:outline-none dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200"
            >
              <option value="github">GitHub</option>
              <option value="leetcode">LeetCode</option>
              <option value="codechef">CodeChef</option>
              <option value="hackerrank">HackerRank</option>
            </select>
            <Button
              variant="secondary"
              onClick={() => syncPlatformMutation.mutate(platformSync)}
              icon={HiOutlineArrowPath}
              loading={syncPlatformMutation.isLoading}
              disabled={syncPlatformMutation.isLoading}
              size="sm"
              className="ml-2"
            >
              Sync {platformSync}
            </Button>
          </div>
          <Button onClick={() => navigate('/students/add')} icon={HiOutlinePlus} size="sm">
            Add Student
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="glass-card-solid p-4 mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by student name or username..."
              icon={HiOutlineMagnifyingGlass}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            icon={HiOutlineFunnel}
            size="sm"
          >
            Filters
          </Button>
        </div>

        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-surface-200 dark:border-surface-700"
          >
            <Select
              placeholder="All Departments"
              value={department}
              onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
              options={(deptData || []).map((d) => ({ value: d, label: d }))}
            />
            <Select
              placeholder="All Years"
              value={year}
              onChange={(e) => { setYear(e.target.value); setPage(1); }}
              options={(yearsData || []).map((y) => ({ value: y, label: `Year ${y}` }))}
            />
            <Button variant="ghost" onClick={() => { setSearch(''); setDepartment(''); setYear(''); setSortBy('name'); setPage(1); }} size="sm">
              Clear Filters
            </Button>
          </motion.div>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSpinner message="Loading student records..." />
      ) : data?.students?.length ? (
        <DataTable
          columns={columns}
          data={data.students}
          pagination={data.pagination}
          onPageChange={setPage}
        />
      ) : (
        <EmptyState
          icon={HiOutlineAcademicCap}
          title="No students found"
          description="Add students to start tracking their coding-platform activity"
          action={
            <Button onClick={() => navigate('/students/add')} icon={HiOutlinePlus}>
              Add Your First Student
            </Button>
          }
        />
      )}
    </div>
  );
}
