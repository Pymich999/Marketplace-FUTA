import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { requestEmailOTP, registerBuyer, reset, clearMessage } from "../../features/auth/authSlice";
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

    const [showPassword, setShowPassword] = useState(false);
    const [formSubmitted, setFormSubmitted] = useState(false);

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

    // Handle auth state changes after form submission
    useEffect(() => {
        if (formSubmitted) {
            if (isSuccess && user) {
                toast.success("Account created successfully!");
                navigate("/dashboard"); // Navigate to dashboard since user is now logged in
                setFormSubmitted(false);
            }
            
            if (isError && message) {
                if (message.includes('duplicate key') && message.includes('email')) {
                    toast.error("This email is already registered. Please use a different email.");
                } else if (message.includes('duplicate key') && message.includes('phone')) {
                    toast.error("This phone number is already registered. Please use a different number.");
                } else if (message.includes('Invalid OTP')) {
                    toast.error("Invalid OTP. Please check your email and try again.");
                } else {
                    toast.error(message);
                }
                setFormSubmitted(false);
            }
        }
    }, [isSuccess, isError, message, navigate, user, formSubmitted]);

    // Handle OTP request success/error
    useEffect(() => {
        if (otpSent && isSuccess && message && !formSubmitted) {
            toast.success("OTP has been sent to your email! Check your inbox.", {
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
            });
            dispatch(clearMessage());
        }
        
        if (isError && message && !otpSent && !formSubmitted) {
            toast.error(message || "Failed to send OTP. Please try again.");
            dispatch(clearMessage());
        }
    }, [otpSent, isSuccess, isError, message, dispatch, formSubmitted]);

    // Redirect if user is already logged in
    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Request OTP via Redux action
    const handleRequestOTP = async () => {
        if (!formData.email) {
            toast.error("Please enter your email address first!");
            return;
        }

        // Clear any previous messages
        dispatch(clearMessage());
        
        // Dispatch the OTP request action
        dispatch(requestEmailOTP(formData.email));
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
        
        // Clear any previous messages
        dispatch(clearMessage());
        
        // Set flag that form was submitted before dispatching action
        setFormSubmitted(true);
        
        // Register buyer with OTP verification
        dispatch(registerBuyer({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            phone: formData.phone,
            otp: formData.otp
        }));
    };

    // Reset OTP states when email changes
    useEffect(() => {
        if (formData.email !== '') {
            dispatch(reset());
        }
    }, [formData.email, dispatch]);

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
                        disabled={otpSent} // Disable email field once OTP is sent
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
                            onClick={handleRequestOTP} 
                            className="auth-button otp-button"
                            disabled={isLoading || !formData.email}
                        >
                            {isLoading ? (
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
                                    maxLength="6"
                                    required 
                                />
                                <small className="form-text text-muted">
                                    Check your email for the verification code
                                </small>
                            </div>
                            
                            <div className="otp-actions">
                                <button 
                                    type="button" 
                                    onClick={handleRequestOTP} 
                                    className="auth-button resend-button"
                                    disabled={isLoading}
                                >
                                    {isLoading ? "Resending..." : "Resend OTP"}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Submit Button */}
                <button 
                    type="submit" 
                    className="auth-button submit-button" 
                    disabled={isLoading || !otpSent || !formData.otp}
                >
                    {isLoading && formSubmitted ? (
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