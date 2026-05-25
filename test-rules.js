import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc } from "firebase/firestore";
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyDVUxpAmWf57dGrj0dltwg-2d3jytGpJCY",
  authDomain: "quantscan-pro.firebaseapp.com",
  projectId: "quantscan-pro",
  storageBucket: "quantscan-pro.firebasestorage.app",
  messagingSenderId: "580184623755",
  appId: "1:580184623755:web:4c5fcf6fd4a8f7bc13628e",
  measurementId: "G-4WZHMKD7Y6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    const signalsRef = collection(db, "telegram_active_signals");
    console.log("Adding doc...");
    const ref = await addDoc(signalsRef, { status: "ACTIVE", pair: "TEST/USD" });
    console.log("Added doc", ref.id);
    
    console.log("Querying...");
    const q = query(signalsRef, where("status", "==", "ACTIVE"));
    const querySnapshot = await getDocs(q);
    console.log("Query returned", querySnapshot.size);
    
    for (const docSnap of querySnapshot.docs) {
      if (docSnap.id === ref.id) {
         console.log("Updating doc...");
         await updateDoc(docSnap.ref, { status: "CLOSED" });
         console.log("Update success!");
      }
    }
  } catch (e) {
    console.error("Error monitoring signals:", e);
  }
}
test();
