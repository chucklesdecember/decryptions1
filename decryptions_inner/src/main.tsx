import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import "./index.css";

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
  });
}

createRoot(document.getElementById("root")!).render(
  <>
    <AuthProvider>
      <App />
    </AuthProvider>
    <Analytics mode={import.meta.env.PROD ? "production" : "development"} />
  </>,
);
