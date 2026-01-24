import React from "react";

interface LoginRegisterLayoutProps {
  children: React.ReactNode;
}

const LoginRegisterLayout: React.FC<LoginRegisterLayoutProps> = ({ children }) => (
  <main className="min-h-screen flex flex-col items-center justify-center bg-background">
    <section className="w-full max-w-md p-8 bg-card rounded-lg shadow-lg flex flex-col items-center">
      {/* Logo placeholder */}
      <div className="mb-6">
        <span className="text-3xl font-bold text-primary">ClearMindHelper</span>
      </div>
      {children}
    </section>
  </main>
);

export default LoginRegisterLayout;
