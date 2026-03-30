require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Resend } = require('resend');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'Kaveenabuilders@gmail.com';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

if (!RESEND_API_KEY) {
  console.error('Missing RESEND_API_KEY. Set it in .env before starting the server.');
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false
});

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

function sanitizeInput(value, maxLength = 1000) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(value) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

// Middleware
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(requestLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve static files from project root
app.use(express.static(path.join(__dirname, '..')));

// Contact form endpoint
app.post('/api/contact', formLimiter, async (req, res) => {
  const name = sanitizeInput(req.body.name, 120);
  const email = sanitizeInput(req.body.email, 160);
  const subject = sanitizeInput(req.body.subject, 160);
  const message = sanitizeInput(req.body.message, 4000);

  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      error: 'Name, email, and message are required.'
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid email address.'
    });
  }

  try {
    await resend.emails.send({
      from: `Kaveena Builders Website <${RESEND_FROM_EMAIL}>`,
      to: CONTACT_EMAIL,
      subject: subject ? `Website Inquiry: ${subject}` : `New Contact Form Submission from ${name}`,
      replyTo: email,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1a1a2e; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: #ffffff; margin: 0;">New Contact Form Submission</h2>
          </div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #333; width: 120px;">Name:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #555;">${escapeHtml(name)}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #333;">Email:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #555;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #333;">Subject:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #555;">${escapeHtml(subject || 'No subject provided')}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #333; vertical-align: top;">Message:</td>
                <td style="padding: 10px 0; color: #555;">${escapeHtml(message).replace(/\n/g, '<br>')}</td>
              </tr>
            </table>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 16px; text-align: center;">
            This message was sent from the Kaveena Builders website contact form.
          </p>
        </div>
      `
    });

    return res.json({ success: true, message: 'Your message has been sent successfully. We will get back to you soon!' });
  } catch (error) {
    console.error('Resend error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send your message. Please try again or contact us directly at Kaveenabuilders@gmail.com'
    });
  }
});

// Newsletter subscription endpoint
app.post('/api/subscribe', formLimiter, async (req, res) => {
  const email = sanitizeInput(req.body.email, 160);

  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required.' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
  }

  try {
    await resend.emails.send({
      from: `Kaveena Builders Website <${RESEND_FROM_EMAIL}>`,
      to: CONTACT_EMAIL,
      subject: 'New Newsletter Subscription',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a2e;">New Newsletter Subscription</h2>
          <p style="color: #555;">A new visitor has subscribed to the newsletter:</p>
          <p style="background: #f5f5f5; padding: 12px; border-radius: 6px; font-size: 16px;"><strong>${escapeHtml(email)}</strong></p>
        </div>
      `
    });

    return res.json({ success: true, message: 'Thank you for subscribing!' });
  } catch (error) {
    console.error('Resend error:', error);
    return res.status(500).json({ success: false, error: 'Subscription failed. Please try again.' });
  }
});

// Quote request endpoint
app.post('/api/quote', formLimiter, async (req, res) => {
  const name = sanitizeInput(req.body.name, 120);
  const email = sanitizeInput(req.body.email, 160);
  const phone = sanitizeInput(req.body.phone, 40);
  const company = sanitizeInput(req.body.company, 160);
  const location = sanitizeInput(req.body.location, 200);
  const message = sanitizeInput(req.body.message, 5000);
  const services = Array.isArray(req.body.services)
    ? req.body.services.map((s) => sanitizeInput(String(s), 120)).filter(Boolean)
    : [];

  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      error: 'Name, email, and project details are required.'
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid email address.'
    });
  }

  const servicesList = services.length > 0
    ? services.map((s) => `<li style="padding: 4px 0;">${escapeHtml(s)}</li>`).join('')
    : '<li>No specific services selected</li>';

  try {
    await resend.emails.send({
      from: `Kaveena Builders Website <${RESEND_FROM_EMAIL}>`,
      to: CONTACT_EMAIL,
      subject: `Quote Request from ${name}`,
      replyTo: email,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1a1a2e; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: #ffffff; margin: 0;">New Quote Request</h2>
          </div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #333; width: 140px;">Name:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #555;">${escapeHtml(name)}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #333;">Email:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #555;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #333;">Phone:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #555;">${escapeHtml(phone || 'Not provided')}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #333;">Company:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #555;">${escapeHtml(company || 'Not provided')}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #333;">Location:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #555;">${escapeHtml(location || 'Not provided')}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; color: #333; vertical-align: top;">Services:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #555;"><ul style="margin: 0; padding-left: 20px;">${servicesList}</ul></td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #333; vertical-align: top;">Details:</td>
                <td style="padding: 10px 0; color: #555;">${escapeHtml(message).replace(/\n/g, '<br>')}</td>
              </tr>
            </table>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 16px; text-align: center;">
            This quote was requested from the Kaveena Builders website.
          </p>
        </div>
      `
    });

    return res.json({ success: true, message: 'Your quote request has been submitted! Our team will contact you within 24 hours.' });
  } catch (error) {
    console.error('Resend error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit your request. Please call us directly at 9344393610.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Kaveena Builders server running on port ${PORT}`);
});
