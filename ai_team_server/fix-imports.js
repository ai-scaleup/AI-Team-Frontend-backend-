const fs = require('fs');
const p = require('path');

function replace(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(f => {
        const fp = p.join(d, f.name);
        if (f.isDirectory() && !fp.includes('generated')) {
            replace(fp);
        } else if (f.isFile() && fp.endsWith('.ts')) {
            let c = fs.readFileSync(fp, 'utf8');
            if (c.includes('@prisma/client')) {
                c = c.replace(/['"]@prisma\/client['"]/g, "'src/generated/prisma/client'");
                fs.writeFileSync(fp, c);
                console.log('Updated ' + fp);
            }
        }
    });
}
replace('e:/DIGITAL_COACH/AI-Team-Frontend-backend-/ai_team_server/src');
