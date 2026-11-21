import { Quote } from "../types";

const daysFromToday = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const isoFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

export const createDemoQuotes = (): Quote[] => [
  {
    id: "quote-aurelia",
    number: "QF-2026-014",
    client: "Aurelia Retail",
    contact: "Mariana Torres",
    owner: "Mohamed Ajmal",
    service: "Customer portal and reporting workspace",
    amount: 12800,
    currency: "USD",
    stage: "proposal",
    probability: 55,
    expectedCloseDate: daysFromToday(9),
    createdAt: isoFromNow(-11),
    updatedAt: isoFromNow(-1),
    lastActivityAt: isoFromNow(-1),
    nextAction: "Walk through the revised scope with operations.",
    tags: ["web", "dashboard", "priority"],
    health: "on-track",
    followUps: [
      {
        id: "follow-aurelia-1",
        type: "proposal-review",
        dueDate: daysFromToday(2),
        note: "Confirm reporting and approval requirements.",
        completed: false,
        createdAt: isoFromNow(-1)
      }
    ]
  },
  {
    id: "quote-nexo",
    number: "QF-2026-013",
    client: "Nexo Cargo",
    contact: "Raúl Medina",
    owner: "Mohamed Ajmal",
    service: "Operations API and mobile delivery tracking",
    amount: 22500,
    currency: "USD",
    stage: "negotiation",
    probability: 60,
    expectedCloseDate: daysFromToday(2),
    createdAt: isoFromNow(-19),
    updatedAt: isoFromNow(-4),
    lastActivityAt: isoFromNow(-4),
    nextAction: "Resolve scope question before commercial approval.",
    tags: ["api", "mobile", "at-risk"],
    health: "at-risk",
    followUps: [
      {
        id: "follow-nexo-1",
        type: "call",
        dueDate: daysFromToday(1),
        note: "Decision call with logistics lead.",
        completed: false,
        createdAt: isoFromNow(-4)
      }
    ]
  },
  {
    id: "quote-marea",
    number: "QF-2026-012",
    client: "Marea Labs",
    contact: "Inés Lozano",
    owner: "Lucía Ramos",
    service: "Discovery for an internal workflow platform",
    amount: 6400,
    currency: "USD",
    stage: "discovery",
    probability: 25,
    expectedCloseDate: daysFromToday(21),
    createdAt: isoFromNow(-3),
    updatedAt: isoFromNow(-1),
    lastActivityAt: isoFromNow(-1),
    nextAction: "Send discovery recap and technical approach.",
    tags: ["discovery", "workflow"],
    health: "on-track",
    followUps: [
      {
        id: "follow-marea-1",
        type: "email",
        dueDate: daysFromToday(3),
        note: "Share discovery recap with product sponsor.",
        completed: false,
        createdAt: isoFromNow(-1)
      }
    ]
  },
  {
    id: "quote-lumina",
    number: "QF-2026-011",
    client: "Lumina Health",
    contact: "Claudia Vega",
    owner: "Mohamed Ajmal",
    service: "Secure appointment and follow-up module",
    amount: 18000,
    currency: "USD",
    stage: "won",
    probability: 100,
    expectedCloseDate: daysFromToday(-2),
    createdAt: isoFromNow(-27),
    updatedAt: isoFromNow(-2),
    lastActivityAt: isoFromNow(-2),
    nextAction: "Prepare implementation kickoff notes.",
    tags: ["web", "health", "won"],
    health: "closed",
    followUps: []
  },
  {
    id: "quote-fenix",
    number: "QF-2026-010",
    client: "Fénix Advisory",
    contact: "Sergio Fuentes",
    owner: "Lucía Ramos",
    service: "Client intake and billing integration",
    amount: 9800,
    currency: "USD",
    stage: "proposal",
    probability: 45,
    expectedCloseDate: daysFromToday(14),
    createdAt: isoFromNow(-8),
    updatedAt: isoFromNow(-2),
    lastActivityAt: isoFromNow(-2),
    nextAction: "Send phased implementation option.",
    tags: ["integration", "billing"],
    health: "on-track",
    followUps: [
      {
        id: "follow-fenix-1",
        type: "email",
        dueDate: daysFromToday(4),
        note: "Send phase-one and phase-two pricing options.",
        completed: false,
        createdAt: isoFromNow(-2)
      }
    ]
  }
];
