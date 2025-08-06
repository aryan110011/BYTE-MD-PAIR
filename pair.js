const PastebinAPI = require('pastebin-js');
const pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');
const { ByteID } = require('./id');
const express = require('express');
const fs = require('fs');
const pino = require("pino");
let router = express.Router();

const {
    default: Byte,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("maher-zubair-baileys");

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = ByteID();
    let num = req.query.number;

    if (!num) return res.status(400).send({ error: "Number is required" });

    num = num.replace(/[^0-9]/g, '');
    if (!num.startsWith("91")) {
        num = "91" + num; // Indian number defaulting, modify if needed
    }

    let attempt = 0;

    async function Byte_Pair() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            let Hamza = Byte({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Desktop")
            });

            Hamza.ev.on('creds.update', saveCreds);

            Hamza.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    await Hamza.sendMessage(Hamza.user.id, { text: "*_Sending session id, Wait..._*" });
                    await delay(20000);

                    let data = fs.readFileSync(__dirname + `/temp/${id}/creds.json`);
                    let b64data = Buffer.from(data).toString('base64');

                    let session = await Hamza.sendMessage(Hamza.user.id, { text: 'Byte;;;' + b64data });
                    await delay(8000);

                    await Hamza.sendMessage(Hamza.user.id, { text: `_SESSION ID_` }, { quoted: session });
                    await delay(100);
                    await Hamza.ws.close();
                    removeFile('./temp/' + id);
                }

                else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    if (attempt < 1) {
                        attempt++;
                        console.log("Retrying Byte_Pair...");
                        await delay(10000);
                        return await Byte_Pair(); // <- Added return here
                    } else {
                        console.log("Max retries reached");
                        removeFile('./temp/' + id);
                        if (!res.headersSent) return res.send({ code: "Service Unavailable" });
                    }
                }
            });

            if (!Hamza.authState.creds.registered) {
                await delay(1500);
                const code = await Hamza.requestPairingCode(num);

                if (!res.headersSent && code) {
                    return res.send({ code });
                } else {
                    return res.send({ error: "Failed to generate pairing code" });
                }
            }

        } catch (err) {
            console.log("Service Error:", err);
            removeFile('./temp/' + id);
            if (!res.headersSent) return res.send({ code: "Service Unavailable" });
        }
    }

    return await Byte_Pair();
});

module.exports = router;
