import { requireAuth, renderSidebar, initMobileToggle } from './router.js';
import { t, applyTranslations } from './i18n.js';
import { getLikes, hasLiked, likeOnce, markDocsSeen } from './likes.js';

if (!requireAuth()) throw new Error('Not authenticated');
renderSidebar('docs');
initMobileToggle();
applyTranslations();

markDocsSeen();

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
