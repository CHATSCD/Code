import nextConfig from 'eslint-config-next';

const config = [
  ...nextConfig,
  {
    ignores: ['.next/**', 'node_modules/**', 'data/**'],
  },
  {
    rules: {
      // Fetch-on-mount + setState is the standard data-loading pattern used
      // throughout this app's client components; this rule's heuristics
      // misfire on that pattern (including for synchronous resets like
      // `setMessages([])` when a dependency changes).
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default config;
