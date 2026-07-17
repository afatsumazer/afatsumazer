import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const username = document.getElementById("username");
const email = document.getElementById("email");
const projectCount = document.getElementById("projectCount");
const newProject = document.getElementById("newProject");
const logoutBtn = document.getElementById("logoutBtn");

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    username.textContent = user.displayName || "Pengguna";
    email.textContent = user.email;

    let total = Number(localStorage.getItem("projectCount") || 0);
    projectCount.textContent = total;
});

newProject.addEventListener("click", () => {
    let total = Number(localStorage.getItem("projectCount") || 0);
    total++;

    localStorage.setItem("projectCount", total);
    projectCount.textContent = total;

    alert("Project berhasil ditambahkan.");
});

logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    location.href = "login.html";
});
