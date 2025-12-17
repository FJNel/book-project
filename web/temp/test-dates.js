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
	const bulkInput = document.getElementById("bulkInput");
	const bulkOutput = document.getElementById("bulkOutput");
	const bulkButton = document.getElementById("bulkParseButton");
	const fillTestButton = document.getElementById("fillTestDataButton");
	const bulkSummary = document.getElementById("bulkSummary");

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
			console.info("[Parser Demo] Input cleared.");
			return;
		}
		const parsed = parser.parsePartialDate(value);
		renderParsed(parsed);
		console.info("[Parser Demo] Parsed input", { input: value, parsed });
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
			console.info("[Parser Demo] Report saved", { input, expected, parsed, notes });
		} catch (err) {
			reportStatus.textContent = `Could not save report: ${err.message}`;
			reportStatus.className = "text-danger";
			console.error("[Parser Demo] Report failed", err);
		} finally {
			reportBtn.disabled = false;
			spinnerEl.classList.add("d-none");
		}
	}

	inputEl.addEventListener("input", handleInput);
	reportBtn.addEventListener("click", sendReport);
	bulkButton.addEventListener("click", () => {
		const lines = (bulkInput.value || "").split(/\r?\n/).filter((line) => line.trim().length > 0);
		const results = [];
		lines.forEach((line) => {
			const parsed = parser.parsePartialDate(line.trim());
			results.push(parsed.text || "");
		});
		bulkOutput.value = results.join("\n");
		bulkSummary.textContent = `Parsed ${results.length} entr${results.length === 1 ? "y" : "ies"}.`;
		console.info("[Parser Demo] Bulk parsed", { count: results.length, inputs: lines, outputs: results });
	});

	const SAMPLE_TESTS = [
		"23 November 2005",
		"23 Nov 2005",
		"23 Nov. 2005",
		"23 NOV 2005",
		"23 november 2005",
		"23 Nove 2005",
		"23 Novem 2005",
		"23 Novembe 2005",
		"Nov 23 2005",
		"Nov 23, 2005",
		"November 23rd 2005",
		"November 23 2005",
		"November 23, 2005",
		"23rd of November 2005",
		"23rd November 2005",
		"23 November, 2005",
		"Wednesday, 23 November 2005",
		"Wednesday 23 November 2005",
		"2005 Nov 23",
		"2005 November 23",
		"2005 11 23",
		"2005/11/23",
		"2005-11-23",
		"2005.11.23",
		"23 2005 Nov",
		"23-2005-Nov",
		"23/11/2005",
		"23-11-2005",
		"23 11 2005",
		"23.11.2005",
		"23/11/05",
		"23-11-05",
		"23.11.05",
		"23112005",
		"11232005",
		"20051123",
		"11/23/2005",
		"11-23-2005",
		"11 23 2005",
		"11.23.2005",
		"11/23/05",
		"11-23-05",
		"11.23.05",
		"11/10/2005",
		"11-10-2005",
		"11 10 2005",
		"11.10.2005",
		"11/10/05",
		"11-10-05",
		"11.10.05",
		"10/13/2005",
		"10-13-2005",
		"10 13 2005",
		"10.13.2005",
		"10/13/05",
		"10-13-05",
		"10.13.05",
		"23 November",
		"23 Nov",
		"23 Nov.",
		"Nov 23",
		"Nov 23rd",
		"November 23",
		"November 23rd",
		"23rd November",
		"23rd of November",
		"23/11",
		"23-11",
		"23.11",
		"23 11",
		"11/23",
		"11-23",
		"11.23",
		"11 23",
		"11 10",
		"11/10",
		"11-10",
		"11.10",
		"November",
		"Nov",
		"Nov.",
		"11",
		"October",
		"Oct",
		"Oct.",
		"10",
		"December",
		"Dec",
		"Dec.",
		"12",
		"2025-11",
		"2025/11",
		"2025.11",
		"11/2025",
		"11-2025",
		"11.2025",
		"Nov 2005",
		"November 2005",
		"2005 Nov",
		"2005 November",
		"2005-11",
		"2005/11",
		"11/2005",
		"11-2005",
		"2005",
		"This year",
		"Current year",
		"Last year",
		"Previous year",
		"Next year",
		"One year ago",
		"A year ago",
		"One year",
		"In one year",
		"In 1 year",
		"Two years ago",
		"2 years ago",
		"Two years",
		"Two year",
		"Two year ago",
		"In two years",
		"In 2 years",
		"Three years ago",
		"In three years",
		"This month",
		"Current month",
		"Last month",
		"Previous month",
		"Next month",
		"One month ago",
		"A month ago",
		"One month",
		"In one month",
		"In 1 month",
		"Two months ago",
		"2 months ago",
		"Two month ago",
		"Two months",
		"Two month",
		"In two months",
		"In 2 months",
		"Three months ago",
		"In three months",
		"Today",
		"Now",
		"Yesterday",
		"Tomorrow",
		"Day before yesterday",
		"15/12/2025",
		"15-12-2025",
		"15 12 2025",
		"15.12.2025",
		"12/15/2025",
		"12-15-2025",
		"12 15 2025",
		"12.15.2025",
		"2025-12-15",
		"2025/12/15",
		"2025.12.15",
		"15 Dec 2025",
		"Dec 15 2025",
		"December 15, 2025",
		"Monday 15 December 2025",
		"Today one year ago",
		"Today 1 year ago",
		"Today two years ago",
		"Today 2 years ago",
		"Today two year ago",
		"Today two years",
		"Today one month ago",
		"Today 1 month ago",
		"Today two months ago",
		"Today 2 months ago",
		"Today two month ago",
		"Today two months",
		"In one month from today",
		"In 1 month from today",
		"In two months from today",
		"In 2 months from today",
		"23",
		"1",
		"01",
		"31",
		"29 February 2024",
		"29 Feb 2024",
		"29/02/2024",
		"02/29/2024",
		"2024-02-29",
		"the fifth of May 2025",
		"The fifth of May 2025",
		"5th of May 2025",
		"May 5th 2025",
		"May 5, 2025",
		"Five May Twenty twenty five",
		"five may twenty twenty five",
		"5 Mei 2025",
		"5de Mei 2025",
		"15 Desember 2025",
		"Desember 15 2025",
		"23 Oktober 2005",
		"23 Okt 2005",
		"23 Okt. 2005",
		"23/10/2005",
		"10/23/2005"
	];

	fillTestButton.addEventListener("click", () => {
		bulkInput.value = SAMPLE_TESTS.join("\n");
		bulkOutput.value = "";
		bulkSummary.textContent = `Loaded ${SAMPLE_TESTS.length} test cases.`;
	});

	handleInput();
})();
