/* eslint-disable no-console */
const { parsePartialDate } = require("../web/assets/js/partial-date-parser");

const referenceDate = "2025-12-15";

// referenceDate = "2025-12-15"
const cases = [
	// ---------------------------
	// Core absolute (English)
	// ---------------------------
	["23 November 2005", "23 November 2005"],
	["23 Nov 2005", "23 November 2005"],
	["23 Nov. 2005", "23 November 2005"],
	["23 NOV 2005", "23 November 2005"],
	["23 november 2005", "23 November 2005"],

	// month prefix tolerance (partial month tokens)
	["23 Nove 2005", "23 November 2005"],
	["23 Novem 2005", "23 November 2005"],
	["23 Novembe 2005", "23 November 2005"],

	// US-style word month ordering
	["Nov 23 2005", "23 November 2005"],
	["Nov 23, 2005", "23 November 2005"],
	["November 23rd 2005", "23 November 2005"],
	["November 23 2005", "23 November 2005"],
	["November 23, 2005", "23 November 2005"],

	// ordinals + connectors
	["23rd of November 2005", "23 November 2005"],
	["23rd November 2005", "23 November 2005"],
	["23 November, 2005", "23 November 2005"],

	// weekday present (ignored)
	["Wednesday, 23 November 2005", "23 November 2005"],
	["Wednesday 23 November 2005", "23 November 2005"],

	// year-first
	["2005 Nov 23", "23 November 2005"],
	["2005 November 23", "23 November 2005"],
	["2005 11 23", "23 November 2005"],
	["2005/11/23", "23 November 2005"],
	["2005-11-23", "23 November 2005"],
	["2005.11.23", "23 November 2005"],

	// mixed ordering
	["23 2005 Nov", "23 November 2005"],
	["23-2005-Nov", "23 November 2005"],
	["23-Nov-2005", "23 November 2005"],
	["23/Nov/2005", "23 November 2005"],
	["23.Nov.2005", "23 November 2005"],

	// DMY numeric
	["23/11/2005", "23 November 2005"],
	["23-11-2005", "23 November 2005"],
	["23 11 2005", "23 November 2005"],
	["23.11.2005", "23 November 2005"],

	// DMY numeric (2-digit year)
	["23/11/05", "23 November 2005"],
	["23-11-05", "23 November 2005"],
	["23.11.05", "23 November 2005"],

	// compact numeric (8-digit / continuous)
	["23112005", "23 November 2005"],      // DDMMYYYY
	["11232005", "23 November 2005"],      // DDMMYYYY invalid -> MMDDYYYY
	["20051123", "23 November 2005"],      // YYYYMMDD
	["20251215", "15 December 2025"],      // YYYYMMDD

	// MDY numeric must still parse when forced (day cannot be month)
	["11/23/2005", "23 November 2005"],
	["11-23-2005", "23 November 2005"],
	["11 23 2005", "23 November 2005"],
	["11.23.2005", "23 November 2005"],
	["11/23/05", "23 November 2005"],
	["11-23-05", "23 November 2005"],
	["11.23.05", "23 November 2005"],

	// ambiguous numeric preference: prefer DD/MM unless impossible
	["11/10/2005", "11 October 2005"],     // ambiguous -> DD/MM
	["11-10-2005", "11 October 2005"],
	["11 10 2005", "11 October 2005"],
	["11.10.2005", "11 October 2005"],
	["11/10/05", "11 October 2005"],
	["11-10-05", "11 October 2005"],
	["11.10.05", "11 October 2005"],

	// forced MDY because second part cannot be month
	["10/13/2005", "13 October 2005"],
	["10-13-2005", "13 October 2005"],
	["10 13 2005", "13 October 2005"],
	["10.13.2005", "13 October 2005"],
	["10/13/05", "13 October 2005"],
	["10-13-05", "13 October 2005"],
	["10.13.05", "13 October 2005"],

	// ---------------------------
	// Partial day + month (missing year) — prefer past
	// referenceDate = 15 Dec 2025
	// ---------------------------
	["23 November", "23 November 2025"],
	["23 Nov", "23 November 2025"],
	["23 Nov.", "23 November 2025"],
	["Nov 23", "23 November 2025"],
	["Nov 23rd", "23 November 2025"],
	["November 23", "23 November 2025"],
	["November 23rd", "23 November 2025"],
	["23rd November", "23 November 2025"],
	["23rd of November", "23 November 2025"],
	["23/11", "23 November 2025"],
	["23-11", "23 November 2025"],
	["23.11", "23 November 2025"],
	["23 11", "23 November 2025"],
	["11/23", "23 November 2025"],         // 23 can't be month -> MM/DD -> month=11, day=23
	["11-23", "23 November 2025"],
	["11.23", "23 November 2025"],
	["11 23", "23 November 2025"],
	["11 10", "11 October 2025"],
	["11/10", "11 October 2025"],
	["11-10", "11 October 2025"],
	["11.10", "11 October 2025"],

	// prefer past when day+month would otherwise be future in reference year
	["16 December", "16 December 2024"],   // 16 Dec 2025 is future vs ref(15 Dec 2025)
	["20/12", "20 December 2024"],
	["12/20", "20 December 2024"],         // 20 can't be month -> month=12 day=20 -> then prefer past year
	["31 December", "31 December 2024"],
	["01 January", "1 January 2025"],      // already past in 2025
	["1 January", "1 January 2025"],

	// ---------------------------
	// Month only (missing day) — prefer past month/year
	// ---------------------------
	["November", "November 2025"],
	["Nov", "November 2025"],
	["Nov.", "November 2025"],
	["October", "October 2025"],
	["Oct", "October 2025"],
	["Oct.", "October 2025"],
	["December", "December 2025"],
	["Dec", "December 2025"],
	["Dec.", "December 2025"],
	["January", "January 2025"],
	["Feb", "February 2025"],
	["Feb.", "February 2025"],

	// ---------------------------
	// Day only — prefer nearest past date (may shift month; clamp if needed)
	// ---------------------------
	["1", "1 December 2025"],
	["01", "1 December 2025"],
	["10", "10 December 2025"],
	["11", "11 December 2025"],
	["12", "12 December 2025"],
	["15", "15 December 2025"],
	["16", "16 November 2025"],            // Dec 16 is future -> previous month
	["23", "23 November 2025"],            // Dec 23 is future -> previous month
	["31", "30 November 2025"],            // clamp (Nov has 30 days)

	// ---------------------------
	// Month + Year (no day)
	// ---------------------------
	["2025-11", "November 2025"],
	["2025/11", "November 2025"],
	["2025.11", "November 2025"],
	["11/2025", "November 2025"],
	["11-2025", "November 2025"],
	["11.2025", "November 2025"],
	["Nov 2005", "November 2005"],
	["November 2005", "November 2005"],
	["2005 Nov", "November 2005"],
	["2005 November", "November 2005"],
	["2005-11", "November 2005"],
	["2005/11", "November 2005"],
	["11/2005", "November 2005"],
	["11-2005", "November 2005"],

	// ---------------------------
	// Year only (digits)
	// ---------------------------
	["2005", "2005"],
	["1999", "1999"],
	["2025", "2025"],

	// ---------------------------
	// Two-digit year pivot tests (pivot at reference year 2025 -> 00..25 => 20xx, 26..99 => 19xx)
	// ---------------------------
	["23/11/00", "23 November 2000"],
	["23/11/25", "23 November 2025"],
	["23/11/26", "23 November 1926"],
	["23/11/99", "23 November 1999"],
	["11/10/26", "11 October 1926"],       // ambiguous day/month but year forced by pivot

	// ---------------------------
	// Relative dates (English)
	// ---------------------------
	["This year", "2025"],
	["Current year", "2025"],
	["Last year", "2024"],
	["Previous year", "2024"],
	["Next year", "2026"],

	["One year ago", "2024"],
	["A year ago", "2024"],
	["One year", "2024"],                  // ambiguous duration -> prefer past
	["In one year", "2026"],
	["In 1 year", "2026"],

	["Two years ago", "2023"],
	["2 years ago", "2023"],
	["Two years", "2023"],                 // prefer past
	["Two year", "2023"],
	["Two year ago", "2023"],
	["In two years", "2027"],
	["In 2 years", "2027"],

	["Three years ago", "2022"],
	["In three years", "2028"],

	["This month", "December 2025"],
	["Current month", "December 2025"],
	["Last month", "November 2025"],
	["Previous month", "November 2025"],
	["Next month", "January 2026"],

	["One month ago", "November 2025"],
	["A month ago", "November 2025"],
	["One month", "November 2025"],        // ambiguous duration -> prefer past
	["In one month", "January 2026"],
	["In 1 month", "January 2026"],

	["Two months ago", "October 2025"],
	["2 months ago", "October 2025"],
	["Two month ago", "October 2025"],
	["Two months", "October 2025"],        // prefer past
	["Two month", "October 2025"],
	["In two months", "February 2026"],
	["In 2 months", "February 2026"],

	["Three months ago", "September 2025"],
	["In three months", "March 2026"],

	["Today", "15 December 2025"],
	["Now", "15 December 2025"],
	["Yesterday", "14 December 2025"],
	["Tomorrow", "16 December 2025"],
	["Day before yesterday", "13 December 2025"],

	// anchored relatives -> full dates
	["Today one year ago", "15 December 2024"],
	["Today 1 year ago", "15 December 2024"],
	["Today two years ago", "15 December 2023"],
	["Today 2 years ago", "15 December 2023"],
	["Today two year ago", "15 December 2023"],
	["Today two years", "15 December 2023"],

	["Today one month ago", "15 November 2025"],
	["Today 1 month ago", "15 November 2025"],
	["Today two months ago", "15 October 2025"],
	["Today 2 months ago", "15 October 2025"],
	["Today two month ago", "15 October 2025"],
	["Today two months", "15 October 2025"],

	["In one month from today", "15 January 2026"],
	["In 1 month from today", "15 January 2026"],
	["In two months from today", "15 February 2026"],
	["In 2 months from today", "15 February 2026"],

	// ---------------------------
	// Absolute reference formats (15 Dec 2025) - multiple orders + separators
	// ---------------------------
	["15/12/2025", "15 December 2025"],
	["15-12-2025", "15 December 2025"],
	["15 12 2025", "15 December 2025"],
	["15.12.2025", "15 December 2025"],
	["12/15/2025", "15 December 2025"],    // forced MDY because 15 can't be month
	["12-15-2025", "15 December 2025"],
	["12 15 2025", "15 December 2025"],
	["12.15.2025", "15 December 2025"],
	["2025-12-15", "15 December 2025"],
	["2025/12/15", "15 December 2025"],
	["2025.12.15", "15 December 2025"],
	["15 Dec 2025", "15 December 2025"],
	["Dec 15 2025", "15 December 2025"],
	["December 15, 2025", "15 December 2025"],
	["Monday 15 December 2025", "15 December 2025"],
	["Monday, December 15, 2025", "15 December 2025"],

	// ---------------------------
	// Leap year validity
	// ---------------------------
	["29 February 2024", "29 February 2024"],
	["29 Feb 2024", "29 February 2024"],
	["29/02/2024", "29 February 2024"],
	["02/29/2024", "29 February 2024"],
	["2024-02-29", "29 February 2024"],

	// invalid dates -> ""
	["29/02/2025", ""],
	["31/02/2025", ""],
	["31 November 2005", ""],
	["32/11/2005", ""],
	["13/13/2013", ""],

	// ---------------------------
	// Spelled-out numbers (English) incl hyphenated years
	// ---------------------------
	["the fifth of May 2025", "5 May 2025"],
	["The fifth of May 2025", "5 May 2025"],
	["fifth of May 2025", "5 May 2025"],
	["5th of May 2025", "5 May 2025"],
	["May 5th 2025", "5 May 2025"],
	["May 5, 2025", "5 May 2025"],

	["Five May Twenty twenty five", "5 May 2025"],
	["five may twenty twenty five", "5 May 2025"],
	["Five May twenty-twenty-five", "5 May 2025"],
	["five may twenty-twenty-five", "5 May 2025"],
	["Five May twenty twenty-five", "5 May 2025"],
	["Five May two thousand twenty five", "5 May 2025"],
	["Five May two thousand and twenty five", "5 May 2025"],

	// year-only spelled (English)
	["twenty twenty five", "2025"],
	["twenty-twenty-five", "2025"],
	["two thousand twenty five", "2025"],
	["two thousand and twenty five", "2025"],

	// ordinal day words beyond "fifth"
	["the first of January 2000", "1 January 2000"],
	["the twenty-third of November 2005", "23 November 2005"],
	["the thirty-first of December 2024", "31 December 2024"],

	// ---------------------------
	// Afrikaans absolute dates + abbreviations
	// ---------------------------
	["5 Mei 2025", "5 May 2025"],
	["5de Mei 2025", "5 May 2025"],
	["die vyfde van Mei 2025", "5 May 2025"],
	["vyfde Mei 2025", "5 May 2025"],
	["vyfde van Mei 2025", "5 May 2025"],

	["15 Desember 2025", "15 December 2025"],
	["Desember 15 2025", "15 December 2025"],
	["Maandag 15 Desember 2025", "15 December 2025"],
	["Maandag, 15 Desember 2025", "15 December 2025"],
	["15 Des 2025", "15 December 2025"],
	["Des 15 2025", "15 December 2025"],
	["15 Des. 2025", "15 December 2025"],

	["23 Oktober 2005", "23 October 2005"],
	["23 Okt 2005", "23 October 2005"],
	["23 Okt. 2005", "23 October 2005"],
	["23/10/2005", "23 October 2005"],
	["10/23/2005", "23 October 2005"],     // forced MDY because 23 can't be month
	["2005-10-23", "23 October 2005"],

	// Afrikaans month name variants (minimum)
	["1 Januarie 2025", "1 January 2025"],
	["2 Februarie 2025", "2 February 2025"],
	["3 Maart 2025", "3 March 2025"],
	["4 April 2025", "4 April 2025"],
	["6 Junie 2025", "6 June 2025"],
	["7 Julie 2025", "7 July 2025"],
	["8 Augustus 2025", "8 August 2025"],
	["9 September 2025", "9 September 2025"],
	["10 November 2025", "10 November 2025"],

	// Afrikaans partial day+month (missing year) — prefer past
	["23 November", "23 November 2025"],    // works in Afrikaans too (shared token)
	["23 Nov", "23 November 2025"],
	["23 Desember", "23 December 2024"],    // prefer past (since 23 Dec 2025 future)
	["16 Desember", "16 December 2024"],

	// ---------------------------
	// Relative dates (Afrikaans)
	// ---------------------------
	["Vandag", "15 December 2025"],
	["Nou", "15 December 2025"],
	["Gister", "14 December 2025"],
	["Môre", "16 December 2025"],
	["Eergister", "13 December 2025"],

	["Hierdie jaar", "2025"],
	["Huidige jaar", "2025"],
	["Verlede jaar", "2024"],
	["Vorige jaar", "2024"],
	["Volgende jaar", "2026"],

	["Een jaar gelede", "2024"],
	["'n jaar gelede", "2024"],
	["’n jaar gelede", "2024"],
	["Een jaar", "2024"],                  // ambiguous -> prefer past
	["Oor een jaar", "2026"],
	["In een jaar", "2026"],
	["Oor 1 jaar", "2026"],
	["1 jaar gelede", "2024"],

	["Twee jaar gelede", "2023"],
	["2 jaar gelede", "2023"],
	["Twee jaar", "2023"],                 // prefer past
	["Oor twee jaar", "2027"],
	["Oor 2 jaar", "2027"],

	["Hierdie maand", "December 2025"],
	["Huidige maand", "December 2025"],
	["Verlede maand", "November 2025"],
	["Vorige maand", "November 2025"],
	["Volgende maand", "January 2026"],

	["Een maand gelede", "November 2025"],
	["'n maand gelede", "November 2025"],
	["Een maand", "November 2025"],        // ambiguous -> prefer past
	["Oor een maand", "January 2026"],
	["In een maand", "January 2026"],
	["Oor 1 maand", "January 2026"],
	["1 maand gelede", "November 2025"],

	["Twee maande gelede", "October 2025"],
	["2 maande gelede", "October 2025"],
	["Twee maande", "October 2025"],       // prefer past
	["Oor twee maande", "February 2026"],
	["Oor 2 maande", "February 2026"],

	// anchored Afrikaans relatives -> full date
	["Vandag een jaar gelede", "15 December 2024"],
	["Vandag 1 jaar gelede", "15 December 2024"],
	["Vandag twee jaar gelede", "15 December 2023"],
	["Vandag 2 jaar gelede", "15 December 2023"],
	["Vandag een maand gelede", "15 November 2025"],
	["Vandag 1 maand gelede", "15 November 2025"],
	["Vandag twee maande gelede", "15 October 2025"],
	["Vandag 2 maande gelede", "15 October 2025"],
	["Oor een maand van vandag", "15 January 2026"],
	["Oor 1 maand van vandag", "15 January 2026"],
	["Oor twee maande van vandag", "15 February 2026"],
	["Oor 2 maande van vandag", "15 February 2026"],

	// ---------------------------
	// Afrikaans spelled-out years (incl hyphenation) + spelled day ordinals
	// ---------------------------
	["vyf Mei twintig twintig vyf", "5 May 2025"],
	["vyf Mei twintig-twintig-vyf", "5 May 2025"],
	["vyfde Mei twintig twintig vyf", "5 May 2025"],
	["vyfde Mei twintig-twintig-vyf", "5 May 2025"],
	["vyf Mei twee duisend vyf en twintig", "5 May 2025"],
	["vyf Mei twee duisend en vyf en twintig", "5 May 2025"],

	// year-only Afrikaans words
	["twintig twintig vyf", "2025"],
	["twintig-twintig-vyf", "2025"],
	["twee duisend vyf en twintig", "2025"],
	["twee duisend en vyf en twintig", "2025"],

	// ---------------------------
	// Extra robustness: whitespace, punctuation, mixed case
	// ---------------------------
	["   23   Nov   2005   ", "23 November 2005"],
	["(Wednesday) 23 November 2005", "23 November 2005"],
	["23, November, 2005", "23 November 2005"],
	["NOVEMBER 23RD, 2005", "23 November 2005"],
	["MAANDAG, 15 DESEMBER 2025", "15 December 2025"],

	// ---------------------------
	// Garbage / unparseable -> ""
	// ---------------------------
	["not a date", ""],
	["Novembrrrr 2005", ""],
	["2005-99-99", ""],
	["00/00/0000", ""]
];


function run() {
	let failures = 0;
	cases.forEach(([input, expected]) => {
		const result = parsePartialDate(input, { referenceDate });
		const actual = result.text || "";
		if (actual !== expected) {
			failures += 1;
			console.error(`FAIL: "${input}" -> "${actual}" (expected "${expected}")`);
		}
	});
	if (failures > 0) {
		console.error(`\n${failures} case(s) failed.`);
		process.exitCode = 1;
	} else {
		console.log(`All ${cases.length} cases passed.`);
	}
}

run();
