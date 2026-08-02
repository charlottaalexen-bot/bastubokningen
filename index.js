const express = require('express');
const session = require('express-session');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

const PASSWORD = "Berga4"; // Lösenord för Bergastrands Båtförening[cite: 2]
const DB_FILE = './bookings.json';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    return month >= 6 && month <= 8; // Juni - Augusti[cite: 2]
}

function getDayOfWeek(dateStr) {
    return new Date(dateStr).getDay(); // 0 = Söndag, 1 = Måndag...
}

function generateCalendarLinks(date, time, type) {
    const startHour = time.split(':')[0].padStart(2, '0');
    const endHour = String(parseInt(startHour) + 2).padStart(2, '0');
    
    const cleanDate = date.replace(/-/g, '');
    const startIso = `${cleanDate}T${startHour}0000`;
    const endIso = `${cleanDate}T${endHour}0000`;

    const title = encodeURIComponent(`Bastubokning Bergastrands Båtförening (${type})`);
    const details = encodeURIComponent(`Din bastubokning hos Bergastrands Båtförening. Typ: ${type}.`);
    const location = encodeURIComponent(`Bergastrands Båthus`);

    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
    const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}&startdt=${date}T${startHour}:00:00&enddt=${date}T${endHour}:00:00&body=${details}&location=${location}`;

    const icalData = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Bastubokning (${type})
DESCRIPTION:Din bastubokning hos Bergastrands Båtförening.
LOCATION:Bergastrands Båthus
DTSTART:${startIso}
DTEND:${endIso}
END:VEVENT
END:VCALENDAR`;

    const icalDataUri = `data:text/calendar;charset=utf8,${encodeURIComponent(icalData)}`;

    return { googleUrl, outlookUrl, icalDataUri };
}

function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }
    res.redirect('/login');
}

