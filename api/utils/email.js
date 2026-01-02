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
const API_BASE_URL = config.api.baseUrl;

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
			  We received a request to set or reset your password for the <strong>Book Project</strong>.<br>
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
			  System Administrator at <a href="mailto:${supportEmail}?subject=The%20Book%20Project%20Account%20Reactivation%20Request" style="color: #3182ce;">${supportEmail}</a>. Provide them with your email address and request account reactivation.
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

async function sendAccountDisableVerificationEmail(toEmail, preferredName, token, expiresIn = 60) {
	if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL || !API_BASE_URL) {
		logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
		console.error("Email service is not configured. Please check environment variables.");
		return false;
	}

	const verifyUrl = `${API_BASE_URL}/users/me/verify-delete?token=${token}`;
	const subject = "Confirm your Book Project account disable request";
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
	        <h2 style="color: #2d3748; margin-bottom: 16px;">Hi${preferredName ? `, ${preferredName}` : ""}.</h2>
	        <p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
	          We received a request to <strong>disable your Book Project account</strong>. Your data
	          will remain stored, but you will no longer be able to log in or use any features.
	        </p>
	        <p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
	          To confirm, click the button below. If you change your mind later, or if you did not make this request,
			  please reach out to our system administrator at
			  <a href="mailto:${SUPPORT_EMAIL}?subject=The%20Book%20Project%20Account%20Disable%20Assistance" style="color: #3182ce;">${SUPPORT_EMAIL}</a>
			  so we can assist or reactivate your account.
	        </p>
	        <div style="text-align: center; margin: 32px 0;">
	          <a href="${verifyUrl}" style="background-color: #e53e3e; color: #ffffff;
	            text-decoration: none; padding: 14px 28px; border-radius: 6px;
	            font-weight: bold; display: inline-block;">
	            Confirm Disable
	          </a>
	        </div>
	        <p style="font-size: 14px; color: #718096; line-height: 1.5;">
	          This link will expire in <strong>${expiresIn} minutes</strong>. If it expires, simply sign in and submit another request.
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

		logToFile("EMAIL_SENT", { to: toEmail, type: "account_disable_verification", id: data.id });
		return true;
	} catch (error) {
		logToFile("EMAIL_SEND_ERROR", { to: toEmail, error: error.message }, "error");
		console.error("Error sending account disable verification email:", error.message);
		return false;
	}
} // sendAccountDisableVerificationEmail

async function sendAccountDeletionVerificationEmail(toEmail, preferredName, token, expiresIn = 60) {
	if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL || !API_BASE_URL) {
		logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
		console.error("Email service is not configured. Please check environment variables.");
		return false;
	}

	const verifyUrl = `${API_BASE_URL}/users/me/verify-account-deletion?token=${token}`;
	const subject = "Confirm your Book Project account deletion request";
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
	        <h2 style="color: #2d3748; margin-bottom: 16px;">Final confirmation required</h2>
	        <p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
	          You asked us to permanently delete your Book Project account and all associated data.
	          Our administrators will only proceed once you confirm this request. If this wasn’t you, email
			  <a href="mailto:${SUPPORT_EMAIL}?subject=The%20Book%20Project%20Unauthorised%20Account%20Deletion%20Request" style="color: #3182ce;">${SUPPORT_EMAIL}</a>
			  immediately to ensure that your account remains secure and intact.
	        </p>
	        <div style="text-align: center; margin: 32px 0;">
	          <a href="${verifyUrl}" style="background-color: #dd6b20; color: #ffffff;
	            text-decoration: none; padding: 14px 28px; border-radius: 6px;
	            font-weight: bold; display: inline-block;">
	            Confirm Deletion Request
	          </a>
	        </div>
	        <p style="font-size: 14px; color: #718096; line-height: 1.5;">
	          Once confirmed, our support team will contact you to complete the deletion process.
	          This link expires in <strong>${expiresIn} minutes</strong>.
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

		logToFile("EMAIL_SENT", { to: toEmail, type: "account_delete_verification", id: data.id });
		return true;
	} catch (error) {
		logToFile("EMAIL_SEND_ERROR", { to: toEmail, error: error.message }, "error");
		console.error("Error sending account deletion verification email:", error.message);
		return false;
	}
} // sendAccountDeletionVerificationEmail

