import baseConfig from "../../eslint.config.mjs";

export default [
    ...baseConfig,
    {
        // apps/api/package.json is not a pnpm workspace package: locally everything resolves from the
        // root node_modules, but the Docker image installs ONLY what this file lists (nx prune).
        // A missing runtime dependency (e.g. mysql2 in 1.1.0) therefore only shows up in the image.
        // This rule compares the file against the imports of the build and fails lint on drift.
        files: ["package.json"],
        languageOptions: {
            parser: await import("jsonc-eslint-parser"),
        },
        rules: {
            "@nx/dependency-checks": [
                "error",
                {
                    buildTargets: ["build"],
                    checkMissingDependencies: true,
                    checkObsoleteDependencies: true,
                    checkVersionMismatches: true,
                    // tooling, tests and test helpers never ship in the image
                    ignoredFiles: [
                        "{projectRoot}/*.config.{js,ts,mjs,mts}",
                        "{projectRoot}/src/**/*.spec.ts",
                        "{projectRoot}/src/testing/**",
                    ],
                    ignoredDependencies: [
                        // type-only imports; express comes with @nestjs/platform-express
                        "express",
                        // used without a direct import (Nest core resp. tsc importHelpers)
                        "reflect-metadata",
                        "tslib",
                    ],
                },
            ],
        },
    },
];
