const messages = [
	"Looks like the bookworm got to this page first.",
	"Plot twist! This page doesn't exist.",
	"This page is still in the 'notes and scribbles' phase.",
	"Sorry, this page has been checked out indefinitely.",
	"A librarian must've misplaced this one.",
	"The Dewey Decimal System has no classification for what you're looking for.",
	"Oops! You've wandered into the footnotes.",
	"You must have nodded off and lost your place.",
	"Someone spilled coffee on this part of the manuscript. It's illegible now.",
	"This appears to be an errata slip for a page that doesn't exist.",
	"The unreliable narrator led you astray.",
	"This page fell through a plot hole.",
	"This character was written out of the story. So was their entire chapter.",
	"This plotline was abandoned. Let's just pretend it never happened.",
	"Someone must have misshelved this page. We'll send a clerk to find it.",
	"The author is still procrastinating on writing this part.",
	"The case of the missing page... still unsolved.",
	"Congratulations! You've found the secret hidden page... just kidding, it doesn't exist.",
	"You used a receipt as a bookmark, didn't you? It must have fallen out.",
	"This appears to be from the author's secret, unpublished diary.",
	"You've stumbled into an appendix that was never written.",
	"Careful! You've entered a forbidden section of the library.",
	"This chapter is still stuck in the author's typewriter ribbon.",
	"This scene was cut during the first draft edits.",
	"The plot armor couldn't save this page.",
	"You've opened a locked grimoire - the page is blank.",
	"Sorry, the ink ran dry before this page was finished.",
	"This story thread unraveled and was never rewoven.",
	"The publisher lost this page between the proofs.",
	"This page has been reserved for a sequel that never happened.",
	"The marginalia ate the text and ran away.",
	"The bookbinder skipped a signature - this page got left behind.",
	"You peeked behind the curtain - and there was no page there.",
	"This page self-destructed to avoid spoilers.",
	"You've unlocked a secret level... but it's just an empty shelf.",
	"The archivist filed this one under 'M' for Missing.",
	"This footnote led nowhere. Literally.",
	"This is what happens when the narrator goes unreliable.",
	"The publisher replaced this with lorem ipsum by accident.",
	"Looks like you hit a cliffhanger that never got resolved.",
	"This entry was left as 'TBD' in the author's notes.",
	"You've gone beyond the index - there's nothing here.",
	"This page ghosted the rest of the story.",
	"This story arc was retconned out of existence.",
	"Congratulations! You've discovered a plot hole in the database.",
	"This page is reserved for acknowledgments that never came.",
	"The index lists this page... but it lies.",
	"This passage was censored by the Ministry of Stories.",
	"You turned the page, but the author never caught up.",
	"Oh, look! An uncharted page in the narrative wilderness.",
	"Oops! You've wandered into the author's daydreams.",
	"Uhm, you aren't supposed to be here.",
	"If you're looking for something, try the homepage.",
	"If you've found this page, it's probably not what you were looking for.",
	"Well, this is awkward. There's nothing here.",
	"Ooo! An empty page! How mysterious.",
	"This page must never have been written.",
	"The printer must have skipped this one. Oops!",
	"Once upon a time, this page existed. Now it doesn't.",
	"Hello? This is a blank page. There's nothing to see here. Or actually, now that you've read this, there is. But it's still not what you were looking for.",
	"This page is currently under construction. Oh I mean, this page has vanished into thin air.",
	"This page is like a ghost - you can see it, but there's nothing there.",
	"This page is like a unicorn - rumored to exist, but never actually seen.",
	"This page is like a mirage - it looks real, but it's just an illusion.",
	"This page is like a secret passage - you know it's there, but you can't find it.",
	"This page is like Harry Potter's invisibility cloak - it's there, but you can't see it.",
	"This page is like a riddle wrapped in a mystery inside an enigma - good luck figuring it out.",
	"This page is like a wild goose chase - you keep looking, but you never find what you're after.",
	"In Lord of the Rings, this page would be called 'The One That Got Away'.",
	"In Mistborn, this page would've been like a kandra - it can take any form, but it's still not what you want.",
	"I've ran out of ideas for funny 404 messages. Please help me think of more.",
	"Good day! Is it a good day? It's a good day for this 404 page.",
	"Did you know? The first 404 error was recorded in 1992.",
	"Fun fact: 404 errors are more common than typos in Harry Potter fan fiction. (Source: Totally made up statistic.)",
	"Did you hear about the 404 page that went to therapy? It had too many unresolved issues.",
];

function setRandomMessage() {
  	const messageElement = document.getElementById("funny-message");
	if (messageElement) {
		const randomIndex = Math.floor(Math.random() * messages.length);
		messageElement.textContent = messages[randomIndex];
	}
}

function setupHomeButton() {
	const homeButton = document.getElementById("backHome");
	if (homeButton) {
		homeButton.addEventListener("click", () => {
		window.location.href = "https://fjnel.co.za";
	});
	}
}

document.addEventListener("DOMContentLoaded", () => {
	setRandomMessage();
	setupHomeButton();
});
