module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'google',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended', // Need to be last
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname, // Required for correct resolution of tsconfig.json
    sourceType: 'module',
  },
  ignorePatterns: [
    '/lib/**/*', // Ignore built files.
    '/generated/**/*', // Ignore generated files.
    './prettier.config.js',
  ],
  overrides: [
    {
      files: ['.eslintrc.js', 'prettier.config.js'],
      parser: 'espree', // Use the default JavaScript parser
      rules: {
        // Add rules specific to JavaScript files if necessary
      },
    },
  ],
  plugins: ['@typescript-eslint', 'import', '@stylistic/js'],
  rules: {
    quotes: ['error', 'single'],
    'import/no-unresolved': 0,
    '@stylistic/js/indent': ['error', 2],
    '@stylistic/js/object-curly-spacing': ['error', 'always'],
  },
};