async function sendAccountDeletionAdminEmail({
	userEmail,
	userFullName,
	userPreferredName,
	userId,
	requestedAt,
	requestIp
}) {
	if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL || !SUPPORT_EMAIL) {
		logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
		console.error("Email service is not configured. Please check environment variables.");
		return false;
	}

	const subject = `Account deletion confirmation received for ${userEmail}`;
	const year = new Date().getFullYear();

	const html = `
	<div style="background-color: #f4f6f8; padding: 40px 0; font-family: Arial, sans-serif;">
	  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%"
	    style="max-width: 600px; background: #ffffff; border-radius: 8px;
	    box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
	    <tr>
	      <td style="padding: 24px 32px; color: #333;">
	        <h2 style="color: #2d3748; margin-bottom: 16px;">Account deletion request confirmed</h2>
	        <p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
	          A user confirmed that they would like their Book Project account to be deleted permanently.
	          Please reach out to verify their request before completing the deletion process.
	        </p>
	        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; font-size: 15px; color: #4a5568;">
	          <tr>
	            <td style="padding: 6px 0; width: 40%;"><strong>User ID</strong></td>
	            <td>${userId}</td>
	          </tr>
	          <tr>
	            <td style="padding: 6px 0;"><strong>Email</strong></td>
	            <td>${userEmail}</td>
	          </tr>
	          <tr>
	            <td style="padding: 6px 0;"><strong>Full Name</strong></td>
	            <td>${userFullName || "N/A"}</td>
	          </tr>
	          <tr>
	            <td style="padding: 6px 0;"><strong>Preferred Name</strong></td>
	            <td>${userPreferredName || "N/A"}</td>
	          </tr>
	          <tr>
	            <td style="padding: 6px 0;"><strong>Confirmed At</strong></td>
	            <td>${requestedAt || new Date().toISOString()}</td>
	          </tr>
	          ${requestIp ? `<tr><td style="padding: 6px 0;"><strong>Requester IP</strong></td><td>${requestIp}</td></tr>` : ""}
	        </table>
	        <p style="font-size: 14px; color: #718096;">
	          Please reach out to the user before fully deleting this account and all associated data. Use the appropriate admin endpoint to complete the deletion.
	        </p>
	        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
	        <p style="font-size: 12px; color: #a0aec0; text-align: center;">
	          &copy; ${year} Book Project. Internal notification.
	        </p>
	      </td>
	    </tr>
	  </table>
	</div>
	`;

	try {
		const data = await mg.messages.create(MAILGUN_DOMAIN, {
			from: `Book Project <${FROM_EMAIL}>`,
			to: [SUPPORT_EMAIL],
			subject,
			html
		});

		logToFile("EMAIL_SENT", { to: SUPPORT_EMAIL, type: "account_delete_admin_notice", id: data.id });
		return true;
	} catch (error) {
		logToFile("EMAIL_SEND_ERROR", { to: SUPPORT_EMAIL, error: error.message }, "error");
		console.error("Error sending account deletion admin email:", error.message);
		return false;
	}
} // sendAccountDeletionAdminEmail

async function sendEmailChangeVerificationEmail(toEmail, preferredName, token, expiresIn = 60) {
	if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL || !API_BASE_URL) {
		logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
		console.error("Email service is not configured. Please check environment variables.");
		return false;
	}

	const verifyUrl = `${API_BASE_URL}/users/me/verify-email-change?token=${token}`;
	const subject = "Verify your new Book Project email address";
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
	        <h2 style="color: #2d3748; margin-bottom: 16px;">Confirm your new email${preferredName ? `, ${preferredName}` : ""}</h2>
	        <p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
	          We received a request to update the email address linked to your Book Project account.
	          Click the button below to finish verifying this new email. If you did not request the change, contact
			  <a href="mailto:${SUPPORT_EMAIL}?subject=The%20Book%20Project%20Unauthorised%20Email%20Change" style="color: #3182ce;">${SUPPORT_EMAIL}</a>
			  so we can secure your account. Once your new email is verified, you will be logged out of all sessions and will need to log in again using the new email address. 
	        </p>
	        <div style="text-align: center; margin: 32px 0;">
	          <a href="${verifyUrl}" style="background-color: #3182ce; color: #ffffff;
	            text-decoration: none; padding: 14px 28px; border-radius: 6px;
	            font-weight: bold; display: inline-block;">
	            Verify New Email
	          </a>
	        </div>
	        <p style="font-size: 14px; color: #718096; line-height: 1.5;">
	          This link expires in <strong>${expiresIn} minutes</strong>. If you did not request this change, you can ignore this email.
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

		logToFile("EMAIL_SENT", { to: toEmail, type: "email_change_verification", id: data.id });
		return true;
	} catch (error) {
		logToFile("EMAIL_SEND_ERROR", { to: toEmail, error: error.message }, "error");
		console.error("Error sending email change verification email:", error.message);
		return false;
	}
} // sendEmailChangeVerificationEmail

