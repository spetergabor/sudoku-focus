"use client";
import { useEffect } from "react";
export default function ServiceWorker() {
  useEffect(() => { if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register(new URL("sw.js", document.baseURI).pathname).catch(() => undefined); }, []);
  return null;
}
