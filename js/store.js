// ═══════════════════════════════════════════════════════════════
//  Feature ROI Calculator — localStorage Data Store
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'roi_calculator';

function getStore() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : createDefaultStore();
    } catch {
        return createDefaultStore();
    }
}

function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('store-updated', { detail: store }));
}

function createDefaultStore() {
    const store = {
        user: null,
        organizations: [],
        currentOrgId: null,
        currentProjectId: null,
        projects: [],
        features: [],
        settings: {
            currency: 'USD',
            defaultHorizon: 12,
            discountRate: 0,
            scoreFormula: 'rice',
            scoreWeights: { reach: 1, impact: 1, confidence: 1, effort: 1 }
        },
        auditLog: []
    };
    saveStore(store);
    return store;
}

// ── User ──────────────────────────────────────────────────────
export function getUser() {
    return getStore().user;
}

export function setUser(user) {
    const store = getStore();
    store.user = user;
    saveStore(store);
}

export function logout() {
    const store = getStore();
    store.user = null;
    saveStore(store);
}

export function isLoggedIn() {
    return !!getStore().user;
}

// ── Organizations ─────────────────────────────────────────────
export function getOrganizations() {
    return getStore().organizations;
}

export function createOrganization(name) {
    const store = getStore();
    const org = {
        id: generateId(),
        name,
        plan: 'free',
        createdAt: new Date().toISOString()
    };
    store.organizations.push(org);
    if (!store.currentOrgId) store.currentOrgId = org.id;
    saveStore(store);
    return org;
}

export function getCurrentOrgId() {
    return getStore().currentOrgId;
}

export function setCurrentOrgId(orgId) {
    const store = getStore();
    store.currentOrgId = orgId;
    saveStore(store);
}

// ── Projects ──────────────────────────────────────────────────
export function getProjects() {
    const store = getStore();
    return store.projects.filter(p => p.orgId === store.currentOrgId);
}

export function createProject(name) {
    const store = getStore();
    const project = {
        id: generateId(),
        orgId: store.currentOrgId,
        name,
        createdAt: new Date().toISOString()
    };
    store.projects.push(project);
    if (!store.currentProjectId) store.currentProjectId = project.id;
    saveStore(store);
    return project;
}

export function getCurrentProjectId() {
    return getStore().currentProjectId;
}

export function setCurrentProjectId(projectId) {
    const store = getStore();
    store.currentProjectId = projectId;
    saveStore(store);
}

export function getCurrentProject() {
    const store = getStore();
    return store.projects.find(p => p.id === store.currentProjectId);
}

// ── Features ──────────────────────────────────────────────────
export function getFeatures() {
    const store = getStore();
    return store.features.filter(f => f.projectId === store.currentProjectId);
}

export function getFeatureById(id) {
    const store = getStore();
    return store.features.find(f => f.id === id);
}

export function createFeature(data) {
    const store = getStore();
    const feature = {
        id: generateId(),
        projectId: store.currentProjectId,
        name: data.name || 'Untitled Feature',
        stage: data.stage || 'draft',
        decision: data.decision || 'explore',
        ownerId: store.user?.email || 'unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        inputs: {
            // Context
            country: '',
            segment: '',
            usersExposed: 10000,
            baselineCR: 0.05,
            baselineAOV: 50,
            baselineARPU: 0,
            baselineRetention: 0,
            avgLifetimeMonths: 12,
            horizon: 12,
            // Expected effect
            crUplift: 0.02,
            crUpliftType: 'pp', // 'pp' or 'relative'
            aovUpliftPct: 0,
            retentionChangePct: 0,
            probability: 0.7,
            confidence: 5,
            evidenceLink: '',
            // Advanced
            marginPct: 1,
            discountRate: 0,
            cannibalizationPct: 0,
            riskAdjustment: 1,
            ...data.inputs
        },
        costs: {
            engineering: 0,
            design: 0,
            pm: 0,
            legal: 0,
            vendor: 0,
            infra: 0,
            support: 0,
            licensing: 0,
            effortSize: 'M',
            effortPoints: 0,
            opportunityCost: '',
            ...data.costs
        },
        scenarios: {
            pessimistic: { crUplift: 0.005, aovUpliftPct: 0, retentionChangePct: 0, probability: 0.3 },
            base: { crUplift: 0.02, aovUpliftPct: 0, retentionChangePct: 0, probability: 0.7 },
            optimistic: { crUplift: 0.05, aovUpliftPct: 0.1, retentionChangePct: 0.05, probability: 0.9 },
            ...data.scenarios
        },
        results: null,
        notes: data.notes || '',
        history: []
    };
    store.features.push(feature);
    addAuditLog(store, 'create', 'feature', feature.id, null, feature);
    saveStore(store);
    return feature;
}

export function updateFeature(id, updates) {
    const store = getStore();
    const idx = store.features.findIndex(f => f.id === id);
    if (idx === -1) return null;

    const before = { ...store.features[idx] };
    store.features[idx] = {
        ...store.features[idx],
        ...updates,
        updatedAt: new Date().toISOString()
    };

    // Save to history
    store.features[idx].history = store.features[idx].history || [];
    store.features[idx].history.unshift({
        timestamp: new Date().toISOString(),
        actor: store.user?.email || 'unknown',
        changes: Object.keys(updates).filter(k => k !== 'history' && k !== 'updatedAt')
    });

    // Keep last 50 history entries
    if (store.features[idx].history.length > 50) {
        store.features[idx].history = store.features[idx].history.slice(0, 50);
    }

    addAuditLog(store, 'update', 'feature', id, before, store.features[idx]);
    saveStore(store);
    return store.features[idx];
}

