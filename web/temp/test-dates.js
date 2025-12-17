(() => {
	const inputEl = document.getElementById("dateInput");
	const dayEl = document.getElementById("parsedDay");
	const monthEl = document.getElementById("parsedMonth");
	const yearEl = document.getElementById("parsedYear");
	const textEl = document.getElementById("parsedText");
	const debugEl = document.getElementById("debugJson");
	const reportBtn = document.getElementById("reportButton");
	const reportStatus = document.getElementById("reportStatus");
	const expectedEl = document.getElementById("expectedInput");
	const notesEl = document.getElementById("notesInput");
	const spinnerEl = document.getElementById("reportSpinner");

	const parser = window.partialDateParser;

	function renderParsed(parsed) {
		const safe = parsed || {};
		dayEl.textContent = safe.day ?? "—";
		monthEl.textContent = safe.month ?? "—";
		yearEl.textContent = safe.year ?? "—";
		textEl.textContent = safe.text || "—";
		debugEl.textContent = JSON.stringify(safe, null, 2);
	}

	function handleInput() {
		const value = inputEl.value;
		if (!value.trim()) {
			renderParsed({});
			return;
		}
		const parsed = parser.parsePartialDate(value);
		renderParsed(parsed);
	}

	async function sendReport() {
		reportStatus.textContent = "";
		const input = inputEl.value.trim();
		const expected = expectedEl.value.trim();
		if (!input || !expected) {
			reportStatus.textContent = "Please provide both the input and the expected result.";
			reportStatus.className = "text-danger";
			return;
		}

		const parsed = parser.parsePartialDate(input);
		const notes = notesEl.value.trim();
		reportBtn.disabled = true;
		spinnerEl.classList.remove("d-none");
		try {
			const response = await fetch("https://api.fjnel.co.za/temp/incorrect-date", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input, parsed, expected, notes })
			});
			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				throw new Error(payload.errors ? payload.errors.join(" ") : response.statusText);
			}
			reportStatus.textContent = "Thank you! Your report was saved.";
			reportStatus.className = "text-success";
			notesEl.value = "";
		} catch (err) {
			reportStatus.textContent = `Could not save report: ${err.message}`;
			reportStatus.className = "text-danger";
		} finally {
			reportBtn.disabled = false;
			spinnerEl.classList.add("d-none");
		}
	}

	inputEl.addEventListener("input", handleInput);
	reportBtn.addEventListener("click", sendReport);

	handleInput();
})();
