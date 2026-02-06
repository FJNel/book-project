# API Keys on The Book Project

**Note:** API keys are an advanced feature intended for users who want to integrate The Book Project with other applications or automate certain tasks. If you're new to The Book Project, we recommend starting with the core setup and usage guides before exploring API keys. 

The Book Project provides API keys that allow you to access your library data programmatically. This can be useful for integrating with other applications, creating custom scripts, or automating certain tasks related to your library management. 

## What is an API Key?

If you do not know what an API or API key is, here is a brief explanation:
- An **API (Application Programming Interface)** is a set of rules and protocols that allows different software applications to communicate with each other. It defines how requests should be made, how data should be formatted, and what responses can be expected. The Book Project website communicates with the server using an API to perform actions like retrieving your library data, adding new books, or updating your account information.
- An ****API key** is a unique identifier that is used to authenticate requests made to an API. It acts as a secret token that allows you to access your library data securely. When you generate an API key, it is associated with your account and can be used to make authorized requests to the API on your behalf. 


## Why Use API Keys?

Using the API and API Keys is advanced and not necessary for most users, but it can be beneficial in certain scenarios:
- **Integration with other applications**: If you want to connect The Book Project with other software or services (like a custom dashboard, a mobile app, or a third-party library management tool), API keys allow you to securely access your library data from those applications. 
- **Automation**: If you want to automate certain tasks related to your library management (like regularly backing up your data, syncing with other services, or performing bulk updates), API keys enable you to create scripts or applications that can interact with The Book Project's API to perform those actions without manual intervention.
- **Custom development**: If you are a developer and want to build custom features or tools that work with The Book Project, API keys provide the necessary authentication to access your library data and perform actions programmatically.
- **Data access**: If you want to access your library data in a structured format (like JSON) for analysis, reporting, or other purposes, API keys allow you to retrieve that data securely through the API.
- **Security**: API keys provide a secure way to access your library data without sharing your account password. You can generate multiple API keys for different applications or purposes, and you can revoke them individually if needed.

## API Documentation

The API's endpoints, request formats, and response structures are documented using OpenAPI specifications. You can find the API documentation at the following URL: [api.fjnel.co.za/docs](https://api.fjnel.co.za/docs). This documentation provides detailed information on how to use the API, including available endpoints, required parameters, authentication methods, and example requests and responses. Since it is a Swagger UI, you can also interact with the API directly from the documentation interface to test different endpoints and see how they work once you enter your API key for authentication.

## How to Generate an API Key

