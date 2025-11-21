# Publishing Guide for Opacus SDK

This guide explains how to publish the Opacus SDK packages to npm and crates.io.

## Prerequisites

### For TypeScript SDK (npm)

1. **Create npm account**: https://www.npmjs.com/signup
2. **Login to npm**:
   ```bash
   npm login
   ```
3. **Verify login**:
   ```bash
   npm whoami
   ```

### For Rust SDK (crates.io)

1. **Create crates.io account**: https://crates.io/
2. **Get API token**: https://crates.io/settings/tokens
3. **Login to cargo**:
   ```bash
   cargo login YOUR_API_TOKEN
   ```

## Publishing TypeScript SDK

### 1. Update Version (if needed)

Edit `opacus-sdk/package.json`:
```json
{
  "version": "1.0.1"  // Increment version
}
```

### 2. Build the Package

```bash
cd opacus-sdk
npm install
npm run build
```

### 3. Test the Build

```bash
npm test
```

### 4. Check Package Contents

```bash
npm pack --dry-run
```

This shows what files will be included in the package.

### 5. Publish to npm

```bash
# For scoped package (recommended)
npm publish --access public

# Or for first-time publish
npm publish --access public --otp=YOUR_2FA_CODE
```

### 6. Verify Publication

```bash
npm info @opacus/sdk
```

Visit: https://www.npmjs.com/package/@opacus/sdk

## Publishing Rust SDK

### 1. Update Version (if needed)

Edit `opacus-rust/Cargo.toml`:
```toml
[package]
version = "1.0.1"  # Increment version
```

### 2. Build and Test

```bash
cd opacus-rust
cargo build --release
cargo test
```

### 3. Check Package

```bash
cargo package --list
```

This shows what files will be included.

### 4. Dry Run

```bash
cargo publish --dry-run
```

This verifies everything without actually publishing.

### 5. Publish to crates.io

```bash
cargo publish
```

### 6. Verify Publication

Visit: https://crates.io/crates/opacus-sdk

## Version Management

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features, backwards compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, backwards compatible

## Pre-release Versions

### npm (TypeScript)

```bash
# Beta release
npm version 1.1.0-beta.1
npm publish --tag beta

# Install with:
# npm install @opacus/sdk@beta
```

### crates.io (Rust)

```toml
[package]
version = "1.1.0-beta.1"
```

```bash
cargo publish
```

## Automated Publishing with GitHub Actions

Create `.github/workflows/publish.yml`:

```yaml
name: Publish Packages

on:
  release:
    types: [published]

jobs:
  publish-npm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      
      - name: Install and Build
        run: |
          cd opacus-sdk
          npm install
          npm run build
      
      - name: Publish to npm
        run: |
          cd opacus-sdk
          npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  publish-crates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      
      - name: Publish to crates.io
        run: |
          cd opacus-rust
          cargo publish --token ${{ secrets.CARGO_TOKEN }}
```

## Setting up Secrets

1. **GitHub Settings** → **Secrets and variables** → **Actions**
2. Add secrets:
   - `NPM_TOKEN`: Your npm access token
   - `CARGO_TOKEN`: Your crates.io API token

## Manual Publishing Steps

### Every Release:

1. **Update CHANGELOG.md** with new features/fixes
2. **Update version** in package.json/Cargo.toml
3. **Update README.md** if needed
4. **Run tests** to ensure everything works
5. **Build packages** (npm run build / cargo build)
6. **Git commit and tag**:
   ```bash
   git add .
   git commit -m "Release v1.0.1"
   git tag v1.0.1
   git push origin main --tags
   ```
7. **Publish to registries**
8. **Create GitHub Release** with release notes

## Troubleshooting

### npm publish fails with 403

- Check you're logged in: `npm whoami`
- Verify package name is available: `npm info @opacus/sdk`
- Make sure `--access public` is used for scoped packages

### cargo publish fails

- Check package name availability on crates.io
- Verify all dependencies are published on crates.io
- Check Cargo.toml has required fields (license, description, etc.)

### Version already exists

- Increment version number
- Use pre-release version (e.g., 1.0.1-rc.1)

## Unpublishing (Emergency Only)

### npm

```bash
# Within 72 hours only
npm unpublish @opacus/sdk@1.0.0
```

### crates.io

Packages cannot be deleted, only yanked:
```bash
cargo yank --vers 1.0.0 opacus-sdk
```

## Testing After Publication

### TypeScript SDK

```bash
# Create test project
mkdir test-opacus
cd test-opacus
npm init -y
npm install @opacus/sdk

# Create test.js
cat > test.js << 'EOF'
const { OpacusClient } = require('@opacus/sdk');
console.log('Opacus SDK imported successfully!');
EOF

node test.js
```

### Rust SDK

```bash
# Create test project
cargo new test-opacus
cd test-opacus

# Add to Cargo.toml
echo 'opacus-sdk = "1.0"' >> Cargo.toml

# Create src/main.rs
cat > src/main.rs << 'EOF'
use opacus_sdk::*;
fn main() {
    println!("Opacus SDK imported successfully!");
}
EOF

cargo run
```

## Support

For issues with publishing:

- **npm**: https://docs.npmjs.com/
- **crates.io**: https://doc.rust-lang.org/cargo/reference/publishing.html
- **GitHub Issues**: https://github.com/Opacus-xyz/Opacus/issues

---

**Important**: Never commit API tokens or credentials to git!
