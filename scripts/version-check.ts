import * as fs from 'fs';
import * as path from 'path';

interface VersionInfo {
    file: string;
    version: string;
    line: number;
}

const FILES_TO_CHECK = [
    { path: 'manifest.json', pattern: /"version":\s*"([\d.]+)"/ },
    { path: 'package.json', pattern: /"version":\s*"([\d.]+)"/ },
    { path: 'versions.json', pattern: /"[\d.]+"\s*:\s*"([\d.]+)"/ },
    { path: 'README.md', pattern: /版本：([\d.]+)/ },
    { path: 'prd.md', pattern: /v([\d.]+)/ }
];

function extractVersion(filePath: string, content: string, pattern: RegExp): VersionInfo | null {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const match = pattern.exec(lines[i]);
        if (match) {
            return {
                file: filePath,
                version: match[1],
                line: i + 1
            };
        }
    }
    return null;
}

function checkVersions() {
    const versions: VersionInfo[] = [];
    const rootDir = path.resolve(__dirname, '..');

    for (const file of FILES_TO_CHECK) {
        const filePath = path.join(rootDir, file.path);
        if (!fs.existsSync(filePath)) {
            console.warn(`警告: 文件 ${file.path} 不存在`);
            continue;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const versionInfo = extractVersion(file.path, content, file.pattern);
        
        if (versionInfo) {
            versions.push(versionInfo);
        } else {
            console.warn(`警告: 在文件 ${file.path} 中未找到版本号`);
        }
    }

    // 检查版本是否一致
    const firstVersion = versions[0]?.version;
    const inconsistentVersions = versions.filter(v => v.version !== firstVersion);

    if (inconsistentVersions.length > 0) {
        console.error('错误: 发现版本号不一致:');
        versions.forEach(v => {
            console.log(`${v.file} (行 ${v.line}): ${v.version}`);
        });
        process.exit(1);
    } else if (versions.length > 0) {
        console.log(`✓ 所有文件版本号一致: ${firstVersion}`);
    } else {
        console.error('错误: 未找到任何版本号');
        process.exit(1);
    }
}

checkVersions(); 