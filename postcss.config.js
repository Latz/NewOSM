module.exports = {
  plugins: [
    require('postcss-nesting'),      // Enable CSS nesting (FIRST!)
    require('autoprefixer')({ grid: true })  // Vendor prefixes
  ]
};
