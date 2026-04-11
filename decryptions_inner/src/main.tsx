import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import "./index.css";

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
  });
  posthog.capture("test_event");
}

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics mode={import.meta.env.PROD ? "production" : "development"} />
  </>,
);
  