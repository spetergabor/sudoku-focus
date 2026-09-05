import React from "react";
import { createRoot } from "react-dom/client";
import SudokuApp from "../components/SudokuApp";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><SudokuApp /></React.StrictMode>);
