// api/send-feedback.js
const nodemailer = require('nodemailer');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { name, email, message } = req.body;

    if (!message) {
        return res.status(400).json({ message: 'Message is required' });
    }

    // Ensure Environment Variables are set in Vercel Dashboard
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return res.status(500).json({ message: 'Server Configuration Error' });
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    try {
        await transporter.sendMail({
            from: `"LibNav Feedback" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, 
            replyTo: email,
            subject: `New LibNav Feedback from ${name || 'Anonymous'}`,
            text: `Name: ${name || 'Anonymous'}\nEmail: ${email || 'Not provided'}\n\nMessage:\n${message}`,
        });

        return res.status(200).json({ message: 'Feedback sent successfully!' });
    } catch (error) {
        console.error('Email error:', error);
        return res.status(500).json({ message: 'Failed to send email.' });
    }
}
