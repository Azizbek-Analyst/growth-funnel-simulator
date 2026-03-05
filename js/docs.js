import { requireAuth, renderSidebar, initMobileToggle } from './router.js';
import { t, applyTranslations } from './i18n.js';

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

function getLikes() {
    const meta = readMeta();
    return meta.likes || 0;
}

function hasLiked() {
    const meta = readMeta();
    return !!meta.hasLiked;
}

function likeOnce() {
    const meta = readMeta();
    if (meta.hasLiked) return meta.likes || 0;
    const likes = (meta.likes || 0) + 1;
    const updated = writeMeta({ likes, hasLiked: true });
    return updated.likes;
}

function markDocsSeen() {
    writeMeta({ hasSeenDocs: true });
}

if (!requireAuth()) throw new Error('Not authenticated');
renderSidebar('docs');
initMobileToggle();
applyTranslations();

// Mark documentation as seen for onboarding
markDocsSeen();

// Initialize like UI
const likeCountEl = document.getElementById('like-count');
const likeBtn = document.getElementById('like-button');

function updateLikeButtonState() {
    if (!likeBtn) return;
    if (hasLiked()) {
        likeBtn.disabled = true;
        likeBtn.textContent = t('docs.likeThanks');
    } else {
        likeBtn.textContent = t('docs.likeBtn');
    }
}

if (likeCountEl) {
    likeCountEl.textContent = String(getLikes());
}

if (likeBtn) {
    updateLikeButtonState();

    likeBtn.addEventListener('click', () => {
        const likes = likeOnce();
        if (likeCountEl) {
            likeCountEl.textContent = String(likes);
        }
        likeBtn.disabled = true;
        likeBtn.textContent = t('docs.likeThanks');
    });
}

window.addEventListener('lang-changed', () => {
    applyTranslations();
    updateLikeButtonState();
});
