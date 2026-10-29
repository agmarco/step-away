/**
 * Expo fingerprint config (read by `@expo/fingerprint` from the project root).
 * package.json scripts aren't native code, so editing them must not change the
 * runtime fingerprint and force an EAS build. A `sourceSkips` here replaces the
 * preset's, so the default ("balanced") skips are listed too.
 * @type {import('@expo/fingerprint').Config}
 */
module.exports = {
  sourceSkips: [
    // The balanced preset's skips, kept at the default.
    'ExpoConfigVersions',
    'ExpoConfigRuntimeVersionIfString',
    'EasJson',
    'Easignore',
    'AutolinkingConfigPaths',
    // Added: every package.json script (supersedes the preset's PackageJsonAndroidAndIosScriptsIfNotContainRun).
    'PackageJsonScriptsAll',
  ],
};
