
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { DialogProvider } from './context/DialogContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import MemberDetails from './pages/MemberDetails';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import LoanCalculatorPage from './pages/LoanCalculatorPage';
import Meetings from './pages/Meetings';
import Expenses from './pages/Expenses';
import PaddyPurchase from './pages/PaddyPurchase';
import Dispatch from './pages/Dispatch';
import InventoryEntry from './pages/InventoryEntry';
import BankAudit from './pages/BankAudit';
import AIChatWidget from './components/AIChatWidget';
import { ShieldCheck, Menu, KeyRound, RotateCcw, Smartphone, Mail, ArrowLeft } from 'lucide-react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapacitorApp } from '@capacitor/app';

// Initialize Status Bar for Android
if (typeof window !== 'undefined' && (window as any).Capacitor) {
  StatusBar.setStyle({ style: Style.Dark }).catch(() => { });
  StatusBar.setBackgroundColor({ color: '#1e293b' }).catch(() => { });
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => { });
}

const LoginScreen = () => {
  const { login, resetPassword, loginWithPhone, verifyPhoneOTP, setupPhoneAuth, clearPhoneAuth } = useApp();
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [showReset, setShowReset] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-600 p-4 rounded-full">
            <ShieldCheck size={48} className="text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">Society Ilada Manager</h1>
        <p className="text-slate-400 text-center mb-8">Secure Login Required</p>

        {!showReset ? (
          <>
            {/* Login Method Tabs */}
            <div className="flex gap-2 mb-6 bg-slate-900 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setLoginMethod('email')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition ${loginMethod === 'email'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                <Mail size={18} />
                <span>Email</span>
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod('phone')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition ${loginMethod === 'phone'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                <Smartphone size={18} />
                <span>Phone</span>
              </button>
            </div>

            {/* Email Login Form */}
            {loginMethod === 'email' && <EmailLoginForm />}

            {/* Phone Login Form */}
            {loginMethod === 'phone' && <PhoneLoginForm />}

            <div className="flex justify-between items-center mt-4">
              {loginMethod === 'email' && (
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="text-sm text-slate-400 hover:text-white underline"
                >
                  Forgot Password?
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className="text-sm text-blue-400 hover:text-blue-300 underline font-medium ml-auto"
              >
                Sign Up
              </button>
            </div>
          </>
        ) : (
          <PasswordResetForm onCancel={() => setShowReset(false)} />
        )}
      </div>
    </div>
  );
};

// Email Login Form Component
const EmailLoginForm = () => {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-slate-300">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-white placeholder-slate-600"
          placeholder="your@email.com"
          required
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-slate-300">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-white placeholder-slate-600"
          placeholder="••••••••"
          required
        />
      </div>
      {error && <p className="text-red-500 text-center text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 py-3 rounded-lg font-bold hover:bg-blue-700 transition text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};

// Phone Login Form Component
const PhoneLoginForm = () => {
  const { loginWithPhone, verifyPhoneOTP, setupPhoneAuth, clearPhoneAuth } = useApp();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      clearPhoneAuth();
    };
  }, [clearPhoneAuth]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate phone number
      const { isValidIndianPhoneNumber, toE164Format } = await import('./utils/phoneValidation');

      if (!isValidIndianPhoneNumber(phoneNumber)) {
        setError('Invalid phone number. Enter 10-digit Indian mobile number.');
        setLoading(false);
        return;
      }

      const formattedPhone = toE164Format(phoneNumber);
      if (!formattedPhone) {
        setError('Failed to format phone number.');
        setLoading(false);
        return;
      }

      // Setup reCAPTCHA
      const appVerifier = setupPhoneAuth('recaptcha-container');

      // Send OTP
      const result = await loginWithPhone(formattedPhone, appVerifier);
      setConfirmationResult(result);
      setOtpSent(true);
      setResendTimer(30);
    } catch (err: any) {
      console.error('OTP send error:', err);
      if (err.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number format.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many requests. Please try again later.');
      } else {
        setError(err.message || 'Failed to send OTP. Please try again.');
      }
      clearPhoneAuth();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await verifyPhoneOTP(confirmationResult, otp);
      // Navigation handled by auth state change
    } catch (err: any) {
      console.error('OTP verification error:', err);
      if (err.code === 'auth/invalid-verification-code') {
        setError('Invalid OTP. Please check and try again.');
      } else if (err.code === 'auth/code-expired') {
        setError('OTP expired. Please request a new one.');
      } else {
        setError(err.message || 'OTP verification failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = () => {
    setOtpSent(false);
    setOtp('');
    setConfirmationResult(null);
    clearPhoneAuth();
  };

  if (!otpSent) {
    return (
      <form onSubmit={handleSendOTP} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-slate-300">Phone Number</label>
          <div className="flex gap-2">
            <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-3 text-slate-400 font-medium">
              +91
            </div>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="flex-1 p-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-white placeholder-slate-600"
              placeholder="9876543210"
              required
              maxLength={10}
              autoFocus
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">Enter 10-digit mobile number</p>
        </div>

        {/* reCAPTCHA Container */}
        <div id="recaptcha-container" className="flex justify-center"></div>

        {error && <p className="text-red-500 text-center text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || phoneNumber.length !== 10}
          className="w-full bg-blue-600 py-3 rounded-lg font-bold hover:bg-blue-700 transition text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending OTP...' : 'Send OTP'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyOTP} className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-sm text-slate-400">OTP sent to</p>
        <p className="text-lg font-bold text-blue-400">+91 {phoneNumber}</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-slate-300">Enter OTP</label>
        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500 outline-none text-white placeholder-slate-600"
          placeholder="••••••"
          required
          maxLength={6}
          autoFocus
        />
        <p className="text-xs text-slate-500 mt-1 text-center">6-digit code</p>
      </div>
      {error && <p className="text-red-500 text-center text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || otp.length !== 6}
        className="w-full bg-blue-600 py-3 rounded-lg font-bold hover:bg-blue-700 transition text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Verifying...' : 'Verify OTP'}
      </button>
      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={handleResendOTP}
          disabled={resendTimer > 0}
          className="text-sm text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
        </button>
        <button
          type="button"
          onClick={() => { setOtpSent(false); setOtp(''); clearPhoneAuth(); }}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          <ArrowLeft size={16} className="inline" /> Change Number
        </button>
      </div>
    </form>
  );
};

// Password Reset Form Component
const PasswordResetForm = ({ onCancel }: { onCancel: () => void }) => {
  const { resetPassword } = useApp();
  const [resetEmail, setResetEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(resetEmail);
      alert('Password reset email sent! Check your inbox.');
      onCancel();
      setResetEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleResetPassword} className="space-y-4 animate-fade-in">
      <div className="text-center mb-4">
        <div className="inline-block p-2 bg-amber-900/30 text-amber-500 rounded-full mb-2">
          <KeyRound size={24} />
        </div>
        <h3 className="text-lg font-bold text-amber-500">Reset Password</h3>
        <p className="text-xs text-slate-400">Enter your email to receive reset link</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-slate-300">Email</label>
        <input
          type="email"
          value={resetEmail}
          onChange={(e) => setResetEmail(e.target.value)}
          className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-white"
          placeholder="your@email.com"
          required
        />
      </div>
      {error && <p className="text-red-500 text-center text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-amber-600 py-3 rounded-lg font-bold hover:bg-amber-700 transition text-white flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RotateCcw size={18} /> {loading ? 'Sending...' : 'Send Reset Link'}
      </button>
      <button
        type="button"
        onClick={() => { onCancel(); setError(''); }}
        className="w-full text-sm text-slate-400 hover:text-white mt-2"
      >
        Cancel
      </button>
    </form>
  );
};

const SignupScreen = () => {
  const { signup } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match!');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      await signup(email, password);
      // Navigation handled by auth state change
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please login.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Use at least 6 characters.');
      } else {
        setError(err.message || 'Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
        <div className="flex justify-center mb-6">
          <div className="bg-green-600 p-4 rounded-full">
            <ShieldCheck size={48} className="text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">Create Account</h1>
        <p className="text-slate-400 text-center mb-8">Join Society Ilada Manager</p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-white placeholder-slate-600"
              placeholder="your@email.com"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-white placeholder-slate-600"
              placeholder="••••••••"
              required
              minLength={6}
            />
            <p className="text-xs text-slate-500 mt-1">Minimum 6 characters</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-white placeholder-slate-600"
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-red-500 text-center text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 py-3 rounded-lg font-bold hover:bg-green-700 transition text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm text-slate-400 hover:text-white"
            >
              Already have an account? <span className="text-blue-400 hover:text-blue-300 underline">Login</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MainLayout = () => {
  const { isAuthenticated } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Handle Android hardware back button for step-by-step navigation
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      let listener: any;

      CapacitorApp.addListener('backButton', () => {
        const currentHash = window.location.hash;

        // Check if we're on the dashboard/home page
        if (currentHash === '#/' || currentHash === '' || currentHash === '#') {
          // Exit app if on dashboard
          CapacitorApp.exitApp();
        } else {
          // Step-by-step navigation using React Router
          navigate(-1);
        }
      }).then(handle => {
        listener = handle;
      });

      return () => {
        if (listener) listener.remove();
      };
    }
  }, [navigate]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated && location.pathname !== '/login' && location.pathname !== '/signup') {
      navigate('/login');
    }
  }, [isAuthenticated, location.pathname, navigate]);

  // Show login/signup screens for unauthenticated users
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup" element={<SignupScreen />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  // Protected routes for authenticated users
  return (
    <div className="flex bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors duration-200">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 md:ml-64 flex flex-col w-full transition-all duration-300 print:ml-0 print:w-full overflow-x-hidden pt-24 md:pt-0">
        <div className="md:hidden flex items-center justify-between bg-slate-900 text-white fixed top-0 left-0 right-0 z-50 shadow-md no-print h-24 px-4 w-full" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', paddingBottom: '1rem' }}>
          <div className="font-bold text-lg text-blue-400">Society Ilada</div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition"><Menu size={24} /></button>
        </div>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/members" element={<Members />} />
          <Route path="/members/:id" element={<MemberDetails />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/bank-audit" element={<BankAudit />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/paddy-purchase" element={<PaddyPurchase />} />
          <Route path="/dispatch" element={<Dispatch />} />
          <Route path="/inventory-entry" element={<InventoryEntry />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/:categoryId" element={<Reports />} />
          <Route path="/reports/:categoryId/:subTab" element={<Reports />} />
          <Route path="/loan-calculator" element={<LoanCalculatorPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <AIChatWidget />
    </div>
  );
};

const App = () => {
  return (
    <AppProvider>
      <DialogProvider>
        <HashRouter>
          <MainLayout />
        </HashRouter>
      </DialogProvider>
    </AppProvider>
  );
};

export default App;
