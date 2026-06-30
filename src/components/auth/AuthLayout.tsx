import { useState } from "react";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";

export function AuthLayout() {
  const [isActive, setIsActive] = useState(false);

  return (
    <>
      <style>{`
        .auth-container {
          position: relative;
          width: 850px;
          max-width: 100%;
          height: 600px;
          background: hsl(var(--card));
          border-radius: 30px;
          box-shadow: 0 0 30px rgba(0,0,0,.2);
          overflow: hidden;
          margin: 20px;
        }
        .auth-form-box {
          position: absolute;
          right: 0;
          width: 50%;
          height: 100%;
          background: hsl(var(--card));
          display: flex;
          align-items: center;
          color: hsl(var(--foreground));
          padding: 40px;
          z-index: 1;
          transition: .6s ease-in-out 1.2s, visibility 0s 1s;
        }
        .auth-container.active .auth-form-box { right: 50%; }
        .auth-form-box.register { visibility: hidden; }
        .auth-container.active .auth-form-box.register { visibility: visible; }
        .auth-form-inner { width: 100%; }
        .auth-toggle-box {
          position: absolute;
          width: 100%;
          height: 100%;
        }
        .auth-toggle-box::before {
          content: '';
          position: absolute;
          left: -250%;
          width: 300%;
          height: 100%;
          background: hsl(var(--accent-primary));
          border-radius: 150px;
          z-index: 2;
          transition: 1.8s ease-in-out;
        }
        .auth-container.active .auth-toggle-box::before { left: 50%; }
        .auth-toggle-panel {
          position: absolute;
          width: 50%;
          height: 100%;
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 2;
          transition: .6s ease-in-out;
          padding: 40px;
          text-align: center;
        }
        .auth-toggle-panel.toggle-left { left: 0; transition-delay: 1.2s; }
        .auth-container.active .auth-toggle-panel.toggle-left { left: -50%; transition-delay: .6s; }
        .auth-toggle-panel.toggle-right { right: -50%; transition-delay: .6s; }
        .auth-container.active .auth-toggle-panel.toggle-right { right: 0; transition-delay: 1.2s; }
        .auth-toggle-panel h2 { font-size: 2rem; font-weight: 700; margin-bottom: 12px; }
        .auth-toggle-panel p { font-size: .95rem; margin-bottom: 20px; opacity: .9; }
        .auth-toggle-btn {
          width: 160px;
          height: 46px;
          background: transparent;
          border: 2px solid white;
          border-radius: 8px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: background .2s;
        }
        .auth-toggle-btn:hover { background: rgba(255,255,255,.1); }

        @media screen and (max-width: 850px) {
          .auth-container { height: calc(100vh - 40px); max-height: 700px; }
        }
        @media screen and (max-width: 650px) {
          .auth-container { height: 100vh; max-height: none; border-radius: 0; margin: 0; }
          .auth-form-box {
            width: 100%;
            height: 70%;
            bottom: 0;
            right: 0;
            top: auto;
          }
          .auth-container.active .auth-form-box { right: 0; bottom: 30%; }
          .auth-toggle-box::before {
            left: 0;
            top: -270%;
            width: 100%;
            height: 300%;
            border-radius: 20vw;
          }
          .auth-container.active .auth-toggle-box::before { left: 0; top: 70%; }
          .auth-toggle-panel { width: 100%; height: 30%; }
          .auth-toggle-panel.toggle-left { top: 0; left: 0; }
          .auth-container.active .auth-toggle-panel.toggle-left { left: 0; top: -30%; }
          .auth-toggle-panel.toggle-right { right: 0; bottom: -30%; top: auto; }
          .auth-container.active .auth-toggle-panel.toggle-right { bottom: 0; right: 0; }
        }
      `}</style>
      <main className="min-h-screen flex items-center justify-center bg-background font-sans">
        <div className={`auth-container ${isActive ? "active" : ""}`}>
          <div className="auth-form-box login">
            <div className="auth-form-inner">
              <h2 className="text-2xl font-bold text-center mb-6">Entrar</h2>
              <LoginForm />
            </div>
          </div>

          <div className="auth-form-box register">
            <div className="auth-form-inner">
              <SignupForm />
            </div>
          </div>

          <div className="auth-toggle-box">
            <div className="auth-toggle-panel toggle-left">
              <h2>Olá!</h2>
              <p>Não tem uma conta? Cadastre-se para começar.</p>
              <button type="button" className="auth-toggle-btn" onClick={() => setIsActive(true)}>
                Cadastrar
              </button>
            </div>
            <div className="auth-toggle-panel toggle-right">
              <h2>Bem-vindo de volta!</h2>
              <p>Já tem uma conta? Faça login para continuar.</p>
              <button type="button" className="auth-toggle-btn" onClick={() => setIsActive(false)}>
                Entrar
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
