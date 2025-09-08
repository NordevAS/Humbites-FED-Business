"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CreateField from "@/components/company_comp/CreateField/CreateField";
import "./user.css";

function LogInField() {
  const [newCode, setNewCode] = useState("");
  const [NewPass, setNewPass] = useState("");
  const router = useRouter();

  function userFilled() {
    // Skip validation, redirect to dashboard
    router.push("/app");
  }

  const codeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCode(e.target.value);
  };

  const passHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPass(e.target.value);
  };

  return (
    <form id="create-form">
      <label htmlFor="code">business code:</label>
      <input
        type="text"
        placeholder="Code"
        name="code"
        id="Code-field"
        className="input-field"
        onChange={codeHandler}
      />
      <label htmlFor="password">password:</label>
      <input
        type="password"
        placeholder="Password"
        name="password"
        id="pass-field"
        className="input-field"
        onChange={passHandler}
      />
      <button type="button" id="submit-btn" onClick={userFilled}>
        Submit
      </button>
    </form>
  );
}

export default function Userin() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div id="page-cont">
      <nav>
        <button
          className={isLogin ? "active-tab" : ""}
          onClick={() => setIsLogin(true)}>
          Log in
        </button>
        <button
          className={!isLogin ? "active-tab" : ""}
          onClick={() => setIsLogin(false)}>
          Sign up
        </button>
      </nav>

      <div id="input-sect">
        <div id="top-txt">
          <span className="chevron">&gt;</span>
          {isLogin ? "Welcome Back" : "Create Your Company Account"}
        </div>

        {isLogin ? <LogInField /> : <CreateField />}

        <div id="link-line">
          {isLogin ? (
            <a href="/reset">Forgot password?</a>
          ) : (
            <a href="/terms">Read Terms of Use</a>
          )}
        </div>
      </div>

      <div id="info-sect">
        Trouble? Contact us at{" "}
        <a href="mailto:Randomwmail@gmail.com?subject=Login Support Request&body=Hi, I need help with...">
          Randomwmail@gmail.com
        </a>
      </div>
    </div>
  );
}
