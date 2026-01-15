import { createRoot } from "react-dom/client";
import "./index.css";
import { renderFullApp } from "./entries/fullApp";

const root = createRoot(document.getElementById("root")!);
renderFullApp(root);

const splash = document.getElementById("initial-loading");
if (splash) {
  const finish = () => {
    splash.classList.add("initial-loading--fade");
    splash.addEventListener(
      "transitionend",
      () => {
        splash.remove();
      },
      { once: true },
    );
  };

  if (document.readyState === "complete") {
    finish();
  } else {
    window.addEventListener("load", finish, { once: true });
  }
}
