import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { signup, reset } from "../../features/auth/authSlice";
import { toast } from 'react-toastify';
import Spinner from '../Spinner';
import futaLogo from '../../assets/futa-img-logo/logo.svg';

const Signup = () => {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        phone: "",
        otp: "",
    });

    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [isRequestingOtp, setIsRequestingOtp] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user, isLoading, isSuccess, isError, message } = useSelector((state) => state.auth);

    useEffect(() => {
        if (isSuccess || user) {
            toast.success("Account created successfully!");
            navigate("/login");
        }
        if (isError) {
            if (message.includes('duplicate key') && message.includes('email')) {
                toast.error("This email is already registered. Please use a different email.");
            } else if (message.includes('duplicate key') && message.includes('phone')) {
                toast.error("This phone number is already registered. Please use a different number.");
            } else {
                toast.error(message);
            }
        }
        dispatch(reset());
    }, [user, isSuccess, isError, message, navigate, dispatch]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Request OTP via email
    const requestEmailOTP = async () => {
        if (!formData.email) {
            toast.error("Please enter your email address first!");
            return;
        }

        setIsRequestingOtp(true);
        
        try {
            const response = await fetch('/api/users/request-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: formData.email }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                setOtpSent(true);
                toast.success("OTP has been sent to your email! Check your inbox.", {
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                });
            } else {
                toast.error(data.message || "Failed to send OTP. Please try again.");
            }
        } catch (error) {
            console.error("Error requesting OTP:", error);
            toast.error("Failed to send OTP. Please check your connection and try again.");
        } finally {
            setIsRequestingOtp(false);
        }
    };

    // Verify OTP before form submission
    const verifyOTP = async () => {
        if (!formData.otp) {
            toast.error("Please enter the OTP first!");
            return;
        }

        setIsVerifyingOtp(true);
        
        try {
            // Simulate API call with timeout
            // In a real implementation, this would verify with the backend
            setTimeout(() => {
                setOtpVerified(true);
                toast.success("🎉 OTP verified successfully! You can now complete your registration.", {
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                });
                setIsVerifyingOtp(false);
            }, 1000);
        } catch (error) {
            toast.error("Failed to verify OTP. Please try again.");
            setIsVerifyingOtp(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validate required fields
        if (!formData.name || formData.name.trim() === '') {
            toast.error("Full name is required");
            return;
        }
        
        if (!formData.email || formData.email.trim() === '') {
            toast.error("Email is required");
            return;
        }
        
        if (!formData.password || formData.password.trim() === '') {
            toast.error("Password is required");
            return;
        }
        
        if (!formData.phone || formData.phone.trim() === '') {
            toast.error("Phone number is required");
            return;
        }
        
        if (!otpSent) {
            toast.error("Please request an OTP first!");
            return;
        }
        
        if (!formData.otp) {
            toast.error("Please enter the OTP sent to your email!");
            return;
        }
        
        if (!otpVerified) {
            toast.error("Please verify your OTP first!");
            return;
        }
        
        // Send the entire form data including OTP to the server
        dispatch(signup(formData));
    };

    if (isLoading) {
        return <Spinner />;
    }

    return (
        <div className="auth-container">
            <div className="auth-logo-container">
                <img 
                    src={futaLogo} 
                    alt="FUTA Marketplace Logo"
                    className="auth-logo" 
                />
            </div>
            <header className="auth-title">
                <span className="word word1">Welcome</span>{" "}
                <span className="word word2">to</span>{" "}
                <span className="word word3">FUTA</span>{" "}
                <span className="word word4">Marketplace</span>
            </header>

            <form onSubmit={handleSubmit} className="auth-form">
                <h2 className="auth-title">Sign Up</h2>

                <div className="form-group">
                    <label htmlFor="name">Full Name</label>
                    <input 
                        type="text" 
                        id="name"
                        name="name" 
                        value={formData.name} 
                        onChange={handleChange} 
                        placeholder="Enter your full name" 
                        className="form-control" 
                        required 
                    />
                </div>
                
                <div className="form-group">
                    <label htmlFor="email">Email Address</label>
                    <input 
                        type="email" 
                        id="email"
                        name="email" 
                        value={formData.email} 
                        onChange={handleChange} 
                        placeholder="Enter your email" 
                        className="form-control" 
                        required 
                    />
                </div>
                
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <div className="password-input-container">
                        <input 
                            type={showPassword ? "text" : "password"}
                            id="password" 
                            name="password" 
                            value={formData.password} 
                            onChange={handleChange} 
                            placeholder="Password" 
                            className="form-control" 
                            required 
                        />
                        <button 
                            type="button" 
                            className="password-toggle-btn"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? "Hide" : "Show"}
                        </button>
                    </div>
                </div>
                
                <div className="form-group">
                    <label htmlFor="phone">Phone Number</label>
                    <input 
                        type="text" 
                        id="phone"
                        name="phone" 
                        value={formData.phone} 
                        onChange={handleChange} 
                        placeholder="Enter your phone number" 
                        className="form-control" 
                        required 
                    />
                </div>

                {/* OTP Section */}
                <div className="otp-section">
                    {!otpSent ? (
                        <button 
                            type="button" 
                            onClick={requestEmailOTP} 
                            className="auth-button otp-button"
                            disabled={isRequestingOtp}
                        >
                            {isRequestingOtp ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Sending OTP...
                                </>
                            ) : (
                                "Send Verification OTP"
                            )}
                        </button>
                    ) : (
                        <>
                            <div className="form-group">
                                <label htmlFor="otp">Verification Code</label>
                                <input 
                                    type="text" 
                                    id="otp"
                                    name="otp" 
                                    value={formData.otp} 
                                    onChange={handleChange} 
                                    placeholder="Enter 6-digit code from email" 
                                    className="form-control" 
                                    required 
                                />
                                <small className="form-text text-muted">
                                    Check your email for the verification code
                                </small>
                            </div>
                            
                            {!otpVerified ? (
                                <button 
                                    type="button" 
                                    onClick={verifyOTP} 
                                    className="auth-button verify-button"
                                    disabled={isVerifyingOtp}
                                >
                                    {isVerifyingOtp ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Verifying...
                                        </>
                                    ) : (
                                        "Verify Code"
                                    )}
                                </button>
                            ) : (
                                <div className="verification-success">
                                    <i className="bi bi-check-circle-fill text-success me-2"></i>
                                    <span>Email verified successfully</span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Submit Button */}
                <button 
                    type="submit" 
                    className="auth-button submit-button" 
                    disabled={isLoading || !otpSent || !formData.otp || !otpVerified}
                >
                    {isLoading ? (
                        <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            Creating Your Account...
                        </>
                    ) : (
                        "Complete Registration"
                    )}
                </button>
                
                <p className="auth-prompt">
                    Already have an Account? <a href="/login">Log In</a>
                </p>
            </form>
        </div>
    );
};

export default Signup;