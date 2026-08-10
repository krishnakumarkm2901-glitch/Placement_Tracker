import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VscGithubInverted } from 'react-icons/vsc';
import { SiCodechef, SiHackerrank, SiLeetcode } from 'react-icons/si';
import { HiOutlineDocumentArrowDown } from 'react-icons/hi2';
import { toast } from 'react-toastify';
import reportsAPI from '../../api/reports';
import studentsAPI from '../../api/students';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import DataTable from '../../components/tables/DataTable';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/feedback/LoadingSpinner';

const platforms = [
  { key: 'github', name: 'GitHub', icon: VscGithubInverted, columns: [['Repositories', 'repositories'], ['Commits', 'commits'], ['Contributions', 'contributions'], ['Streak', 'streak']] },
  { key: 'leetcode', name: 'LeetCode', icon: SiLeetcode, columns: [['Solved', 'solved'], ['Easy', 'easy'], ['Medium', 'medium'], ['Hard', 'hard'], ['Acceptance', 'acceptance_rate'], ['Current Streak', 'current_streak'], ['Max Streak', 'longest_streak']] },
  { key: 'codechef', name: 'CodeChef', icon: SiCodechef, columns: [['Rating', 'rating'], ['Stars', 'stars'], ['Problems Solved', 'problems_solved'], ['Global Rank', 'global_rank'], ['Country Rank', 'country_rank']] },
  { key: 'hackerrank', name: 'HackerRank', icon: SiHackerrank, columns: [['Badges', 'badges'], ['Certificates', 'certificates'], ['Followers', 'followers']] },
];

export default function ReportsPage() {
  const [platform, setPlatform] = useState('github');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const selected = platforms.find((item) => item.key === platform);
  const { data: departments } = useQuery({ queryKey: ['report-depts'], queryFn: studentsAPI.getDepartments, select: (response) => response.data.departments });
  const { data: years } = useQuery({ queryKey: ['report-years'], queryFn: studentsAPI.getYears, select: (response) => response.data.years });
  const { data, isLoading } = useQuery({ queryKey: ['platform-report', platform, department, year], queryFn: () => reportsAPI.getPlatformReport(platform, { department, year }), select: (response) => response.data.report });

  const exportReport = async () => {
    try {
      const response = await reportsAPI.exportPlatformReport(platform, { department, year });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a'); link.href = url; link.download = `${platform}_report.xlsx`; link.click(); URL.revokeObjectURL(url);
      toast.success(`${selected.name} report exported`);
    } catch { toast.error('Report export failed'); }
  };

  const columns = [
    { header: 'Student', accessor: 'name' }, { header: 'Department', accessor: 'department' }, { header: 'Year', accessor: 'year' }, { header: 'Username', cell: (row) => `@${row.username}` },
    ...selected.columns.map(([label, key]) => ({ header: label, cell: (row) => key === 'acceptance_rate' ? `${Number(row[key] || 0).toFixed(1)}%` : Number(row[key] || 0).toLocaleString() })),
    { header: 'Status', cell: (row) => <Badge variant={row.status === 'synced' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'} dot>{row.status}</Badge> },
  ];

  return <div className="page-container">
    <div className="mb-7"><h1 className="page-title">Reports</h1><p className="page-subtitle">View and export reports for every coding platform</p></div>
    <div className="flex flex-wrap gap-2 mb-6 border-b border-surface-200 dark:border-surface-700 pb-4">{platforms.map((item) => { const Icon = item.icon; return <button key={item.key} type="button" onClick={() => setPlatform(item.key)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold ${platform === item.key ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300' : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800'}`}><Icon className="w-5 h-5" />{item.name}</button>; })}</div>
    <Card className="mb-6"><div className="flex flex-col lg:flex-row gap-3 lg:items-end"><div className="grid sm:grid-cols-2 gap-3 flex-1"><Select label="Department" placeholder="All Departments" value={department} onChange={(event) => setDepartment(event.target.value)} options={(departments || []).map((value) => ({ value, label: value }))} /><Select label="Year" placeholder="All Years" value={year} onChange={(event) => setYear(event.target.value)} options={(years || []).map((value) => ({ value: String(value), label: `Year ${value}` }))} /></div><div className="flex gap-2"><Button variant="secondary" onClick={() => { setDepartment(''); setYear(''); }}>Clear</Button><Button icon={HiOutlineDocumentArrowDown} onClick={exportReport}>Export {selected.name}</Button></div></div></Card>
    <div className="flex items-center justify-between mb-3"><h2 className="text-xl font-bold text-surface-900 dark:text-white">{selected.name} Report</h2><span className="text-sm text-surface-500">{data?.length || 0} students</span></div>
    {isLoading ? <LoadingSpinner message={`Loading ${selected.name} report...`} /> : <DataTable columns={columns} data={data || []} />}
  </div>;
}
