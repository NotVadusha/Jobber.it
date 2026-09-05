import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

export default defineRailway((ctx) => {
  const JobberIt = github("NotVadusha/Jobber.it", { checkSuites: false });

  const Postgres = postgres("Postgres", { region: "europe-west4-drams3a" });
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "europe-west4-drams3a", sizeMB: 5000 });
  
  const GatherCron = service("GatherCron", {
    source: JobberIt,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "/apps/cron/Dockerfile", watchPatterns: ["/apps/cron/**", "/apps/backend/**"] },
    replicas: { "europe-west4-drams3a": 1 },
    deploy: { cronSchedule: "0 3 * * *", restartPolicyType: "NEVER" },
    networking: { privateNetworkEndpoint: "gathercron" },
    env: { APIFY_TOKEN: ctx.shared.APIFY_TOKEN, DATABASE_URL: Postgres.env.DATABASE_URL, OPENAI_API_KEY: ctx.shared.OPENAI_API_KEY, PINECONE_API_KEY: ctx.shared.PINECONE_API_KEY },
  });

  const API = service("API", {
    source: JobberIt,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "apps/backend/Dockerfile", watchPatterns: ["/apps/backend/**"] },
    // Schema first, then the code that needs it: a failed migration fails the
    // deploy and the previous version keeps serving.
    preDeploy: "alembic upgrade head",
    replicas: { "europe-west4-drams3a": 1 },
    networking: { privateNetworkEndpoint: "api" },
    env: { DATABASE_URL: Postgres.env.DATABASE_URL, OPENAI_API_KEY: ctx.shared.OPENAI_API_KEY, PINECONE_API_KEY: ctx.shared.PINECONE_API_KEY, PORT: preserve() },
  });

  const PruneCron = service("PruneCron", {
    source: JobberIt,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "/apps/cron/Dockerfile", watchPatterns: ["/apps/cron/**", "/apps/backend/**"] },
    start: "python -m jobber_cron.prune",
    replicas: { "europe-west4-drams3a": 1 },
    deploy: { cronSchedule: "0 5 * * *", restartPolicyType: "NEVER" },
    networking: { privateNetworkEndpoint: "caring-peace" },
    env: { DATABASE_URL: Postgres.env.DATABASE_URL, PINECONE_API_KEY: ctx.shared.PINECONE_API_KEY },
  });

  const Frontend = service("Frontend", {
    source: github("NotVadusha/Jobber.it", { checkSuites: false, rootDirectory: "/apps/frontend" }),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "/apps/frontend/Dockerfile", watchPatterns: ["/apps/frontend/**"] },
    replicas: { "europe-west4-drams3a": 1 },
    networking: { privateNetworkEndpoint: "frontend" },
    env: { API_URL: preserve() },
  });

  const MCP = service("MCP", {
    source: JobberIt,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "/apps/mcp/Dockerfile", watchPatterns: ["/apps/mcp/**", "/apps/backend/**"] },
    replicas: { "europe-west4-drams3a": 1 },
    networking: { privateNetworkEndpoint: "mcp" },
    env: { DATABASE_URL: Postgres.env.DATABASE_URL, PINECONE_API_KEY: ctx.shared.PINECONE_API_KEY },
  });

  return project("jobber.it", {
    resources: [GatherCron, API, Postgres, PruneCron, Frontend, MCP, postgresVolume],
  });
});
