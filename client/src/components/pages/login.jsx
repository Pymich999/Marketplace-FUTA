import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { 
    login, 
    reset, 
    clearMessage,
    requestPasswordReset,
    verifyResetOTP,
    resetPassword,
    setOTPSent,
    setOTPVerified
} from "../../features/auth/authSlice";
import '../pages-styles/auth.css'
import futaLogo from '../../assets/futa-img-logo/logo.svg'

const Login = () => {
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState("");
    const [resetStep, setResetStep] = useState(1); // 1: email input, 2: OTP verification, 3: new password
    const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [otpTimer, setOtpTimer] = useState(0);
    const [localMessage, setLocalMessage] = useState({ type: "", text: "" });
    
    const otpInputRefs = useRef([]);
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { 
        user, 
        isLoading, 
        isSuccess, 
        isError, 
        message, 
        otpSent, 
        otpVerified 
    } = useSelector((state) => state.auth);

    // Handle successful login navigation
    useEffect(() => {
        console.log('Auth state changed:', { user, isLoading, isSuccess, isError, message });
        
        if (isSuccess && user && !showForgotPassword) {
            console.log('Login successful, redirecting...', user.user?.role || user.role);
            
            // Extract role from user object (handle both formats)
            const userRole = user.user?.role || user.role;
            
            // Redirect based on user role
            if (userRole === "seller" || userRole === "seller_pending") {
                navigate("/seller-dashboard");
            } else if (userRole === "admin") {
                navigate("/admin");
            } else {
                navigate("/");
            }
        }

        if (isError && !showForgotPassword) {
            console.error('Login error:', message);
        }
    }, [user, isSuccess, isError, message, navigate, showForgotPassword]);

    // Handle password reset flow success states
    useEffect(() => {
        if (showForgotPassword && isSuccess) {
            if (resetStep === 1 && otpSent) {
                setLocalMessage({ type: "success", text: message || "OTP sent to your email" });
                setResetStep(2);
                setOtpTimer(120); // 2 minute countdown
            } else if (resetStep === 2 && otpVerified) {
                setLocalMessage({ type: "success", text: message || "OTP verified. Set your new password" });
                setResetStep(3);
            } else if (resetStep === 3 && !otpSent && !otpVerified) {
                setLocalMessage({ type: "success", text: message || "Password reset successfully. You can now login with your new password." });
                setTimeout(() => {
                    handleBackToLogin();
                    setFormData({ ...formData, email: resetEmail });
                }, 3000);
            }
        }
    }, [isSuccess, otpSent, otpVerified, message, resetStep, showForgotPassword]);

    // Handle password reset flow error states
    useEffect(() => {
        if (showForgotPassword && isError) {
            setLocalMessage({ type: "error", text: message });
        }
    }, [isError, message, showForgotPassword]);
    
    // Timer for OTP resend
    useEffect(() => {
        let interval;
        if (otpTimer > 0) {
            interval = setInterval(() => {
                setOtpTimer(prevTimer => prevTimer - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [otpTimer]);

    // Cleanup when component unmounts or switches between login/forgot password
    useEffect(() => {
        return () => {
            dispatch(reset());
        };
    }, [dispatch]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        // Clear any existing messages when user starts typing
        if (isError || isSuccess) {
            dispatch(clearMessage());
        }
    };

    const handleLogin = (e) => {
        e.preventDefault();
        console.log('Login button clicked');
        console.log('Form data:', formData);
        
        // Add validation
        if (!formData.email || !formData.password) {
            console.error('Email or password missing');
            return;
        }
        
        // Clear any existing messages
        dispatch(clearMessage());
        
        try {
            dispatch(login(formData));
            console.log('Login dispatched successfully');
        } catch (error) {
            console.error('Error dispatching login:', error);
        }
    };

    const handleForgotPassword = (e) => {
        e.preventDefault();
        
        if (!resetEmail) {
            setLocalMessage({ type: "error", text: "Please enter your email address" });
            return;
        }
        
        // Clear any existing messages
        dispatch(clearMessage());
        setLocalMessage({ type: "", text: "" });
        
        // Request OTP for password reset using Redux action
        dispatch(requestPasswordReset(resetEmail));
    };

    const handleOtpChange = (index, value) => {
        if (!/^[0-9]*$/.test(value)) return;
        
        const newOtpValues = [...otpValues];
        newOtpValues[index] = value;
        setOtpValues(newOtpValues);
        
        // Auto-focus to next input
        if (value && index < 5) {
            otpInputRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (index, e) => {
        // Handle backspace - move to previous input
        if (e.key === "Backspace" && !otpValues[index] && index > 0) {
            otpInputRefs.current[index - 1].focus();
        }
    };

    const handleOtpSubmit = (e) => {
        e.preventDefault();
        const otp = otpValues.join("");
        
        if (otp.length !== 6) {
            setLocalMessage({ type: "error", text: "Please enter all OTP digits" });
            return;
        }
        
        // Clear any existing messages
        dispatch(clearMessage());
        setLocalMessage({ type: "", text: "" });
        
        // Verify OTP using Redux action
        dispatch(verifyResetOTP({ email: resetEmail, otp }));
    };

    const handleResendOtp = () => {
        // Clear any existing messages
        dispatch(clearMessage());
        setLocalMessage({ type: "", text: "" });
        
        // Reset OTP sent state and request new OTP
        dispatch(setOTPSent(false));
        dispatch(requestPasswordReset(resetEmail));
    };

    const handlePasswordReset = (e) => {
        e.preventDefault();
        
        if (newPassword !== confirmPassword) {
            setLocalMessage({ type: "error", text: "Passwords do not match" });
            return;
        }
        
        if (newPassword.length < 6) {
            setLocalMessage({ type: "error", text: "Password must be at least 6 characters" });
            return;
        }
        
        // Clear any existing messages
        dispatch(clearMessage());
        setLocalMessage({ type: "", text: "" });
        
        // Reset password using Redux action
        dispatch(resetPassword({ email: resetEmail, password: newPassword }));
    };

    const handleBackToLogin = () => {
        setShowForgotPassword(false);
        setResetStep(1);
        setResetEmail("");
        setOtpValues(["", "", "", "", "", ""]);
        setNewPassword("");
        setConfirmPassword("");
        setLocalMessage({ type: "", text: "" });
        setOtpTimer(0);
        
        // Reset all auth states
        dispatch(reset());
        dispatch(setOTPSent(false));
        dispatch(setOTPVerified(false));
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Determine which message to display
    const getDisplayMessage = () => {
        if (showForgotPassword) {
            return localMessage.text ? localMessage : (message ? { type: isError ? "error" : "success", text: message } : { type: "", text: "" });
        }
        return message ? { type: isError ? "error" : "success", text: message } : { type: "", text: "" };
    };

    const displayMessage = getDisplayMessage();

    return (
        <div className="auth-container">
            <div className="auth-logo-container">
                <img src={futaLogo} className="auth-logo" alt="FUTA Logo" />
            </div>
            <header className="auth-title">
                <span className="word word1">Welcome</span>{" "}
                <span className="word word2">to</span>{" "}
                <span className="word word3">FUTA</span>{" "}
                <span className="word word4">Marketplace</span>
            </header>
            
            {!showForgotPassword ? (
                <form onSubmit={handleLogin} className="auth-form">
                    <h2 className="auth-title">Login</h2>

                    {displayMessage.text && (
                        <p className={`${displayMessage.type === "error" ? "error-message" : "success-message"}`}>
                            {displayMessage.text}
                        </p>
                    )}

                    <div className="input-group">
                        <input 
                            type="email" 
                            name="email" 
                            value={formData.email} 
                            onChange={handleChange} 
                            placeholder="Email" 
                            className="login-input" 
                            required 
                        />
                    </div>
                    
                    <div className="input-group password-input-group">
                        <input 
                            type={showPassword ? "text" : "password"} 
                            name="password" 
                            value={formData.password} 
                            onChange={handleChange} 
                            placeholder="Password" 
                            className="login-input" 
                            required 
                        />
                        <button 
                            type="button" 
                            className="toggle-password"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? "Hide" : "Show"}
                        </button>
                    </div>

                    <button type="submit" className="auth-button" disabled={isLoading}>
                        {isLoading ? "Logging in..." : "Login"}
                    </button>

                    <div className="auth-links">
                        <p className="auth-prompt">
                            Don't have an account? <a href="/signup">Sign up</a>
                        </p>
                        <button 
                            type="button" 
                            className="forgot-password-link"
                            onClick={() => {
                                setShowForgotPassword(true);
                                dispatch(clearMessage());
                            }}
                        >
                            Forgot Password?
                        </button>
                    </div>
                </form>
            ) : (
                <div className="auth-form">
                    <h2 className="auth-title">Reset Password</h2>
                    
                    {displayMessage.text && (
                        <p className={`message ${displayMessage.type}`}>
                            {displayMessage.text}
                        </p>
                    )}
                    
                    {resetStep === 1 && (
                        <form onSubmit={handleForgotPassword}>
                            <p className="form-description">
                                Enter your email address and we'll send you an OTP to reset your password
                            </p>
                            <input 
                                type="email" 
                                value={resetEmail} 
                                onChange={(e) => {
                                    setResetEmail(e.target.value);
                                    // Clear messages when user types
                                    if (localMessage.text || message) {
                                        setLocalMessage({ type: "", text: "" });
                                        dispatch(clearMessage());
                                    }
                                }} 
                                placeholder="Email" 
                                className="login-input" 
                                required 
                            />
                            <button 
                                type="submit" 
                                className="auth-button"
                                disabled={isLoading}
                            >
                                {isLoading ? "Sending..." : "Send OTP"}
                            </button>
                        </form>
                    )}
                    
                    {resetStep === 2 && (
                        <form onSubmit={handleOtpSubmit}>
                            <p className="form-description">
                                Enter the 6-digit OTP sent to your email
                            </p>
                            
                            <div className="otp-input-container">
                                {otpValues.map((value, index) => (
                                    <input
                                        key={index}
                                        ref={el => otpInputRefs.current[index] = el}
                                        type="text"
                                        value={value}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        maxLength={1}
                                        className="otp-input"
                                        autoFocus={index === 0}
                                    />
                                ))}
                            </div>
                            
                            <div className="otp-timer">
                                {otpTimer > 0 ? (
                                    <p>Resend OTP in {formatTime(otpTimer)}</p>
                                ) : (
                                    <button 
                                        type="button" 
                                        className="resend-otp-button"
                                        onClick={handleResendOtp}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? "Sending..." : "Resend OTP"}
                                    </button>
                                )}
                            </div>
                            
                            <button 
                                type="submit" 
                                className="auth-button"
                                disabled={isLoading || otpValues.join("").length !== 6}
                            >
                                {isLoading ? "Verifying..." : "Verify OTP"}
                            </button>
                        </form>
                    )}
                    
                    {resetStep === 3 && (
                        <form onSubmit={handlePasswordReset}>
                            <p className="form-description">
                                Create a new password
                            </p>
                            
                            <div className="input-group password-input-group">
                                <input 
                                    type={showNewPassword ? "text" : "password"} 
                                    value={newPassword} 
                                    onChange={(e) => {
                                        setNewPassword(e.target.value);
                                        // Clear messages when user types
                                        if (localMessage.text) {
                                            setLocalMessage({ type: "", text: "" });
                                        }
                                    }} 
                                    placeholder="New Password" 
                                    className="login-input" 
                                    required 
                                    minLength={6}
                                />
                                <button 
                                    type="button" 
                                    className="toggle-password"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                >
                                    {showNewPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                            
                            <div className="input-group password-input-group">
                                <input 
                                    type={showConfirmPassword ? "text" : "password"} 
                                    value={confirmPassword} 
                                    onChange={(e) => {
                                        setConfirmPassword(e.target.value);
                                        // Clear messages when user types
                                        if (localMessage.text) {
                                            setLocalMessage({ type: "", text: "" });
                                        }
                                    }} 
                                    placeholder="Confirm Password" 
                                    className="login-input" 
                                    required 
                                />
                                <button 
                                    type="button" 
                                    className="toggle-password"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                            
                            <button 
                                type="submit" 
                                className="auth-button"
                                disabled={isLoading}
                            >
                                {isLoading ? "Resetting..." : "Reset Password"}
                            </button>
                        </form>
                    )}
                    
                    <button 
                        type="button" 
                        className="back-to-login"
                        onClick={handleBackToLogin}
                    >
                        Back to Login
                    </button>
                </div>
            )}
        </div>
    );
};

export default Login;