// Hjälpfunktion för att rendera huvudsidan (med eller utan felmeddelande/sparad data)
function renderMainPage(req, res, errorMessage = '', formData = {}) {
    const bookings = getBookings();
    
    // Standardvärden eller sparade värden från senaste försöket
    const propertyVal = formData.property || '';
    const nameVal = formData.name || '';
    const emailVal = formData.email || '';
    const dateVal = formData.date || '';
    const timeVal = formData.time || '13:00';
    const typeVal = formData.type || 'Öppen';

    let errorHtml = '';
    if (errorMessage) {
        errorHtml = `
            <div class="error-card">
                <div class="error-title">⚠️ Bokningen kunde inte genomföras</div>
                <div class="error-body">${errorMessage}</div>
            </div>
        `;
    }
    
    let html = `
    <!DOCTYPE html>
    <html lang="sv">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bastubokning - Bergastrands Båtförening</title>
        <style>
            body { font-family: sans-serif; max-width: 850px; margin: 20px auto; padding: 0 15px; line-height: 1.5; color: #333; }
            h1, h2 { color: #2c3e50; }
            .info-box { background: #eef6fb; border-left: 4px solid #3498db; padding: 15px; margin-bottom: 20px; font-size: 14px; }
            
            .error-card { 
                background: #fdf2f2; 
                border: 1px solid #f8b4b4; 
                border-left: 5px solid #e74c3c; 
                border-radius: 6px; 
                padding: 15px 20px; 
                margin-bottom: 25px; 
                box-shadow: 0 2px 4px rgba(231, 76, 60, 0.08);
            }
            .error-title { font-weight: bold; color: #c0392b; font-size: 16px; margin-bottom: 5px; }
            .error-body { color: #7f8c8d; font-size: 14px; }

            .form-group { margin-bottom: 15px; }
            label { display: block; font-weight: bold; margin-bottom: 5px; }
            input, select { width: 100%; padding: 10px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
            input:focus, select:focus { border-color: #3498db; outline: none; }
            button { background: #27ae60; color: white; border: none; padding: 12px 20px; font-size: 16px; cursor: pointer; border-radius: 4px; font-weight: bold; }
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
            • Max 1 bokning per dag (2 timmar).<br>
            • Max 1 sluten och 3 öppna bokningar per vecka per medlem/hyrestagare.<br>
            • <strong>Juni–Aug:</strong> Kan bokas max 2 veckor i förväg. Mån, Ons, Fre & Sön endast öppna bokningar.<br>
            • <strong>Sep–Maj:</strong> Slutna pass kan bokas kl 15–17, 19–21 & 21–23.<br>
            • <em>Bokning av hela huset görs via sekreteraren. Ansvarig: Tommy Glasér (tommylglaser@gmail.com / 070-5472048)</em>[cite: 2]
        </div>

        ${errorHtml}

        <h2>Gör en bokning</h2>
        <form action="/book" method="POST">
            <div class="form-group">
                <label>Fastighet:</label>
                <input type="text" name="property" value="${propertyVal}" required placeholder="t.ex. Berga 1:2">
            </div>
            <div class="form-group">
                <label>Ansvarig medlem/hyrestagare:</label>
                <input type="text" name="name" value="${nameVal}" required placeholder="För- och efternamn">
            </div>
            <div class="form-group">
                <label>E-postadress:</label>
                <input type="email" name="email" value="${emailVal}" required placeholder="namn@exempel.se">
            </div>
            <div class="form-group">
                <label>Datum:</label>
                <input type="date" name="date" value="${dateVal}" required>
            </div>
            <div class="form-group">
                <label>Pass (2 timmar):</label>
                <select name="time" required>
                    <option value="13:00" ${timeVal === '13:00' ? 'selected' : ''}>13:00 - 15:00</option>
                    <option value="15:00" ${timeVal === '15:00' ? 'selected' : ''}>15:00 - 17:00</option>
                    <option value="17:00" ${timeVal === '17:00' ? 'selected' : ''}>17:00 - 19:00</option>
                    <option value="19:00" ${timeVal === '19:00' ? 'selected' : ''}>19:00 - 21:00</option>
                    <option value="21:00" ${timeVal === '21:00' ? 'selected' : ''}>21:00 - 23:00</option>
                </select>
            </div>
            <div class="form-group">
                <label>Typ av bokning:</label>
                <select name="type" required>
                    <option value="Öppen" ${typeVal === 'Öppen' ? 'selected' : ''}>Öppen (Sällskap välkomnas)</option>
                    <option value="Sluten" ${typeVal === 'Sluten' ? 'selected' : ''}>Sluten (Egentid)</option>
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
                    <th>E-post</th>
                    <th>Typ</th>
                </tr>
            </thead>
            <tbody>
    `;

    const sortedBookings = bookings.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (sortedBookings.length === 0) {
        html += `<tr><td colspan="6">Inga bokningar finns i kalendern.</td></tr>`;
    } else {
        sortedBookings.forEach(b => {
            const badgeClass = b.type === 'Sluten' ? 'badge-closed' : 'badge-open';
            const endHour = parseInt(b.time) + 2;
            const emailDisplay = b.email ? b.email : '-';
            html += `
                <tr>
                    <td>${b.date}</td>
                    <td>${b.time} - ${endHour}:00</td>
                    <td>${b.property}</td>
                    <td>${b.name}</td>
                    <td>${emailDisplay}</td>
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
    renderMainPage(req, res);
});

// Hantera bokning
app.post('/book', requireAuth, (req, res) => {
    const { property, name, email, date, time, type } = req.body;
    const bookings = getBookings();

    const todayStr = new Date().toISOString().split('T')[0];
    const bookingDate = new Date(date);
    const todayDate = new Date(todayStr);
    const isSummerTime = isSummer(date);
    const dayOfWeek = getDayOfWeek(date);

    // Krockkontroll
    const existing = bookings.find(b => b.date === date && b.time === time);
    if (existing) {
        return renderMainPage(req, res, 'Detta pass är tyvärr redan bokat. Vänligen välj en annan tid eller datum.', req.body);
    }

    // Regler Juni - Aug
    if (isSummerTime) {
        const diffTime = bookingDate - todayDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 14) {
            return renderMainPage(req, res, 'Under juni–augusti kan bokningar göras tidigast 2 veckor (14 dagar) i förväg.', req.body);
        }

        const openDays = [0, 1, 3, 5]; // Mån, Ons, Fre, Sön
        if (openDays.includes(dayOfWeek) && type === 'Sluten') {
            return renderMainPage(req, res, 'På måndagar, onsdagar, fredagar och söndagar under sommaren tillåts endast ÖPPNA bokningar.', req.body);
        }
    } else {
        // Regler Sep - Maj
        const allowedClosedTimes = ['15:00', '19:00', '21:00'];
        if (type === 'Sluten' && !allowedClosedTimes.includes(time)) {
            return renderMainPage(req, res, 'Under september–maj kan slutna bokningar endast göras på tiderna 15.00–17.00, 19.00–21.00 och 21.00–23.00.', req.body);
        }
    }

    // Spara bokningen
    bookings.push({ property, name, email, date, time, type });
    saveBookings(bookings);

    // Skapa kalenderlänkar
    const { googleUrl, outlookUrl, icalDataUri } = generateCalendarLinks(date, time, type);
    const endHour = parseInt(time) + 2;
    const timeFormatted = `${time} - ${endHour}:00`;

    // Visa bekräftelsesida
    res.send(`
        <!DOCTYPE html>
        <html lang="sv">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bokningsbekräftelse</title>
            <style>
                body { font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; text-align: center; line-height: 1.6; }
                .card { background: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .btn { display: inline-block; padding: 10px 15px; margin: 5px; color: white; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 14px; }
                .btn-google { background: #4285F4; }
                .btn-outlook { background: #0078D4; }
                .btn-ical { background: #27ae60; }
                .btn-back { background: #718096; margin-top: 20px; display: inline-block; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2 style="color: #27ae60;">Bokning genomförd!</h2>
                <p style="font-size: 18px;"><strong>Tack för din bokning den ${date}!</strong></p>
                <p><strong>Tid:</strong> ${timeFormatted}<br>
                <strong>Fastighet:</strong> ${property}<br>
                <strong>Typ:</strong> ${type}</p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                
                <h3>Lägg till i din kalender:</h3>
                <a href="${googleUrl}" target="_blank" class="btn btn-google">Google Calendar</a>
                <a href="${outlookUrl}" target="_blank" class="btn btn-outlook">Outlook Calendar</a>
                <a href="${icalDataUri}" download="bastubokning.ics" class="btn btn-ical">Ladda ner iCal (.ics)</a>
                
                <br>
                <a href="/" class="btn btn-back">Tillbaka till bokningen</a>
            </div>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Bokningssajten körs på port ${PORT}`);
});
