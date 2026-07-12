const hdrQuery = matchMedia("(dynamic-range: high)");

function desiredSrc(video) {
    return hdrQuery.matches
        ? video.dataset.hdrSrc
        : video.dataset.sdrSrc;
}

function cloneVideoAttributes(src, dst) {
    for (const attr of src.attributes) {
        if (attr.name.startsWith("data-"))
            continue;

        dst.setAttribute(attr.name, attr.value);
    }

    dst.removeAttribute("id");
}

function initializeVideo(original) {
    const wrapper = document.createElement("div");
    wrapper.className = "adaptive-video-wrapper";

    const videoA = document.createElement("video");
    const videoB = document.createElement("video");

    cloneVideoAttributes(original, videoA);
    cloneVideoAttributes(original, videoB);

    videoA.classList.add("active");
    videoB.classList.add("inactive");

    wrapper.style.display = "inline-block";
    wrapper.style.width = original.style.width || "100%";
    wrapper.style.maxWidth = original.style.maxWidth || "100%";

    wrapper.append(videoA, videoB);

    original.replaceWith(wrapper);

    const state = {
        wrapper,
        videos: [videoA, videoB],
        active: 0,
        hdrSrc: original.dataset.hdrSrc,
        sdrSrc: original.dataset.sdrSrc
    };

    wrapper._adaptiveVideo = state;

    updateWrapper(state, true);
}

function waitForFullBuffer(video) {
    return new Promise(resolve => {
        function check() {
            if (
                video.duration &&
                video.buffered.length &&
                video.buffered.end(video.buffered.length - 1) >= video.duration
            ) {
                video.removeEventListener("progress", check);
                resolve();
            }
        }

        video.addEventListener("progress", check);
        video.addEventListener("loadedmetadata", check);
        check();
    });
}

function updateWrapper(state, firstLoad = false) {
    const current = state.videos[state.active];
    const next = state.videos[1 - state.active];

    const newSrc = hdrQuery.matches ? state.hdrSrc : state.sdrSrc;

    if (current.dataset.src === newSrc)
        return;

    const wasPlaying = !current.paused;
    const time = current.currentTime;

    next.src = newSrc;
    next.dataset.src = newSrc;
    next.load();

    next.currentTime = 0;

    waitForFullBuffer(next).then(() => {
        next.currentTime = Math.min(time, next.duration || time);

        if (wasPlaying)
            next.play().catch(() => {});

        next.classList.remove("inactive");
        next.classList.add("active");

        current.classList.remove("active");
        current.classList.add("inactive");

        current.pause();

        state.active = 1 - state.active;
    });


    if (firstLoad && next?.classList.contains("autoplay")) {
        next.play().catch(() => {});
    }
}

function updateAllVideos() {
    document
        .querySelectorAll(".adaptive-video-wrapper")
        .forEach(wrapper => updateWrapper(wrapper._adaptiveVideo));
}

document
    .querySelectorAll("video[data-hdr-src][data-sdr-src]")
    .forEach(initializeVideo);

hdrQuery.addEventListener("change", updateAllVideos);




//TODO: check if this actually works?
//video.addEventListener("loadeddata", () => {
//    video.classList.add("loaded");
//}, { once: true });

