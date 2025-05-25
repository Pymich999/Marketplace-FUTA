import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { login, reset } from "../../features/auth/authSlice";
import futaLogo from '../../assets/futa-img-logo/logo.svg'
import axios from "axios";

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
    const [resetMessage, setResetMessage] = useState({ type: "", text: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const otpInputRefs = useRef([]);
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { user, isLoading, isSuccess, isError, message } = useSelector((state) => state.auth);

// Also add logging to useEffect
useEffect(() => {
    console.log('Auth state changed:', { user, isLoading, isSuccess, isError, message });
    
    if (isSuccess && user) {
        console.log('Login successful, redirecting...', user.role);
        // Redirect based on user role
        if (user.role === "seller") {
            navigate("/seller-dashboard");
        } else if(user.role === "admin"){
            navigate("/admin")
        } else if(user.role === "seller_pending"){
            navigate("/seller-dashboard")
        } else {
            navigate("/");
        }
    }

    if (isError) {
        console.error('Login error:', message);
    }

    return () => {
        dispatch(reset());
    };
}, [user, isSuccess, isError, message, navigate, dispatch]);
    
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

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLogin = (e) => {
    e.preventDefault();
    console.log('Login button clicked');
    console.log('Form data:', formData);
    console.log('Is loading:', isLoading);
    
    // Add validation
    if (!formData.email || !formData.password) {
        console.error('Email or password missing');
        return;
    }
    
    try {
        dispatch(login(formData));
        console.log('Login dispatched successfully');
    } catch (error) {
        console.error('Error dispatching login:', error);
    }
};

    const handleForgotPassword = (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        // Request OTP for password reset
        axios.post("/api/users/request-password-reset", { email: resetEmail })
            .then(response => {
                setResetMessage({ type: "success", text: "OTP sent to your email" });
                setResetStep(2);
                setOtpTimer(120); // 2 minute countdown
                setIsSubmitting(false);
            })
            .catch(error => {
                setResetMessage({ 
                    type: "error", 
                    text: error.response?.data?.message || "Failed to send OTP. Please try again."
                });
                setIsSubmitting(false);
            });
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
            setResetMessage({ type: "error", text: "Please enter all OTP digits" });
            return;
        }
        
        setIsSubmitting(true);
        
        // Verify OTP
        axios.post("/api/users/verify-reset-otp", { email: resetEmail, otp })
            .then(response => {
                setResetMessage({ type: "success", text: "OTP verified. Set your new password" });
                setResetStep(3);
                setIsSubmitting(false);
            })
            .catch(error => {
                setResetMessage({ 
                    type: "error", 
                    text: error.response?.data?.message || "Invalid OTP. Please try again."
                });
                setIsSubmitting(false);
            });
    };

    const handleResendOtp = () => {
        setIsSubmitting(true);
        axios.post("/api/users/request-password-reset", { email: resetEmail })
            .then(response => {
                setResetMessage({ type: "success", text: "New OTP sent to your email" });
                setOtpTimer(120); // Reset the timer
                setIsSubmitting(false);
            })
            .catch(error => {
                setResetMessage({ 
                    type: "error", 
                    text: error.response?.data?.message || "Failed to resend OTP. Please try again."
                });
                setIsSubmitting(false);
            });
    };

    const handlePasswordReset = (e) => {
        e.preventDefault();
        
        if (newPassword !== confirmPassword) {
            setResetMessage({ type: "error", text: "Passwords do not match" });
            return;
        }
        
        if (newPassword.length < 6) {
            setResetMessage({ type: "error", text: "Password must be at least 6 characters" });
            return;
        }
        
        setIsSubmitting(true);
        
        // Reset password
        axios.post("/api/users/reset-password", { 
            email: resetEmail, 
            password: newPassword 
        })
            .then(response => {
                setResetMessage({ type: "success", text: "Password reset successfully. You can now login with your new password." });
                setTimeout(() => {
                    setShowForgotPassword(false);
                    setFormData({ ...formData, email: resetEmail });
                    setResetStep(1);
                    setResetEmail("");
                    setOtpValues(["", "", "", "", "", ""]);
                    setNewPassword("");
                    setConfirmPassword("");
                    setResetMessage({ type: "", text: "" });
                }, 3000);
                setIsSubmitting(false);
            })
            .catch(error => {
                setResetMessage({ 
                    type: "error", 
                    text: error.response?.data?.message || "Failed to reset password. Please try again."
                });
                setIsSubmitting(false);
            });
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

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

                    {isError && <p className="error-message">{message}</p>}

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
                            onClick={() => setShowForgotPassword(true)}
                        >
                            Forgot Password?
                        </button>
                    </div>
                </form>
            ) : (
                <div className="auth-form">
                    <h2 className="auth-title">Reset Password</h2>
                    
                    {resetMessage.text && (
                        <p className={`message ${resetMessage.type}`}>
                            {resetMessage.text}
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
                                onChange={(e) => setResetEmail(e.target.value)} 
                                placeholder="Email" 
                                className="login-input" 
                                required 
                            />
                            <button 
                                type="submit" 
                                className="auth-button"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Sending..." : "Send OTP"}
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
                                        disabled={isSubmitting}
                                    >
                                        Resend OTP
                                    </button>
                                )}
                            </div>
                            
                            <button 
                                type="submit" 
                                className="auth-button"
                                disabled={isSubmitting || otpValues.join("").length !== 6}
                            >
                                {isSubmitting ? "Verifying..." : "Verify OTP"}
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
                                    onChange={(e) => setNewPassword(e.target.value)} 
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
                                    onChange={(e) => setConfirmPassword(e.target.value)} 
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
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Resetting..." : "Reset Password"}
                            </button>
                        </form>
                    )}
                    
                    <button 
                        type="button" 
                        className="back-to-login"
                        onClick={() => {
                            setShowForgotPassword(false);
                            setResetStep(1);
                            setResetEmail("");
                            setOtpValues(["", "", "", "", "", ""]);
                            setNewPassword("");
                            setConfirmPassword("");
                            setResetMessage({ type: "", text: "" });
                        }}
                    >
                        Back to Login
                    </button>
                </div>
            )}
        </div>
    );
};

export default Login;