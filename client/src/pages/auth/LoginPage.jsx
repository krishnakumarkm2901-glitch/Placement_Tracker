import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { VscGithubInverted } from 'react-icons/vsc';
import { HiOutlineEnvelope, HiOutlineLockClosed, HiEye, HiEyeSlash } from 'react-icons/hi2';
import { toast } from 'react-toastify';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function LoginPage() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    logout();
  }, [logout]);

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const loggedInUser = await login(data.email, data.password);
      toast.success('Welcome to Placement_Tracker!');
      navigate(loggedInUser.role === 'admin' ? '/dashboard' : '/student');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Branding */}
      <div className="hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2Mmgxem0tMi0xMGwxMCAxMEg0NGwyLTJ2LThIMzR6TTI4IDI0SDI0djRoNHYtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <VscGithubInverted className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold font-display text-white">Placement_Tracker</h1>
                <p className="text-primary-200 text-sm">Enterprise Analytics Platform</p>
              </div>
            </div>
            <h2 className="text-2xl xl:text-3xl font-semibold text-white leading-relaxed mb-4">
              Track student coding progress with real-time GitHub analytics
            </h2>
            <p className="text-primary-200 leading-relaxed max-w-md">
              Monitor repositories, contributions, commit activity, and more. Generate reports, rankings, and insights to drive better outcomes.
            </p>
            <div className="flex items-center gap-6 mt-10">
              {[
                { label: 'Students', value: '10K+' },
                { label: 'Repos Tracked', value: '50K+' },
                { label: 'Colleges', value: '100+' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-primary-200">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-surface-50 dark:bg-surface-950">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Centered logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <img src="/img/nit.jpg" alt="NIT Logo" className="w-12 h-12 rounded-md object-contain" />
            <div>
              <h1 className="text-2xl font-bold font-display gradient-text">Placement_Tracker</h1>
              <p className="text-xs text-surface-400">Analytics Platform</p>
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-center text-surface-900 dark:text-white font-display">
            Account Login
          </h2>
          <p className="text-surface-500 text-center mt-2 mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" autoComplete="off">
            <Input
              label="Email Address"
              type="email"
              placeholder=""
              autoComplete="off"
              icon={HiOutlineEnvelope}
              error={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+$/, message: 'Invalid email' },
              })}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPass ? 'text' : 'password'}
                placeholder=""
                autoComplete="new-password"
                icon={HiOutlineLockClosed}
                error={errors.password?.message}
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 4, message: 'Too short' },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-[38px] text-surface-400 hover:text-surface-600"
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <HiEyeSlash className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
              </button>
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Sign In
            </Button>
          </form>

        </motion.div>
      </div>
    </div>
  );
}
