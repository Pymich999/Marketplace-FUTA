import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { signup, reset } from "../features/auth/authSlice";
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from "firebase/auth";
import { app } from "../firebase";
import futaLogo from '../assets/futa-img-logo/logo.svg'

const Signup = () => {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        phone: "",
        otp: "",
        idToken: "", // Store Firebase ID token
    });

    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);

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

    // 🔥 Send OTP to user
    const sendOTP = async () => {
        if (!formData.phone) {
            alert("Enter phone number first!");
            return;
        }

        const auth = getAuth(app);
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });

        try {
            const confirmationResult = await signInWithPhoneNumber(auth, formData.phone, window.recaptchaVerifier);
            window.confirmationResult = confirmationResult;
            setOtpSent(true); // Show OTP input field
            alert("OTP Sent!");
        } catch (error) {
            console.error("Error sending OTP:", error);
            alert("Failed to send OTP");
        }
    };

    // 🔥 Verify OTP
    const verifyOTP = async () => {
        if (!formData.otp) {
            alert("Enter OTP!");
            return;
        }

        try {
            const confirmationResult = window.confirmationResult;
            const userCredential = await confirmationResult.confirm(formData.otp);
            const idToken = await userCredential.user.getIdToken(); // 🔥 Get Firebase ID Token

            setFormData({ ...formData, idToken });
            setOtpVerified(true); // OTP verified, now enable form submission
            alert("OTP Verified!");
        } catch (error) {
            console.error("Error verifying OTP:", error);
            alert("Invalid OTP");
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!otpVerified) {
            alert("Verify OTP first!");
            return;
        }
        dispatch(signup(formData)); // Send user data + idToken to backend
    };

    return (
        <div className="auth-container">
        <div className="auth-logo-container">
        <img 
          src={futaLogo} 
          className="auth-logo" 
        />
        </div>
            <header className="auth-title"><span className="word
            word1">Welcome</span>{" "}
            <span className="word
            word2">to</span>{" "}<span className="word
            word3">FUTA</span>{" "}<span className="word
            word4">Marketplace</span>
            </header>

            <form onSubmit={handleSubmit} className="auth-form">
                <h2 className="auth-title">Sign Up</h2>

                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Full Name" className="signup-input" required />
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email" className="signup-input" required />
                <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Password" className="signup-input" required />

                <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="Phone Number" className="signup-input" required />

                {/* Send OTP button */}
                {!otpSent && (
                      <button type="button" onClick={sendOTP} className="auth-button">Send OTP</button>
                )}

                {/* OTP Input & Verify Button */}
                {otpSent && (
                   <>
                   <input type="text" name="otp" value={formData.otp} onChange={handleChange} placeholder="Enter OTP" className="signup-input" required />
                   <button type="button" onClick={verifyOTP} className="auth-button">Verify OTP</button>
                   </>
                )}

                {/* Final Sign Up Button */}
                <button type="submit" className="auth-button" disabled={isLoading || !otpVerified}>Sign Up</button>
                <p className="auth-prompt">
                    Already have an Account?<a href="/login">Log In</a>
                </p>
            </form>

            <div id="recaptcha-container"></div>
        </div>
    );
};

export default Signup;
