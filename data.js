/**
 * data.js
 * Default budget categories for the Wedding Budget Planner.
 * Each category: id, name, description, min, max, actual, notes,
 *   paid, contributor, vendor { name, phone, email, status }, receipt (base64).
 *
 * Also exports default milestones, contributors, and wedding date helpers.
 */

function midpoint(min, max) {
  return Math.round((min + max) / 2);
}

var DEFAULT_CONTRIBUTORS = [
  "Bride's Family",
  "Groom's Family",
  "Couple",
  "Others"
];

var DEFAULT_MILESTONES = [
  { id: 'ms-venue',      label: 'Book venue & caterer',    done: false, categoryId: 'marriage-reception' },
  { id: 'ms-invites',    label: 'Send invitations',        done: false, categoryId: 'invitation-cards'   },
  { id: 'ms-shopping',   label: 'Complete shopping',       done: false, categoryId: 'shopping'           },
  { id: 'ms-mehendi',    label: 'Finalize Mehendi evening', done: false, categoryId: 'mehendi-function'  },
  { id: 'ms-makeup',     label: 'Book makeup artist',      done: false, categoryId: 'bridal-makeup'     },
  { id: 'ms-rooms',      label: 'Arrange guest rooms',     done: false, categoryId: 'guest-accommodation'},
  { id: 'ms-transport',  label: 'Confirm transportation',  done: false, categoryId: 'transportation'    },
  { id: 'ms-fittings',   label: 'Final outfit fittings',   done: false, categoryId: 'shopping'          },
  { id: 'ms-final',      label: 'Final walkthrough',       done: false, categoryId: null                }
];

var DEFAULT_CATEGORIES = [
  {
    id: 'marriage-reception',
    name: 'Marriage & Reception',
    description: 'Venue, catering, decor and staging for the main ceremony and reception.',
    min: 500000,
    max: 600000,
    notes: '',
    paid: 0,
    contributor: '',
    vendor: { name: '', phone: '', email: '', status: 'shortlisted' },
    receipt: ''
  },
  {
    id: 'invitation-cards',
    name: 'Wedding Invitation Cards',
    description: 'Design, printing and delivery of invitation cards and inserts.',
    min: 20000,
    max: 25000,
    notes: '',
    paid: 0,
    contributor: '',
    vendor: { name: '', phone: '', email: '', status: 'shortlisted' },
    receipt: ''
  },
  {
    id: 'room-renovation',
    name: 'Room Renovation',
    description: 'Touch-ups, painting and furnishing ahead of the wedding.',
    min: 80000,
    max: 100000,
    notes: '',
    paid: 0,
    contributor: '',
    vendor: { name: '', phone: '', email: '', status: 'shortlisted' },
    receipt: ''
  },
  {
    id: 'mehendi-function',
    name: 'Mehendi Function',
    description: 'Food, beverages and lighting for the Mehendi evening.',
    min: 279400,
    max: 300000,
    notes: 'Breakdown: Food, Beer, Whisky, Ice & soft drinks, Lighting.',
    paid: 0,
    contributor: '',
    vendor: { name: '', phone: '', email: '', status: 'shortlisted' },
    receipt: ''
  },
  {
    id: 'shopping',
    name: 'Shopping',
    description: 'Outfits, jewellery and accessories for the couple and family.',
    min: 300000,
    max: 400000,
    notes: '',
    paid: 0,
    contributor: '',
    vendor: { name: '', phone: '', email: '', status: 'shortlisted' },
    receipt: ''
  },
  {
    id: 'bridal-makeup',
    name: 'Bridal Makeup & Groom Styling',
    description: 'Hair, makeup and styling for the bride and groom.',
    min: 10000,
    max: 15000,
    notes: '',
    paid: 0,
    contributor: '',
    vendor: { name: '', phone: '', email: '', status: 'shortlisted' },
    receipt: ''
  },
  {
    id: 'guest-accommodation',
    name: 'Guest Accommodation',
    description: 'Rooms and stay arrangements for outstation guests.',
    min: 20000,
    max: 30000,
    notes: '',
    paid: 0,
    contributor: '',
    vendor: { name: '', phone: '', email: '', status: 'shortlisted' },
    receipt: ''
  },
  {
    id: 'transportation',
    name: 'Transportation',
    description: 'Cars and transfers for family, guests and the couple.',
    min: 20000,
    max: 20000,
    notes: '',
    paid: 0,
    contributor: '',
    vendor: { name: '', phone: '', email: '', status: 'shortlisted' },
    receipt: ''
  },
  {
    id: 'miscellaneous',
    name: 'Miscellaneous Expenses',
    description: 'Contingency for anything not covered above.',
    min: 100000,
    max: 100000,
    notes: '',
    paid: 0,
    contributor: '',
    vendor: { name: '', phone: '', email: '', status: 'shortlisted' },
    receipt: ''
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

function getDefaultMilestones() {
  return JSON.parse(JSON.stringify(DEFAULT_MILESTONES));
}

function getDefaultContributors() {
  return DEFAULT_CONTRIBUTORS.slice();
}
