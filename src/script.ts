// ==UserScript==
// @name         OverDrive ODM Downloader
// @namespace    http://tampermonkey.net/
// @version      1.11
// @description  Make the OverDrive loan page more helpful.
// @author       Simon Field
// @license      WTFPL
// @icon         https://brooklyn.overdrive.com/favicon.ico
// @match        http://*.overdrive.com/*account/loans
// @match        https://*.overdrive.com/*account/loans
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @downloadURL  https://github.com/simon-techkid/OverDrive.Userscript/releases/latest/download/script.user.js
// @updateURL    https://github.com/simon-techkid/OverDrive.Userscript/releases/latest/download/script.user.js
// ==/UserScript==

//import JSZip from "jszip";
//import { saveAs } from "file-saver";

(function () {
	'use strict';

	const filenameRegex: RegExp = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
	const downloadFilename: string = "audiobooks.zip";
	const autoDelay = 500;

	function getRandomInt(min: number, max: number): number {
		// Ensure min is less than or equal to max
		min = Math.ceil(min);
		max = Math.floor(max);
		
		// Generate random number between min and max (inclusive)
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	// Function to add the "Download MP3 audiobook" buttons
	function addAudiobookDownloads(): void {
		const formatId: string = 'audiobook-overdrive';
		const targetId: string = 'audiobook-mp3';
		const targetName: string = 'Download';
		const targetType: string = 'MP3 audiobook';

		const listenButtonsPath: string = `.button.secondary.radius.od-format-button[data-format-id="${formatId}"]`;
		const listenButtons: NodeListOf<HTMLAnchorElement> = document.querySelectorAll<HTMLAnchorElement>(listenButtonsPath);

		if (listenButtons.length === 0) return;

		for (const listenBtn of Array.from(listenButtons)) {
			if (listenBtn.classList.contains('script-added')) continue;

			const mediaId: string = listenBtn.getAttribute('data-media-id')!;
			const downloadLink: string = constructDownloadUrl(mediaId);
			//const downloadLink: string = listenBtn.href.replace(formatId, targetId);

			// Clone the "Listen" button to create the "Download" button
			const downloadBtn: HTMLAnchorElement = listenBtn.cloneNode(true) as HTMLAnchorElement;
			downloadBtn.classList.add(
				'loan-button-nonkindle',
				'button',
				'radius',
				'primary',
				'downloadButton',
				'script-added'
			);
			
			downloadBtn.href = downloadLink;
			downloadBtn.innerHTML = `<b>${targetName}</b><br/><span class="dl-text">${targetType}</span>`;
			downloadBtn.removeAttribute('target'); // Open in the same tab
			downloadBtn.setAttribute('data-format-id', targetId);

			// Append the new "Download" button
			listenBtn.parentNode?.appendChild(downloadBtn);

			const overDriveButtonPath: string = '.loan-button-audiobook';
			const overDriveButton = listenBtn.parentNode?.querySelector(overDriveButtonPath);
			overDriveButton?.remove(); // Remove the OverDrive-specific dropdown

			listenBtn.classList.add('script-added'); // Mark as processed
		}
	}

	// Construct a download URL for an audiobook with the given Media ID
	function constructDownloadUrl(mediaId: string): string {
		const baseUrl: string = window.location.origin; // Get the library OverDrive URL from the window
		return `${baseUrl}/media/download/audiobook-mp3/${mediaId}`;
	}
	
	// Add button for "Download Audiobooks Individually"
	function addAudiobookDownloadButton(): void {
		
		const mediaIds: string[] = Object.values(unsafeWindow.OverDrive.mediaItems)
			.filter(
				(item: OverDriveMediaItem) =>
					item.type.id === 'audiobook' &&
					item.otherFormats.some((format: OverDriveMediaItemType) => format.id === 'audiobook-mp3')
			)
			.map((mediaItem: OverDriveMediaItem) => mediaItem.id);

		if (mediaIds.length === 0) return;

		// Method to get links from the buttons on the page
		//const downloadLinkButtons = '.loan-button-nonkindle.button.radius.primary.downloadButton.script-added';
		//const downloadLinks = Array.from(document.querySelectorAll(downloadLinkButtons)).map(btn => btn.href).filter(url => url);
		const downloadLinks: string[] = mediaIds.map(constructDownloadUrl).filter(Boolean);

		addSidebarButton(
			'master-download-individual',
			`Download ${downloadLinks.length} Audiobooks Individually`,
			(e) => { // click event for the "Download Audiobooks Individually" button
				e.preventDefault();
				for (const url of downloadLinks) {
					const delay: number = getRandomInt(100, 200); // Random delay between 100 and 200 ms
					setTimeout(() => window.open(url, '_blank'), delay);
				}
			}
		);
	}
	
	// Add button for "Download Audiobooks to ZIP"
	async function addAudiobookDownloadButtonZip(): Promise<void> {
		
		const mediaIds: string[] = Object.values(unsafeWindow.OverDrive.mediaItems)
			.filter(
				(item: OverDriveMediaItem) =>
					item.type.id === 'audiobook' &&
					item.otherFormats.some((format: OverDriveMediaItemType) => format.id === 'audiobook-mp3')
			)
			.map((mediaItem: OverDriveMediaItem) => mediaItem.id);

		if (mediaIds.length === 0) return; // No loans, don't add the button

		// Method to get links from the buttons on the page
		//const downloadLinkButtons = '.loan-button-nonkindle.button.radius.primary.downloadButton.script-added';
		//const downloadLinks = Array.from(document.querySelectorAll(downloadLinkButtons)).map(btn => btn.href).filter(url => url);
		const downloadLinks: string[] = mediaIds.map(constructDownloadUrl).filter(Boolean);

		addSidebarButton(
			'master-download-zip',
			`Download ${downloadLinks.length} Audiobooks to ZIP`,
			async (e) => { // click event for the "Download Audiobooks to ZIP" button
				e.preventDefault();

				const zip = new JSZip();
				const promises: Promise<void>[] = downloadLinks.map((url, index) =>
					new Promise<void>((resolve, reject) => {
						GM_xmlhttpRequest({
							method: 'GET',
							url,
							responseType: 'blob',
							onload: (response) => {
								if (response.status === 200) {
									const blob: Blob = response.response as Blob;
									let fileName: string = `audiobook_${index + 1}.odm`;

									const matches: RegExpExecArray | null = filenameRegex.exec(response.responseHeaders);
									if (matches?.[1]) {
										fileName = matches[1].replace(/['"]/g, '').trim();
									}

									zip.file(fileName, blob);
									resolve();
								} else {
									reject(new Error(`Failed to download ${url}: ${response.statusText}`));
								}
							},
							onerror: (error) => {
								reject(new Error(`Network error: ${(error as any)?.message || "Unknown error"}`));
							},
						});
					})
				);

				try {
					await Promise.all(promises);
					const content: Blob = await zip.generateAsync({ type: 'blob' }) as Blob;
					saveAs(content, downloadFilename);
				} catch (error) {
					console.error('Error downloading audiobooks:', error);
				}
			}
		);
	}
	
	function addAudiobookReturnButton(): void {
		const mediaIdsPath: string = `.button.secondary.radius.od-format-button.loan-button-nonkindle.primary.downloadButton.script-added[data-format-id="audiobook-mp3"][data-media-id]`;
		const mediaIds: string[] = Array.from(
			document.querySelectorAll<HTMLAnchorElement>(mediaIdsPath)
		).map((loan) => loan.getAttribute('data-media-id')!);

		if (mediaIds.length === 0) return; // No loans, don't add the button

		addSidebarButton('audiobook-return', `Return ${mediaIds.length} Audiobooks`, () => {
			returnLoans(mediaIds);
		});
	}

	function addLoanReturnButton(): void {
		const mediaIds: string[] = Object.keys(unsafeWindow.OverDrive.mediaItems);

		if (mediaIds.length === 0) return; // No loans, don't add the button

		addSidebarButton('master-return', `Return ${mediaIds.length} Loans`, () => {
			returnLoans(mediaIds);
		});
	}

	function addSidebarButton(className: string, buttonTitle: string, event: (e: MouseEvent) => void): void {
		const menu: Element | null = document.querySelector('.account-menu');
		
		if (!menu || menu.querySelector(`.${className}`)) {
			if (!menu) console.log('Account menu not found.');

			return; // Skip if already added or not found
		}

		const masterLi: HTMLLIElement = document.createElement('li');
		const masterButton: HTMLAnchorElement = document.createElement('a');
		masterButton.href = '#';
		masterButton.className = `secondary-color-hover contrast ${className}`;
		masterButton.textContent = buttonTitle;
		masterButton.addEventListener('click', event);

		masterLi.appendChild(masterButton);
		menu.appendChild(masterLi);
	}

	// https://greasyfork.org/en/scripts/402911-return-every-book-to-overdrive
	function returnLoans(mediaIds: string[], delayTime: number = autoDelay): void {
		for (const id of mediaIds) {
			setTimeout(() => unsafeWindow.ajax.returnTitle(id), delayTime);
		}
	}

	window.addEventListener(
		'load',
		() => {
			addAudiobookDownloads();
			addAudiobookDownloadButton();
			addAudiobookDownloadButtonZip();
			addAudiobookReturnButton();
			addLoanReturnButton();
		},
		false
	);
})();
