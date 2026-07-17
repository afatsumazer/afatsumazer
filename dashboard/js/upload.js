import { auth, db, storage } from "./firebase-config.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    ref,
    uploadBytesResumable,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const fileInput = document.getElementById("fileInput");
const chooseBtn = document.getElementById("chooseBtn");
const uploadBtn = document.getElementById("uploadBtn");

const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");

const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

let selectedFile = null;
let currentUser = null;

/* ===========================
   LOGIN
=========================== */

onAuthStateChanged(auth, (user) => {

    if (!user) {
        alert("Silakan login terlebih dahulu.");
        window.location.href = "../login.html";
        return;
    }

    currentUser = user;

});

/* ===========================
   PILIH FILE
=========================== */

chooseBtn.addEventListener("click", () => {

    fileInput.click();

});

fileInput.addEventListener("change", () => {

    selectedFile = fileInput.files[0];

    if (!selectedFile) return;

    fileInfo.style.display = "block";

    fileName.textContent = selectedFile.name;

    fileSize.textContent =
        (selectedFile.size / 1024 / 1024).toFixed(2) + " MB";

    uploadBtn.style.display = "inline-flex";

});

/* ===========================
   UPLOAD
=========================== */

uploadBtn.addEventListener("click", async () => {

    if (!selectedFile) {

        alert("Pilih file terlebih dahulu.");

        return;

    }

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = "Mengupload...";

    const storagePath =
        "uploads/" +
        currentUser.uid +
        "/" +
        Date.now() +
        "_" +
        selectedFile.name;

    const storageRef = ref(storage, storagePath);

    const task = uploadBytesResumable(storageRef, selectedFile);

    task.on(

        "state_changed",

        (snapshot) => {

            const progress =
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

            progressBar.style.width = progress + "%";

            progressText.innerHTML =
                Math.round(progress) + "%";

        },

        (error) => {

            console.error(error);

            alert("Upload gagal.");

            uploadBtn.disabled = false;

            uploadBtn.innerHTML = "Upload Sekarang";

        },

        async () => {

            const url = await getDownloadURL(task.snapshot.ref);

            await addDoc(collection(db, "files"), {

                uid: currentUser.uid,

                name: selectedFile.name,

                size: selectedFile.size,

                type: selectedFile.type,

                storagePath: storagePath,

                url: url,

                createdAt: serverTimestamp()

            });

            progressBar.style.width = "100%";

            progressText.innerHTML = "Upload berhasil";

            alert("File berhasil diupload.");

            window.location.href = "files.html";

        }

    );

});
