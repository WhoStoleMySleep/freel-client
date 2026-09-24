export default {
  '*.{ts,mjs,vue}': [
    'eslint --fix',
    'vitest related --run --passWithNoTests',
  ],
  // Cargo works on the crate, not on a file list, so these ignore the staged
  // paths — and only check, because a reformat here would land outside the
  // commit that triggered it.
  'src-tauri/**/*.rs': () => [
    'cargo fmt --manifest-path src-tauri/Cargo.toml --check',
    'cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings',
  ],
}
