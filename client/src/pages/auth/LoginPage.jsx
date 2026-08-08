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
import Footer from '../../components/layout/Footer';

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
    <div className="min-h-screen flex flex-col justify-between bg-surface-50 dark:bg-surface-950">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
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

      <Footer />
    </div>
  );
}
