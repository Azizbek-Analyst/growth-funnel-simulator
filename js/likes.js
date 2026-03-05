const META_KEY = 'roi_calculator_meta';

function readMeta() {
    try {
        const raw = localStorage.getItem(META_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function writeMeta(patch) {
    const current = readMeta();
    const next = { ...current, ...patch };
    localStorage.setItem(META_KEY, JSON.stringify(next));
    return next;
}

export function getLikes() {
    return readMeta().likes || 0;
}

export function hasLiked() {
    return !!readMeta().hasLiked;
}

export function likeOnce() {
    const meta = readMeta();
    if (meta.hasLiked) return meta.likes || 0;
    const likes = (meta.likes || 0) + 1;
    writeMeta({ likes, hasLiked: true });
    return likes;
}

export function markDocsSeen() {
    writeMeta({ hasSeenDocs: true });
}
