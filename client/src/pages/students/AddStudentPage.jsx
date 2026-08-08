import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import studentsAPI from '../../api/students';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { HiOutlineArrowLeft, HiOutlineUserPlus } from 'react-icons/hi2';
import { toast } from 'react-toastify';

const DEPARTMENTS = [
  { value: 'CSE', label: 'Computer Science & Engineering' },
  { value: 'IT', label: 'Information Technology' },
  { value: 'AIML', label: 'AI & Machine Learning' },
  { value: 'CSE-CS', label: 'CSE - Cyber Security' },
  { value: 'CCS', label: 'CCS' },
];

const YEARS = [
  { value: '1', label: '1st Year' },
  { value: '2', label: '2nd Year' },
  { value: '3', label: '3rd Year' },
  { value: '4', label: '4th Year' },
];

export default function AddStudentPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm();

  const mutation = useMutation({
    mutationFn: (data) => studentsAPI.create(data),
    onSuccess: (response) => {
      const msg = response.data?.message || 'Student platform data saved. Fetching profiles...';
      toast.success(msg);
      qc.invalidateQueries(['students']);
      navigate(`/students/${response.data.student.id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to add student');
    },
  });

  const onSubmit = (data) => mutation.mutate(data);

  return (
    <div className="page-container max-w-4xl">
      <Button variant="ghost" onClick={() => navigate('/students')} icon={HiOutlineArrowLeft} size="sm" className="mb-6">
        Back to Students
      </Button>

      <Card>
        <CardHeader title="Add Student" subtitle="Enter platform usernames (GitHub, LeetCode, CodeChef, HackerRank) and Placement_Tracker will fetch profiles and activity automatically" />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Student Name"
              placeholder="John Doe"
              helper="Optional — full name of the student"
              {...register('name')}
            />
            <Input
              label="Email *"
              type="email"
              placeholder="john@college.edu"
              error={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+$/, message: 'Invalid email' },
              })}
            />
            <Input
              label="GitHub Username"
              placeholder="octocat"
              helper="Public GitHub profile username"
              error={errors.github_username?.message}
              {...register('github_username', {
                setValueAs: (value) => (value || '').trim().replace(/^https?:\/\/(?:www\.)?github\.com\//i, '').replace(/^@/, '').replace(/\/$/, '').split('/')[0],
              })}
            />
            <Input label="LeetCode Username" placeholder="leetcode_username" helper="Public LeetCode profile username" {...register('leetcode_username')} />
            <Input label="CodeChef Username" placeholder="codechef_username" helper="Public CodeChef profile username" {...register('codechef_username')} />
            <Input label="HackerRank Username" placeholder="hackerrank_username" helper="Public HackerRank profile username" {...register('hackerrank_username')} />
            <Select
              label="Department *"
              placeholder="Select Department"
              options={DEPARTMENTS}
              error={errors.department?.message}
              {...register('department', { required: 'Department is required' })}
            />
            <Select
              label="Year *"
              placeholder="Select Year"
              options={YEARS}
              error={errors.year?.message}
              {...register('year', { required: 'Year is required' })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-200 dark:border-surface-700">
            <Button variant="secondary" type="button" onClick={() => navigate('/students')}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending} icon={HiOutlineUserPlus}>
              Add and Fetch Platform Data
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
