const hdrQuery = matchMedia("(dynamic-range: high)");

function updateVideo(video) {
    const newSrc = hdrQuery.matches
        ? video.dataset.hdrSrc
        : video.dataset.sdrSrc;

    // Don't reload if it's already using the correct source.
    if (video.currentSrc.endsWith(newSrc))
        return;

    const wasPlaying = !video.paused;
    const time = video.currentTime;

    video.src = newSrc;
    video.load();

    video.addEventListener("loadedmetadata", function restore() {
        video.removeEventListener("loadedmetadata", restore);

        video.currentTime = Math.min(time, video.duration || time);

        if (wasPlaying)
            video.play().catch(() => {});
    });
}

function updateAllVideos() {
    document.querySelectorAll("video[data-hdr-src][data-sdr-src]")
        .forEach(updateVideo);
}

// Initial load.
updateAllVideos();

// When the HDR state changes.
hdrQuery.addEventListener("change", updateAllVideos);

