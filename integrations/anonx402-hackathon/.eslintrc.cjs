module.exports = {
  env: {
    es2021: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  extends: ["eslint:recommended", "plugin:import/recommended", "prettier"],
  rules: {
    "import/no-unresolved": "off"
  }
};
