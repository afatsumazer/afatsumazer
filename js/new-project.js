import { auth, db } from "../firebase-config.js";

import {
collection,
addDoc,
serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const btn=document.getElementById("saveBtn");

btn.addEventListener("click", async()=>{

const user=auth.currentUser;

if(!user){
alert("Silakan login.");
return;
}

const title=document.getElementById("title").value.trim();

const description=document.getElementById("description").value.trim();

if(title==""){
alert("Judul wajib diisi");
return;
}

try{

await addDoc(collection(db,"projects"),{

uid:user.uid,

title:title,

description:description,

createdAt:serverTimestamp()

});

document.getElementById("status").innerHTML=
"Project berhasil dibuat.";

document.getElementById("title").value="";
document.getElementById("description").value="";

}catch(err){

console.log(err);

alert(err.message);

}

});
