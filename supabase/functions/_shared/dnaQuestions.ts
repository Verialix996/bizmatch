import type { EvidenceDimension } from "./founderScoring.ts";

// 5 open-ended, behavioral/reflection questions per DNA dimension (40 total).
// Mirrored in frontend/src/config/dnaQuestions.js — keep both in sync; this
// copy is authoritative for scoring (dna-self-assessment validates the
// submitted questions against it), the frontend copy is what's rendered.
export const DNA_QUESTIONS: Record<EvidenceDimension, string[]> = {
  execution: [
    "Describe a project you shipped end-to-end. What was your role and what shipped?",
    "Tell us about a time you had to cut scope to hit a deadline. What did you cut and why?",
    "What's a goal you set for yourself in the last year, and how close did you get to it?",
    "Walk through how you prioritize your to-do list when everything feels urgent.",
    "Describe a time a plan you made didn't survive contact with reality. What did you do next?",
  ],
  integrity: [
    "Describe a time you made a mistake that affected someone else. How did you handle telling them?",
    "Tell us about a situation where being fully honest would have cost you something. What did you do?",
    "Have you ever caught yourself cutting an ethical corner under pressure? What happened?",
    "Describe a time you had to deliver bad news to a boss, teammate, or customer.",
    "What's a commitment you made that you later couldn't keep, and how did you handle it?",
  ],
  commitment: [
    "What's the longest you've stuck with something difficult before giving up or breaking through?",
    "Describe a time your motivation dropped mid-project. What kept you going, if anything?",
    "What have you sacrificed (time, money, relationships) to pursue something you cared about?",
    "Tell us about a commitment you walked away from. What led to that decision?",
    "How do you decide when to keep pushing on something versus cutting your losses?",
  ],
  communication: [
    "Describe a time you had to explain something technical or complex to someone non-technical.",
    "Tell us about a misunderstanding with a teammate or partner. How did it get resolved?",
    "How do you typically deliver critical feedback to someone you work closely with?",
    "Describe a time you realized you'd misread a situation because you didn't ask enough questions.",
    "What's your approach to keeping a team aligned when everyone's busy and distributed?",
  ],
  conflict: [
    "Describe your most significant disagreement with a co-founder, partner, or manager. How did it resolve?",
    "Tell us about a time you had to push back on someone more senior than you.",
    "How do you typically respond in the moment when someone is angry or upset with you?",
    "Describe a negotiation (formal or informal) that didn't go the way you wanted.",
    "What's a recurring type of conflict you find yourself in, and what pattern have you noticed in how you handle it?",
  ],
  resilience: [
    "Describe the biggest professional failure or setback you've experienced. What did you do in the weeks after?",
    "Tell us about a time everything seemed to go wrong at once. How did you cope?",
    "What's something you tried that didn't work, and what did you take away from it?",
    "Describe a period of sustained pressure or stress you went through. How did it change how you work?",
    "How do you typically recover after a rejection (investor, customer, job, etc.)?",
  ],
  ego: [
    "Describe a time someone gave you feedback that stung but turned out to be right.",
    "Tell us about a strongly-held opinion you changed your mind about, and what changed it.",
    "What's something you're currently bad at that you're actively working to improve?",
    "Describe a time you were wrong in front of other people. How did you handle it?",
    "How do you usually react in the moment when someone challenges an idea you're proud of?",
  ],
  values: [
    "What's a principle you won't compromise on, even if it costs you a deal or a hire?",
    "Describe a decision where doing the \"right thing\" and the \"profitable thing\" pointed in different directions.",
    "What kind of company culture would you refuse to work in, and why?",
    "Tell us about a time your personal values shaped a business decision.",
    "What do you want to be true about how you treated people, five years after this venture ends (win or lose)?",
  ],
};

export const DNA_DIMENSIONS = Object.keys(DNA_QUESTIONS) as EvidenceDimension[];
