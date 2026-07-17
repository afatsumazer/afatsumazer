import { auth, db } from "../firebase-config.js";

import {
collection,
addDoc,
getDocs,
query,
where,
serverTimestamp
}
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const btn=document.getElementById("addProject");

const list=document.getElementById("projectList");

btn.onclick=async()=>{

const user=auth.currentUser;

if(!user){

alert("Silakan login.");

return;

}

const title=document.getElementById("projectTitle").value.trim();

const desc=document.getElementById("projectDesc").value.trim();

if(title===""){

alert("Nama Project wajib diisi");

return;

}

try{

await addDoc(collection(db,"projects"),{

uid:user.uid,

title,

description:desc,

createdAt:serverTimestamp()

});

document.getElementById("projectTitle").value="";

document.getElementById("projectDesc").value="";

document.getElementById("projectMessage").innerHTML="✅ Project berhasil dibuat";

loadProjects();

}catch(err){

alert(err.message);

}

};

async function loadProjects(){

const user=auth.currentUser;

if(!user) return;

list.innerHTML="";

const q=query(

collection(db,"projects"),

where("uid","==",user.uid)

);

const snap=await getDocs(q);

snap.forEach(doc=>{

const data=doc.data();

list.innerHTML+=`

<div class="project">

<h3>${data.title}</h3>

<p>${data.description}</p>

</div>

`;

});

}

auth.onAuthStateChanged(user=>{

if(user){

loadProjects();

}else{

location.href="../login.html";

}

});
