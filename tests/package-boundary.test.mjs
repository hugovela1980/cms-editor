import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as editorApi from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const sourceRoot = path.join(packageRoot, "src");
const metadata = JSON.parse(
    fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
);

assert.equal(metadata.name, "@hugovela/cms-editor");
assert.equal(metadata.private, true);
assert.equal(metadata.type, "module");
assert.equal(metadata.exports["."], "./src/index.js");
assert.equal(
    metadata.exports["./styles/cms-editor.css"],
    "./styles/cms-editor.css",
);
assert.deepEqual(metadata.files, ["src/", "styles/", "README.md"]);
assert.equal(metadata.dependencies, undefined);
assert.equal(metadata.devDependencies, undefined);
assert.equal(metadata.workspaces, undefined);
assert.equal(metadata.scripts.verify, "npm test && npm run pack:check");

for (const exportName of [
    "CMS_PUBLICATION_STAGES",
    "CMS_FIELD_TYPES",
    "assertValidCmsSchema",
    "createCmsSubmissionValidator",
    "createCmsTransientStateSnapshot",
    "createRevisionHistory",
    "getCmsStatusSurface",
    "initializeCmsEditor",
    "isCmsTransientStateSnapshot",
    "validateCmsValuesForSchema",
]) {
    assert.equal(
        typeof editorApi[exportName] === "function" ||
            typeof editorApi[exportName] === "object",
        true,
        `Expected public export: ${exportName}`,
    );
}

const schema = {
    id: "example",
    label: "Example",
    fields: [{
        key: "heading",
        label: "Heading",
        type: editorApi.CMS_FIELD_TYPES.TEXT,
        required: true,
    }],
};

assert.doesNotThrow(() => editorApi.assertValidCmsSchema(schema));
assert.equal(
    editorApi.validateCmsValuesForSchema({
        schema,
        values: { heading: "Hello" },
    }).valid,
    true,
);

const validateSubmission = editorApi.createCmsSubmissionValidator({
    getSchema(schemaId) {
        return schemaId === schema.id ? schema : null;
    },
});
assert.equal(
    validateSubmission({
        schemaId: schema.id,
        values: { heading: "Hello" },
    }).valid,
    true,
);

const sourceFiles = fs
    .readdirSync(sourceRoot)
    .filter((name) => name.endsWith(".js"));

const forbiddenFacts = [
    "@hugovela/test-runner",
    "@netlify/identity",
    "playwright",
    "APPROVED_EDITOR_EMAIL",
    "GITHUB_TOKEN",
    "NETLIFY_AUTH_TOKEN",
    "content/draft/",
    "content/published/",
    "shared draft",
    ["Right", "Track"].join(" "),
];

for (const fileName of sourceFiles) {
    const filePath = path.join(sourceRoot, fileName);
    const contents = fs.readFileSync(filePath, "utf8");

    for (const fact of forbiddenFacts) {
        assert.equal(
            contents.toLowerCase().includes(fact.toLowerCase()),
            false,
            `${fileName} must not contain host dependency: ${fact}`,
        );
    }

    for (const match of contents.matchAll(
        /^\s*(?:import(?:\s+[^"'`]*?\s+from)?|export\s+[^"'`]*?\s+from)\s*["']([^"']+)["']/gm,
    )) {
        const specifier = match[1];
        assert.equal(
            specifier.startsWith("./"),
            true,
            `${fileName} has a non-local runtime import: ${specifier}`,
        );

        const dependencyPath = path.resolve(sourceRoot, specifier);
        assert.equal(
            dependencyPath.startsWith(`${sourceRoot}${path.sep}`),
            true,
            `${fileName} imports outside src/: ${specifier}`,
        );
        assert.equal(
            fs.existsSync(dependencyPath),
            true,
            `${fileName} imports a missing module: ${specifier}`,
        );
    }
}

assert.equal(
    fs.existsSync(path.join(packageRoot, "styles", "cms-editor.css")),
    true,
);

console.log("Standalone CMS editor package checks passed.");
