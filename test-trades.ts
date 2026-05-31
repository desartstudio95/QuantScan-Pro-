import { db } from "./src/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

(async () => {
    try {
        const usersSnap = await getDocs(query(collection(db, 'users'), where('email', '==', 'desartstudiopro@gmail.com')));
        if (usersSnap.empty) {
            console.log('User not found');
            return;
        }
        const user = usersSnap.docs[0];
        console.log(`Checking auto_trades for user ${user.id}`);
        const tradesSnap = await getDocs(collection(db, 'users', user.id, 'auto_trades'));
        if (tradesSnap.empty) {
             console.log('No trades found for this user.');
        } else {
             console.log('Found ' + tradesSnap.size + ' trades:');
             tradesSnap.forEach(t => console.log(t.id, t.data()));
        }
        process.exit(0);
    } catch(e) {
        console.error('Error:', e);
        process.exit(1);
    }
})();
