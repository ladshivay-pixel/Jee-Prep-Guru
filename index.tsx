import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

window.addEventListener("beforeunload", (e) => {
  e.preventDefault();
  // returnValue must be set as a string for legacy browser support to trigger the dialog
  e.returnValue = "Are you sure you want to leave? Your progress will be lost.";
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
