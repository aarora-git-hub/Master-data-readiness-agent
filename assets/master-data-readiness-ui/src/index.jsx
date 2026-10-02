import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@ui5/webcomponents-react/dist/Assets";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />);
