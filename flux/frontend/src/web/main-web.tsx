import React from "react";
import { createRoot } from "react-dom/client";
import "../style.css";
import { WebApp } from "./WebApp";

// Normal browser scrolling — override the desktop-app overflow:hidden
document.body.style.overflow = "auto";
document.documentElement.style.overflow = "auto";

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <WebApp />
  </React.StrictMode>
);
