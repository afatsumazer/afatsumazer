import { auth, db, storage } from "./firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    doc,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    ref,
    deleteObject
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const loading = document.getElementById("loading");
const empty = document.getElementById("empty");
const fileList = document.getElementById("fileList");
const search = document.getElementById("search");
const filter = document.getElementById("filter");

let files = [];

/* ===============================
   LOGIN
================================ */

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        location.href = "../login.html";
        return;
    }

    await loadFiles(user.uid);

});

/* ===============================
   LOAD FILE
================================ */

async function loadFiles(uid){

    loading.style.display="block";
    fileList.innerHTML="";

    const q = query(
        collection(db,"files"),
        where("uid","==",uid),
        orderBy("createdAt","desc")
    );

    const snap = await getDocs(q);

    files=[];

    snap.forEach(docSnap=>{

        files.push({
            id:docSnap.id,
            ...docSnap.data()
        });

    });

    loading.style.display="none";

    render(files);

}

/* ===============================
   RENDER
================================ */

function render(data){

    fileList.innerHTML="";

    if(data.length===0){

        empty.style.display="block";

        return;

    }

    empty.style.display="none";

    data.forEach(file=>{

        let icon="fa-file";

        if(file.type?.includes("image"))
            icon="fa-file-image";

        else if(file.type?.includes("pdf"))
            icon="fa-file-pdf";

        else if(file.type?.includes("word"))
            icon="fa-file-word";

        else if(file.type?.includes("excel"))
            icon="fa-file-excel";

        else if(file.type?.includes("zip"))
            icon="fa-file-zipper";

        const card=document.createElement("div");

        card.className="card";

        card.innerHTML=`

        <div class="icon">

            <i class="fa-solid ${icon}"></i>

        </div>

        <div class="info">

            <h3>${file.name}</h3>

            <p>${(file.size/1024/1024).toFixed(2)} MB</p>

        </div>

        <div class="action">

            <button class="download">

                <i class="fa fa-download"></i>

            </button>

            <button class="share">

                <i class="fa fa-share"></i>

            </button>

            <button class="delete">

                <i class="fa fa-trash"></i>

            </button>

        </div>

        `;

        /* DOWNLOAD */

        card.querySelector(".download").onclick=()=>{

            window.open(file.url,"_blank");

        };

        /* SHARE */

        card.querySelector(".share").onclick=async()=>{

            await navigator.clipboard.writeText(file.url);

            alert("Link berhasil disalin.");

        };

        /* DELETE */

        card.querySelector(".delete").onclick=async()=>{

            if(!confirm("Hapus file ini?")) return;

            try{

                await deleteObject(ref(storage,file.storagePath));

            }catch(e){

                console.log(e);

            }

            await deleteDoc(doc(db,"files",file.id));

            loadFiles(auth.currentUser.uid);

        };

        fileList.appendChild(card);

    });

}

/* ===============================
   SEARCH
================================ */

search.addEventListener("keyup",()=>{

    const key=search.value.toLowerCase();

    render(

        files.filter(f=>

            f.name.toLowerCase().includes(key)

        )

    );

});

/* ===============================
   FILTER
================================ */

filter.addEventListener("change",()=>{

    const type=filter.value;

    if(type==="all"){

        render(files);

        return;

    }

    render(

        files.filter(file=>{

            if(type==="image")
                return file.type.includes("image");

            if(type==="pdf")
                return file.type.includes("pdf");

            if(type==="word")
                return file.type.includes("word");

            if(type==="excel")
                return file.type.includes("excel");

            if(type==="zip")
                return file.type.includes("zip");

            return true;

        })

    );

});
