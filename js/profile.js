import { auth } from "./firebase-config.js";

import {
onAuthStateChanged,
signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const photo=document.getElementById("photo");
const name=document.getElementById("name");
const email=document.getElementById("email");
const uid=document.getElementById("uid");
const verified=document.getElementById("verified");
const created=document.getElementById("created");
const lastlogin=document.getElementById("lastlogin");

const logout=document.getElementById("logout");

onAuthStateChanged(auth,(user)=>{

if(!user){

location.href="login.html";
return;

}

photo.src=user.photoURL || "https://ui-avatars.com/api/?name="+encodeURIComponent(user.displayName || "User");

name.innerHTML=user.displayName || "Pengguna";

email.innerHTML=user.email;

uid.innerHTML=user.uid;

verified.innerHTML=user.emailVerified ? "Sudah Verifikasi" : "Belum Verifikasi";

created.innerHTML=new Date(user.metadata.creationTime).toLocaleString("id-ID");

lastlogin.innerHTML=new Date(user.metadata.lastSignInTime).toLocaleString("id-ID");

});

logout.onclick=()=>{

signOut(auth).then(()=>{

location.href="login.html";

});

};
