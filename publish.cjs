#!/usr/bin/env node
const fs = require("fs");
const { execSync } = require("child_process");
const pkgPath = "./package.json";
const pkg = require(pkgPath);

const releaseMessage = process.argv[2] || "feature: update version";

try {
    // parse current version
    // eslint-disable-next-line no-unused-vars
    const [major, minor, patch] = pkg.version.split(".").map(Number);

    // determine next version type
    let bumpType = "patch";
    if (patch >= 100) bumpType = "minor";

    // update releaseMessage field
    pkg.releaseMessage = releaseMessage;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

    // bump appropriate version without git tag
    execSync(`npm version ${bumpType} --no-git-tag-version`, {
        stdio: "inherit",
    });

    // read the new version after bump
    const newPkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const newVersion = newPkg.version;

    // stage everything including the updated package.json
    execSync("git add .", { stdio: "inherit" });

    // commit and push
    const currentBranch = execSync("git rev-parse --abbrev-ref HEAD")
        .toString()
        .trim();
    execSync(`git commit -m "${releaseMessage}"`, { stdio: "inherit" });

    try {
        execSync(`git push origin ${currentBranch}`, { stdio: "inherit" });
    } catch {
        console.warn("⚠️ Push failed, attempting force push...");
        execSync(`git push origin ${currentBranch} --force`, {
            stdio: "inherit",
        });
    }

    console.log(`✅ Published v${newVersion}: "${releaseMessage}"`);
} catch (err) {
    console.error("❌ Failed to publish:", err.message);
    process.exit(1);
}