async function sendEmailChangeConfirmationEmail(toEmail, newEmail, preferredName) {
	if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL) {
		logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
		console.error("Email service is not configured. Please check environment variables.");
		return false;
	}

	const subject = "Your Book Project email address has changed";
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
	        <h2 style="color: #2d3748; margin-bottom: 16px;">Email updated${preferredName ? `, ${preferredName}` : ""}</h2>
	        <p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
	          This is a confirmation that your Book Project account email has been updated to <strong>${newEmail}</strong>.
	        </p>
	        <p style="font-size: 14px; color: #718096; line-height: 1.5;">
	          If you did not authorise this change, please contact our support team immediately at
	          <a href="mailto:${SUPPORT_EMAIL}?subject=The%20Book%20Project%20Email%20Change%20Unauthorised" style="color: #3182ce;">${SUPPORT_EMAIL}</a> so that we can help secure your account.
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
			to: [toEmail],
			subject,
			html
		});

		logToFile("EMAIL_SENT", { to: toEmail, type: "email_change_confirmation", id: data.id });
		return true;
	} catch (error) {
		logToFile("EMAIL_SEND_ERROR", { to: toEmail, error: error.message }, "error");
		console.error("Error sending email change confirmation email:", error.message);
		return false;
	}
} // sendEmailChangeConfirmationEmail

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

async function sendAdminProfileUpdateEmail(toEmail, preferredName, changes = []) {
	if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL) {
		logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
		console.error("Email service is not configured. Please check environment variables.");
		return false;
	}

	const subject = "Your Book Project profile was updated";
	const year = new Date().getFullYear();
	const changeItems = Array.isArray(changes) && changes.length > 0
		? `<ul style="font-size: 15px; color: #4a5568; line-height: 1.5; padding-left: 20px;">
			${changes.map((item) => `<li>${item}</li>`).join("")}
		  </ul>`
		: "<p style=\"font-size: 15px; color: #4a5568; line-height: 1.5;\">Your account details were updated.</p>";

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
	        <h2 style="color: #2d3748; margin-bottom: 16px;">Account update notice${preferredName ? `, ${preferredName}` : ""}</h2>
	        <p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
	          An administrator updated details on your Book Project account.
	        </p>
	        ${changeItems}
	        <p style="font-size: 14px; color: #718096; line-height: 1.5;">
	          If you did not expect this change, please contact the system administrator at
	          <a href="mailto:${SUPPORT_EMAIL}?subject=The%20Book%20Project%20Account%20Update%20Inquiry" style="color: #3182ce;">${SUPPORT_EMAIL}</a>.
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
		logToFile("EMAIL_SENT", { to: toEmail, type: "admin_profile_update", id: data.id });
		return true;
	} catch (error) {
		logToFile("EMAIL_SEND_ERROR", { to: toEmail, error: error.message }, "error");
		console.error("Error sending admin profile update email:", error.message);
		return false;
	}
} // sendAdminProfileUpdateEmail

async function sendAdminAccountDisabledEmail(toEmail, preferredName) {
	if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL) {
		logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
		console.error("Email service is not configured. Please check environment variables.");
		return false;
	}

	const subject = "Your Book Project account has been disabled";
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
	        <h2 style="color: #2d3748; margin-bottom: 16px;">Account disabled${preferredName ? `, ${preferredName}` : ""}</h2>
	        <p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
	          An administrator has disabled your Book Project account. You can no longer sign in or use the service.
	        </p>
	        <p style="font-size: 14px; color: #718096; line-height: 1.5;">
	          If you believe this was a mistake, please contact the system administrator at
	          <a href="mailto:${SUPPORT_EMAIL}?subject=The%20Book%20Project%20Account%20Disable%20Review" style="color: #3182ce;">${SUPPORT_EMAIL}</a>.
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
		logToFile("EMAIL_SENT", { to: toEmail, type: "admin_account_disabled", id: data.id });
		return true;
	} catch (error) {
		logToFile("EMAIL_SEND_ERROR", { to: toEmail, error: error.message }, "error");
		console.error("Error sending admin account disabled email:", error.message);
		return false;
	}
} // sendAdminAccountDisabledEmail

