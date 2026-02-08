import { initBot } from './lib/bot-logic';

export default async function handler(req: any, res: any) {
    const BOT_TOKEN = process.env.VITE_TELEGRAM_BOT_TOKEN;
    console.log('🔗 Bot API Request Received:', req.method);

    if (req.method === 'POST') {
        try {
            const { bot } = await initBot();

            if (!bot) {
                console.error('❌ Bot instance not initialized!');
                return res.status(200).json({ error: 'Bot not ready', status: 'critical' });
            }

            console.log('📩 Update received from Telegram');
            await bot.processUpdate(req.body);
            return res.status(200).send('OK');
        } catch (error: any) {
            console.error('❌ Error in API handler:', error.message);
            return res.status(200).json({ error: error.message, status: 'error' });
        }
    } else {
        // Status check for GET requests
        let botReady = false;
        try {
            const { bot } = await initBot();
            botReady = !!bot;
        } catch (e) {
            console.error('Status check init failed:', e);
        }

        return res.status(200).json({
            status: 'running',
            bot_ready: botReady,
            token_configured: !!BOT_TOKEN,
            env: process.env.VERCEL ? 'vercel' : 'local',
            timestamp: new Date().toISOString(),
            node_version: process.version
        });
    }
}
