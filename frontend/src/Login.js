import { useState } from "react";
import { API_URL } from "./config";
import "./Login.css";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        try {
            const response = await fetch(
                `${API_URL}/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            );

            if (!response.ok) {
                alert("Invalid credentials");
                return;
            }

            const data = await response.json();

            localStorage.setItem(
                "token",
                data.access_token
            );

            window.location.href = "/dashboard";

        } catch (err) {
            console.error(err);
            alert("Login failed");
        }
    };

    return (
        <div className="login-page">

            <div className="login-card">

                <h2 className="login-title">
                    Login
                </h2>

                <div className="login-input-wrapper">
                    <input
                        className="login-input"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div className="login-input-wrapper">
                    <input
                        className="login-input"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <div className="login-options">
                    <label className="remember-me">
                        <input type="checkbox" />
                        <span>Remember me</span>
                    </label>

                    <span className="forgot-password">
                        Forgot password
                    </span>
                </div>

                <button
                    className="login-button"
                    onClick={handleLogin}
                >
                    Login
                </button>

                <div className="login-footer">
                    Don't have an account?
                    <span> Register</span>
                </div>

            </div>

        </div>
    );
}

export default Login;