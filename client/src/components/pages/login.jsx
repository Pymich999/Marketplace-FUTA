import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { login, reset } from "../../features/auth/authSlice";
import futaLogo from '../../assets/futa-img-logo/logo.svg'

const Login = () => {
    const [formData, setFormData] = useState({ email: "", password: "" });
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { user, isLoading, isSuccess, isError, message } = useSelector((state) => state.auth);

    useEffect(() => {
        if (isSuccess && user) {
            // Redirect based on user role
            if (user.role === "seller") {
                navigate("/seller-dashboard");
            } else if(user.role === "admin"){
                navigate("/admin")
            } else if(user.role === "seller_pending"){
                navigate("/seller-dashboard")
            }

            else {
                // Default to home page for buyers and other roles
                navigate("/");
            }
        }

        return () => {
            dispatch(reset());
        };
    }, [user, isSuccess, navigate, dispatch]);
    
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLogin = (e) => {
        e.preventDefault();
        dispatch(login(formData));
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
            <form onSubmit={handleLogin} className="auth-form">
                <h2 className="auth-title">Login</h2>

                {isError && <p className="error-message">{message}</p>}

                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email" className="login-input" required />
                <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Password" className="login-input" required />

                <button type="submit" className="auth-button" disabled={isLoading}>
                    {isLoading ? "Logging in..." : "Login"}
                </button>

                <p className="auth-prompt">
                    Don't have an account? <a href="/signup">Sign up</a>
                </p>
            </form>
        </div>
    );
};

export default Login;
