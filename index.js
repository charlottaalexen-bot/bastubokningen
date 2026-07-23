const express = require('express');
const session = require('express-session');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

const PASSWORD = "Berga4"; // Lösenord för Bergastrands Båtförening
const DB_FILE = './bookings.json';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session-hantering för inloggning
app.use(session({
    secret: 'bergastrand-batu-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // Inloggad i 24 timmar
}));

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

function getBookings() {
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveBookings(bookings) {
    fs.writeFileSync(DB_FILE, JSON.stringify(bookings, null, 2));
}

function isSummer(dateStr) {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    return month >= 6 && month <= 8; // Juni - Augusti
}

function getDayOfWeek(dateStr) {
    return new Date(dateStr).getDay(); // 0 = Söndag, 1 = Måndag...
}

// Inloggnings-middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }
    res.redirect('/login');
}

// Inloggningssida
app.get('/login', (req, res) => {
    let errorMsg = req.query.error ? '<p style="color:red;">Felaktigt lösenord!</p>' : '';
    res.send(`
        <!DOCTYPE html>
        <html lang="sv">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Inloggning - Bergastrands Båtförening</title>
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f4f8; }
                .login-card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 350px; text-align: center; }
                input { width: 100%; padding: 10px; margin: 10px 0; box-sizing: border-box; }
                button { width: 100%; padding: 10px; background: #2c3e50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
            </style>
        </head>
        <body>
            <div class="login-card">
                <h2>Bergastrands Båtförening</h2>
                <p>Ange lösenord för att boka bastun</p>
                ${errorMsg}
                <form action="/login" method="POST">
                    <input type="password" name="password" placeholder="Lösenord" required>
                    <button type="submit">Logga in</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/login', (req, res) => {
    if (req.body.password === PASSWORD) {
        req.session.authenticated = true;
        res.redirect('/');
    } else {
        res.redirect('/login?error=1');
    }
});

// Huvudsida (skyddad)
app.get('/', requireAuth, (req, res) => {
    const bookings = getBookings();
    
    let html = `
    <!DOCTYPE html>
    <html lang="sv">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bastubokning - Bergastrands Båtförening</title>
        <style>
            body { font-family: sans-serif; max-width: 800px; margin: 20px auto; padding: 0 15px; line-height: 1.5; color: #333; }
            h1, h2 { color: #2c3e50; }
            .info-box { background: #eef6fb; border-left: 4px solid #3498db; padding: 15px; margin-bottom: 20px; font-size: 14px; }
            .form-group { margin-bottom: 15px; }
            label { display: block; font-weight: bold; margin-bottom: 5px; }
            input, select { width: 100%; padding: 8px; box-sizing: border-box; }
            button { background: #27ae60; color: white; border: none; padding: 10px 15px; font-size: 16px; cursor: pointer; border-radius: 4px; }
            button:hover { background: #219150; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #eee; }
            .badge-closed { background: #e74c3c; color: white; padding: 3px 6px; border-radius: 3px; font-size: 12px; }
            .badge-open { background: #2ecc71; color: white; padding: 3px 6px; border-radius: 3px; font-size: 12px; }
        </style>
    </head>
    <body>
        <h1>Bastubokning - Bergastrands Båtförening</h1>
        
        <div class="info-box">
            <strong>Basturegler:</strong><br>
            • Max 1 bokning per dag (2 timmar). Endast 1 samtidig bokning per pass.<br>
            • Max 1 sluten och 3 öppna bokningar per vecka per medlem/hyrestagare.<br>
            • <strong>Juni–Aug:</strong> Kan bokas max 2 veckor i förväg. Mån, Ons, Fre & Sön endast öppna bokningar.<br>
            • <strong>Sep–Maj:</strong> Slutna pass kan bokas kl 15–17, 19–21 & 21–23.<br>
            • <em>Bokning av hela huset görs via sekreteraren. Ansvarig: Tommy Glasér (tommylglaser@gmail.com / 070-5472048)</em>
        </div>

        <h2>Gör en bokning</h2>
        <form action="/book" method="POST">
            <div class="form-group">
                <label>Fastighet:</label>
                <input type="text" name="property" required placeholder="t.ex. Berga 1:2">
            </div>
            <div class="form-group">
                <label>Ansvarig medlem/hyrestagare:</label>
                <input type="text" name="name" required placeholder="För- och efternamn">
            </div>
            <div class="form-group">
                <label>Datum:</label>
                <input type="date" name="date" required>
            </div>
            <div class="form-group">
                <label>Pass (2 timmar):</label>
                <select name="time" required>
                    <option value="13:00">13:00 - 15:00</option>
                    <option value="15:00">15:00 - 17:00</option>
                    <option value="17:00">17:00 - 19:00</option>
                    <option value="19:00">19:00 - 21:00</option>
                    <option value="21:00">21:00 - 23:00</option>
                </select>
            </div>
            <div class="form-group">
                <label>Typ av bokning:</label>
                <select name="type" required>
                    <option value="Öppen">Öppen (Sällskap välkomnas)</option>
                    <option value="Sluten">Sluten (Egentid)</option>
                </select>
            </div>
            <button type="submit">Boka pass</button>
        </form>

        <h2>Registrerade bokningar</h2>
        <table>
            <thead>
                <tr>
                    <th>Datum</th>
                    <th>Tid</th>
                    <th>Fastighet</th>
                    <th>Ansvarig</th>
                    <th>Typ</th>
                </tr>
            </thead>
            <tbody>
    `;

    const sortedBookings = bookings.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (sortedBookings.length === 0) {
        html += `<tr><td colspan="5">Inga bokningar finns i kalendern.</td></tr>`;
    } else {
        sortedBookings.forEach(b => {
            const badgeClass = b.type === 'Sluten' ? 'badge-closed' : 'badge-open';
            const endHour = parseInt(b.time) + 2;
            html += `
                <tr>
                    <td>${b.date}</td>
                    <td>${b.time} - ${endHour}:00</td>
                    <td>${b.property}</td>
                    <td>${b.name}</td>
                    <td><span class="${badgeClass}">${b.type}</span></td>
                </tr>
            `;
        });
    }

    html += `
            </tbody>
        </table>
    </body>
    </html>
    `;

    res.send(html);
});

// Hantera bokning med regelkontroller
app.post('/book', requireAuth, (req, res) => {
    const { property, name, date, time, type } = req.body;
    const bookings = getBookings();

    const todayStr = new Date().toISOString().split('T')[0];
    const bookingDate = new Date(date);
    const todayDate = new Date(todayStr);
    const isSummerTime = isSummer(date);
    const dayOfWeek = getDayOfWeek(date);

    // Krockkontroll (Endast en bokning per pass)
    const existing = bookings.find(b => b.date === date && b.time === time);
    if (existing) {
        return res.send(`<h3>Fel: Detta pass är redan bokat.</h3><a href="/">Tillbaka</a>`);
    }

    // Regler för Sommaren (Juni - Aug)
    if (isSummerTime) {
        const diffTime = bookingDate - todayDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 14) {
            return res.send(`<h3>Fel: Under juni–augusti kan bokning göras tidigast 2 veckor (14 dagar) i förväg.</h3><a href="/">Tillbaka</a>`);
        }

        // Mån (1), Ons (3), Fre (5), Sön (0) = Endast öppna
        const openDays = [0, 1, 3, 5];
        if (openDays.includes(dayOfWeek) && type === 'Sluten') {
            return res.send(`<h3>Fel: Denna dag (måndag, onsdag, fredag eller söndag under sommaren) tillåter endast ÖPPNA bokningar.</h3><a href="/">Tillbaka</a>`);
        }
    } else {
        // Regler för Vinter (Sep - Maj)
        const allowedClosedTimes = ['15:00', '19:00', '21:00'];
        if (type === 'Sluten' && !allowedClosedTimes.includes(time)) {
            return res.send(`<h3>Fel: Under september–maj kan slutna bokningar endast göras på tiderna 15.00–17.00, 19.00–21.00 och 21.00–23.00.</h3><a href="/">Tillbaka</a>`);
        }
    }

    // Spara godkänd bokning
    bookings.push({ property, name, date, time, type });
    saveBookings(bookings);

    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Bokningssajten körs på port ${PORT}`);
});