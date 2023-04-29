module.exports = {
  future: {
  },
  content: [
    "./src/**/*.{html,js,ts}",
    "./node_modules/tw-elements/dist/js/**/*.js"
  ],
  theme: {
    extend: {},
  },
  variants: {},
  plugins: [
    require("tw-elements/dist/plugin.cjs")
  ],
  corePlugins: {
    preflight: false,
  }
}
