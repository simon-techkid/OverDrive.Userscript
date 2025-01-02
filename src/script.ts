// ==UserScript==
// @name         OverDrive ODM Downloader
// @namespace    http://tampermonkey.net/
// @version      1.10
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
// ==/UserScript==

//import JSZip from "jszip";
//import { saveAs } from "file-saver";

(function () {
    'use strict';

    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
    const downloadFilename = "audiobooks.zip";
    const autoDelay = 500;

    function getRandomInt(min: number, max: number): number {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function addAudiobookDownloads(): void {
        const formatId = 'audiobook-overdrive';
        const targetId = 'audiobook-mp3';
        const targetName = 'Download';
        const targetType = 'MP3 audiobook';

        const listenButtons = document.querySelectorAll<HTMLAnchorElement>(
            `.button.secondary.radius.od-format-button[data-format-id="${formatId}"]`
        );

        if (listenButtons.length === 0) return;

        for (const listenBtn of Array.from(listenButtons)) {
            if (listenBtn.classList.contains('script-added')) continue;

            const mediaId = listenBtn.getAttribute('data-media-id')!;
            const downloadLink = constructDownloadUrl(mediaId);

            const downloadBtn = listenBtn.cloneNode(true) as HTMLAnchorElement;
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
            downloadBtn.removeAttribute('target');
            downloadBtn.setAttribute('data-format-id', targetId);

            listenBtn.parentNode?.appendChild(downloadBtn);

            const overDriveButton = listenBtn.parentNode?.querySelector(
                '.loan-button-audiobook'
            );
            overDriveButton?.remove();

            listenBtn.classList.add('script-added');
        }
    }

    function constructDownloadUrl(mediaId: string): string {
        const baseUrl = window.location.origin;
        return `${baseUrl}/media/download/audiobook-mp3/${mediaId}`;
    }

    function addSidebarButton(
        className: string,
        buttonTitle: string,
        event: (e: MouseEvent) => void
    ): void {
        const menu = document.querySelector('.account-menu');
        if (!menu || menu.querySelector(`.${className}`)) return;

        const masterLi = document.createElement('li');
        const masterButton = document.createElement('a');
        masterButton.href = '#';
        masterButton.className = `secondary-color-hover contrast ${className}`;
        masterButton.textContent = buttonTitle;
        masterButton.addEventListener('click', event);

        masterLi.appendChild(masterButton);
        menu.appendChild(masterLi);
    }

    function returnLoans(mediaIds: string[]): void {
        for (const id of mediaIds) {
            setTimeout(() => unsafeWindow.ajax.returnTitle(id), autoDelay);
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

    function addAudiobookDownloadButton(): void {
        const mediaIds = Object.values(unsafeWindow.OverDrive.mediaItems)
            .filter(
                (item: any) =>
                    item.type.id === 'audiobook' &&
                    item.otherFormats.some((format: any) => format.id === 'audiobook-mp3')
            )
            .map((mediaItem: any) => mediaItem.id);

        if (mediaIds.length === 0) return;

        const downloadLinks = mediaIds.map(constructDownloadUrl).filter(Boolean);

        addSidebarButton(
            'master-download-individual',
            `Download ${downloadLinks.length} Audiobooks Individually`,
            (e) => {
                e.preventDefault();
                for (const url of downloadLinks) {
                    const delay = getRandomInt(7000, 10000);
                    setTimeout(() => window.open(url, '_blank'), delay);
                }
            }
        );
    }

    async function addAudiobookDownloadButtonZip(): Promise<void> {
        const mediaIds = Object.values(unsafeWindow.OverDrive.mediaItems)
            .filter(
                (item: any) =>
                    item.type.id === 'audiobook' &&
                    item.otherFormats.some((format: any) => format.id === 'audiobook-mp3')
            )
            .map((mediaItem: any) => mediaItem.id);

        if (mediaIds.length === 0) return;

        const downloadLinks = mediaIds.map(constructDownloadUrl).filter(Boolean);

        addSidebarButton(
            'master-download-zip',
            `Download ${downloadLinks.length} Audiobooks to ZIP`,
            async (e) => {
                e.preventDefault();

                const zip = new JSZip();
                const promises = downloadLinks.map((url, index) =>
                    new Promise<void>((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: 'GET',
                            url,
                            responseType: 'blob',
                            onload: (response) => {
                                if (response.status === 200) {
                                    const blob = response.response as Blob;
                                    let fileName = `audiobook_${index + 1}.odm`;

                                    const matches = filenameRegex.exec(response.responseHeaders);
                                    if (matches?.[1]) {
                                        fileName = matches[1].replace(/['"]/g, '').trim();
                                    }

                                    zip.file(fileName, blob);
                                    resolve();
                                } else {
                                    reject(
                                        new Error(
                                            `Failed to download ${url}: ${response.statusText}`
                                        )
                                    );
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
                    const content = await zip.generateAsync({ type: 'blob' });
                    saveAs(content, downloadFilename);
                } catch (error) {
                    console.error('Error downloading audiobooks:', error);
                }
            }
        );
    }

    function addAudiobookReturnButton(): void {
        const mediaIds = Array.from(
            document.querySelectorAll<HTMLAnchorElement>(
                `.button.secondary.radius.od-format-button.loan-button-nonkindle.primary.downloadButton.script-added[data-format-id="audiobook-mp3"][data-media-id]`
            )
        ).map((loan) => loan.getAttribute('data-media-id')!);

        if (mediaIds.length === 0) return;

        addSidebarButton('audiobook-return', `Return ${mediaIds.length} Audiobooks`, () => {
            returnLoans(mediaIds);
        });
    }

    function addLoanReturnButton(): void {
        const mediaIds = Object.keys(unsafeWindow.OverDrive.mediaItems);
        if (mediaIds.length === 0) return;

        addSidebarButton('master-return', `Return ${mediaIds.length} Loans`, () => {
            returnLoans(mediaIds);
        });
    }
})();
