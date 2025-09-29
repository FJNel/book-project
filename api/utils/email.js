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

  async function sendPasswordResetEmail(toEmail, resetToken, preferredName, expiresIn = 60) {
	if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL || !FRONTEND_URL) {
		logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
		console.error("Email service is not configured. Please check environment variables.");
		return false;
	}

	const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
	const subject = "Reset your password for the Book Project";
	const year = new Date().getFullYear();

	const html = `
	<div style="background-color: #f4f6f8; padding: 40px 0; font-family: Arial, sans-serif;">
	  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" 
		style="max-width: 600px; background: #ffffff; border-radius: 8px; 
		box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
		<tr>
		  <td align="center" style="padding: 24px;">
			<!-- LOGO -->
			<img src="https://via.placeholder.com/150x50?text=Book+Project" alt="Book Project" 
			  style="display: block; height: 50px; margin-bottom: 16px;">
		  </td>
		</tr>
		<tr>
		  <td style="padding: 0 32px 32px 32px; color: #333;">
			<h2 style="color: #2d3748; margin-bottom: 16px;">
			  Hello${preferredName ? `, ${preferredName}` : ""}!
			</h2>
			<p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
			  We received a request to reset your password for the <strong>Book Project</strong>.<br>
			  If this was you, click the button below to set a new password.
			</p>
			<div style="text-align: center; margin: 32px 0;">
			  <a href="${resetUrl}" style="background-color: #e53e3e; color: #ffffff; 
				text-decoration: none; padding: 14px 28px; border-radius: 6px; 
				font-weight: bold; display: inline-block;">
				Reset Password
			  </a>
			</div>
			<p style="font-size: 14px; color: #718096; line-height: 1.5;">
			  If you did not request a password reset, you can safely ignore this email.<br>
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

		logToFile("EMAIL_SENT", { to: toEmail, type: "password_reset", id: data.id });
		return true;
	} catch (error) {
		logToFile("EMAIL_SEND_ERROR", { to: toEmail, error: error.message }, "error");
		console.error("Error sending password reset email:", error.message);
		return false;
	}
}

async function sendAccountDisableConfirmationEmail(toEmail, preferredName) {
	if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL || !FRONTEND_URL) {
	  logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
	  console.error("Email service is not configured. Please check environment variables.");
	  return false;
	}
	const subject = "Your Book Project account has been disabled";
	const year = new Date().getFullYear();
	const supportEmail = "support@fjnel.co.za"; // Change to your actual admin/support email
  
	const html = `
	<div style="background-color: #f4f6f8; padding: 40px 0; font-family: Arial, sans-serif;">
	  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" 
		style="max-width: 600px; background: #ffffff; border-radius: 8px; 
		box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
		<tr>
		  <td align="center" style="padding: 24px;">
			<!-- LOGO -->
			<img src="https://via.placeholder.com/150x50?text=Book+Project" 
			  alt="Book Project" 
			  style="display: block; height: 50px; margin-bottom: 16px;">
		  </td>
		</tr>
		<tr>
		  <td style="padding: 0 32px 32px 32px; color: #333;">
			<h2 style="color: #2d3748; margin-bottom: 16px;">
			  Hello${preferredName ? `, ${preferredName}` : ""}.
			</h2>
			<p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
			  This is a confirmation that your <strong>Book Project</strong> account has been 
			  <strong>disabled</strong>.
			</p>
			<p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
			  From now on:
			</p>
			<ul style="font-size: 15px; color: #4a5568; line-height: 1.5; padding-left: 20px;">
			  <li>You will no longer be able to log in.</li>
			  <li>You cannot use any of the Book Project features.</li>
			  <li>Your data will remain in our database, but is marked as disabled.</li>
			</ul>
			<p style="font-size: 16px; color: #4a5568; line-height: 1.5; margin-top: 20px;">
			  If you would like to <strong>reactivate</strong> your account, please contact the 
			  System Administrator at <a href="mailto:${supportEmail}" style="color: #3182ce;">${supportEmail}</a>. Provide them with your email address and request account reactivation.
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
  
	  logToFile("EMAIL_SENT", { to: toEmail, type: "account_disabled", id: data.id });
	  return true;
	} catch (error) {
	  logToFile("EMAIL_SEND_ERROR", { to: toEmail, error: error.message }, "error");
	  console.error("Error sending account disable confirmation email:", error.message);
	  return false;
	}
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };