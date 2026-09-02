/** Credits one Pro generation costs. */
const GENERATION_COST = 10;

/** Amounts are in the smallest currency unit, as Stripe wants them. */
const PACKS = [
    { id: 'starter', name: 'Starter', credits: 50, amount: 500, currency: 'usd' },
    { id: 'standard', name: 'Standard', credits: 120, amount: 1000, currency: 'usd' },
    { id: 'studio', name: 'Studio', credits: 300, amount: 2000, currency: 'usd' },
];

function findPack(id) {
    return PACKS.find(pack => pack.id === id);
}

module.exports = { GENERATION_COST, PACKS, findPack };
