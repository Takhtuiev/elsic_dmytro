const fs = require("fs");
const path = require("path");

module.exports = function (app) {
    app.post("/__save-optimizer-log", (req, res) => {
        let body = "";
        req.setEncoding("utf8");

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", () => {
            try {
                // Файл будет перезаписываться в корне проекта (рядом с package.json)
                // Или укажите подпапку: path.resolve(process.cwd(), "src/optimizer-diag.jsonl")
                const targetPath = path.resolve(process.cwd(), "optimizer-diag.jsonl");
                fs.writeFileSync(targetPath, body, "utf8");
                res.status(200).send("OK");
            } catch (err) {
                console.error("Ошибка записи диагностического лога:", err);
                res.status(500).send(err.message);
            }
        });
    });
};
