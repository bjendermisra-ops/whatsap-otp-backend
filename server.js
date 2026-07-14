const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Temporary Memory to Store OTPs
const otpStore = {};

// WhatsApp configuration optimized for Render Free Tier (512MB RAM)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        handleSIGINT: false,
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Memory usage optimize karne ke liye
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process' // Ram bachane ke liye single process launch karega
        ]
    }
});

// Logs me scan karne ke liye QR Code
client.on('qr', (qr) => {
    console.log('\n=============================================');
    console.log('SCAN THIS QR CODE TO ACTIVATE YOUR GATEWAY:');
    console.log('=============================================');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n[SUCCESS] WhatsApp OTP Gateway is now fully active!');
});

client.on('auth_failure', (msg) => {
    console.error('Session authentication failed:', msg);
});

client.initialize();

// Render ka status check rakhne ke liye base API (Health Check)
app.get('/', (req, res) => {
    res.send('WhatsApp OTP Gateway is running fine!');
});

// OTP send karne ke liye API
app.post('/api/send-otp', async (req, res) => {
    const { number } = req.body;
    if (!number || number.length !== 10) {
        return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit phone number.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[number] = otp;

    // Delete OTP after 2 minutes
    setTimeout(() => { delete otpStore[number]; }, 120000);

    const chatId = `91${number}@c.us`;

    try {
        const textMessage = `*${otp}* is your verification code. For your security, do not share this code.`;
        await client.sendMessage(chatId, textMessage);
        console.log(`[OTP SENT] ${otp} sent to +91${number}`);
        res.json({ success: true });
    } catch (err) {
        console.error('WhatsApp Error:', err);
        res.status(500).json({ success: false, error: 'Failed to send WhatsApp message. Please check logs.' });
    }
});

// OTP verify karne ke liye API
app.post('/api/verify-otp', (req, res) => {
    const { number, otp } = req.body;
    
    if (otpStore[number] && otpStore[number] === otp) {
        delete otpStore[number]; // Verification ke baad delete kar dein
        return res.json({ success: true, message: 'OTP verified successfully.' });
    }
    
    res.status(400).json({ success: false, error: 'Invalid or Expired OTP' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server launched successfully on port ${PORT}`));