async function sendAdminAccountEnabledEmail(toEmail, preferredName) {
	if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL) {
		logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
		console.error("Email service is not configured. Please check environment variables.");
		return false;
	}

	const loginUrl = config.frontend.loginUrl;
	const subject = "Your Book Project account has been re-enabled";
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
	        <h2 style="color: #2d3748; margin-bottom: 16px;">Account re-enabled${preferredName ? `, ${preferredName}` : ""}</h2>
	        <p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
	          An administrator has re-enabled your Book Project account. You can now sign in again.
	        </p>
	        <div style="text-align: center; margin: 32px 0;">
	          <a href="${loginUrl}" style="background-color: #3182ce; color: #ffffff;
	            text-decoration: none; padding: 14px 28px; border-radius: 6px;
	            font-weight: bold; display: inline-block;">
	            Log In
	          </a>
	        </div>
	        <p style="font-size: 14px; color: #718096; line-height: 1.5;">
	          If you did not request this change, please contact the system administrator at
	          <a href="mailto:${SUPPORT_EMAIL}?subject=The%20Book%20Project%20Account%20Enable%20Review" style="color: #3182ce;">${SUPPORT_EMAIL}</a>.
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
		logToFile("EMAIL_SENT", { to: toEmail, type: "admin_account_enabled", id: data.id });
		return true;
	} catch (error) {
		logToFile("EMAIL_SEND_ERROR", { to: toEmail, error: error.message }, "error");
		console.error("Error sending admin account enabled email:", error.message);
		return false;
	}
} // sendAdminAccountEnabledEmail

async function sendAdminEmailUnverifiedEmail(toEmail, preferredName, reason) {
	if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL) {
		logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
		console.error("Email service is not configured. Please check environment variables.");
		return false;
	}

	const subject = "Your Book Project email needs verification";
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
	        <h2 style="color: #2d3748; margin-bottom: 16px;">Email unverified${preferredName ? `, ${preferredName}` : ""}</h2>
	        <p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
	          An administrator marked your Book Project email address as unverified.
	        </p>
	        <p style="font-size: 15px; color: #4a5568; line-height: 1.5;"><strong>Reason:</strong> ${reason}</p>
	        <p style="font-size: 14px; color: #718096; line-height: 1.5;">
	          Please request a new verification email or contact the system administrator if you need assistance.
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
		logToFile("EMAIL_SENT", { to: toEmail, type: "admin_email_unverified", id: data.id });
		return true;
	} catch (error) {
		logToFile("EMAIL_SEND_ERROR", { to: toEmail, error: error.message }, "error");
		console.error("Error sending admin email unverified email:", error.message);
		return false;
	}
} // sendAdminEmailUnverifiedEmail

async function sendAdminEmailVerifiedEmail(toEmail, preferredName, reason) {
	if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !FROM_EMAIL) {
		logToFile("EMAIL_SERVICE_MISCONFIGURED", { message: "Email service environment variables are not set." }, "error");
		console.error("Email service is not configured. Please check environment variables.");
		return false;
	}

	const subject = "Your Book Project email has been verified";
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
	        <h2 style="color: #2d3748; margin-bottom: 16px;">Email verified${preferredName ? `, ${preferredName}` : ""}</h2>
	        <p style="font-size: 16px; color: #4a5568; line-height: 1.5;">
	          An administrator verified your Book Project email address.
	        </p>
	        <p style="font-size: 15px; color: #4a5568; line-height: 1.5;"><strong>Reason:</strong> ${reason}</p>
	        <p style="font-size: 14px; color: #718096; line-height: 1.5;">
	          If you did not expect this change, please contact the system administrator at
	          <a href="mailto:${SUPPORT_EMAIL}?subject=The%20Book%20Project%20Email%20Verification%20Review" style="color: #3182ce;">${SUPPORT_EMAIL}</a>.
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
		logToFile("EMAIL_SENT", { to: toEmail, type: "admin_email_verified", id: data.id });
		return true;
	} catch (error) {
		logToFile("EMAIL_SEND_ERROR", { to: toEmail, error: error.message }, "error");
		console.error("Error sending admin email verified email:", error.message);
		return false;
	}
} // sendAdminEmailVerifiedEmail

module.exports = {
	sendVerificationEmail,
	sendPasswordResetEmail,
	sendWelcomeEmail,
	sendPasswordResetSuccessEmail,
	sendAccountDisableVerificationEmail,
	sendAccountDisableConfirmationEmail,
	sendAccountDeletionVerificationEmail,
	sendAccountDeletionAdminEmail,
	sendEmailChangeVerificationEmail,
	sendEmailChangeConfirmationEmail,
	sendAdminProfileUpdateEmail,
	sendAdminAccountDisabledEmail,
	sendAdminAccountEnabledEmail,
	sendAdminEmailUnverifiedEmail,
	sendAdminEmailVerifiedEmail
};
