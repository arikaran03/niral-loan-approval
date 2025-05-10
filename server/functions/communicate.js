import {SENDER_EMAIL, SENDER_PASSWORD, SMTP_SERVER, SMTP_PORT} from './config.js';
import nodemailer from 'nodemailer';

async function sendConfiguredEmail(mailDetails) {
    // --- SMTP Configuration (loaded from .env or defaults) ---
    const senderEmail = SENDER_EMAIL;
    const senderPassword = SENDER_PASSWORD; // Ensure this is your app password if using Gmail with 2FA
    const smtpServer =  SMTP_SERVER;
    const smtpPort = parseInt(SMTP_PORT, 10);

    // Create a reusable transporter object
    let transporterConfig = {
        host: smtpServer,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465 (SSL), false for other ports (STARTTLS for 587)
        auth: {
            user: senderEmail,
            pass: senderPassword,
        },
        // logger: true, // Enable for debugging SMTP communication
        // debug: true,  // Enable for debugging SMTP communication
    };

    if (smtpPort !== 465) {
        transporterConfig.tls = {
            // ciphers: 'SSLv3', // Use if your server requires specific ciphers
            rejectUnauthorized: false // Set to true in production with valid certs. False for self-signed/dev.
        };
    }

    const transporter = nodemailer.createTransport(transporterConfig);

    // Verify connection on startup (optional, but good for quick feedback)
    transporter.verify((error, success) => {
        if (error) {
            console.error("SMTP Configuration Error. Email sending will likely fail.");
            console.error(`Failed to connect/verify SMTP server: ${error.message}`);
            if (error.code === 'EAUTH') {
                console.error("-> SMTP Authentication Error: Check SENDER_EMAIL/SENDER_PASSWORD or App Password.");
            } else if (error.code === 'ECONNREFUSED') {
                console.error(`-> SMTP Connect Error: Could not connect to ${SMTP_SERVER}:${SMTP_PORT}.`);
            }
        } else {
            console.log("SMTP Transporter is configured and ready to send emails.");
        }
    });

    if (!mailDetails || !mailDetails.to || !mailDetails.subject || !mailDetails.htmlBody) {
        throw new Error("Missing required email parameters: to, subject, or htmlBody.");
    }
    // Basic plain text generation if not provided
    const plainText = mailDetails.plainTextBody || mailDetails.htmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const emailOptions = {
        from: mailDetails.customFrom || `"${SMTP_SERVER.startsWith('smtp.gmail') ? 'Your Gmail App' : 'Our Service'}" <${SENDER_EMAIL}>`,
        to: mailDetails.to,
        subject: mailDetails.subject,
        html: mailDetails.htmlBody, // Directly use the provided HTML
        text: plainText,
        attachments: mailDetails.attachments || [], // Directly use provided attachments, or empty array if none
    };
    
    try {
        let info = await transporter.sendMail(emailOptions);
        console.log(`Successfully sent email to: ${mailDetails.to}. Message ID: ${info.messageId}`);
        return info.messageId;
    } catch (error) {
        console.error(`Failed to send email to ${mailDetails.to}.`);
        console.error(`Error details: ${error.message}`);
        // For more detailed SMTP errors:
        // if (error.responseCode) console.error(`SMTP Response Code: ${error.responseCode}`);
        // if (error.response) console.error(`SMTP Response: ${error.response}`);
        throw error; // Re-throw the error to be caught by the caller
    }
}

export { sendConfiguredEmail };