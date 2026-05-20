import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const sendTelegramAlert = async (signalData: any) => {
    try {
        const settingsRef = doc(db, 'settings', 'app');
        const settingsSnap = await getDoc(settingsRef);
        
        if (!settingsSnap.exists()) return;
        
        const { telegramBotToken, telegramChatId } = settingsSnap.data();
        
        if (!telegramBotToken || !telegramChatId) return;

        const emojis = {
            BUY: '🟢',
            SELL: '🔴',
            WAIT: '⏳'
        };

        const signalType = signalData.decision || 'WAIT';
        const emoji = emojis[signalType as keyof typeof emojis] || 'ℹ️';

        const message = `
🚨 *NOVO SINAL QUANT-SCAN IA* 🚨

*Par:* ${signalData.pair}
*Timeframe:* ${signalData.timeframe || '15m'}
*Ação:* ${emoji} *${signalType}*
*Confiança:* ${signalData.score}%

*Entrada:* ${signalData.entry || 'N/A'}
*Take Profit 1:* ${signalData.takeProfit || 'N/A'}
*Take Profit 2:* ${signalData.takeProfit2 || 'N/A'}
*Take Profit 3:* ${signalData.takeProfit3 || 'N/A'}
*Stop Loss:* ${signalData.stopLoss || 'N/A'}

_Analisado por Inteligência Institucional_
`;

        const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: telegramChatId,
                text: message,
                parse_mode: 'Markdown'
            })
        });

        if (!response.ok) {
            console.error('Failed to send Telegram message', await response.text());
        }

    } catch (error) {
        console.error('Error sending Telegram alert:', error);
    }
}