To generate an API key for your account, follow these steps:
1. Log in to your Book Project account on the [login page](https://bookproject.fjnel.co.za/).
2. Once you're on your [dashboard](https://bookproject.fjnel.co.za/dashboard), click on the "Account" button in the navigation menu.
3. On the Account page, navigate to the "Danger zone" tab.
4. In the "Danger zone" section, you will see an "API Keys" subsection with a "Create API Key" button. Click on this button to generate a new API key for your account.
5. A confirmation dialog will appear, asking you to enter a name for your API key. This name is for your reference to identify the key later (e.g., "Documentation Key"). You must enter a name for the API key to proceed.
6. After entering a name, you can optionally set an expiration date for the API key. If you do not set an expiration date, the API key will remain valid indefinitely until you choose to revoke it.
7. Click the "Create" button in the dialog to generate the API key. After a few seconds, you should see a confirmation message indicating that the API key has been successfully created, along with the generated API key value. Make sure to copy and securely store the API key value, as it will not be shown again for security reasons.
8. Your new API key will now be listed in the "API Keys" section, where you can view its name, the first few characters of the key, creation date, expiration date (if set), when it was last used, and a way to revoke the key if needed.

## Revoking API Keys

If you no longer need an API key or if you suspect that it has been compromised, you can revoke it to prevent any further access using that key. To revoke an API key, follow these steps:
1. Go to the "API Keys" section in your account settings as described in the previous steps.
2. Find the API key you want to revoke in the list of API keys. Each key will have a "Revoke" button next to it.
3. Click the "Revoke" button for the API key you wish to disable. A confirmation dialog will appear asking you to confirm the revocation of the API key.
4. Confirm the revocation in the dialog. The API key will be immediately revoked and will no longer provide access to your library data. If you have any applications or scripts using that API key, they will stop working until you generate a new key and update the applications with the new key. 

If you have set an Expiration date for an API key, it will automatically become invalid after the specified date and time, so you do not need to manually revoke it in that case. However, if you want to revoke it before the expiration date, you can do so using the steps above.

## Security Considerations

When using API keys, it is important to keep the following security considerations in mind:
- **Keep your API keys secret**: Do not share your API keys with anyone or expose them in public repositories, client-side code, or any other insecure locations. Treat your API keys like passwords, as they provide access to your library data.
- **Use different API keys for different applications**: If you are using API keys for multiple applications or purposes, generate separate keys for each one. This allows you to manage and revoke access for specific applications without affecting others.
- **Set expiration dates**: If you do not need an API key to be valid indefinitely, set an expiration date when generating the key. This adds an extra layer of security by ensuring that the key will automatically become invalid after a certain period of time.
- **Revoke unused or compromised keys**: If you suspect that an API key has been compromised or if you no longer need a key, revoke it immediately from your account settings. This will prevent any unauthorized access using that key.

## Disclaimer and Terms of Use

The API and API keys are provided as-is without any warranties or guarantees. The Book Project may disable or remove access to the API or revoke API keys at any time for security reasons, abuse, or if the feature is no longer supported.

The Book Project provides no uptime or performance guarantees for the API, and it may experience downtime or performance issues without prior notice: See the [Terms of Use](/legal/terms-of-use) for more details.

The Book Project is not responsible for any misuse of API keys or unauthorized access resulting from compromised keys. It is the user's responsibility to manage their API keys securely and to follow best practices for API key usage.

The Book Project 's system administrator monitors API usage for security and abuse prevention. If you abuse the API or violate the terms of service, your API access may be revoked, and your account may be subject to review or suspension without prior notice. 

Contact the System Administrator at [support@fjnel.co.za](mailto:support@fjnel.co.za?subject=API%20Key%20Security%20Concern) if you have any questions or concerns about API key security or usage.

## Questions

### What is an API key used for in The Book Project?
An API key in The Book Project is used to authenticate requests made to the API, allowing you to access your library data programmatically. It enables you to integrate The Book Project with other applications, automate tasks, and retrieve your library data securely without sharing your account password.

### Do I need an API key to use the website?
No, you do not need an API key to use the website. API keys are only required for accessing the API programmatically. You can continue to use the website and all its features without an API key. API keys are intended for advanced users who want to integrate with other applications or automate tasks.

### Who should use API keys?
API keys are intended for users who want to integrate The Book Project with other applications, automate certain tasks, or access their library data programmatically. If you are a developer or have specific use cases that require programmatic access to your library data, API keys can be a useful tool. However, if you are just using the website for managing your library and do not have any need for programmatic access, you do not need to worry about API keys.

### Can I have multiple API keys?
Yes, you can generate multiple API keys for your account. This allows you to use different keys for different applications or purposes. Each API key can be managed individually, and you can revoke any key that you no longer need without affecting the others. We recommend using different API keys for different applications to enhance security and manage access more effectively.

### Are API keys tied to my account or to specific applications?
API keys are tied to your account, and only allow access to your library data. They are not tied to specific applications, but you can use different API keys for different applications or purposes. Each API key provides the same level of access to your library data, but you can manage and revoke them individually based on your needs. 

### Why do I need to give my API key a name when I create it?
Giving your API key a name when you create it helps you identify and manage your keys more easily. If you have multiple API keys, having descriptive names allows you to quickly determine which key is used for which application or purpose. This is especially important for security and maintenance, as it helps you keep track of your keys and revoke the correct one if needed. For example, if you have an API key named "Documentation Key", you will know that this key is used for accessing the API documentation, and if you need to revoke it, you can do so without affecting other keys that may be used for different applications.

### Can I rename my API keys after they are created?
No, once an API key is created, its name cannot be changed. If you want to change the name of an API key, you will need to revoke the existing key and create a new one with the desired name. This is a security measure to ensure that API keys are not modified after creation, which could lead to confusion or misuse. Always choose a descriptive name for your API keys at the time of creation to avoid the need for renaming later on.

### Can I change or set an expiration date for an API key after it has been created?
No, once an API key is created, its expiration date cannot be changed or set. If you want to change the expiration date of an API key, you will need to revoke the existing key and create a new one with the desired expiration date. This is a security measure to ensure that API keys are not modified after creation, which could lead to confusion or misuse. Always set an appropriate expiration date for your API keys at the time of creation to avoid the need for changing it later on.

### How do I revoke an API key if I no longer need it or if I suspect it has been compromised?
If you no longer need an API key or if you suspect that it has been compromised, you can revoke it to prevent any further access using that key. To revoke an API key, follow the steps outlined in the "Revoking API Keys" section of this guide. This involvesgoing to the "API Keys" section in your account settings, finding the API key you want to revoke, and clicking the "Revoke" button next to it. Confirm the revocation in the dialog that appears, and the API key will be immediately revoked, preventing any unauthorized access to your library data using that key.

### I didn't copy my API key when it was generated, and now I can't access it. What should I do?
If you did not copy your API key when it was generated, you will not be able to access the full key again for security reasons. In this case, you will need to revoke the existing API key and create a new one. To do this, follow the steps in this guide to generate a new API key, and make sure to copy and securely store the new key value when it is generated.

### Why is the full API key only shown once when it is generated?
The full API key is only shown once when it is generated for security reasons. This is to prevent unauthorized access to your library data in case someone else gains access to your account or the API key management page. By only showing the full API key once, it reduces the risk of the key being exposed or copied by someone who should not have access to it. If you lose the API key, you can always revoke it and generate a new one, but you will not be able to retrieve the same key again. This is a common security practice for API keys and other sensitive tokens.

### What should I do if I lose my API key?
If you lose your API key, you will not be able to retrieve it again for security reasons. In this case, you should revoke the lost API key immediately to prevent any unauthorized access to your library data. After revoking the lost key, you can generate a new API key by following the steps in this guide. Make sure to copy and securely store the new API key value when it is generated, as it will not be shown again.

### Are API keys generated in a way that makes them difficult to guess or brute-force?
Yes, API keys are generated using a secure random algorithm that produces a long and complex string of characters. This makes them difficult to guess or brute-force, providing a high level of security for accessing your library data through the API. This algorithm is designed to create unique API keys that are resistant to common attack methods. However, it is still important to keep your API keys secret and not share them with anyone, as they provide access to your library data.

### Can I use API keys to access other users' library data?
No, API keys are tied to your account and only allow access to your own library data. You cannot use API keys to access other users' library data, as each user's data is protected and isolated from others. API keys provide a secure way for you to access your own data programmatically, but they do not grant access to any other user's data. Each user must generate their own API keys to access their own library data through the API. 

If another user shares their API key with you, you will be able to access their library data through the API using that key, but this is not recommended for security reasons. It is best to keep API keys private and only use them for your own account to ensure the security of your library data. If you need to share data with another user, consider using other methods that do not involve sharing API keys, such as exporting and importing data or using shared features within the application. 

### Can administrators see my full API key value?
No, administrators cannot see your full API key value. For security reasons, the full API key is only shown to you once when it is generated, and it is not stored in a way that allows anyone, including administrators, to view the full key again. Administrators can see the name of the API key, when it was created, when it was last used, and other metadata, but they cannot access the full key value itself. This is a common security practice to protect API keys from unauthorized access.

### Can administrators manage and revoke my API keys?
Yes, administrators have the ability to manage and revoke API keys for security and abuse prevention purposes. If an administrator detects suspicious activity or misuse of an API key, they may choose to revoke that key to prevent further unauthorized access to your library data. However, administrators cannot view the full API key value, so they cannot use it themselves; they can only revoke it if necessary. If your API key is revoked by an administrator, you will need to generate a new API key if you want to continue using the API.

If you abuse or misuse the API, such as by making excessive requests, sharing your API key with others, or using it in a way that violates the terms of service, your API access may be revoked by the System Administrator without prior notice. The System Administrator can also prevent you from generating new API keys if you have a history of abuse or misuse. It is important to use API keys responsibly and follow the terms of service to avoid any issues with your API access.

### Does an API key have the same permissions as my account password?
Yes, an API key provides the same level of access to your library data as your account password. It allows you to perform actions and retrieve data through the API just as you would when using the website. However, API keys are intended for programmatic access and should be kept secure, while your account password is used for logging into the website. It is important to keep both your API keys and your account password secure to protect your library data. If you suspect that your API key has been compromised, you should revoke it immediately and generate a new one.

### How do I use my API key with the API documentation (Swagger UI)?
To use your API key with the API documentation (Swagger UI), follow these steps:
1. Go to the API documentation at [api.fjnel.co.za/docs](https://api.fjnel.co.za/docs).
2. In the top right corner of the documentation page, you will see an "Authorize" button. Click on this button to open the authorization dialog.
3. Enter your APU key in either the "apiKeyHeader" or "apiKeyAuthHeader" field and click the "Authorize" button in the dialog to authenticate your API key. Once authorized, you will be able to make authenticated requests to the API directly from the documentation interface. 

### Will I be notified before my API key expires if I set an expiration date?
Yes, if you set an expiration date for your API key, you will receive a notification email to your registered email address a few days before the key is set to expire. This notification serves as a reminder to renew or replace the API key if you still need access to the API after the expiration date. If you do not take any action before the expiration date, the API key will automatically become invalid and will no longer provide access to your library data through the API.

> **Note:** If your email preferences are set to not receive "Account updates" emails, you may not receive the expiration notification. We recommend keeping "Account updates" emails enabled to ensure you receive important notifications about your API keys and other account-related information. You can manage your email preferences in the "Email preferences" section of your account settings. For more information, see the [Changing Email Preferences guide](/guides/account/changing-email-preferences).

### Will I be notified when my API key is expired or revoked?
Yes, if your API key is expired or revoked, you will receive a notification email to your registered email address informing you of the change in status of your API key. This notification serves as an alert that your API key is no longer valid and that you will need to generate a new key if you want to continue using the API. If you do not receive this notification, please check your email preferences to ensure that you are set to receive "Account updates" emails, as these notifications are sent under that category. You can manage your email preferences in the "Email preferences" section of your account settings. For more information, see the [Changing Email Preferences guide](/guides/account/changing-email-preferences).

### Will I be notified if an administrator revokes my API key?
Yes, if an administrator revokes your API key, you will receive a notification email to your registered email address informing you that your API key has been revoked. This notification serves as an alert that your API key is no longer valid and that you will need to generate a new key if you want to continue using the API. If you do not receive this notification, please check your email preferences to ensure that you are set to receive "Account updates" emails, as these notifications are sent under that category. You can manage your email preferences in the "Email preferences" section of your account settings. For more information, see the [Changing Email Preferences guide](/guides/account/changing-email-preferences).

### Will I be notified if I abuse the API and my access is revoked by the System Administrator?
Yes, if you abuse the API and your access is revoked by the System Administrator, you will receive a notification email to your registered email address informing you that your API access has been revoked due to abuse. This notification serves as an alert that your API key is no longer valid and that you will need to generate a new key if you want to continue using the API, provided that your account is still in good standing. If you do not receive this notification, please check your email preferences to ensure that you are set to receive "Account updates" emails, as these notifications are sent under that category. You can manage your email preferences in the "Email preferences" section of your account settings. For more information, see the [Changing Email Preferences guide](/guides/account/changing-email-preferences).

### Can someone access my account using only my API key?
Yes! While they cannot log in to the website using your API key, they can use it to access your library data through the API. This is why it is crucial to keep your API keys secure and not share them with anyone. If someone else gains access to your API key, they can retrieve your library data and perform actions through the API as if they were you. If you suspect that your API key has been compromised, you should revoke it immediately and generate a new one to protect your library data from unauthorized access.

### Are there rate limits when using API keys?
Yes. The Book Project has a global per-user rate limit for API requests to prevent abuse and ensure fair usage of the API. If you exceed the rate limit, you will receive a response indicating that you have made too many requests, and you will need to wait before making additional requests. 

> **Note:** Most endpoints use a *shared* rate limit which uses your account's overall API usage to determine if you have exceeded the limit. However, some endpoints may have their own *dedicated* rate limits that are separate from the shared limit. If you exceed a dedicated rate limit for a specific endpoint, you will receive a response indicating that you have made too many requests to that endpoint, even if you have not exceeded the shared rate limit. The API documentation will indicate if an endpoint has a dedicated rate limit. If you frequently hit rate limits while using the API, you may want to review your usage patterns and optimize your requests to stay within the limits. 

### How is my API usage monitored?
When you make a request to our API, the API logs the request and adds whether the request was made by the Book Project website or using an API key, the endpoint that was accessed, the time of the request, and the API key used (if applicable). The API provides a usage score for "Website" and "API keys" usage to the System Administrator, which is used to monitor overall API usage and detect any potential abuse or misuse. If the API detects abnormally high usage, the System Administrator is informed and may choose to investigate the activity and take appropriate action, such as revoking API keys or restricting access if abuse is detected.

### Does API abuse affect my account in other ways besides revoking API access?
This depends on the severity and nature of the abuse. If you abuse the API, your API key may be revoked by the System Administrator without prior notice. In cases of severe or repeated abuse, the System Administrator may also choose to restrict your account's ability to generate new API keys or take other actions to prevent further abuse. However, unless your account is found to be in violation of the terms of service in other ways, you should still be able to log in to the website and use it as normal, even if your API access is revoked. It is important to use API keys responsibly and follow the terms of service to avoid any issues with your account or API access.

In extreme cases, you may be subject to account suspension and blacklisting if you engage in severe abuse or violate the terms of service in a way that warrants such action. This would prevent you from logging in to the website and using any features of The Book Project, not just the API. However, this is a last resort measure and would only be taken in cases of significant abuse or violation of the terms of service. Always use API keys responsibly and adhere to the terms of service to avoid any issues with your account or API access.

### Who can I contact if I have questions or concerns about API keys or API usage?
If you have any questions or concerns about API keys or API usage, you can contact the System Administrator at [support@fjnel.co.za](mailto:support@fjnel.co.za?subject=API%20Key%20Question%20or%20Concern). The System Administrator can provide assistance with API key management, answer questions about API usage, and address any concerns you may have regarding the security or functionality of the API. If you are experiencing issues with your API keys or have questions about how to use the API effectively, do not hesitate to reach out for support.

---

## What's Next?

...