import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { signup, reset } from "../features/auth/authSlice";
import futaLogo from '../assets/futa-img-logo/logo.svg'

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

    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user, isLoading, isSuccess, isError, message } = useSelector((state) => state.auth);

    useEffect(() => {
        if (isSuccess || user) {
            navigate("/login");
        }
        if (isError) {
            alert(message);
        }
        dispatch(reset());
    }, [user, isSuccess, isError, message, navigate, dispatch]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Request OTP via email
    const requestEmailOTP = async () => {
        if (!formData.email) {
            alert("Enter email address first!");
            return;
        }

        setIsRequestingOtp(true);
        
        try {
            const response = await fetch('http://localhost:3000/api/users/request-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: formData.email }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                setOtpSent(true);
                alert("OTP sent to your email!");
            } else {
                alert(data.message || "Failed to send OTP. Please try again.");
            }
        } catch (error) {
            console.error("Error requesting OTP:", error);
            alert("Failed to send OTP. Please check your connection and try again.");
        } finally {
            setIsRequestingOtp(false);
        }
    };

    // Verify OTP before form submission
    const verifyOTP = async () => {
        if (!formData.otp) {
            alert("Enter OTP first!");
            return;
        }

        // We're not actually verifying the OTP here since that happens server-side during signup
        // Just marking it as ready for submission
        setOtpVerified(true);
        alert("OTP ready for verification. You can now submit the form.");
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!otpSent) {
            alert("Request an OTP first!");
            return;
        }
        
        if (!formData.otp) {
            alert("Enter the OTP sent to your email!");
            return;
        }
        
        // Send the entire form data including OTP to the server
        dispatch(signup(formData));
    };

    return (
        <div className="auth-container">
            <div className="auth-logo-container">
                <img 
                    src={futaLogo} 
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

                <input 
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleChange} 
                    placeholder="Full Name" 
                    className="signup-input" 
                    required 
                />
                
                <input 
                    type="email" 
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    placeholder="Email" 
                    className="signup-input" 
                    required 
                />
                
                <input 
                    type="password" 
                    name="password" 
                    value={formData.password} 
                    onChange={handleChange} 
                    placeholder="Password" 
                    className="signup-input" 
                    required 
                />
                
                <input 
                    type="text" 
                    name="phone" 
                    value={formData.phone} 
                    onChange={handleChange} 
                    placeholder="Phone Number" 
                    className="signup-input" 
                    required 
                />

                {/* Request Email OTP Button */}
                {!otpSent && (
                    <button 
                        type="button" 
                        onClick={requestEmailOTP} 
                        className="auth-button"
                        disabled={isRequestingOtp}
                    >
                        {isRequestingOtp ? "Sending OTP..." : "Send OTP"}
                    </button>
                )}

                {/* OTP Input Field shown once OTP is sent */}
                {otpSent && (
                    <>
                        <input 
                            type="text" 
                            name="otp" 
                            value={formData.otp} 
                            onChange={handleChange} 
                            placeholder="Enter OTP from Email" 
                            className="signup-input" 
                            required 
                        />
                        
                        {!otpVerified && (
                            <button 
                                type="button" 
                                onClick={verifyOTP} 
                                className="auth-button"
                                disabled={isVerifyingOtp}
                            >
                                {isVerifyingOtp ? "Verifying..." : "Verify OTP"}
                            </button>
                        )}
                    </>
                )}

                {/* Submit Button (enabled once OTP is verified) */}
                <button 
                    type="submit" 
                    className="auth-button" 
                    disabled={isLoading || !otpSent || !formData.otp}
                >
                    {isLoading ? "Signing Up..." : "Sign Up"}
                </button>
                
                <p className="auth-prompt">
                    Already have an Account? <a href="/login">Log In</a>
                </p>
            </form>
        </div>
    );
};

export default Signup;