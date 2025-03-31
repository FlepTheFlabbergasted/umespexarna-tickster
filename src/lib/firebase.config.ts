import { getFirestore } from "@firebase/firestore";
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyCMsHhNCwpmw89jscjIQ9qE1hcFOMY3hEk",
  authDomain: "umespexarna-tickster.firebaseapp.com",
  projectId: "umespexarna-tickster",
  storageBucket: "umespexarna-tickster.firebasestorage.app",
  messagingSenderId: "260226931316",
  appId: "1:260226931316:web:3928ba6f79f83ef6250f21"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);