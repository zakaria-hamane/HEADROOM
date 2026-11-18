export const THEME_STORAGE_KEY = "headroom.theme";

/** Runs in <head> before first paint: applies the saved theme so there is no flash. */
export const themeScript = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(e){}})()`;
