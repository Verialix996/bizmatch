// Per-screen guide content for the "?" help button in AppShell. Keyed by
// route name (see AppNavigator.js's Stack.Screen names). A handful of routes
// are shared between AdminNavigator and FounderNavigator and behave
// differently per role — those entries are { admin: {...}, founder: {...} }
// instead of a flat { title, intro, steps }.

const CONTENT = {
  // ── Admin-only ──────────────────────────────────────────────────────
  AdminDashboard: {
    title: 'Dashboard',
    intro: 'Your cohort at a glance: how many founders are active, how much evaluation work is done, and what still needs attention.',
    steps: [
      'The top banner shows your active program — if it says "No Active Program," no program is currently marked active.',
      'The four stat tiles: Active Founders, Evaluations Done, Missing Info (founders who haven’t finished onboarding), and Teams Created.',
      'Quick Actions jump straight into the most common tasks: View Founders, Add Evaluation, Go to Matching, Create Activity, Create Team.',
      '"Needs Attention" lists founders with an incomplete profile — tap one to jump to their profile.',
      '"Recent Activity" shows the latest evaluations submitted across the cohort.',
    ],
  },
  FounderList: {
    title: 'Founders',
    intro: 'Every founder in your cohort, with quick access to their profile and a shortcut to start a new interview.',
    steps: [
      'Search by name using the box at the top.',
      'Each row shows team status (In Team / Looking for Team) and, if applicable, an "Incomplete Profile" flag.',
      'Tap a founder to open their full profile — basics, evidence, DNA scores, matches, and team.',
      '"New Interview" starts a dimension-mapping interview — pick an existing founder or add someone not registered yet.',
    ],
  },
  Evaluation: {
    title: 'Evaluator Assessment',
    intro: 'A short structured assessment you submit about a founder — feeds into their scored evidence.',
    steps: [
      'Rate each question (scale or yes/no) based on what you’ve directly observed.',
      'Add notes for context — these are stored alongside the assessment.',
      'Submitting scores the answered questions into that founder’s evidence at full weight, which then factors into their dimension scores and match compatibility.',
    ],
  },
  NewInterview: {
    title: 'New Interview',
    intro: 'Start a structured, dimension-mapping interview for a founder already in the program (or one who hasn’t registered yet).',
    steps: [
      '"Existing Founder": search and pick someone from your cohort — their venture field/name pre-fill automatically if already on file.',
      '"New Candidate": add someone not registered yet (name + email required) — creates a prospect account you can attach the interview to.',
      'Fill in the venture field (required) and venture name (optional) for context.',
      '"Start Interview" opens the full question runner — you’ll walk through context questions plus behavioral recall + rating questions for each of the 8 dimensions.',
    ],
  },
  InterviewRunner: {
    title: 'Interview Runner',
    intro: 'The live interview, one question at a time — recall questions ground each dimension’s rating in a concrete example.',
    steps: [
      'Answer each question as the founder responds; use Skip if they don’t have an answer.',
      'The 1-5 scale ratings after each dimension’s recall questions are what actually gets scored into evidence — the recall questions themselves are for context, not scored directly.',
      'You can go back to revisit an earlier answer.',
      '"Finish" completes the interview and scores every answered rating question into the founder’s evidence. This can’t be undone from here — a completed interview can’t be deleted.',
      'If you need to stop partway through, just leave — an in-progress interview is saved and can be resumed or deleted later from the founder’s profile.',
    ],
  },
  Matching: {
    title: 'Matching',
    intro: 'Cohort-wide ranked list of founder pairs by compatibility score — the starting point for forming a team.',
    steps: [
      'Each card shows why the pair matches (complementary strengths) and any friction risk.',
      'Pairs where either founder has a stated deal breaker are flagged "Needs review" — check those before acting on them.',
      '"Create Team" jumps to Team Creation with both founders pre-selected.',
      '"View Match" opens the full pairwise breakdown, including per-dimension comparison.',
      'Founders already on a team don’t appear here, since the whole point of this list is forming new teams.',
    ],
  },
  MatchDetail: {
    title: 'Match Detail',
    intro: 'The full compatibility breakdown between two specific founders.',
    steps: [
      'See the overall score, positives, and risks driving the match.',
      'Per-dimension comparison shows where the two founders align or diverge.',
      '"Create Team" turns this pair directly into a new team.',
    ],
  },
  TeamCreation: {
    title: 'Create Team',
    intro: 'Pick founders, name the team, and preview compatibility before committing.',
    steps: [
      'The founder picker only shows founders not already on a team — a founder can only be on one team at a time.',
      'Select at least two founders — a live preview of strengths, complementary skills, and gaps updates as you pick.',
      'Give the team a name, then "Create Team" to finalize and jump to its profile.',
    ],
  },
  TeamList: {
    title: 'Teams',
    intro: 'Every team currently formed in the cohort.',
    steps: [
      'Tap a team to open its full profile.',
      '"Create Team" starts a new one from scratch.',
    ],
  },
  ComingSoon: {
    title: 'Coming Soon',
    intro: 'This part of the product isn’t built yet.',
    steps: ['Check back later, or ask about what’s planned for this area.'],
  },

  // ── Role-branched (shared between admin and founder navigators) ─────
  FounderProfile: {
    admin: {
      title: 'Founder Profile',
      intro: 'Everything known about this founder: basics, evidence, DNA dimension scores, matches, and team.',
      steps: [
        'Overview tab: role, venture, commitment, capabilities, partner requirements, and deal breakers.',
        'Evidence tab: every scored signal about this founder (self-assessment, interviews, evaluator assessments, peer feedback) and how it rolls up into their 8 dimension scores.',
        'Interviews: start a new one, or delete one that’s still in progress (completed interviews can’t be deleted since their evidence is already scored).',
        'Matches tab: this founder’s top compatibility pairs, same data source as the Matching screen.',
        'If assigned, their team is shown here too — jump straight to the team profile.',
      ],
    },
    founder: {
      title: 'Your Profile',
      intro: 'How your program admin and the matching engine see you — plus your own view of your evidence and matches.',
      steps: [
        'Edit Profile to update your basics, capabilities, partner requirements, deal breakers, or upload your CV.',
        'Fill in your Founder DNA self-assessment if you haven’t yet — it feeds into your dimension scores alongside evaluator input.',
        'Matches tab: your own suggested matches — select two to compare them against each other from your perspective.',
        'If you’re on a team, it’s shown here with your teammates and how you complement each other.',
      ],
    },
  },
  Activities: {
    admin: {
      title: 'Activities',
      intro: 'Workshops, hackathons, and other cohort activities — create them and manage who’s in them.',
      steps: [
        'See every activity, with its status (upcoming, active, or completed) derived automatically from its date range.',
        '"Create Activity" opens the new-activity form — type, title, description, and a date range.',
        'Open an activity to approve/reject registration requests, edit its dates, or view its participants and any peer feedback submitted.',
      ],
    },
    founder: {
      title: 'Activities',
      intro: 'Sign up for open activities and track the ones you’re part of.',
      steps: [
        '"Upcoming" shows activities open for registration — request to join one, then wait for admin approval.',
        '"Active" shows activities you’re approved for that are currently running or completed — open one to see full details.',
        'If you attended an activity with other founders, you can leave peer feedback about them there.',
      ],
    },
  },
  ActivityDetail: {
    admin: {
      title: 'Activity Detail',
      intro: 'Manage this activity’s participants and see what evidence has come out of it.',
      steps: [
        'Approve or reject pending registration requests.',
        '"Edit dates" changes the date range — status (upcoming/active/completed) recalculates automatically from it.',
        '"Manage" lets you set the full participant roster directly.',
        'For a completed activity, any peer feedback participants gave each other is shown here.',
        '"Evaluate" next to a participant opens the evaluator assessment form for them.',
      ],
    },
    founder: {
      title: 'Activity Detail',
      intro: 'Full details on this activity, and — if you attended it with others — a place to give peer feedback.',
      steps: [
        'If it’s upcoming and open, "Sign Up" submits a registration request for admin approval.',
        'If you’re approved and it included other founders, you can rate them on a specific dimension with an optional note — this feeds into their evidence.',
      ],
    },
  },
  TeamProfile: {
    admin: {
      title: 'Team Profile',
      intro: 'How this team stacks up together: strengths, gaps, and friction risk.',
      steps: [
        'Strengths and complementary skills are computed from members’ combined capabilities.',
        'Capability gaps show what nobody on the team currently provides.',
        'Friction is pulled from each pair’s already-computed compatibility, not recalculated from scratch.',
        'Team activities scoped to this team (if any) are listed here too.',
      ],
    },
    founder: {
      title: 'Your Team',
      intro: 'How you and your teammates complement each other.',
      steps: [
        'See your team’s combined strengths, complementary skills, and any capability gaps.',
        'Any activities scoped specifically to your team appear here.',
      ],
    },
  },
  EditFounderProfile: {
    admin: {
      title: 'Edit Founder Profile',
      intro: 'Editing this founder’s profile on their behalf.',
      steps: [
        'Update their basics, commitment, capabilities (ranked by priority), partner requirements, and deal breakers.',
        'Upload or replace their CV here too.',
        'Changes save immediately when you tap "Save Changes" — nothing here affects their scored evidence.',
      ],
    },
    founder: {
      title: 'Edit Profile',
      intro: 'Update anything you entered during registration — this isn’t a one-time form.',
      steps: [
        'Basics, commitment, and your provide/need capabilities — reorder capabilities using the arrows to rank them by priority.',
        'Partner requirements: what you need from a co-founder, plus preferred traits.',
        'Deal breakers: quick-add common ones or type your own.',
        'Upload or replace your CV (PDF) here too.',
        '"Save Changes" applies everything at once.',
      ],
    },
  },
  AccountSettings: {
    admin: {
      title: 'Account Settings',
      intro: 'Your own account — separate from any founder profile data.',
      steps: [
        'Change your display name or profile photo.',
        'Toggle dark mode.',
        'Log out, or permanently delete your account from the Danger Zone.',
      ],
    },
    founder: {
      title: 'Account Settings',
      intro: 'Account-level details only — your name and photo. Your founder profile (role, capabilities, partner requirements) lives in Edit Profile instead.',
      steps: [
        'Change your display name or profile photo.',
        'Toggle dark mode.',
        'Log out, or permanently delete your account from the Danger Zone — this erases your profile, matches, and evidence too.',
      ],
    },
  },
};

export function getHelpContent(routeName, role) {
  const entry = CONTENT[routeName];
  if (!entry) return null;
  if (entry.admin || entry.founder) {
    return (role === 'admin' ? entry.admin : entry.founder) || null;
  }
  return entry;
}
