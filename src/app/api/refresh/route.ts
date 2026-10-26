// Déclenche et suit le workflow GitHub Actions qui actualise public/data/dashboard.json.
// Variables d'environnement (Vercel) : GITHUB_TOKEN (jeton à droits « Actions: write » sur le dépôt),
// GITHUB_REPOSITORY (« owner/repo »), GITHUB_BRANCH (facultatif, « main » par défaut).

const WORKFLOW = "refresh-data.yml";
const MIN_INTERVAL_MS = 10 * 60 * 1000;

type Run = { status: string; conclusion: string | null; created_at: string; html_url: string };

function config() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return null;
  return { token, repo, branch: process.env.GITHUB_BRANCH ?? "main" };
}

async function github(path: string, token: string, init?: RequestInit) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
}

async function latestRun(repo: string, token: string): Promise<Run | null> {
  const res = await github(`/repos/${repo}/actions/workflows/${WORKFLOW}/runs?per_page=1`, token);
  if (!res.ok) return null;
  const body = (await res.json()) as { workflow_runs: Run[] };
  return body.workflow_runs[0] ?? null;
}

export async function GET() {
  const cfg = config();
  if (!cfg) return Response.json({ configured: false });
  return Response.json({ configured: true, run: await latestRun(cfg.repo, cfg.token) });
}

export async function POST() {
  const cfg = config();
  if (!cfg) {
    return Response.json({ error: "Actualisation non configurée (GITHUB_TOKEN, GITHUB_REPOSITORY)." }, { status: 503 });
  }
  // Le bouton est public : on refuse les déclenchements en rafale.
  const last = await latestRun(cfg.repo, cfg.token);
  if (last && (last.status !== "completed" || Date.now() - Date.parse(last.created_at) < MIN_INTERVAL_MS)) {
    return Response.json({ error: "Une actualisation est en cours ou vient d'avoir lieu.", run: last }, { status: 429 });
  }
  const res = await github(`/repos/${cfg.repo}/actions/workflows/${WORKFLOW}/dispatches`, cfg.token, {
    method: "POST",
    body: JSON.stringify({ ref: cfg.branch }),
  });
  if (!res.ok) {
    return Response.json({ error: `GitHub a refusé le déclenchement (${res.status}).` }, { status: 502 });
  }
  return Response.json({ started: true }, { status: 202 });
}
