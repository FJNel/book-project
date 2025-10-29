// Utility to send verification emails using Mailgun (official SDK)

const { logToFile } = require("./logging");
const FormData = require("form-data");
const Mailgun = require("mailgun.js");
const config = require("../config");

const MAILGUN_API_KEY = config.mail.mailgunApiKey;
const MAILGUN_DOMAIN = config.mail.mailgunDomain;
const FROM_EMAIL = config.mail.fromEmail;
const FRONTEND_URL = config.frontend.url;
const MAILGUN_REGION = config.mail.mailgunRegion; // "EU" for EU domains
const SUPPORT_EMAIL = config.mail.supportEmail;

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
  
	const verificationUrl = `${FRONTEND_URL}${config.frontend.verifyPath}?token=${verificationToken}`;
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
			  If you did not register this account, please contact the system administrator at
			  <a href="mailto:${SUPPORT_EMAIL}?subject=The%20Book%20Project%20Unauthorised%20Account%20Registration" style="color: #3182ce;">${SUPPORT_EMAIL}</a>
			  to assist you in resolving this matter.<br>
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
		to: [preferredName ? `${preferredName} <${toEmail}>` : toEmail],
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
} // sendVerificationEmail

  
async function sendPasswordResetEmail(toEmail, resetToken, preferredName, expiresIn = 60) {
	if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL || !FRONTEND_URL) {
		logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
		console.error("Email service is not configured. Please check environment variables.");
		return false;
	}

	const resetUrl = `${FRONTEND_URL}${config.frontend.resetPath}?token=${resetToken}`;
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
			  If you did not request a password reset, please contact the system administrator at
			  <a href=\"mailto:${SUPPORT_EMAIL}?subject=The%20Book%20Project%20Unauthorised%20Password%20Reset%20Request\" style=\"color: #3182ce;\">${SUPPORT_EMAIL}</a>
			  to ensure the safety of your account.<br>
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
			to: [preferredName ? `${preferredName} <${toEmail}>` : toEmail],
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
} // sendPasswordResetEmail

async function sendAccountDisableConfirmationEmail(toEmail, preferredName) {
	if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL || !FRONTEND_URL) {
	  logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
	  console.error("Email service is not configured. Please check environment variables.");
	  return false;
	}
	const subject = "Your Book Project account has been disabled";
	const year = new Date().getFullYear();
	const supportEmail = SUPPORT_EMAIL; // Centralized support email
  
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
		to: [preferredName ? `${preferredName} <${toEmail}>` : toEmail],
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
} // sendAccountDisableConfirmationEmail

async function sendWelcomeEmail(toEmail, preferredName) {
    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL) {
        logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
        console.error("Email service is not configured. Please check environment variables.");
        return false;
    }

    const loginUrl = config.frontend.loginUrl;
    const subject = "Welcome to The Book Project";
    const year = new Date().getFullYear();

    const html = `
    <div style="background-color: #f4f6f8; padding: 40px 0; font-family: Arial, sans-serif;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" 
        style="max-width: 600px; background: #ffffff; border-radius: 8px; 
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <tr>
          <td align="center" style="padding: 24px;">
            <img src="https://via.placeholder.com/150x50?text=Book+Project" alt="Book Project"
              style="display: block; height: 50px; margin-bottom: 16px;">
          </td>
        </tr>
        <tr>
          <td style="padding: 0 32px 32px 32px; color: #333;">
            <h2 style="color: #2d3748; margin-bottom: 16px;">Welcome${preferredName ? `, ${preferredName}` : ""}!</h2>
            <p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
              Your email has been verified successfully. You can now log in to start using <strong>The Book Project</strong>.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${loginUrl}" style="background-color: #3182ce; color: #ffffff; 
                text-decoration: none; padding: 14px 28px; border-radius: 6px; 
                font-weight: bold; display: inline-block;">
                Log In
              </a>
            </div>
			<p style="font-size: 14px; color: #718096; line-height: 1.5;">
			  If you did not verify this email address, please contact the system administrator at
			  <a href="mailto:${SUPPORT_EMAIL}?subject=The%20Book%20Project%20Unauthorised%20Account%20Activation" style="color: #3182ce;">${SUPPORT_EMAIL}</a>
			  to assist you in resolving this matter.<br>
			</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
            <p style="font-size: 12px; color: #a0aec0; text-align: center;">
              &copy; ${year} Book Project. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </div>`;

    try {
        const data = await mg.messages.create(MAILGUN_DOMAIN, {
            from: `Book Project <${FROM_EMAIL}>`,
            to: [preferredName ? `${preferredName} <${toEmail}>` : toEmail],
            subject,
            html
        });
        logToFile("EMAIL_SENT", { to: toEmail, type: "welcome", id: data.id });
        return true;
    } catch (error) {
        logToFile("EMAIL_SEND_ERROR", { to: toEmail, error: error.message }, "error");
        console.error("Error sending welcome email:", error.message);
        return false;
    }
} // sendWelcomeEmail

async function sendPasswordResetSuccessEmail(toEmail, preferredName) {
    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL) {
        logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
        console.error("Email service is not configured. Please check environment variables.");
        return false;
    }

    const loginUrl = config.frontend.loginUrl;
    const subject = "Your password has been reset";
    const year = new Date().getFullYear();

    const html = `
    <div style="background-color: #f4f6f8; padding: 40px 0; font-family: Arial, sans-serif;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" 
        style="max-width: 600px; background: #ffffff; border-radius: 8px; 
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <tr>
          <td align="center" style="padding: 24px;">
            <img src="https://via.placeholder.com/150x50?text=Book+Project" alt="Book Project"
              style="display: block; height: 50px; margin-bottom: 16px;">
          </td>
        </tr>
        <tr>
          <td style="padding: 0 32px 32px 32px; color: #333;">
            <h2 style="color: #2d3748; margin-bottom: 16px;">Password Reset Successful${preferredName ? `, ${preferredName}` : ""}</h2>
            <p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
              Your password has been updated successfully. You can now log in using your new password.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${loginUrl}" style="background-color: #3182ce; color: #ffffff; 
                text-decoration: none; padding: 14px 28px; border-radius: 6px; 
                font-weight: bold; display: inline-block;">
                Log In
              </a>
            </div>
			<p style="font-size: 14px; color: #718096; line-height: 1.5;">
			  If you did not reset your password, please contact the system administrator at
			  <a href="mailto:${SUPPORT_EMAIL}?subject=The%20Book%20Project%20Unauthorised%20Password%20Reset%20Success" style="color: #3182ce;">${SUPPORT_EMAIL}</a>
			  to secure your account.<br>
			</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
            <p style="font-size: 12px; color: #a0aec0; text-align: center;">
              &copy; ${year} Book Project. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </div>`;

    try {
        const data = await mg.messages.create(MAILGUN_DOMAIN, {
            from: `Book Project <${FROM_EMAIL}>`,
            to: [preferredName ? `${preferredName} <${toEmail}>` : toEmail],
            subject,
            html
        });
        logToFile("EMAIL_SENT", { to: toEmail, type: "password_reset_success", id: data.id });
        return true;
    } catch (error) {
        logToFile("EMAIL_SEND_ERROR", { to: toEmail, error: error.message }, "error");
        console.error("Error sending password reset success email:", error.message);
        return false;
    }
} // sendPasswordResetSuccessEmail

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail, sendPasswordResetSuccessEmail };
