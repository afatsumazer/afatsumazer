import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    query,
    where,
    getDocs,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const table = document.getElementById("projectTable");
const btnNew = document.getElementById("newProject");

// Tombol tambah project
btnNew.addEventListener("click", () => {
    window.location.href = "new-project.html";
});

// Cek Login
onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    loadProjects(user.uid);

});

// Load Project
async function loadProjects(uid) {

    table.innerHTML = `
        <tr>
            <td colspan="4" style="text-align:center;">
                Memuat data...
            </td>
        </tr>
    `;

    try {

        const q = query(
            collection(db, "projects"),
            where("uid", "==", uid),
            orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {

            table.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center;">
                        Belum ada project.
                    </td>
                </tr>
            `;

            return;

        }

        table.innerHTML = "";

        snapshot.forEach(doc => {

            const data = doc.data();

            table.innerHTML += `

            <tr>

                <td>${data.title}</td>

                <td>Rp ${(data.budget || 0).toLocaleString("id-ID")}</td>

                <td>${data.status}</td>

                <td>

                    <button onclick="editProject('${doc.id}')">

                        Edit

                    </button>

                    <button onclick="deleteProject('${doc.id}')">

                        Hapus

                    </button>

                </td>

            </tr>

            `;

        });

    } catch (err) {

        console.error(err);

        table.innerHTML = `
            <tr>
                <td colspan="4">
                    ${err.message}
                </td>
            </tr>
        `;

    }

}

// Fungsi sementara
window.editProject = function(id){

    alert("Edit Project : " + id);

}

window.deleteProject = function(id){

    if(confirm("Hapus project ini?")){

        alert("Fungsi delete akan dibuat berikutnya.");

    }

}
