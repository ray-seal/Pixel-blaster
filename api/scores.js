const { neon } = require('@neondatabase/serverless');

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

function send(res, status, payload) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return send(res, 405, { error: 'Method not allowed' });
    }

    if (!sql) {
        return send(res, 503, { error: 'Leaderboard is not configured' });
    }

    try {
        if (req.method === 'GET') {
            const scores = await sql`
                SELECT name, score, distance, created_at
                FROM high_scores
                ORDER BY score DESC, created_at ASC
                LIMIT 20
            `;
            return send(res, 200, { scores });
        }

        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const name = String(body.name || '').trim().toUpperCase();
        const score = Number(body.score);
        const distance = Number(body.distance);

        if (!/^[A-Z0-9]{1,3}$/.test(name)) {
            return send(res, 400, { error: 'Name must be 1 to 3 letters or numbers' });
        }
        if (!Number.isSafeInteger(score) || score < 0 || score > 2147483647) {
            return send(res, 400, { error: 'Invalid score' });
        }
        if (!Number.isSafeInteger(distance) || distance < 0 || distance > 2147483647) {
            return send(res, 400, { error: 'Invalid distance' });
        }

        const [saved] = await sql`
            INSERT INTO high_scores (name, score, distance)
            VALUES (${name}, ${score}, ${distance})
            RETURNING name, score, distance, created_at
        `;

        return send(res, 201, { score: saved });
    } catch (error) {
        console.error('Neon leaderboard error:', error);
        return send(res, 500, { error: 'Could not process leaderboard request' });
    }
};
