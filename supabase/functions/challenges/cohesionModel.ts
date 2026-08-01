import { query } from "../_shared/db.ts";
import { generateText, isGeminiConfigured } from "../_shared/gemini.ts";

// Auto-generates a private "cohesion test" challenge for a team the moment it
// reaches 2 accepted members. Completing it (see challengeModel.ts's
// hasCompletedCohesionTest) gates applying to any real investor hackathon.
export async function generateCohesionChallenge(teamId: string): Promise<void> {
  const members = await query<{ name: string; skills: unknown }>(
    `SELECT u.name, u.skills FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = $1 AND tm.status = 'accepted'`,
    [teamId],
  );
  if (members.length < 2) return;

  const roster = members
    .map((m) => `- ${m.name}: ${(Array.isArray(m.skills) ? m.skills : []).join(", ") || "no listed skills"}`)
    .join("\n");

  const prompt = `You are designing a short team-cohesion exercise for a newly formed startup team.
Team members and their skills:
${roster}

Write a single practical scenario (3-5 sentences) this team must solve together
that requires combining their listed skills, plus 2-3 guiding questions they
should address in their written response. Return ONLY the exercise text, no preamble.`;

  let description: string;
  if (isGeminiConfigured()) {
    try {
      description = await generateText(prompt);
    } catch {
      description = defaultCohesionPrompt();
    }
  } else {
    description = defaultCohesionPrompt();
  }

  const rows = await query<{ id: number }>(
    `INSERT INTO challenges (investor_id, type, team_id, title, description, submission_deadline, status)
     VALUES (NULL, 'cohesion_test', $1, 'Team Cohesion Challenge', $2, now() + interval '7 days', 'open')
     RETURNING id`,
    [teamId, description],
  );
  const challengeId = rows[0].id;

  await query(
    `INSERT INTO challenge_signups (challenge_id, team_id, status) VALUES ($1, $2, 'signed_up')`,
    [challengeId, teamId],
  );

  return;
}

function defaultCohesionPrompt(): string {
  return "Describe how your team would divide responsibilities to launch a small pilot version of your idea in two weeks, given each member's listed skills. Address: (1) who owns which part, (2) how you'll coordinate daily, (3) what could cause friction and how you'd resolve it.";
}

export async function reviewCohesionSubmission(challengeText: string, teamResponse: string) {
  const prompt = `You are evaluating a startup team's written response to a team-cohesion exercise.

Exercise given to the team:
${challengeText}

Team's written response:
${teamResponse}

Assess how well this response demonstrates clear role division, communication planning, and conflict-awareness. Respond ONLY with valid JSON, no markdown:
{"feedback":"2-4 sentences of specific, constructive critique","cohesionScore":<0-100>}`;

  const raw = await generateText(prompt);
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}
