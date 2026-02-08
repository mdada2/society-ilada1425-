import { bot } from '../server/telegram-bot';

export default async function handler(req: any, res: any) {
    if (req.method === 'POST') {
        try {
            // Process the Telegram update
            await bot.processUpdate(req.body);
            res.status(200).send('OK');
        } catch (error) {
            console.error('Error processing update:', error);
            res.status(500).send('Error');
        }
    } else {
        res.status(200).send('Society Mitra AI Bot is running!');
    }
}