export function deleteFeature(id) {
    const store = getStore();
    const feature = store.features.find(f => f.id === id);
    store.features = store.features.filter(f => f.id !== id);
    if (feature) {
        addAuditLog(store, 'delete', 'feature', id, feature, null);
    }
    saveStore(store);
}

// ── Settings ──────────────────────────────────────────────────
export function getSettings() {
    return getStore().settings;
}

export function updateSettings(updates) {
    const store = getStore();
    store.settings = { ...store.settings, ...updates };
    saveStore(store);
    return store.settings;
}

// ── Audit Log ─────────────────────────────────────────────────
function addAuditLog(store, action, entity, entityId, before, after) {
    store.auditLog.unshift({
        id: generateId(),
        orgId: store.currentOrgId,
        actorId: store.user?.email || 'system',
        action,
        entity,
        entityId,
        before: before ? JSON.stringify(before).substring(0, 500) : null,
        after: after ? JSON.stringify(after).substring(0, 500) : null,
        timestamp: new Date().toISOString()
    });
    // Keep last 200 entries
    if (store.auditLog.length > 200) {
        store.auditLog = store.auditLog.slice(0, 200);
    }
}

export function getAuditLog(featureId) {
    const store = getStore();
    if (featureId) {
        return store.auditLog.filter(l => l.entityId === featureId);
    }
    return store.auditLog.filter(l => l.orgId === store.currentOrgId);
}

// ── Helpers ───────────────────────────────────────────────────
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export function formatCurrency(value, currency = 'USD') {
    if (value === Infinity || value === -Infinity) return '∞';
    if (isNaN(value)) return '$0';

    const symbols = { USD: '$', EUR: '€', GBP: '£', RUB: '₽', KGS: 'сом' };
    const sym = symbols[currency] || '$';

    const absVal = Math.abs(value);
    let formatted;
    if (absVal >= 1_000_000) {
        formatted = (value / 1_000_000).toFixed(1) + 'M';
    } else if (absVal >= 1_000) {
        formatted = (value / 1_000).toFixed(1) + 'K';
    } else {
        formatted = value.toFixed(0);
    }

    return `${sym}${formatted}`;
}

export function formatPercent(value) {
    if (value === Infinity || value === -Infinity) return '∞%';
    if (isNaN(value)) return '0%';
    return value.toFixed(1) + '%';
}

export function formatMonths(months) {
    if (months === Infinity) return '∞';
    if (isNaN(months)) return 'N/A';
    if (months < 1) return (months * 30).toFixed(0) + ' days';
    return months.toFixed(1) + ' mo';
}

export function formatNumber(value) {
    if (isNaN(value)) return '0';
    return new Intl.NumberFormat().format(Math.round(value));
}

// ── Init Default Data ─────────────────────────────────────────
export function ensureDefaultData() {
    const store = getStore();
    if (store.user && store.organizations.length === 0) {
        const org = createOrganization(store.user.name + "'s Org");
        setCurrentOrgId(org.id);
        const project = createProject('My First Project');
        setCurrentProjectId(project.id);
        // Seed demo features so Dashboard is not empty on first load
        createFeature({
            name: 'Improve onboarding conversion',
            stage: 'analysis',
            decision: 'explore',
            inputs: {
                country: 'Global',
                segment: 'New signups',
                usersExposed: 50000,
                baselineCR: 0.08,
                baselineAOV: 60,
                avgLifetimeMonths: 12,
                horizon: 12,
                crUplift: 0.02,
                crUpliftType: 'pp',
                aovUpliftPct: 0.05,
                retentionChangePct: 0,
                probability: 0.7,
                confidence: 7,
                marginPct: 0.8,
                discountRate: 0.1,
                riskAdjustment: 1
            },
            costs: {
                engineering: 8000,
                design: 3000,
                pm: 2000,
                infra: 1000,
                effortSize: 'M',
                effortPoints: 8
            },
            notes: 'Example feature: optimize onboarding funnel to reduce drop-off on step 2.'
        });

        createFeature({
            name: 'Launch premium subscription tier',
            stage: 'approved',
            decision: 'go',
            inputs: {
                country: 'Global',
                segment: 'Active users',
                usersExposed: 20000,
                baselineCR: 0.03,
                baselineAOV: 40,
                avgLifetimeMonths: 18,
                horizon: 24,
                crUplift: 0.01,
                crUpliftType: 'pp',
                aovUpliftPct: 0.25,
                retentionChangePct: 0.05,
                probability: 0.6,
                confidence: 6,
                marginPct: 0.7,
                discountRate: 0.12,
                cannibalizationPct: 0.1,
                riskAdjustment: 0.9
            },
            costs: {
                engineering: 20000,
                design: 7000,
                pm: 6000,
                marketing: 15000,
                support: 3000,
                infra: 4000,
                effortSize: 'L',
                effortPoints: 21
            },
            notes: 'Example feature: new premium plan with higher ARPU and slightly better retention.'
        });
    }
}
