/**
 * data.js
 * Default budget categories for the Wedding Budget Planner.
 * Each category: id, name, description, min, max, actual, notes.
 * "actual" starts equal to the midpoint estimate until the user edits it.
 */

function midpoint(min, max) {
  return Math.round((min + max) / 2);
}

const DEFAULT_CATEGORIES = [
  {
    id: 'marriage-reception',
    name: 'Marriage & Reception',
    description: 'Venue, catering, decor and staging for the main ceremony and reception.',
    min: 500000,
    max: 600000,
    notes: ''
  },
  {
    id: 'invitation-cards',
    name: 'Wedding Invitation Cards',
    description: 'Design, printing and delivery of invitation cards and inserts.',
    min: 20000,
    max: 25000,
    notes: ''
  },
  {
    id: 'room-renovation',
    name: 'Room Renovation',
    description: 'Touch-ups, painting and furnishing ahead of the wedding.',
    min: 80000,
    max: 100000,
    notes: ''
  },
  {
    id: 'mehendi-function',
    name: 'Mehendi Function',
    description: 'Food (₹1,25,000–1,40,000), beverages (₹44,400–48,000) and lighting (₹1,00,000) for the Mehendi evening.',
    min: 279400,
    max: 300000,
    notes: 'Breakdown: Food, Beer, Whisky, Ice & soft drinks, Lighting.'
  },
  {
    id: 'shopping',
    name: 'Shopping',
    description: 'Outfits, jewellery and accessories for the couple and family.',
    min: 300000,
    max: 400000,
    notes: ''
  },
  {
    id: 'bridal-makeup',
    name: 'Bridal Makeup & Groom Styling',
    description: 'Hair, makeup and styling for the bride and groom.',
    min: 10000,
    max: 15000,
    notes: ''
  },
  {
    id: 'guest-accommodation',
    name: 'Guest Accommodation',
    description: 'Rooms and stay arrangements for outstation guests.',
    min: 20000,
    max: 30000,
    notes: ''
  },
  {
    id: 'transportation',
    name: 'Transportation',
    description: 'Cars and transfers for family, guests and the couple.',
    min: 20000,
    max: 20000,
    notes: ''
  },
  {
    id: 'miscellaneous',
    name: 'Miscellaneous Expenses',
    description: 'Contingency for anything not covered above.',
    min: 100000,
    max: 100000,
    notes: ''
  }
];

// Seed "actual" as the midpoint of min/max by default.
DEFAULT_CATEGORIES.forEach(function (cat) {
  cat.actual = midpoint(cat.min, cat.max);
});

function getDefaultState() {
  // Deep copy so mutations never touch the original defaults.
  return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
}
