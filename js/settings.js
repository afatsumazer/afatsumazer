import { auth } from "./firebase-config.js";

import {
onAuthStateChanged,
updateProfile,
sendEmailVerification,
sendPasswordResetEmail,
deleteUser,
signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const displayName=document.getElementById("displayName");

onAuthStateChanged(auth,(user)=>{

if(!user){

location.href="login.html";
return;

}

displayName.value=user.displayName || "";

});

document.getElementById("saveProfile").onclick=async()=>{

const user=auth.currentUser;

await updateProfile(user,{
displayName:displayName.value
});

alert("Nama berhasil diperbarui.");

};

document.getElementById("verifyEmail").onclick=async()=>{

await sendEmailVerification(auth.currentUser);

alert("Email verifikasi telah dikirim.");

};

document.getElementById("resetPassword").onclick=async()=>{

await sendPasswordResetEmail(auth,auth.currentUser.email);

alert("Link reset password telah dikirim.");

};

document.getElementById("logout").onclick=async()=>{

await signOut(auth);

location.href="login.html";

};

document.getElementById("deleteAccount").onclick=async()=>{

if(confirm("Yakin ingin menghapus akun?")){

await deleteUser(auth.currentUser);

location.href="register.html";

}

};
