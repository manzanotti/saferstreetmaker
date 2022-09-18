module.exports = {
  future: {
    // removeDeprecatedGapUtilities: true,
    // purgeLayersByDefault: true,
  },
  purge: [
    "./src/index.html"
  ],
  content: [
    "./src/**/*.{html,js,ts}"
  ],
  theme: {
    extend: {},
  },
  variants: {},
  plugins: [],
}
