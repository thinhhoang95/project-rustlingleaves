/** @type {import('next').NextConfig} */
const scenarioApiBaseUrl = process.env.SCENARIO_API_BASE_URL ?? "http://127.0.0.1:8000";

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/departures",
        destination: `${scenarioApiBaseUrl}/departures`,
      },
      {
        source: "/arrivals",
        destination: `${scenarioApiBaseUrl}/arrivals`,
      },
      {
        source: "/tools/evals/feasibility",
        destination: `${scenarioApiBaseUrl}/tools/evals/feasibility`,
      },
      {
        source: "/tools/evals/conflicts",
        destination: `${scenarioApiBaseUrl}/tools/evals/conflicts`,
      },
      {
        source: "/tools/evals/runway-overlaps",
        destination: `${scenarioApiBaseUrl}/tools/evals/runway-overlaps`,
      },
    ];
  },
};

export default nextConfig;
