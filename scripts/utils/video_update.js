const hdrQuery = matchMedia("(dynamic-range: high)");

let _vidCounter = 0;

function __log(prefix, msg, extra) {
    if (extra !== undefined) console.log(`[adptv] ${prefix} ${msg}`, extra);
    else console.log(`[adptv] ${prefix} ${msg}`);
}

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

    const vidId = ++_vidCounter;

    const videoA = document.createElement("video");
    const videoB = document.createElement("video");
    videoA._adbId = `v${vidId}-0`;
    videoB._adbId = `v${vidId}-1`;

    __log("init", "cloned", { id: vidId, src: original.src });

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

// function waitForFullBuffer(video) {
//     return new Promise(resolve => {
//         function check() {
//             try {
//                 console.log("dur:", video.duration);
//                 console.log("buf len:", video.buffered.length);
//
//                 const end = video.buffered.end(video.buffered.length - 1);
//                 console.log("buf end:", end);
//
//                 if (
//                     !Number.isNaN(video.duration) &&
//                     video.duration > 0 &&
//                     end >= video.duration
//                 ) {
//                     video.removeEventListener("progress", check);
//                     video.removeEventListener("loadedmetadata", check);
//                     resolve();
//                 }
//             } catch {
//                 // Ignore until metadata/buffer information is available.
//             }
//         }
//
//         video.addEventListener("progress", check, false);
//         video.addEventListener("loadedmetadata", check, false);
//         const timer = setTimeout(() => {    // fallback — resolves even if Firefox
//             video.removeEventListener('progress', check, false);      // stalls (which it does for cloned videos)
//             resolve();
//         }, 5000);
//         check();
//     });
// }

function waitForFullBuffer(video) {
    const id = video._adbId || '?';
    __log("waitFor", "starting", { id, src: video.src });

    return new Promise(resolve => {
        let finished = false;

        function done() {
            if (finished)
                return;

            finished = true;

            clearInterval(interval);
            video.removeEventListener("progress", check);
            video.removeEventListener("loadedmetadata", check);
            video.removeEventListener("canplaythrough", check);
            video.removeEventListener("error", onError);

            __log("waitFor", "resolved", { id });
            resolve();
        }

        function onError(err) {
            __log("waitFor", "ERROR", { id, error: err.message || String(err) });
        }

        function check() {
            try {
                console.log(`[${id}] dur:`, video.duration);
                console.log(`[${id}] buf len:`, video.buffered.length);

                const end = video.buffered.end(video.buffered.length - 1);
                console.log(`[${id}] buf end:`, end);
                if (
                    !Number.isNaN(video.duration) &&
                    video.duration > 0 &&
                    video.buffered.length &&
                    end >= video.duration
                ) {
                    done();
                }
            } catch {
                // Metadata/buffer not ready yet.
            }
        }
        function logcheck() {
            check()
        }

        // Fast path: fire immediately when events occur.
        video.addEventListener("progress", check, false);
        video.addEventListener("loadedmetadata", check, false);
        video.addEventListener("canplaythrough", check, false);
        video.addEventListener("error", onError, false);

        // Fallback: Firefox may stop firing progress events.
        const interval = setInterval(logcheck, 100);

        // Initial check in case it's already buffered.
        check();
    });
}

function updateWrapper(state, firstLoad = false) {
    const current = state.videos[state.active];
    const next = state.videos[1 - state.active];

    current.classList.remove("loaded");
    next.classList.remove("loaded");

    const newSrc = hdrQuery.matches ? state.hdrSrc : state.sdrSrc;
    const nxtId = next._adbId || '?';

    __log("update", "src set", { nxt: nxtId, src: newSrc });

    if (current.dataset.src === newSrc) {
        __log("update", "skipping — already at target src");
        return;
    }

    const wasPlaying = !current.paused;
    const time = current.currentTime;

    next.src = newSrc;
    next.dataset.src = newSrc;
    next.load();

    __log("update", "load() called", { nxt: nxtId });

    next.currentTime = 0;

    waitForFullBuffer(next).then(() => {
        next.currentTime = Math.min(time, next.duration || time);

        if (wasPlaying) {
            const p = next.play();
            if (p && typeof p.then === 'function') {
                p.catch(e => __log("play", "error", { nxt: nxtId, msg: e?.message }))
            };
        }

        next.classList.remove("inactive");
        next.classList.add("active");

        current.classList.remove("active");
        current.classList.add("inactive");

        current.pause();

        state.active = 1 - state.active;

        next.classList.add("loaded");
    });

    if (firstLoad && next.classList.contains("autoplay")) {
        const p = next.play();
        if (p && typeof p.then === 'function') p.catch(e => __log("play-firstload", "error", { nxt: nxtId, msg: e?.message }));
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

