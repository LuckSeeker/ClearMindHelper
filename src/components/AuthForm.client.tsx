import AuthForm from "./AuthForm";
import { GlobalAlertsProvider } from "./GlobalAlertsProvider";
import { BrowserRouter } from "react-router-dom";

const AuthFormClient = (props: React.ComponentProps<typeof AuthForm>) => (
  <BrowserRouter>
    <GlobalAlertsProvider>
      <AuthForm {...props} />
    </GlobalAlertsProvider>
  </BrowserRouter>
);

export default AuthFormClient;
