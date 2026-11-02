import mysql from 'mysql2/promise'

// Erreurs qui veulent dire que la base est injoignable, et pas que la requête est fausse
const CONNECTION_ERRORS = new Set([
	'ECONNREFUSED',
	'ECONNRESET',
	'ENOTFOUND',
	'ETIMEDOUT',
	'EHOSTUNREACH',
	'PROTOCOL_CONNECTION_LOST',
	'ER_ACCESS_DENIED_ERROR',
	'ER_BAD_DB_ERROR',
	'ER_CON_COUNT_ERROR',
])

export const isConnectionError = (err) => CONNECTION_ERRORS.has(err?.code)

export function createDatabase({ host, user, password, database }, { createPool = mysql.createPool } = {}) {
	let pool = null

	// Le pool n'ouvre ses connexions qu'à la première requête, et les réutilise ensuite
	const getPool = () => {
		pool ??= createPool({
			host,
			user,
			password,
			database,
			waitForConnections: true,
			connectionLimit: 5,
			enableKeepAlive: true,
		})
		return pool
	}

	return {
		async query(sql, params = []) {
			const [rows] = await getPool().query(sql, params)
			return rows
		},

		async close() {
			if (!pool) return
			const current = pool
			pool = null
			await current.end()
		},
	}
}
