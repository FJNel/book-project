// Utility to send verification emails using Mailgun (official SDK)

const { logToFile } = require("./logging");
const FormData = require("form-data");
const Mailgun = require("mailgun.js");

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@fjnel.co.za";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://fjnel.co.za";
const MAILGUN_REGION = process.env.MAILGUN_REGION || "US"; // "EU" for EU domains

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: "api",
  key: MAILGUN_API_KEY,
  url: MAILGUN_REGION === "EU" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net"
});

async function sendVerificationEmail(toEmail, verificationToken, preferredName, expiresIn = 60) {
	if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL || !FRONTEND_URL) {
	  logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
	  console.error("Email service is not configured. Please check environment variables.");
	  return false;
	}
  
	const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;
	const subject = "Verify your email address for the Book Project";
	const year = new Date().getFullYear();
  
	const html = `
	<div style="background-color: #f4f6f8; padding: 40px 0; font-family: Arial, sans-serif;">
	  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
		<tr>
		  <td align="center" style="padding: 24px;">
			<!-- LOGO -->
			<img src="https://via.placeholder.com/150x50?text=Book+Project" alt="Book Project" style="display: block; height: 50px; margin-bottom: 16px;">
		  </td>
		</tr>
		<tr>
		  <td style="padding: 0 32px 32px 32px; color: #333;">
			<h2 style="color: #2d3748; margin-bottom: 16px;">Welcome${preferredName ? `, ${preferredName}` : ""}!</h2>
			<p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
			  Thank you for registering for the <strong>Book Project</strong>.<br>
			  Please verify your email address to activate your account.
			</p>
			<div style="text-align: center; margin: 32px 0;">
			  <a href="${verificationUrl}" style="background-color: #3182ce; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; display: inline-block;">
				Verify Email
			  </a>
			</div>
			<p style="font-size: 14px; color: #718096; line-height: 1.5;">
			  If you did not sign up for this account, you can safely ignore this email.<br>
			  This link will expire in <strong>${expiresIn} minutes</strong>.
			</p>
			<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
			<p style="font-size: 12px; color: #a0aec0; text-align: center;">
			  &copy; ${year} Book Project. All rights reserved.
			</p>
		  </td>
		</tr>
	  </table>
	</div>
	`;
  
	try {
	  const data = await mg.messages.create(MAILGUN_DOMAIN, {
		from: `Book Project <${FROM_EMAIL}>`,
		to: [`${preferredName} <${toEmail}>`],
		subject,
		html
	  });
  
	  logToFile("EMAIL_SENT", { to: toEmail, type: "verification", id: data.id });
	  return true;
	} catch (error) {
	  logToFile("EMAIL_SEND_ERROR", { to: toEmail, error: error.message }, "error");
	  console.error("Error sending verification email:", error.message);
	  return false;
	}
  }
  

module.exports = { sendVerificationEmail };