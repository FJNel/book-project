let messages = ["This is a backup message. Whoops!"];

async function loadMessages() {
    try {
        const response = await fetch('../data/404-messages.json');
        if (response.ok) {
            messages = await response.json();
        } else {
            console.error('[404] Failed to load messages:', response.status);
        }
    } catch (err) {
        console.error('[404] Error loading messages:', err);
    }
}

function setRandomMessage() {
  	const messageElement = document.getElementById("funnyMessage");
	if (messageElement) {
		const randomIndex = Math.floor(Math.random() * messages.length);
		messageElement.textContent = messages[randomIndex];
	}
}

function setupHomeButton() {
	const homeButton = document.getElementById("backHome");
	if (homeButton) {
		homeButton.addEventListener("click", () => {
		window.location.href = "https://bookproject.fjnel.co.za";
	});
	}
}

document.addEventListener("DOMContentLoaded", () => {
	setRandomMessage();
	setupHomeButton();
});
